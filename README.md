# Market Mover

**News in. Calls out. The market grades every one.**

Market Mover reads the live Bluesky firehose, matches each post to the live Polymarket markets it mentions, and asks an AI analyst one question: *will this post move this market's price in the next 10 minutes, and which way?* Ten minutes later the market itself grades the call, so nobody has to label anything by hand. Every AI call goes through [Mubit](https://mubit.ai), which records the calls, groups them into one recurring task, and trains a small model from them. The goal is analyst-level calls at small-model speed and cost.

Built by Ayo Ahmed at Night Shift, Mubit's launch hackathon (London, 23–25 Oct 2026).

```
Bluesky posts (~43/sec) ──► match to a live market (2+ shared distinctive words) ──► ~16 posts/min
                                         │
                     AI analyst, always through Mubit (Claude Sonnet 5.5 today)
                     "first outcome up / down / none, strength 1–3, short reason"
                                         │
             price at the call ──► price 10 min later ──► the market grades the call
                                         │
     Screen: matched news · AI calls with ✓/✗ · scoreboard (accuracy, paper P&L) · on-chain trade ticker
```

## Run it

You need Node 22+ and a Mubit key (create one in the Mubit console under **Mubit keys**).

```bash
npm install
cp .env.example .env.local     # then put your Mubit key and model name in .env.local
npm start
# open http://localhost:4321
```

`.env.local` is git-ignored. Never commit keys.

| Variable | What it is |
|---|---|
| `MUBIT_API_KEY` | Your Mubit key (`mbt_…`). The app sends this instead of a provider key |
| `MUBIT_ANTHROPIC_URL` | `https://api.mubit.ai/anthropic` |
| `ANALYST_MODEL` | e.g. `claude-sonnet-5-5`. Mubit's starter credit covers `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-4-5` on this route |
| `PORT` | Defaults to `4321` |
| `POLYGON_RPC` | Optional: a dedicated Polygon node instead of the free public one |

Without a key the app still runs: news matching, prices and the on-chain ticker work, and the analyst shows "waiting for Mubit key".

## Project layout

```
src/
  server.mjs    joins everything up; serves the screen and a live event stream (Server-Sent Events)
  markets.mjs   top ~500 live Polymarket markets (public Gamma API) + word index for matching posts
  news.mjs      Bluesky's public firehose (Jetstream), English posts only
  analyst.mjs   the one AI call, always through Mubit; frozen instructions + strict JSON schema
  prices.mjs    live order-book midpoint price (Polymarket CLOB)
  grader.mjs    re-checks the price 10 minutes later and grades the call
  chain.mjs     every Polymarket trade read straight from the Polygon blockchain (~2.5–3.6 s behind)
  store.mjs     event bus for the screen + append-only JSONL logs in data/
public/         the trading-floor screen (plain HTML, CSS and JavaScript)
data/           calls.jsonl, grades.jsonl, server.log (git-ignored)
docs/           product documents (below)
```

## Docs

| Doc | What it covers |
|---|---|
| [What we're making and why](docs/what-and-why.md) | Explained like you're five, then the full version |
| [One-pager](docs/one-pager.md) | The pitch on one page |
| [PRD](docs/PRD.md) | Problem, users, requirements, metrics, success criteria |
| [Tech design](docs/tech-design.md) | How it works, data flow, Mubit integration, limits |
| [Demo script](docs/demo-script.md) | Expo and stage versions, Q&A prep, fallbacks |
| [Roadmap](docs/roadmap.md) | Hackathon weekend, then v1 and beyond |
| [Business model](docs/business-model.md) | Who pays, pricing hypotheses, unit economics |
| [Risks and decisions](docs/risks-and-decisions.md) | What could go wrong and why we chose what we chose |

## Important limits

- **No real-money trading from the UK.** Polymarket blocks UK users and Kalshi lists the UK as restricted. This is an alerts and analysis tool, and the demo uses **paper trading** (simulated money).
- **Read-only.** It reads public news and public market data. It never posts anything, and it never tries to identify who is behind a wallet.
- Public posts are shown without usernames, and post ids are hashed before they leave the machine.
