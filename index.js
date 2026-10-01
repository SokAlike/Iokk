/**
 * SMC v4 — RSI ZONE EDITION (browser console script for qx-market.com)
 * Paste entire file into DevTools Console (F12) on the trading platform page.
 *
 * WHAT'S NEW IN v4 (2026-10-01) — user spec:
 *  - RSI ZONE STRATEGY (fast trade, RSI-only analysis):
 *      RSI 60%..100%  -> SELL (DOWN)  [overbought — price expected to drop]
 *      RSI 10%..40%   -> BUY  (UP)    [oversold  — price expected to rise]
 *      RSI 40%..60%   -> neutral — no trade (dead zone)
 *  - INSTANT TRIGGER: fires the moment RSI ENTERS a zone (edge trigger,
 *    one signal per zone entry — no spam while RSI sits inside)
 *  - FAST EXECUTION: 1s sanity check by default, then the order is placed
 *    (set expiry 30s/1m in the platform UI for fast rounds)
 *  - LIVE FEED: hooks the platform's own Socket.IO stream (candle/history events)
 *    - tick source (default): live RSI recomputed every scan tick (~0.5s) — fastest
 *    - candle source: RSI on closed 1m candles only — slower, most accurate
 *  - 'cross' strict mode kept as an alternative in the settings panel (3 taps)
 *  - All 4 zone bounds configurable in the settings panel
 *  - WIDGET: label shows live RSI + zone arrow (▲ buy zone / ▼ sell zone)
 *  - DEBUG API: __SMC_STATE__(), __SMC_RSI__(), __SMC_FORCE_SIGNAL__(dir), __SMC_STOP__()
 *
 * Password gate unchanged: Jokar99T
 * Trade buttons: v2 3-strategy resolution (data-qx -> legacy -> text)
 */
(function () {
  if (window.__QX999_ACTIVE__) {
    console.warn("SMC already running.");
    return;
  }

  const QX999_PASSWORD = "Jokar99T";
  const PW_STORAGE_KEY = "qx999_saved_password";
  const RSI_STORAGE_KEY = "qx999_rsi_settings_v2";

  function getSavedPassword() {
    try {
      return localStorage.getItem(PW_STORAGE_KEY) || sessionStorage.getItem(PW_STORAGE_KEY) || "";
    } catch { return ""; }
  }
  function rememberPassword(pw) {
    try { localStorage.setItem(PW_STORAGE_KEY, pw); }
    catch { try { sessionStorage.setItem(PW_STORAGE_KEY, pw); } catch {} }
  }

  function showPasswordGate(onSuccess) {
    const loginStyle = document.createElement("style");
    loginStyle.id = "qx999-login-style";
    loginStyle.textContent = `
      #qx999-login-overlay { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.72); font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
      #qx999-login-box { width: min(320px, calc(100vw - 32px)); padding: 22px 20px 18px; border-radius: 14px; background: linear-gradient(160deg,#0d1f14 0%,#0a0f0c 100%); border: 1px solid rgba(0,255,102,0.4); box-shadow: 0 0 40px rgba(0,255,102,0.25); }
      #qx999-login-box h3 { margin: 0 0 6px; color: #00ff66; font-size: 18px; text-align: center; letter-spacing: 0.06em; }
      #qx999-login-box p { margin: 0 0 12px; color: #9fd4ad; font-size: 12px; text-align: center; }
      #qx999-login-input { width: 100%; box-sizing: border-box; padding: 11px 12px; border-radius: 8px; border: 1px solid rgba(0,255,102,0.35); background: rgba(0,0,0,0.4); color: #fff; font-size: 15px; outline: none; }
      #qx999-login-btn { width: 100%; margin-top: 12px; padding: 11px; border: none; border-radius: 8px; background: #00ff66; color: #052210; font-weight: 700; font-size: 14px; cursor: pointer; }
      #qx999-login-err { min-height: 18px; margin-top: 8px; text-align: center; font-size: 12px; color: #ff6b6b; font-weight: 600; }
    `;
    document.head.appendChild(loginStyle);
    const overlay = document.createElement("div");
    overlay.id = "qx999-login-overlay";
    overlay.innerHTML = `
      <div id="qx999-login-box">
        <h3>SMC v4 &middot; RSI</h3>
        <p>Enter password to continue</p>
        <input id="qx999-login-input" type="password" autocomplete="current-password" />
        <button type="button" id="qx999-login-btn">Enter</button>
        <p id="qx999-login-err"></p>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector("#qx999-login-input");
    const errEl = overlay.querySelector("#qx999-login-err");
    const btn = overlay.querySelector("#qx999-login-btn");
    input.value = getSavedPassword();
    function tryLogin() {
      if (input.value === QX999_PASSWORD) {
        rememberPassword(input.value);
        overlay.remove(); loginStyle.remove(); onSuccess(); return;
      }
      errEl.textContent = "Wrong password"; input.focus(); input.select();
    }
    btn.addEventListener("click", tryLogin);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); tryLogin(); } });
    setTimeout(() => input.focus(), 50);
    if (input.value) setTimeout(() => input.select(), 60);
  }

  function initQX999() {
    window.__QX999_ACTIVE__ = true;

  /* ============ SETTINGS ============ */
  const defaults = {
    delaySec: 1,            // fast trade: 1s sanity check, then execute
    afterTradeScanSec: 0,   // 0 = keep scanning until tapped
    direction: "rsi",       // 'rsi' (analysis) | 'up' | 'down' | 'random'
    rsiPeriod: 14,
    signalMode: "zone",     // 'zone' (fast, user spec) | 'cross' (strict reversal)
    buyMin: 10,             // BUY zone:  buyMin <= RSI <= buyMax  -> UP
    buyMax: 40,
    sellMin: 60,            // SELL zone: sellMin <= RSI <= sellMax -> DOWN
    sellMax: 100,
    oversold: 30,           // cross-mode levels
    overbought: 70,
    signalSource: "tick",   // 'tick' (live RSI ~0.5s — fast) | 'candle' (closed 1m — accurate)
    cooldownSec: 10,        // min seconds between trades
    maxTrades: 0            // 0 = unlimited
  };

  function parseStored(raw) {
    if (!raw) return null;
    const s = JSON.parse(raw);
    const clamp = (n, lo, hi, dflt) => { n = Number(n); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt; };
    const p = {
      delaySec: clamp(s.delaySec, 0, 120, defaults.delaySec),
      afterTradeScanSec: clamp(s.afterTradeScanSec, 0, 300, defaults.afterTradeScanSec),
      direction: ["rsi", "up", "down", "random"].includes(s.direction) ? s.direction : defaults.direction,
      rsiPeriod: clamp(s.rsiPeriod, 2, 100, defaults.rsiPeriod),
      signalMode: ["zone", "cross"].includes(s.signalMode) ? s.signalMode : defaults.signalMode,
      buyMin: clamp(s.buyMin, 1, 98, defaults.buyMin),
      buyMax: clamp(s.buyMax, 2, 99, defaults.buyMax),
      sellMin: clamp(s.sellMin, 1, 99, defaults.sellMin),
      sellMax: clamp(s.sellMax, 2, 100, defaults.sellMax),
      oversold: clamp(s.oversold, 1, 49, defaults.oversold),
      overbought: clamp(s.overbought, 51, 99, defaults.overbought),
      signalSource: ["candle", "tick"].includes(s.signalSource) ? s.signalSource : defaults.signalSource,
      cooldownSec: clamp(s.cooldownSec, 0, 600, defaults.cooldownSec),
      maxTrades: clamp(s.maxTrades, 0, 999, defaults.maxTrades)
    };
    // zone sanity: buyMin < buyMax < sellMin < sellMax, else reset to user spec
    if (!(p.buyMin < p.buyMax) || !(p.sellMin < p.sellMax) || !(p.buyMax < p.sellMin)) {
      p.buyMin = defaults.buyMin; p.buyMax = defaults.buyMax;
      p.sellMin = defaults.sellMin; p.sellMax = defaults.sellMax;
    }
    return p;
  }
  function loadRsiSettings() {
    try { const p = parseStored(localStorage.getItem(RSI_STORAGE_KEY)); if (p) return p; } catch {}
    try { const p = parseStored(sessionStorage.getItem(RSI_STORAGE_KEY)); if (p) return p; } catch {}
    return { ...defaults };
  }
  function saveRsiSettings(s) {
    const json = JSON.stringify(s);
    try { localStorage.setItem(RSI_STORAGE_KEY, json); } catch {}
    try { sessionStorage.setItem(RSI_STORAGE_KEY, json); } catch {}
  }

  let settings = loadRsiSettings();

  /* ============ LIVE FEED (Socket.IO sniffer) ============ */
  const feed = {
    active: false,
    socket: null,
    symbol: null,          // active asset from candle events
    closes: [],            // closed 1m candle closes (seeded from history + extended live)
    formingClose: null,    // latest live price (forming candle)
    lastCandleTime: null,  // m1 forming time of latest candle event
    lastTickAt: 0,
    rsi: null,
    prevRsi: null,
    warmupDone: false,
    warmupTried: false,
    tickHistory: [],       // recent tick closes for signal evaluation
    lastClosedClose: null  // close of the last fully closed 1m candle
  };
  const MAX_CLOSES = 400;

  function parseSocketIoFrame(raw) {
    // Socket.IO v4: '42["event",payload]' ; engine.io ping/pong: '2'/'3'
    if (typeof raw !== "string") return null;
    if (raw.startsWith("42")) {
      try {
        const arr = JSON.parse(raw.substring(2));
        if (Array.isArray(arr) && arr.length >= 2) return { event: arr[0], payload: arr[1] };
      } catch {}
    }
    return null;
  }

  function onFeedEvent(ev, payload) {
    try {
      if (ev === "candle" && payload && payload.candle) {
        const sym = payload.symbol;
        if (sym) feed.symbol = sym;
        const price = typeof payload.price === "number" ? payload.price : payload.candle[4];
        feed.formingClose = price;
        feed.lastTickAt = Date.now();
        feed.lastCandleTime = payload.m1FormingTime || payload.candle[0];
        // track closed candles: server sends forming candle; when m1FormingTime advances,
        // the previous candle is closed with its final close = last price seen for it
        if (feed._prevFormingTime && payload.m1FormingTime && payload.m1FormingTime !== feed._prevFormingTime) {
          if (feed._prevFormingPrice != null) {
            feed.closes.push(feed._prevFormingPrice);
            if (feed.closes.length > MAX_CLOSES) feed.closes.shift();
            feed.lastClosedClose = feed._prevFormingPrice;
            computeRSI();
          }
        }
        feed._prevFormingTime = payload.m1FormingTime || payload.candle[0];
        feed._prevFormingPrice = price;
        if (settings.signalSource === "tick") { feed.tickHistory.push(price); if (feed.tickHistory.length > 200) feed.tickHistory.shift(); }
      } else if (ev === "history" && payload && Array.isArray(payload.candles)) {
        const closes = payload.candles.map(r => r[4]).filter(v => typeof v === "number");
        if (closes.length) {
          feed.closes = closes.slice(-MAX_CLOSES);
          feed.lastClosedClose = feed.closes[feed.closes.length - 1];
          if (payload.symbol) feed.historySymbol = payload.symbol;
          computeRSI();
          if (!feed.warmupDone && feed.closes.length >= settings.rsiPeriod + 2) {
            feed.warmupDone = true;
            console.log("SMC: RSI warmup complete from history (" + feed.closes.length + " candles, symbol: " + payload.symbol + ")");
          }
        }
      } else if (ev === "summary" && Array.isArray(payload)) {
        const row = payload.find(r => r.symbol === feed.symbol);
        if (row && typeof row.price === "number") { feed.formingClose = row.price; feed.lastTickAt = Date.now(); }
      }
    } catch (e) {}
  }

  function computeRSI() {
    const period = settings.rsiPeriod;
    const src = feed.closes;
    if (!src || src.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = src.length - period; i < src.length; i++) {
      const ch = src[i] - src[i - 1];
      if (ch > 0) gains += ch; else losses -= ch;
    }
    let avgG = gains / period, avgL = losses / period;
    const rs = avgL === 0 ? 100 : avgG / avgL;
    const rsi = avgL === 0 && avgG === 0 ? 50 : 100 - 100 / (1 + rs);
    feed.prevRsi = feed.rsi;
    feed.rsi = rsi;
    return rsi;
  }

  /* — capture the live socket: patch prototype.send (heartbeat reveals instance) — */
  function installFeedHook() {
    if (feed.active || window.__SMC_FEED_ACTIVE__) { feed.active = true; return; }
    const origSend = WebSocket.prototype.send;
    const patchedSend = function (d) {
      if (!feed.socket && this instanceof WebSocket && this.readyState === 1) {
        feed.socket = this;
        feed.active = true;
        window.__SMC_FEED_ACTIVE__ = true;
        try {
          this.addEventListener("message", function (ev) {
            const parsed = parseSocketIoFrame(typeof ev.data === "string" ? ev.data : null);
            if (parsed) onFeedEvent(parsed.event, parsed.payload);
          });
          console.log("SMC: live feed attached to platform socket");
          warmupIfNeeded();
        } catch (e) {}
        WebSocket.prototype.send = origSend; // restore after capture
      }
      return origSend.call(this, d);
    };
    WebSocket.prototype.send = patchedSend;
    // also catch sockets created later (reconnects)
    const NativeWS = WebSocket;
    window.WebSocket = function (url, protocols) {
      const ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      if (!feed.socket && !window.__SMC_FEED_ACTIVE__) {
        // will be captured via prototype.send on first outgoing frame
      }
      return ws;
    };
    window.WebSocket.prototype = NativeWS.prototype;
    window.WebSocket.CONNECTING = 0; window.WebSocket.OPEN = 1; window.WebSocket.CLOSING = 2; window.WebSocket.CLOSED = 3;
    console.log("SMC: feed hook installed — waiting for platform socket (<=15s)...");
  }

  /* — instant warmup: brief asset re-switch makes the server push fresh 'history' — */
  function warmupIfNeeded() {
    if (feed.warmupDone || feed.warmupTried) return;
    feed.warmupTried = true;
    if (feed.closes.length >= settings.rsiPeriod + 2) { feed.warmupDone = true; return; }
    console.log("SMC: warming up RSI (asset re-switch to fetch candle history)...");
    setTimeout(() => { switchAssetForWarmup(); }, 800);
  }

  function switchAssetForWarmup() {
    try {
      const CURR = 'AUD/CAD (OTC)';
      const ALT = 'AUD/CHF (OTC)';
      const openDialog = () => {
        const btn = findAssetButton();
        if (!btn) return false;
        btn.click();
        return true;
      };
      const clickRow = (symbol) => {
        const rows = [].slice.call(document.querySelectorAll('button, div[role="button"], li, div')).filter(e => {
          const t = (e.textContent || "").trim();
          const r = e.getBoundingClientRect();
          return t.startsWith(symbol) && t.length < 45 && r.height > 20 && r.height < 80 && r.width > 250;
        });
        if (rows.length) { rows[rows.length - 1].click(); return true; }
        return false;
      };
      if (!openDialog()) { console.warn("SMC: warmup switch failed (asset button not found) — tick fallback"); return; }
      setTimeout(() => {
        if (!clickRow(ALT)) { console.warn("SMC: warmup alt-asset not found — tick fallback"); return; }
        setTimeout(() => {
          const needOpen = !document.body.innerText.includes("Select trade pair");
          if (needOpen) openDialog();
          setTimeout(() => {
            if (!clickRow(CURR)) console.warn("SMC: warmup restore-asset not found — select asset manually; RSI will warm from live ticks");
            else console.log("SMC: warmup switch done — history seeded");
            feed.warmupDone = feed.closes.length >= settings.rsiPeriod + 2;
          }, 900);
        }, 1600);
      }, 900);
    } catch (e) {
      console.warn("SMC: warmup error — tick fallback", e && e.message);
    }
  }

  function findAssetButton() {
    // asset button in trade panel: contains '(OTC)' or 'XXX/YYY', top right area
    const cands = [].slice.call(document.querySelectorAll("button")).filter(e => {
      const t = (e.textContent || "").trim();
      const r = e.getBoundingClientRect();
      return /^[A-Z]{3}\/[A-Z]{3}/.test(t) && t.length < 40 && r.width > 0 && r.left > 900 && r.top < 140;
    });
    return cands.length ? cands[0] : null;
  }

  /* ============ TRADE BUTTONS (v2 3-strategy resolution) ============ */
  function findTradeButtonByText(text) {
    const candidates = document.querySelectorAll("button");
    for (const b of candidates) {
      if ((b.textContent || "").trim() !== text) continue;
      if (b.closest("#qx999-widget, #qx999-panel, #qx999-login-overlay")) continue;
      if (b.offsetParent === null && getComputedStyle(b).position !== "fixed") continue;
      return b;
    }
    return null;
  }
  function getTradeButtons() {
    let up = document.querySelector('button[data-qx="up-btn"]');
    let down = document.querySelector('button[data-qx="down-btn"]');
    if (up || down) return { up, down, source: "data-qx" };
    const root = document.getElementById("trade-button");
    if (root) {
      up = root.querySelector("button.JQZcs");
      down = root.querySelector("button.twQq3");
      if (up || down) return { up, down, source: "legacy" };
    }
    up = findTradeButtonByText("Up");
    down = findTradeButtonByText("Down");
    if (up || down) return { up, down, source: "text" };
    return { up: null, down: null, source: null };
  }

  /* ============ SIGNAL ENGINE (RSI only, v4 zone spec) ============ */
  let lastSignal = null;   // { dir: 'up'|'down', rsi, prevRsi, mode }
  let lastTradeAt = 0;
  let tradesPlaced = 0;
  let pendingExecTimer = null;   // sanity window before execution
  let activeZone = null;         // zone-edge state: 'up' | 'down' | null

  function zoneOf(rsi) {
    if (rsi == null) return null;
    // User spec zones: BUY 10-40 / SELL 60-100.
    // Extremes extend outward: RSI < 10 is even stronger oversold -> still BUY;
    // RSI cannot exceed 100, so >= 60 covers the whole sell range.
    if (rsi >= settings.sellMin) return "down"; // SELL 60..100
    if (rsi <= settings.buyMax) return "up";    // BUY  10..40 (and extreme 0..10)
    return null;                                 // 40-60 neutral dead zone
  }

  function evaluateSignal() {
    if (settings.direction !== "rsi") return null;
    if (!feed.active) return null;
    if (settings.signalSource === "candle" && feed.closes.length < settings.rsiPeriod + 2) return null;
    const rsi = feed.rsi, prev = feed.prevRsi;
    if (rsi == null) return null;

    if (settings.signalMode === "zone") {
      // FAST (user spec): fire the instant RSI ENTERS the buy/sell zone (edge trigger)
      const z = zoneOf(rsi);
      const entered = z && z !== activeZone;
      activeZone = z;
      if (!entered) return null;
      return { dir: z, rsi, prevRsi: prev, mode: "zone" };
    }

    // CROSS (strict alternative): reversal confirmed when RSI leaves the extreme
    if (prev == null) return null;
    const os = settings.oversold, ob = settings.overbought;
    let dir = null;
    if (prev < os && rsi >= os) dir = "up";
    else if (prev > ob && rsi <= ob) dir = "down";
    if (!dir) return null;
    return { dir, rsi, prevRsi: prev, mode: "cross" };
  }

  function feedHealthy() {
    return feed.active && feed.socket && feed.socket.readyState === 1 &&
      feed.formingClose != null && (Date.now() - feed.lastTickAt) < 15000;
  }

  function rsiValid() {
    if (settings.signalSource === "candle") return feed.warmupDone && feed.closes.length >= settings.rsiPeriod + 2;
    return feed.rsi != null;
  }

  /* ============ TRADE EXECUTION ============ */
  function executeSignal(signal) {
    const { up, down, source } = getTradeButtons();
    const btn = signal.dir === "up" ? up : down;
    if (!btn) { console.error("SMC: trade button not found for", signal.dir, "| selector:", source); return false; }
    if (btn.disabled || btn.getAttribute("aria-disabled") === "true") {
      console.error("SMC: trade button DISABLED (balance/market?) — skipped");
      return false;
    }
    btn.click();
    tradesPlaced++;
    lastTradeAt = Date.now();
    console.log("SMC RSI trade:", signal.dir.toUpperCase(),
      "| RSI", (signal.prevRsi != null ? signal.prevRsi.toFixed(1) : "?") + " -> " + (signal.rsi != null ? signal.rsi.toFixed(1) : "?"),
      "| asset:", feed.symbol, "| selector:", source,
      "| trade #" + tradesPlaced + (settings.maxTrades ? "/" + settings.maxTrades : ""));
    return true;
  }

  /* ============ SCANNER LOOP ============ */
  let scanActive = false;
  let scanTimer = null;
  let afterTradeTimer = null;
  let scanLogTimer = null;

  function scanLoop() {
    if (!scanActive) return;
    try {
      if (feedHealthy() && rsiValid() && settings.direction === "rsi") {
        if (settings.signalSource === "tick") {
          // recompute RSI including the latest live tick for responsiveness
          const liveCloses = feed.closes.concat(feed.formingClose != null ? [feed.formingClose] : []);
          const saved = feed.closes;
          feed.closes = liveCloses.slice(-MAX_CLOSES);
          computeRSI();
          feed.closes = saved;
        }
        const signal = evaluateSignal();
        const now = Date.now();
        const cooled = now - lastTradeAt >= settings.cooldownSec * 1000;
        const underMax = !settings.maxTrades || tradesPlaced < settings.maxTrades;
        if (signal && cooled && underMax) {
          lastSignal = signal;
          console.log("SMC signal:", signal.dir.toUpperCase(),
            "| RSI", (signal.prevRsi != null ? signal.prevRsi.toFixed(1) : "?") + " -> " + signal.rsi.toFixed(1),
            "| mode:", signal.mode,
            "| exec in", settings.delaySec + "s");
          if (pendingExecTimer) clearTimeout(pendingExecTimer);
          pendingExecTimer = setTimeout(() => {
            pendingExecTimer = null;
            if (!scanActive) return;
            // fast sanity check: RSI must still lean toward the signal zone
            const r = feed.rsi;
            const ok = signal.dir === "up"
              ? (r != null && (signal.mode === "zone" ? r <= settings.buyMax + 5 : r >= settings.oversold - 5))
              : (r != null && (signal.mode === "zone" ? r >= settings.sellMin - 5 : r <= settings.overbought + 5));
            if (!ok) { console.log("SMC: signal cancelled (RSI reverted before execution)"); return; }
            executeSignal(signal);
            if (settings.afterTradeScanSec > 0) {
              afterTradeTimer = setTimeout(stopScanSession, settings.afterTradeScanSec * 1000);
            }
          }, settings.delaySec * 1000);
        }
      }
    } catch (e) { console.error("SMC scan error:", e && e.message); }
    scanTimer = setTimeout(scanLoop, 500);
  }

  function startScanSession() {
    if (scanActive) return;
    scanActive = true;
    activeZone = null;   // re-arm: if RSI is already inside a zone, fire immediately
    widget.classList.add("qx999-glow");
    scanOverlay.classList.add("qx999-scan-on");
    console.log("SMC: RSI scanner started | signal:", settings.signalMode,
      "| zones: BUY " + settings.buyMin + "-" + settings.buyMax + " / SELL " + settings.sellMin + "-" + settings.sellMax,
      "| source:", settings.signalSource,
      "| RSI(" + settings.rsiPeriod + ")",
      "| cooldown:", settings.cooldownSec + "s",
      "| max:", settings.maxTrades || "unlimited");
    scanLoop();
    scanLogTimer = setInterval(() => {
      if (feedHealthy()) {
        console.log("SMC status | RSI:", feed.rsi != null ? feed.rsi.toFixed(1) : "warming...",
          "| closes:", feed.closes.length, "| ticks:", feed.tickHistory.length,
          "| asset:", feed.symbol, "| trades:", tradesPlaced);
      } else {
        console.log("SMC status | feed: connecting...", feed.socket ? "(socket found)" : "(waiting for socket)");
      }
    }, 15000);
  }

  function stopScanSession() {
    scanActive = false;
    widget.classList.remove("qx999-glow");
    scanOverlay.classList.remove("qx999-scan-on");
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
    if (afterTradeTimer) { clearTimeout(afterTradeTimer); afterTradeTimer = null; }
    if (pendingExecTimer) { clearTimeout(pendingExecTimer); pendingExecTimer = null; }
    if (scanLogTimer) { clearInterval(scanLogTimer); scanLogTimer = null; }
    console.log("SMC: scanner stopped | trades this session:", tradesPlaced);
  }

  /* ============ WIDGET UI ============ */
  const LOGO_URL =
    (window.__SMC_ASSET_BASE__ || "https://legendary-douhua-a9f877.netlify.app") + "/new%20logo.png";
  const TAP_REQUIRED = 3;
  const TAP_SETTLE_MS = 380;
  const TAP_SEQUENCE_MS = 650;

  const style = document.createElement("style");
  style.textContent = `
    #qx999-widget { position: fixed; z-index: 2147483646; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; left: 16px; top: 50%; transform: translateY(-50%); filter: drop-shadow(0 2px 8px rgba(0,0,0,0.45)); transition: filter 0.25s ease; }
    #qx999-widget.qx999-glow { filter: drop-shadow(0 0 12px #00ff66) drop-shadow(0 0 28px #00ff66) drop-shadow(0 0 48px rgba(0,255,102,0.55)); }
    #qx999-widget:active { cursor: grabbing; }
    #qx999-logo-wrap { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; pointer-events: none; }
    #qx999-logo-wrap img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    #qx999-label { font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.8); pointer-events: none; background: rgba(0,0,0,0.55); padding: 2px 8px; border-radius: 8px; }
    #qx999-widget.qx999-glow #qx999-label { color: #b8ffd4; text-shadow: 0 0 8px #00ff66, 0 0 18px #00ff66; }
    #qx999-scan-overlay { position: fixed; inset: 0; z-index: 2147483645; pointer-events: none; overflow: hidden; display: none; }
    #qx999-scan-overlay.qx999-scan-on { display: block; }
    #qx999-scan-line { position: absolute; left: 0; width: 100%; height: 5px; background: linear-gradient(180deg,#3ad67f 0%,#22c464 16%,#14ad56 40%,#009e4a 58%,#008a40 82%,rgba(0,110,48,0.55) 100%); box-shadow: 0 -88px 130px rgba(0,220,115,1),0 -68px 100px rgba(0,200,100,1),0 -50px 78px rgba(0,185,92,0.98),0 -34px 58px rgba(0,170,85,0.96),0 -22px 40px rgba(0,155,78,0.94),0 -12px 26px rgba(0,140,72,0.9),0 -6px 14px rgba(0,125,65,0.88),0 0 28px rgba(0,150,75,0.85),0 0 55px rgba(0,130,65,0.55); top: -8%; animation: qx999-scan-move 1.45s linear infinite; }
    @keyframes qx999-scan-move { 0% { top: -8%; } 100% { top: 108%; } }
    #qx999-panel { position: fixed; z-index: 2147483647; left: 50%; top: 50%; transform: translate(-50%,-50%); opacity: 0; pointer-events: none; width: min(320px, calc(100vw - 32px)); max-height: calc(100vh - 40px); overflow-y: auto; padding: 18px 16px 14px; border-radius: 14px; background: linear-gradient(160deg,#0d1f14 0%,#0a0f0c 100%); border: 1px solid rgba(0,255,102,0.35); box-shadow: 0 0 40px rgba(0,255,102,0.25),0 12px 40px rgba(0,0,0,0.55); font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color: #e8ffe8; }
    #qx999-panel.qx999-panel-open { opacity: 1; pointer-events: auto; }
    #qx999-panel h3 { margin: 0 0 12px; font-size: 16px; font-weight: 700; text-align: center; color: #00ff66; letter-spacing: 0.06em; }
    #qx999-panel h4 { margin: 14px 0 8px; font-size: 12px; font-weight: 700; text-align: left; color: #57c984; letter-spacing: 0.08em; text-transform: uppercase; border-top: 1px solid rgba(0,255,102,0.18); padding-top: 10px; }
    #qx999-panel .qx999-row { margin-bottom: 10px; }
    #qx999-panel label { display: block; font-size: 12px; color: #9fd4ad; margin-bottom: 5px; }
    #qx999-panel .qx999-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    #qx999-panel .qx999-time-input { box-sizing: border-box; width: 100%; padding: 9px 10px; border-radius: 8px; border: 1px solid rgba(0,255,102,0.3); background: rgba(0,0,0,0.35); color: #fff; font-size: 14px; font-family: inherit; outline: none; -webkit-appearance: none; appearance: none; }
    #qx999-panel .qx999-time-input:focus { border-color: #00ff66; box-shadow: 0 0 0 2px rgba(0,255,102,0.2); }
    #qx999-panel .qx999-time-input::-webkit-outer-spin-button, #qx999-panel .qx999-time-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    #qx999-panel .qx999-save-btn { padding: 10px 14px; border: none; border-radius: 8px; background: #00ff66; color: #052210; font-weight: 700; font-size: 13px; font-family: inherit; cursor: pointer; }
    #qx999-panel .qx999-save-btn:active { background: #00e65c; }
    #qx999-panel .qx999-save-btn-block { display: block; width: 100%; margin-top: 6px; padding: 12px 14px; font-size: 14px; }
    #qx999-dir-group { display: flex; gap: 8px; }
    #qx999-dir-group button { flex: 1; padding: 10px 8px; border-radius: 8px; border: 1px solid rgba(0,255,102,0.25); background: rgba(0,0,0,0.3); color: #dfffe8; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s, border-color 0.15s, box-shadow 0.15s; }
    #qx999-dir-group button.qx999-dir-active { background: rgba(0,255,102,0.18); border-color: #00ff66; box-shadow: 0 0 16px rgba(0,255,102,0.35); color: #00ff66; }
    #qx999-sig-group { display: flex; gap: 8px; }
    #qx999-sig-group button { flex: 1; padding: 10px 8px; border-radius: 8px; border: 1px solid rgba(0,255,102,0.25); background: rgba(0,0,0,0.3); color: #dfffe8; font-size: 13px; font-weight: 600; cursor: pointer; }
    #qx999-sig-group button.qx999-sig-active { background: rgba(0,255,102,0.18); border-color: #00ff66; box-shadow: 0 0 16px rgba(0,255,102,0.35); color: #00ff66; }
    #qx999-panel-backdrop { position: fixed; inset: 0; z-index: 2147483646; background: rgba(0,0,0,0.5); opacity: 0; pointer-events: none; }
    #qx999-panel-backdrop.qx999-backdrop-open { opacity: 1; pointer-events: auto; }
    #qx999-panel-hint { margin: 10px 0 0; font-size: 11px; text-align: center; color: #6a9a78; line-height: 1.35; }
    #qx999-save-status { min-height: 18px; margin: 8px 0 0; font-size: 12px; text-align: center; color: #00ff66; font-weight: 600; }
    #qx999-panel button, #qx999-panel input { touch-action: manipulation; }
  `;
  document.head.appendChild(style);

  const scanOverlay = document.createElement("div");
  scanOverlay.id = "qx999-scan-overlay";
  scanOverlay.innerHTML = '<div id="qx999-scan-line"></div>';
  document.body.appendChild(scanOverlay);

  const backdrop = document.createElement("div");
  backdrop.id = "qx999-panel-backdrop";
  const panel = document.createElement("div");
  panel.id = "qx999-panel";
  panel.innerHTML = `
    <h3>SMC v4 &middot; RSI Settings</h3>
    <h4>Strategy</h4>
    <div class="qx999-row">
      <label>Trade direction</label>
      <div id="qx999-dir-group">
        <button type="button" data-dir="rsi">RSI</button>
        <button type="button" data-dir="up">Up</button>
        <button type="button" data-dir="down">Down</button>
        <button type="button" data-dir="random">Rand</button>
      </div>
    </div>
    <div class="qx999-row">
      <label>Signal mode</label>
      <div id="qx999-mode-group">
        <button type="button" data-mode="zone">Zone (fast)</button>
        <button type="button" data-mode="cross">Cross (strict)</button>
      </div>
    </div>
    <div class="qx999-row">
      <label>Signal source</label>
      <div id="qx999-sig-group">
        <button type="button" data-sig="candle">Candle (accurate)</button>
        <button type="button" data-sig="tick">Tick (fast)</button>
      </div>
    </div>
    <h4>RSI</h4>
    <div class="qx999-row qx999-grid">
      <div>
        <label>Period</label>
        <input id="qx999-period-input" class="qx999-time-input" type="number" min="2" max="100" step="1" />
      </div>
      <div>
        <label>Cooldown (s)</label>
        <input id="qx999-cooldown-input" class="qx999-time-input" type="number" min="0" max="600" step="1" />
      </div>
    </div>
    <h4>Zones &middot; BUY 10-40 / SELL 60-100</h4>
    <div class="qx999-row qx999-grid">
      <div>
        <label>Buy min &uarr;</label>
        <input id="qx999-buymin-input" class="qx999-time-input" type="number" min="1" max="98" step="1" />
      </div>
      <div>
        <label>Buy max &uarr;</label>
        <input id="qx999-buymax-input" class="qx999-time-input" type="number" min="2" max="99" step="1" />
      </div>
      <div>
        <label>Sell min &darr;</label>
        <input id="qx999-sellmin-input" class="qx999-time-input" type="number" min="1" max="99" step="1" />
      </div>
      <div>
        <label>Sell max &darr;</label>
        <input id="qx999-sellmax-input" class="qx999-time-input" type="number" min="2" max="100" step="1" />
      </div>
    </div>
    <h4>Cross levels (strict mode)</h4>
    <div class="qx999-row qx999-grid">
      <div>
        <label>Oversold &lt;</label>
        <input id="qx999-os-input" class="qx999-time-input" type="number" min="1" max="49" step="1" />
      </div>
      <div>
        <label>Overbought &gt;</label>
        <input id="qx999-ob-input" class="qx999-time-input" type="number" min="51" max="99" step="1" />
      </div>
    </div>
    <h4>Execution</h4>
    <div class="qx999-row qx999-grid">
      <div>
        <label>Exec delay (s)</label>
        <input id="qx999-delay-input" class="qx999-time-input" type="number" min="0" max="120" step="1" />
      </div>
      <div>
        <label>Max trades (0=&infin;)</label>
        <input id="qx999-maxtrades-input" class="qx999-time-input" type="number" min="0" max="999" step="1" />
      </div>
    </div>
    <div class="qx999-row">
      <label>After-trade scan (s) &middot; 0 = keep scanning</label>
      <input id="qx999-after-trade-input" class="qx999-time-input" type="number" min="0" max="300" step="1" />
    </div>
    <button type="button" id="qx999-save-all" class="qx999-save-btn qx999-save-btn-block">Save</button>
    <p id="qx999-save-status"></p>
    <p id="qx999-panel-hint">1 tap icon: start/stop scanner &middot; 3 taps: settings &middot; BUY 10-40 / SELL 60-100 &middot; set expiry 30s/1m for fast rounds</p>
  `;
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  panel.addEventListener("mousedown", (e) => e.stopPropagation());
  panel.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
  panel.addEventListener("touchend", (e) => e.stopPropagation());

  const delayInput = panel.querySelector("#qx999-delay-input");
  const afterTradeInput = panel.querySelector("#qx999-after-trade-input");
  const periodInput = panel.querySelector("#qx999-period-input");
  const cooldownInput = panel.querySelector("#qx999-cooldown-input");
  const buyMinInput = panel.querySelector("#qx999-buymin-input");
  const buyMaxInput = panel.querySelector("#qx999-buymax-input");
  const sellMinInput = panel.querySelector("#qx999-sellmin-input");
  const sellMaxInput = panel.querySelector("#qx999-sellmax-input");
  const osInput = panel.querySelector("#qx999-os-input");
  const obInput = panel.querySelector("#qx999-ob-input");
  const maxTradesInput = panel.querySelector("#qx999-maxtrades-input");
  const saveStatus = panel.querySelector("#qx999-save-status");
  const dirButtons = panel.querySelectorAll("#qx999-dir-group button");
  const modeButtons = panel.querySelectorAll("#qx999-mode-group button");
  const sigButtons = panel.querySelectorAll("#qx999-sig-group button");
  let saveStatusTimer = null;
  let pendingDirection = settings.direction;
  let pendingMode = settings.signalMode;
  let pendingSignal = settings.signalSource;

  function syncToggles() {
    dirButtons.forEach((b) => b.classList.toggle("qx999-dir-active", b.dataset.dir === pendingDirection));
    modeButtons.forEach((b) => b.classList.toggle("qx999-sig-active", b.dataset.mode === pendingMode));
    sigButtons.forEach((b) => b.classList.toggle("qx999-sig-active", b.dataset.sig === pendingSignal));
  }
  function syncPanelUI() {
    delayInput.value = String(settings.delaySec);
    afterTradeInput.value = String(settings.afterTradeScanSec);
    periodInput.value = String(settings.rsiPeriod);
    cooldownInput.value = String(settings.cooldownSec);
    buyMinInput.value = String(settings.buyMin);
    buyMaxInput.value = String(settings.buyMax);
    sellMinInput.value = String(settings.sellMin);
    sellMaxInput.value = String(settings.sellMax);
    osInput.value = String(settings.oversold);
    obInput.value = String(settings.overbought);
    maxTradesInput.value = String(settings.maxTrades);
    pendingDirection = settings.direction;
    pendingMode = settings.signalMode;
    pendingSignal = settings.signalSource;
    syncToggles();
  }
  function openPanel() { syncPanelUI(); backdrop.classList.add("qx999-backdrop-open"); panel.classList.add("qx999-panel-open"); }
  function closePanel() { backdrop.classList.remove("qx999-backdrop-open"); panel.classList.remove("qx999-panel-open"); saveStatus.textContent = ""; }
  function showSaveStatus(msg, isError) {
    saveStatus.textContent = msg;
    saveStatus.style.color = isError ? "#ff6b6b" : "#00ff66";
    if (saveStatusTimer) clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => { saveStatus.textContent = ""; }, 2500);
  }
  function applyAllSettings() {
    const num = (el, lo, hi, dflt) => { const n = Number(String(el.value).trim()); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt; };
    const bMin = num(buyMinInput, 1, 98, defaults.buyMin);
    const bMax = num(buyMaxInput, 2, 99, defaults.buyMax);
    const sMin = num(sellMinInput, 1, 99, defaults.sellMin);
    const sMax = num(sellMaxInput, 2, 100, defaults.sellMax);
    if (!(bMin < bMax) || !(sMin < sMax) || !(bMax < sMin)) {
      showSaveStatus("Invalid zones — need BuyMin < BuyMax < SellMin < SellMax", true);
      return;
    }
    settings.buyMin = bMin; settings.buyMax = bMax;
    settings.sellMin = sMin; settings.sellMax = sMax;
    settings.delaySec = num(delayInput, 0, 120, defaults.delaySec);
    settings.afterTradeScanSec = num(afterTradeInput, 0, 300, defaults.afterTradeScanSec);
    settings.rsiPeriod = num(periodInput, 2, 100, defaults.rsiPeriod);
    settings.cooldownSec = num(cooldownInput, 0, 600, defaults.cooldownSec);
    settings.oversold = num(osInput, 1, 49, defaults.oversold);
    settings.overbought = num(obInput, 51, 99, defaults.overbought);
    settings.maxTrades = num(maxTradesInput, 0, 999, defaults.maxTrades);
    settings.direction = pendingDirection;
    settings.signalMode = pendingMode;
    settings.signalSource = pendingSignal;
    saveRsiSettings(settings);
    feed.warmupDone = feed.closes.length >= settings.rsiPeriod + 2;
    syncPanelUI();
    closePanel();
    console.log("SMC: settings saved | dir:", settings.direction, "| mode:", settings.signalMode, "| sig:", settings.signalSource,
      "| zones: BUY " + settings.buyMin + "-" + settings.buyMax + " / SELL " + settings.sellMin + "-" + settings.sellMax,
      "| cooldown:", settings.cooldownSec + "s", "| max:", settings.maxTrades || "unlimited");
  }
  function bindPanelAction(el, handler) {
    let lock = false;
    const run = (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (lock) return;
      lock = true;
      setTimeout(() => { lock = false; }, 300);
      handler();
    };
    el.addEventListener("pointerup", run);
    el.addEventListener("click", run);
  }
  bindPanelAction(panel.querySelector("#qx999-save-all"), applyAllSettings);
  function onSettingsEnter(e) { if (e.key === "Enter") { e.preventDefault(); applyAllSettings(); } }
  [delayInput, afterTradeInput, periodInput, cooldownInput, buyMinInput, buyMaxInput, sellMinInput, sellMaxInput, osInput, obInput, maxTradesInput].forEach((el) => el.addEventListener("keydown", onSettingsEnter));
  dirButtons.forEach((btn) => bindPanelAction(btn, () => { pendingDirection = btn.dataset.dir; syncToggles(); }));
  modeButtons.forEach((btn) => bindPanelAction(btn, () => { pendingMode = btn.dataset.mode; syncToggles(); }));
  sigButtons.forEach((btn) => bindPanelAction(btn, () => { pendingSignal = btn.dataset.sig; syncToggles(); }));
  bindPanelAction(backdrop, closePanel);

  const widget = document.createElement("div");
  widget.id = "qx999-widget";
  widget.innerHTML = `<div id="qx999-logo-wrap"><img src="${LOGO_URL}" alt="SMC" draggable="false" /></div><span id="qx999-label">SMC</span>`;
  document.body.appendChild(widget);

  /* live RSI + zone arrow on widget label */
  setInterval(() => {
    const label = document.getElementById("qx999-label");
    if (!label) return;
    const r = feed.rsi;
    if (r != null) {
      const z = zoneOf(r);
      const arrow = z === "up" ? " ▲" : z === "down" ? " ▼" : "";
      label.textContent = "SMC " + r.toFixed(1) + arrow;
      label.style.color = z === "up" ? "#7dffb0" : z === "down" ? "#ff9d8f" : "";
    } else {
      label.textContent = "SMC";
    }
  }, 700);

  /* ============ TAP LOGIC ============ */
  let tapCount = 0;
  let tapSettleTimer = null;
  let lastTapAt = 0;

  function resetTapCounter() {
    tapCount = 0;
    if (tapSettleTimer) { clearTimeout(tapSettleTimer); tapSettleTimer = null; }
  }
  function registerTap() {
    if (panel.classList.contains("qx999-panel-open")) return;
    const now = Date.now();
    if (now - lastTapAt > TAP_SEQUENCE_MS) tapCount = 0;
    lastTapAt = now;
    tapCount += 1;
    if (tapSettleTimer) { clearTimeout(tapSettleTimer); tapSettleTimer = null; }
    if (tapCount >= TAP_REQUIRED) { resetTapCounter(); openPanel(); return; }
    tapSettleTimer = setTimeout(() => {
      tapSettleTimer = null;
      if (tapCount === 1) {
        if (scanActive) stopScanSession();
        else startScanSession();
      }
      tapCount = 0;
    }, TAP_SETTLE_MS);
  }

  /* ============ DRAG ============ */
  let dragging = false, moved = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
  const DRAG_THRESHOLD = 8;
  function clampPosition(left, top) {
    const rect = widget.getBoundingClientRect();
    const maxL = window.innerWidth - rect.width;
    const maxT = window.innerHeight - rect.height;
    return { left: Math.max(0, Math.min(left, maxL)), top: Math.max(0, Math.min(top, maxT)) };
  }
  function onPointerDown(clientX, clientY) {
    dragging = true; moved = false;
    const r = widget.getBoundingClientRect();
    startX = clientX; startY = clientY; startLeft = r.left; startTop = r.top;
    widget.style.transform = "none";
    widget.style.left = startLeft + "px"; widget.style.top = startTop + "px";
  }
  function onPointerMove(clientX, clientY) {
    if (!dragging) return;
    const dx = clientX - startX, dy = clientY - startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;
    const pos = clampPosition(startLeft + dx, startTop + dy);
    widget.style.left = pos.left + "px"; widget.style.top = pos.top + "px";
  }
  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    if (!moved) registerTap();
  }
  widget.addEventListener("mousedown", (e) => { e.preventDefault(); onPointerDown(e.clientX, e.clientY); });
  widget.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    onPointerDown(t.clientX, t.clientY);
  }, { passive: false });
  document.addEventListener("mousemove", (e) => onPointerMove(e.clientX, e.clientY));
  document.addEventListener("touchmove", (e) => {
    if (!dragging || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    onPointerMove(t.clientX, t.clientY);
  }, { passive: false });
  document.addEventListener("mouseup", onPointerUp);
  document.addEventListener("touchend", onPointerUp);
  document.addEventListener("touchcancel", onPointerUp);

  /* ============ DEBUG API ============ */
  window.__SMC_STATE__ = function () {
    return JSON.parse(JSON.stringify({
      active: window.__QX999_ACTIVE__,
      scanActive,
      feedActive: feed.active,
      socketCaptured: !!feed.socket,
      socketState: feed.socket ? feed.socket.readyState : null,
      symbol: feed.symbol,
      warmupDone: feed.warmupDone,
      closesCount: feed.closes.length,
      ticks: feed.tickHistory.length,
      rsi: feed.rsi,
      prevRsi: feed.prevRsi,
      zone: zoneOf(feed.rsi),
      activeZone,
      signalMode: settings.signalMode,
      zones: { buy: settings.buyMin + "-" + settings.buyMax, sell: settings.sellMin + "-" + settings.sellMax },
      lastSignal,
      tradesPlaced,
      lastTradeAt: lastTradeAt ? new Date(lastTradeAt).toISOString() : null,
      settings,
      formingClose: feed.formingClose
    }));
  };
  window.__SMC_RSI__ = function () { return feed.rsi; };
  window.__SMC_FORCE_SIGNAL__ = function (dir) {
    dir = (dir || "up").toLowerCase();
    if (dir !== "up" && dir !== "down") { console.error("SMC: force signal dir must be up|down"); return false; }
    const sig = { dir, rsi: feed.rsi, prevRsi: feed.prevRsi, forced: true };
    console.warn("SMC: FORCED signal", dir.toUpperCase(), "(debug) — placing trade");
    return executeSignal(sig);
  };

  window.__QX999_STOP__ = function () {
    stopScanSession();
    resetTapCounter();
    closePanel();
    widget.remove(); scanOverlay.remove(); backdrop.remove(); panel.remove(); style.remove();
    delete window.__QX999_ACTIVE__;
    delete window.__QX999_STOP__;
    delete window.__SMC_STATE__;
    delete window.__SMC_RSI__;
    delete window.__SMC_FORCE_SIGNAL__;
    console.log("SMC removed.");
  };

  /* ============ BOOT ============ */
  syncPanelUI();
  installFeedHook();
  setTimeout(() => { if (feed.socket) warmupIfNeeded(); }, 4000);
  console.log(
    "SMC v4 RSI ZONE loaded — 1 tap: start/stop scanner | 3 taps: settings",
    "| signal:", settings.signalMode,
    "| zones: BUY " + settings.buyMin + "-" + settings.buyMax + " / SELL " + settings.sellMin + "-" + settings.sellMax,
    "| source:", settings.signalSource,
    "| RSI(" + settings.rsiPeriod + ")",
    "| cooldown:", settings.cooldownSec + "s"
  );
  }

  showPasswordGate(initQX999);
})();
