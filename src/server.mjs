import http from "node:http";
import { readFile } from "node:fs/promises";
import { refreshMarkets, matchMarkets, markets } from "./markets.mjs";
import { streamPosts } from "./news.mjs";
import { judge, prepare, gate, gateModel, analystStatus, PROMPT_VERSION } from "./analyst.mjs";
import { midpoint } from "./prices.mjs";
import { startGrader, readJsonl, callTime } from "./grader.mjs";
import { streamChain } from "./chain.mjs";
import { runKombat } from "./kombat.mjs";
import { emit, record, recentOf, subscribe } from "./store.mjs";

const PORT = Number(process.env.PORT || 4321);
const STAKE = 100;
const stats = { posts: 0, dropped: 0, matched: 0, gated: 0, filtered: 0, judged: 0, decided: 0, correct: 0, pnl: 0 };

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
function paperPnl(g) {
  if (g.effect === "none" || g.strength < 2 || g.priceAtCall == null) return 0;
  const entry = g.effect === "up" ? g.priceAtCall : 1 - g.priceAtCall;
  const exit = g.effect === "up" ? g.priceAfter : 1 - g.priceAfter;
  return entry > 0 ? STAKE * (exit / entry - 1) : 0;
}

function count(g) {
  if (g.correct != null) {
    stats.decided++;
    if (g.correct) stats.correct++;
  }
  stats.pnl += g.pnl ?? 0;
}

// Restart-safe: rebuild the scoreboard from what is already on disk.
for (const g of await readJsonl("grades.jsonl")) count(g);
stats.judged = (await readJsonl("calls.jsonl")).length;

function onGraded(g) {
  g.pnl = Number(paperPnl(g).toFixed(2));
  count(g);
  emit("grade", g);
  record("grades.jsonl", g);
}

// Cheap AI gate (Haiku via Mubit): only posts that state a real, new fact go on to the analyst.
async function passesGate(post, candidates) {
  if (!gateModel()) return true;
  const { input, sessionId } = prepare(post, candidates);
  const g = await gate(input, sessionId);
  stats.gated++;
  if (g.relevant) return true;
  stats.filtered++;
  record("filtered.jsonl", { at: Date.now(), text: post.text.slice(0, 500), markets: candidates.map(brief), latencyMs: g.latencyMs, cost: g.cost });
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
streamChain((tick) => emit("chain", tick)).catch((e) => console.error("chain:", e.message));
setInterval(() => emit("stats", { ...stats, analyst: analystStatus(), markets: markets.size, queue: queue.length }), 2000);

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

let kombatRunning = false;
async function startKombat(limit) {
  if (kombatRunning) return false;
  kombatRunning = true;
  emit("kombat", { status: "started" });
  runKombat({ limit, onRound: (r) => emit("kombat", { status: "round", ...r }) })
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
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      for (const type of ["match", "call", "grade", "chain", "stats"])
        for (const e of recentOf(type, type === "chain" || type === "stats" ? 1 : 25)) res.write(`event: ${type}\ndata: ${JSON.stringify(e)}\n\n`);
      subscribe(res);
      return;
    }
    if (url.pathname === "/api/nightshift") return json(res, await nightShift());
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
