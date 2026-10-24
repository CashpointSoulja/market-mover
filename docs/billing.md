# Market Mover — billing: what costs money and how we measure it

Author: Ayo Ahmed · 24 Oct 2026

There are **two separate pots**, and only one of them is real money.

```
YOUR MONEY   = Mubit balance        exact, read live from Mubit   $0.005 per "run" (Mubit's own work)
FREE CREDIT  = Mubit starter credit  no amount shown by Mubit      pays for the Claude calls themselves
FREE         = code filter + local open-source classifier          runs on our machine
```

## 1. Mubit balance (real money, exact)
| | Value (24 Oct) |
|---|---|
| Source | `GET /mapi/billing/account` (console API) |
| Balance | ~$23.56 at 01:38 → **$23.36** at 01:48 |
| Price | `price_micros = 5000` → **$0.005 per run** |
| Runs left | 4,672 at the last reading |
| What a run is | Mubit's own work, such as its AI judge rating calls and training adapters. **Not** charged per AI call: the balance fell by about 40 runs in 10 minutes while we made well over 100 calls |
| Card | None on file; the console offers top-ups ($10–$1,000) |

The app records a reading every few minutes (`data/balance.jsonl`) and shows **"spent from balance today"** = first reading since midnight − latest.

## 2. Starter credit (free, estimated)
Mubit's starter credit pays for calls to Anthropic, OpenAI and Gemini until we add our own provider key. Mubit only shows whether it's **"active"** or **"used up"**, never an amount. So we estimate it from the token counts on every response × Anthropic list prices:

| Step | Model | Price per M tokens (in / out) | Measured average per call |
|---|---|---|---|
| Gate | Claude Haiku 4.5 | $1 / $5 | **~$0.00045** |
| Analyst | Claude Sonnet 5.5 | $2 / $10 | **~$0.0022** |
| Model Kombat boss | Claude Opus 5.5 | $4 / $20 | ~$0.0042 (estimated from analyst tokens) |
| Local gate | DeBERTa-v3 xsmall (open source) | — | **$0** |

**Tonight so far:** ~$1.13 of starter credit across ~1,080 calls (Sonnet ~$0.81 over 370 calls, Haiku ~$0.32 over 708).

## Where you see it
| Place | Shows |
|---|---|
| Trading floor scoreboard | Mubit balance + runs left, spent from balance today, free credit used today (est.) |
| Night Shift → Mubit panel | Balance, runs left, price per run, spent today |
| CodexBar → Mubit | Both pots, by model, per-hour chart. Read from a secret GitHub Gist the server updates every 5 min (CodexBar plugins must use https). Shows "Updated N min ago"; a warning after 20 min means Market Mover has stopped |
| `GET /api/spend` | Everything above as JSON |

## Why the filters matter for cost
Without the filters, every matched post would cost a Sonnet call (~$0.0022). With them:

| Stage | Share of matched posts that reach it | Cost per post at that stage |
|---|---|---|
| Local classifier | 100% | $0 |
| Haiku gate | what the local classifier passes | ~$0.00045 |
| Sonnet analyst | ~12% of what the gate sees | ~$0.0022 |

## Limits
- The starter-credit figure is an **estimate**: real provider prices or Mubit's accounting may differ, and calls made before cost tracking started aren't counted.
- The balance comes from the **undocumented** console API; if that breaks, the balance pauses but the estimate keeps working.
