/* ============================================================================
 * QX AutoTrader v1.1.0
 * Browser-console auto-trading bot for the Quotex web platform (M1 / binary)
 * ----------------------------------------------------------------------------
 * Strategy   : EMA(3/8) crossover + RSI(14) momentum filter on M1 candles
 * Stake      : fixed amount (configurable, default 1)
 * Risk guard : session loss-stop, single open trade, demo-account guard
 * Data feed  : DOM live-price sampler (default) + optional WebSocket sniffer
 * Expiry     : 60 seconds (matches the signal candle)
 *
 * QUICK START
 *   1. Log in to Quotex, open the trading page, select your pair (DEMO first!)
 *   2. Press F12 -> Console (Chrome may require typing "allow pasting" once)
 *   3. Paste this entire file and press Enter. A panel appears top-right.
 *   4. Wait for candles to build (min 30) or run QXBot.useWebSocket() to
 *      warm up faster, then press START on the panel.
 *
 * COMMANDS
 *   QXBot.start()  QXBot.stop()  QXBot.status()  QXBot.config({...})
 *   QXBot.calibrate()  QXBot.setSelectors({up,down,amount,price,balance})
 *   QXBot.testTrade('call'|'put')  QXBot.useWebSocket()
 *   QXBot.backtest(csvText, {emaFast,emaSlow,...})  QXBot.allowReal()
 *   QXBot.debug(true)  QXBot.diag()  QXBot.destroy()
 *
 * DISCLAIMER
 *   Educational tool for personal automation of YOUR OWN account.
 *   Binary options carry extreme risk of capital loss. Automated trading may
 *   violate the broker's terms of service. No strategy is guaranteed to be
 *   profitable. Test on DEMO funds only until you fully understand the risks.
 * ========================================================================== */
(() => {
'use strict';

/* -------- 0. remove previous instance -------- */
if (window.QXBot && typeof window.QXBot.destroy === 'function') {
  try { window.QXBot.destroy(); } catch (e) {}
}

/* -------- 1. configuration -------- */
const VERSION = '1.1.0';
const DEFAULTS = {
  stake: 1,               // fixed stake per trade
  lossLimit: 10,          // session loss-stop in account currency
  expirySeconds: 60,      // binary option expiry
  emaFast: 3,
  emaSlow: 8,
  rsiPeriod: 14,
  rsiFilter: true,        // CALL needs RSI > 50, PUT needs RSI < 50
  rsiLevel: 50,
  minCandles: 30,         // warm-up before signals are trusted
  cooldownSeconds: 0,     // extra wait between trades (0 = off)
  accountMode: 'demo',    // 'demo' | 'real'  (demo mode blocks real accounts)
  backtestPayout: 0.85,   // assumed payout ratio used by the backtester
  debug: false
};
const CFG = Object.assign({}, DEFAULTS);

/* CSS selectors used to drive the page. Override with QXBot.setSelectors() */
const SEL = {
  amount:  'input[name="amount"]',
  up:      null,
  down:    null,
  price:   null,
  balance: null
};

/* -------- 2. runtime state -------- */
const S = {
  running: false,
  blockedReason: null,
  realOverride: false,
  price: null,
  priceEl: null,
  priceObs: null,
  priceSrc: 'dom',
  lastDomValue: null,
  assetName: null,
  ticks: 0,
  candles: [],            // closed M1 candles {t,o,h,l,c}
  cur: null,              // forming candle
  lastEvalT: 0,
  openTrade: null,
  cooldownUntil: 0,
  stats: { trades: 0, wins: 0, losses: 0, ties: 0, pl: 0 },
  history: [],            // resolved trades, newest first
  timers: [],
  obs: [],
  wsArmed: false,
  wsOrigSend: null,
  wsTickCounts: {},
  wsDominant: null,
  dbgSeen: {},
  cache: { amount: null, up: null, down: null, balance: null, ts: 0 }
};

/* -------- 3. utils -------- */
function log(msg, kind) {
  const tag = kind === 'err' ? '\u2717' : kind === 'ok' ? '\u2713' : kind === 'warn' ? '!' : '\u00bb';
  const style = kind === 'err' ? 'color:#e74c3c' : kind === 'ok' ? 'color:#2ecc71' : kind === 'warn' ? 'color:#f39c12' : 'color:#9aa7b8';
  console.log('%c[QX]' + tag + ' ' + msg, style);
  uiPushLog(msg, kind);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fmtMoney(v) {
  if (v == null || isNaN(v)) return '\u2014';
  return (v < 0 ? '-$' : '+$') + Math.abs(v).toFixed(2);
}
function fmtBal(v) { return v == null ? '\u2014' : '$' + Number(v).toFixed(2); }
function fmtTime(ts) {
  const d = new Date(ts);
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
}

/* -------- 4. indicators -------- */
function emaSeries(vals, p) {
  const k = 2 / (p + 1);
  const out = new Array(vals.length);
  let e = vals[0];
  for (let i = 0; i < vals.length; i++) {
    e = i === 0 ? vals[0] : vals[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}
function rsiLast(closes, p) {
  if (closes.length < p + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  let ag = g / p, al = l / p;
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (p - 1) + Math.max(d, 0)) / p;
    al = (al * (p - 1) + Math.max(-d, 0)) / p;
  }
  if (al === 0) return 100;
  const rs = ag / al;
  return 100 - 100 / (1 + rs);
}

/* Signal computed on CLOSED candles only (last element of `cs`). */
function signalFor(cs) {
  if (cs.length < Math.max(CFG.minCandles, CFG.emaSlow + 2)) return null;
  const closes = cs.map(c => c.c);
  const ef = emaSeries(closes, CFG.emaFast);
  const es = emaSeries(closes, CFG.emaSlow);
  const i = closes.length - 1;
  const dPrev = ef[i - 1] - es[i - 1];
  const dNow = ef[i] - es[i];
  let dir = null, why = '';
  if (dPrev <= 0 && dNow > 0) { dir = 'call'; why = 'EMA' + CFG.emaFast + '\u2191cross EMA' + CFG.emaSlow; }
  else if (dPrev >= 0 && dNow < 0) { dir = 'put'; why = 'EMA' + CFG.emaFast + '\u2193cross EMA' + CFG.emaSlow; }
  if (!dir) return null;
  if (CFG.rsiFilter) {
    const r = rsiLast(closes, CFG.rsiPeriod);
    if (r == null) return null;
    if (dir === 'call' && r <= CFG.rsiLevel) return null;
    if (dir === 'put' && r >= CFG.rsiLevel) return null;
    why += ' \u00b7 RSI ' + r.toFixed(1);
  }
  return { dir: dir, why: why };
}

/* -------- 5. candle engine -------- */
function addTick(price, ts) {
  ts = ts || Date.now();
  S.ticks++;
  S.price = price;
  const b = Math.floor(ts / 60000) * 60000;
  if (!S.cur) {
    S.cur = { t: b, o: price, h: price, l: price, c: price };
    return;
  }
  if (b === S.cur.t) {
    if (price > S.cur.h) S.cur.h = price;
    if (price < S.cur.l) S.cur.l = price;
    S.cur.c = price;
  } else if (b > S.cur.t) {
    const closed = { t: S.cur.t, o: S.cur.o, h: S.cur.h, l: S.cur.l, c: S.cur.c };
    S.cur = { t: b, o: price, h: price, l: price, c: price };
    onCandleClosed(closed);
  }
  /* ticks older than the forming minute are ignored */
}
function onCandleClosed(c) {
  const last = S.candles[S.candles.length - 1];
  if (!last || last.t !== c.t) S.candles.push(c);
  if (S.candles.length > 300) S.candles.splice(0, S.candles.length - 300);
  evaluateSignal(c);
}
/* Safety: if the price feed stalls across a minute boundary, close the
   forming candle virtually using the last known price. */
function forceRollIfNeeded() {
  if (!S.cur) return;
  if (Date.now() - S.cur.t >= 62000) {
    const closed = { t: S.cur.t, o: S.cur.o, h: S.cur.h, l: S.cur.l, c: S.cur.c };
    S.cur = null;
    onCandleClosed(closed);
  }
}
function evaluateSignal() {
  if (!S.running) return;
  const s = signalFor(S.candles);
  S.lastSignal = s;
  const lastT = S.candles.length ? S.candles[S.candles.length - 1].t : 0;
  if (!s || lastT === S.lastEvalT) return;
  S.lastEvalT = lastT;
  if (canTrade()) placeTrade(s.dir, s.why);
}

/* -------- 6. DOM finders -------- */
const UP_RX = /(up|higher|call|buy|above)/i;
const DOWN_RX = /(down|lower|put|sell|below)/i;
const PRICE_RX = /^\s*(?:[$\u20ac\u00a3\u20bd\u20ba]?\s*)?(\d{1,7}(?:[.,]\d{2,8}))\s*$/;
const BAL_RX = /[$\u20ac\u00a3\u20bd\u20ba]\s*([\d,\s]{1,15}(?:\.\d{1,2})?)/;

function channelOf(rgb) {
  const m = String(rgb).match(/\d+/g);
  if (!m) return null;
  const r = +m[0], g = +m[1], b = +m[2];
  if (g > 90 && g - r > 30 && g - b > 30) return 'green';
  if (r > 90 && r - g > 30 && r - b > 30) return 'red';
  return null;
}

/* Effective button color: handles GRADIENT backgrounds (Quotex uses
   linear-gradient fills where backgroundColor is transparent) and falls
   through to children (depth-limited) for icon-wrapped buttons. */
function elementColor(el, depth) {
  if (!el || (depth || 0) > 2) return null;
  let cs;
  try { cs = getComputedStyle(el); } catch (e) { return null; }
  let c = channelOf(cs.backgroundColor);
  if (!c && cs.backgroundImage && cs.backgroundImage !== 'none') {
    const stops = cs.backgroundImage.match(/rgba?\([^)]+\)/g) || [];
    for (const s of stops) { c = channelOf(s); if (c) break; }
  }
  if (!c && el.children.length && el.children.length <= 4) {
    for (const ch of el.children) {
      c = elementColor(ch, (depth || 0) + 1);
      if (c) break;
    }
  }
  return c;
}

/* Deal buttons: big green (UP) / red (DOWN) clickable blocks in the lower
   half of the screen. Quotex labels may be icons only, so color + position
   is the primary signal, text/aria is a bonus. */
function findDealButton(which) {
  if (SEL[which]) {
    const el = document.querySelector(SEL[which]);
    if (el) return el;
  }
  const c = S.cache;
  if (c[which] && c[which].isConnected && Date.now() - c.ts < 10000) return c[which];
  const wantColor = which === 'up' ? 'green' : 'red';
  const rx = which === 'up' ? UP_RX : DOWN_RX;
  let best = null, bestScore = -1;
  const nodes = document.querySelectorAll('button,[role="button"],a,div');
  for (const el of nodes) {
    if (el.children.length > 6) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 70 || r.height < 34) continue;
    if (r.top < window.innerHeight * 0.35) continue;
    const col = elementColor(el);
    if (col !== wantColor) continue;
    let score = 2;
    const txt = (el.innerText || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('data-testid') || '');
    if (rx.test(txt)) score += 3;
    if (el.tagName === 'BUTTON') score += 1;
    if (score > bestScore) { bestScore = score; best = el; }
  }
  if (best) { c[which] = best; c.ts = Date.now(); }
  return best;
}

/* Price element scan: Quotex renders the live quote in many possible spots,
   so we do a statistical pass instead of trusting one selector:
     1. Seed every element whose full text looks like a price (leaf or not).
     2. Watch 6s of mutations, counting the element AND its 2 ancestors
        (the real container updates whenever its child spans change).
     3. Score = updates*4 + decimals*3  → full precise price wins over
        partial fragments like "1.10".
     4. If nothing moved (market closed / canvas feed), attach the best
        static candidate anyway and warn the user. */
function startPriceScan(done) {
  if (SEL.price) {
    const el = document.querySelector(SEL.price);
    if (el) { attachPriceEl(el, true); if (done) done(true); return; }
  }
  log('Scanning for the live price element (~6s)...', 'warn');
  const counts = new Map();
  const decimals = new Map();
  const seeds = [];
  const inBotPanel = el => !!(el.closest && el.closest('.qxab-panel'));
  document.querySelectorAll('div,span,p,b,td,strong').forEach(el => {
    if (inBotPanel(el)) return;
    const txt = (el.textContent || '').trim();
    if (txt.length < 4 || txt.length > 20) return;
    const m = PRICE_RX.exec(txt);
    if (!m) return;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.width > 460 || r.height < 8 || r.height > 80) return;
    seeds.push(el);
    counts.set(el, 0);
    decimals.set(el, (m[1].split(/[.,]/)[1] || '').length);
  });
  if (!seeds.length) { log('No price-like elements found on the page.', 'err'); if (done) done(false); return; }
  const countUp = el => {
    let hop = 0;
    while (el && el.isConnected && hop < 3) {
      if (counts.has(el)) counts.set(el, counts.get(el) + 1);
      el = el.parentElement;
      hop++;
    }
  };
  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      const el = m.target instanceof Element ? m.target : m.target.parentElement;
      if (el && PRICE_RX.test((el.textContent || '').trim())) countUp(el);
    }
  });
  try { obs.observe(document.body, { subtree: true, childList: true, characterData: true }); }
  catch (e) { if (done) done(false); return; }
  setTimeout(() => {
    obs.disconnect();
    let best = null, bestScore = -1, bestN = 0;
    counts.forEach((n, el) => {
      if (!el.isConnected) return;
      const score = n * 4 + (decimals.get(el) || 0) * 3;
      if (score > bestScore) { bestScore = score; bestN = n; best = el; }
    });
    if (best) {
      attachPriceEl(best);
      if (bestN >= 1) {
        log('Live price element found (' + bestN + ' updates in 6s, ' + (decimals.get(best) || 0) + ' decimals).', 'ok');
      } else {
        log('No moving price found \u2014 attached best static candidate. If the price never changes the market may be CLOSED: pick an OTC pair or crypto, or run QXBot.useWebSocket().', 'warn');
      }
      if (done) done(true);
    } else {
      if (done) done(false);
    }
  }, 6000);
}
function attachPriceEl(el, force) {
  /* WS feed takes priority once active — a finishing DOM scan must not
     hijack the feed back (race when both start at once). */
  if (S.priceSrc === 'ws' && !force) {
    log('WebSocket feed already active — ignoring DOM price element.', 'info');
    return;
  }
  detachPriceDom();
  S.priceEl = el;
  S.priceSrc = 'dom';
  const readNow = () => {
    const m = PRICE_RX.exec(el.textContent || '');
    if (m) {
      const p = parseFloat(m[1].replace(',', '.'));
      if (p > 0) {
        S.lastDomValue = el.textContent;
        if (S.priceSrc === 'dom') addTick(p);
      }
    }
  };
  readNow();
  S.priceObs = new MutationObserver(readNow);
  S.priceObs.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
  S.obs.push(S.priceObs);
}
/* 1s poll fallback in case MutationObserver misses framework-driven updates */
function domPollTick() {
  if (S.priceSrc !== 'dom' || !S.priceEl) return;
  if (!S.priceEl.isConnected) { S.priceEl = null; return; }
  const t = S.priceEl.textContent;
  if (t !== S.lastDomValue) {
    const m = PRICE_RX.exec(t || '');
    if (m) {
      const p = parseFloat(m[1].replace(',', '.'));
      if (p > 0) { S.lastDomValue = t; addTick(p); }
    }
  }
}
function detachPriceDom() {
  if (S.priceObs) { try { S.priceObs.disconnect(); } catch (e) {} S.priceObs = null; }
  S.priceEl = null;
}

/* -------- 7. executor -------- */
function setStake(v) {
  const inp = findAmountInput();
  if (!inp) { log('Amount input not found \u2014 run QXBot.calibrate()', 'err'); return false; }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, String(v));
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  if (parseFloat(inp.value) !== Number(v)) {
    inp.value = String(v);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return true;
}
function checkAccount() {
  readBalance(true);
  if (S.accountIsReal === true && CFG.accountMode !== 'real' && !S.realOverride) {
    const msg = 'Platform is on a REAL account. Bot refuses to trade. Switch to Demo, or run QXBot.allowReal() to accept the risk.';
    log('\u26d4 ' + msg, 'err');
    S.blockedReason = msg;
    uiRefresh();
    return false;
  }
  return true;
}
function placeTrade(dir, reason) {
  if (S.openTrade) return false;
  if (!checkAccount()) return false;
  const stake = Number(CFG.stake) || 1;
  if (!setStake(stake)) return false;
  const btn = findDealButton(dir === 'call' ? 'up' : 'down');
  if (!btn) {
    log((dir === 'call' ? 'UP' : 'DOWN') + ' button not found \u2014 run QXBot.calibrate()', 'err');
    return false;
  }
  const balBefore = readBalance();
  btn.click();
  const t = {
    dir: dir, stake: stake,
    openedAt: Date.now(),
    expiryAt: Date.now() + CFG.expirySeconds * 1000,
    entry: S.price, reason: reason,
    ref: null, refDone: false
  };
  S.openTrade = t;
  S.stats.trades++;
  log((dir === 'call' ? '\u25b2 CALL' : '\u25bc PUT') + ' $' + stake + ' @ ' + S.price + ' [' + reason + ']', 'info');
  /* capture the post-deduction balance to measure the result later */
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const b = readBalance();
    if (b != null && balBefore != null && b < balBefore - 1e-9) { t.ref = b; t.refDone = true; clearInterval(iv); }
    else if (tries > 8) { t.ref = balBefore != null ? balBefore - stake : null; t.refDone = true; clearInterval(iv); }
  }, 350);
  S.timers.push(iv);
  uiRefresh();
  return true;
}
function checkOpenTrade() {
  const t = S.openTrade;
  if (!t) return;
  if (Date.now() < t.expiryAt + 2500) return;
  const bal = readBalance(true);
  let result, pl;
  if (bal != null && t.ref != null) {
    const d = bal - t.ref;
    if (d > 1e-9) { result = 'WIN'; pl = d; S.stats.wins++; }
    else if (d >= -1e-9) { result = 'TIE (stake refunded)'; pl = 0; S.stats.ties++; }
    else { result = 'LOSS'; pl = d; S.stats.losses++; }
    S.stats.pl += pl;
  } else {
    result = 'UNKNOWN (balance unreadable)'; pl = -t.stake;
    S.stats.pl += pl; S.stats.losses++;
  }
  S.openTrade = null;
  S.cooldownUntil = Date.now() + (CFG.cooldownSeconds || 0) * 1000;
  const kind = result === 'WIN' ? 'ok' : 'warn';
  log(fmtTime(Date.now()) + ' ' + (t.dir === 'call' ? 'CALL' : 'PUT') + ' \u2192 ' + result + ' ' + fmtMoney(pl) +
      '  (session ' + fmtMoney(S.stats.pl) + ')', kind);
  S.history.unshift({ time: fmtTime(t.openedAt), dir: t.dir, stake: t.stake, result: result, pl: pl, reason: t.reason });
  if (S.history.length > 100) S.history.pop();
  if (S.stats.pl <= -CFG.lossLimit) {
    stop('LOSS LIMIT reached (' + fmtMoney(S.stats.pl) + ') \u2014 bot stopped for your safety.');
  }
  uiRefresh();
}

/* -------- 8. risk + engine -------- */
function canTrade() {
  if (!S.running) return false;
  if (S.openTrade) return false;
  if (Date.now() < S.cooldownUntil) return false;
  if (S.candles.length < CFG.minCandles) return false;
  if (S.stats.pl <= -CFG.lossLimit) {
    stop('LOSS LIMIT reached (' + fmtMoney(S.stats.pl) + ').');
    return false;
  }
  return true;
}
function start() {
  S.blockedReason = null;
  if (S.running) { log('Already running.', 'warn'); return; }
  if (!checkAccount()) return;
  if (S.priceSrc === 'dom') {
    if (S.priceEl && S.priceEl.isConnected) {
      launch();
      return;
    }
    S.priceEl = null;
    startPriceScan(ok => {
      if (ok) {
        S.blockedReason = null;
        if (!S.running) launch();
      } else {
        /* Auto-fallback: arm the WebSocket sniffer so tick data can still
           reach the candle engine even when the DOM price can't be found. */
        S.blockedReason = 'Price element not found \u2014 armed WebSocket fallback. If no WS ticks arrive within 15s, run QXBot.diag() and send me the output.';
        log(S.blockedReason, 'warn');
        try { useWebSocket(); } catch (e) {}
        S.retries = (S.retries || 0) + 1;
        if (S.retries <= 3) {
          S.timers.push(setTimeout(() => { if (!S.running && !S.priceEl) { log('Retrying price scan (' + S.retries + '/3)\u2026', 'info'); start(); } }, 12000));
        }
        uiRefresh();
      }
    });
    S.blockedReason = 'scanning for price element\u2026';
    uiRefresh();
    return;
  }
  launch();
}
function launch() {
  S.running = true;
  S.blockedReason = null;
  log('\u25b6 STARTED \u2014 EMA(' + CFG.emaFast + '/' + CFG.emaSlow + ')' +
      (CFG.rsiFilter ? ' + RSI(' + CFG.rsiPeriod + '>' + CFG.rsiLevel + '/' + CFG.rsiLevel + ')' : '') +
      ' \u00b7 stake ' + CFG.stake + ' \u00b7 loss-stop ' + CFG.lossLimit +
      ' \u00b7 warm-up: ' + S.candles.length + '/' + CFG.minCandles + ' candles', 'ok');
  uiRefresh();
}
function stop(reason) {
  S.running = false;
  S.blockedReason = reason || null;
  log('\u25a0 STOPPED' + (reason ? ' \u2014 ' + reason : ''), reason ? 'warn' : 'info');
  uiRefresh();
}
function housekeeping() {
  domPollTick();
  forceRollIfNeeded();
  checkOpenTrade();
  uiRefresh();
}
S.timers.push(setInterval(housekeeping, 1000));

/* -------- 9. WebSocket sniffer (optional, read-only) -------- */
function useWebSocket() {
  if (S.wsArmed) { log('WS sniffer already armed.', 'warn'); return; }
  S.wsOrigSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      if (!this.__qxTagged) { this.__qxTagged = true; attachWs(this); }
    } catch (e) {}
    return S.wsOrigSend.call(this, data);
  };
  S.wsArmed = true;
  log('WS sniffer armed \u2014 it attaches to the platform socket the next time it sends (usually < 5s). Ticks will then feed the candle engine directly and warm-up is much faster.', 'ok');
}
function attachWs(sock) {
  sock.addEventListener('message', ev => {
    if (typeof ev.data === 'string') handleFrame(ev.data);
  });
  log('Attached to a live WebSocket \u2014 sniffing ticks.', 'ok');
}
function handleFrame(txt) {
  let obj = null;
  try { obj = JSON.parse(txt); }
  catch (e) {
    const m = /^\d+([\[{].*)$/.exec(txt);
    if (m) { try { obj = JSON.parse(m[1]); } catch (e2) {} }
  }
  if (obj == null) { if (CFG.debug) sampleDbg('unparsed', txt.slice(0, 140)); return; }
  ingest(obj, 0);
}
function ingest(o, depth) {
  if (o == null || depth > 4) return;
  if (Array.isArray(o)) { for (const x of o) ingest(x, depth + 1); return; }
  if (typeof o !== 'object') return;
  for (const k of ['history', 'candles', 'data']) {
    const v = o[k];
    if (Array.isArray(v) && v.length > 10) trySeed(v);
  }
  const asset = o.asset || o.instrument || o.symbol || o.market;
  if (typeof asset === 'string') {
    const price = pickPrice(o);
    const ts = pickTs(o);
    if (price != null) noteWsTick(asset, price, ts);
  }
  for (const k in o) {
    const v = o[k];
    if (v && typeof v === 'object') ingest(v, depth + 1);
  }
}
function pickPrice(o) {
  for (const k of ['price', 'quote', 'p', 'close', 'currentPrice', 'value']) {
    const v = o[k];
    if (typeof v === 'number' && isFinite(v) && v > 0) return v;
  }
  return null;
}
function pickTs(o) {
  for (const k of ['ts', 'time', 'timestamp', 't']) {
    const v = o[k];
    if (typeof v === 'number' && v > 1e9) return v < 1e12 ? v * 1000 : v;
  }
  return Date.now();
}
function noteWsTick(asset, price, ts) {
  if (S.wsDominant == null) S.wsDominant = asset;
  S.wsTickCounts[asset] = (S.wsTickCounts[asset] || 0) + 1;
  if (asset === S.wsDominant) {
    if (S.priceSrc !== 'ws') {
      S.priceSrc = 'ws';
      S.assetName = asset;
      detachPriceDom();
      log('\ud83d\udce1 WS tick feed active for ' + asset + ' \u2014 price source switched to WebSocket.', 'ok');
    }
    addTick(price, ts);
  } else if (S.wsTickCounts[asset] > (S.wsTickCounts[S.wsDominant] || 0) * 1.2) {
    S.wsDominant = asset;
  }
}
function trySeed(items) {
  const out = [];
  for (const it of items) {
    let c = null;
    if (Array.isArray(it) && it.length >= 5 && typeof it[0] === 'number') {
      const t = it[0] < 1e12 ? it[0] * 1000 : it[0];
      c = { t: Math.floor(t / 60000) * 60000, o: it[1], h: it[2], l: it[3], c: it[4] };
    } else if (it && typeof it === 'object') {
      const t = it.time || it.t || it.ts || it.timestamp;
      const o = it.open != null ? it.open : it.o;
      const h = it.high != null ? it.high : it.h;
      const l = it.low != null ? it.low : it.l;
      const cl = it.close != null ? it.close : it.c;
      if (t != null && o != null && cl != null) {
        const tt = Number(t) < 1e12 ? Number(t) * 1000 : Number(t);
        c = { t: Math.floor(tt / 60000) * 60000, o: Number(o), h: Number(h), l: Number(l), c: Number(cl) };
      }
    }
    if (c && isFinite(c.o) && isFinite(c.c) && c.c > 0) out.push(c);
  }
  if (out.length > S.candles.length) {
    out.sort((a, b) => a.t - b.t);
    const dedup = [];
    for (const c of out) { if (!dedup.length || dedup[dedup.length - 1].t !== c.t) dedup.push(c); }
    S.candles = dedup.slice(-300);
    if (!S.wsSeedDone || out.length > 50) {
      log('\ud83c\udff7 Seeded ' + S.candles.length + ' historical candles from WebSocket history.', 'ok');
      S.wsSeedDone = true;
    }
  }
}
function sampleDbg(tag, txt) {
  const key = tag + ':' + (txt.match(/"[a-zA-Z_]+"/) || ['?'])[0];
  if (S.dbgSeen[key]) return;
  S.dbgSeen[key] = 1;
  console.log('[QX][dbg][' + tag + ']', txt);
}

/* -------- 10. backtester (uses the same signalFor as live trading) -------- */
function parseCsvCandles(text) {
  const rows = String(text).split(/\r?\n/);
  const out = [];
  for (const line of rows) {
    if (!line || !line.trim()) continue;
    const cols = line.trim().split(/[,\t;]/).map(s => s.trim());
    if (cols.length < 5) continue;
    let t = Number(cols[0]);
    if (!isFinite(t) || t <= 0) {
      const d = Date.parse(cols[0]);
      if (isNaN(d)) continue;
      t = d;
    }
    if (t < 1e12) t *= 1000;
    const o = parseFloat(cols[1]), h = parseFloat(cols[2]), l = parseFloat(cols[3]), c = parseFloat(cols[4]);
    if (![o, h, l, c].every(Number.isFinite) || c <= 0) continue;
    out.push({ t: Math.floor(t / 60000) * 60000, o: o, h: h, l: l, c: c });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
function backtest(csvText, opts) {
  opts = opts || {};
  const saved = Object.assign({}, CFG);
  Object.assign(CFG, {
    emaFast: opts.emaFast != null ? opts.emaFast : CFG.emaFast,
    emaSlow: opts.emaSlow != null ? opts.emaSlow : CFG.emaSlow,
    rsiPeriod: opts.rsiPeriod != null ? opts.rsiPeriod : CFG.rsiPeriod,
    rsiFilter: opts.rsiFilter != null ? opts.rsiFilter : CFG.rsiFilter,
    rsiLevel: opts.rsiLevel != null ? opts.rsiLevel : CFG.rsiLevel,
    minCandles: opts.minCandles != null ? opts.minCandles : CFG.minCandles
  });
  const payout = opts.payout != null ? opts.payout : CFG.backtestPayout;
  const stake = opts.stake != null ? opts.stake : CFG.stake;
  try {
    const candles = parseCsvCandles(csvText);
    if (candles.length < CFG.minCandles + 2) {
      log('backtest: need at least ' + (CFG.minCandles + 2) + ' valid candles, got ' + candles.length, 'err');
      return null;
    }
    let trades = 0, wins = 0, losses = 0, ties = 0, pl = 0;
    for (let i = CFG.minCandles; i < candles.length - 1; i++) {
      const s = signalFor(candles.slice(0, i + 1));
      if (!s) continue;
      trades++;
      const a = candles[i].c, b = candles[i + 1].c;
      if (b === a) { ties++; continue; }
      const won = s.dir === 'call' ? b > a : b < a;
      if (won) { wins++; pl += stake * payout; }
      else { losses++; pl -= stake; }
    }
    const wr = wins + losses > 0 ? (wins / (wins + losses) * 100) : 0;
    log('\ud83d\udcca BACKTEST \u2014 candles: ' + candles.length +
        ' \u00b7 signals: ' + trades + ' \u00b7 W/L/T: ' + wins + '/' + losses + '/' + ties +
        ' \u00b7 win-rate: ' + wr.toFixed(1) + '% \u00b7 P/L: ' + fmtMoney(pl) +
        ' \u00b7 breakeven \u2248 ' + (100 / (1 + payout)).toFixed(1) + '%', wr > 100 / (1 + payout) ? 'ok' : 'warn');
    return { candles: candles.length, trades: trades, wins: wins, losses: losses, ties: ties, winRate: wr, pnl: pl, params: { emaFast: CFG.emaFast, emaSlow: CFG.emaSlow, rsiPeriod: CFG.rsiPeriod, rsiFilter: CFG.rsiFilter, rsiLevel: CFG.rsiLevel, minCandles: CFG.minCandles, payout: payout, stake: stake } };
  } finally {
    Object.assign(CFG, saved);
  }
}

/* -------- 11. floating UI panel -------- */
const PANEL_CSS = [
  '.qxab-panel{position:fixed;top:16px;right:16px;width:274px;background:rgba(15,19,27,.94);backdrop-filter:blur(10px);color:#e6edf3;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;border:1px solid #2a3342;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.5);z-index:2147483647;user-select:none}',
  '.qxab-head{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:move;border-bottom:1px solid #2a3342;font-weight:700;letter-spacing:.3px}',
  '.qxab-dot{width:8px;height:8px;border-radius:50%;background:#6b7686;flex:none}',
  '.qxab-dot.on{background:#2ecc71;box-shadow:0 0 7px #2ecc71}',
  '.qxab-dot.off{background:#e74c3c}',
  '.qxab-dot.warn{background:#f39c12;box-shadow:0 0 7px #f39c12}',
  '.qxab-title{flex:1}',
  '.qxab-min,.qxab-x{cursor:pointer;color:#8b98a9;padding:0 4px;font-weight:700}',
  '.qxab-min:hover,.qxab-x:hover{color:#fff}',
  '.qxab-body{padding:10px 12px 8px}',
  '.qxab-status{font-size:11px;color:#8b98a9;min-height:15px;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.qxab-status.run{color:#2ecc71}.qxab-status.block{color:#f39c12}',
  '.qxab-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 10px}',
  '.qxab-k{color:#8b98a9}.qxab-v{text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.qxab-v.up{color:#2ecc71}.qxab-v.down{color:#e74c3c}',
  '.qxab-btns{display:flex;gap:8px;margin-top:10px}',
  '.qxab-btn{flex:1;padding:7px 0;border:0;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;font-family:inherit}',
  '.qxab-start{background:#1f8b4c;color:#fff}.qxab-start:hover{background:#23a55a}',
  '.qxab-stop{background:#a93226;color:#fff}.qxab-stop:hover{background:#c0392b}',
  '.qxab-test{background:#243040;color:#9fb3c8;font-size:10px;padding:5px 0}.qxab-test:hover{background:#2e3d52;color:#fff}',
  '.qxab-cfg{display:flex;gap:8px;margin-top:8px}',
  '.qxab-cfg label{flex:1;font-size:9px;color:#8b98a9;display:flex;flex-direction:column;gap:2px;text-transform:uppercase;letter-spacing:.4px}',
  '.qxab-cfg input{background:#0d1117;border:1px solid #2a3342;color:#e6edf3;border-radius:6px;padding:4px 6px;font:inherit;font-size:11px;width:100%;box-sizing:border-box}',
  '.qxab-log{margin-top:8px;border-top:1px solid #2a3342;padding-top:6px;max-height:118px;overflow-y:auto;font-size:10.5px}',
  '.qxab-log .i{color:#9aa7b8}.qxab-log .ok{color:#2ecc71}.qxab-log .err{color:#e74c3c}.qxab-log .warn{color:#f39c12}',
  '.qxab-log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:1px 0}',
  '.qxab-foot{padding:6px 12px;border-top:1px solid #2a3342;color:#66788c;font-size:9.5px;display:flex;justify-content:space-between}',
  '.qxab-foot b{color:#8b98a9}'
].join('\n');

let panel = null, logBox = null, minimized = false;
let refs = {};
function buildPanel() {
  if (document.getElementById('qxab-style')) return;
  const st = document.createElement('style');
  st.id = 'qxab-style';
  st.textContent = PANEL_CSS;
  document.head.appendChild(st);

  panel = document.createElement('div');
  panel.className = 'qxab-panel';
  panel.innerHTML =
    '<div class="qxab-head">' +
      '<span class="qxab-dot" id="qxab-dot"></span>' +
      '<span class="qxab-title">QX AutoTrader <span style="color:#66788c;font-weight:400">' + VERSION + '</span></span>' +
      '<span class="qxab-min" title="minimize">\u2013</span>' +
      '<span class="qxab-x" title="remove bot"> \u00d7</span>' +
    '</div>' +
    '<div class="qxab-wrap">' +
      '<div class="qxab-body">' +
        '<div class="qxab-status" id="qxab-status">loaded \u2014 pick your pair, then START (demo first)</div>' +
        '<div class="qxab-grid">' +
          '<span class="qxab-k">Asset</span><span class="qxab-v" id="qxab-asset">\u2014</span>' +
          '<span class="qxab-k">Price</span><span class="qxab-v" id="qxab-price">\u2014</span>' +
          '<span class="qxab-k">Candles</span><span class="qxab-v" id="qxab-candles">0/30</span>' +
          '<span class="qxab-k">Signal</span><span class="qxab-v" id="qxab-signal">\u2014</span>' +
          '<span class="qxab-k">Trades</span><span class="qxab-v" id="qxab-trades">0</span>' +
          '<span class="qxab-k">Win rate</span><span class="qxab-v" id="qxab-wr">\u2014</span>' +
          '<span class="qxab-k">Session P/L</span><span class="qxab-v" id="qxab-pl">\u2014</span>' +
          '<span class="qxab-k">Balance</span><span class="qxab-v" id="qxab-bal">\u2014</span>' +
        '</div>' +
        '<div class="qxab-btns">' +
          '<button class="qxab-btn qxab-start" id="qxab-start">START</button>' +
          '<button class="qxab-btn qxab-stop" id="qxab-stop">STOP</button>' +
        '</div>' +
        '<div class="qxab-btns">' +
          '<button class="qxab-btn qxab-test" id="qxab-tcall">TEST CALL</button>' +
          '<button class="qxab-btn qxab-test" id="qxab-tput">TEST PUT</button>' +
        '</div>' +
        '<div class="qxab-cfg">' +
          '<label>Stake<input type="number" step="0.1" min="0.1" id="qxab-stake" value="' + CFG.stake + '"></label>' +
          '<label>Loss stop<input type="number" step="1" min="1" id="qxab-limit" value="' + CFG.lossLimit + '"></label>' +
        '</div>' +
      '</div>' +
      '<div class="qxab-log" id="qxab-log"></div>' +
      '<div class="qxab-foot"><span><b id="qxab-acct">acct: ?</b></span><span>demo first \u00b7 educational use</span></div>' +
    '</div>';
  document.body.appendChild(panel);

  /* drag */
  const head = panel.querySelector('.qxab-head');
  head.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('qxab-min') || e.target.classList.contains('qxab-x')) return;
    const r = panel.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    const mv = ev => {
      panel.style.left = Math.max(0, ev.clientX - ox) + 'px';
      panel.style.top = Math.max(0, ev.clientY - oy) + 'px';
      panel.style.right = 'auto';
    };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', mv);
    document.addEventListener('pointerup', up);
  });
  panel.querySelector('.qxab-min').addEventListener('click', () => {
    minimized = !minimized;
    panel.querySelector('.qxab-wrap').style.display = minimized ? 'none' : '';
  });
  panel.querySelector('.qxab-x').addEventListener('click', () => BOT.destroy());

  panel.querySelector('#qxab-start').addEventListener('click', () => start());
  panel.querySelector('#qxab-stop').addEventListener('click', () => stop());
  panel.querySelector('#qxab-tcall').addEventListener('click', () => testTrade('call'));
  panel.querySelector('#qxab-tput').addEventListener('click', () => testTrade('put'));
  panel.querySelector('#qxab-stake').addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    if (v > 0) { CFG.stake = v; log('Stake set to ' + v, 'info'); }
  });
  panel.querySelector('#qxab-limit').addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    if (v >= 1) { CFG.lossLimit = v; log('Loss stop set to ' + v, 'info'); }
  });
  logBox = panel.querySelector('#qxab-log');
  refs = {
    dot: panel.querySelector('#qxab-dot'),
    status: panel.querySelector('#qxab-status'),
    asset: panel.querySelector('#qxab-asset'),
    price: panel.querySelector('#qxab-price'),
    candles: panel.querySelector('#qxab-candles'),
    signal: panel.querySelector('#qxab-signal'),
    trades: panel.querySelector('#qxab-trades'),
    wr: panel.querySelector('#qxab-wr'),
    pl: panel.querySelector('#qxab-pl'),
    bal: panel.querySelector('#qxab-bal'),
    acct: panel.querySelector('#qxab-acct')
  };
}
function uiPushLog(msg, kind) {
  if (!logBox || !logBox.isConnected) return;
  const d = document.createElement('div');
  d.className = kind || 'i';
  d.textContent = fmtTime(Date.now()) + '  ' + msg;
  logBox.appendChild(d);
  while (logBox.children.length > 40) logBox.removeChild(logBox.firstChild);
  logBox.scrollTop = logBox.scrollHeight;
}
function uiRefresh() {
  if (!panel || !panel.isConnected) return;
  const st = refs.status;
  if (S.running) { st.textContent = 'RUNNING \u2014 waiting for signals\u2026'; st.className = 'qxab-status run'; }
  else if (S.blockedReason) { st.textContent = S.blockedReason; st.className = 'qxab-status block'; }
  else { st.textContent = 'STOPPED'; st.className = 'qxab-status'; }
  refs.dot.className = 'qxab-dot ' + (S.running ? 'on' : S.blockedReason ? 'warn' : 'off');
  refs.asset.textContent = S.assetName || (S.priceSrc === 'ws' ? 'ws feed' : 'DOM feed');
  refs.price.textContent = S.price != null ? String(S.price) : '\u2014';
  refs.candles.textContent = S.candles.length + '/' + CFG.minCandles + (S.cur ? '+' : '');
  refs.signal.textContent = S.lastSignal ? (S.lastSignal.dir.toUpperCase() + ' ' + S.lastSignal.why) : '\u2014';
  refs.signal.className = 'qxab-v ' + (S.lastSignal ? (S.lastSignal.dir === 'call' ? 'up' : 'down') : '');
  refs.trades.textContent = S.stats.trades + '  (W' + S.stats.wins + '/L' + S.stats.losses + ')';
  const total = S.stats.wins + S.stats.losses;
  refs.wr.textContent = total ? (S.stats.wins / total * 100).toFixed(1) + '%' : '\u2014';
  refs.pl.textContent = fmtMoney(S.stats.pl);
  refs.pl.className = 'qxab-v ' + (S.stats.pl > 0 ? 'up' : S.stats.pl < 0 ? 'down' : '');
  refs.bal.textContent = fmtBal(readBalance());
  refs.acct.textContent = 'acct: ' + (S.accountIsReal === true ? 'REAL' : S.accountIsReal === false ? 'DEMO' : '?');
  refs.acct.style.color = S.accountIsReal === true ? '#e74c3c' : S.accountIsReal === false ? '#2ecc71' : '#8b98a9';
}

/* -------- 12. calibration + public API -------- */
function calibrate() {
  log('\ud83d\udd27 Calibrating \u2014 found elements get a lime outline for 5s\u2026', 'info');
  const res = {};
  const mark = (el, name) => {
    if (!el) { log('  ' + name + ': \u2717 not found', 'err'); return; }
    log('  ' + name + ': \u2713 <' + el.tagName.toLowerCase() + '> "' + (el.textContent || el.value || '').trim().slice(0, 30) + '"', 'ok');
    const old = el.style.outline;
    el.style.outline = '2px solid #7fff00';
    setTimeout(() => { el.style.outline = old; }, 5000);
  };
  res.amount = findAmountInput();
  res.up = findDealButton('up');
  res.down = findDealButton('down');
  res.balance = readBalance(true) != null ? S.cache.balance : null;
  res.price = S.priceEl && S.priceEl.isConnected ? S.priceEl : null;
  mark(res.amount, 'amount input');
  mark(res.up, 'UP button');
  mark(res.down, 'DOWN button');
  mark(res.balance, 'balance');
  mark(res.price, 'price element');
  if (!res.price) log('  price: not locked yet \u2014 press START to run the 4s scan, or use QXBot.useWebSocket()', 'warn');
  return res;
}
function testTrade(dir) {
  if (S.openTrade) { log('A trade is already open \u2014 wait for it to expire.', 'warn'); return; }
  log('Manual TEST trade (' + dir + ') \u2014 use on DEMO.', 'warn');
  placeTrade(dir, 'manual test');
}
/* diag(): dump the best candidate elements + ready-to-paste selector map.
   Send the console output back if the bot still can't drive your page. */
function diag() {
  const info = el => el ? { tag: el.tagName.toLowerCase(), id: el.id || undefined,
    cls: (el.className && String(el.className).slice(0, 60)) || undefined,
    txt: (el.textContent || el.value || '').trim().slice(0, 24) } : null;
  const cands = { buttons: { green: [], red: [] }, prices: [], inputs: [], balances: [] };
  document.querySelectorAll('button,[role="button"],div,a').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 70 || r.height < 34 || r.top < window.innerHeight * 0.35) return;
    const c = elementColor(el);
    if (c === 'green' && cands.buttons.green.length < 4) cands.buttons.green.push(info(el));
    if (c === 'red' && cands.buttons.red.length < 4) cands.buttons.red.push(info(el));
  });
  document.querySelectorAll('div,span,p,b,td,strong').forEach(el => {
    if (el.closest && el.closest('.qxab-panel')) return;
    const t = (el.textContent || '').trim();
    if (t.length >= 4 && t.length <= 20 && PRICE_RX.test(t) && cands.prices.length < 6) cands.prices.push(info(el));
  });
  document.querySelectorAll('input').forEach(el => {
    if (cands.inputs.length < 6) cands.inputs.push({ tag: 'input', type: el.type, name: el.name || undefined,
      placeholder: el.placeholder || undefined, value: el.value || undefined, id: el.id || undefined });
  });
  document.querySelectorAll('span,div,p,button').forEach(el => {
    if (el.children.length > 2) return;
    const t = el.textContent || '';
    if (t.length >= 3 && t.length <= 30 && BAL_RX.test(t) && cands.balances.length < 4) cands.balances.push(info(el));
  });
  console.log('%c[QX][diag] Candidates found on this page:', 'font-weight:bold');
  console.log(JSON.stringify(cands, null, 1));
  log('diag() complete \u2014 copy the JSON from the console and send it for exact selectors.', 'ok');
  return cands;
}
function setSelectors(patch) {
  Object.assign(SEL, patch || {});
  S.cache = { amount: null, up: null, down: null, balance: null, ts: 0 };
  if (patch && patch.price && S.priceSrc === 'dom') {
    const el = document.querySelector(patch.price);
    if (el) attachPriceEl(el, true);
  }
  log('Selectors updated.', 'ok');
  return SEL;
}
function status() {
  const st = {
    version: VERSION,
    running: S.running,
    blocked: S.blockedReason,
    priceSource: S.priceSrc,
    asset: S.assetName,
    ticks: S.ticks,
    candlesClosed: S.candles.length,
    formingCandle: S.cur,
    lastSignal: S.lastSignal,
    openTrade: S.openTrade,
    config: Object.assign({}, CFG),
    selectors: Object.assign({}, SEL),
    stats: Object.assign({}, S.stats),
    history: S.history.slice(0, 10),
    accountIsReal: S.accountIsReal
  };
  console.log(st);
  return st;
}
function config(patch) {
  Object.assign(CFG, patch || {});
  log('Config: ' + JSON.stringify(patch || {}), 'info');
  return Object.assign({}, CFG);
}
function destroy() {
  stop();
  S.timers.forEach(id => clearInterval(id));
  S.timers.length = 0;
  S.obs.forEach(o => { try { o.disconnect(); } catch (e) {} });
  detachPriceDom();
  if (S.wsOrigSend) WebSocket.prototype.send = S.wsOrigSend;
  if (panel) { try { panel.remove(); } catch (e) {} }
  const stl = document.getElementById('qxab-style');
  if (stl) stl.remove();
  delete window.QXBot;
  delete window.BOT;
  console.log('[QX] AutoTrader removed. Bye \u2014 trade safe.');
}
const BOT = {
  version: VERSION,
  start: start,
  stop: function () { stop(); },
  status: status,
  config: config,
  setSelectors: setSelectors,
  calibrate: calibrate,
  diag: diag,
  testTrade: testTrade,
  useWebSocket: useWebSocket,
  backtest: backtest,
  allowReal: function () { S.realOverride = true; log('REAL account trading ENABLED for this session \u2014 you accepted the risk.', 'warn'); },
  debug: function (v) { CFG.debug = v !== false; log('debug ' + CFG.debug, 'info'); },
  destroy: destroy,
  /* internal hooks — used by automated tests & power users */
  _internals: {
    emaSeries: emaSeries,
    rsiLast: rsiLast,
    signalFor: signalFor,
    addTick: addTick,
    candles: function () { return S.candles; },
    parseCsvCandles: parseCsvCandles,
    canTrade: canTrade,
    CFG: CFG,
    S: S
  }
};
window.QXBot = BOT;
window.BOT = BOT;

/* -------- 13. boot -------- */
buildPanel();
console.log('%c QX AutoTrader v' + VERSION + ' ', 'background:#16a34a;color:#fff;font-weight:bold;border-radius:4px;padding:2px 6px');
console.log('%c Panel is top-right. Check the account badge says DEMO. Use QXBot.calibrate() if buttons were not found. Trade responsibly \u2014 no strategy is a money printer. ', 'color:#fbbf24');
})();