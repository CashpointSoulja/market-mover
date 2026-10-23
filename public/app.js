const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cents = (p) => (p == null || Number.isNaN(p) ? "–" : `${Math.round(p * 100)}¢`);
const arrow = (c) => {
  const first = c.market?.outcomes?.[0] ?? "YES";
  return { up: `▲ ${first}`, down: `▼ ${first}`, none: "– none" }[c.effect] ?? c.effect;
};

function prepend(listId, html, max = 40) {
  const list = $(listId);
  list.insertAdjacentHTML("afterbegin", html);
  while (list.children.length > max) list.lastElementChild.remove();
}

function verdictHtml(c) {
  if (!("correct" in c)) return `<span class="muted">grading at +10 min</span>`;
  const moved = `moved ${(c.move * 100).toFixed(1)} pts`;
  if (c.correct == null) return `<span class="muted">${moved} · too small to grade</span>`;
  const pnl = c.pnl ? ` · paper ${c.pnl >= 0 ? "+" : "−"}$${Math.abs(c.pnl).toFixed(2)}` : "";
  return `<span class="${c.correct ? "good" : "bad"}">${c.correct ? "✓ market agreed" : "✗ market disagreed"} · ${moved}${pnl}</span>`;
}

const callHtml = (c) => `
  <li class="call ${c.effect}" data-call="${esc(c.id)}">
    <div class="row"><b>${esc(arrow(c))}</b><span>${"●".repeat(c.strength ?? 1)}</span><em>${cents(c.priceAtCall)}</em></div>
    <p>${esc(c.market?.question)}</p>
    <small>${esc(c.reason)} · ${c.latencyMs} ms</small>
    <div>${verdictHtml(c)}</div>
  </li>`;

function renderStats(s) {
  const rows = [
    ["Analyst", s.analyst],
    ["Posts read", s.posts.toLocaleString()],
    ["Matched to a market", s.matched.toLocaleString()],
    ["AI calls", s.judged],
    ["Graded by the market", s.decided],
    ["Accuracy", s.decided ? `${Math.round((100 * s.correct) / s.decided)}%` : "–"],
    ["Paper P&L", `${s.pnl >= 0 ? "+" : "−"}$${Math.abs(s.pnl).toFixed(2)}`],
    ["Live markets", s.markets],
  ];
  $("stats").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
}

const es = new EventSource("/events");
es.addEventListener("match", (e) => {
  const m = JSON.parse(e.data);
  prepend("news", `<li><p>${esc(m.text)}</p><small>${m.markets.map(esc).join(" · ")}</small></li>`);
});
es.addEventListener("call", (e) => prepend("calls", callHtml(JSON.parse(e.data))));
es.addEventListener("grade", (e) => {
  const g = JSON.parse(e.data);
  const el = document.querySelector(`[data-call="${CSS.escape(g.id)}"]`);
  if (el) el.outerHTML = callHtml(g);
});
es.addEventListener("stats", (e) => renderStats(JSON.parse(e.data)));
es.addEventListener("chain", (e) => {
  const t = JSON.parse(e.data);
  $("ticker").textContent = `ON-CHAIN · ${t.fillsPerSec.toFixed(1)} trade fills/sec · ${t.wallets} wallets in the last minute · ${t.lagSec.toFixed(1)}s behind real time`;
});
