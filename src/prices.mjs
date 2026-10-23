// Live YES price from Polymarket's order book: the midpoint between the best bid and the best ask.
export async function midpoint(tokenId) {
  const r = await fetch(`https://clob.polymarket.com/midpoint?token_id=${tokenId}`);
  if (!r.ok) return null;
  const n = Number((await r.json()).mid);
  return Number.isFinite(n) ? n : null;
}
