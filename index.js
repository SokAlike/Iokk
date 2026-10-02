/**
 * Quotex EMA+RSI bot — paste into DevTools Console (F12) on the trading page.
 * DEFAULT = DRY RUN (signals + stats only, no clicks). Use on DEMO first.
 *
 * Controls (type in console):
 *   BOT.start() / BOT.stop()
 *   BOT.live(true|false)   // true = really click UP/DOWN buttons
 *   BOT.status()           // prints stats + current price reading
 *   BOT.remove()
 */
(function () {
  if (window.BOT) { console.warn("Bot already loaded. Use BOT.remove() first."); return; }

  const CFG = {
    // REQUIRED: CSS selector of the element that shows the live price.
    // Right-click the price on the chart > Inspect, then copy a selector.
    priceSelector: "",
    candleSec: 15,        // candle size built from ticks
    emaFast: 9,
    emaSlow: 21,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    expirySec: 60,        // must match the expiry you set on the platform
    cooldownSec: 60,      // min gap between trades
    maxTradesPerSession: 20,
    maxConsecutiveLosses: 3,
    maxSessionLosses: 5,
    live: false,          // DRY RUN by default
    // Buttons (taken from your original script; may change if Quotex updates)
    upSel: "#trade-button button.JQZcs",
    downSel: "#trade-button button.twQq3",
  };

  const S = {
    running: false, timer: null, candles: [], cur: null, lastPrice: null,
    open: [], wins: 0, losses: 0, trades: 0, consec: 0, lastTradeAt: 0,
    prevFast: null, prevSlow: null,
  };

  const log = (...a) => console.log("[BOT]", ...a);

  function readPrice() {
    if (!CFG.priceSelector) return null;
    const el = document.querySelector(CFG.priceSelector);
    if (!el) return null;
    const n = parseFloat(el.textContent.replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : null;
  }

  function ema(vals, p) {
    if (vals.length < p) return null;
    const k = 2 / (p + 1);
    let e = vals.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
    return e;
  }

  function rsi(vals, p) {
    if (vals.length < p + 1) return null;
    let g = 0, l = 0;
    for (let i = vals.length - p; i < vals.length; i++) {
      const d = vals[i] - vals[i - 1];
      if (d >= 0) g += d; else l -= d;
    }
    if (l === 0) return 100;
    const rs = g / l;
    return 100 - 100 / (1 + rs);
  }

  function updateCandle(price) {
    const now = Date.now();
    const bucket = Math.floor(now / (CFG.candleSec * 1000));
    if (!S.cur || S.cur.bucket !== bucket) {
      if (S.cur) { S.candles.push(S.cur.close); if (S.candles.length > 300) S.candles.shift(); onCandleClose(); }
      S.cur = { bucket, close: price };
    } else S.cur.close = price;
  }

  function onCandleClose() {
    const closes = S.candles;
    const f = ema(closes, CFG.emaFast), s = ema(closes, CFG.emaSlow), r = rsi(closes, CFG.rsiPeriod);
    if (f == null || s == null || r == null) return;
    let signal = null;
    if (S.prevFast != null) {
      const crossUp = S.prevFast <= S.prevSlow && f > s;
      const crossDown = S.prevFast >= S.prevSlow && f < s;
      if (crossUp && r < CFG.rsiOverbought) signal = "UP";
      if (crossDown && r > CFG.rsiOversold) signal = "DOWN";
    }
    S.prevFast = f; S.prevSlow = s;
    render(f, s, r, signal);
    if (signal) trySignal(signal);
  }

  function canTrade() {
    if (S.trades >= CFG.maxTradesPerSession) return "max trades reached";
    if (S.consec >= CFG.maxConsecutiveLosses) return "max consecutive losses";
    if (S.losses >= CFG.maxSessionLosses) return "max session losses";
    if (Date.now() - S.lastTradeAt < CFG.cooldownSec * 1000) return "cooldown";
    return null;
  }

  function trySignal(side) {
    const block = canTrade();
    if (block) { log("Signal", side, "skipped:", block); if (block !== "cooldown") stop(); return; }
    S.lastTradeAt = Date.now();
    S.trades++;
    const entry = S.lastPrice;
    if (CFG.live) {
      const btn = document.querySelector(side === "UP" ? CFG.upSel : CFG.downSel);
      if (!btn) { log("Trade button not found — nothing clicked."); S.trades--; return; }
      btn.click();
    }
    log((CFG.live ? "LIVE " : "DRY ") + side, "@", entry);
    // Virtual result: compare price at expiry to entry (platform result may differ slightly)
    setTimeout(() => {
      const exit = S.lastPrice;
      if (exit == null || entry == null || exit === entry) return log("Result: tie/unknown");
      const win = side === "UP" ? exit > entry : exit < entry;
      if (win) { S.wins++; S.consec = 0; } else { S.losses++; S.consec++; }
      log("Result:", win ? "WIN" : "LOSS", "| W/L", S.wins + "/" + S.losses);
      render();
    }, CFG.expirySec * 1000);
  }

  // ---- UI ----
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147483647;background:#0d1117;color:#e6edf3;font:12px system-ui;padding:10px 12px;border:1px solid #30363d;border-radius:10px;min-width:170px;line-height:1.5";
  document.body.appendChild(box);

  function render(f, s, r, sig) {
    const t = S.wins + S.losses;
    const wr = t ? ((S.wins / t) * 100).toFixed(1) + "%" : "-";
    box.innerHTML =
      `<b>${S.running ? "● RUNNING" : "○ STOPPED"}</b> · ${CFG.live ? "<span style='color:#f85149'>LIVE</span>" : "DRY"}<br>` +
      `Price: ${S.lastPrice ?? "no reading"}<br>` +
      `Trades: ${S.trades} · W/L: ${S.wins}/${S.losses} · WR: ${wr}<br>` +
      (r != null ? `RSI ${r.toFixed(1)} · EMA ${f.toFixed(5)}/${s.toFixed(5)}<br>` : "") +
      (sig ? `Last signal: ${sig}` : "");
  }

  function tick() {
    const p = readPrice();
    if (p == null) return;
    S.lastPrice = p;
    updateCandle(p);
  }

  function start() {
    if (S.running) return;
    if (!CFG.priceSelector) { log("Set CFG price selector first: BOT.setPriceSelector('css selector')"); return; }
    S.running = true;
    S.timer = setInterval(tick, 500);
    render(); log("Started. Mode:", CFG.live ? "LIVE" : "DRY RUN");
  }
  function stop() { S.running = false; clearInterval(S.timer); render(); log("Stopped."); }

  window.BOT = {
    start, stop,
    live(v) { CFG.live = !!v; render(); log("Mode:", CFG.live ? "LIVE (real clicks!)" : "DRY RUN"); },
    setPriceSelector(sel) { CFG.priceSelector = sel; log("Price now reads:", readPrice()); },
    status() { log({ ...S, candles: S.candles.length, price: readPrice() }); },
    config: CFG,
    remove() { stop(); box.remove(); delete window.BOT; log("Removed."); },
  };

  render();
  log("Loaded in DRY RUN. 1) BOT.setPriceSelector('...')  2) BOT.start()  3) watch stats on demo.");
})();
