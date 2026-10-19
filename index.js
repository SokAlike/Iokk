/* ============================================================
   Signal Panel - paste into the browser console (F12 > Console)
   - Draggable UI panel (Shadow DOM, won't clash with the site)
   - Reads price from an element you pick with one click
   - Builds candles, runs EMA-cross or RSI signals
   - Sends signals to Telegram
   - Tracks daily P/L with stop-loss / take-profit
   - Settings saved in localStorage
   Signals only: it does NOT place trades.
   ============================================================ */
(() => {
  if (window.__sigPanel) { window.__sigPanel.destroy(); }

  const KEY = "sigPanel.settings.v1";
  const STATE_KEY = "sigPanel.state.v1";
  const DEF = {
    token: "", chatId: "", selector: "", mode: "ema",
    candleSec: 60, emaFast: 5, emaSlow: 13, rsiPeriod: 14,
    rsiHigh: 70, rsiLow: 30, cooldownCandles: 2, expiry: "1m",
    pair: "", stake: 10, payout: 80, stopLoss: 50, takeProfit: 50
  };
  const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || "{}") }; } catch { return { ...d }; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const S = load(KEY, DEF);
  const todayKey = () => new Date().toISOString().slice(0, 10);
  let ST = load(STATE_KEY, { date: todayKey(), pl: 0, wins: 0, losses: 0, halted: "" });
  if (ST.date !== todayKey()) ST = { date: todayKey(), pl: 0, wins: 0, losses: 0, halted: "" };

  let running = false, tickTimer = null, picking = false;
  let lastPrice = null, candleOpenAt = 0, candleClose = null;
  let closes = [], prevFast = null, prevSlow = null, sinceSignal = 99;

  // ---------- indicators ----------
  const ema = (arr, p) => {
    if (arr.length < p) return null;
    const k = 2 / (p + 1);
    let e = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
    return e;
  };
  const rsi = (arr, p) => {
    if (arr.length <= p) return null;
    let g = 0, l = 0;
    for (let i = 1; i <= p; i++) { const d = arr[i] - arr[i - 1]; d >= 0 ? g += d : l -= d; }
    g /= p; l /= p;
    for (let i = p + 1; i < arr.length; i++) {
      const d = arr[i] - arr[i - 1];
      g = (g * (p - 1) + Math.max(d, 0)) / p;
      l = (l * (p - 1) + Math.max(-d, 0)) / p;
    }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  };

  // ---------- UI ----------
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;top:60px;right:20px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
  <style>
    *{box-sizing:border-box;font-family:system-ui,Arial,sans-serif}
    .p{width:300px;background:#12161f;color:#e6e9ef;border:1px solid #2a3142;border-radius:10px;box-shadow:0 8px 30px #0008;font-size:12px}
    .h{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#1b2130;border-radius:10px 10px 0 0;cursor:move;user-select:none}
    .h b{font-size:13px}.h span{cursor:pointer;padding:0 6px;font-size:15px}
    .b{padding:10px;max-height:70vh;overflow:auto}
    .b.hide{display:none}
    label{display:block;margin:6px 0 2px;color:#9aa4b8}
    input,select{width:100%;padding:5px 6px;background:#0c0f16;color:#e6e9ef;border:1px solid #2a3142;border-radius:5px}
    .r{display:flex;gap:6px}.r>div{flex:1}
    button{padding:6px 8px;border:0;border-radius:5px;background:#2f6fed;color:#fff;cursor:pointer;font-weight:600}
    button.g{background:#1f9d55}button.d{background:#d64545}button.s{background:#3a4258}
    .row{display:flex;gap:6px;margin-top:8px}.row button{flex:1}
    .st{margin-top:8px;padding:6px;background:#0c0f16;border-radius:5px;line-height:1.5}
    .log{margin-top:8px;height:110px;overflow:auto;background:#0c0f16;border-radius:5px;padding:6px;font-family:monospace;font-size:11px;white-space:pre-wrap}
    h4{margin:10px 0 0;color:#7fa8ff;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
    .pos{color:#4cd48a}.neg{color:#ff6b6b}
  </style>
  <div class="p">
    <div class="h" id="drag"><b>Signal Panel</b><div><span id="min">–</span><span id="close">×</span></div></div>
    <div class="b" id="body">
      <div class="st" id="status"></div>
      <div class="row"><button id="start" class="g">Start</button><button id="stop" class="d">Stop</button></div>

      <h4>Price source</h4>
      <div class="row"><button id="pick" class="s">Pick price element</button></div>
      <label>CSS selector</label><input id="selector">
      <label>Pair name (shown in signal)</label><input id="pair" placeholder="EUR/USD">

      <h4>Strategy</h4>
      <div class="r">
        <div><label>Mode</label><select id="mode"><option value="ema">EMA cross + RSI filter</option><option value="rsi">RSI reversal</option></select></div>
        <div><label>Candle (sec)</label><input id="candleSec" type="number" min="5"></div>
      </div>
      <div class="r">
        <div><label>EMA fast</label><input id="emaFast" type="number"></div>
        <div><label>EMA slow</label><input id="emaSlow" type="number"></div>
        <div><label>RSI period</label><input id="rsiPeriod" type="number"></div>
      </div>
      <div class="r">
        <div><label>RSI high</label><input id="rsiHigh" type="number"></div>
        <div><label>RSI low</label><input id="rsiLow" type="number"></div>
        <div><label>Cooldown (candles)</label><input id="cooldownCandles" type="number"></div>
      </div>
      <label>Expiry label</label><input id="expiry" placeholder="1m">

      <h4>Telegram</h4>
      <label>Bot token</label><input id="token" type="password" placeholder="123456:ABC...">
      <label>Chat ID</label><input id="chatId" placeholder="e.g. 123456789 or -100...">
      <div class="row"><button id="tgTest" class="s">Send test message</button></div>

      <h4>Money management</h4>
      <div class="r">
        <div><label>Stake</label><input id="stake" type="number"></div>
        <div><label>Payout %</label><input id="payout" type="number"></div>
      </div>
      <div class="r">
        <div><label>Stop loss</label><input id="stopLoss" type="number"></div>
        <div><label>Take profit</label><input id="takeProfit" type="number"></div>
      </div>
      <div class="row"><button id="win" class="g">Record WIN</button><button id="loss" class="d">Record LOSS</button></div>
      <div class="row"><button id="resetDay" class="s">Reset today</button><button id="manual" class="s">Test signal</button></div>

      <div class="log" id="log"></div>
    </div>
  </div>`;
  document.documentElement.appendChild(host);
  const $ = (id) => root.getElementById(id);

  const fields = ["selector","pair","mode","candleSec","emaFast","emaSlow","rsiPeriod","rsiHigh","rsiLow","cooldownCandles","expiry","token","chatId","stake","payout","stopLoss","takeProfit"];
  const numeric = new Set(["candleSec","emaFast","emaSlow","rsiPeriod","rsiHigh","rsiLow","cooldownCandles","stake","payout","stopLoss","takeProfit"]);
  fields.forEach((f) => {
    $(f).value = S[f];
    $(f).addEventListener("change", () => {
      S[f] = numeric.has(f) ? Number($(f).value) : $(f).value.trim();
      save(KEY, S);
    });
  });

  function log(msg) {
    const t = new Date().toLocaleTimeString();
    const el = $("log");
    el.textContent += `[${t}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
  }

  function render() {
    const cls = ST.pl >= 0 ? "pos" : "neg";
    $("status").innerHTML =
      `State: <b>${running ? "RUNNING" : "STOPPED"}</b>${ST.halted ? ` <span class="neg">(${ST.halted})</span>` : ""}<br>` +
      `Price: <b>${lastPrice ?? "-"}</b> | Candles: ${closes.length}<br>` +
      `Today P/L: <b class="${cls}">${ST.pl.toFixed(2)}</b> | W ${ST.wins} / L ${ST.losses}`;
    save(STATE_KEY, ST);
  }

  // ---------- Telegram ----------
  async function sendTelegram(text) {
    if (!S.token || !S.chatId) { log("Telegram: set token and chat ID first"); return false; }
    try {
      const res = await fetch(`https://api.telegram.org/bot${S.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: S.chatId, text })
      });
      const data = await res.json();
      if (!data.ok) { log("Telegram error: " + (data.description || res.status)); return false; }
      return true;
    } catch (e) {
      log("Telegram blocked/failed: " + e.message + " (site CSP may block it; see notes)");
      return false;
    }
  }

  // ---------- price reading ----------
  function parsePrice(txt) {
    let t = String(txt).replace(/\s/g, "");
    if (t.includes(",") && !t.includes(".")) t = t.replace(",", ".");
    t = t.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  function readPrice() {
    if (!S.selector) return null;
    const el = document.querySelector(S.selector);
    return el ? parsePrice(el.textContent) : null;
  }

  function cssPath(el) {
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let part = el.tagName.toLowerCase();
      const cls = [...el.classList].filter((c) => !/\d{3,}/.test(c)).slice(0, 2);
      if (cls.length) part += "." + cls.map((c) => CSS.escape(c)).join(".");
      const sib = [...el.parentNode.children].filter((x) => x.tagName === el.tagName);
      if (sib.length > 1) part += `:nth-of-type(${sib.indexOf(el) + 1})`;
      parts.unshift(part);
      if (el.id) break;
      el = el.parentNode;
      if (parts.length >= 5) break;
    }
    return parts.join(" > ");
  }

  const onPickMove = (e) => { if (!picking || e.composedPath().includes(host)) return; e.target.style.outline = "2px solid #2f6fed"; };
  const onPickOut = (e) => { e.target.style.outline = ""; };
  const onPickClick = (e) => {
    if (!picking || e.composedPath().includes(host)) return;
    e.preventDefault(); e.stopPropagation();
    e.target.style.outline = "";
    picking = false;
    S.selector = cssPath(e.target);
    $("selector").value = S.selector;
    save(KEY, S);
    const v = readPrice();
    log(`Picked: ${S.selector}\nReads: ${v}`);
    $("pick").textContent = "Pick price element";
  };
  document.addEventListener("mouseover", onPickMove, true);
  document.addEventListener("mouseout", onPickOut, true);
  document.addEventListener("click", onPickClick, true);

  // ---------- signals ----------
  async function emit(direction, reason) {
    const pair = S.pair || "Pair";
    const msg = `${direction === "CALL" ? "🟢 CALL (UP)" : "🔴 PUT (DOWN)"}\n` +
      `Pair: ${pair}\nExpiry: ${S.expiry}\nPrice: ${lastPrice}\nReason: ${reason}\n` +
      `Time: ${new Date().toLocaleTimeString()}`;
    log(`SIGNAL ${direction} @ ${lastPrice} (${reason})`);
    sendTelegram(msg).then((ok) => ok && log("Sent to Telegram"));
  }

  function onCandleClosed(close) {
    closes.push(close);
    if (closes.length > 300) closes.shift();
    sinceSignal++;
    const f = ema(closes, S.emaFast), s = ema(closes, S.emaSlow), r = rsi(closes, S.rsiPeriod);

    if (ST.halted || sinceSignal <= S.cooldownCandles) { prevFast = f; prevSlow = s; return; }

    if (S.mode === "ema" && f != null && s != null && prevFast != null && prevSlow != null) {
      const up = prevFast <= prevSlow && f > s, down = prevFast >= prevSlow && f < s;
      if (up && (r == null || r < S.rsiHigh)) { emit("CALL", `EMA${S.emaFast}/${S.emaSlow} cross up, RSI ${r?.toFixed(1)}`); sinceSignal = 0; }
      else if (down && (r == null || r > S.rsiLow)) { emit("PUT", `EMA${S.emaFast}/${S.emaSlow} cross down, RSI ${r?.toFixed(1)}`); sinceSignal = 0; }
    } else if (S.mode === "rsi" && r != null) {
      if (r <= S.rsiLow) { emit("CALL", `RSI oversold ${r.toFixed(1)}`); sinceSignal = 0; }
      else if (r >= S.rsiHigh) { emit("PUT", `RSI overbought ${r.toFixed(1)}`); sinceSignal = 0; }
    }
    prevFast = f; prevSlow = s;
  }

  function tick() {
    if (ST.date !== todayKey()) {
      ST = { date: todayKey(), pl: 0, wins: 0, losses: 0, halted: "" };
      log("New day: P/L reset");
    }
    const p = readPrice();
    if (p == null) { render(); return; }
    lastPrice = p;
    const now = Date.now();
    if (!candleOpenAt) candleOpenAt = now;
    candleClose = p;
    if (now - candleOpenAt >= S.candleSec * 1000) {
      onCandleClosed(candleClose);
      candleOpenAt = now;
    }
    render();
  }

  // ---------- money management ----------
  function record(win) {
    const amt = win ? S.stake * (S.payout / 100) : -S.stake;
    ST.pl += amt; win ? ST.wins++ : ST.losses++;
    log(`${win ? "WIN" : "LOSS"} ${amt.toFixed(2)} | P/L ${ST.pl.toFixed(2)}`);
    if (S.stopLoss > 0 && ST.pl <= -S.stopLoss) halt("Stop loss hit");
    if (S.takeProfit > 0 && ST.pl >= S.takeProfit) halt("Take profit hit");
    render();
  }
  function halt(reason) {
    ST.halted = reason;
    log(reason + " - signals paused");
    sendTelegram(`⛔ ${reason}\nToday P/L: ${ST.pl.toFixed(2)} (W ${ST.wins} / L ${ST.losses})`);
  }

  // ---------- controls ----------
  $("start").onclick = () => {
    if (running) return;
    if (!readPrice()) { log("Can't read a price yet. Use 'Pick price element' first."); return; }
    running = true; candleOpenAt = 0; tickTimer = setInterval(tick, 1000);
    log("Started"); sendTelegram(`▶️ Signal bot started${S.pair ? " on " + S.pair : ""}`); render();
  };
  $("stop").onclick = () => {
    running = false; clearInterval(tickTimer); log("Stopped"); render();
  };
  $("pick").onclick = () => {
    picking = !picking;
    $("pick").textContent = picking ? "Click the price on the page…" : "Pick price element";
  };
  $("tgTest").onclick = async () => { log((await sendTelegram("✅ Test message from Signal Panel")) ? "Test sent" : "Test failed"); };
  $("win").onclick = () => record(true);
  $("loss").onclick = () => record(false);
  $("resetDay").onclick = () => { ST = { date: todayKey(), pl: 0, wins: 0, losses: 0, halted: "" }; log("Today reset"); render(); };
  $("manual").onclick = () => emit("CALL", "manual test");
  $("min").onclick = () => $("body").classList.toggle("hide");
  $("close").onclick = () => destroy();

  // drag
  (() => {
    const h = $("drag"); let ox = 0, oy = 0, drag = false;
    h.addEventListener("mousedown", (e) => { drag = true; const r = host.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; e.preventDefault(); });
    window.addEventListener("mousemove", (e) => { if (!drag) return; host.style.left = e.clientX - ox + "px"; host.style.top = e.clientY - oy + "px"; host.style.right = "auto"; });
    window.addEventListener("mouseup", () => (drag = false));
  })();

  function destroy() {
    clearInterval(tickTimer);
    document.removeEventListener("mouseover", onPickMove, true);
    document.removeEventListener("mouseout", onPickOut, true);
    document.removeEventListener("click", onPickClick, true);
    host.remove();
    delete window.__sigPanel;
  }
  window.__sigPanel = { destroy };

  log("Ready. 1) Pick price element  2) Add Telegram token + chat ID  3) Start");
  render();
})();
