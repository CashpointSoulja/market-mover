// The one AI call: does this post move one of these markets? Always sent through Mubit (hackathon rule).
// SYSTEM, the schema and the request settings are frozen: Mubit only groups calls into one task while
// the model, instructions and output format stay identical.
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const PROMPT_VERSION = "v1";
const SYSTEM = `You are a prediction-market news analyst. You get one social media post and up to 3 live Polymarket markets. Each market lists its outcomes with current prices (0 to 1).
Decide if the post contains new, specific information that should move a market's FIRST listed outcome price in the next 10 minutes.
effect: "up" if that first outcome's price should rise, "down" if it should fall.
Opinions, jokes, old news, fan predictions and unrelated posts are "none" with market null.
strength: 1 = slight, 2 = clear, 3 = decisive. reason: at most 15 words.`;

const Verdict = z.object({
  market: z.number().int().nullable(),
  effect: z.enum(["up", "down", "none"]),
  strength: z.number().int(),
  reason: z.string(),
});
// messages.parse() hides response headers, so send the same JSON-schema format via create() and parse here.
const FORMAT = zodOutputFormat(Verdict);
const readVerdict = (msg) => {
  const text = msg.content.find((b) => b.type === "text")?.text;
  try {
    return Verdict.parse(JSON.parse(text));
  } catch {
    return null;
  }
};

const model = () => process.env.ANALYST_MODEL;
const enabled = () => Boolean(process.env.MUBIT_API_KEY && model());
export const analystStatus = () => (enabled() ? `on · ${model()} via Mubit` : "waiting for Mubit key");

let client;
const mubit = () =>
  (client ??= new Anthropic({ apiKey: process.env.MUBIT_API_KEY, baseURL: process.env.MUBIT_ANTHROPIC_URL || "https://api.mubit.ai/anthropic" }));

// dryRun sends x-middleware-store: false, so connection tests never become training examples.
export async function judge(post, candidates, { dryRun = false } = {}) {
  if (!enabled()) return null;
  const lines = candidates.map((m, i) => {
    const outcomes = m.outcomes.map((o, j) => `${o} ${(m.prices[j] ?? NaN).toFixed(2)}`).join(" · ");
    return `[${i + 1}] ${m.question} | ${outcomes} | ends ${m.endDate?.slice(0, 10) ?? "?"}`;
  });
  const started = Date.now();
  const { data, response } = await mubit()
    .messages.create(
      {
        model: model(),
        max_tokens: 1024,
        system: SYSTEM,
        // Quick classification: no extended thinking. between_tools is Sonnet 5.5's thinking-off mode.
        ...(model() === "claude-sonnet-5-5" ? { thinking: { type: "between_tools" } } : {}),
        output_config: { effort: "low", format: { type: FORMAT.type, schema: FORMAT.schema } },
        // One session per post, hashed so no Bluesky account ids leave this machine. Mubit holds tests out by session.
        metadata: { user_id: createHash("sha256").update(post.id).digest("hex").slice(0, 32) },
        messages: [{ role: "user", content: `POST: ${post.text.slice(0, 500)}\nMARKETS:\n${lines.join("\n")}` }],
      },
      dryRun ? { headers: { "x-middleware-store": "false" } } : undefined,
    )
    .withResponse();
  const latencyMs = Date.now() - started;
  const verdict = data.stop_reason === "refusal" ? null : readVerdict(data);
  const market = Number.isInteger(verdict?.market) ? (candidates[verdict.market - 1] ?? null) : null;
  return {
    effect: market && verdict.effect !== "none" ? verdict.effect : "none",
    strength: [1, 2, 3].includes(verdict?.strength) ? verdict.strength : 1,
    reason: data.stop_reason === "refusal" ? "declined by the model" : String(verdict?.reason ?? "").slice(0, 120),
    market,
    latencyMs,
    servedBy: data.model,
    mubitRequestId: response.headers.get("x-middleware-request-id"),
    usage: { input: data.usage?.input_tokens, output: data.usage?.output_tokens },
  };
}
