# Market Mover — business model

Author: Ayo Ahmed · 24 Oct 2026. **Prices below are hypotheses to test, not decisions.**

## Who pays
| Customer | What they buy | Why they'd pay |
|---|---|---|
| **Prediction-market traders outside the UK** | Alert subscription for markets they follow | Fast, explained calls with a public graded track record |
| **Funds and market makers** | Timestamped data feed of calls + grades (API) | A news-reaction signal they don't have to build |
| **Teams with big repeated AI bills** | "Cut your AI bill" service: move one repeated job from a frontier model to an owned small model via Mubit | They keep quality and pay less per call |

**Not for sale from the UK:** real-money trading. Polymarket blocks UK users, Kalshi lists the UK as restricted, the UK Gambling Commission said in February 2026 that UK-facing prediction markets probably need a betting licence, and the FCA bans retail binary options. Alerts and analysis only, and real-money features only where they're legal.

## Pricing hypotheses (to test)
| Offer | Hypothesis | How we'd test it |
|---|---|---|
| Trader alerts | ~$29–49 per month per trader for followed markets | Waitlist + paid pilot with 10 non-UK traders |
| Data feed | ~$500–2,000 per month per firm, depending on volume and latency | Three design-partner conversations |
| AI-bill service | Setup fee + a share of the first year's savings (e.g. 20–30%) | One company with a high-volume repeated job |

## Unit economics (measured tokens, Anthropic list prices)
One analyst call measured at **~736 input tokens and ~64 output tokens**.

| Model | Price per M tokens (in / out) | Cost per call | Per 1,000 calls |
|---|---|---|---|
| Claude Sonnet 5.5 (today's teacher) | $2 / $10 | 736×$2/1M + 64×$10/1M = **$0.0021** | $2.11 |
| Claude Opus 5.5 (final boss) | $4 / $20 | 736×$4/1M + 64×$20/1M = **$0.0042** | $4.22 |
| Trained small model via Mubit | Not published | Unknown: Mubit hasn't published pricing | — |

At today's match rate (~16 posts/min ≈ 23,000 calls/day):

| Model | Per day | Per year |
|---|---|---|
| Claude Sonnet 5.5 | ~$49 | ~$17.8K |
| Claude Opus 5.5 | ~$97 | ~$35.5K |

Adding sources multiplies those numbers, which is the point of moving the job onto a small model. **Cost per graded call** is higher than cost per call, because only some calls end up graded (decisive or flat moves). That ratio gets measured from `data/grades.jsonl`.

## Why margins can work
- Each customer pays a flat subscription, while the AI cost is shared across everyone: one call per post serves every subscriber who follows that market.
- The small model cuts the per-call cost; Mubit's starter credit covers early testing.
- The graded track record is the moat: it's public, it builds up over time, and it's hard to fake.

## What would make this fail
- Accuracy no better than chance once there are enough graded calls.
- Big markets fully bot-crowded and niche markets too thin to matter.
- Legal limits in the countries where the traders are.
