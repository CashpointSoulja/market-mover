# What we're making and why

## Explained like you're five

Imagine a **giant playground scoreboard** where lots of people bet on things: *"Will the Brewers win tonight?"*, *"Will it rain on Friday?"* Every bet has a price. A cheap price means "probably not", an expensive price means "probably yes". When something happens in the world, the prices jump.

We're building a **robot helper that reads the news really, really fast** (thousands of posts a minute). First it throws away the silly stuff: adverts, jokes, people shouting opinions. Then, for the posts that matter, it shouts:

> "Ooh! This news means *the Rays winning* just got LESS likely!"

Then **we wait two minutes and look at the scoreboard.**

- If the price moved the way the robot said, it was right and it gets a ⭐.
- If it moved the other way, it was wrong.

Either way, **we tell Mubit, the teacher: "this one was Good" or "this one was Bad".** The teacher uses those notes to train a smaller, faster robot that does the same job for less.

```
📰 News ──► 🧹 throw away junk ──► 🤖 Robot guesses ──► ⏱️ 2 minutes ──► 📈 Scoreboard says right or wrong
                                         ▲                                          │
                                         └──── 👩‍🏫 Mubit: "Good" / "Bad" ◄──────────┘
```

**Nobody has to mark the answers. The scoreboard marks them, and we pass the marks to the teacher.** That's the clever bit.

---

## The grown-up version

### The problem
Prediction markets such as Polymarket move on news. Across Polymarket's 100 busiest markets about **$36 million** changed hands in one 24-hour period we measured, and the whole site was doing roughly **17 trades a second**. The people who react fastest *and* understand the news correctly get the better prices.

There are two hard parts:

1. **Too much news.** Bluesky alone produces about **43 new posts a second**. Nearly all of it is irrelevant.
2. **Understanding is expensive.** A big AI model (a "frontier" model such as Claude Sonnet) can judge whether a post matters to a market, but it costs money and takes about **2 seconds per call**. Running it on everything, all day, adds up.

### What Market Mover does
| Step | Who does it | Measured (24 Oct) |
|---|---|---|
| Read every new public post | Plain code (Bluesky's free public stream) | ~43 posts/sec |
| Drop repeats, hashtag/link spam, very short posts | Plain code | ~25% of posts |
| Keep posts that mention a live market | Plain code (2+ distinctive words in common) | ~20 posts/min |
| Drop clear chatter | **Free open-source classifier** running on our machine | ~20–40 ms per post, $0 |
| "Does this state a real, new fact?" | Claude Haiku 4.5, **through Mubit** | ~0.9 s, ~$0.00045; blocks ~88% |
| Which market, which way, how strongly | Claude Sonnet 5.5, **through Mubit** | ~1.9 s median, ~$0.0022 |
| Grade the call | **The market itself**: the price 2 minutes later | Automatic |
| Teach the small model | Each grade sent to Mubit as a **Good/Bad rating** on that call | 54 ratings sent in the first hour |
| Train the small model | Mubit, per task | First one ready in ~5 minutes (Qwen3-4B) |

### Who it's for
- **Prediction-market traders outside the UK** who want fast, explained alerts in markets they follow.
- **Funds and market makers** (firms that constantly quote prices on both sides of a market) who want a timestamped feed of news-driven calls.
- **Any team paying a big model to do the same small job all day.** Market Mover is a working example of moving that job onto a model you own.

### Why now
- Prediction markets are big and liquid enough that news really moves prices within minutes.
- Their data is public: market lists, live prices and price history, and every trade on the Polygon blockchain, which we read about **2.5–3.6 seconds** behind real time.
- Mubit launched this weekend. It turns repeated AI calls into a small, task-specific model.

### Why Mubit is essential, not decoration
1. **Volume.** Thousands of posts a minute need screening. Our yes/no gate is exactly the kind of high-volume, simple job Mubit shrinks into a small model.
2. **Speed.** Prices move within minutes; in busy markets bots react within seconds. A small model answers faster than a big one.
3. **Labels for free.** Most AI products struggle to get reliable "right answers". **Ours come from the market's own price moves**, and we send every one back to Mubit as a rating on the exact call. That's the correction → model-update loop the hackathon asks for, running automatically.
4. **Fast refresh.** New markets open every day and old ones settle. The model has to keep up, and two-minute grading keeps the feedback coming.

### What it is not
- **Not a trading bot.** It doesn't place trades. UK users can't legally trade Polymarket or Kalshi, so the demo uses paper trading (simulated money).
- **Not a promise of profit.** Price moves are noisy and the big markets are crowded with fast bots. Early numbers are humbling (see the PRD): we report them as they are.
- **Not a rumour mill.** It only reads. Posting claims to move a market would be market manipulation.
- **Not a wallet-unmasking tool.** Wallets are public but pseudonymous. We count behaviour and never try to work out who is behind one.
