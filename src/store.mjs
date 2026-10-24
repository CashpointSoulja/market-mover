// Live event bus for the screen (Server-Sent Events) plus append-only JSONL logs on disk.
import { appendFile, mkdir } from "node:fs/promises";

const DATA_DIR = new URL("../data/", import.meta.url);
await mkdir(DATA_DIR, { recursive: true });

const clients = new Set();
const recent = new Map();

export function subscribe(res) {
  clients.add(res);
  res.on("close", () => clients.delete(res));
}

// Every event also gets a sequence number, so screens can poll "what's new since #N" (tunnels and proxies
// that buffer streaming responses still pass ordinary requests).
let seq = 0;
const log = [];
export function feed(since) {
  if (!since || since > seq) return { seq, events: replay() }; // first load, or the server restarted
  return { seq, events: log.filter((e) => e.seq > since) };
}
function replay() {
  const out = [];
  for (const type of ["match", "call", "grade", "chain", "stats", "mubit"])
    for (const data of recentOf(type, ["chain", "stats", "mubit"].includes(type) ? 1 : 25)) out.push({ seq, type, data });
  return out;
}

export function emit(type, payload) {
  const event = { at: Date.now(), ...payload };
  log.push({ seq: ++seq, type, data: event });
  if (log.length > 1000) log.shift();
  const list = recent.get(type) ?? [];
  list.push(event);
  if (list.length > 200) list.shift();
  recent.set(type, list);
  const line = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(line);
  return event;
}

export const recentOf = (type, n) => (recent.get(type) ?? []).slice(-n);

export function record(file, row) {
  return appendFile(new URL(file, DATA_DIR), JSON.stringify(row) + "\n");
}
