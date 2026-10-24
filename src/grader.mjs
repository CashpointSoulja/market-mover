// The market grades every call: the first outcome's price at the call vs a few minutes later (GRADE_AFTER_SEC,
// default 2 minutes: live markets react within a minute or two), read from
// Polymarket's price history. Grading from history survives restarts and catches up on older calls.
import { readFile } from "node:fs/promises";

const AFTER_SEC = Number(process.env.GRADE_AFTER_SEC || 120);
const DECISIVE = 0.03; // 3+ points is a real move
const FLAT = 0.005; // under half a point is no move; anything in between is left ungraded

export async function readJsonl(file) {
  const text = await readFile(new URL(`../data/${file}`, import.meta.url), "utf8").catch(() => "");
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Call ids start with the call's time in milliseconds.
export const callTime = (call) => Number(call.id.split("-")[0]) / 1000;

async function priceAt(token, ts) {
  const r = await fetch(`https://clob.polymarket.com/prices-history?market=${token}&startTs=${ts - 300}&endTs=${ts + 60}&fidelity=1`);
  if (!r.ok) return null;
  const points = ((await r.json()).history ?? []).filter((p) => p.t <= ts + 30);
  return points.length ? Number(points.at(-1).p) : null;
}

function grade(call, after) {
  const move = after - call.priceAtCall;
  const actual = move >= DECISIVE ? "up" : move <= -DECISIVE ? "down" : Math.abs(move) <= FLAT ? "none" : null;
  return { ...call, priceAfter: after, move: Number(move.toFixed(4)), actual, correct: actual == null ? null : actual === call.effect };
}

export async function startGrader(onGraded, everyMs = 15_000) {
  const done = new Set((await readJsonl("grades.jsonl")).map((g) => g.id));
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    const now = Date.now() / 1000;
    for (const call of await readJsonl("calls.jsonl")) {
      if (done.has(call.id) || call.priceAtCall == null || now < callTime(call) + AFTER_SEC + 45) continue;
      const after = await priceAt(call.market.yesToken, Math.round(callTime(call) + AFTER_SEC)).catch(() => null);
      if (after == null) continue; // try again next tick
      done.add(call.id);
      onGraded(grade(call, after));
    }
    running = false;
  };
  tick();
  setInterval(tick, everyMs);
}
