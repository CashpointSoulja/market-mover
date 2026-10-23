# Market Mover — demo script (Night Shift)

**Judging (equal weight):** Use of Mubit (show a correction becoming a model update) · Usefulness (a real recurring task) · Technical execution (it works and holds up under questions) · Demo (clear, live, under the time limit).
**Tracks we hit:** Recurring tasks (every matched post) · Own your intelligence layer (frontier → owned small model) · Fast refresh (new markets daily).
**Timeline:** code freeze Sun 25 Oct 10:00 · expo judging 10:30 · finalist stage demos 12:30.

## Before you start (checklist)
- [ ] Server running (`npm start`), screen open at http://localhost:4321, full screen
- [ ] Mubit console open in a second tab: Tasks, Adapters, Try models
- [ ] Night Shift screen and Model Kombat showing real numbers (not placeholders)
- [ ] Backup: screen recording of a good live run, plus `data/*.jsonl` replay
- [ ] Laptop charged, phone hotspot ready if the venue Wi-Fi is slow

## Expo version (60–90 seconds, judge walks up cold)
1. **Hook (10 s):** "Prediction markets move on news. Bluesky alone is 43 posts a second. We read all of it."
2. **Live screen (20 s):** point at the left column: "These are live posts that mention a live Polymarket market, about 16 a minute." Then the middle: "Our AI analyst makes a call: which market, which way, how strongly."
3. **The trick (20 s):** "Ten minutes later, the market grades the call: this one ✓, this one ✗. Nobody labels anything. The price is the answer key."
4. **Mubit (20 s):** "Every call goes through Mubit. The graded calls teach a small model for this one task. Here's version 1 against the frontier model it learned from: accuracy, speed, cost."
5. **Close (10 s):** "The market grades every call. Every price move is a correction, so it gets sharper every hour."

## Stage version (~3 minutes)
| Time | Beat | On screen |
|---|---|---|
| 0:00 | Problem: news moves markets; too much news; frontier models are slow and cost money on every call | Title + live counters |
| 0:30 | Live pipeline: posts → matches → calls | Main screen, live |
| 1:00 | Grading: a call from 10 minutes ago turns ✓ or ✗ with the price move | Calls column |
| 1:30 | **Correction → model update:** a wrong call, its correction, and the newer model version getting that kind of call right | Night Shift screen + Mubit console |
| 2:15 | **Model Kombat:** Sonnet 5.5 vs our small model vs Opus 5.5, on accuracy, latency and cost per call | Kombat screen |
| 2:45 | Who pays + honest limits (alerts and paper trading; no UK trading) | One line |

## Q&A prep
| Likely question | Answer |
|---|---|
| How do you know v2 is better? | Same graded calls, accuracy per version, plus normalized gain: the share of the remaining room for improvement each version captured |
| Where do your labels come from? | The market: the first outcome's price 10 minutes after the call. Only decisive moves (≥3 points) or flat (≤0.5 point) count; everything in between is left out |
| Isn't a price move noisy? | Yes. That's why only decisive moves count, and why we show the number of graded calls next to every accuracy figure |
| Why not just use a cheap model? | A cheap model doesn't know which posts matter to which markets. Mubit makes a small model learn this specific job from the frontier model's calls and the market's grades |
| Can you trade with this? | Not from the UK: Polymarket and Kalshi restrict UK users. It's alerts, analysis and paper trading. Real money only where it's legal |
| Couldn't bots beat you to it? | In the biggest markets, yes. The edge is in niche and interpretation-heavy markets (esports, live sport, smaller events) |
| What about manipulation? | Read-only. We never post or spread claims, and never try to identify wallet owners |
| What does it cost? | ~736 tokens in / ~64 out per call: about $0.0021 on Sonnet 5.5, about $0.0042 on Opus 5.5 |

## If something breaks
- **Wi-Fi down:** play the recording; the graded history in `data/` still backs every number.
- **Mubit slow:** the screen keeps streaming news and the on-chain ticker; say "the analyst is queued" and show earlier graded calls.
- **No new grades:** grades arrive 10 minutes after calls, so use calls from earlier in the session.
