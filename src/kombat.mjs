// Model Kombat: replay calls the market has already graded through other models (via Mubit, marked
// not-stored so they never train anything) and score every fighter against what the market actually did.
import { readFile } from "node:fs/promises";
import { ask } from "./analyst.mjs";

export const CHALLENGERS = ["claude-opus-5-5", "claude-haiku-4-5"];

export async function gradedCalls(limit) {
  const text = await readFile(new URL("../data/grades.jsonl", import.meta.url), "utf8").catch(() => "");
  const rows = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return rows.filter((g) => g.correct != null && g.input).slice(-limit);
}

// A hit needs the right direction on the market the grade was taken from ("none" needs no market).
const isHit = (r, g) => r.effect === g.actual && (r.effect === "none" || r.market?.id === g.market.id);

export async function runKombat({ limit = 20, challengers = CHALLENGERS, onRound } = {}) {
  const cases = await gradedCalls(limit);
  const board = new Map();
  const score = (name, r, g) => {
    const b = board.get(name) ?? { name, rounds: 0, hits: 0, latencyMs: 0, cost: 0 };
    b.rounds++;
    if (isHit(r, g)) b.hits++;
    b.latencyMs += r.latencyMs ?? 0;
    b.cost += r.cost ?? 0;
    board.set(name, b);
  };
  for (const [i, g] of cases.entries()) {
    // The live analyst already answered this case for real; reuse that answer instead of paying twice.
    const live = { name: `${g.servedBy} · live`, effect: g.effect, market: g.market, latencyMs: g.latencyMs, cost: g.cost };
    const others = await Promise.all(
      challengers.map((model) =>
        ask(g.input, g.candidates, { model, dryRun: true })
          .then((r) => ({ name: model, ...r }))
          .catch((e) => ({ name: model, error: e.message.slice(0, 160) })),
      ),
    );
    const results = [live, ...others];
    for (const r of results) if (!r.error) score(r.name, r, g);
    onRound?.({
      round: i + 1,
      of: cases.length,
      question: g.market.question,
      truth: g.actual,
      results: results.map((r) => ({ name: r.name, effect: r.effect, hit: !r.error && isHit(r, g), latencyMs: r.latencyMs, error: r.error })),
      board: [...board.values()],
    });
  }
  return [...board.values()];
}
