import http from "node:http";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { refreshMarkets, matchMarkets, markets } from "./markets.mjs";
import { streamPosts } from "./news.mjs";
import { judge, prepare, gate, gateModel, analystStatus, PROMPT_VERSION } from "./analyst.mjs";
import { midpoint } from "./prices.mjs";
import { startGrader, readJsonl, callTime } from "./grader.mjs";
import { streamChain } from "./chain.mjs";
import { runKombat } from "./kombat.mjs";
import { startCorrections } from "./corrections.mjs";
import { loadLocalGate, factScore, LOCAL_GATE_MODEL } from "./localGate.mjs";
import { adminAvailable, account, adapters, lanes } from "./mubitAdmin.mjs";
import { emit, record, recentOf, subscribe, feed } from "./store.mjs";

const PORT = Number(process.env.PORT || 4321);
const STAKE = 100;
const stats = { posts: 0, dropped: 0, matched: 0, gated: 0, filtered: 0, judged: 0, decided: 0, correct: 0, pnl: 0, ratedUp: 0, ratedDown: 0, localBlocked: 0, trades: 0, tradesWon: 0 };

// Free first pass: skip short posts, posts that are mostly hashtags/links, and repeats seen in the last 30 minutes.
const seen = new Map();
function worthChecking(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 8) return false;
  if (words.filter((w) => /^[#@]|^https?:|\.\w{2,}\//.test(w)).length / words.length > 0.4) return false;
  const key = text.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
  const now = Date.now();
  if (now - (seen.get(key) ?? 0) < 30 * 60_000) return false;
  seen.set(key, now);
  if (seen.size > 5000) seen.delete(seen.keys().next().value);
  return true;
}

console.log(`Loaded ${await refreshMarkets()} live markets`);
setInterval(() => refreshMarkets().catch(() => {}), 5 * 60_000);

const brief = (m) => ({ id: m.id, question: m.question, outcomes: m.outcomes, yesToken: m.yesToken });

// Paper trade: $100 on the side the analyst called, for calls of strength 2+. Before fees and spread.
// Risk rule: no long shots under 15¢ (a few points' wobble halves the stake) and no near-certainties over 85¢
// (almost nothing to win). Learned from a 12¢ trade that lost $46.61 on a 5.5-point move.
const MIN_ENTRY = 0.15;
const MAX_ENTRY = 0.85;
function paperPnl(g) {
  if (g.effect === "none" || g.strength < 2 || g.priceAtCall == null) return 0;
  const entry = g.effect === "up" ? g.priceAtCall : 1 - g.priceAtCall;
  if (entry < MIN_ENTRY || entry > MAX_ENTRY) return 0;
  const exit = g.effect === "up" ? g.priceAfter : 1 - g.priceAfter;
  return STAKE * (exit / entry - 1);
}

function count(g) {
  if (g.correct != null) {
    stats.decided++;
    if (g.correct) stats.correct++;
  }
  if (g.pnl) {
    stats.trades++;
    if (g.pnl > 0) stats.tradesWon++;
  }
  stats.pnl += g.pnl ?? 0;
}

// Restart-safe: rebuild the scoreboard from what is already on disk, under the current trading rules.
for (const g of await readJsonl("grades.jsonl")) count({ ...g, pnl: Number(paperPnl(g).toFixed(2)) });
stats.judged = (await readJsonl("calls.jsonl")).length;

function onGraded(g) {
  g.pnl = Number(paperPnl(g).toFixed(2));
  count(g);
  emit("grade", g);
  record("grades.jsonl", g);
}

// Cheap AI gate (Haiku via Mubit): only posts that state a real, new fact go on to the analyst.
const LOCAL_GATE_MIN = Number(process.env.LOCAL_GATE_MIN || 0.5);
loadLocalGate()
  .then(() => console.log(`Local gate ready: ${LOCAL_GATE_MODEL}`))
  .catch((e) => console.error("local gate:", e.message));

async function passesGate(post, candidates) {
  // 1) Free local classifier drops clear chatter before any paid call.
  const started = Date.now();
  const score = await factScore(post.text).catch(() => null);
  if (score != null && score < LOCAL_GATE_MIN) {
    stats.localBlocked++;
    record("gate.jsonl", { at: Date.now(), model: `local:${LOCAL_GATE_MODEL}`, relevant: false, score, text: post.text.slice(0, 500), markets: candidates.map(brief), latencyMs: Date.now() - started, cost: 0 });
    return false;
  }
  // 2) Haiku via Mubit decides the rest (and teaches Mubit's small gate model).
  if (!gateModel()) return true;
  const { input, sessionId } = prepare(post, candidates);
  const g = await gate(input, sessionId);
  stats.gated++;
  record("gate.jsonl", { at: Date.now(), model: gateModel(), relevant: g.relevant, text: post.text.slice(0, 500), markets: candidates.map(brief), latencyMs: g.latencyMs, cost: g.cost });
  if (g.relevant) return true;
  stats.filtered++;
  return false;
}

// One post at a time, newest first; stale posts are dropped rather than falling behind.
const queue = [];
let busy = false;
async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const { post, candidates } = queue.pop();
  try {
    if (await passesGate(post, candidates)) await analyse(post, candidates);
  } catch (e) {
    emit("problem", { message: e.message });
    console.error(e.message);
  }
  busy = false;
  setImmediate(pump);
}

async function analyse(post, candidates) {
  const verdict = await judge(post, candidates);
  if (!verdict) return;
  stats.judged++;
  const graded = verdict.market ?? candidates[0]; // "none" calls are graded against the top match
  const call = {
    id: `${Date.now()}-${stats.judged}`,
    text: post.text.slice(0, 500),
    candidates: candidates.map(brief),
    effect: verdict.effect,
    strength: verdict.strength,
    reason: verdict.reason,
    market: brief(graded),
    priceAtCall: await midpoint(graded.yesToken).catch(() => null),
    latencyMs: verdict.latencyMs,
    servedBy: verdict.servedBy,
    mubitRequestId: verdict.mubitRequestId,
    sessionId: verdict.sessionId,
    usage: verdict.usage,
    cost: verdict.cost,
    input: verdict.input, // exact text the model saw, so Model Kombat can replay it fairly
    promptVersion: PROMPT_VERSION,
  };
  emit("call", call);
  await record("calls.jsonl", call);
}

streamPosts((post) => {
  if (!worthChecking(post.text)) return stats.dropped++;
  const candidates = matchMarkets(post.text);
  if (!candidates.length) return;
  stats.matched++;
  emit("match", { text: post.text.slice(0, 280), markets: candidates.map((c) => c.question) });
  queue.push({ post, candidates });
  if (queue.length > 10) queue.shift();
  pump();
}, stats);

startGrader(onGraded);

// Mubit side: corrections (market verdict -> Good/Bad rating), balance, tasks and trained adapters.
for (const r of await readJsonl("ratings.jsonl")) r.rating === "up" ? stats.ratedUp++ : stats.ratedDown++;
let mubitNow = null;
async function refreshMubit() {
  try {
    const [acct, ads, ls] = await Promise.all([account(), adapters(), lanes()]);
    const today = (await readJsonl("balance.jsonl")).filter((b) => b.at >= new Date().setHours(0, 0, 0, 0));
    const last = today.at(-1);
    if (!last || Date.now() - last.at > 5 * 60_000 || last.balanceUsd !== acct.balanceUsd) {
      const row = { at: Date.now(), ...acct };
      await record("balance.jsonl", row);
      today.push(row);
    }
    mubitNow = {
      ...acct,
      spentFromBalanceToday: today.length ? today[0].balanceUsd - acct.balanceUsd : 0,
      adapters: ads.map((a) => {
        const v = a.versions?.at(-1) ?? {};
        return {
          id: a.adapter_id,
          baseModel: a.base_model,
          version: v.version,
          status: v.status,
          promotion: v.promotion_state,
          rolloutPercent: v.rollout_percent,
          verdict: v.gate_advisory?.verdict ?? null,
          passRate: v.gate_advisory?.pass_rate ?? null,
          reason: v.gate_advisory?.reason ?? null,
        };
      }),
      tasks: ls.map((l) => ({
        name: l.name ?? l.label,
        adapterId: l.adapter_id,
        calls: l.counts?.traces ?? 0,
        trainable: l.counts?.trainable ?? 0,
        ratedUp: l.counts?.rated_up ?? 0,
        ratedDown: l.counts?.rated_down ?? 0,
        unrated: l.counts?.unrated ?? 0,
      })),
      checkedAt: Date.now(),
    };
    emit("mubit", mubitNow);
  } catch (e) {
    console.error("mubit status:", e.message);
  }
}
if (await adminAvailable()) {
  refreshMubit();
  setInterval(refreshMubit, 60_000);
  startCorrections((r) => {
    r.rating === "up" ? stats.ratedUp++ : stats.ratedDown++;
    emit("rated", r);
  });
} else {
  console.log("Mubit console login not found: run `node data/tools/mubit-console.mjs` for balance, ratings and adapters.");
}
streamChain((tick) => emit("chain", tick)).catch((e) => console.error("chain:", e.message));
setInterval(
  () =>
    emit("stats", {
      ...stats,
      analyst: analystStatus(),
      markets: markets.size,
      queue: queue.length,
      spendToday: spendNow?.todayUsd ?? null,
      spendCallsToday: spendNow?.callsToday ?? null,
      mubitBalance: mubitNow?.balanceUsd ?? null,
      mubitRunsLeft: mubitNow?.runsLeft ?? null,
      mubitSpentToday: mubitNow?.spentFromBalanceToday ?? null,
    }),
  2000,
);

// Night Shift: how the analyst is doing per model version and over time, graded by the market.
async function nightShift() {
  const decided = (await readJsonl("grades.jsonl")).filter((g) => g.correct != null);
  const summarise = (rows) => {
    const moves = rows.filter((g) => g.actual !== "none");
    const calledMoves = rows.filter((g) => g.effect !== "none");
    return {
      decided: rows.length,
      accuracy: rows.length ? rows.filter((g) => g.correct).length / rows.length : null,
      alwaysNone: rows.length ? rows.filter((g) => g.actual === "none").length / rows.length : null, // the lazy baseline
      movesCaught: moves.length ? moves.filter((g) => g.correct).length / moves.length : null,
      moves: moves.length,
      callPrecision: calledMoves.length ? calledMoves.filter((g) => g.correct).length / calledMoves.length : null,
      calls: calledMoves.length,
      avgLatencyMs: rows.length ? Math.round(rows.reduce((s, g) => s + (g.latencyMs ?? 0), 0) / rows.length) : null,
      costPerCall: rows.length ? rows.reduce((s, g) => s + (g.cost ?? 0), 0) / rows.length : null,
    };
  };
  // A "version" is whatever served the call: the provider model today, a Mubit adapter if Mubit starts serving one.
  const versions = Object.entries(Object.groupBy(decided, (g) => `${g.servedBy} · prompt ${g.promptVersion}`)).map(([name, rows]) => ({ name, ...summarise(rows) }));
  const buckets = Object.groupBy(decided, (g) => Math.floor(callTime(g) / 900) * 900);
  const curve = Object.entries(buckets)
    .sort(([a], [b]) => a - b)
    .map(([from, rows]) => ({ from: Number(from), ...summarise(rows) }));
  const base = curve.find((b) => b.decided >= 10)?.accuracy ?? null;
  const now = summarise(decided);
  return {
    now,
    versions,
    curve,
    normalizedGain: base != null && base < 1 && now.accuracy != null ? (now.accuracy - base) / (1 - base) : null,
    corrections: decided.filter((g) => !g.correct).length,
  };
}

// Spend through Mubit, estimated from token counts × Anthropic list prices (Mubit's Billing page is the real bill).
// Read by the CodexBar "Mubit" plugin.
async function spend() {
  const rows = [
    ...(await readJsonl("calls.jsonl")).map((c) => ({ at: callTime(c) * 1000, model: c.servedBy, cost: c.cost })),
    ...(await readJsonl("filtered.jsonl")).map((g) => ({ at: g.at, model: "claude-haiku-4-5", cost: g.cost })), // older gate log
    ...(await readJsonl("gate.jsonl")).map((g) => ({ at: g.at, model: g.model, cost: g.cost })),
    ...(await readJsonl("kombat.jsonl")),
  ].filter((r) => typeof r.cost === "number");
  const midnight = new Date().setHours(0, 0, 0, 0);
  const sum = (list) => list.reduce((s, r) => s + r.cost, 0);
  const today = rows.filter((r) => r.at >= midnight);
  const byModel = Object.entries(Object.groupBy(today, (r) => r.model ?? "unknown"))
    .map(([model, list]) => ({ model, usd: sum(list), calls: list.length }))
    .sort((a, b) => b.usd - a.usd);
  const hourly = Object.entries(Object.groupBy(rows.filter((r) => r.at >= Date.now() - 24 * 3600_000), (r) => new Date(r.at).getHours()))
    .map(([hour, list]) => ({ hour: `${hour.padStart(2, "0")}:00`, usd: sum(list) }));
  return {
    todayUsd: sum(today),
    last24hUsd: sum(rows.filter((r) => r.at >= Date.now() - 24 * 3600_000)),
    totalUsd: sum(rows),
    callsToday: today.length,
    byModel,
    hourly,
    mubit: mubitNow && {
      balanceUsd: mubitNow.balanceUsd,
      runsLeft: mubitNow.runsLeft,
      usdPerRun: mubitNow.usdPerRun,
      spentFromBalanceToday: mubitNow.spentFromBalanceToday,
    },
    note: "Two parts: Mubit balance (real money, read from Mubit, spent per run on rating and training) and provider calls covered by the starter credit (estimated from token counts × Anthropic list prices).",
  };
}

// Keep a fresh spend figure for the scoreboard, and publish it to a secret GitHub Gist for the CodexBar
// "Mubit" plugin (CodexBar only reads https:// sources). Only the spend numbers leave this machine.
let spendNow = null;
let gistPublishedAt = 0;
async function refreshSpend() {
  spendNow = await spend().catch(() => spendNow);
  if (!process.env.SPEND_GIST_ID || !spendNow || Date.now() - gistPublishedAt < 5 * 60_000) return; // every gist edit is a revision
  gistPublishedAt = Date.now();
  const body = JSON.stringify({ files: { "spend.json": { content: JSON.stringify({ ...spendNow, updatedAt: new Date().toISOString() }, null, 2) } } });
  const gh = execFile("gh", ["api", "-X", "PATCH", `/gists/${process.env.SPEND_GIST_ID}`, "--input", "-"], (err) => err && console.error("spend gist:", err.message));
  gh.stdin.end(body);
}
refreshSpend();
setInterval(refreshSpend, 30_000);

let kombatRunning = false;
async function startKombat(limit) {
  if (kombatRunning) return false;
  kombatRunning = true;
  emit("kombat", { status: "started" });
  const onRound = (r) => {
    emit("kombat", { status: "round", ...r });
    for (const f of r.results) if (f.cost) record("kombat.jsonl", { at: Date.now(), model: f.name, cost: f.cost });
  };
  runKombat({ limit, onRound })
    .then((board) => emit("kombat", { status: "done", board }))
    .catch((e) => emit("kombat", { status: "error", message: e.message }))
    .finally(() => (kombatRunning = false));
  return true;
}

const FILES = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/style.css": ["style.css", "text/css"] };
const json = (res, body, status = 200) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
      for (const type of ["match", "call", "grade", "chain", "stats", "mubit"])
        for (const e of recentOf(type, ["chain", "stats", "mubit"].includes(type) ? 1 : 25)) res.write(`event: ${type}\ndata: ${JSON.stringify(e)}\n\n`);
      subscribe(res);
      return;
    }
    if (url.pathname === "/api/feed") return json(res, feed(Number(url.searchParams.get("since")) || 0));
    if (url.pathname === "/api/nightshift") return json(res, await nightShift());
    if (url.pathname === "/api/spend") return json(res, await spend());
    if (url.pathname === "/api/mubit") return json(res, mubitNow ?? { unavailable: true });
    // Through the public tunnel (Cloudflare adds cf-connecting-ip), visitors can watch but not spend credits.
    const isPublic = Boolean(req.headers["cf-connecting-ip"]);
    if (url.pathname === "/api/kombat" && req.method === "POST" && isPublic && url.searchParams.get("key") !== process.env.ADMIN_KEY) {
      return json(res, { error: "Model Kombat spends AI credits, so it can only be started by the owner." }, 403);
    }
    if (url.pathname === "/api/kombat" && req.method === "POST") {
      const started = await startKombat(Math.min(Number(url.searchParams.get("rounds")) || 20, 50));
      return json(res, { started }, started ? 202 : 409);
    }
    const file = FILES[url.pathname];
    if (!file) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": file[1] });
    res.end(await readFile(new URL(`../public/${file[0]}`, import.meta.url)));
  })
  .listen(PORT, () => console.log(`Market Mover on http://localhost:${PORT} · analyst ${analystStatus()}`));
