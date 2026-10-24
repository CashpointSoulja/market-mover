# Market Mover

**News in. Calls out. The market grades every one.**

Market Mover reads the live Bluesky firehose, matches each post to the live Polymarket markets it mentions, throws away the noise with three cheap filters, and asks an AI analyst one question: *will this post move this market's price, and which way?* **Two minutes later the market itself grades the call**, and that grade goes straight back to [Mubit](https://mubit.ai) as a Good/Bad rating on the exact call it grades. Every AI call goes through Mubit, which groups the calls into recurring tasks and trains a small model for each one. The goal: analyst-level calls at small-model speed and cost.

Built by Ayo Ahmed at Night Shift, Mubit's launch hackathon (London, 23–25 Oct 2026).

```
Bluesky posts (~43/sec)
  │ ① free code filter: repeats (30 min), hashtag/link spam, under 8 words      ~25% dropped
  │ ② keyword match to a live market (2+ shared distinctive words)              ~20 matches/min
  │ ③ FREE local classifier (open source, ~20–40 ms): drops clear chatter
  │ ④ Haiku 4.5 yes/no gate, via Mubit (~0.9 s, ~$0.00045): "states a real fact?"   ~88% blocked
  │ ⑤ Sonnet 5.5 analyst, via Mubit (~1.9 s, ~$0.0022): first outcome up/down/none
  ▼
price at the call ──► price 2 min later ──► the market grades the call (✓ / ✗)
                                                     │
                     Good/Bad rating on that call's Mubit trace ◄─┘  (the correction)
                                                     │
                     Mubit trains a small model per task (first one: Qwen3-4B, ~5 min)
```

## Run it

You need Node 22+ and a Mubit key (Mubit console → **Mubit keys**).

```bash
npm install
cp .env.example .env.local          # put your Mubit key in .env.local
npm start                           # open http://localhost:4321

# Optional, for balance, ratings (corrections) and adapter status:
cd data/tools && npm install playwright && node mubit-console.mjs
#   signs in to the Mubit console in an invisible browser; drop the emailed code into data/mubit-otp.txt
```

`.env.local` and everything in `data/` are git-ignored. Never commit keys or the console login.

| Variable | What it is |
|---|---|
| `MUBIT_API_KEY` | Your Mubit key (`mbt_…`). The app sends it instead of a provider key |
| `MUBIT_ANTHROPIC_URL` | `https://api.mubit.ai/anthropic` |
| `ANALYST_MODEL` | `claude-sonnet-5-5`. The starter credit covers `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5` on this route |
| `GATE_MODEL` | `claude-haiku-4-5`. Empty = every matched post goes straight to the analyst |
| `LOCAL_GATE_MIN` | `0.5`. Posts the free local classifier scores below this "fact" probability are dropped |
| `GRADE_AFTER_SEC` | `120`. How long after a call the market's price is checked |
| `SPEND_GIST_ID` | Optional: a secret GitHub Gist the server updates every 5 min, read by the CodexBar plugin |
| `PORT` | Defaults to `4321` |
| `POLYGON_RPC` | Optional: a dedicated Polygon node instead of the free public one |

Without a key the app still runs news matching, prices and the on-chain ticker; the analyst shows "waiting for Mubit key". Without the console login the app still works; it just can't show the balance, adapters or send ratings.

## Screens

| Tab | What it shows |
|---|---|
| **Trading floor** | Matched news, AI calls turning ✓/✗, scoreboard (filters, accuracy, paper P&L, corrections sent, Mubit balance, free credit used), on-chain trade ticker |
| **Night Shift** | Accuracy vs the "always none" baseline, moves caught, learning curve, per-version table, and a **live Mubit panel**: balance, small models with match rate and verdict, task counts |
| **Model Kombat** | Replays graded calls through Opus 5.5 and Haiku 4.5 via Mubit (marked not-stored): accuracy, speed, cost |

## Project layout

```
src/
  server.mjs       joins everything up; screen, live event stream (Server-Sent Events), JSON endpoints
  markets.mjs      top ~500 live Polymarket markets (Gamma API) + word index for matching
  news.mjs         Bluesky Jetstream, English posts only
  localGate.mjs    free open-source zero-shot classifier (DeBERTa-v3 xsmall, transformers.js)
  analyst.mjs      the AI calls through Mubit: Haiku gate + Sonnet analyst; frozen prompts, strict JSON
  prices.mjs       live order-book midpoint (Polymarket CLOB)
  grader.mjs       grades calls from Polymarket price history at +2 min (restart-safe)
  corrections.mjs  sends each grade to Mubit as a Good/Bad rating on that call's trace
  mubitAdmin.mjs   Mubit console API: balance, traces, ratings, adapters, tasks
  kombat.mjs       Model Kombat replays
  chain.mjs        every Polymarket trade from the Polygon blockchain (~2.5–3.6 s behind)
  store.mjs        event bus + append-only JSONL logs
public/            the screens (plain HTML, CSS, JavaScript)
data/              logs, console login, model cache (git-ignored); data/tools/mubit-console.mjs
docs/              product documents
```

JSON endpoints: `/api/nightshift`, `/api/spend`, `/api/mubit`, `POST /api/kombat?rounds=20`.

## Docs

| Doc | What it covers |
|---|---|
| [What we're making and why](docs/what-and-why.md) | Explained like you're five, then the full version |
| [One-pager](docs/one-pager.md) | The pitch on one page |
| [PRD](docs/PRD.md) | Problem, users, requirements, metrics, success criteria, open questions |
| [Tech design](docs/tech-design.md) | Architecture, data files, grading, deployment constraints |
| [Mubit integration](docs/mubit-integration.md) | Every way we use Mubit: proxy, tasks, ratings, adapters, console API |
| [Billing](docs/billing.md) | What actually costs money, and how we measure it |
| [Demo script](docs/demo-script.md) | Expo and stage versions, Q&A prep, fallbacks |
| [Roadmap](docs/roadmap.md) | Weekend plan, then v1 |
| [Business model](docs/business-model.md) | Who pays, pricing hypotheses, unit economics |
| [Risks and decisions](docs/risks-and-decisions.md) | What could go wrong and why we chose what we chose |

## Important limits

- **No real-money trading from the UK.** Polymarket blocks UK users and Kalshi lists the UK as restricted. This is an alerts and analysis tool; the demo uses **paper trading** (simulated money).
- **Read-only.** It reads public news and public market data. It never posts anything and never tries to identify who is behind a wallet.
- Public posts are shown without usernames; post ids are hashed before they leave the machine.
- Ratings, balance and adapter status use the **Mubit console's own management API, which is undocumented** and may change.

## Public link (free, fast)

The app needs an always-on process, so for the hackathon it runs on the laptop and is shared through a free
Cloudflare quick tunnel (served from Cloudflare's London edge):

```
npm start                                              # the app on http://localhost:4321
cloudflared tunnel --no-autoupdate --url http://localhost:4321   # prints https://<random>.trycloudflare.com
caffeinate -dimsu                                      # keep the Mac awake while the link is shared
```

- Public visitors can watch everything but can't start Model Kombat (it spends AI credits); the owner can, locally or with `?key=ADMIN_KEY`.
- Live updates use once-a-second polling (`/api/feed`), because tunnels can hold back streaming responses.
- The link changes whenever the tunnel restarts and only works while the Mac is awake and online. A permanent home needs an always-on host (Render, Fly.io or Cloud Run); see docs/tech-design.md.
