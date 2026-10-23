# What we're making and why

## Explained like you're five

Imagine a **giant playground scoreboard** where lots of people bet on things: *"Will the Brewers win tonight?"*, *"Will it rain on Friday?"* Every bet has a price. A cheap price means "probably not", an expensive price means "probably yes". When something happens in the world, the prices jump.

We're building a **robot helper that reads the news really, really fast** (thousands of posts a minute) and shouts:

> "Ooh! This news means *the Rays winning* just got LESS likely!"

Then **we wait 10 minutes and look at the scoreboard.**

- If the price moved the way the robot said, it was right and it gets a ⭐.
- If it moved the other way, it was wrong, and **Mubit is the teacher who says "let's remember this one".**

Every night, the teacher helps the robot study its mistakes, so tomorrow's robot is **smarter, faster and cheaper** than today's.

```
📰 News ──► 🤖 Robot guesses ──► ⏱️ 10 minutes ──► 📈 Scoreboard says right or wrong
                  ▲                                         │
                  └─────────── 👩‍🏫 Mubit teaches it ◄────────┘
```

**Nobody has to mark the answers. The scoreboard marks them.** That's the clever bit.

---

## The grown-up version

### The problem
Prediction markets such as Polymarket move on news. Across Polymarket's 100 busiest markets, about **$36 million** changed hands in one 24-hour period we measured, and the whole site was doing roughly **17 trades a second**. The people who react fastest *and* understand the news correctly get the better prices.

There are two hard parts:

1. **Too much news.** Bluesky alone produces about **43 new posts a second**. Nobody can read that, and nearly all of it is irrelevant.
2. **Understanding is expensive.** A big AI model (a "frontier" model such as Claude Sonnet or GPT) can read a post and judge whether it matters to a market, but it costs money and takes about **2–3 seconds per call**. Running it on every relevant post, all day, adds up.

### What Market Mover does
| Step | Who does it | Measured |
|---|---|---|
| Read every new public post | Plain code (Bluesky's free public stream) | ~43 posts/sec |
| Keep only posts that mention a live market | Plain code (needs 2+ distinctive words in common) | ~16 posts/min out of ~2,300 |
| Judge each one: which market, which way, how strongly | AI analyst, **always through Mubit** | ~2.7 s median per call (first 10 live calls) |
| Grade the judgement | **The market itself**: the price 10 minutes later | Automatic |
| Learn from right and wrong calls | Mubit trains a small model for this one task | — |

### Who it's for
- **Prediction-market traders outside the UK** who want fast, explained alerts in markets they follow.
- **Funds and market makers** (firms that constantly quote prices on both sides of a market) who want a timestamped feed of news-driven calls.
- **Any team paying a big model to do the same small job all day.** Market Mover is a working example of moving that job onto a model you own.

### Why now
- Prediction markets are big and liquid enough that news really moves prices within minutes.
- Their data is public: market lists, live prices, and every trade on the Polygon blockchain, which we read about **2.5–3.6 seconds** behind real time.
- Mubit launched this weekend. It turns repeated AI calls into a small, task-specific model.

### Why Mubit is essential, not decoration
1. **Volume.** One call per matched post is ~23,000 calls a day at today's match rate. On Claude Sonnet 5.5 that's about **$49 a day (~$17.8K a year)** just for this one question (see [business-model.md](business-model.md)). A small model trained on the task is how it gets cheap enough to run on everything.
2. **Speed.** Prices move within minutes, and in busy markets bots react within seconds. A small model answers faster than a big one, and here speed is money.
3. **Labels for free.** Mubit learns from examples and corrections. Most AI products struggle to get reliable "right answers"; **ours come from the market's own price moves**, so every call is graded automatically. That's the cleanest correction → model-update loop we could find.
4. **Fast refresh.** New markets open every day and old ones settle, so the task keeps changing. The model has to keep up.

### What it is not
- **Not a trading bot.** It doesn't place trades. UK users can't legally trade Polymarket or Kalshi, so the demo uses paper trading (simulated money).
- **Not a promise of profit.** Price moves are noisy, and the big markets are crowded with fast bots. We report accuracy and paper profit and loss, never expected returns.
- **Not a rumour mill.** It only reads. It never posts or spreads claims; doing that to move a market would be market manipulation.
- **Not a wallet-unmasking tool.** On-chain wallets are public but pseudonymous. We count and track behaviour, and we never try to work out who is behind a wallet.
