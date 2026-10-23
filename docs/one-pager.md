# Market Mover — one-pager

**News in. Calls out. The market grades every one.**

## In one sentence
Market Mover reads the live news firehose, calls which Polymarket markets each post will move and in which direction, and lets the market's own price grade every call. Those grades teach a small model, built through Mubit, to make the same calls faster and cheaper than a frontier model.

## The problem
- Prediction markets move on news: ~$36M traded in 24 hours across Polymarket's top 100 markets, ~17 trades a second.
- The news is a flood (~43 Bluesky posts a second), and understanding it with a big AI model costs ~2–3 seconds and a fraction of a cent per post, every post, all day.

## How it works
```
Live posts ──► matched to live markets ──► AI analyst via Mubit ──► call
     ▲                                                           │
     │                    price 10 min later grades the call ◄───┘
     └──── Mubit trains a task-specific small model on the graded calls
```

## Why it's different
| | Typical AI product | Market Mover |
|---|---|---|
| Where the "right answers" come from | People labelling by hand | **The market's own price moves** |
| How it improves | Occasional prompt tweaks | Every graded call can become a correction |
| Cost at volume | Frontier price on every call | Small task-specific model (via Mubit) |
| Speed | 2–3 s per big-model call | Small model, faster (to be measured) |

## Measured so far (24 Oct 2026)
| | |
|---|---|
| Live markets tracked | ~495–499 |
| Posts read | ~43/sec |
| Posts matched to a market | ~16/min |
| AI call through Mubit (Claude Sonnet 5.5) | ~2.7 s median; ~736 tokens in / ~64 out |
| On-chain trades | ~43 fills/sec, read 2.5–3.6 s behind real time |

## Who pays
Traders outside the UK (alert subscriptions), funds and market makers (timestamped data feed), and teams who want the same "frontier model → owned small model" switch for their own repeated AI jobs.

## Honest limits
- Alerts and paper trading only; no real-money trading from the UK.
- Price moves are noisy labels, so only decisive moves are graded.
- The edge is in niche and interpretation-heavy markets, not the bot-crowded big ones.

Author: Ayo Ahmed
