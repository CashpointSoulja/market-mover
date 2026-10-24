# Market Mover — Product Requirements Document (PRD)

| | |
|---|---|
| Author | Ayo Ahmed |
| Status | Hackathon build, live (Night Shift, 23–25 Oct 2026) |
| Last updated | 24 Oct 2026, ~02:15 |

## 1. Problem
News moves prediction-market prices within minutes. To act on it you have to (a) find the relevant news inside a flood of irrelevant posts and (b) understand what it means for a specific market's outcome. Doing (b) with a frontier AI model works, but it's slow (~2 s per call) and costs money on every post, all day. And there's normally no cheap way to know whether the AI's calls are any good, or to make it better.

## 2. Users and personas
| Persona | Need | What they get |
|---|---|---|
| **Niche-market trader** (outside the UK): esports, live sport, smaller political markets | Market-moving news before the price fully moves, with a reason | Live alerts: direction, strength, one-line reason, track record |
| **Fund / market maker** | A machine-readable, timestamped stream of news-driven calls with a graded history | Data feed + graded history |
| **AI-cost owner** at any company | Proof a repeated frontier-model job can move to an owned small model | A working, measured example of that switch |
| **Hackathon judges** (secondary) | A correction turning into a model update, on a real recurring task | Night Shift screen, Mubit panel, Model Kombat |

## 3. Goals and non-goals
**Goals**
- G1. Turn the live news firehose into graded, market-specific calls continuously.
- G2. Grade every call automatically from market prices, with no human labelling.
- G3. Route every AI call through Mubit and **send every grade back to Mubit as a rating**, so the task moves to a trained small model.
- G4. Spend as little as possible: free filters first, cheap gate second, analyst last.
- G5. Show measurable improvement between model versions (accuracy, latency, cost).
- G6. Be honest: report accuracy against a baseline, and paper P&L with its limits. Never promise returns.

**Non-goals**
- No real-money trading and no order placement in this version.
- No posting, replying or spreading content anywhere.
- No identifying people behind wallets or posts.
- No price prediction from charts or order books. The analyst reads *news*.

## 4. User stories
1. As a trader, I see matched news and the AI's call (up/down/none, strength, reason) within seconds of the post.
2. As a trader, I see each call turn ✓ or ✗ two minutes later, with the price move.
3. As a trader, I see accuracy next to the "always say none" baseline, so I know whether the calls beat doing nothing.
4. As an AI-cost owner, I see what each step costs and how much the free filters save.
5. As a judge, I watch a graded call go to Mubit as a Good/Bad rating, and see Mubit's small model and its match rate on the Night Shift screen.

## 5. Functional requirements
| # | Requirement | Status |
|---|---|---|
| F1 | **Live sources:** ~500 live markets (refresh every 5 min); Bluesky English posts | ✅ |
| F2 | **Free code filter:** drop repeats seen in the last 30 min, posts >40% hashtags/links, posts under 8 words | ✅ ~25% of posts dropped |
| F3 | **Matching:** 2+ shared distinctive words (rarer words weigh more); up to 3 candidate markets | ✅ ~20 matches/min |
| F4 | **Free local gate:** open-source zero-shot classifier (DeBERTa-v3 xsmall via transformers.js); drop posts with "fact" probability below `LOCAL_GATE_MIN` (0.5) | ✅ just added; ~20–40 ms, $0 |
| F5 | **Haiku gate via Mubit:** frozen yes/no "states a specific, new fact about one of these markets?"; strict JSON `{relevant}` | ✅ blocks ~88%; ~0.9 s, ~$0.00045 |
| F6 | **Analyst via Mubit:** Claude Sonnet 5.5; frozen prompt; strict JSON `{market, effect: up/down/none, strength 1–3, reason}` about the **first listed outcome**; one session per post (hashed id) | ✅ ~1.9 s median, ~$0.0022 |
| F7 | **Grader:** first outcome's price at the call vs **+2 min** (`GRADE_AFTER_SEC`) from Polymarket price history; ≥3 pts = up/down, ≤0.5 pt = none, in between ungraded; restart-safe, checked every 15 s | ✅ |
| F8 | **Corrections:** every graded call sent to Mubit as `up`/`down` on its trace, with a one-line comment of what the market did | ✅ 54 sent in the first hour |
| F9 | **Billing:** real Mubit balance (read live) + free starter-credit use (estimated from tokens); on screen and in CodexBar | ✅ see [billing.md](billing.md) |
| F10 | **Night Shift:** accuracy, always-none baseline, moves caught, up/down precision, learning curve, per-version table, live Mubit panel (balance, small models, tasks) | ✅ |
| F11 | **Model Kombat:** replay graded calls through Opus 5.5 and Haiku 4.5 via Mubit (not stored); accuracy, speed, cost | ✅ built; adapter can't be called by name, so its numbers come from Mubit's tests |
| F12 | **Paper trading:** $100 on the called side for strength ≥2, marked at the grade, before fees and spread | ✅ |
| F13 | **On-chain ticker:** Polymarket fills from Polygon, ~2.5–3.6 s behind | ✅ |
| F14 | **Promote the small model** to serve live traffic once Mubit's tests pass | ⏳ endpoint exists, not used yet |
| F15 | **Deploy** to an always-on host | ⏳ TBD, see [tech-design.md](tech-design.md#deployment) |

## 6. Metrics
| Metric | Definition | First hour (24 Oct, 467 graded calls) |
|---|---|---|
| **Accuracy** | Correct ÷ graded calls | 88% |
| **Always-none baseline** | Accuracy if the analyst always said "none" | **96%** |
| **Moves caught** | Of graded calls where the price really moved, the share the analyst called right | 35% (of 17) |
| **Up/down precision** | Of the analyst's up/down calls, the share that were right | **11% (of 54)** |
| **Normalized gain** | (accuracy of version N − accuracy of v1) ÷ (1 − accuracy of v1) | Needs a second version |
| **Small-model match rate** | Mubit's test: how often the small model agrees with the big one on held-out checks | 41.7% (12 checks), "gated" |
| **Latency** | ms per step | gate ~0.9 s, analyst ~1.9 s, local filter ~20–40 ms |
| **Cost per call / per graded call** | Token cost per step; cost ÷ share of calls graded | analyst ~$0.0022 |
| **Filter savings** | Share of posts stopped before a paid call | ~25% code + local + ~88% gate |
| **Paper P&L** | Sum of paper trades, before fees and spread | ~$0 so far |

**Reading the first-hour numbers honestly:** the analyst currently does *worse* than always saying "none", because most of its up/down calls (89%) are wrong. Most 2-minute windows are flat. The fixes are: the gate and local filter send it fewer, better posts; our market ratings tell Mubit which calls were wrong; and the edge is in faster-moving markets (live sport, esports).

## 7. Success criteria
**Hackathon (code freeze Sun 25 Oct 10:00)**
- Pipeline runs live through the demo; every LLM call goes through Mubit (a rule).
- A correction visibly sent to Mubit and a Mubit small model shown with its match rate (the "Use of Mubit" criterion). ✅ both working.
- 500+ graded calls and an honest comparison against the always-none baseline.
- Up/down precision clearly above today's 11% after the filters and ratings take effect.
- Demo under the time limit, with a recorded fallback.

**v1 product**
- Accuracy above the always-none baseline and up/down precision high enough to act on, on graded calls.
- Small model promoted and serving most calls at lower cost and latency than the frontier teacher.
- Faster, cleaner sources (esports data, news wires, official feeds).
- Legal review per country before any real-money feature.

## 8. Open questions
1. **Undocumented API risk:** ratings, balance and adapters use the Mubit console's own management API with a saved console login. It may change without notice; should we ask Mubit for a supported way?
2. Do our ratings actually change what Mubit trains on, and how fast does a new adapter version follow?
3. What does a Mubit "run" ($0.005) cover exactly? The balance falls with Mubit's own rating and training work, not per AI call.
4. Does Mubit route live calls to an adapter automatically once it passes, or only after we promote it?
5. Is +2 minutes right for every market type? Live sport moves in seconds; politics may need longer.
6. Which niche markets give the best ratio of signal to bot competition?
7. **UK legality:** which countries could legally receive real-money alerts or trading later?
8. Using Jev (TypeSafe) as a comparison-only Model Kombat challenger outside Mubit: OK with the organisers?
