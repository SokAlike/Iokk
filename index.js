/* Demo-only candle bot v2: win/loss + accuracy tracking, draggable/minimizable panel. */
(() => {
  if (!location.href.includes('demo')) { console.warn('Demo page only.'); return; }
  document.getElementById('cbPanel')?.remove();
  if (window.__cbCleanup) window.__cbCleanup();

  const UP = ['up', 'higher', 'call', 'buy'];
  const DOWN = ['down', 'lower', 'put', 'sell'];

  let candles = [], cur = null, asset = null, ticks = 0, lastPrice = null;
  let trades = 0, lastTradeCandle = -1, rawLeft = 3, seq = 0, histLogged = false, indT = 0, maxT = -Infinity, prevWall = 0, histUntil = 0;
  let pending = [], done = [];

  // ---------- UI ----------
  const p = document.createElement('div');
  p.id = 'cbPanel';
  p.style.cssText = 'position:fixed;top:60px;right:10px;z-index:999999;width:240px;background:#1b1f2a;' +
    'color:#fff;font:12px sans-serif;border-radius:10px;box-shadow:0 4px 16px #0008;user-select:none';
  p.innerHTML = `
  <div id="ch" style="padding:8px 10px;cursor:move;display:flex;justify-content:space-between;background:#262c3b;border-radius:10px 10px 0 0">
    <b>Strategy Bot (demo)</b><span><span id="cmn" style="cursor:pointer;padding:0 6px">–</span><span id="cx" style="cursor:pointer;padding:0 4px">✕</span></span></div>
  <div id="cb" style="padding:10px">
    <div id="cs" style="color:#9ab;margin-bottom:6px">waiting for ticks…</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <span>Balance <b id="bb">–</b></span><span>P/L <b id="bp">–</b></span></div>
    <div style="display:flex;text-align:center;gap:4px;margin-bottom:6px">
      <div style="flex:1;background:#173d2a;border-radius:6px;padding:4px">WIN<br><b id="sw" style="font-size:16px">0</b></div>
      <div style="flex:1;background:#472022;border-radius:6px;padding:4px">LOSE<br><b id="sl" style="font-size:16px">0</b></div>
      <div style="flex:1;background:#2a3040;border-radius:6px;padding:4px">TIE<br><b id="st" style="font-size:16px">0</b></div>
      <div style="flex:1.2;background:#2a3040;border-radius:6px;padding:4px">ACC<br><b id="sa" style="font-size:16px">–</b></div></div>
    <div id="ci" style="color:#9ab;font-size:11px;margin-bottom:4px"></div>
    <div id="sp" style="color:#9ab;font-size:11px;margin-bottom:6px"></div>
    <div>Candle size (sec) <input id="ct" type="number" value="60" min="5" style="width:100%"></div>
    <div>Trade expiry (sec) <input id="ce" type="number" value="60" min="5" style="width:100%"></div>
    <div>Warm-up candles (min 8) <input id="cw" type="number" value="15" min="5" style="width:100%"></div>
    <div>Strategy <select id="sg" style="width:100%">
      <option value="rsi">RSI</option><option value="sr">Support / Resistance</option>
      <option value="both">Both must agree</option></select></div>
    <div id="grs" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:4px 0">
      <div>RSI period <input id="rl" type="number" value="3" min="2" style="width:100%"></div>
      <div>Trigger <select id="rt" style="width:100%"><option value="entry">On entry</option><option value="zone">While in zone</option></select></div>
      <div>Buy at (≤) <input id="rb" type="number" value="35" style="width:100%"></div>
      <div>Sell at (≥) <input id="rs" type="number" value="65" style="width:100%"></div></div>
    <div id="gsr" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:4px 0">
      <div style="grid-column:1/3">Mode <select id="qm" style="width:100%">
        <option value="bounce">Bounce (reversal)</option><option value="breakout">Breakout</option><option value="both">Both</option></select></div>
      <div>Pivot strength <input id="qn" type="number" value="2" min="1" style="width:100%"></div>
      <div>Look-back <input id="qb" type="number" value="60" min="10" style="width:100%"></div>
      <div>Min touches <input id="qt" type="number" value="2" min="1" style="width:100%"></div>
      <div>Zone (x ATR) <input id="qk" type="number" value="0.3" step="0.1" style="width:100%"></div></div>
    <div>Max trades (0 = unlimited) <input id="cm" type="number" value="0" min="0" style="width:100%"></div>
    <label style="display:block"><input id="cq" type="checkbox"> Instant signal (trade mid-candle, before it closes)</label>
    <label style="display:block"><input id="ca" type="checkbox" checked> Auto trade on signal</label>
    <div style="display:flex;gap:6px;margin:6px 0">
      <button id="cr" style="flex:1">Reset</button>
      <button id="cp" style="flex:1">Pick balance</button></div>
    <div id="cl" style="font-size:11px;max-height:120px;overflow:auto"></div></div>`;
  document.body.appendChild(p);
  const $ = id => p.querySelector('#' + id);
  const log = m => { $('cl').innerHTML = `${new Date().toLocaleTimeString()} ${m}<br>` + $('cl').innerHTML; };

  // drag + minimize
  let dx, dy, drag = false;
  $('ch').onmousedown = e => { if (e.target.id) return; drag = true; dx = e.clientX - p.offsetLeft; dy = e.clientY - p.offsetTop; };
  const mm = e => { if (drag) { p.style.left = e.clientX - dx + 'px'; p.style.top = e.clientY - dy + 'px'; p.style.right = 'auto'; } };
  const mu = () => { drag = false; };
  document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
  $('cmn').onclick = () => { const b = $('cb'); b.style.display = b.style.display === 'none' ? '' : 'none'; };

  const render = () => {
    const w = done.filter(d => d.r === 'W').length, l = done.filter(d => d.r === 'L').length;
    const t = done.length - w - l;
    $('sw').textContent = w; $('sl').textContent = l; $('st').textContent = t;
    $('sa').textContent = w + l ? Math.round(100 * w / (w + l)) + '%' : '–';
    const by = {};
    done.forEach(d => { (by[d.name] ||= { w: 0, n: 0 }); if (d.r !== 'T') { by[d.name].n++; if (d.r === 'W') by[d.name].w++; } });
    $('sp').innerHTML = Object.entries(by).filter(([, v]) => v.n)
      .map(([k, v]) => `${k}: ${v.w}/${v.n} (${Math.round(100 * v.w / v.n)}%)`).join('<br>') +
      (pending.length ? '<br>' + pending.map(s =>
        `⏳ ${s.name} ${s.dir.toUpperCase()} @${s.entry} → ${Math.max(0, Math.round(s.exp - Date.now() / 1000))}s`).join('<br>') : '');
    if (Date.now() - indT > 1000) { indT = Date.now(); try { $('ci').textContent = indText(); } catch {} }
    $('cs').textContent = `${asset || '?'} | ticks ${ticks} | candles ${candles.length} | trades ${trades}`;
  };

  // ---------- Tick extraction ----------
  const walk = (o, out) => {
    if (Array.isArray(o)) {
      if (o.length >= 2 && o.length <= 4) {
        const nums = o.filter(x => typeof x === 'number');
        const ts = nums.find(x => x > 1e9);
        const pr = nums.find(x => x < 1e7 && x !== ts);
        if (ts && pr !== undefined) {
          out.push({ a: o.find(x => typeof x === 'string'), t: ts > 1e12 ? ts / 1000 : ts, p: pr });
          return;
        }
      }
      o.forEach(x => walk(x, out));
    } else if (o && typeof o === 'object') Object.values(o).forEach(x => walk(x, out));
  };

  const handle = async (data) => {
    let s;
    try {
      if (typeof data === 'string') s = data;
      else if (data instanceof Blob) s = await data.text();
      else s = new TextDecoder().decode(data);
    } catch { return; }
    if (rawLeft > 0 && s.length < 400) { rawLeft--; log('raw: ' + s.slice(0, 90).replace(/</g, '&lt;')); }
    const i = s.search(/[\[{]/);
    if (i < 0) return;
    let j; try { j = JSON.parse(s.slice(i)); } catch { return; }
    const out = []; walk(j, out);
    out.forEach(onTick);
  };

  const onTick = ({ a, t, p: price }) => {
    if (!asset && a) asset = a;
    if (a && asset && a !== asset) return;
    ticks++; lastPrice = price;
    const size = Math.max(5, +$('ct').value);
    const slot = Math.floor(t / size);
    // History detection (e.g. after the platform timeframe changes): a burst of ticks whose feed time
    // jumps far ahead of the wall clock, or ticks arriving out of order. Block trading for 5s after.
    const nowS = Date.now() / 1000;
    const burst = maxT !== -Infinity && (t < maxT - 0.5 || (t - maxT) > (nowS - prevWall) + 2);
    if (burst) histUntil = Date.now() + 5000;
    prevWall = nowS; if (t > maxT) maxT = t;
    const live = Math.abs(nowS - t) < 30 && Date.now() >= histUntil;   // old/history ticks are not live
    if (!live && !histLogged) { histLogged = true; log('History ticks received - used for candles only, no trading on them'); }
    if (!cur || cur.slot !== slot) {
      if (cur) { candles.push(cur); seq++; if (candles.length > 300) candles.shift(); onCandleClose(live); }
      cur = { slot, o: price, h: price, l: price, c: price };
    } else {
      cur.h = Math.max(cur.h, price); cur.l = Math.min(cur.l, price); cur.c = price;
    }
    if (live && $('cq').checked) { try { instant(); } catch (e) { log('instant error: ' + e.message); } }
    resolve(); render();
  };

  // ---------- Win/lose resolution ----------
  const resolve = () => {
    const now = Date.now() / 1000;
    pending = pending.filter(s => {
      if (now < s.exp) return true;
      const diff = lastPrice - s.entry;
      const r = diff === 0 ? 'T' : ((diff > 0) === (s.dir === 'up') ? 'W' : 'L');
      done.push({ ...s, r });
      log(`${r === 'W' ? '✅ WIN' : r === 'L' ? '❌ LOSE' : '➖ TIE'} ${s.name} ${s.dir.toUpperCase()} ${s.entry}→${lastPrice} ${s.real ? '(traded)' : '(signal)'}`);
      return false;
    });
  };
  // ---------- Account balance (read from the page header) ----------
  let startBal = null;
  // The "$" may be drawn by CSS (not in the text), so match amounts like 9,900.00 with 2 decimals,
  // and pick the one closest to the DEMO / REAL label. "Pick balance" button = manual fallback.
  const NUM2 = /^[$€£]?\d[\d,]*\.\d{2}[$€£]?$/;
  const norm = e => (e.textContent || '').replace(/[\s\u00a0\u202f]/g, '');
  const isMoney = e => NUM2.test(norm(e));
  let dbgDone = false, balEl = null, balSel = null;
  const mkSel = e => {
    try {
      if (e.id) return '#' + CSS.escape(e.id);
      const c = typeof e.className === 'string' ? e.className.trim() : '';
      return c ? e.tagName.toLowerCase() + '.' + c.split(/\s+/).map(x => CSS.escape(x)).join('.') : null;
    } catch { return null; }
  };
  const readBal = () => {
    let el = null;
    if (balEl) {
      if (!document.contains(balEl) && balSel) { try { balEl = document.querySelector(balSel) || balEl; } catch {} }
      if (document.contains(balEl)) el = balEl;
    }
    if (!el) {
      const all = [...document.querySelectorAll('body *')].filter(e => {
        if (e.closest('#cbPanel') || e.closest('script,style')) return false;
        const r = e.getBoundingClientRect();
        return r.height > 0 && r.width > 0;
      });
      const hits = all.filter(e => isMoney(e) && ![...e.children].some(isMoney));
      const labels = all.filter(e => !e.children.length && /^(demo|real)/i.test(norm(e)) && norm(e).length < 12);
      if (hits.length) {
        if (labels.length) {
          const lr = labels[0].getBoundingClientRect();
          const d = h => { const r = h.getBoundingClientRect(); return Math.hypot(r.left - lr.left, r.top - lr.top); };
          hits.sort((a, b) => d(a) - d(b));
        } else hits.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        el = hits[0];
      } else if (!dbgDone) {
        dbgDone = true;
        const seen = all.map(norm).filter(t => /\d/.test(t) && t.length < 25);
        log(`balance debug: labels=${labels.length} | ` + [...new Set(seen)].slice(0, 12).join(' | '));
        log('Tip: tap "Pick balance", then tap your balance amount.');
      }
    }
    if (!el) return null;
    const m = (el.textContent || '').replace(/[\s\u00a0\u202f]/g, '').match(/\d[\d,]*\.\d{2}/);
    return m ? parseFloat(m[0].replace(/,/g, '')) : null;
  };
  const updateBal = () => {
    const b = readBal();
    if (b === null) { $('bb').textContent = 'not found'; return; }
    if (startBal === null) startBal = b;
    const pl = b - startBal;
    $('bb').textContent = '$' + b.toLocaleString(undefined, { minimumFractionDigits: 2 });
    $('bp').textContent = (pl >= 0 ? '+' : '-') + '$' + Math.abs(pl).toFixed(2);
    $('bp').style.color = pl > 0 ? '#4ade80' : pl < 0 ? '#f87171' : '#fff';
  };
  const timerId = setInterval(() => {
    try { resolve(); } catch (e) { log('resolve error: ' + e.message); }
    try { render(); } catch (e) { log('render error: ' + e.message); }
    try { updateBal(); } catch (e) { log('balance error: ' + e.message); }
  }, 1000);

  // letters only, so "Buy ↑" or "Buy" + icon both read as "buy"; a container holding Buy AND Sell reads "buysell" and is ignored
  const label = e => (e.textContent || '').toLowerCase().replace(/[^a-z]/g, '');
  const findBtn = labels => {
    const c = [...document.querySelectorAll('button,[role=button],div,a,span')].filter(e => {
      if (e.closest('#cbPanel') || e.children.length >= 5) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && labels.includes(label(e));
    });
    return c.find(e => e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') || c[0] || null;
  };
  const press = el => {
    const t = el.closest('button,[role=button]') || el;
    const o = { bubbles: true, cancelable: true, view: window };
    try {
      t.dispatchEvent(new PointerEvent('pointerdown', o)); t.dispatchEvent(new MouseEvent('mousedown', o));
      t.dispatchEvent(new PointerEvent('pointerup', o)); t.dispatchEvent(new MouseEvent('mouseup', o));
    } catch {}
    t.click();
    return t.tagName.toLowerCase() + ' "' + label(t).slice(0, 12) + '"';
  };

  // ---------- Strategy: Support & Resistance ----------
  // Levels = clusters of confirmed swing highs (resistance) / swing lows (support) on closed candles.
  // BOUNCE: price touches a level and the candle closes back away from it  -> trade the reversal
  // BREAKOUT: candle closes decisively through a level                      -> trade the break
  const minC = () => $('sg').value === 'rsi'
    ? Math.max(5, (Math.round(+$('rl').value) || 3) + 3)          // RSI needs only a few candles
    : Math.max(8, +$('cw').value || 15);
  const P = () => ({
    mode: $('qm').value,                                         // bounce | breakout | both
    N: Math.max(1, Math.round(+$('qn').value || 2)),             // pivot strength (candles each side)
    LB: Math.max(10, Math.round(+$('qb').value || 60)),          // look-back candles
    T: Math.max(1, Math.round(+$('qt').value || 2)),             // min touches for a level
    K: +$('qk').value || 0.3,                                    // zone width = K x ATR
  });

  const atrOf = (list, n = 14) => {
    n = Math.min(n, list.length - 1);
    if (n < 3) return null;
    let t = 0;
    for (let i = list.length - n; i < list.length; i++) {
      const c = list[i], q = list[i - 1];
      t += Math.max(c.h - c.l, Math.abs(c.h - q.c), Math.abs(c.l - q.c));
    }
    return t / n;
  };

  // confirmed swing points only (needs N candles after it), so the newest candles never count
  const pivots = (list, N, type) => {
    const out = [];
    for (let i = N; i < list.length - N; i++) {
      let ok = true;
      for (let k = 1; k <= N && ok; k++) {
        if (type === 'hi') { if (!(list[i].h > list[i - k].h && list[i].h >= list[i + k].h)) ok = false; }
        else if (!(list[i].l < list[i - k].l && list[i].l <= list[i + k].l)) ok = false;
      }
      if (ok) out.push(type === 'hi' ? list[i].h : list[i].l);
    }
    return out;
  };

  const cluster = (prices, tol) => {
    const zones = [];
    [...prices].sort((x, y) => x - y).forEach(pr => {
      const z = zones[zones.length - 1];
      if (z && pr - z.sum / z.n <= tol) { z.sum += pr; z.n++; } else zones.push({ sum: pr, n: 1 });
    });
    return zones.map(z => ({ price: z.sum / z.n, touches: z.n }));
  };

  const srLevels = (list, pr) => {
    const w = list.slice(-pr.LB), a = atrOf(w);
    if (a === null || a <= 0) return null;
    const tol = a * pr.K;
    return {
      a, tol,
      res: cluster(pivots(w, pr.N, 'hi'), tol).filter(z => z.touches >= pr.T),
      sup: cluster(pivots(w, pr.N, 'lo'), tol).filter(z => z.touches >= pr.T),
    };
  };

  const fmt = v => Number(v).toPrecision(6);
  const srSignal = (list = candles) => {
    const pr = P();
    if (list.length < pr.N * 2 + 4) return { warm: true };
    const lv = srLevels(list, pr);
    if (!lv) return { warm: true };
    const { tol, a } = lv, c = list[list.length - 1], q = list[list.length - 2];
    const hits = [];
    if (pr.mode !== 'breakout') {
      lv.sup.forEach(z => { if (c.l <= z.price + tol && c.l >= z.price - 2 * tol && c.c > z.price && c.c > c.o) hits.push(['SR Bounce Up', 'up', z]); });
      lv.res.forEach(z => { if (c.h >= z.price - tol && c.h <= z.price + 2 * tol && c.c < z.price && c.c < c.o) hits.push(['SR Bounce Down', 'down', z]); });
    }
    if (pr.mode !== 'bounce') {
      lv.res.forEach(z => { if (q.c <= z.price + tol * 0.5 && c.c > z.price + tol && c.c > c.o && c.c - c.o >= 0.5 * a) hits.push(['SR Break Up', 'up', z]); });
      lv.sup.forEach(z => { if (q.c >= z.price - tol * 0.5 && c.c < z.price - tol && c.c < c.o && c.o - c.c >= 0.5 * a) hits.push(['SR Break Down', 'down', z]); });
    }
    if (!hits.length) return { sig: null };
    if (hits.some(h => h[1] !== hits[0][1])) return { sig: null };          // conflicting directions: skip
    hits.sort((x, y) => y[2].touches - x[2].touches);
    const [name, dir, z] = hits[0];
    return { sig: [name, dir], detail: `level ${fmt(z.price)} x${z.touches}` };
  };

  // ---------- Strategy: RSI (default period 3, buy at 35, sell at 65) ----------
  // MT4-style RSI (Wilder smoothing) on closes, aligned with candles; NaN until enough data
  const wilderRSI = (cl, L) => {
    const r = new Array(cl.length).fill(NaN);
    if (cl.length <= L) return r;
    let sp = 0, sn = 0;
    for (let i = 1; i <= L; i++) { const d = cl[i] - cl[i - 1]; if (d > 0) sp += d; else sn -= d; }
    sp /= L; sn /= L;
    r[L] = sn === 0 ? 100 : 100 - 100 / (1 + sp / sn);
    for (let i = L + 1; i < cl.length; i++) {
      const d = cl[i] - cl[i - 1];
      sp = (sp * (L - 1) + (d > 0 ? d : 0)) / L;
      sn = (sn * (L - 1) + (d < 0 ? -d : 0)) / L;
      r[i] = sn === 0 ? 100 : 100 - 100 / (1 + sp / sn);
    }
    return r;
  };

  // UP when RSI <= buy level, DOWN when RSI >= sell level.
  // trigger "entry": only on the candle that first enters the zone; "zone": every candle while inside it.
  // zoneOnly=true is used for confluence with S/R (just checks where RSI is now).
  const rsiSignal = (list = candles, zoneOnly = false) => {
    const L = Math.max(2, Math.round(+$('rl').value) || 3);
    const lo = +$('rb').value || 35, hi = +$('rs').value || 65;
    if (list.length < L + 3) return { warm: true };
    const rs = wilderRSI(list.map(c => c.c), L);
    const r0 = rs[rs.length - 1], r1 = rs[rs.length - 2];
    if (isNaN(r0) || isNaN(r1)) return { warm: true };
    const entry = $('rt').value === 'entry' && !zoneOnly;
    let dir = null;
    if (r0 <= lo && (!entry || r1 > lo)) dir = 'up';
    else if (r0 >= hi && (!entry || r1 < hi)) dir = 'down';
    return { r: r0, dir, lo, hi };
  };

  // chooses what to run: S/R, RSI, or both must agree (S/R signal + RSI in the buy/sell zone)
  const getSignal = (list = candles) => {
    const m = $('sg').value, name = d => (d === 'up' ? 'Up' : 'Down');
    if (m === 'rsi') {
      const x = rsiSignal(list);
      if (x.warm) return { warm: true };
      return x.dir ? { sig: ['RSI ' + name(x.dir), x.dir], detail: `RSI ${x.r.toFixed(0)}` } : { sig: null };
    }
    const y = srSignal(list);
    if (y.warm || m === 'sr' || !y.sig) return y;
    const z = rsiSignal(list, true);
    if (z.warm || z.dir !== y.sig[1]) return { sig: null };
    return { sig: ['S/R+RSI ' + name(y.sig[1]), y.sig[1]], detail: `${y.detail}, RSI ${z.r.toFixed(0)}` };
  };

  const indText = () => {
    const m = $('sg').value;
    if (candles.length < minC()) return `warming up: ${candles.length}/${minC()} candles`;
    let t = '';
    if (m !== 'rsi') {
      const lv = srLevels(candles, P());
      if (lv) {
        const px = candles[candles.length - 1].c;
        const s = lv.sup.filter(z => z.price <= px).sort((x, y) => y.price - x.price)[0];
        const r = lv.res.filter(z => z.price >= px).sort((x, y) => x.price - y.price)[0];
        t = `Support ${s ? fmt(s.price) + ' x' + s.touches : '-'} | Resist ${r ? fmt(r.price) + ' x' + r.touches : '-'}`;
      } else t = 'S/R: not enough data';
    }
    if (m !== 'sr') {
      const x = rsiSignal(candles, true);
      t += (t ? ' | ' : '') + (x.warm ? 'RSI warming up' : `RSI ${x.r.toFixed(0)} (buy ≤${x.lo}, sell ≥${x.hi})`);
    }
    return t;
  };

  // Places the trade (if Auto trade is on) and records the signal for win/lose tracking
  const fire = (sig, detail, info) => {
    let real = false;
    const mx = +$('cm').value;                              // 0 = unlimited
    if (!$('ca').checked) log('Auto trade is OFF - signal only');
    else if (mx > 0 && trades >= mx) log('Max trades reached - signal only');
    else if (lastTradeCandle === seq) log('Already traded this candle');
    else {
      const labels = sig[1] === 'up' ? UP : DOWN;
      const btn = findBtn(labels);
      if (btn) { const what = press(btn); trades++; lastTradeCandle = seq; real = true; log(`Trade opened: ${what} (${info})`); }
      else {
        log('Trade button not found - retrying');
        let tries = 0;
        const t = setInterval(() => {
          const b2 = findBtn(labels);
          if (b2) { clearInterval(t); const what = press(b2); trades++; lastTradeCandle = seq; log(`Trade opened (retry): ${what}`); }
          else if (++tries >= 10) { clearInterval(t); log('Trade FAILED: Buy/Sell button never found'); }
        }, 200);
      }
    }
    pending.push({ name: sig[0], dir: sig[1], entry: lastPrice, exp: Date.now() / 1000 + Math.max(5, +$('ce').value), real });
    log(`Signal: ${sig[0]} → ${sig[1].toUpperCase()} (${detail})${real ? ' (traded)' : ''}`);
    render();
  };

  // Mode A: check when a candle closes (trade at next candle open)
  const onCandleClose = (live) => {
    if (!live || $('cq').checked) return;       // history is ignored; instant mode handles itself
    if (candles.length < minC()) return;        // warming up
    const x = getSignal();
    if (x.warm || !x.sig) return;
    const late = (Date.now() / 1000 - (cur.slot + 1) * Math.max(5, +$('ct').value)).toFixed(1);
    fire(x.sig, x.detail, `next candle open +${late}s`);
  };

  // Mode B (instant): check on every live tick using the forming candle, like the MT4 arrow on bar 0
  let instT = 0, instSeq = -1;
  const instant = () => {
    if (!cur || instSeq === seq || candles.length + 1 < minC()) return;
    if (Date.now() - instT < 250) return;
    instT = Date.now();
    const x = getSignal([...candles, cur]);
    if (x.warm || !x.sig) return;
    instSeq = seq;                              // one signal per candle
    const into = (Date.now() / 1000 - cur.slot * Math.max(5, +$('ct').value)).toFixed(0);
    fire(x.sig, x.detail, `instant, ${into}s into candle`);
  };

  // ---------- Hook existing sockets ----------
  const hooked = new WeakSet();
  const origSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (...a) {
    if (!hooked.has(this)) { hooked.add(this); this.addEventListener('message', e => handle(e.data)); log('Socket hooked'); }
    return origSend.apply(this, a);
  };
  window.__cbCleanup = () => {
    WebSocket.prototype.send = origSend;
    clearInterval(timerId);
    document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
  };

  $('cr').onclick = () => { candles = []; cur = null; asset = null; ticks = 0; trades = 0; pending = []; done = []; rawLeft = 3; startBal = null; render(); };
  $('cp').onclick = () => {
    log('Now tap your balance amount on the page…');
    const h = e => {
      if (e.target.closest('#cbPanel')) return;
      e.preventDefault(); e.stopPropagation();
      document.removeEventListener('click', h, true);
      balEl = e.target; balSel = mkSel(balEl); startBal = null;
      log('Balance element set: ' + norm(balEl).slice(0, 30)); updateBal();
    };
    document.addEventListener('click', h, true);
  };
  const showGroups = () => {
    const m = $('sg').value;
    $('gsr').style.display = m === 'rsi' ? 'none' : 'grid';
    $('grs').style.display = m === 'sr' ? 'none' : 'grid';
    log('Strategy: ' + $('sg').options[$('sg').selectedIndex].text);
  };
  $('sg').onchange = showGroups;
  $('gsr').style.display = 'none';              // RSI is the default strategy
  $('ct').onchange = () => { candles = []; cur = null; histUntil = Date.now() + 5000; log('Candle size changed - candles reset'); render(); };
  $('cx').onclick = () => { window.__cbCleanup(); p.remove(); };
  render(); log('Loaded. Waiting for socket activity…');
})();
