# Market Mover — roadmap

Author: Ayo Ahmed · 24 Oct 2026

## Hackathon weekend
| When | Goal | Status |
|---|---|---|
| Fri night | Live pipeline: markets, Bluesky matching, on-chain ticker, screen | ✅ Done |
| Fri night | Mubit key; analyst live on Claude Sonnet 5.5 through Mubit; first calls stored | ✅ Done |
| Sat early | 25+ kept examples so Mubit's first training can run; public GitHub repo | ⏳ In progress |
| Sat | Corrections into Mubit (once the mechanism is confirmed); Night Shift screen (accuracy, latency and cost by version) | ⏳ |
| Sat | Model Kombat: Sonnet 5.5 vs trained small model vs Opus 5.5 on the same graded calls | ⏳ |
| Sat night | Second training round from the day's graded calls; record a backup demo | ⏳ |
| Sun before 10:00 | Final numbers, rehearse to time, code freeze | ⏳ |

## v1 product (weeks after)
- **Better sources:** news wires, official feeds (league scores, election results), esports match data. Bluesky is free, but it isn't the fastest source.
- **Better matching:** entity recognition (names, teams, places) instead of shared words; per-market keyword lists.
- **Grading per market type:** shorter windows for live sport, longer for politics; track settled results as well as price moves.
- **Alerts:** email, Telegram or Discord push for followed markets, with a public graded track record.
- **Smart-money layer:** decode on-chain fills (amount, price, side, market) and keep wallet scorecards (behaviour only, never identity). Flag unusual trades for the analyst.
- **Dedicated Polygon node** and durable storage for pending grades.

## Later
- Data feed product for funds and market makers.
- Real-money features only in countries where they're legal, after legal review.
- Reuse the "frontier model → owned small model, graded by real outcomes" pattern for other repeated AI jobs.
