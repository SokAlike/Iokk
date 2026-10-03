/**
 * QX Scanner — console script. Paste into DevTools Console (F12) on Quotex.
 * DEMO ACCOUNT FIRST. Starts in DRY mode (no real clicks).
 *
 * 1 tap icon  = start / stop scan
 * 3 taps icon = settings (DRY/LIVE, expiry, limits)
 * Drag icon to move. Console: QXS.remove()
 *
 * The scan line only shows while the bot is really analysing price.
 * It trades only when EMA cross + RSI + trend filter agree.
 * WIN/LOSS are measured from real price at expiry (may differ slightly
 * from the broker's result). No strategy is guaranteed to win.
 */
(function () {
  if (window.QXS) { console.warn("Already running. QXS.remove() first."); return; }

  const CFG = {
    candleSec: 10, emaFast: 5, emaSlow: 13, emaTrend: 30, minScore: 5,
    rsiPeriod: 14, rsiHigh: 70, rsiLow: 30,
    expirySec: 60, cooldownSec: 60,
    maxTrades: 20, maxConsecLoss: 3, maxLoss: 5,
    live: false,
    upSel: "#trade-button button.JQZcs",
    downSel: "#trade-button button.twQq3",
    priceSelector: "",
  };
  const log = (...a) => console.log("[QXS]", ...a);
  const S = { on: false, timer: null, closes: [], cur: null, price: null,
    pf: null, ps: null, wins: 0, losses: 0, trades: 0, consec: 0, lastAt: 0, status: "idle" };
  
  // ---------- price ----------
  const parse = (t) => { t = (t || "").trim(); if (/^\d+,\d+$/.test(t)) t = t.replace(",", ".");
    const n = parseFloat(t.replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : null; };
  const readDom = () => { const e = CFG.priceSelector && document.querySelector(CFG.priceSelector); return e ? parse(e.textContent) : null; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- live feed: tap into the page's own WebSocket (works after paste) ---
  const WS = { socks: new WeakSet(), n: 0, prices: {}, sample: [], sym: "", orig: WebSocket.prototype.send };
  function attach(ws) { if (WS.socks.has(ws)) return; WS.socks.add(ws); ws.addEventListener("message", (e) => onMsg(e.data)); log("price feed connected"); }
  WebSocket.prototype.send = function (...a) { try { attach(this); } catch (e) {} return WS.orig.apply(this, a); };
  async function onMsg(d) {
    let t;
    try { t = typeof d === "string" ? d : d instanceof Blob ? await d.text() : d instanceof ArrayBuffer ? new TextDecoder().decode(d) : null; } catch (e) { return; }
    if (!t) return; WS.n++;
    if (WS.sample.length < 6 && t.length < 500) WS.sample.push(t.slice(0, 300));
    const i = t.search(/[\[{]/); if (i < 0) return;
    let j; try { j = JSON.parse(t.slice(i)); } catch (e) { return; }
    walk(j);
  }
  function walk(n) {
    if (!n || typeof n !== "object") return;
    if (!Array.isArray(n)) { Object.values(n).forEach(walk); return; }
    if (n.length >= 3 && typeof n[0] === "string" && typeof n[1] === "number" && typeof n[2] === "number" && n[1] > 1e9 && n[1] < 4e9 && n[2] > 0) {
      const o = WS.prices[n[0]]; WS.prices[n[0]] = { p: n[2], t: Date.now(), c: (o ? o.c : 0) + 1 }; return;
    }
    n.forEach(walk);
  }
  function pickSym() {
    if (WS.sym && WS.prices[WS.sym]) return WS.sym;
    let best = null; for (const k in WS.prices) { const v = WS.prices[k]; if (Date.now() - v.t < 5000 && (!best || v.c > WS.prices[best].c)) best = k; } return best;
  }
  function readPrice() {
    const k = pickSym(); if (k && Date.now() - WS.prices[k].t < 5000) return WS.prices[k].p;
    return readDom();
  }
  function path(el) { const p = []; while (el && el.nodeType === 1 && el !== document.body) {
    if (el.id) { p.unshift("#" + CSS.escape(el.id)); break; }
    let s = el.tagName.toLowerCase(), par = el.parentElement;
    if (par) { const sib = [...par.children].filter((c) => c.tagName === el.tagName); if (sib.length > 1) s += ":nth-of-type(" + (sib.indexOf(el) + 1) + ")"; }
    p.unshift(s); el = par; } return p.join(" > "); }
  function detect() { return new Promise((res) => {
    const rx = /^\d{1,6}[.,]\d{2,6}$/;
    const leaves = () => [...document.querySelectorAll("body *")].filter((e) => !e.children.length && e.offsetParent && rx.test(e.textContent.trim()));
    const before = new Map(leaves().map((e) => [e, e.textContent.trim()]));
    setStatus("finding price...");
    setTimeout(() => {
      const ch = [...before].filter(([e, t]) => document.contains(e) && e.textContent.trim() !== t).map(([e]) => e);
      if (!ch.length) return res(false);
      ch.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height);
      CFG.priceSelector = path(ch[0]); res(true);
    }, 6000); }); }

  // ---------- indicators ----------
  function ema(v, p) { if (v.length < p) return null; const k = 2 / (p + 1);
    let e = v.slice(0, p).reduce((a, b) => a + b, 0) / p; for (let i = p; i < v.length; i++) e = v[i] * k + e * (1 - k); return e; }
  function rsi(v, p) { if (v.length < p + 1) return null; let g = 0, l = 0;
    for (let i = v.length - p; i < v.length; i++) { const d = v[i] - v[i - 1]; d >= 0 ? (g += d) : (l -= d); }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l); }

  function candle(price) {
    const b = Math.floor(Date.now() / (CFG.candleSec * 1000));
    if (!S.cur || S.cur.b !== b) {
      if (S.cur) { S.closes.push(S.cur.c); if (S.closes.length > 300) S.closes.shift(); analyse(); }
      S.cur = { b, c: price };
    } else S.cur.c = price;
  }

  function analyse() {
    const v = S.closes, n = v.length, need = CFG.emaTrend + 2;
    const f = ema(v, CFG.emaFast), sl = ema(v, CFG.emaSlow), t = ema(v, CFG.emaTrend), r = rsi(v, CFG.rsiPeriod);
    if (n < need || f == null || sl == null || t == null || r == null) { setStatus("learning " + n + "/" + need + " candles"); return; }
    const last = v[n - 1];
    // flat-market filter: skip when recent range is tiny vs longer range
    const rng = (a) => Math.max(...a) - Math.min(...a);
    const calm = rng(v.slice(-30)) > 0 && rng(v.slice(-8)) / rng(v.slice(-30)) < 0.2;
    // fresh cross within last 3 candles
    const pf = ema(v.slice(0, -3), CFG.emaFast), ps = ema(v.slice(0, -3), CFG.emaSlow);
    const crossUp = pf != null && pf <= ps && f > sl, crossDn = pf != null && pf >= ps && f < sl;
    const net3 = last - v[n - 4], c1 = last - v[n - 2];
    let up = 0, dn = 0;
    if (f > sl) up++; else dn++;
    if (last > t) up++; else dn++;
    if (r > 45 && r < CFG.rsiHigh) up++;
    if (r < 55 && r > CFG.rsiLow) dn++;
    if (net3 > 0) up++; if (net3 < 0) dn++;
    if (c1 > 0) up++; if (c1 < 0) dn++;
    if (crossUp) up += 2; if (crossDn) dn += 2;
    const best = Math.max(up, dn), sig = calm ? null : best >= CFG.minScore ? (up > dn ? "UP" : "DOWN") : null;
    setStatus(calm ? "flat market, waiting" : sig ? "signal " + sig + " (" + best + "/7)" : "scanning " + up + "↑ " + dn + "↓ RSI " + r.toFixed(0));
    if (sig) trade(sig);
  }

  function block() {
    if (S.trades >= CFG.maxTrades) return "max trades";
    if (S.consec >= CFG.maxConsecLoss) return "loss streak limit";
    if (S.losses >= CFG.maxLoss) return "loss limit";
    if (Date.now() - S.lastAt < CFG.cooldownSec * 1000) return "cooldown";
    return null;
  }

  function trade(side) {
    const b = block();
    if (b) { setStatus("skipped: " + b); if (b !== "cooldown") stop(); return; }
    const entry = S.price;
    if (CFG.live) {
      const btn = document.querySelector(side === "UP" ? CFG.upSel : CFG.downSel);
      if (!btn) { setStatus("trade button not found"); return; }
      btn.click();
    }
    S.lastAt = Date.now(); S.trades++;
    log((CFG.live ? "LIVE " : "DRY ") + side + " @ " + entry);
    setStatus((CFG.live ? "LIVE " : "DRY ") + side + " placed");
    setTimeout(() => {
      const x = S.price;
      if (x == null || entry == null || x === entry) return toast("TIE", "#aaa");
      const win = side === "UP" ? x > entry : x < entry;
      if (win) { S.wins++; S.consec = 0; } else { S.losses++; S.consec++; }
      toast(win ? "WIN" : "LOSS", win ? "#00ff66" : "#ff4d4d"); renderStats();
    }, CFG.expirySec * 1000);
  }

  // ---------- UI ----------
  const css = document.createElement("style");
  css.textContent = `
  #qxs-w{position:fixed;left:16px;top:50%;transform:translateY(-50%);z-index:2147483646;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:grab;touch-action:none;user-select:none;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5));transition:filter .25s;font-family:system-ui,sans-serif}
  #qxs-w.on{filter:drop-shadow(0 0 12px #00ff66) drop-shadow(0 0 28px #00ff66)}
  #qxs-logo{width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,#0d3b1f,#06130b);border:2px solid #00ff66;display:flex;align-items:center;justify-content:center;color:#00ff66;font-weight:800;font-size:15px;letter-spacing:.05em}
  #qxs-stat{color:#fff;font-size:11px;font-weight:700;text-shadow:0 1px 4px #000;text-align:center}
  #qxs-msg{color:#9fd4ad;font-size:10px;max-width:120px;text-align:center;text-shadow:0 1px 3px #000}
  #qxs-scan{position:fixed;inset:0;z-index:2147483645;pointer-events:none;overflow:hidden;display:none}
  #qxs-scan.on{display:block}
  #qxs-line{position:absolute;left:0;width:100%;height:4px;top:-8%;background:linear-gradient(180deg,#3ad67f,#009e4a);box-shadow:0 -60px 100px rgba(0,220,115,.9),0 -25px 45px rgba(0,170,85,.9),0 0 25px rgba(0,150,75,.8);animation:qxs-m 1.45s linear infinite}
  @keyframes qxs-m{0%{top:-8%}100%{top:108%}}
  #qxs-toast{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:2147483647;font:800 44px system-ui;letter-spacing:.1em;text-shadow:0 0 20px currentColor;display:none;pointer-events:none}
  #qxs-bd{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.5);display:none}
  #qxs-p{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;width:min(300px,calc(100vw - 32px));padding:16px;border-radius:14px;background:linear-gradient(160deg,#0d1f14,#0a0f0c);border:1px solid rgba(0,255,102,.35);color:#e8ffe8;font-family:system-ui,sans-serif;display:none}
  #qxs-p h3{margin:0 0 12px;text-align:center;color:#00ff66;font-size:16px}
  #qxs-p label{display:block;font-size:12px;color:#9fd4ad;margin:10px 0 4px}
  #qxs-p input[type=number]{box-sizing:border-box;width:100%;padding:9px;border-radius:8px;border:1px solid rgba(0,255,102,.3);background:rgba(0,0,0,.35);color:#fff;font-size:14px}
  #qxs-p button{width:100%;margin-top:8px;padding:11px;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer}
  #qxs-mode{background:#1f6f3a;color:#fff}#qxs-mode.live{background:#c0392b}
  #qxs-save{background:#00ff66;color:#052210}
  #qxs-rst{background:#222;color:#ccc}`;
  document.head.appendChild(css);

  const scan = document.createElement("div"); scan.id = "qxs-scan"; scan.innerHTML = '<div id="qxs-line"></div>';
  const tst = document.createElement("div"); tst.id = "qxs-toast";
  const bd = document.createElement("div"); bd.id = "qxs-bd";
  const pan = document.createElement("div"); pan.id = "qxs-p";
  pan.innerHTML = `<h3>Settings</h3>
    <button id="qxs-mode">DRY RUN (no real trades)</button>
    <label>Price feed asset</label><select id="qxs-sym" style="width:100%;padding:9px;border-radius:8px;background:#000;color:#fff;border:1px solid rgba(0,255,102,.3)"></select>
    <label>Expiry seconds (match platform)</label><input id="qxs-exp" type="number" min="5" max="3600">
    <label>Max losses in a row</label><input id="qxs-cl" type="number" min="1" max="20">
    <label>Max total losses</label><input id="qxs-ml" type="number" min="1" max="50">
    <button id="qxs-save">Save</button><button id="qxs-rst">Reset stats</button>`;
  const w = document.createElement("div"); w.id = "qxs-w";
  w.innerHTML = '<div id="qxs-logo">QX</div><div id="qxs-stat"></div><div id="qxs-msg"></div>';
  [scan, tst, bd, pan, w].forEach((e) => document.body.appendChild(e));
  const $ = (id) => document.getElementById(id);

  function renderStats() { const t = S.wins + S.losses;
    $("qxs-stat").innerHTML = `${CFG.live ? '<span style="color:#ff6b6b">LIVE</span>' : "DRY"} · W ${S.wins} · L ${S.losses}` + (t ? ` · ${((S.wins / t) * 100).toFixed(0)}%` : ""); }
  function setStatus(m) { S.status = m; $("qxs-msg").textContent = m; }
  function toast(m, c) { tst.textContent = m; tst.style.color = c; tst.style.display = "block"; setTimeout(() => (tst.style.display = "none"), 2500); }

  function syncPanel() { const m = $("qxs-mode"); m.textContent = CFG.live ? "LIVE — REAL TRADES" : "DRY RUN (no real trades)";
    m.className = CFG.live ? "live" : ""; const sy = $("qxs-sym"); sy.innerHTML = '<option value="">auto</option>' + Object.keys(WS.prices).map((k) => `<option ${k === WS.sym ? "selected" : ""}>${k}</option>`).join("");
    $("qxs-exp").value = CFG.expirySec; $("qxs-cl").value = CFG.maxConsecLoss; $("qxs-ml").value = CFG.maxLoss; }
  const openP = () => { syncPanel(); bd.style.display = pan.style.display = "block"; };
  const closeP = () => { bd.style.display = pan.style.display = "none"; };
  bd.onclick = closeP;
  $("qxs-mode").onclick = () => {
    if (!CFG.live && !confirm("Switch to LIVE? The bot will click real UP/DOWN trades. Use a DEMO account first.")) return;
    CFG.live = !CFG.live; syncPanel(); renderStats(); };
  $("qxs-save").onclick = () => {
    WS.sym = $("qxs-sym").value; S.closes = []; S.cur = null; CFG.expirySec = Math.max(5, +$("qxs-exp").value || 60); CFG.maxConsecLoss = Math.max(1, +$("qxs-cl").value || 3);
    CFG.maxLoss = Math.max(1, +$("qxs-ml").value || 5); closeP(); renderStats(); };
  $("qxs-rst").onclick = () => { S.wins = S.losses = S.trades = S.consec = 0; renderStats(); };
  pan.addEventListener("mousedown", (e) => e.stopPropagation());
  pan.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });

  // ---------- run control ----------
  function tick() { const p = readPrice(); if (p == null) return; S.price = p; candle(p); }
  async function start() {
    if (S.on) return; S.on = true; w.classList.add("on"); setStatus("connecting to price feed...");
    for (let i = 0; i < 70 && S.on && readPrice() == null; i++) {
      if (i === 20) setStatus("change asset once to connect feed");
      await sleep(500);
    }
    if (S.on && readPrice() == null && !(await detect())) {
      S.on = false; w.classList.remove("on");
      setStatus("no price. QXS.debug()"); log("No price. msgs:", WS.n, "symbols:", Object.keys(WS.prices)); return;
    }
    if (!S.on) return;
    scan.classList.add("on"); setStatus("scanning..."); S.timer = setInterval(tick, 500);
  }
  function stop() { S.on = false; clearInterval(S.timer); w.classList.remove("on"); scan.classList.remove("on"); setStatus("stopped"); }

  // ---------- tap / drag ----------
  let taps = 0, last = 0, settle = null, drag = false, moved = false, sx, sy, sl, st;
  function tap() {
    if (pan.style.display === "block") return;
    const n = Date.now(); if (n - last > 650) taps = 0; last = n; taps++; clearTimeout(settle);
    if (taps >= 3) { taps = 0; openP(); return; }
    settle = setTimeout(() => { if (taps === 1) S.on ? stop() : start(); taps = 0; }, 380);
  }
  function down(x, y) { drag = true; moved = false; const r = w.getBoundingClientRect(); sx = x; sy = y; sl = r.left; st = r.top; w.style.transform = "none"; w.style.left = sl + "px"; w.style.top = st + "px"; }
  function move(x, y) { if (!drag) return; if (Math.abs(x - sx) > 8 || Math.abs(y - sy) > 8) moved = true;
    const r = w.getBoundingClientRect(); w.style.left = Math.max(0, Math.min(sl + x - sx, innerWidth - r.width)) + "px"; w.style.top = Math.max(0, Math.min(st + y - sy, innerHeight - r.height)) + "px"; }
  function up() { if (!drag) return; drag = false; if (!moved) tap(); }
  w.addEventListener("mousedown", (e) => { e.preventDefault(); down(e.clientX, e.clientY); });
  w.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) return; e.preventDefault(); down(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  document.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
  document.addEventListener("touchmove", (e) => { if (drag && e.touches.length === 1) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
  document.addEventListener("mouseup", up); document.addEventListener("touchend", up); document.addEventListener("touchcancel", up);

  window.QXS = { start, stop, config: CFG, state: S, debug() { console.log("msgs:", WS.n, "symbols:", WS.prices, "samples:", WS.sample); },
    remove() { stop(); WebSocket.prototype.send = WS.orig; [scan, tst, bd, pan, w, css].forEach((e) => e.remove()); delete window.QXS; log("removed"); } };

  renderStats(); setStatus("tap icon to start");
  log("Loaded in DRY mode. Tap the QX icon to scan. 3 taps = settings.");
})();
