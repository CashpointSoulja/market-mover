# Market Mover — demo script (Night Shift)

**Judging (equal weight):** Use of Mubit (show a correction becoming a model update) · Usefulness (a real recurring task) · Technical execution (it works and holds up under questions) · Demo (clear, live, under the time limit).
**Tracks we hit:** Recurring tasks (every matched post, every gate decision) · Own your intelligence layer (frontier → owned small model) · Fast refresh (new markets daily, 2-minute grading).
**Timeline:** code freeze Sun 25 Oct 10:00 · expo judging 10:30 · finalist stage demos 12:30.

## Before you start (checklist)
- [ ] Server running (`npm start`); screen at http://localhost:4321, full screen
- [ ] Console login fresh (`node data/tools/mubit-console.mjs` if the Mubit panel says "not connected")
- [ ] Night Shift Mubit panel shows the balance and at least one small model
- [ ] Scoreboard "Corrections sent to Mubit" is counting up
- [ ] Mubit console open in a second tab: Requests (to show a rating on a call), Adapters
- [ ] Backup: screen recording of a good live run, plus `data/*.jsonl`
- [ ] Laptop charged, phone hotspot ready

## Expo version (60–90 seconds, judge walks up cold)
1. **Hook (10 s):** "Prediction markets move on news. Bluesky alone is 43 posts a second. We read all of it."
2. **Filters (15 s):** point at the scoreboard: "Free filters and a tiny local model throw away the junk. A cheap Haiku gate through Mubit blocks about 88% of what's left. Only real news reaches the analyst."
3. **The trick (20 s):** "Two minutes after each call, the market grades it: this one ✓, this one ✗. Nobody labels anything. The price is the answer key."
4. **The correction (20 s):** open Night Shift: "Every grade goes straight back to Mubit as a Good or Bad rating on that exact call. Here's the counter. And here's the small model Mubit already trained from our calls, in five minutes: Qwen3-4B, 41.7% match with the big model, not good enough to serve yet. Our ratings are what push it up."
5. **Close (10 s):** "The market grades every call, and every grade becomes a correction."

## Stage version (~3 minutes)
| Time | Beat | On screen |
|---|---|---|
| 0:00 | Problem: news moves markets; too much news; frontier models are slow and cost money on every call | Trading floor, live counters |
| 0:25 | Pipeline: code filter → keyword match → free local model → Haiku gate → Sonnet analyst, with what each costs | Scoreboard rows |
| 0:55 | Grading: a call from 2 minutes ago turns ✓ or ✗ with the price move | Calls column |
| 1:20 | **Correction → model update:** the rating counter; open that call in the Mubit console to show the Good/Bad rating and comment on it; then Mubit's small model and its match rate | Night Shift Mubit panel + Mubit console |
| 2:05 | **Model Kombat:** Sonnet 5.5 (live) vs Opus 5.5 vs Haiku 4.5 on the same graded calls: accuracy, speed, cost | Kombat screen |
| 2:35 | Honest numbers and who pays: accuracy vs the always-none baseline; alerts and paper trading; no UK trading | One line |

## Q&A prep
| Likely question | Answer |
|---|---|
| How does a correction reach Mubit? | Every graded call is rated `up` or `down` on its Mubit trace, matched by our session id, with a comment saying what the market did |
| Is that a public API? | No, it's the console's own management API, signed in with our console login. It's undocumented, so we treat it as fragile; the app keeps running if it breaks |
| How do you know the small model is any good? | Mubit tests it against the big model on held-out checks: 41.7% so far, verdict "gated". We'll only promote it once it passes |
| Where do your labels come from? | The market: the first outcome's price 2 minutes after the call. Only decisive moves (≥3 pts) or flat (≤0.5 pt) count |
| Your accuracy is below "always none"? | Yes, in the first hour: most windows are flat and the analyst over-called. That's why we show the baseline, filter harder, and send the wrong calls back as corrections |
| Why not just use a cheap model? | We do, as a gate: Haiku blocks most posts for a fifth of the price. The analyst job needs judgement, which is what Mubit's small model learns from our graded calls |
| What does it cost? | Analyst ~$0.0022 a call, gate ~$0.00045, local filter $0. Real money only goes on Mubit's own runs at $0.005 each |
| Can you trade with this? | Not from the UK. Alerts, analysis and paper trading only |
| Couldn't bots beat you? | In the biggest markets, yes. The edge is niche, interpretation-heavy markets: esports, live sport, smaller events |
| What about manipulation? | Read-only. We never post or spread claims, and never try to identify wallet owners |

## If something breaks
- **Wi-Fi down:** play the recording; `data/` still backs every number.
- **Mubit console API down** (it briefly returned 503 in testing): the pipeline keeps running; show ratings already sent (`data/ratings.jsonl`) and the console tab.
- **No fresh grades:** grades arrive about 3 minutes after a call; use earlier ones.
