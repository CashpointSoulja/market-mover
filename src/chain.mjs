// Every Polymarket trade, read straight from the Polygon blockchain (~2.5s behind real time).
const RPC = process.env.POLYGON_RPC || "https://polygon-bor-rpc.publicnode.com";
// Found on 24 Oct 2026 by tracing real trades back to their contracts; Polymarket has moved exchanges before.
const EXCHANGES = ["0xe111180000d2663c0091e4f400237545b87b996b", "0xe2222d279d744050d28e00520010520000310f59"];
const FILL_EVENT = "0xd543adfd";

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "market-mover" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
const hex = (n) => "0x" + n.toString(16);

export async function streamChain(onTick, everyMs = 2000) {
  let last = parseInt(await rpc("eth_blockNumber", []), 16) - 3;
  const window = [];
  setInterval(async () => {
    try {
      const head = parseInt(await rpc("eth_blockNumber", []), 16) - 2; // 2 blocks back, so every public node has them
      if (head <= last) return;
      const [logs, block] = await Promise.all([
        rpc("eth_getLogs", [{ fromBlock: hex(last + 1), toBlock: hex(head), address: EXCHANGES }]),
        rpc("eth_getBlockByNumber", [hex(head), false]),
      ]);
      last = head;
      const fills = logs.filter((l) => l.topics[0].startsWith(FILL_EVENT));
      window.push({ t: Date.now(), fills: fills.length, wallets: fills.flatMap((l) => [l.topics[2], l.topics[3]]) });
      while (window[0].t < Date.now() - 60_000) window.shift();
      const seconds = Math.max(1, (Date.now() - window[0].t) / 1000);
      onTick({
        fillsPerSec: window.reduce((s, w) => s + w.fills, 0) / seconds,
        wallets: new Set(window.flatMap((w) => w.wallets)).size,
        lagSec: Date.now() / 1000 - parseInt(block.timestamp, 16),
      });
    } catch {
      // Public node hiccup: try again on the next tick.
    }
  }, everyMs);
}
