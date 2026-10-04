/**
 * QX Scanner v2 — console script. Paste into DevTools Console (F12) on Quotex.
 * DEMO ACCOUNT FIRST. Starts in DRY mode (no real clicks).
 *
 * 1 tap icon  = start / stop scan
 * 3 taps icon = settings (DRY/LIVE, expiry, candle size, limits)
 * Drag icon to move. Console: QXS.remove()
 *
 * Strategy: NONE. RANDOM only. At the end of each candle, with chance randomChance, it picks UP or DOWN by coin flip.
 * 60s candles / 60s expiry by default. RECOVERY: after a loss the next trade uses stake x2 (max 5 steps), win resets.
 * No stop limits: runs until you stop it. WIN/LOSS are measured from the real price feed of the SAME asset at expiry.
 * Random trades have no edge: at ~85% payout you lose a little on every trade on average.
 */
(function () {
  if (window.QXS) { console.warn("Already running. QXS.remove() first."); return; }

  const CFG = {
    candleSec: 60, // 1-minute candles: signals are checked at each minute close, trade runs the next minute
    expirySec: 60, cooldownSec: 5, payout: 0.85, maxStaleMs: 3000,
    // Recovery (martingale): after a LOSS the next signal uses stake x recMult, up to recSteps steps, then resets
    baseStake: 1, recovery: true, recMult: 2, recSteps: 5, stopOnBust: false,
    amountSel: "", // CSS selector of the Quotex amount box (run QXS.findAmount() to find it); empty = auto-detect
    randomChance: 1, // chance of placing a random UP/DOWN trade at each candle close (1 = every candle)
    live: false,
    upSel: "#trade-button button.JQZcs",
    downSel: "#trade-button button.twQq3",
    priceSelector: "",
  };
  const log = (...a) => console.log("[QXS]", ...a);
  const S = { on: false, timer: null, bucket: null, price: null, sym: null, pending: false,
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


  // ---------- random decision clock ----------
  function resetData() { S.bucket = null; }
  function candle() {
    const b = Math.floor(Date.now() / (CFG.candleSec * 1000));
    if (S.bucket === null) { S.bucket = b; analyse(); return; } // decide right away on start, then once per candle
    if (b !== S.bucket) { S.bucket = b; analyse(); }
  }
  function analyse() {
    const sig = Math.random() < CFG.randomChance ? (Math.random() < 0.5 ? "UP" : "DOWN") : null;
    setStatus(sig ? "random " + sig : "random: no trade this candle");
    if (sig) trade(sig);
  }

  function block() {
    if (S.pending) return "trade open";
    if (Date.now() - S.lastAt < CFG.cooldownSec * 1000) return "cooldown";
    return null;
  }

  const hms = (t) => { const d = new Date(t); return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0"); };
  S.hist = []; S.step = 0; S.busts = 0; S.queued = null;
  const stakeNow = () => CFG.recovery ? Math.round(CFG.baseStake * Math.pow(CFG.recMult, S.step) * 100) / 100 : CFG.baseStake;
  function findAmountEl() {
    for (const sel of CFG.amountSel ? [CFG.amountSel] : [".section-deal__investment input", "input[class*='investment']", "input[class*='amount']"]) {
      const el = document.querySelector(sel); if (el) return el; }
    if (CFG.amountSel) return null;
    // auto-detect: climb up from the UP button and take the first visible money-like input (e.g. "$1", "10") that is not a time like 00:01:00
    let node = findBtn("UP");
    for (let k = 0; node && k < 10; k++, node = node.parentElement) {
      const hit = [...node.querySelectorAll("input")].find((el) => el.offsetParent !== null && !/^(checkbox|radio|hidden|range|submit|button)$/i.test(el.type) && !String(el.value).includes(":") && /^[^0-9]*\d+([.,]\d+)?[^0-9]*$/.test(String(el.value).trim()));
      if (hit) return hit;
    }
    return null; }
  function setStake(amount) {
    const el = findAmountEl(); if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    el.focus(); setter.call(el, String(amount));
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); el.blur();
    return Math.abs(parseFloat(String(el.value).replace(/[^0-9.]/g, "")) - amount) < 0.001; // verify the site really took it
  }
  function runQueued() {
    const q = S.queued; S.queued = null;
    if (q && S.on && Date.now() - q.at < 4000) trade(q.side); // a signal that arrived while the last trade was finishing
  }
  function findBtn(side) {
    let el = document.querySelector(side === "UP" ? CFG.upSel : CFG.downSel); if (el) return el;
    const words = side === "UP" ? ["up", "higher", "call", "buy", "rise"] : ["down", "lower", "put", "sell", "fall"];
    const vis = [...document.querySelectorAll("button, [role=button], a[class*=btn], div[class*=btn]")].filter((e) => e.offsetParent !== null);
    el = vis.find((e) => { const t = (e.innerText || e.textContent || "").trim().toLowerCase(); return t.length > 0 && t.length <= 16 && words.includes(t.split(/\s+/)[0]); });
    if (el) return el;
    const two = [...document.querySelectorAll("#trade-button button")]; // last resort: first = UP, second = DOWN
    return two.length >= 2 ? two[side === "UP" ? 0 : 1] : null; }
  function trade(side) {
    const b = block();
    if (b === "trade open") { S.queued = { side, at: Date.now() }; setStatus("waiting for open trade result"); return; }
    if (b) { setStatus("skipped: " + b); return; }
    const sym = S.lock || pickSym();
    if (readPrice(sym) == null) { setStatus("no fresh price, skipped"); return; }
    let stake = stakeNow();
    S.pending = true; S.lastAt = Date.now();
    const place = () => {
      if (CFG.live) {
        const btn = findBtn(side);
        if (!btn) { S.pending = false; setStatus("trade button not found: QXS.buttons()"); log("UP/DOWN button not found. Run QXS.buttons() and send me the table."); return; }
        btn.click();
      }
      const t0 = Date.now(), entry = readPrice(sym); // entry price read right after the click
      S.lastAt = t0; S.trades++;
      const rec = { n: S.trades, side, asset: sym, stake, step: S.step + 1, entryAt: hms(t0), entry, expiry: CFG.expirySec + "s" };
      S.hist.push(rec);
      log((CFG.live ? "LIVE " : "DRY ") + "#" + rec.n + " step " + rec.step + " stake " + stake + " " + side + " " + sym + " @ " + entry + " time " + rec.entryAt);
      setStatus((CFG.live ? "LIVE " : "DRY ") + side + " stake " + stake + " (step " + rec.step + ")"); renderStats();
      setTimeout(() => {
        S.pending = false;
        try {
          const t1 = Date.now(), x = readPrice(sym); // same asset, must be fresh
          rec.exitAt = hms(t1); rec.exit = x;
          if (x == null || entry == null) { S.voids++; rec.result = "NO DATA"; renderStats(); return toast("NO DATA", "#aaa"); }
          if (x === entry) { S.ties++; rec.result = "TIE"; renderStats(); return toast("TIE", "#aaa"); } // stake refunded, step unchanged
          const win = side === "UP" ? x > entry : x < entry;
          if (win) { S.wins++; S.consec = 0; S.pnl += stake * CFG.payout; S.step = 0; }
          else {
            S.losses++; S.consec++; S.pnl -= stake;
            if (CFG.recovery && ++S.step >= CFG.recSteps) { S.busts++; S.step = 0; log("RECOVERY BUST after " + CFG.recSteps + " steps"); if (CFG.stopOnBust) stop(); }
          }
          rec.result = win ? "WIN" : "LOSS";
          log("#" + rec.n + " " + rec.result + " " + side + " " + entry + " -> " + x + " exit " + rec.exitAt);
          toast(win ? "WIN" : "LOSS", win ? "#00ff66" : "#ff4d4d"); renderStats();
        } finally { runQueued(); }
      }, CFG.expirySec * 1000);
    };
    if (CFG.live) {
      if (CFG.recovery && !setStake(stake)) { // cannot control the amount box: turn recovery off and trade at the stake Quotex shows
        CFG.recovery = false; const el = findAmountEl(); stake = (el && parseFloat(String(el.value).replace(/[^0-9.]/g, ""))) || CFG.baseStake;
        log("Could not set the amount box, so recovery is OFF. Trading at the stake shown on Quotex (" + stake + "). Run QXS.findAmount() to fix."); }
      setTimeout(place, 200); // let the site register the new amount before clicking
    } else place();
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
    <label>Decision every N seconds (2 - 60)</label><input id="qxs-cs" type="number" min="2" max="60">
    <label>Base stake (first trade)</label><input id="qxs-stake" type="number" min="0.01" step="any">
    <button id="qxs-save">Save</button><button id="qxs-rst">Reset stats</button>`;
  const w = document.createElement("div"); w.id = "qxs-w";
  w.innerHTML = '<div id="qxs-logo">QX</div><div id="qxs-stat"></div><div id="qxs-msg"></div>';
  [scan, tst, bd, pan, w].forEach((e) => document.body.appendChild(e));
  const $ = (id) => document.getElementById(id);

  function renderStats() { const t = S.wins + S.losses;
    $("qxs-stat").innerHTML = `${CFG.live ? '<span style="color:#ff6b6b">LIVE</span>' : "DRY"} · W ${S.wins} · L ${S.losses}` + (t ? ` · ${((S.wins / t) * 100).toFixed(0)}%` : "") + ` · P/L ${S.pnl >= 0 ? "+" : ""}${S.pnl.toFixed(2)}` + (CFG.recovery ? ` · next ${stakeNow()} (step ${S.step + 1}/${CFG.recSteps}) · bust ${S.busts}` : ""); }
  function setStatus(m) { S.status = m; $("qxs-msg").textContent = m; }
  function toast(m, c) { tst.textContent = m; tst.style.color = c; tst.style.display = "block"; setTimeout(() => (tst.style.display = "none"), 2500); }

  function syncPanel() { const m = $("qxs-mode"); m.textContent = CFG.live ? "LIVE — REAL TRADES" : "DRY RUN (no real trades)";
    m.className = CFG.live ? "live" : ""; const sy = $("qxs-sym"); sy.innerHTML = '<option value="">auto</option>' + Object.keys(WS.prices).map((k) => `<option ${k === WS.sym ? "selected" : ""}>${k}</option>`).join("");
    $("qxs-exp").value = CFG.expirySec; $("qxs-cs").value = CFG.candleSec; $("qxs-stake").value = CFG.baseStake; }
  const openP = () => { syncPanel(); bd.style.display = pan.style.display = "block"; };
  const closeP = () => { bd.style.display = pan.style.display = "none"; };
  bd.onclick = closeP;
  $("qxs-mode").onclick = () => {
    if (!CFG.live && !confirm("Switch to LIVE? The bot will click real UP/DOWN trades. Use a DEMO account first.")) return;
    CFG.live = !CFG.live; syncPanel(); renderStats(); };
  $("qxs-save").onclick = () => {
    WS.sym = $("qxs-sym").value; S.lock = null; resetData(); CFG.candleSec = Math.min(60, Math.max(2, +$("qxs-cs").value || 5)); CFG.expirySec = Math.max(5, +$("qxs-exp").value || 60); CFG.baseStake = Math.max(0.01, +$("qxs-stake").value || 1); CFG.cooldownSec = Math.max(CFG.cooldownSec, CFG.expirySec);
    closeP(); renderStats(); };
  $("qxs-rst").onclick = () => { S.wins = S.losses = S.ties = S.voids = S.trades = S.consec = 0; S.pnl = 0; S.step = 0; S.busts = 0; renderStats(); };
  pan.addEventListener("mousedown", (e) => e.stopPropagation());
  pan.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });

  // ---------- run control ----------
  function tick() {
    if (!S.lock) { S.lock = pickSym(); if (S.lock) resetData(); } // lock one asset; never switch mid-run
    const p = readPrice(S.lock); if (p == null) return; S.price = p; candle(); }
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
  function stop() { S.on = false; S.lock = null; S.queued = null; clearInterval(S.timer); w.classList.remove("on"); scan.classList.remove("on"); setStatus("stopped"); }

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

  window.QXS = { start, stop, config: CFG, state: S, trades() { console.table(S.hist); },
    compare() { // overall win rate (WIN/LOSS only) vs break-even
      const d = S.hist.filter((r) => r.result === "WIN" || r.result === "LOSS"), w = d.filter((r) => r.result === "WIN").length;
      console.log("trades " + d.length + " wins " + w + " winRate " + (d.length ? (w / d.length * 100).toFixed(1) : 0) + "%"); return "break-even is about " + (100 / (1 + CFG.payout)).toFixed(1) + "%"; },
        check() { // why is it not trading? prints everything that can block a trade
      const r = { mode: CFG.live ? "LIVE" : "DRY (no real clicks!)", running: S.on, feed: S.lock || pickSym() || "none", price: S.price, upButtonFound: !!findBtn("UP"), downButtonFound: !!findBtn("DOWN"), amountBoxFound: !!findAmountEl(), recovery: CFG.recovery, decideEverySec: CFG.candleSec, tradeChance: CFG.randomChance, status: S.status };
      console.table(r); return r.status; },
    buttons() { console.table([...document.querySelectorAll("button, [role=button]")].filter((e) => e.offsetParent !== null).map((e, i) => ({ i, text: (e.innerText || "").trim().slice(0, 20), cls: e.className, id: e.id, parent: e.parentElement && (e.parentElement.id || e.parentElement.className) }))); },
    test(side) { if (!S.on) return "tap the QX icon to start first, then run QXS.test()"; trade(side === "DOWN" ? "DOWN" : "UP"); return S.status; },
    findAmount() { console.table([...document.querySelectorAll("input")].map((e, i) => ({ i, id: e.id, cls: e.className, value: e.value, parent: e.parentElement && e.parentElement.className }))); },
    debug() { console.log("msgs:", WS.n, "symbols:", WS.prices, "samples:", WS.sample); },
    remove() { stop(); WebSocket.prototype.send = WS.orig; [scan, tst, bd, pan, w, css].forEach((e) => e.remove()); delete window.QXS; log("removed"); } };

  renderStats(); setStatus("tap icon to start");
  log("Loaded in DRY mode. Tap the QX icon to scan. 3 taps = settings.");
})();

