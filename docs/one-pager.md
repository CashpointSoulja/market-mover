# Market Mover — one-pager

**News in. Calls out. The market grades every one.**

## In one sentence
Market Mover reads the live news firehose, filters it cheaply, calls which Polymarket markets each real piece of news will move and in which direction, lets the market's own price grade every call two minutes later, and sends each grade back to Mubit as a correction that trains a small, cheaper model to do the job.

## The problem
- Prediction markets move on news: ~$36M traded in 24 hours across Polymarket's top 100 markets, ~17 trades a second.
- The news is a flood (~43 Bluesky posts a second), and understanding it with a big AI model costs ~2 seconds and a fraction of a cent per post, all day.

## How it works
```
Live posts ─► free filters ─► Haiku gate (Mubit) ─► Sonnet analyst (Mubit) ─► call
                                                                              │
                     price 2 min later grades the call ◄──────────────────────┘
                                        │
                     Good/Bad rating on that call in Mubit ─► Mubit trains a small model
```

## Why it's different
| | Typical AI product | Market Mover |
|---|---|---|
| Where the "right answers" come from | People labelling by hand | **The market's own price moves** |
| How it improves | Occasional prompt tweaks | Every graded call becomes a rating Mubit trains on |
| Cost at volume | Frontier price on every call | Free filters, a cheap gate, then a small model |
| Feedback speed | Days | **2 minutes** |

## Measured so far (24 Oct 2026, first hour)
| | |
|---|---|
| Posts read / matched | ~43/sec read; ~20/min matched to a live market |
| Filters | ~25% dropped free; Haiku gate blocks ~88% of the rest |
| AI calls via Mubit | gate ~0.9 s / ~$0.00045; analyst ~1.9 s / ~$0.0022 |
| Graded calls | 467; accuracy 88% vs a 96% "always none" baseline (honest: not there yet) |
| Corrections sent to Mubit | 54 Good/Bad ratings |
| Mubit's first small model | Qwen3-4B, trained in ~5 min, 41.7% match with the big model, not serving yet |
| On-chain trades | ~43 fills/sec, read 2.5–3.6 s behind real time |

## Who pays
Traders outside the UK (alerts), funds and market makers (timestamped data feed), and teams who want the same "cheap filters → owned small model" switch for their own repeated AI jobs.

## Honest limits
- Alerts and paper trading only; no real-money trading from the UK.
- Price moves are noisy labels, so only decisive moves are graded, and the first-hour numbers trail the baseline.
- Ratings and balance use Mubit's undocumented console API.
- The edge is in niche, fast-moving markets, not the bot-crowded big ones.

Author: Ayo Ahmed
