# Market Mover — how we use Mubit

Author: Ayo Ahmed · 24 Oct 2026

Mubit is a **proxy** (a middleman) for AI calls: our app sends every call to Mubit, Mubit forwards it to the AI provider, records it, groups similar calls into **tasks**, and trains a small **adapter** model for each task. We use it in four ways.

```
                      ① every AI call (API key)
Market Mover ─────────────────────────────────────► Mubit gateway ──► Claude (starter credit)
     │                                                   │ records the call ("trace")
     │                                                   ▼
     │                                             task: analyst / gate
     │                                                   │ trains
     │                                                   ▼
     │  ② market grade → Good/Bad rating          adapter (small model, e.g. Qwen3-4B)
     ├──────────────────────────────────────────►  trace feedback
     │  ③ balance, adapters, tasks (every 60 s)        │ tested against the big model
     ◄──────────────────────────────────────────  console API
     │  ④ promote the adapter to serve traffic (not yet)
     └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►
```

## ① Every AI call goes through Mubit (documented)
| | |
|---|---|
| Route | `https://api.mubit.ai/anthropic` with the official Anthropic SDK; key `mbt_…` as the API key |
| Models | `claude-sonnet-5-5` (analyst), `claude-haiku-4-5` (gate); `claude-opus-5-5` in Model Kombat. All on the free starter credit |
| Sessions | `metadata.user_id` = hashed post id. Mubit holds test cases out by session |
| Frozen prompts | Mubit groups calls into a task only while model, instructions and output format stay identical |
| Not stored | Tests and Kombat replays send `x-middleware-store: false`, so they never become training data |
| Why not the OpenAI route | OpenAI rejects the `metadata` field unless `store` is on |

**Result:** Mubit made **two tasks**: "Prediction-market news analyst" and "Screen social media posts" (the gate).

## ② Corrections: market grades become ratings (console API)
After the market grades a call (2 minutes later), `corrections.mjs` finds that call's Mubit **trace** (its recorded copy) and rates it:

```
POST https://app.mubit.ai/mapi/engine/v2/traces/{trace_id}/feedback
{ "rating": "up" | "down", "comment": "Market check: \"Knicks vs. Celtics\" moved -4.1 pts right after this call. Call: none. Market: down." }
```
- Matching: trace `metadata.user_id` = our call's session id, analyst task only.
- `up` = the call was right, `down` = wrong. Comments are capped at 500 characters.
- **54 ratings sent in the first hour** (30 up, 24 down). Mubit's own AI judge also rates calls (74 up, 18 down on the analyst task at last check), capped at 200 a day.

This is the "correction turning into a model update" the hackathon judges look for, running automatically.

## ③ Status: balance, adapters, tasks (console API)
Read every 60 seconds and shown on the Night Shift screen:

| Endpoint | What we read |
|---|---|
| `GET /mapi/billing/account` | `balance_micros`, `runs_left`, `price_micros` |
| `GET /mapi/engine/v2/adapters` | Each small model: base model, version, status, promotion state, rollout %, test verdict and pass rate |
| `GET /mapi/engine/v2/lanes` | Each task: calls, trainable, rated up/down, unrated |
| `GET /mapi/engine/v2/traces` | Recorded calls (used to match ratings) |

**First small model:** `ad_lane_3885e07f` on **Qwen/Qwen3-4B-Instruct-2507**, trained on the analyst task in **about 5 minutes** (00:30 → 00:35). Mubit's test: **41.7% match with the big model** on 12 held-out checks (the base model alone scored 0%). Verdict **"gated"**: not good enough to serve yet, 0% of traffic.

## ④ Promotion (not used yet)
`POST /mapi/engine/v2/adapters/{id}/versions/{v}/promotion` moves an adapter version towards serving live traffic. We'll use it only once Mubit's own tests pass. Adapters can't be called directly by name ("There is no Mubit model ID"), so promotion, or Mubit's automatic routing, is how the small model gets real traffic.

## How we sign in to the console API
The console's management API doesn't accept the `mbt_` key ("invalid admin token"). It uses a short-lived admin token from the console's sign-in service (Clerk):

```
data/tools/mubit-console.mjs   one-off: invisible browser signs in with the emailed code,
                               saves the login to data/mubit-console-state.json (git-ignored, mode 600)
src/mubitAdmin.mjs             Clerk session cookie ──► POST clerk.mubit.ai/v1/client/sessions/{id}/tokens
                               ──► admin token (~1 min) ──► app.mubit.ai/mapi/…  (re-minted as needed)
```

**Risks:** this API is **undocumented** and may change or break without notice (it briefly returned `503 engine_unreachable` during testing). The saved login is as sensitive as a password: it stays on this machine and is never committed. If the API stops working, the app keeps running; only ratings, balance and adapter status pause.
