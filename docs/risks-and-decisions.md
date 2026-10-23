# Market Mover — risks and decisions

Author: Ayo Ahmed · 24 Oct 2026

## Decision log
| # | Decision | Why | Alternatives considered |
|---|---|---|---|
| D1 | **Prediction-market news analyst** as the product | Real recurring task at volume; the market grades every call automatically; speed and cost matter, which is exactly what a small model fixes | Refund-desk game, Wikipedia vandalism defence, claim matching, ship tracking, a TRIBE v2 creator tool (non-commercial licence) |
| D2 | **Market-graded labels** (price at +10 min) | Objective, automatic, no human labelling | Human verifiers (slow, subjective), settled results only (too slow for a weekend) |
| D3 | **Decisive-only grading** (≥3 pts or ≤0.5 pt) | Price moves are noisy; in-between moves aren't trusted | Grade every move (noisy), longer windows (fewer grades) |
| D4 | **Bluesky Jetstream** as the first source | Free, public, live, ~43 posts/sec | GDELT (only updates every 15 min), paid news wires (later) |
| D5 | **2+ shared distinctive words** to match | Single-word matching gave ~270 junk matches/min ("together", "student"); 2+ words gives ~16/min | Entity recognition (v1), embeddings |
| D6 | **Claude Sonnet 5.5 via Mubit's Anthropic route** as the teacher | Frontier quality, on the starter credit, native session field (`metadata.user_id`); OpenAI's route rejected `metadata` unless `store` is on | GPT models on the OpenAI route, Haiku (cheaper, weaker teacher) |
| D7 | **First listed outcome** as the direction | Head-to-head markets have no "Yes"; a test call guessed the wrong side | Ask the model which outcome (more output, more error) |
| D8 | **Frozen prompt** with a version tag | Mubit groups calls into a task only while the instructions stay identical | Iterating freely (resets training examples) |
| D9 | **On-chain reading** for trades | ~2.5–3.6 s behind real time, including wallets | Public trades API (~4 min behind, batched) |
| D10 | **Paper trading only** | UK users can't legally trade these markets | Real money (illegal from the UK, and too risky for a demo) |
| D11 | **No server-side fallback model** on refusals | A fallback switches models, which would split Mubit's task fingerprint. Refusals are unlikely on news classification | Fallback to another model |

## Risk register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| UK legal limits on prediction markets | Certain (today) | Blocks real-money use | Alerts, analysis and paper trading only; legal review per country before any real-money feature |
| Noisy labels make accuracy meaningless | Medium | High | Decisive-only grading; always show the number of graded calls; several grading windows in v1 |
| Big markets are bot-crowded | High | Medium | Focus on niche and interpretation-heavy markets |
| Mubit correction mechanism unclear | Medium | High for the demo | Store every call with Mubit's request id so grades can be attached whatever the mechanism; confirm with the Mubit team |
| Adapters can't be called from code | Known | Medium | Use Mubit's Try models and test results for the small model's numbers in Model Kombat |
| Free Polygon node errors or lag | Medium | Low | Stay 2 blocks behind; retry; dedicated node for production |
| NSFW or upsetting posts on stage | Medium | Medium | Stage demo on a checked recording; no usernames shown |
| Starter credit runs out | Low–medium | Medium | One call at a time, stale posts dropped; add our own provider key if needed |
| Market manipulation concerns | Low (read-only) | High | Never post or spread claims; read public data only |
| Wallet privacy | Low | Medium | Count behaviour only; never try to identify owners |
| Restart loses pending grades | Medium | Low | Calls are in `calls.jsonl`; re-grade offline if needed; durable store in v1 |
