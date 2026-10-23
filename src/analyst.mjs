// The one AI call: does this post move one of these markets? Always sent through Mubit (hackathon rule).
// SYSTEM, the schema and the live request settings are frozen: Mubit only groups calls into one task while
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

// Anthropic list prices in $ per million tokens (input, output), for cost per call.
export const PRICES = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-4-5": [1, 5] };
export const costOf = (model, usage) => {
  const p = PRICES[model];
  return p && usage?.input != null ? (usage.input * p[0] + usage.output * p[1]) / 1e6 : null;
};

// Quick classification, so no extended thinking where the model allows it off.
function settings(model) {
  if (model === "claude-sonnet-5-5") return { thinking: { type: "between_tools" }, effort: "low" }; // Sonnet 5.5's thinking-off mode
  if (model.startsWith("claude-haiku-4")) return {}; // no effort control on Haiku 4.5; thinking is off by default
  return { effort: "low" }; // Opus 5.5 always thinks; low effort keeps it quick
}

export const liveModel = () => process.env.ANALYST_MODEL;
const enabled = () => Boolean(process.env.MUBIT_API_KEY && liveModel());
export const analystStatus = () => (enabled() ? `on · ${liveModel()} via Mubit` : "waiting for Mubit key");

let client;
const mubit = () =>
  (client ??= new Anthropic({ apiKey: process.env.MUBIT_API_KEY, baseURL: process.env.MUBIT_ANTHROPIC_URL || "https://api.mubit.ai/anthropic" }));

export function buildInput(post, candidates) {
  const lines = candidates.map((m, i) => {
    const outcomes = m.outcomes.map((o, j) => `${o} ${(m.prices[j] ?? NaN).toFixed(2)}`).join(" · ");
    return `[${i + 1}] ${m.question} | ${outcomes} | ends ${m.endDate?.slice(0, 10) ?? "?"}`;
  });
  return `POST: ${post.text.slice(0, 500)}\nMARKETS:\n${lines.join("\n")}`;
}

// dryRun sends x-middleware-store: false, so tests and Model Kombat replays never become training examples.
export async function ask(input, candidates, { model = liveModel(), sessionId, dryRun = false } = {}) {
  const { thinking, effort } = settings(model);
  const started = Date.now();
  const { data, response } = await mubit()
    .messages.create(
      {
        model,
        max_tokens: 1024,
        system: SYSTEM,
        ...(thinking ? { thinking } : {}),
        output_config: { ...(effort ? { effort } : {}), format: { type: FORMAT.type, schema: FORMAT.schema } },
        // Mubit holds test cases out by session; one session per post.
        ...(sessionId ? { metadata: { user_id: sessionId } } : {}),
        messages: [{ role: "user", content: input }],
      },
      dryRun ? { headers: { "x-middleware-store": "false" } } : undefined,
    )
    .withResponse();
  const latencyMs = Date.now() - started;
  const refused = data.stop_reason === "refusal";
  const verdict = refused ? null : readVerdict(data);
  const market = Number.isInteger(verdict?.market) ? (candidates[verdict.market - 1] ?? null) : null;
  const usage = { input: data.usage?.input_tokens, output: data.usage?.output_tokens };
  return {
    effect: market && verdict.effect !== "none" ? verdict.effect : "none",
    strength: [1, 2, 3].includes(verdict?.strength) ? verdict.strength : 1,
    reason: refused ? "declined by the model" : String(verdict?.reason ?? "").slice(0, 120),
    market,
    latencyMs,
    servedBy: data.model,
    mubitRequestId: response.headers.get("x-middleware-request-id"),
    usage,
    cost: costOf(model, usage),
  };
}

export async function judge(post, candidates, opts = {}) {
  if (!enabled()) return null;
  const input = buildInput(post, candidates);
  // Hashed so no Bluesky account ids leave this machine.
  const sessionId = createHash("sha256").update(post.id).digest("hex").slice(0, 32);
  return { input, sessionId, ...(await ask(input, candidates, { sessionId, ...opts })) };
}
