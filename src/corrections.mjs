// Corrections: the market's verdict on each graded call goes back to Mubit as a Good/Bad rating on that call's
// recorded trace. Mubit's own judge rates some calls; ours come from what the market actually did.
import { readJsonl } from "./grader.mjs";
import { record } from "./store.mjs";
import { traces, rate } from "./mubitAdmin.mjs";

const ANALYST = "You are a prediction-market news analyst";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startCorrections(onRated, everyMs = 30_000) {
  const done = new Set((await readJsonl("ratings.jsonl")).map((r) => r.callId));
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const pending = (await readJsonl("grades.jsonl")).filter((g) => g.correct != null && g.sessionId && !done.has(g.id));
      if (pending.length) {
        // Match our per-post session ids to Mubit's newest recorded analyst calls.
        const bySession = new Map();
        let cursor;
        for (let page = 0; page < 3; page++) {
          const res = await traces({ limit: 200, cursor });
          for (const t of res.traces ?? []) {
            if (String(t.request?.system ?? "").startsWith(ANALYST) && t.metadata?.user_id) bySession.set(t.metadata.user_id, t.trace_id);
          }
          cursor = res.next_cursor;
          if (!cursor) break;
        }
        for (const g of pending) {
          const traceId = bySession.get(g.sessionId);
          if (!traceId) continue;
          const rating = g.correct ? "up" : "down";
          const comment = `Market check: "${g.market.question}" moved ${(g.move * 100).toFixed(1)} pts right after this call. Call: ${g.effect}. Market: ${g.actual}.`;
          await rate(traceId, rating, comment);
          done.add(g.id);
          const row = { at: Date.now(), callId: g.id, traceId, rating };
          await record("ratings.jsonl", row);
          onRated(row);
          await pause(300);
        }
      }
    } catch (e) {
      console.error("corrections:", e.message);
    }
    running = false;
  };
  tick();
  setInterval(tick, everyMs);
}
