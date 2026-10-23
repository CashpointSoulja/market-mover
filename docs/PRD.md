# Market Mover — Product Requirements Document (PRD)

| | |
|---|---|
| Author | Ayo Ahmed |
| Status | Hackathon build in progress (Night Shift, 23–25 Oct 2026) |
| Last updated | 24 Oct 2026 |

## 1. Problem
News moves prediction-market prices within minutes. To act on it you have to (a) notice the relevant news inside a flood of irrelevant posts and (b) understand what it means for a specific market's outcome. Doing (b) with a frontier AI model works, but it's slow (~2–3 s per call) and costs money on every post, all day. And there's no easy way to know whether the AI's calls are actually any good.

## 2. Users and personas
| Persona | Need | What they get |
|---|---|---|
| **Niche-market trader** (outside the UK) following esports, live sport or smaller political markets | Hear about market-moving news before the price fully moves, with a reason | Live alerts with direction, strength and a one-line reason |
| **Fund / market maker** | A machine-readable, timestamped stream of news-driven calls, with a track record | Data feed + graded history |
| **AI-cost owner** at any company | Proof that a repeated frontier-model job can move to an owned small model without losing quality | A working, measured example of that switch |
| **Hackathon judges** (secondary) | See a correction turn into a model update, on a real recurring task | Night Shift screen + Model Kombat |

## 3. Goals and non-goals
**Goals**
- G1. Turn the live news firehose into graded, market-specific calls continuously.
- G2. Grade every call automatically from market prices, with no human labelling.
- G3. Route every AI call through Mubit, so the task can move to a trained small model.
- G4. Show measurable improvement between model versions (accuracy, latency, cost).
- G5. Be honest: report accuracy and paper P&L with their limits, never promised returns.

**Non-goals**
- No real-money trading, and no order placement at all in this version.
- No posting, replying or spreading content anywhere.
- No identifying people behind wallets or posts.
- No price prediction from charts or order books. The analyst reads *news*.

## 4. User stories
1. As a trader, I see matched news and the AI's call (up/down/none, strength, reason) within seconds of the post appearing.
2. As a trader, I see each call turn into ✓ or ✗ ten minutes later, along with the price move.
3. As a trader, I see running accuracy and paper P&L, so I know whether to trust the calls.
4. As an AI-cost owner, I see latency and cost per call for the frontier model and for the trained small model side by side.
5. As a judge, I watch a wrong call become a correction, and a later model version get that kind of call right.

## 5. Functional requirements
| # | Requirement | Status (24 Oct, early) |
|---|---|---|
| F1 | **Live pipeline:** load ~500 live markets (refresh every 5 min); read Bluesky English posts; match posts to markets needing 2+ shared distinctive words (rarer words weigh more); pass up to 3 candidate markets on | ✅ Built, ~16 matches/min |
| F2 | **Analyst:** one AI call per matched post, through Mubit; frozen instructions; strict JSON output `{market, effect: up/down/none, strength 1–3, reason}` about the **first listed outcome**; one session per post (hashed id) | ✅ Built, live on Claude Sonnet 5.5 |
| F3 | **Grader:** record the first outcome's midpoint price at the call; re-check at +10 min. ≥3-point move = up/down, ≤0.5 point = none, anything in between left ungraded. `none` calls are graded against the top-matched market | ✅ Built |
| F4 | **Paper trading:** $100 on the called side for strength ≥2 calls, marked at +10 min, before fees and spread | ✅ Built |
| F5 | **On-chain ticker:** read Polymarket's exchange contracts on Polygon (~2.5–3.6 s behind); show fills/sec, wallets per minute and delay | ✅ Built |
| F6 | **Corrections into Mubit:** send graded outcomes back to Mubit as corrections or feedback | ⏳ Mechanism not in Mubit's public docs; confirming with the Mubit team |
| F7 | **Night Shift learning screen:** accuracy, latency and cost by model version (prompt version + "served by"); training-example count toward the first training (25 kept examples) | ⏳ Planned |
| F8 | **Model Kombat:** head-to-head on the same graded calls. Frontier model (Sonnet 5.5) vs the trained small model, with Opus 5.5 as the "final boss": accuracy, speed, cost | ⏳ Planned. Adapters can't be called by name from code ("There is no Mubit model ID"), so the small model's side comes from Mubit's own comparison (Try models / test results) or its automatic routing |
| F9 | **Screen:** live news, calls with ✓/✗, scoreboard, ticker; works on a laptop and a phone | ✅ Basic version built |

## 6. Metrics
| Metric | Definition |
|---|---|
| **Accuracy** | Correct ÷ graded calls (calls left ungraded by the in-between rule don't count) |
| **Normalized gain** | (accuracy of version N − accuracy of v1) ÷ (1 − accuracy of v1): how much of the remaining room for improvement a new version captured |
| **Latency** | Milliseconds per AI call, median and worst |
| **Cost per graded call** | Token cost per call ÷ the share of calls that end up graded |
| **Paper P&L** | Sum of paper trades, before fees and spread |
| Coverage | Matched posts per minute; share of matches the analyst calls non-`none` |

## 7. Success criteria
**Hackathon (code freeze Sun 25 Oct 10:00)**
- The pipeline runs live through the demo, and every AI call goes through Mubit (a rule).
- Enough graded calls for a believable accuracy number (target: 100+ graded).
- At least one trained small-model version shown against the frontier teacher on the same calls.
- A correction visibly linked to a model update in the demo (the "Use of Mubit" criterion).
- Demo under the time limit, with a recorded fallback.

**v1 product**
- Accuracy at or above the frontier teacher on graded calls, at lower cost per call and lower latency.
- Alerts delivered within seconds of a post, with a public graded track record.
- More sources (news wires, official feeds, esports data) and better market matching.
- Legal review per country before any real-money feature.

## 8. Open questions
1. How do graded outcomes get into Mubit as corrections? (The public docs show only a Good/Bad rating on a call in the console.)
2. Does Mubit route live calls to a trained adapter automatically once it passes ("switches only when it does better"), and how would we see that from code?
3. How long does one training round take, and what are the daily limits for hackathon accounts?
4. Is +10 minutes the right grading window for every market type? (Live sport may need less; politics more.)
5. Which niche markets give the best ratio of signal to bot competition?
6. Which countries could legally take real-money alerts or trading later?
