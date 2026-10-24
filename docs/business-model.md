# Market Mover — business model

Author: Ayo Ahmed · 24 Oct 2026. **Prices below are hypotheses to test, not decisions.**

## Who pays
| Customer | What they buy | Why they'd pay |
|---|---|---|
| **Prediction-market traders outside the UK** | Alert subscription for markets they follow | Fast, explained calls with a public graded track record |
| **Funds and market makers** | Timestamped data feed of calls + grades (API) | A news-reaction signal they don't have to build |
| **Teams with big repeated AI bills** | "Cut your AI bill" service: filter cheaply, then move the repeated job from a frontier model to an owned small model via Mubit | Same job, a fraction of the cost per call |

**Not for sale from the UK:** real-money trading. Polymarket blocks UK users, Kalshi lists the UK as restricted, the UK Gambling Commission said in February 2026 that UK-facing prediction markets probably need a betting licence, and the FCA bans retail binary options. Alerts and analysis only; real-money features only where legal.

## Pricing hypotheses (to test)
| Offer | Hypothesis | How we'd test it |
|---|---|---|
| Trader alerts | ~$29–49 per month per trader | Waitlist + paid pilot with 10 non-UK traders |
| Data feed | ~$500–2,000 per month per firm, by volume and latency | Three design-partner conversations |
| AI-bill service | Setup fee + 20–30% of the first year's savings | One company with a high-volume repeated job |

## Unit economics (measured 24 Oct, Anthropic list prices)
| Step | Model | Average per call (measured) | Per 1,000 calls |
|---|---|---|---|
| Code filter + local classifier | none / open-source DeBERTa | $0 | $0 |
| Gate | Claude Haiku 4.5 | ~$0.00045 | ~$0.45 |
| Analyst | Claude Sonnet 5.5 | ~$0.0022 | ~$2.20 |
| Final boss (Kombat only) | Claude Opus 5.5 | ~$0.0042 | ~$4.20 |
| Mubit's own work | per "run" (rating, training) | $0.005 a run | ~14–40 runs per 10 min tonight |
| Trained small model | via Mubit | not published | — |

### What a day costs at tonight's rates
| | Without filters (Sonnet on every match, ~20/min) | With the gate (Haiku on every match, Sonnet on ~12%) |
|---|---|---|
| AI calls per day | ~28,800 Sonnet | ~28,800 Haiku + ~3,500 Sonnet |
| Provider cost per day | ~$63 | ~$13 + ~$7.6 ≈ **~$21** |
| Mubit runs | depends on how much Mubit rates and trains (≈$0.4–1.2 an hour tonight) | same |

The local classifier lowers the Haiku line further (it drops clear chatter before the gate). The trained small model is the next step down. Mubit hasn't published adapter pricing, so that saving isn't measured yet.

**Cost per graded call** is higher than cost per call, because only decisive or flat moves get graded. We measure it from `data/grades.jsonl`.

## Why margins can work
- A flat subscription per customer, while AI cost is shared: one call per post serves every subscriber following that market.
- Free filters and the cheap gate stop most posts before an expensive call.
- The graded track record is the moat: public, cumulative, hard to fake.

## What would make this fail
- Accuracy no better than the always-none baseline once there are enough graded calls (true in the first hour; the filters and ratings must change that).
- Big markets fully bot-crowded and niche markets too thin to matter.
- Legal limits where the traders are.
- Mubit's undocumented console API changing (ratings and balance pause; the core pipeline doesn't).
