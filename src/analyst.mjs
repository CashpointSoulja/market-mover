// The one AI call: does this post move one of these markets? Always sent through Mubit (hackathon rule).
// SYSTEM is frozen: Mubit only groups calls into one task while the instructions stay byte-identical.
import { createHash } from "node:crypto";

export const PROMPT_VERSION = "v1";
const SYSTEM = `You are a prediction-market news analyst. You get one social media post and up to 3 live Polymarket markets with their current YES price (0 to 1).
Decide if the post contains new, specific information that should move one market's YES price in the next 10 minutes.
Opinions, jokes, old news, fan predictions and unrelated posts are "none".
Reply with JSON only: {"market": <market number or null>, "effect": "yes_up" | "yes_down" | "none", "strength": 1 | 2 | 3, "reason": "<max 15 words>"}`;

const enabled = () => Boolean(process.env.MUBIT_API_KEY && process.env.ANALYST_MODEL);
export const analystStatus = () => (enabled() ? `on · ${process.env.ANALYST_MODEL} via Mubit` : "waiting for Mubit key");

export async function judge(post, candidates) {
  if (!enabled()) return null;
  const lines = candidates.map((m, i) => `[${i + 1}] ${m.question} | YES ${m.yesPrice.toFixed(2)} | ends ${m.endDate?.slice(0, 10) ?? "?"}`);
  const started = Date.now();
  const r = await fetch(`${process.env.MUBIT_BASE_URL || "https://api.mubit.ai/openai/v1"}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.MUBIT_API_KEY}` },
    body: JSON.stringify({
      model: process.env.ANALYST_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `POST: ${post.text.slice(0, 500)}\nMARKETS:\n${lines.join("\n")}` },
      ],
      response_format: { type: "json_object" },
      // One session per post (hashed, so no Bluesky account ids leave this machine); Mubit holds tests out by session.
      metadata: { session_id: createHash("sha256").update(post.id).digest("hex").slice(0, 32) },
    }),
  });
  const latencyMs = Date.now() - started;
  if (!r.ok) throw new Error(`Mubit ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const body = await r.json();
  const verdict = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
  const market = Number.isInteger(verdict.market) ? (candidates[verdict.market - 1] ?? null) : null;
  return {
    effect: market && ["yes_up", "yes_down"].includes(verdict.effect) ? verdict.effect : "none",
    strength: [1, 2, 3].includes(verdict.strength) ? verdict.strength : 1,
    reason: String(verdict.reason ?? "").slice(0, 120),
    market,
    latencyMs,
    servedBy: body.model,
  };
}
