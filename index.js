/**
 * QX Scanner v2 — console script. Paste into DevTools Console (F12) on Quotex.
 * DEMO ACCOUNT FIRST. Starts in DRY mode (no real clicks).
 *
 * 1 tap icon  = start / stop scan
 * 3 taps icon = settings (DRY/LIVE, expiry, candle size, limits)
 * Drag icon to move. Console: QXS.remove()
 *
 * Strategy: HIGH / LOW only. Tracks the recent high and low (last 12 candles of 5s = 1 minute).
 * bounce mode: price touches the LOW and turns up -> UP; touches the HIGH and turns down -> DOWN.
 * breakout mode: close above the HIGH -> UP; close below the LOW -> DOWN.
 * WIN/LOSS are measured from the real price feed of the SAME asset at expiry.
 * No strategy is guaranteed to win.
 */
(function () {
  if (window.QXS) { console.warn("Already running. QXS.remove() first."); return; }

  const CFG = {
    candleSec: 5,
    hlMode: "bounce", // "bounce" = reverse at recent high/low, "breakout" = follow a break of it
    hlLookback: 12, hlZone: 0.2, minRangeMoves: 3, hlMinTouches: 2, hlMaxDrift: 0.6,
    expirySec: 60, cooldownSec: 5, payout: 0.85, maxStaleMs: 3000,
    maxTrades: 10000, maxConsecLoss: 3, maxLoss: 500,
    live: false,
    upSel: "#trade-button button.JQZcs",
    downSel: "#trade-button button.twQq3",
    priceSelector: "",
  };
  const log = (...a) => console.log("[QXS]", ...a);
  const S = { on: false, timer: null, closes: [], cur: null, price: null, sym: null, pending: false,
    wins: 0, losses: 0, ties: 0, voids: 0, trades: 0, consec: 0, pnl: 0, lastAt: 0, status: "idle" };

  
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
    let best = null; for (const k in WS.prices) { const v = WS.prices[k]; if (Date.now() - v.t < CFG.maxStaleMs && (!best || v.c > WS.prices[best].c)) best = k; } return best;
  }
  function readPrice(sym) {
    const k = sym || pickSym();
    if (k && WS.prices[k]) return Date.now() - WS.prices[k].t < CFG.maxStaleMs ? WS.prices[k].p : null;
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


  // ---------- indicators (full series) ----------
  function emaSeries(v, p) { const o = new Array(v.length).fill(null); if (v.length < p) return o;
    const k = 2 / (p + 1); let e = v.slice(0, p).reduce((a, b) => a + b, 0) / p; o[p - 1] = e;
    for (let i = p; i < v.length; i++) { e = v[i] * k + e * (1 - k); o[i] = e; } return o; }
  function rsiSeries(v, p) { const o = new Array(v.length).fill(null); if (v.length < p + 1) return o;
    let g = 0, l = 0;
    for (let i = 1; i <= p; i++) { const d = v[i] - v[i - 1]; d >= 0 ? (g += d) : (l -= d); }
    g /= p; l /= p; o[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = p + 1; i < v.length; i++) { const d = v[i] - v[i - 1];
      g = (g * (p - 1) + (d > 0 ? d : 0)) / p; l = (l * (p - 1) + (d < 0 ? -d : 0)) / p;
      o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    return o; }

  function resetData() { S.closes = []; S.cur = null; }

  function candle(price) {
    const b = Math.floor(Date.now() / (CFG.candleSec * 1000));
    if (!S.cur || S.cur.b !== b) {
      if (S.cur) { S.closes.push(S.cur.c); if (S.closes.length > 300) S.closes.shift(); analyse(); }
      S.cur = { b, c: price };
    } else S.cur.c = price;
  }

  function analyse() {
    const v = S.closes, n = v.length, L = CFG.hlLookback, need = L + 3;
    if (n < need) { setStatus("learning " + n + "/" + need + " candles"); return; }
    const i = n - 1, win = v.slice(n - 2 - L, n - 2); // recent window, excludes the last 2 candles
    const hi = Math.max(...win), lo = Math.min(...win), rng = hi - lo, mid = (hi + lo) / 2;
    let mv = 0; for (let j = n - 20; j < n; j++) mv += Math.abs(v[j] - v[j - 1]); mv /= 20;
    if (!(rng > 0) || rng < mv * CFG.minRangeMoves) { setStatus("range too small, waiting"); return; }
    const z = CFG.hlZone * rng;
    const lowest = Math.min(v[i - 1], v[i - 2]), highest = Math.max(v[i - 1], v[i - 2]);
    let sig = null;
    // count separate touches of a level (consecutive candles in the zone = one touch)
    const touches = (test) => { let c = 0, inZ = false; for (const x of win) { const t = test(x); if (t && !inZ) c++; inZ = t; } return c; };
    const drift = Math.abs(win[win.length - 1] - win[0]) / rng; // low = ranging, high = trending (bounce unsafe)
    if (CFG.hlMode === "bounce") {
      if (drift <= CFG.hlMaxDrift) {
        // UP: tested LOW at least N times, bottomed 2 candles ago, then two rising candles, still in lower part of the range
        if (touches((x) => x <= lo + z) >= CFG.hlMinTouches && v[i - 2] <= lo + z && v[i - 1] > v[i - 2] && v[i] > v[i - 1] && v[i] <= lo + 0.4 * rng) sig = "UP";
        // DOWN: tested HIGH at least N times, topped 2 candles ago, then two falling candles, still in upper part of the range
        if (touches((x) => x >= hi - z) >= CFG.hlMinTouches && v[i - 2] >= hi - z && v[i - 1] < v[i - 2] && v[i] < v[i - 1] && v[i] >= hi - 0.4 * rng) sig = "DOWN";
      }
    } else {
      // breakout: two closes beyond the recent HIGH / LOW, moving the same way
      if (v[i - 1] > hi && v[i] > v[i - 1]) sig = "UP";
      if (v[i - 1] < lo && v[i] < v[i - 1]) sig = "DOWN";
    }
    setStatus(sig ? "signal " + sig : "waiting high/low  H " + hi + " L " + lo);
    if (sig) trade(sig);
  }

  function block() {
    if (S.pending) return "trade open";
    if (S.trades >= CFG.maxTrades) return "max trades";
    if (S.consec >= CFG.maxConsecLoss) return "loss streak limit";
    if (S.losses >= CFG.maxLoss) return "loss limit";
    if (Date.now() - S.lastAt < CFG.cooldownSec * 1000) return "cooldown";
    return null;
  }

  function trade(side) {
    const b = block();
    if (b) { setStatus("skipped: " + b); if (b !== "cooldown" && b !== "trade open") stop(); return; }
    const sym = pickSym(), entry = readPrice(sym);
    if (entry == null) { setStatus("no fresh price, skipped"); return; }
    if (CFG.live) {
      const btn = document.querySelector(side === "UP" ? CFG.upSel : CFG.downSel);
      if (!btn) { setStatus("trade button not found"); return; }
      btn.click();
    }
    S.lastAt = Date.now(); S.trades++; S.pending = true;
    log((CFG.live ? "LIVE " : "DRY ") + side + " " + sym + " @ " + entry);
    setStatus((CFG.live ? "LIVE " : "DRY ") + side + " placed");
    setTimeout(() => {
      S.pending = false;
      const x = readPrice(sym); // same asset, must be fresh
      if (x == null || entry == null) { S.voids++; renderStats(); return toast("NO DATA", "#aaa"); }
      if (x === entry) { S.ties++; renderStats(); return toast("TIE", "#aaa"); }
      const win = side === "UP" ? x > entry : x < entry;
      if (win) { S.wins++; S.consec = 0; S.pnl += CFG.payout; } else { S.losses++; S.consec++; S.pnl -= 1; }
      log((win ? "WIN " : "LOSS ") + side + " " + entry + " -> " + x);
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
    <label>Candle seconds (5 - 60)</label><input id="qxs-cs" type="number" min="5" max="60">
    <label>Max losses in a row</label><input id="qxs-cl" type="number" min="1" max="20">
    <label>Max total losses</label><input id="qxs-ml" type="number" min="1" max="500">
    <button id="qxs-save">Save</button><button id="qxs-rst">Reset stats</button>`;
  const w = document.createElement("div"); w.id = "qxs-w";
  w.innerHTML = '<div id="qxs-logo">QX</div><div id="qxs-stat"></div><div id="qxs-msg"></div>';
  [scan, tst, bd, pan, w].forEach((e) => document.body.appendChild(e));
  const $ = (id) => document.getElementById(id);

  function renderStats() { const t = S.wins + S.losses;
    $("qxs-stat").innerHTML = `${CFG.live ? '<span style="color:#ff6b6b">LIVE</span>' : "DRY"} · W ${S.wins} · L ${S.losses}` + (t ? ` · ${((S.wins / t) * 100).toFixed(0)}%` : "") + ` · P/L ${S.pnl >= 0 ? "+" : ""}${S.pnl.toFixed(2)}u`; }
  function setStatus(m) { S.status = m; $("qxs-msg").textContent = m; }
  function toast(m, c) { tst.textContent = m; tst.style.color = c; tst.style.display = "block"; setTimeout(() => (tst.style.display = "none"), 2500); }

  function syncPanel() { const m = $("qxs-mode"); m.textContent = CFG.live ? "LIVE — REAL TRADES" : "DRY RUN (no real trades)";
    m.className = CFG.live ? "live" : ""; const sy = $("qxs-sym"); sy.innerHTML = '<option value="">auto</option>' + Object.keys(WS.prices).map((k) => `<option ${k === WS.sym ? "selected" : ""}>${k}</option>`).join("");
    $("qxs-exp").value = CFG.expirySec; $("qxs-cs").value = CFG.candleSec; $("qxs-cl").value = CFG.maxConsecLoss; $("qxs-ml").value = CFG.maxLoss; }
  const openP = () => { syncPanel(); bd.style.display = pan.style.display = "block"; };
  const closeP = () => { bd.style.display = pan.style.display = "none"; };
  bd.onclick = closeP;
  $("qxs-mode").onclick = () => {
    if (!CFG.live && !confirm("Switch to LIVE? The bot will click real UP/DOWN trades. Use a DEMO account first.")) return;
    CFG.live = !CFG.live; syncPanel(); renderStats(); };
  $("qxs-save").onclick = () => {
    WS.sym = $("qxs-sym").value; resetData(); CFG.candleSec = Math.min(60, Math.max(5, +$("qxs-cs").value || 5)); CFG.expirySec = Math.max(5, +$("qxs-exp").value || 30); CFG.cooldownSec = Math.max(CFG.cooldownSec, CFG.expirySec); CFG.maxConsecLoss = Math.max(1, +$("qxs-cl").value || 3);
    CFG.maxLoss = Math.max(1, +$("qxs-ml").value || 500); closeP(); renderStats(); };
  $("qxs-rst").onclick = () => { S.wins = S.losses = S.ties = S.voids = S.trades = S.consec = 0; S.pnl = 0; renderStats(); };
  pan.addEventListener("mousedown", (e) => e.stopPropagation());
  pan.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });

  // ---------- run control ----------
  function tick() {
    const k = pickSym(); if (S.sym !== k) { if (S.sym) { resetData(); setStatus("asset changed, relearning"); } S.sym = k; }
    const p = readPrice(k); if (p == null) return; S.price = p; candle(p); }
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
    scan.classList.add("on"); setStatus("scanning..."); S.timer = setInterval(tick, 250);
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

