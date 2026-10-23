// Live Polymarket markets from the public Gamma API, plus a word index for matching posts to markets.
const GAMMA = "https://gamma-api.polymarket.com/markets";
const STOP = new Set(
  "will with from that this what when which wins beat beats over under than into after before ends 2025 2026 2027 price above below reach game match series spread total totals points versus winner first next week month year their there have more less most least team teams happen world largest biggest company companies market best worst".split(" "),
);

export const markets = new Map();
let index = new Map();

const parseList = (v) => (Array.isArray(v) ? v : JSON.parse(v ?? "[]"));
export const tokenize = (text) => (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length >= 4 && !STOP.has(t));

export async function refreshMarkets(pages = 5) {
  const fresh = new Map();
  for (let p = 0; p < pages; p++) {
    const r = await fetch(`${GAMMA}?active=true&closed=false&limit=100&offset=${p * 100}&order=volume24hr&ascending=false`);
    if (!r.ok) break;
    for (const m of await r.json()) {
      const tokens = parseList(m.clobTokenIds);
      if (!tokens.length) continue;
      fresh.set(m.id, {
        id: m.id,
        question: m.question,
        event: m.events?.[0]?.title ?? "",
        endDate: m.endDate,
        yesToken: tokens[0],
        yesPrice: Number(parseList(m.outcomePrices)[0] ?? NaN),
        volume24hr: Number(m.volume24hr ?? 0),
      });
    }
  }
  if (fresh.size) {
    markets.clear();
    for (const [id, m] of fresh) markets.set(id, m);
    buildIndex();
  }
  return markets.size;
}

function buildIndex() {
  index = new Map();
  for (const m of markets.values())
    for (const t of new Set(tokenize(`${m.question} ${m.event}`))) {
      if (!index.has(t)) index.set(t, new Set());
      index.get(t).add(m.id);
    }
}

// Rarer shared words count more. A match needs at least two shared words: one word alone ("together",
// "student") matched too much unrelated chatter in testing.
export function matchMarkets(text, limit = 3) {
  const scores = new Map();
  for (const t of new Set(tokenize(text))) {
    const ids = index.get(t);
    if (!ids || ids.size > 25) continue;
    const weight = 1 / Math.log2(1 + ids.size);
    for (const id of ids) {
      const s = scores.get(id) ?? { score: 0, words: 0 };
      s.score += weight;
      s.words++;
      scores.set(id, s);
    }
  }
  return [...scores.entries()]
    .filter(([, s]) => s.words >= 2 && s.score >= 0.6)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([id]) => markets.get(id));
}
