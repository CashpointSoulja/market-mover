# Market Mover — roadmap

Author: Ayo Ahmed · 24 Oct 2026

## Hackathon weekend
| When | Goal | Status |
|---|---|---|
| Fri night | Live pipeline: markets, Bluesky matching, on-chain ticker, screen | ✅ |
| Fri night | Analyst live on Claude Sonnet 5.5 through Mubit; public GitHub repo; product docs | ✅ |
| Sat early | Code filter + Haiku gate via Mubit; 2-minute grading from price history | ✅ |
| Sat early | **Corrections:** market grades sent to Mubit as Good/Bad ratings; real balance; Mubit panel | ✅ 54 ratings in the first hour |
| Sat early | First Mubit small model (Qwen3-4B, analyst task, 41.7% match, gated) | ✅ trained by Mubit |
| Sat early | Free local open-source classifier in front of the gate | ✅ just added |
| Sat | Measure the filters' effect on up/down precision; second adapter version from our ratings | ⏳ |
| Sat | Grade the gate's blocked posts too (did it block real news?) | ⏳ |
| Sat | **Esports pivot:** LoL Worlds and CS2 PGL Bucharest are live this weekend (the on-chain tracker saw a $5.8K LoL bet); live game data as a faster, cleaner source | ⏳ check feeds first |
| Sat | Deploy (always-on host; see tech design) with the Kombat button protected | ⏳ TBD |
| Sat night | Promote the adapter if Mubit's tests pass; record a backup demo | ⏳ |
| Sun before 10:00 | Final numbers, rehearse to time, code freeze | ⏳ |

## v1 product (weeks after)
- **Faster, cleaner sources:** esports match data, news wires, official feeds (league scores, election results).
- **Better matching:** entity recognition instead of shared words.
- **Grading per market type:** seconds for live sport, longer for politics; settled results as well as price moves.
- **Small models serving:** promote Mubit adapters for the gate and the analyst once they pass; measure cost and latency against the frontier teacher.
- **Alerts:** email, Telegram or Discord push for followed markets, with a public graded track record.
- **Smart-money layer:** decode on-chain fills (amount, price, side, market) and keep wallet scorecards (behaviour only).
- **Supported Mubit integration** for ratings and billing, replacing the console API.
- Dedicated Polygon node; durable storage.

## Later
- Data feed product for funds and market makers.
- Real-money features only where legal, after legal review.
- Reuse the "cheap filters → frontier teacher → owned small model, graded by real outcomes" pattern for other repeated AI jobs.
