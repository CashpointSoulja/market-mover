# Market Mover — tech design

Author: Ayo Ahmed · 24 Oct 2026

## Shape of the system
One small Node.js server (no framework, two dependencies: the official Anthropic SDK and zod). It runs four live loops and streams everything to a browser screen.

```
                    ┌────────────────────── src/server.mjs ───────────────────────┐
Gamma API ─────────►│ markets.mjs  top ~500 markets, refreshed every 5 min        │
(public)            │      │ word index                                            │
Bluesky Jetstream ─►│ news.mjs ──► matchMarkets() ──► queue (newest first, ≤10)   │
(public WebSocket)  │                                    │                         │
                    │                          analyst.mjs ──► Mubit ──► Claude    │
                    │                                    │                         │
Polymarket CLOB ───►│ prices.mjs  midpoint at call ──► grader.mjs (+10 min)        │
(public)            │                                    │                         │
Polygon RPC ───────►│ chain.mjs   exchange fills every 2 s                         │
(public node)       │                                    ▼                         │
                    │ store.mjs ──► data/*.jsonl  +  Server-Sent Events ──► screen │
                    └──────────────────────────────────────────────────────────────┘
```

## Components
| File | Job | Key details |
|---|---|---|
| `markets.mjs` | Live markets + matching | Gamma `/markets?active=true&closed=false&order=volume24hr`, 5 pages × 100. Keeps outcome names and prices, plus the first outcome's order-book token. Word index ignores words under 4 letters, a stop list, and words found in >25 markets. **A match needs 2+ shared words**: single-word matching produced ~270 matches/min of junk in testing; this rule gives ~16/min |
| `news.mjs` | Bluesky firehose | Jetstream `app.bsky.feed.post`, `create` events only, English only, auto-reconnect |
| `analyst.mjs` | The one AI call | Official Anthropic SDK pointed at Mubit (`https://api.mubit.ai/anthropic`), model `claude-sonnet-5-5`, effort `low`, thinking off (`between_tools`), strict JSON schema, `metadata.user_id` = SHA-256 of the post id (first 32 hex). Records Mubit's `x-middleware-request-id`. `dryRun` sends `x-middleware-store: false` for connection tests |
| `prices.mjs` | Live price | CLOB `/midpoint?token_id=…` (~70 ms round trip measured) |
| `grader.mjs` | Market grading | +10 min re-check; ≥0.03 = up/down, ≤0.005 = none, otherwise ungraded |
| `chain.mjs` | On-chain ticker | Polls Polygon every 2 s, staying 2 blocks behind the head (public nodes disagree about the newest block). Exchange contracts `0xe111180000d2663c0091e4f400237545b87b996b` and `0xe2222d279d744050d28e00520010520000310f59`, fill event topic starting `0xd543adfd` |
| `store.mjs` | Events + logs | In-memory ring of the last 200 events per type; append-only `calls.jsonl` and `grades.jsonl` |
| `public/` | Screen | Plain HTML/CSS/JS over Server-Sent Events (a one-way live stream from server to browser) |

## The AI call (frozen)
Mubit groups calls into one **task** only while the model, instructions and output format stay identical. Change any of them and the example count starts again. So:
- The instructions, schema and settings in `analyst.mjs` are **frozen**, tagged `PROMPT_VERSION = "v1"`.
- Any change means bumping the version on purpose and accepting a new task.

Output schema:
```json
{ "market": 1 | 2 | 3 | null, "effect": "up" | "down" | "none", "strength": 1 | 2 | 3, "reason": "≤15 words" }
```
`effect` is always about the **first listed outcome**. Head-to-head markets have no "Yes": their outcomes are names (e.g. "Tampa Bay Rays", "Milwaukee Brewers"). An early test showed the model guessing which side "Yes" meant, so each market is now listed with every outcome's name and price.

## Grading rule (why decisive-only)
Price moves are noisy labels: prices wobble for reasons unrelated to any one post. We only count clear outcomes:

| Move of the first outcome after 10 min | Label |
|---|---|
| ≥ +3 points | `up` |
| ≤ −3 points | `down` |
| within ±0.5 point | `none` |
| anything else | **not graded** |

## Mubit integration: known and unknown
| Known (tested 24 Oct) | Unknown (asking the Mubit team) |
|---|---|
| Anthropic route works with the official SDK; first call ~2.4 s, ~736 in / ~64 out tokens | How graded outcomes become corrections (no correction API in the public docs) |
| Starter credit covers `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5` on this route | Training time per round, and hackathon daily limits |
| OpenAI's route rejects `metadata` unless `store` is on, one reason we use the Anthropic route | Whether live calls are routed to a passing adapter automatically, and how "served by" shows it |
| Adapters can't be called by name ("There is no Mubit model ID"); compare them in Try models | — |
| First training at 25 kept examples; daily limits reset 00:00 UTC | — |

## Model Kombat (planned)
Same graded calls, three fighters: **Claude Sonnet 5.5** (the teacher), the **trained small model**, and **Claude Opus 5.5** as the final boss. We compare accuracy, latency and cost per call. Because adapters can't be called from code, the small model's numbers come from Mubit's own test results and Try models comparison, or from live calls if Mubit routes to it automatically.

## Limits
- Free public Polygon node: occasional "invalid block range" errors and lag spikes; use a dedicated provider for anything past a demo.
- Polymarket's public trades API is ~4 minutes behind and updates in batches, so it's used for analysis only.
- Pending grades live in memory: a restart loses calls that haven't been graded yet (they're still in `calls.jsonl`).
- One AI call at a time; stale posts are dropped rather than queued up.
- Bluesky is one source. Faster, cleaner news (wires, official feeds) is on the roadmap.
