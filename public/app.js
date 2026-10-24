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
  if (!("correct" in c)) return `<span class="muted">grading at +2 min</span>`;
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
    ["Dropped (repeats, spam, too short)", s.dropped.toLocaleString()],
    ["Matched to a market", s.matched.toLocaleString()],
    ["Local filter (free, ~20 ms): blocked", (s.localBlocked ?? 0).toLocaleString()],
    ["Haiku gate: passed", `${s.gated - s.filtered} of ${s.gated}`],
    ["Analyst calls", s.judged],
    ["Graded by the market", s.decided],
    ["Accuracy", s.decided ? `${Math.round((100 * s.correct) / s.decided)}%` : "–"],
    ["Paper P&L ($100 a trade)", `${s.pnl >= 0 ? "+" : "−"}$${Math.abs(s.pnl).toFixed(2)} · ${s.tradesWon ?? 0} of ${s.trades ?? 0} trades won`],
    ["Corrections sent to Mubit", `${s.ratedUp} Good · ${s.ratedDown} Bad`],
    ["Mubit balance", s.mubitBalance == null ? "–" : `$${s.mubitBalance.toFixed(2)} · ${s.mubitRunsLeft.toLocaleString()} runs left`],
    ["Spent from balance today", s.mubitSpentToday == null ? "–" : `$${s.mubitSpentToday.toFixed(3)}`],
    ["Free credit used today (est.)", s.spendToday == null ? "–" : `$${s.spendToday.toFixed(2)} · ${s.spendCallsToday} AI calls`],
    ["Live markets", s.markets],
  ];
  $("stats").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
}

// Live updates by polling once a second (works through tunnels that buffer streaming responses).
const handlers = {};
const es = { addEventListener: (type, fn) => (handlers[type] = fn) };
let cursor = 0;
async function poll() {
  try {
    const { seq, events } = await (await fetch(`/api/feed?since=${cursor}`)).json();
    for (const e of events) handlers[e.type]?.({ data: JSON.stringify(e.data) });
    cursor = seq;
  } catch {}
  setTimeout(poll, 1000);
}
setTimeout(poll, 0);
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

// ---- Tabs ----
const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);
function show(view) {
  for (const v of document.querySelectorAll(".view")) v.hidden = v.id !== view;
  for (const b of document.querySelectorAll("nav button")) b.classList.toggle("on", b.dataset.view === view);
  if (view === "nightshift") loadNightShift();
}
for (const b of document.querySelectorAll("nav button")) b.addEventListener("click", () => show(b.dataset.view));

// ---- Night Shift ----
async function loadNightShift() {
  const ns = await (await fetch("/api/nightshift")).json();
  const n = ns.now;
  const cards = [
    ["Graded by the market", n.decided],
    ["Accuracy", pct(n.accuracy)],
    ["'Always none' baseline", pct(n.alwaysNone)],
    ["Moves caught", `${pct(n.movesCaught)} of ${n.moves}`],
    ["Up/down calls right", `${pct(n.callPrecision)} of ${n.calls}`],
    ["Normalized gain", ns.normalizedGain == null ? "–" : ns.normalizedGain.toFixed(2)],
    ["Corrections for Mubit", ns.corrections],
    ["Cost per call", n.costPerCall == null ? "–" : `$${n.costPerCall.toFixed(4)}`],
  ];
  $("ns-cards").innerHTML = cards.map(([k, v]) => `<div class="card"><small>${k}</small><b>${esc(v)}</b></div>`).join("");
  $("ns-curve").innerHTML = ns.curve.length
    ? ns.curve
        .map((b) => {
          const t = new Date(b.from * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return `<div class="bar-row"><span>${t}</span><div class="bar"><i style="width:${(b.accuracy ?? 0) * 100}%"></i></div><span>${pct(b.accuracy)} · ${b.decided} graded</span></div>`;
        })
        .join("")
    : `<p class="muted">The first grades arrive about 3 minutes after the first calls.</p>`;
  $("ns-versions").innerHTML =
    `<tr><th>Version</th><th>Graded</th><th>Accuracy</th><th>Moves caught</th><th>Avg speed</th><th>Cost/call</th></tr>` +
    ns.versions
      .map((v) => `<tr><td>${esc(v.name)}</td><td>${v.decided}</td><td>${pct(v.accuracy)}</td><td>${pct(v.movesCaught)}</td><td>${v.avgLatencyMs ?? "–"} ms</td><td>${v.costPerCall == null ? "–" : "$" + v.costPerCall.toFixed(4)}</td></tr>`)
      .join("");
}
setInterval(() => !$("nightshift").hidden && loadNightShift(), 10_000);

// ---- Mubit panel (Night Shift) ----
function renderMubit(m) {
  if (!m || m.unavailable) return ($("ns-mubit").innerHTML = `<p class="muted">Mubit console login not connected.</p>`);
  const tasks = m.tasks
    .map((t) => `<tr><td>${esc(t.name)}</td><td>${t.calls}</td><td>${t.trainable}</td><td>${t.ratedUp}</td><td>${t.ratedDown}</td><td>${t.unrated}</td></tr>`)
    .join("");
  const models = m.adapters.length
    ? m.adapters
        .map(
          (a) => `<div class="card model"><small>${esc(a.baseModel)} · v${a.version} · ${esc(a.status)} · ${esc(a.promotion)} · ${a.rolloutPercent}% of traffic</small>
            <b>${a.passRate == null ? "–" : pct(a.passRate)} match vs the big model</b>
            <small class="${a.verdict === "gated" ? "bad" : "good"}">${esc(a.verdict ?? "not tested yet")}</small>
            <small>${esc(a.reason ?? "")}</small></div>`,
        )
        .join("")
    : `<p class="muted">No small model yet: Mubit trains one per task once it has 25 kept examples.</p>`;
  $("ns-mubit").innerHTML = `
    <div class="cards">
      <div class="card"><small>Mubit balance (real money)</small><b>$${m.balanceUsd.toFixed(2)}</b><small>${m.runsLeft.toLocaleString()} runs left at $${m.usdPerRun.toFixed(3)} a run</small></div>
      <div class="card"><small>Spent from balance today</small><b>$${m.spentFromBalanceToday.toFixed(3)}</b><small>Runs = Mubit's own rating and training work</small></div>
    </div>
    <h3>Mubit's small models</h3><div class="cards">${models}</div>
    <h3>Mubit tasks</h3>
    <table><tr><th>Task</th><th>Calls</th><th>Trainable</th><th>Rated Good</th><th>Rated Bad</th><th>Unrated</th></tr>${tasks}</table>`;
}
es.addEventListener("mubit", (e) => renderMubit(JSON.parse(e.data)));

// ---- Model Kombat ----
const FIGHTER_NAMES = { "claude-opus-5-5": "OPUS · the boss", "claude-haiku-4-5": "HAIKU · the cheap one" };
const fighterName = (n) => FIGHTER_NAMES[n] ?? (n.endsWith("· live") ? `${n.split(" ")[0].replace("claude-", "").toUpperCase()} · our live analyst` : n);
function renderArena(board) {
  $("arena").innerHTML = board
    .map((b) => {
      const hp = b.rounds ? b.hits / b.rounds : 0;
      return `<div class="fighter"><div class="pixel name">${esc(fighterName(b.name))}</div>
        <div class="hp"><i style="width:${hp * 100}%"></i></div>
        <small>${b.hits}/${b.rounds} right · ${Math.round(b.latencyMs / Math.max(1, b.rounds))} ms avg · $${b.cost.toFixed(4)} spent</small></div>`;
    })
    .join("");
}
$("fight").addEventListener("click", async () => {
  $("rounds").innerHTML = "";
  const r = await fetch("/api/kombat?rounds=20", { method: "POST" });
  $("kombat-status").textContent = r.status === 409 ? "A fight is already running…" : "Fighting…";
});
es.addEventListener("kombat", (e) => {
  const k = JSON.parse(e.data);
  if (k.status === "round") {
    renderArena(k.board);
    const marks = k.results.map((r) => `${fighterName(r.name)} ${r.error ? "⚠" : r.hit ? "✓" : "✗"}`).join(" · ");
    prepend("rounds", `<li><b>ROUND ${k.round}/${k.of}</b> ${esc(k.question)} · market said <b>${esc(k.truth)}</b><br><small>${esc(marks)}</small></li>`, 60);
    $("kombat-status").textContent = `Round ${k.round} of ${k.of}`;
  } else if (k.status === "done") {
    renderArena(k.board);
    const best = [...k.board].sort((a, b) => b.hits / b.rounds - a.hits / a.rounds || a.cost - b.cost)[0];
    $("kombat-status").textContent = best ? `K.O.! Winner: ${fighterName(best.name)}` : "No graded cases yet: let the market grade a few calls first.";
  } else if (k.status === "error") {
    $("kombat-status").textContent = `Fight stopped: ${k.message}`;
  }
});
