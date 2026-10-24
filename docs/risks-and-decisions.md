# Market Mover — risks and decisions

Author: Ayo Ahmed · 24 Oct 2026

## Decision log
| # | Decision | Why | Alternatives considered |
|---|---|---|---|
| D1 | **Prediction-market news analyst** as the product | Real recurring task at volume; the market grades every call; speed and cost matter, which a small model fixes | Refund-desk game, Wikipedia vandalism defence, claim matching, ship tracking, a TRIBE v2 tool (non-commercial licence) |
| D2 | **Market-graded labels** | Objective, automatic, no human labelling | Human verifiers (slow, subjective), settled results only (too slow) |
| D3 | **Decisive-only grading** (≥3 pts or ≤0.5 pt) | Price moves are noisy | Grade every move, longer windows |
| D4 | **Grade at +2 minutes, not 10** | Live markets react within a minute or two; faster feedback for Mubit and the demo; price history makes it restart-safe | 10 min (slow loop), several windows (later) |
| D5 | **Bluesky Jetstream** as the first source | Free, public, live | GDELT (15-min updates), paid wires (later) |
| D6 | **2+ shared distinctive words** to match | Single-word matching gave ~270 junk matches/min | Entity recognition, embeddings |
| D7 | **Free code filter** before matching | Repeats, spam and tiny posts are free to drop (~25%) | None |
| D8 | **Free open-source local classifier** (DeBERTa-v3 xsmall via transformers.js) **instead of Jev** | Jev (TypeSafe) costs money and calls outside Mubit would look like a competitor at Mubit's event; the open-source model is free, runs in ~20–40 ms in our Node server, and gives a Jev-style typed decision with a probability. It only drops clear chatter because it mistakes confident opinions for facts | Jev (paid; kept as a comparison-only Kombat challenger, to confirm with organisers), GLiClass (Python only), Haiku on everything (slower, costs more) |
| D9 | **Haiku 4.5 yes/no gate through Mubit** before the analyst | Blocks ~88% at a fifth of Sonnet's price, and becomes its own Mubit task to train a small gate | No gate (expensive, noisy), Jev |
| D10 | **Claude Sonnet 5.5 via Mubit's Anthropic route** as the analyst | Frontier quality on the starter credit; native session field (`metadata.user_id`); OpenAI's route rejected `metadata` unless `store` is on | GPT models on the OpenAI route |
| D11 | **First listed outcome** as the direction | Head-to-head markets have no "Yes" | Let the model pick the side |
| D12 | **Frozen prompts** with a version tag; kept "10 minutes" wording after moving grading to 2 | Mubit groups calls into a task only while the instructions stay identical | Edit freely (resets the task) |
| D13 | **Use the Mubit console's own management API** for ratings, balance and adapters | It's the only way to send corrections and read the real balance from code; the public docs have no API for either | Click ratings by hand in the console; skip corrections |
| D14 | **Two-part billing** (real Mubit balance + estimated starter credit) | Mubit shows no amount for the starter credit; the balance is real money spent per run | Token estimate only (misses the real money) |
| D15 | **On-chain reading** for trades | ~2.5–3.6 s behind, includes wallets | Public trades API (~4 min behind) |
| D16 | **Paper trading only** | UK users can't legally trade these markets | Real money |
| D17 | **No server-side fallback model** on refusals | Switching models would split Mubit's task | Fallback to another model |

## Risk register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| UK legal limits on prediction markets | Certain (today) | Blocks real money | Alerts, analysis, paper trading; legal review per country first |
| Analyst worse than always-none (first hour: 88% vs 96%; 11% of up/down calls right) | Happening | High | Filters send fewer, better posts; ratings tell Mubit what was wrong; move to faster markets (esports, live sport) |
| **Mubit console API changes or breaks** (undocumented; returned 503 once) | Medium | High for corrections and billing | Core pipeline independent of it; errors logged and retried; ask Mubit for a supported route |
| Saved console login leaks | Low | High | Git-ignored, mode 600, never sent anywhere but Mubit's own sign-in service |
| Noisy labels | Medium | High | Decisive-only grading; graded counts shown next to every number |
| Big markets bot-crowded | High | Medium | Niche and interpretation-heavy markets |
| Local classifier drops real news | Medium | Medium | Low threshold (0.5); decisions logged in `gate.jsonl` for review; plan to have the market grade blocked posts too |
| Adapters can't be called from code | Known | Medium | Mubit's tests + promotion endpoint |
| Two copies running (laptop + cloud) | Medium | Medium | Run one copy only; doubled calls double cost and ratings |
| Public deployment spends credits | Medium | Medium | Protect the Kombat button before deploying |
| Free Polygon node errors or lag | Medium | Low | Stay 2 blocks behind; dedicated node later |
| NSFW or upsetting posts on stage | Medium | Medium | Checked recording; no usernames shown |
| Starter credit or balance runs out | Low–medium | Medium | Gate and filters cut calls; watch CodexBar; add a provider key or top up |
| Market manipulation concerns | Low (read-only) | High | Never post or spread claims |
| Wallet privacy | Low | Medium | Behaviour only, never identity |
