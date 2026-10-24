// Mubit's management API, the one the Mubit console itself uses (undocumented, so it may change):
// balance, recorded calls, Good/Bad ratings, tasks and trained adapters.
// Signs in with the saved console login (data/mubit-console-state.json, written by data/tools/mubit-console.mjs):
// the Clerk session cookie mints a short-lived admin token, re-minted as it expires.
import { readFile, access } from "node:fs/promises";

const STATE = new URL("../data/mubit-console-state.json", import.meta.url);
const CLERK = "https://clerk.mubit.ai";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
let jwt = null;
let jwtAt = 0;
let project = process.env.MUBIT_PROJECT || null;

export const adminAvailable = () => access(STATE).then(() => true, () => false);

async function clerkHeaders() {
  const { cookies } = JSON.parse(await readFile(STATE, "utf8"));
  const cookie = cookies
    .filter((c) => c.domain.endsWith("mubit.ai") && c.name.startsWith("__client"))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  return { Cookie: cookie, Origin: "https://app.mubit.ai", Referer: "https://app.mubit.ai/", "User-Agent": UA };
}

async function token() {
  if (jwt && Date.now() - jwtAt < 40_000) return jwt; // Clerk session tokens live about a minute
  const headers = await clerkHeaders();
  const client = await (await fetch(`${CLERK}/v1/client`, { headers })).json();
  const data = client.response ?? client;
  const session = (data.sessions ?? []).find((s) => s.id === data.last_active_session_id) ?? data.sessions?.[0];
  if (!session) throw new Error("Mubit console login expired: run `node data/tools/mubit-console.mjs`");
  const minted = await fetch(`${CLERK}/v1/client/sessions/${session.id}/tokens`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ organization_id: session.last_active_organization_id ?? "" }),
  });
  jwt = (await minted.json()).jwt ?? null;
  jwtAt = Date.now();
  if (!jwt) throw new Error(`Mubit admin token: HTTP ${minted.status}`);
  return jwt;
}

async function mapi(path, { method = "GET", body } = {}) {
  const r = await fetch(`https://app.mubit.ai/mapi${path}`, {
    method,
    headers: { authorization: `Bearer ${await token()}`, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (r.status === 401) jwt = null;
  const json = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Mubit ${method} ${path.split("?")[0]}: HTTP ${r.status} ${json?.error?.code ?? ""}`.trim());
  return json;
}

export async function projectSlug() {
  project ??= (await mapi("/engine/v2/projects?limit=1000")).projects?.[0]?.slug ?? null;
  return project;
}

// Billing balance: real money, spent at price_micros per "run" (Mubit's own work: rating calls, training).
// Provider calls on the starter credit don't touch it.
export async function account() {
  const a = await mapi("/billing/account");
  return { balanceUsd: a.balance_micros / 1e6, runsLeft: a.runs_left, usdPerRun: a.price_micros / 1e6 };
}

export async function traces({ limit = 200, cursor } = {}) {
  return mapi(`/engine/v2/traces?project=${await projectSlug()}&limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`);
}

// rating is "up" (Good) or "down" (Bad); the console caps comments at 500 characters.
export const rate = (traceId, rating, comment) =>
  mapi(`/engine/v2/traces/${traceId}/feedback`, { method: "POST", body: comment ? { rating, comment: comment.slice(0, 500) } : { rating } });

export const adapters = async () => (await mapi("/engine/v2/adapters")).adapters ?? [];
export const lanes = async () => (await mapi(`/engine/v2/lanes?project=${await projectSlug()}&limit=500`)).lanes ?? [];
