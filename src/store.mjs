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

export function emit(type, payload) {
  const event = { at: Date.now(), ...payload };
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
