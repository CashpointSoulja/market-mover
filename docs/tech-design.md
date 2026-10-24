# Market Mover — tech design

Author: Ayo Ahmed · 24 Oct 2026

## Shape of the system
One small Node.js server (no web framework; dependencies: the official Anthropic SDK, zod, and transformers.js for the local classifier). It runs several live loops and streams everything to a browser screen.

```
                      ┌────────────────────────── src/server.mjs ──────────────────────────┐
Gamma API ───────────►│ markets.mjs   ~500 markets, every 5 min, word index                 │
Bluesky Jetstream ───►│ news.mjs ─► code filter ─► matchMarkets() ─► queue (newest first)   │
                      │                                │                                     │
                      │        localGate.mjs (free, local) ─► analyst.mjs gate ─► analyst   │──► Mubit ──► Claude
                      │                                │                                     │    (Anthropic route)
Polymarket CLOB ─────►│ prices.mjs   price at call     ▼                                     │
Polymarket history ──►│ grader.mjs   price at +2 min ─► grade ─► corrections.mjs ───────────│──► Mubit console API
Polygon RPC ─────────►│ chain.mjs    exchange fills every 2 s                                │    (ratings, balance,
                      │ mubitAdmin.mjs  balance · adapters · tasks (every 60 s)              │     adapters, tasks)
                      │ store.mjs ─► data/*.jsonl + Server-Sent Events ─► screens            │
                      └─────────────────────────────────────────────────────────────────────┘
```

## Components
| File | Job | Key details |
|---|---|---|
| `markets.mjs` | Live markets + matching | Gamma `/markets?active=true&closed=false&order=volume24hr`, 5 pages × 100; keeps outcome names, prices, first outcome's token. A match needs **2+ shared distinctive words** |
| `news.mjs` | Bluesky firehose | Jetstream `app.bsky.feed.post`, `create` events, English only, auto-reconnect |
| `server.mjs` | Code filter | Drops repeats seen in the last 30 min, posts >40% hashtags/links, posts under 8 words |
| `localGate.mjs` | Free gate | `Xenova/nli-deberta-v3-xsmall` zero-shot via transformers.js, quantised; labels "a specific new fact, result or announcement" vs "an opinion, joke, advert or chatter"; drops fact probability < `LOCAL_GATE_MIN`. ~15 s to load, then ~20–40 ms a post. GLiClass (ModernBERT) is the Python-only alternative |
| `analyst.mjs` | AI calls via Mubit | Official Anthropic SDK pointed at `https://api.mubit.ai/anthropic`. **Gate:** `claude-haiku-4-5`, `{relevant}`. **Analyst:** `claude-sonnet-5-5`, effort `low`, thinking off (`between_tools`), `{market, effect, strength, reason}`. Strict JSON schema; `metadata.user_id` = SHA-256 of the post id (first 32 hex); records `x-middleware-request-id`; `dryRun` sends `x-middleware-store: false` |
| `prices.mjs` | Live price | CLOB `/midpoint?token_id=…` (~70 ms) |
| `grader.mjs` | Market grading | Every 15 s, grades calls older than `GRADE_AFTER_SEC` (120) + 45 s, using CLOB `/prices-history` (1-minute points). Restart-safe |
| `corrections.mjs` | Ratings to Mubit | Every 30 s: matches graded calls to Mubit traces by `metadata.user_id` (analyst task only), posts `up`/`down` + comment |
| `mubitAdmin.mjs` | Mubit console API | See [mubit-integration.md](mubit-integration.md) |
| `kombat.mjs` | Model Kombat | Replays graded calls' exact input through other models via Mubit, not stored |
| `chain.mjs` | On-chain ticker | Polygon every 2 s, 2 blocks behind head; exchanges `0xe111…996b`, `0xe222…0f59`; fill topic `0xd543adfd…` |
| `store.mjs` | Events + logs | Last 200 events per type in memory; append-only JSONL in `data/` |

## Data files (`data/`, git-ignored)
| File | One line per |
|---|---|
| `calls.jsonl` | Analyst call: post text, candidates, verdict, price at call, latency, tokens, cost, session id, Mubit request id, exact input |
| `grades.jsonl` | Graded call: call fields + price after, move, market's answer, correct, paper P&L |
| `gate.jsonl` | Gate decision (local or Haiku): relevant, score, latency, cost |
| `ratings.jsonl` | Correction sent to Mubit: call id, trace id, up/down |
| `balance.jsonl` | Mubit balance reading: balance, runs left, price per run |
| `kombat.jsonl` | Cost of each Model Kombat replay |
| `mubit-console-state.json` | Saved Mubit console login (sensitive; mode 600) |
| `models/` | Cached local classifier |

## The AI calls (frozen)
Mubit groups calls into a **task** only while model, instructions, tools and output format stay identical. Change one and the example count starts again. Both prompts are frozen (`PROMPT_VERSION = "v1"` for the analyst); changing them means bumping the version on purpose. We kept the analyst prompt's "next 10 minutes" wording when grading moved to 2 minutes, so Mubit's task wasn't reset.

`effect` is always about the **first listed outcome**: head-to-head markets have no "Yes" (outcomes are names like "Tampa Bay Rays"), and an early test guessed the wrong side.

## Grading rule (decisive only)
| Move of the first outcome 2 min after the call | Label |
|---|---|
| ≥ +3 points | `up` |
| ≤ −3 points | `down` |
| within ±0.5 point | `none` |
| anything else | not graded |

"None" calls are graded against the top-matched market.

## Deployment
**Status: TBD, not deployed.** Constraints:
- An **always-on process**: outbound WebSockets (Bluesky), polling (Polygon, price history), timers, and a Server-Sent Events stream to the screen.
- **Disk** for the JSONL logs (or a database) so history survives restarts.
- Secrets: the Mubit key, and the console login if ratings and balance should run in the cloud.
- **Only one copy may run at a time**, or every AI call and rating is doubled.
- The Kombat button spends credits, so a public deployment needs it protected.

| Option | Fit | Notes |
|---|---|---|
| Render, Frankfurt, always-on plan | Good | Free plan sleeps after 15 min idle (slow first load); always-on is a paid plan; disk is extra |
| Fly.io, London (lhr) | Good | Small always-on VM; needs a card |
| Vercel | Poor for the worker | Serverless functions don't run a 24/7 firehose; fine for a static front end only |
| Laptop for the demo | Works today | Fastest to show at the venue; not reachable by others |

## Limits
- Free public Polygon node: occasional errors and lag; dedicated provider for production.
- Polymarket's public trades API is ~4 min behind and batched: analysis only.
- One post at a time through the gates and analyst; stale posts are dropped.
- The Mubit console API is undocumented and briefly returned `503 engine_unreachable` during testing; the app logs it and retries on the next loop.
- The local classifier mistakes confident opinions for facts, which is why it only drops clear chatter and the Haiku gate decides the rest.
