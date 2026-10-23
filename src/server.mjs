import http from "node:http";
import { readFile } from "node:fs/promises";
import { refreshMarkets, matchMarkets, markets } from "./markets.mjs";
import { streamPosts } from "./news.mjs";
import { judge, analystStatus, PROMPT_VERSION } from "./analyst.mjs";
import { midpoint } from "./prices.mjs";
import { scheduleGrade } from "./grader.mjs";
import { streamChain } from "./chain.mjs";
import { emit, record, recentOf, subscribe } from "./store.mjs";

const PORT = Number(process.env.PORT || 4321);
const STAKE = 100;
const stats = { posts: 0, matched: 0, judged: 0, decided: 0, correct: 0, pnl: 0 };

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

function onGraded(g) {
  g.pnl = Number(paperPnl(g).toFixed(2));
  if (g.correct != null) {
    stats.decided++;
    if (g.correct) stats.correct++;
  }
  stats.pnl += g.pnl;
  emit("grade", g);
  record("grades.jsonl", g);
}

// One AI call at a time, newest post first; stale posts are dropped rather than falling behind.
const queue = [];
let busy = false;
async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const { post, candidates } = queue.pop();
  try {
    const verdict = await judge(post, candidates);
    if (verdict) {
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
        promptVersion: PROMPT_VERSION,
      };
      emit("call", call);
      record("calls.jsonl", call);
      scheduleGrade(call, onGraded);
    }
  } catch (e) {
    emit("problem", { message: e.message });
    console.error(e.message);
  }
  busy = false;
  setImmediate(pump);
}

streamPosts((post) => {
  const candidates = matchMarkets(post.text);
  if (!candidates.length) return;
  stats.matched++;
  emit("match", { text: post.text.slice(0, 280), markets: candidates.map((c) => c.question) });
  queue.push({ post, candidates });
  if (queue.length > 10) queue.shift();
  pump();
}, stats);

streamChain((tick) => emit("chain", tick)).catch((e) => console.error("chain:", e.message));

setInterval(() => emit("stats", { ...stats, analyst: analystStatus(), markets: markets.size, queue: queue.length }), 2000);

const FILES = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/style.css": ["style.css", "text/css"] };

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
    const file = FILES[url.pathname];
    if (!file) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": file[1] });
    res.end(await readFile(new URL(`../public/${file[0]}`, import.meta.url)));
  })
  .listen(PORT, () => console.log(`Market Mover on http://localhost:${PORT} · analyst ${analystStatus()}`));
