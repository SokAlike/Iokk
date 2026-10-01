(function () {
if (window.__QXBOT__) { window.__QXBOT__.togglePanel(); return; }
var DEFAULTS = {
minPayout: 85,
amount: 1,
expiry: '1m',
confluence: 2,
cooldownSec: 20,
candleSec: 60,
mode: 'DRY',
pauseHidden: true,
sound: true,
autoSwitchPairs: true,
pairMode: 'best',
upgradeGap: 2,
scanEveryMin: 5,
momentumFilter: true,
winCooldownSec: 5,
minTradeGapSec: 30,
maxUnknown: 10
};
var EXPIRY_SEC = { '5s': 5, '10s': 10, '15s': 15, '30s': 30, '1m': 60, '2m': 120, '3m': 180, '5m': 300 };
function loadCfg() {
try { var s = JSON.parse(localStorage.getItem('qxbot_cfg') || '{}'); var c = {}; for (var k in DEFAULTS) c[k] = (s[k] !== undefined) ? s[k] : DEFAULTS[k]; return c; }
catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
}
function saveCfg() { try { localStorage.setItem('qxbot_cfg', JSON.stringify(cfg)); } catch (e) {} }
var cfg = loadCfg();
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function now() { return Date.now(); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function hhmmss(t) { var d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function fmtMoney(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + ' $'; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
var LOG = [];
function log(msg, kind) {
LOG.push({ t: hhmmss(now()), m: String(msg).slice(0, 200), k: kind || 'info' });
if (LOG.length > 300) LOG.shift();
try { console.log('[QXBOT ' + hhmmss(now()) + '] ' + msg); } catch (e) {}
}
function beep(pattern) {
if (!cfg.sound) return;
try {
var AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;
if (!beep.ctx) beep.ctx = new AC();
var ctx = beep.ctx, t = ctx.currentTime;
var seq = pattern || [[880, 0.09]];
for (var i = 0; i < seq.length; i++) {
var o = ctx.createOscillator(), g = ctx.createGain();
o.frequency.value = seq[i][0]; o.type = 'sine';
g.gain.setValueAtTime(0.0001, t);
g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
g.gain.exponentialRampToValueAtTime(0.0001, t + seq[i][1]);
o.connect(g); g.connect(ctx.destination);
o.start(t); o.stop(t + seq[i][1] + 0.02);
t += seq[i][1] + 0.06;
}
} catch (e) {}
}
var SND = { open: [[660, .07]], win: [[880, .08], [1320, .12]], loss: [[220, .18]], alert: [[520, .15], [520, .15], [520, .15]], stop: [[330, .12]] };
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var P = { candleCanvas: null, overlayCanvas: null, calib: null, calibAt: 0, failStreak: 0 };
function isGreenPx(r, g, b) { return g > 100 && (g - r) > 35 && (g - b) > 30; }
function isRedPx(r, g, b) { return r > 150 && (r - g) > 45 && (r - b) > 45; }
function isBluePx(r, g, b, a) { return a > 50 && b > 200 && g > 90 && g < 200 && r < 100; }
function findCanvases() {
var cs = $$('canvas'), best = { candle: null, candleScore: 0, overlay: null, overlayScore: 0 };
for (var i = 0; i < cs.length; i++) {
var c = cs[i]; if (c.width < 200 || c.height < 100) continue;
var ctx = null; try { ctx = c.getContext('2d'); } catch (e) { continue; }
if (!ctx) continue;
var img = null; try { img = ctx.getImageData(0, 0, c.width, c.height).data; } catch (e) { continue; }
var candleScore = 0, overlayScore = 0;
for (var j = 0; j < img.length; j += 48) {
var r = img[j], g = img[j + 1], b = img[j + 2], a = img[j + 3];
if (a < 30) continue;
if (isGreenPx(r, g, b) || isRedPx(r, g, b)) candleScore++;
if (isBluePx(r, g, b, a)) overlayScore++;
}
if (candleScore > best.candleScore) { best.candle = c; best.candleScore = candleScore; }
if (overlayScore > best.overlayScore) { best.overlay = c; best.overlayScore = overlayScore; }
}
P.candleCanvas = best.candle; P.overlayCanvas = best.overlay;
return !!(best.candle && best.overlay);
}
function inBotUI(e) {
try { return !!(e.closest && e.closest('#qxbot,#qxbot-mini')); } catch (err) { return false; }
}
function readCalibration() {
if (P.calib && (now() - P.calibAt) < 2000) return P.calib;
var labels = $$('div,span').filter(function (e) {
if (e.children.length !== 0 || inBotUI(e)) return false;
var t = (e.textContent || '').trim();
if (!/^\d{1,5}\.\d{2,6}$/.test(t)) return false;
var r = e.getBoundingClientRect();
return r.width > 0 && r.x > window.innerWidth * 0.55 && r.x < window.innerWidth;
});
if (labels.length < 3) { P.calib = null; return null; }
var pts = labels.map(function (e) {
var r = e.getBoundingClientRect();
return { p: parseFloat(e.textContent.trim()), y: r.y + r.height / 2 };
}).sort(function (a, b) { return a.y - b.y; });
var mono = true;
for (var i = 1; i < pts.length; i++) { if ((pts[i].p - pts[i - 1].p) * (pts[1].p - pts[0].p) <= 0) mono = false; }
if (!mono) { P.calib = null; return null; }
var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
for (var k = 0; k < n; k++) { sx += pts[k].y; sy += pts[k].p; sxx += pts[k].y * pts[k].y; sxy += pts[k].y * pts[k].p; }
var den = n * sxx - sx * sx; if (Math.abs(den) < 1e-9) { P.calib = null; return null; }
var m = (n * sxy - sx * sy) / den, b = (sy - m * sx) / n;
if (!isFinite(m) || !isFinite(b) || m === 0) { P.calib = null; return null; }
P.calib = { m: m, b: b, n: n }; P.calibAt = now();
return P.calib;
}
function readLivePrice() {
try {
if (!P.overlayCanvas || !P.overlayCanvas.isConnected) findCanvases();
if (!P.overlayCanvas) return null;
var c = P.overlayCanvas, ctx = c.getContext('2d');
var img = ctx.getImageData(0, 0, c.width, c.height).data;
var W = c.width, H = c.height;
var rows = [];
for (var y = 0; y < H; y++) {
var cnt = 0;
for (var x = 0; x < W; x += 2) {
var j = (y * W + x) * 4;
if (isBluePx(img[j], img[j + 1], img[j + 2], img[j + 3])) cnt++;
}
if (cnt > 6) rows.push(y);
}
if (!rows.length) { P.failStreak++; return null; }
var best = { s: rows[0], e: rows[0], len: 1 }, cur = { s: rows[0], e: rows[0], len: 1 };
for (var i = 1; i < rows.length; i++) {
if (rows[i] - rows[i - 1] <= 3) { cur.e = rows[i]; cur.len++; }
else { if (cur.len > best.len) best = { s: cur.s, e: cur.e, len: cur.len }; cur = { s: rows[i], e: rows[i], len: 1 }; }
}
if (cur.len > best.len) best = cur;
var yC = (best.s + best.e) / 2;
var rect = c.getBoundingClientRect();
if (rect.height < 50) { P.failStreak++; return null; }
var scale = rect.height / c.height;
var screenY = rect.top + yC * scale;
var cal = readCalibration();
if (!cal) { P.failStreak++; return null; }
var price = cal.m * screenY + cal.b;
if (!isFinite(price) || price <= 0 || price > 100000) { P.failStreak++; return null; }
P.failStreak = 0;
return price;
} catch (e) { P.failStreak++; return null; }
}
function readBalance() {
var els = $$('div,span').filter(function (e) {
if (e.children.length !== 0 || inBotUI(e)) return false;
return /^\$[\d,]+\.\d{2}$/.test((e.textContent || '').trim());
});
if (!els.length) return null;
var el = els[0];
for (var i = 0; i < els.length; i++) { var r = els[i].getBoundingClientRect(); if (r.x < window.innerWidth * 0.6 && r.width > 20) { el = els[i]; break; } }
return parseFloat(el.textContent.trim().replace(/[$,]/g, ''));
}
function readAccountType() {
var b = $$('button').find(function (x) { return /live account|demo account/i.test(x.textContent || ''); });
if (!b) return null;
return /demo/i.test(b.textContent) ? 'DEMO' : 'LIVE';
}
function readPairTab() {
var t = $('[role=tab][aria-selected="true"]');
if (!t) return null;
var s = (t.textContent || '').trim().replace(/\s+/g, ' ');
var name = s.match(/^([A-Z]{3}\/[A-Z]{3}(?:\s*\(OTC\))?)/);
var pay = s.match(/(\d{1,3})\s*%/);
if (!name) return null;
return { pair: name[1], payout: pay ? parseInt(pay[1], 10) : null, raw: s };
}
function readCurrentPayout() { var t = readPairTab(); return t ? t.payout : null; }
function readCurrentPair() { var t = readPairTab(); return t ? t.pair : '?'; }
function getUpBtn() { return $('[data-qx="up-btn"]'); }
function getDownBtn() { return $('[data-qx="down-btn"]'); }
function getTimeInput() {
return $$('input').find(function (i) { return /^\d{2}:\d{2}:\d{2}$/.test(i.value) || i.placeholder === '00:00:30'; }) || null;
}
function getAmountInput() {
return $$('input').find(function (i) { return i.type === 'text' && i.placeholder !== '00:00:30' && /^\d+(\.\d+)?\s*\$?$/.test((i.value || '').trim()); }) || null;
}
function getExpiryButtons() {
var btns = $$('button').filter(function (b) { return /^(5s|10s|15s|30s|1m|2m|3m|5m|10m|15m|30m|1h|4h|1d)$/.test((b.textContent || '').trim()); });
var groups = {};
btns.forEach(function (b) {
var p = b.parentElement; var key = p ? (p.className || '').toString() : 'x';
groups[key] = groups[key] || []; groups[key].push(b);
});
var best = [];
for (var k in groups) if (groups[k].length > best.length) best = groups[k];
return best.length >= 9 ? best : [];
}
function setExpiry(label) {
return new Promise(function (resolve) {
var secs = EXPIRY_SEC[label];
if (!secs) { resolve(false); return; }
var ti = getTimeInput();
var want = secs >= 60 ? '00:' + pad2(Math.floor(secs / 60)) + ':' + pad2(secs % 60) : '00:00:' + pad2(secs);
if (ti && ti.value === want) { resolve(true); return; }
var btns = getExpiryButtons();
var btn = null;
for (var i = 0; i < btns.length; i++) if ((btns[i].textContent || '').trim() === label) { btn = btns[i]; break; }
if (!btn) { log('expiry button not found: ' + label, 'warn'); resolve(false); return; }
btn.click();
sleep(600).then(function () {
var ti2 = getTimeInput();
resolve(!!ti2 && ti2.value === want);
});
});
}
function ensureAmount() {
return new Promise(function (resolve) {
var ai = getAmountInput();
if (!ai) { resolve(false); return; }
var m = (ai.value || '').match(/^(\d+(?:\.\d+)?)/);
if (m && Math.abs(parseFloat(m[1]) - cfg.amount) < 0.001) { resolve(true); return; }
var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(ai, String(cfg.amount));
ai.dispatchEvent(new Event('input', { bubbles: true }));
ai.dispatchEvent(new Event('change', { bubbles: true }));
sleep(400).then(function () {
var ai2 = getAmountInput();
var m2 = ai2 ? (ai2.value || '').match(/^(\d+(?:\.\d+)?)/) : null;
if (m2 && Math.abs(parseFloat(m2[1]) - cfg.amount) < 0.001) { resolve(true); return; }
var inc = $$('button').filter(function (b) { return /increase investment/i.test(b.getAttribute('aria-label') || ''); });
var dec = $$('button').filter(function (b) { return /decrease investment/i.test(b.getAttribute('aria-label') || ''); });
var tries = 0;
(function step() {
var a = getAmountInput(); var mm = a ? (a.value || '').match(/^(\d+(?:\.\d+)?)/) : null;
var cur = mm ? parseFloat(mm[1]) : 0;
if (Math.abs(cur - cfg.amount) < 0.001 || tries > 30 || (!inc[0] && !dec[0])) { resolve(Math.abs(cur - cfg.amount) < 0.001); return; }
var btn = cur < cfg.amount ? inc[0] : dec[0];
if (btn) btn.click();
tries++; sleep(180).then(step);
})();
});
});
}
function parseMarketRows() {
var rows = $$('div').filter(function (d) {
var cls = (d.className || '').toString();
return cls.indexOf('cursor-pointer') !== -1 && /^[A-Z]{3}\/[A-Z]{3}/.test((d.textContent || '').trim());
});
var out = [];
rows.forEach(function (d) {
var s = (d.textContent || '').trim().replace(/\s+/g, ' ');
var name = s.match(/^([A-Z]{3}\/[A-Z]{3})(\s*\(OTC\))?/);
if (!name) return;
var cleaned = s.replace(/[+-]?\d+\.\d+%/g, '');
var percs = cleaned.match(/(\d{1,3})%/g) || [];
if (percs.length < 1) return;
out.push({
el: d,
pair: name[1] + (name[2] ? ' (OTC)' : ''),
otc: !!name[2],
p1: percs[0] ? parseInt(percs[0], 10) : 0,
p5: percs[1] ? parseInt(percs[1], 10) : 0
});
});
return out;
}
function openMarket() {
var b = null, bs = $$('button');
for (var i = 0; i < bs.length; i++) if ((bs[i].getAttribute('aria-label') || '') === 'Open market') { b = bs[i]; break; }
if (!b) return false;
b.click(); return true;
}
function closeMarket() {
['keydown', 'keyup'].forEach(function (t) {
document.dispatchEvent(new KeyboardEvent(t, { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
});
}
function marketOpen() { return parseMarketRows().length > 5; }
var SCAN = {
ranked: [],
bestPayout: null,
scannedAt: 0,
busy: false
};
var lastScan = 0, lastSwitch = 0;
function runScan(force) {
return new Promise(function (resolve) {
if (SCAN.busy) { resolve(null); return; }
if (!cfg.autoSwitchPairs) { resolve(null); return; }
if (!force && (now() - lastScan) < cfg.scanEveryMin * 60000) { resolve(null); return; }
lastScan = now();
SCAN.busy = true;
var curPay = readCurrentPayout();
if (!openMarket()) { SCAN.busy = false; log('cannot open market list', 'warn'); resolve(null); return; }
sleep(700).then(function () {
SCAN.busy = false;
var rows = parseMarketRows();
if (!rows.length) { closeMarket(); resolve(null); return; }
var seen = {};
rows = rows.filter(function (r) { if (seen[r.pair]) return false; seen[r.pair] = 1; return true; });
var eligible = rows.filter(function (r) { return r.p1 >= cfg.minPayout; });
eligible.sort(function (a, b) { return (b.otc - a.otc) || (b.p1 - a.p1); });
SCAN.ranked = eligible.slice(0, 6).map(function (r) { return { pair: r.pair, p1: r.p1, otc: r.otc }; });
SCAN.bestPayout = SCAN.ranked.length ? SCAN.ranked[0].p1 : null;
SCAN.scannedAt = now();
if (eligible.length) log('pair scan: ' + eligible.length + ' pairs >= ' + cfg.minPayout + '% — best ' + SCAN.ranked[0].pair + ' ' + SCAN.ranked[0].p1 + '%', 'info');
var pool = rows.filter(function (r) { return r.p1 >= cfg.minPayout && r.otc; });
if (!pool.length) pool = eligible;
if (!pool.length) { closeMarket(); log('no pair with payout >= ' + cfg.minPayout + '%', 'warn'); resolve(null); return; }
pool.sort(function (a, b) { return b.p1 - a.p1; });
var best = pool[0];
var curPair = readCurrentPair();
if (best.pair === curPair) { closeMarket(); resolve(null); return; }
if (!force && (now() - lastSwitch) < 90000) { closeMarket(); resolve(null); return; }
var why = '';
if (curPay == null || curPay < cfg.minPayout) why = 'payout ' + (curPay == null ? '?' : curPay) + '% < ' + cfg.minPayout + '%';
else if (cfg.pairMode === 'best' && best.p1 >= curPay + (cfg.upgradeGap || 2)) why = 'upgrade ' + curPay + '% -> ' + best.p1 + '%';
if (!why) { closeMarket(); resolve(null); return; }
log('PAIR SELECT -> ' + best.pair + ' (' + best.p1 + '%) — ' + why, 'ok');
best.el.click();
lastSwitch = now();
sleep(1200).then(function () {
closeMarket();
sleep(400).then(function () { if (marketOpen()) closeMarket(); });
DATA.reset();
STATE.warmup();
resolve(best);
});
});
});
}
var DATA = {
ticks: [],
candles: [],
lastPrice: null,
minTicks: 12,
minCandles: 10,
reset: function () {
this.ticks = []; this.candles = []; this.lastPrice = null;
},
addTick: function (p) {
var t = now();
this.lastPrice = p;
this.ticks.push({ t: t, p: p });
if (this.ticks.length > 2400) this.ticks.splice(0, this.ticks.length - 2400);
var bucket = Math.floor(t / (cfg.candleSec * 1000)) * cfg.candleSec * 1000;
var last = this.candles.length ? this.candles[this.candles.length - 1] : null;
if (!last || last.t0 !== bucket) {
this.candles.push({ t0: bucket, o: last ? last.c : p, h: p, l: p, c: p });
if (this.candles.length > 200) this.candles.splice(0, this.candles.length - 200);
} else {
if (p > last.h) last.h = p;
if (p < last.l) last.l = p;
last.c = p;
}
},
ready: function () { return this.ticks.length >= this.minTicks && this.candles.length >= this.minCandles; },
closes: function (n) {
var c = this.candles.slice(-(n || this.candles.length));
return c.map(function (x) { return x.c; });
},
seedFromChart: function () {
try {
if (!P.candleCanvas || !P.candleCanvas.isConnected) findCanvases();
if (!P.candleCanvas) return false;
var cal = readCalibration();
if (!cal) return false;
var c = P.candleCanvas, ctx = c.getContext('2d');
var img = ctx.getImageData(0, 0, c.width, c.height).data;
var W = c.width, H = c.height;
var rect = c.getBoundingClientRect();
var scale = rect.height / c.height;
var colRuns = [];
for (var x = 0; x < W; x++) {
var ys = [], colors = { g: 0, r: 0 };
for (var y = 0; y < H; y++) {
var j = (y * W + x) * 4;
if (img[j + 3] < 40) continue;
if (isGreenPx(img[j], img[j + 1], img[j + 2])) { ys.push(y); colors.g++; }
else if (isRedPx(img[j], img[j + 1], img[j + 2])) { ys.push(y); colors.r++; }
}
if (ys.length >= 2) colRuns.push({ x: x, ys: ys, g: colors.g, r: colors.r });
}
if (colRuns.length < 20) return false;
var yCount = {};
colRuns.forEach(function (cr) { cr.ys.forEach(function (y) { yCount[y] = (yCount[y] || 0) + 1; }); });
var badY = {};
for (var yy in yCount) if (yCount[yy] > colRuns.length * 0.25) badY[yy] = true;
colRuns.forEach(function (cr) { cr.ys = cr.ys.filter(function (y) { return !badY[y]; }); });
colRuns = colRuns.filter(function (cr) { return cr.ys.length >= 2; });
if (colRuns.length < 20) return false;
var groups = [], g = [colRuns[0]];
for (var i = 1; i < colRuns.length; i++) {
if (colRuns[i].x - colRuns[i - 1].x <= 3) g.push(colRuns[i]);
else { groups.push(g); g = [colRuns[i]]; }
}
groups.push(g);
groups = groups.filter(function (grp) { return grp.length >= 3 && grp.length <= 20; });
if (groups.length < 6) return false;
var candles = [];
var t0 = now();
var step = cfg.candleSec * 1000;
var startT = t0 - (groups.length - 1) * step;
var yToP = function (y) { return cal.m * (rect.top + y * scale) + cal.b; };
for (var gi = 0; gi < groups.length; gi++) {
var grp = groups[gi];
var minY = Infinity, maxY = -Infinity, gT = 0, gB = 0, gc = 0, rc = 0;
var starts = [], ends = [];
for (var k = 0; k < grp.length; k++) {
var cr = grp[k];
var yA = cr.ys[0], yB = cr.ys[cr.ys.length - 1];
if (yA < minY) minY = yA;
if (yB > maxY) maxY = yB;
starts.push(yA); ends.push(yB);
gc += cr.g; rc += cr.r;
}
starts.sort(function (a, b) { return a - b; });
ends.sort(function (a, b) { return a - b; });
gT = starts[Math.floor(starts.length / 2)];
gB = ends[Math.floor(ends.length / 2)];
var up = gc >= rc;
var hi = yToP(Math.min(minY, gT)), lo = yToP(Math.max(maxY, gB));
var bt = yToP(gT), bb = yToP(gB);
var o = up ? bb : bt, cl = up ? bt : bb;
candles.push({ t0: startT + gi * step, o: o, h: Math.max(hi, bt, bb), l: Math.min(lo, bt, bb), c: cl, seeded: true });
}
if (candles.length < 6) return false;
var ok = candles.every(function (cd) { return isFinite(cd.o) && cd.o > 0 && cd.o < 100000 && Math.abs(cd.h - cd.l) < cd.o * 0.2; });
if (!ok) return false;
this.candles = candles;
log('seeded ' + candles.length + ' candles from chart', 'ok');
return true;
} catch (e) { log('seedFromChart err: ' + e.message, 'warn'); return false; }
}
};
function ema(values, period) {
if (values.length < period) return null;
var k = 2 / (period + 1), e = 0, i;
for (i = 0; i < period; i++) e += values[i];
e /= period;
for (i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
return e;
}
function emaSeries(values, period) {
if (values.length < period) return [];
var k = 2 / (period + 1), out = [], e = 0, i;
for (i = 0; i < period; i++) e += values[i];
e /= period; out.push(e);
for (i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); out.push(e); }
return out;
}
function rsi(closes, period) {
if (closes.length < period + 1) return null;
var gains = 0, losses = 0, i;
for (i = 1; i <= period; i++) {
var d = closes[i] - closes[i - 1];
if (d > 0) gains += d; else losses -= d;
}
var ag = gains / period, al = losses / period;
if (al === 0) return 100;
var rs = ag / al;
for (i = period + 1; i < closes.length; i++) {
var d2 = closes[i] - closes[i - 1];
ag = (ag * (period - 1) + (d2 > 0 ? d2 : 0)) / period;
al = (al * (period - 1) + (d2 < 0 ? -d2 : 0)) / period;
}
if (al === 0) return 100;
return 100 - 100 / (1 + ag / al);
}
function bollinger(closes, period, mult) {
if (closes.length < period) return null;
var slice = closes.slice(-period), n = slice.length, sum = 0, i;
for (i = 0; i < n; i++) sum += slice[i];
var mid = sum / n, varSum = 0;
for (i = 0; i < n; i++) varSum += (slice[i] - mid) * (slice[i] - mid);
var sd = Math.sqrt(varSum / n);
return { mid: mid, upper: mid + mult * sd, lower: mid - mult * sd, width: 2 * mult * sd };
}
function momentumInfo() {
var t = DATA.ticks.slice(-14);
if (t.length < 8) return null;
var up = 0, dn = 0;
for (var i = 1; i < t.length; i++) {
var d = t[i].p - t[i - 1].p;
if (d > 1e-9) up++; else if (d < -1e-9) dn++;
}
return { up: up, dn: dn, n: up + dn };
}
function momentumOK(dir) {
var m = momentumInfo();
if (!m || m.n < 6) return { ok: true, m: null, note: 'warming up' };
var withDir = dir === 'up' ? m.up : m.dn;
var other = dir === 'up' ? m.dn : m.up;
var ratio = withDir / m.n;
if (cfg.momentumFilter !== false && ratio <= 0.25) {
return { ok: false, m: m, note: m.up + '\u2191/' + m.dn + '\u2193 ticks oppose ' + dir.toUpperCase() };
}
var tag = (ratio >= 0.75) ? 'strongly agrees' : (withDir > other ? 'agrees' : 'neutral');
return { ok: true, m: m, note: m.up + '\u2191/' + m.dn + '\u2193 ' + tag };
}
function computeVotes() {
var V = { up: 0, down: 0, detail: [] };
var price = DATA.lastPrice;
var closes = DATA.closes(60);
if (closes.length < 15 || price == null) return null;
var e9 = ema(closes, 9), e21 = ema(closes, 21);
if (e9 != null && e21 != null) {
if (e9 > e21 && price > e9) { V.up++; V.detail.push(['Trend', 'UP', 'EMA9>EMA21, price>EMA9']); }
else if (e9 < e21 && price < e9) { V.down++; V.detail.push(['Trend', 'DOWN', 'EMA9<EMA21, price<EMA9']); }
else if (e9 > e21) { V.up++; V.detail.push(['Trend', 'UP', 'EMA9>EMA21']); }
else if (e9 < e21) { V.down++; V.detail.push(['Trend', 'DOWN', 'EMA9<EMA21']); }
else V.detail.push(['Trend', '—', 'no clean trend']);
}
var r = rsi(closes, 14);
if (r != null) {
if (r > 70) { V.up++; V.detail.push(['RSI ' + r.toFixed(0), 'UP', 'strong momentum >70']); }
else if (r > 55) { V.up++; V.detail.push(['RSI ' + r.toFixed(0), 'UP', 'bull zone >55']); }
else if (r < 30) { V.down++; V.detail.push(['RSI ' + r.toFixed(0), 'DOWN', 'weak momentum <30']); }
else if (r < 45) { V.down++; V.detail.push(['RSI ' + r.toFixed(0), 'DOWN', 'bear zone <45']); }
else V.detail.push(['RSI ' + r.toFixed(0), '—', 'dead zone 45–55']);
}
var bb = bollinger(closes, 20, 2);
if (bb != null && bb.width > 0) {
var pos = (price - bb.lower) / bb.width;
if (pos >= 1) { V.up++; V.detail.push(['Bollinger', 'UP', 'above upper band']); }
else if (pos > 0.65) { V.up++; V.detail.push(['Bollinger', 'UP', 'upper zone ' + (pos * 100).toFixed(0) + '%']); }
else if (pos <= 0) { V.down++; V.detail.push(['Bollinger', 'DOWN', 'below lower band']); }
else if (pos < 0.35) { V.down++; V.detail.push(['Bollinger', 'DOWN', 'lower zone ' + (pos * 100).toFixed(0) + '%']); }
else V.detail.push(['Bollinger', '—', 'mid band ' + (pos * 100).toFixed(0) + '%']);
}
var cs = DATA.candles;
if (cs.length >= 4) {
var c1 = cs[cs.length - 3], c2 = cs[cs.length - 2], c3 = cs[cs.length - 1];
var body = function (c) { return Math.abs(c.c - c.o); };
var isUp = function (c) { return c.c > c.o; };
var vote = null, why = '';
if (!isUp(c2) && isUp(c3) && c3.c > c2.o && c3.o < c2.c && body(c3) > body(c2) * 1.1) { vote = 'UP'; why = 'bullish engulfing'; }
else if (isUp(c2) && !isUp(c3) && c3.c < c2.o && c3.o > c2.c && body(c3) > body(c2) * 1.1) { vote = 'DOWN'; why = 'bearish engulfing'; }
else if (isUp(c1) && isUp(c2) && isUp(c3) && body(c3) < body(c2) * 0.7) { vote = 'DOWN'; why = '3 greens weakening'; }
else if (!isUp(c1) && !isUp(c2) && !isUp(c3) && body(c3) < body(c2) * 0.7) { vote = 'UP'; why = '3 reds weakening'; }
else if (isUp(c2) && isUp(c3)) { vote = 'UP'; why = '2 greens run'; }
else if (!isUp(c2) && !isUp(c3)) { vote = 'DOWN'; why = '2 reds run'; }
if (vote === 'UP') { V.up++; V.detail.push(['Pattern', 'UP', why]); }
else if (vote === 'DOWN') { V.down++; V.detail.push(['Pattern', 'DOWN', why]); }
else V.detail.push(['Pattern', '—', 'no pattern']);
}
return V;
}
function decide(V) {
if (!V) return null;
var need = clamp(cfg.confluence, 1, 4);
if (V.up >= need && V.down === 0) return 'up';
if (V.down >= need && V.up === 0) return 'down';
return null;
}
var STATS = {
data: null,
load: function () {
try {
this.data = JSON.parse(localStorage.getItem('qxbot_stats') || 'null');
} catch (e) { this.data = null; }
if (!this.data || this.data.day !== todayKey()) {
this.data = { day: todayKey(), trades: 0, wins: 0, losses: 0, ties: 0, pl: 0, streak: 0, bestWin: 0, worstLoss: 0, unknown: 0 };
}
},
save: function () { try { localStorage.setItem('qxbot_stats', JSON.stringify(this.data)); } catch (e) {} },
add: function (result, pl) {
var d = this.data;
d.trades++;
if (result === 'win') { d.wins++; d.pl += pl; d.streak = d.streak > 0 ? d.streak + 1 : 1; if (d.streak > d.bestWin) d.bestWin = d.streak; }
else if (result === 'loss') { d.losses++; d.pl += pl; d.streak = d.streak < 0 ? d.streak - 1 : -1; if (d.streak < d.worstLoss) d.worstLoss = d.streak; }
else if (result === 'tie') { d.ties++; }
else { d.unknown++; }
this.save();
},
winRate: function () { var d = this.data; var decided = d.wins + d.losses; return decided ? (100 * d.wins / decided) : 0; }
};
STATS.load();
function loadJournal() {
try { return JSON.parse(localStorage.getItem('qxbot_journal') || '[]'); } catch (e) { return []; }
}
function saveJournal(j) { try { localStorage.setItem('qxbot_journal', JSON.stringify(j.slice(-300))); } catch (e) {} }
var JOURNAL = loadJournal();
function journalAdd(rec) { JOURNAL.push(rec); saveJournal(JOURNAL); }
var WATCH = {
observer: null,
pending: null,
balBefore: null,
start: function () {
var self = this;
this.observer = new MutationObserver(function (muts) {
muts.forEach(function (m) {
for (var i = 0; i < m.addedNodes.length; i++) {
var n = m.addedNodes[i];
if (n.nodeType !== 1) continue;
var txt = (n.textContent || '').trim();
if (!txt || txt.length > 300) continue;
var mm = txt.match(/RESULT\s*\(P\/L\)\s*([+-])\s*\$?\s*([\d.]+)/i);
if (mm && self.pending) {
var amount = parseFloat(mm[2]);
self.finish(mm[1] === '+' ? 'win' : 'loss', amount, 'toast');
return;
}
}
});
});
this.observer.observe(document.body, { subtree: true, childList: true });
},
finish: function (result, plAmount, source) {
var p = this.pending;
if (!p) return;
this.pending = null;
if (result === 'win') {
var pl = p.amount * (p.payout || 85) / 100;
STATS.add('win', pl);
journalAdd({ t: hhmmss(p.openedAt), pair: p.pair, dir: p.dir, amt: p.amount, pay: p.payout, entry: p.entry, exit: DATA.lastPrice, res: 'WIN', pl: +pl.toFixed(2), reason: p.reason, mode: p.mode });
beep(SND.win);
log('WIN ' + fmtMoney(pl) + ' (' + source + ') ' + p.pair + ' ' + p.dir, 'ok');
} else if (result === 'loss') {
STATS.add('loss', -p.amount);
journalAdd({ t: hhmmss(p.openedAt), pair: p.pair, dir: p.dir, amt: p.amount, pay: p.payout, entry: p.entry, exit: DATA.lastPrice, res: 'LOSS', pl: -p.amount, reason: p.reason, mode: p.mode });
beep(SND.loss);
log('LOSS ' + fmtMoney(-p.amount) + ' (' + source + ') ' + p.pair + ' ' + p.dir, 'bad');
} else if (result === 'tie') {
STATS.add('tie', 0);
journalAdd({ t: hhmmss(p.openedAt), pair: p.pair, dir: p.dir, amt: p.amount, pay: p.payout, entry: p.entry, exit: DATA.lastPrice, res: 'TIE', pl: 0, reason: p.reason, mode: p.mode });
log('TIE ' + p.pair + ' ' + p.dir, 'info');
} else {
STATS.add('unknown', 0);
log('UNKNOWN result ' + p.pair + ' ' + p.dir + ' (source ' + source + ')', 'warn');
if (STATS.data.unknown >= cfg.maxUnknown) { BOT.stop('too many unknown results'); return; }
}
STATE.cooldown(result === 'win' ? 'win' : 'full');
UI.dirty = true;
},
reconcile: function () {
var p = this.pending;
if (!p || p.mode !== 'LIVE') return;
var expSec = EXPIRY_SEC[cfg.expiry] || 60;
if (now() - p.openedAt < (expSec + 40) * 1000) return;
var bal = readBalance();
if (bal == null || this.balBefore == null) { this.finish('unknown', 0, 'no-balance'); return; }
var delta = bal - this.balBefore;
if (delta >= p.amount * 0.5) this.finish('win', delta, 'balance');
else if (delta <= -p.amount * 0.5) this.finish('loss', delta, 'balance');
else this.finish('unknown', 0, 'balance');
},
dryCheck: function () {
var p = this.pending;
if (!p || p.mode !== 'DRY') return;
var expSec = EXPIRY_SEC[cfg.expiry] || 60;
if (now() - p.openedAt < expSec * 1000) return;
var exit = DATA.lastPrice;
if (exit == null) { this.finish('unknown', 0, 'dry'); return; }
if (Math.abs(exit - p.entry) < 1e-9) this.finish('tie', 0, 'dry');
else if (p.dir === 'up') this.finish(exit > p.entry ? 'win' : 'loss', 0, 'dry');
else this.finish(exit < p.entry ? 'win' : 'loss', 0, 'dry');
}
};
var STATE = {
name: 'IDLE',
until: 0,
lastVotes: null,
lastMomentum: null,
lastSignal: null,
set: function (n, note) { this.name = n; this.note = note || ''; UI.dirty = true; },
warmup: function () {
DATA.ticks = [];
this.set('WARMUP', 'collecting data');
DATA.seedFromChart();
},
cooldown: function (result) {
var sec = (result === 'win') ? (cfg.winCooldownSec != null ? cfg.winCooldownSec : 5) : cfg.cooldownSec;
this.set('COOLDOWN'); this.until = now() + sec * 1000;
}
};
var BOT = {
running: false,
timer: null,
hidden: false,
pageErrStreak: 0,
votesAt: 0,
lastPriceAlert: 0,
lastEntryAt: 0,
start: function () {
if (this.running) return;
this.running = true;
WATCH.start();
STATE.warmup();
runScan(true);
beep(SND.open);
log('BOT STARTED (' + cfg.mode + ' mode, ' + cfg.amount + '$, ' + cfg.expiry + ', payout>=' + cfg.minPayout + '%, confluence ' + cfg.confluence + '/4' + (cfg.momentumFilter !== false ? ', +momentum' : '') + ')', 'ok');
UI.dirty = true;
},
stop: function (reason) {
this.running = false;
if (this.timer) { clearInterval(this.timer); this.timer = null; }
if (WATCH.observer) { try { WATCH.observer.disconnect(); } catch (e) {} }
STATE.set('STOPPED', reason || '');
beep(SND.stop);
log('BOT STOPPED' + (reason ? ' — ' + reason : ''), 'warn');
UI.dirty = true;
},
toggle: function () { if (this.running) this.stop('manual'); else this.start(); },
tick: function () {
try {
var price = readLivePrice();
if (price != null) { DATA.addTick(price); P.pageErrStreak = 0; }
else if (P.failStreak > 30 && (now() - this.lastPriceAlert) > 60000) { this.lastPriceAlert = now(); UI.alert('PRICE READ FAILING — chart layout changed?'); }
WATCH.dryCheck();
WATCH.reconcile();
UI.refreshLite();
if (!this.running) return;
if (!readPairTab()) { this.pageErrStreak++; if (this.pageErrStreak > 10) { UI.alert('PAGE STRUCTURE LOST — reload page, then click bookmark again'); STATE.set('PAUSED', 'page error'); } }
else this.pageErrStreak = 0;
if (/sign-in|login/i.test(location.href)) { UI.alert('LOGGED OUT — login again, re-inject, restart'); STATE.set('PAUSED', 'logged out'); beep(SND.alert); return; }
if (cfg.pauseHidden && document.hidden) { STATE.set('PAUSED', 'tab hidden'); return; }
if (STATE.name === 'PAUSED' && !document.hidden) STATE.set('READY');
switch (STATE.name) {
case 'WARMUP':
if (DATA.ready()) STATE.set('READY', 'hunting signals');
break;
case 'READY':
this.hunt();
if (cfg.autoSwitchPairs && (now() - lastScan) > cfg.scanEveryMin * 60000) runScan(false);
break;
case 'IN_TRADE':
break;
case 'COOLDOWN':
if (now() > STATE.until) STATE.set('READY', 'hunting signals');
break;
}
} catch (e) { log('tick err: ' + e.message, 'warn'); }
},
hunt: function () {
if (WATCH.pending) { STATE.set('IN_TRADE'); return; }
if (now() - this.votesAt < 1000) return;
this.votesAt = now();
var V = computeVotes();
STATE.lastVotes = V;
STATE.lastMomentum = momentumInfo();
if (!V) return;
var dir = decide(V);
if (!dir) return;
var gap = (cfg.minTradeGapSec != null ? cfg.minTradeGapSec : 30) * 1000;
if (this.lastEntryAt && (now() - this.lastEntryAt) < gap) {
STATE.set('READY', 'throttled ' + Math.ceil((gap - (now() - this.lastEntryAt)) / 1000) + 's (signal ' + dir.toUpperCase() + ' ready)');
return;
}
var mo = momentumOK(dir);
if (!mo.ok) { STATE.set('READY', 'blocked — ' + mo.note); return; }
var payout = readCurrentPayout();
if (payout == null || payout < cfg.minPayout) {
STATE.set('READY', 'payout ' + (payout == null ? '?' : payout) + '% < ' + cfg.minPayout + '% — scanning');
runScan(false);
return;
}
var reasons = V.detail.filter(function (d) { return d[1] === (dir === 'up' ? 'UP' : 'DOWN'); }).map(function (d) { return d[0] + ': ' + d[2]; }).join(' | ');
if (mo.m) reasons += ' | Momentum: ' + mo.note;
this.placeTrade(dir, payout, reasons);
},
placeTrade: async function (dir, payout, reason) {
var pair = readCurrentPair();
var entry = DATA.lastPrice;
this.lastEntryAt = now();
STATE.set('IN_TRADE', dir.toUpperCase());
beep(SND.open);
log('SIGNAL ' + dir.toUpperCase() + ' ' + pair + ' @ ' + entry + ' — ' + reason, 'info');
if (cfg.mode === 'DRY') {
WATCH.pending = { mode: 'DRY', dir: dir, pair: pair, amount: cfg.amount, payout: payout, entry: entry, openedAt: now(), reason: reason };
return;
}
var bal = readBalance();
if (bal != null && bal < cfg.amount) { UI.alert('BALANCE TOO LOW for ' + cfg.amount + '$ trade'); STATE.set('PAUSED', 'low balance'); return; }
var amtOk = await ensureAmount();
if (!amtOk) { log('cannot set amount — skipping trade', 'warn'); STATE.cooldown(); return; }
var expOk = await setExpiry(cfg.expiry);
if (!expOk) { log('cannot set expiry ' + cfg.expiry + ' — skipping trade', 'warn'); STATE.cooldown(); return; }
var btn = dir === 'up' ? getUpBtn() : getDownBtn();
if (!btn) { log('trade button not found', 'warn'); STATE.cooldown(); return; }
WATCH.balBefore = readBalance();
btn.click();
WATCH.pending = { mode: 'LIVE', dir: dir, pair: pair, amount: cfg.amount, payout: payout, entry: entry, openedAt: now(), reason: reason };
log('TRADE PLACED (LIVE) ' + dir.toUpperCase() + ' ' + cfg.amount + '$ ' + pair + ' ' + cfg.expiry, 'ok');
UI.dirty = true;
}
};
document.addEventListener('visibilitychange', function () {
if (cfg.pauseHidden && BOT.running) {
if (document.hidden) { STATE.set('PAUSED', 'tab hidden — keep tab visible!'); log('tab hidden — trading paused', 'warn'); }
else { STATE.set(DATA.ready() ? 'READY' : 'WARMUP'); log('tab visible — resuming', 'info'); }
}
UI.dirty = true;
});
var UI = {
el: null, refs: {}, dirty: true, tab: 'dash', minimized: false, alertMsg: '', lastAlert: 0,
css: '',
ensureCss: function () {
if (document.getElementById('qxbot-style')) return;
var s = document.createElement('style');
s.id = 'qxbot-style';
s.textContent = [
'#qxbot{position:fixed;top:12px;right:12px;width:308px;max-height:92vh;overflow:auto;z-index:2147483000;font:12px/1.45 Roboto,Arial,sans-serif;color:#dfe3ea;background:#141822;border:1px solid #2a3040;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.55)}',
'#qxbot *{box-sizing:border-box}',
'#qxbot .qx-hd{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#1a1f2c;border-bottom:1px solid #2a3040;position:sticky;top:0;z-index:2}',
'#qxbot .qx-hd b{font-size:13px;letter-spacing:.3px}',
'#qxbot .qx-dot{width:9px;height:9px;border-radius:50%;background:#666;flex:none}',
'#qxbot .qx-dot.on{background:#0faf59;box-shadow:0 0 8px #0faf59}',
'#qxbot .qx-dot.warn{background:#ff8a00}',
'#qxbot .qx-ico{margin-left:auto;display:flex;gap:4px}',
'#qxbot button{cursor:pointer;font:inherit;color:inherit;background:none;border:none}',
'#qxbot .qx-ico button{padding:2px 6px;border-radius:5px;color:#8892a6}',
'#qxbot .qx-ico button:hover{background:#232a3a;color:#fff}',
'#qxbot .qx-tabs{display:flex;gap:2px;padding:6px 8px 0}',
'#qxbot .qx-tabs button{flex:1;padding:6px 2px;border-radius:6px 6px 0 0;color:#8892a6;font-weight:600}',
'#qxbot .qx-tabs button.act{background:#202738;color:#fff}',
'#qxbot .qx-bd{padding:10px 12px 12px}',
'#qxbot .qx-row{display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap}',
'#qxbot .qx-chip{padding:2px 8px;border-radius:20px;font-weight:700;font-size:11px}',
'#qxbot .qx-chip.dry{background:#123a5e;color:#5db8ff}',
'#qxbot .qx-chip.live{background:#0c3d24;color:#2fe08a}',
'#qxbot .qx-chip.acc{background:#2a2438;color:#c9a0ff}',
'#qxbot .qx-chip.state{background:#232a3a;color:#aab3c5}',
'#qxbot .qx-big{width:100%;padding:10px;margin:8px 0;border-radius:8px;font-size:14px;font-weight:800;letter-spacing:.5px;border:1px solid transparent}',
'#qxbot .qx-big.start{background:#0faf59;color:#04150b;border-color:#18d46b}',
'#qxbot .qx-big.stop{background:#db4635;color:#fff;border-color:#ff6c5b}',
'#qxbot .qx-big:hover{filter:brightness(1.1)}',
'#qxbot .qx-sec{margin:10px 0 4px;font-size:10px;font-weight:800;letter-spacing:1.2px;color:#5f6b80;text-transform:uppercase}',
'#qxbot .qx-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px}',
'#qxbot .qx-cell{background:#1a2030;border-radius:7px;padding:6px 8px}',
'#qxbot .qx-cell i{display:block;font-style:normal;font-size:10px;color:#5f6b80}',
'#qxbot .qx-cell b{font-size:13px}',
'#qxbot .qx-vote{display:flex;gap:6px;align-items:center;padding:4px 6px;margin:2px 0;background:#1a2030;border-radius:6px;font-size:11px}',
'#qxbot .qx-vote .nm{width:70px;color:#8892a6;flex:none}',
'#qxbot .qx-vote .vt{font-weight:800;width:36px;flex:none}',
'#qxbot .qx-vote .up{color:#2fe08a}#qxbot .qx-vote .dn{color:#ff6c5b}#qxbot .qx-vote .nu{color:#5f6b80}',
'#qxbot .qx-vote .wh{color:#6c7890;flex:1;text-align:right;font-size:10px}',
'#qxbot table{width:100%;border-collapse:collapse;font-size:10.5px}',
'#qxbot th{color:#5f6b80;text-align:left;padding:3px 4px;font-size:9.5px;text-transform:uppercase}',
'#qxbot td{padding:3px 4px;border-top:1px solid #202738;white-space:nowrap}',
'#qxbot .win{color:#2fe08a}#qxbot .loss{color:#ff6c5b}',
'#qxbot .qx-set{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:7px 0}',
'#qxbot .qx-set label{color:#aab3c5;font-size:11.5px}',
'#qxbot .qx-set input[type=number],#qxbot .qx-set select{width:86px;background:#0f141f;border:1px solid #2a3040;color:#fff;border-radius:6px;padding:4px 6px;font:inherit}',
'#qxbot .qx-set input[type=checkbox]{width:16px;height:16px}',
'#qxbot .qx-sbtn{background:#202738;border:1px solid #2a3040;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700}',
'#qxbot .qx-sbtn:hover{background:#2a3348}',
'#qxbot .qx-sbtn.danger{border-color:#7a2a20;color:#ff8a80}',
'#qxbot .qx-alert{background:#3d1414;border:1px solid #7a2a20;color:#ff9c93;padding:6px 9px;border-radius:7px;margin:6px 0;font-size:11px}',
'#qxbot .qx-log{background:#0f141f;border-radius:7px;padding:7px 9px;max-height:150px;overflow:auto;font-size:10px;font-family:Roboto Mono,monospace}',
'#qxbot .qx-log div{margin:1px 0;color:#8892a6}',
'#qxbot .qx-log .ok{color:#2fe08a}#qxbot .qx-log .bad{color:#ff6c5b}#qxbot .qx-log .warn{color:#ffb454}',
'#qxbot .qx-mini{position:fixed;top:12px;right:12px;z-index:2147483000;background:#141822;border:1px solid #0faf59;color:#2fe08a;border-radius:30px;padding:7px 14px;font:700 12px Roboto,sans-serif;cursor:pointer}',
'#qxbot .qx-note{font-size:10px;color:#5f6b80;margin-top:8px}'
].join('');
document.head.appendChild(s);
},
build: function () {
this.ensureCss();
if (this.el) this.el.remove();
var root = document.createElement('div');
root.id = 'qxbot';
root.innerHTML =
'<div class="qx-hd"><span class="qx-dot" id="qx-dot"></span><b>🤖 QX AutoTrader v1.0</b>' +
'<span class="qx-ico"><button id="qx-min" title="minimize">–</button><button id="qx-off" title="stop &amp; remove">✕</button></span></div>' +
'<div class="qx-tabs"><button data-tab="dash">Dashboard</button><button data-tab="set">Settings</button><button data-tab="jr">Journal</button></div>' +
'<div class="qx-bd" id="qx-bd"></div>';
document.body.appendChild(root);
this.el = root;
root.querySelector('#qx-min').onclick = function () { UI.minimized = true; root.style.display = 'none'; UI.showMini(); };
root.querySelector('#qx-off').onclick = function () { BOT.stop('panel closed'); root.remove(); };
var tabs = root.querySelectorAll('.qx-tabs button');
for (var i = 0; i < tabs.length; i++) {
tabs[i].onclick = function () { UI.tab = this.getAttribute('data-tab'); UI.dirty = true; UI.renderTab(); var ts = root.querySelectorAll('.qx-tabs button'); for (var k = 0; k < ts.length; k++) ts[k].className = (ts[k].getAttribute('data-tab') === UI.tab ? 'act' : ''); };
}
this.renderTab();
},
showMini: function () {
var old = document.getElementById('qxbot-mini'); if (old) old.remove();
if (!this.minimized) return;
var b = document.createElement('button');
b.id = 'qxbot-mini'; b.className = 'qx-mini';
b.textContent = BOT.running ? '🤖 BOT RUNNING — ' + STATE.name : '🤖 QX BOT';
b.onclick = function () { UI.minimized = false; var m = document.getElementById('qxbot-mini'); if (m) m.remove(); UI.el.style.display = ''; };
document.body.appendChild(b);
},
alert: function (msg) {
this.alertMsg = msg; this.lastAlert = now();
beep(SND.alert);
log('ALERT: ' + msg, 'bad');
},
renderTab: function () {
var bd = this.el.querySelector('#qx-bd');
if (!bd) return;
var self = this;
if (this.tab === 'dash') {
bd.innerHTML =
'<div class="qx-row"><span class="qx-chip ' + (cfg.mode === 'DRY' ? 'dry' : 'live') + '" id="qx-mode">' + cfg.mode + '</span>' +
'<span class="qx-chip acc" id="qx-acc">…</span><span class="qx-chip state" id="qx-bal">…</span></div>' +
'<button class="qx-big ' + (BOT.running ? 'stop' : 'start') + '" id="qx-go">' + (BOT.running ? '■ STOP BOT' : '▶ START BOT') + '</button>' +
'<div class="qx-row" style="margin-top:6px"><button class="qx-sbtn" id="qx-qacc" style="flex:1">' + accLabel() + '</button></div>' +
'<div class="qx-row"><b id="qx-pair" style="color:#fff">…</b><span id="qx-pay" class="qx-chip live" style="display:none">%</span><span style="margin-left:auto;font-family:Roboto Mono,monospace;font-size:14px;color:#5db8ff" id="qx-price">…</span></div>' +
'<div class="qx-row"><span class="qx-chip state" id="qx-state">IDLE</span></div>' +
'<div class="qx-alert" id="qx-alert" style="display:none"></div>' +
'<div class="qx-sec">Pair scanner — top pairs ≥ ' + cfg.minPayout + '%</div><div id="qx-scan"><div class="qx-vote"><span class="nm">scanner</span><span class="vt nu">…</span><span class="wh">analyzing market list…</span></div></div>' +
'<div class="qx-sec">Signal votes (need ' + clamp(cfg.confluence, 1, 4) + '/4)</div><div id="qx-votes">' + (DATA.ready() ? '<div class="qx-vote"><span class="nm">waiting…</span></div>' : '<div class="qx-vote"><span class="nm">warm-up</span><span class="vt nu">…</span><span class="wh">collecting ticks ' + DATA.ticks.length + '/' + DATA.minTicks + '</span></div>') + '</div>' +
'<div class="qx-sec">Today</div>' +
'<div class="qx-grid">' +
'<div class="qx-cell"><i>Trades</i><b id="qx-tr">0</b></div>' +
'<div class="qx-cell"><i>Win rate</i><b id="qx-wr">–</b></div>' +
'<div class="qx-cell"><i>P/L</i><b id="qx-pl">0.00</b></div>' +
'<div class="qx-cell"><i>Wins</i><b id="qx-w" class="win">0</b></div>' +
'<div class="qx-cell"><i>Losses</i><b id="qx-l" class="loss">0</b></div>' +
'<div class="qx-cell"><i>Streak</i><b id="qx-st">0</b></div>' +
'</div>' +
'<div class="qx-sec">Last trades</div><div id="qx-last"><table></table></div>' +
'<div class="qx-sec">Log</div><div class="qx-log" id="qx-log"></div>' +
'<div class="qx-note">Keep this tab visible. OTC pairs trade 24/7. Bookmarks bar → click again to toggle panel.</div>';
bd.querySelector('#qx-go').onclick = function () { BOT.toggle(); this.textContent = BOT.running ? '■ STOP BOT' : '▶ START BOT'; this.className = 'qx-big ' + (BOT.running ? 'stop' : 'start'); };
var qa = bd.querySelector('#qx-qacc');
if (qa) qa.onclick = function () {
cfg.confluence = (cfg.confluence >= 3) ? 1 : (cfg.confluence === 2 ? 3 : 2);
saveCfg();
log('mode -> ' + accLabel(), 'ok');
UI.renderTab();
};
} else if (this.tab === 'set') {
bd.innerHTML =
'<div class="qx-set"><label>Mode</label><button class="qx-sbtn ' + (cfg.mode === 'LIVE' ? 'danger' : '') + '" id="qx-md">' + (cfg.mode === 'DRY' ? 'DRY (paper) — switch to LIVE' : 'LIVE (real money) — back to DRY') + '</button></div>' +
'<div class="qx-set"><label>Min payout %</label><input type="number" id="qx-mp" min="50" max="100" value="' + cfg.minPayout + '"></div>' +
'<div class="qx-set"><label>Stake $</label><input type="number" id="qx-am" min="1" step="1" value="' + cfg.amount + '"></div>' +
'<div class="qx-set"><label>Expiry</label><select id="qx-ex">' + ['5s', '10s', '15s', '30s', '1m', '2m', '3m', '5m'].map(function (x) { return '<option ' + (cfg.expiry === x ? 'selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
'<div class="qx-set"><label>Confluence (of 4)</label><select id="qx-cf">' + [1, 2, 3, 4].map(function (x) { return '<option ' + (cfg.confluence === x ? 'selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
'<div class="qx-set"><label>Cooldown sec</label><input type="number" id="qx-cd" min="0" value="' + cfg.cooldownSec + '"></div>' +
'<div class="qx-set"><label>Candle sec</label><input type="number" id="qx-cs" min="5" value="' + cfg.candleSec + '"></div>' +
'<div class="qx-set"><label>Auto switch pairs</label><input type="checkbox" id="qx-sw"' + (cfg.autoSwitchPairs ? ' checked' : '') + '></div>' +
'<div class="qx-set"><label>Pair select mode</label><select id="qx-pm"><option value="best"' + (cfg.pairMode === 'ok' ? '' : ' selected') + '>Best payout (auto-rank all)</option><option value="ok"' + (cfg.pairMode === 'ok' ? ' selected' : '') + '>First OK pair</option></select></div>' +
'<div class="qx-set"><label>Switch gap % (min gain)</label><input type="number" id="qx-ug" min="0" max="10" value="' + (cfg.upgradeGap != null ? cfg.upgradeGap : 2) + '"></div>' +
'<div class="qx-set"><label>Momentum filter</label><input type="checkbox" id="qx-mf"' + (cfg.momentumFilter !== false ? ' checked' : '') + '></div>' +
'<div class="qx-set"><label>Win cooldown sec</label><input type="number" id="qx-wc" min="0" value="' + (cfg.winCooldownSec != null ? cfg.winCooldownSec : 5) + '"></div>' +
'<div class="qx-set"><label>Min gap between trades</label><input type="number" id="qx-tg" min="5" value="' + (cfg.minTradeGapSec != null ? cfg.minTradeGapSec : 30) + '"></div>' +
'<div class="qx-set"><label>Pause when tab hidden</label><input type="checkbox" id="qx-ph"' + (cfg.pauseHidden ? ' checked' : '') + '></div>' +
'<div class="qx-set"><label>Sound alerts</label><input type="checkbox" id="qx-so"' + (cfg.sound ? ' checked' : '') + '></div>' +
'<div class="qx-row" style="margin-top:10px"><button class="qx-sbtn" id="qx-save">💾 Save settings</button>' +
'<button class="qx-sbtn danger" id="qx-rst">Reset stats</button>' +
'<button class="qx-sbtn" id="qx-csv">Export CSV</button></div>' +
'<div class="qx-note">LIVE mode requires confirmation. Bot runs on whatever account the platform shows (Demo/Live) — switch account on the site itself. Settings persist in localStorage.</div>';
bd.querySelector('#qx-save').onclick = function () {
cfg.minPayout = clamp(parseInt(bd.querySelector('#qx-mp').value, 10) || 85, 50, 100);
cfg.amount = Math.max(1, parseFloat(bd.querySelector('#qx-am').value) || 1);
cfg.expiry = bd.querySelector('#qx-ex').value;
cfg.confluence = clamp(parseInt(bd.querySelector('#qx-cf').value, 10) || 2, 1, 4);
cfg.cooldownSec = Math.max(0, parseInt(bd.querySelector('#qx-cd').value, 10) || 20);
cfg.candleSec = Math.max(5, parseInt(bd.querySelector('#qx-cs').value, 10) || 60);
cfg.autoSwitchPairs = bd.querySelector('#qx-sw').checked;
cfg.pairMode = bd.querySelector('#qx-pm').value === 'ok' ? 'ok' : 'best';
cfg.upgradeGap = clamp(parseInt(bd.querySelector('#qx-ug').value, 10) || 0, 0, 10);
cfg.momentumFilter = bd.querySelector('#qx-mf').checked;
cfg.winCooldownSec = Math.max(0, parseInt(bd.querySelector('#qx-wc').value, 10) || 0);
cfg.minTradeGapSec = Math.max(5, parseInt(bd.querySelector('#qx-tg').value, 10) || 30);
cfg.pauseHidden = bd.querySelector('#qx-ph').checked;
cfg.sound = bd.querySelector('#qx-so').checked;
saveCfg();
DATA.reset(); STATE.warmup();
log('settings saved', 'ok');
UI.dirty = true; UI.renderTab();
};
bd.querySelector('#qx-md').onclick = function () {
if (cfg.mode === 'DRY') {
var w = window.prompt('Switch to LIVE mode (real trades on current account).\nType LIVE to confirm:', '');
if (w === 'LIVE') { cfg.mode = 'LIVE'; saveCfg(); log('MODE -> LIVE (real money!)', 'bad'); }
} else { cfg.mode = 'DRY'; saveCfg(); log('MODE -> DRY (paper)', 'ok'); }
UI.dirty = true; UI.renderTab();
};
bd.querySelector('#qx-rst').onclick = function () {
STATS.data = { day: todayKey(), trades: 0, wins: 0, losses: 0, ties: 0, pl: 0, streak: 0, bestWin: 0, worstLoss: 0, unknown: 0 };
STATS.save(); JOURNAL = []; saveJournal(JOURNAL); log('stats reset', 'warn'); UI.dirty = true;
};
bd.querySelector('#qx-csv').onclick = function () { exportCSV(); };
} else {
var rows = JOURNAL.slice(-50).reverse().map(function (r) {
return '<tr><td>' + r.t + '</td><td>' + r.pair.replace(' (OTC)', '') + '</td><td class="' + (r.dir === 'up' ? 'win' : 'loss') + '">' + r.dir.toUpperCase() + '</td><td>' + r.amt + '</td><td class="' + (r.res === 'WIN' ? 'win' : (r.res === 'LOSS' ? 'loss' : '')) + '">' + r.res + '</td><td>' + (r.pl >= 0 ? '+' : '') + r.pl.toFixed(2) + '</td><td>' + r.mode + '</td></tr>';
}).join('');
bd.innerHTML =
'<table><tr><th>Time</th><th>Pair</th><th>Dir</th><th>$</th><th>Result</th><th>P/L</th><th>Mode</th></tr>' + (rows || '<tr><td colspan="7" style="color:#5f6b80">no trades yet</td></tr>') + '</table>' +
'<div class="qx-row" style="margin-top:10px"><button class="qx-sbtn" id="qx-csv2">Export CSV</button><button class="qx-sbtn danger" id="qx-clr">Clear journal</button></div>';
bd.querySelector('#qx-csv2').onclick = function () { exportCSV(); };
bd.querySelector('#qx-clr').onclick = function () { JOURNAL = []; saveJournal(JOURNAL); UI.renderTab(); };
}
this.dirty = true;
this.refreshLite();
},
refreshLite: function () {
if (!this.el || this.minimized) return;
if (this.tab !== 'dash') { return; }
var g = function (id) { return document.getElementById(id); };
var acc = readAccountType(), bal = readBalance();
var dot = g('qx-dot');
if (dot) dot.className = 'qx-dot' + (BOT.running ? (STATE.name === 'PAUSED' ? ' warn' : ' on') : '');
var m = g('qx-mode'); if (m) { m.textContent = cfg.mode; m.className = 'qx-chip ' + (cfg.mode === 'DRY' ? 'dry' : 'live'); }
var a = g('qx-acc'); if (a) a.textContent = acc ? acc + ' ACCOUNT' : 'ACCOUNT ?';
var b = g('qx-bal'); if (b) b.textContent = bal != null ? '$' + bal.toFixed(2) : '…';
var pair = readPairTab();
var pEl = g('qx-pair'); if (pEl) pEl.textContent = pair ? pair.pair : '…';
var payEl = g('qx-pay');
if (payEl && pair && pair.payout != null) { payEl.style.display = ''; payEl.textContent = pair.payout + '%'; payEl.className = 'qx-chip ' + (pair.payout >= cfg.minPayout ? 'live' : 'danger'); payEl.style.background = pair.payout >= cfg.minPayout ? '' : '#3d1414'; }
var pr = g('qx-price'); if (pr) pr.textContent = DATA.lastPrice != null ? DATA.lastPrice.toFixed(5) : '…';
var st = g('qx-state');
if (st) {
var label = STATE.name + (STATE.note ? ' — ' + STATE.note : '');
if (STATE.name === 'COOLDOWN') label += ' (' + Math.max(0, Math.ceil((STATE.until - now()) / 1000)) + 's)';
if (WATCH.pending) label = 'IN_TRADE — ' + WATCH.pending.dir.toUpperCase() + ' ' + WATCH.pending.pair + ' (' + Math.ceil(((EXPIRY_SEC[cfg.expiry] || 60) * 1000 - (now() - WATCH.pending.openedAt)) / 1000) + 's)';
st.textContent = label;
}
var al = g('qx-alert');
if (al) {
if (this.alertMsg && (now() - this.lastAlert) < 30000) { al.style.display = ''; al.textContent = '⚠ ' + this.alertMsg; }
else al.style.display = 'none';
}
var vw = g('qx-votes');
if (vw && STATE.lastVotes) {
var html = STATE.lastVotes.detail.map(function (d) {
var cls = d[1] === 'UP' ? 'up' : (d[1] === 'DOWN' ? 'dn' : 'nu');
return '<div class="qx-vote"><span class="nm">' + d[0] + '</span><span class="vt ' + cls + '">' + d[1] + '</span><span class="wh">' + d[2] + '</span></div>';
}).join('');
html += '<div class="qx-vote"><span class="nm">SCORE</span><span class="vt ' + (STATE.lastVotes.up > STATE.lastVotes.down ? 'up' : 'dn') + '">' + STATE.lastVotes.up + '↑ / ' + STATE.lastVotes.down + '↓</span></div>';
var mo = STATE.lastMomentum;
if (mo) html += '<div class="qx-vote"><span class="nm">Ticks</span><span class="vt ' + (mo.up > mo.dn ? 'up' : (mo.dn > mo.up ? 'dn' : 'nu')) + '">' + (mo.up > mo.dn ? 'UP' : (mo.dn > mo.up ? 'DOWN' : '—')) + '</span><span class="wh">' + mo.up + '↑/' + mo.dn + '↓ last ' + mo.n + ' ticks</span></div>';
vw.innerHTML = html;
}
var sc = g('qx-scan');
if (sc) {
if (SCAN.ranked.length) {
sc.innerHTML = SCAN.ranked.slice(0, 4).map(function (r, i) {
var cur = pair && pair.pair === r.pair;
return '<div class="qx-vote"><span class="nm">#' + (i + 1) + '</span><span class="vt ' + (cur ? 'up' : 'nu') + '">' + r.p1 + '%</span><span class="wh">' + r.pair.replace(' (OTC)', '') + (cur ? ' ◄ TRADING' : '') + '</span></div>';
}).join('') + '<div class="qx-vote"><span class="nm">scan</span><span class="vt nu">' + (SCAN.busy ? '…' : '✓') + '</span><span class="wh">' + (SCAN.busy ? 'analyzing market list' : 'every ' + cfg.scanEveryMin + ' min') + '</span></div>';
} else if (SCAN.busy) {
sc.innerHTML = '<div class="qx-vote"><span class="nm">scanner</span><span class="vt nu">…</span><span class="wh">analyzing market list</span></div>';
} else {
sc.innerHTML = '<div class="qx-vote"><span class="nm">scanner</span><span class="vt nu">—</span><span class="wh">no scan yet</span></div>';
}
}
var d = STATS.data;
var tr = g('qx-tr'); if (tr) tr.textContent = d.trades;
var wr = g('qx-wr'); if (wr) wr.textContent = (d.wins + d.losses) ? STATS.winRate().toFixed(0) + '%' : '–';
var pl = g('qx-pl'); if (pl) { pl.textContent = (d.pl >= 0 ? '+' : '') + d.pl.toFixed(2); pl.className = d.pl >= 0 ? 'win' : 'loss'; }
var w = g('qx-w'); if (w) w.textContent = d.wins;
var l = g('qx-l'); if (l) l.textContent = d.losses;
var sk = g('qx-st'); if (sk) { sk.textContent = (d.streak > 0 ? '+' : '') + d.streak; sk.className = d.streak > 0 ? 'win' : 'loss'; }
var last = g('qx-last');
if (last) {
var rows = JOURNAL.slice(-5).reverse().map(function (r) {
return '<tr><td>' + r.t.slice(0, 5) + '</td><td>' + r.pair.replace(' (OTC)', '') + '</td><td class="' + (r.dir === 'up' ? 'win' : 'loss') + '">' + r.dir.toUpperCase()[0] + '</td><td class="' + (r.res === 'WIN' ? 'win' : 'loss') + '">' + r.res + '</td><td>' + (r.pl >= 0 ? '+' : '') + r.pl.toFixed(2) + '</td></tr>';
}).join('');
last.innerHTML = '<table>' + (rows || '<tr><td style="color:#5f6b80">no trades yet</td></tr>') + '</table>';
}
var lg = g('qx-log');
if (lg && LOG.length) {
var lh = LOG.slice(-18).reverse().map(function (e) { return '<div class="' + e.k + '">' + e.t + ' ' + e.m.replace(/</g, '&lt;') + '</div>'; }).join('');
lg.innerHTML = lh;
}
}
};
function exportCSV() {
try {
var csv = 'time,pair,dir,amount,payout,entry,exit,result,pl,mode,reason\n';
JOURNAL.forEach(function (r) {
csv += [r.t, r.pair, r.dir, r.amt, r.pay, r.entry, r.exit, r.res, r.pl, r.mode, '"' + String(r.reason || '').replace(/"/g, "'") + '"'].join(',') + '\n';
});
var blob = new Blob([csv], { type: 'text/csv' });
var a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'qxbot-journal-' + todayKey() + '.csv';
a.click();
log('journal exported (' + JOURNAL.length + ' rows)', 'ok');
} catch (e) { log('export failed: ' + e.message, 'warn'); }
}
function accLabel() {
if (cfg.confluence <= 1) return '🚀 TURBO 1/4 — fastest, tap for FAST 2/4';
if (cfg.confluence === 2) return '⚡ FAST 2/4 — balanced, tap for STRICT 3/4';
return '🎯 STRICT 3/4 — best accuracy, tap for TURBO 1/4';
}
window.__QXBOT__ = {
version: '1.2',
bot: BOT, cfg: cfg, state: STATE, data: DATA, stats: STATS, watch: WATCH, ui: UI, scan: SCAN, log: LOG,
togglePanel: function () { if (UI.el && UI.el.style.display !== 'none') { UI.el.style.display = 'none'; } else { if (!UI.el) UI.build(); else UI.el.style.display = ''; UI.minimized = false; var m = document.getElementById('qxbot-mini'); if (m) m.remove(); } },
start: function () { BOT.start(); },
stop: function (r) { BOT.stop(r); }
};
UI.build();
findCanvases();
DATA.seedFromChart();
log('QX AutoTrader v1.2 injected — ' + cfg.mode + ' mode, ' + accLabel(), 'ok');
log('page: ' + (readAccountType() || '?') + ' account, balance ' + (readBalance() != null ? '$' + readBalance() : '?') + ', pair ' + readCurrentPair() + ' ' + (readCurrentPayout() != null ? readCurrentPayout() + '%' : ''), 'info');
runScan(true);
BOT.timer = setInterval(function () { BOT.tick(); }, 1000);
})();