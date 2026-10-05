/* Demo-only candle bot v2: win/loss + accuracy tracking, draggable/minimizable panel. */
(() => {
  if (!location.href.includes('demo')) { console.warn('Demo page only.'); return; }
  document.getElementById('cbPanel')?.remove();
  if (window.__cbCleanup) window.__cbCleanup();

  const UP = ['up', 'higher', 'call', 'buy'];
  const DOWN = ['down', 'lower', 'put', 'sell'];

  let candles = [], cur = null, asset = null, ticks = 0, lastPrice = null;
  let trades = 0, lastTradeCandle = -1, rawLeft = 3, seq = 0, histLogged = false;
  let pending = [], done = [];

  // ---------- UI ----------
  const p = document.createElement('div');
  p.id = 'cbPanel';
  p.style.cssText = 'position:fixed;top:60px;right:10px;z-index:999999;width:240px;background:#1b1f2a;' +
    'color:#fff;font:12px sans-serif;border-radius:10px;box-shadow:0 4px 16px #0008;user-select:none';
  p.innerHTML = `
  <div id="ch" style="padding:8px 10px;cursor:move;display:flex;justify-content:space-between;background:#262c3b;border-radius:10px 10px 0 0">
    <b>Candle Bot (demo)</b><span><span id="cmn" style="cursor:pointer;padding:0 6px">–</span><span id="cx" style="cursor:pointer;padding:0 4px">✕</span></span></div>
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
    <div>Min signal score (1-4) <input id="cn" type="number" value="3" min="1" max="4" style="width:100%"></div>
    <div>Max trades <input id="cm" type="number" value="10" min="1" style="width:100%"></div>
    <label><input id="ca" type="checkbox"> Auto trade on signal</label>
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
    try { $('ci').textContent = indText(); } catch {}
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
    const live = Math.abs(Date.now() / 1000 - t) < 30;   // old/history ticks are not live
    if (!live && !histLogged) { histLogged = true; log('History ticks received - used for candles only, no trading on them'); }
    if (!cur || cur.slot !== slot) {
      if (cur) { candles.push(cur); seq++; if (candles.length > 100) candles.shift(); onCandleClose(live); }
      cur = { slot, o: price, h: price, l: price, c: price };
    } else {
      cur.h = Math.max(cur.h, price); cur.l = Math.min(cur.l, price); cur.c = price;
    }
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

  // ---------- Patterns ----------
  const body = c => Math.abs(c.c - c.o);
  const rng = c => c.h - c.l || 1e-9;
  const bull = c => c.c > c.o, bear = c => c.c < c.o;

  const detect = () => {
    const n = candles.length; if (n < 3) return null;
    const c = candles[n - 1], b = candles[n - 2], a = candles[n - 3];
    const up = c.o < c.c ? c.o : c.c, dn = c.o > c.c ? c.o : c.c;
    const lowW = up - c.l, upW = c.h - dn;
    if (bear(b) && bull(c) && c.o <= b.c && c.c >= b.o) return ['Bullish engulfing', 'up'];
    if (bull(b) && bear(c) && c.o >= b.c && c.c <= b.o) return ['Bearish engulfing', 'down'];
    if (body(c) / rng(c) < 0.35 && lowW > 2 * body(c) && upW < body(c) && bear(b)) return ['Hammer', 'up'];
    if (body(c) / rng(c) < 0.35 && upW > 2 * body(c) && lowW < body(c) && bull(b)) return ['Shooting star', 'down'];
    if (bear(a) && body(b) / rng(b) < 0.3 && bull(c) && c.c > (a.o + a.c) / 2) return ['Morning star', 'up'];
    if (bull(a) && body(b) / rng(b) < 0.3 && bear(c) && c.c < (a.o + a.c) / 2) return ['Evening star', 'down'];
    return null;
  };

  const findBtn = labels => [...document.querySelectorAll('button,[role=button],div,a')]
    .filter(e => e.children.length < 4 && !e.closest('#cbPanel'))
    .find(e => labels.includes((e.innerText || '').trim().toLowerCase()));

  // ---------- Indicators (on closed candles) ----------
  const closes = () => candles.map(c => c.c);
  const ema = (arr, n) => { const k = 2 / (n + 1); let e = arr[0]; for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k); return e; };
  const rsi = (arr, n = 14) => {
    if (arr.length < n + 1) return null;
    let g = 0, l = 0;
    for (let i = arr.length - n; i < arr.length; i++) { const d = arr[i] - arr[i - 1]; if (d > 0) g += d; else l -= d; }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  };
  const bbands = (arr, n = 20, m = 2) => {
    if (arr.length < n) return null;
    const x = arr.slice(-n), mean = x.reduce((a, b) => a + b) / n;
    const sd = Math.sqrt(x.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    return { up: mean + m * sd, lo: mean - m * sd };
  };
  const atr = (n = 14) => {
    if (candles.length < n + 1) return null;
    let t = 0;
    for (let i = candles.length - n; i < candles.length; i++) {
      const c = candles[i], q = candles[i - 1];
      t += Math.max(c.h - c.l, Math.abs(c.h - q.c), Math.abs(c.l - q.c));
    }
    return t / n;
  };
  const MIN_CANDLES = 21;
  const indText = () => {
    if (candles.length < MIN_CANDLES) return `warming up: ${candles.length}/${MIN_CANDLES} candles`;
    const cl = closes(), r = rsi(cl), tr = ema(cl, 9) > ema(cl, 21) ? 'up' : 'down';
    return `RSI ${r.toFixed(0)} | trend ${tr}`;
  };

  // Confluence score: pattern(1) + RSI extreme(1) + Bollinger touch(1) + trend agrees(1)
  const scoreSignal = (dir) => {
    const cl = closes(), c = candles[candles.length - 1];
    const r = rsi(cl), b = bbands(cl), a = atr();
    if (r === null || b === null || a === null) return null;
    if (rng(c) < 0.6 * a) return { sc: 0, why: ['candle too small'] };      // skip noise
    let sc = 1; const why = ['pattern'];
    if (dir === 'up' ? r < 35 : r > 65) { sc++; why.push('RSI ' + r.toFixed(0)); }
    if (dir === 'up' ? c.l <= b.lo : c.h >= b.up) { sc++; why.push('Bollinger'); }
    const up = ema(cl, 9) > ema(cl, 21);
    if ((dir === 'up') === up) { sc++; why.push('trend'); }
    return { sc, why };
  };

  let lastSignalSeq = -99;
  const onCandleClose = (live) => {
    if (!live) return;                       // never signal or trade on history
    const s = detect(); if (!s) return;
    if (candles.length < MIN_CANDLES) { log(`Ignored ${s[0]} (warming up ${candles.length}/${MIN_CANDLES})`); return; }

    // adaptive: stop using a pattern that is losing on this session's data
    const st = done.filter(d => d.name === s[0] && d.r !== 'T');
    if (st.length >= 10 && st.filter(d => d.r === 'W').length / st.length < 0.45) { log(`Skipped ${s[0]}: pattern accuracy below 45%`); return; }
    if (seq - lastSignalSeq < 2) { log(`Skipped ${s[0]}: cooldown`); return; }

    const q = scoreSignal(s[1]);
    const need = Math.min(4, Math.max(1, +$('cn').value || 3));
    if (!q || q.sc < need) { log(`Skipped ${s[0]} ${s[1].toUpperCase()} (score ${q ? q.sc : 0}/${need}: ${q ? q.why.join(', ') : 'no data'})`); return; }
    lastSignalSeq = seq;

    let real = false;
    const openReal = pending.some(x => x.real);   // wait for the last trade to finish
    if ($('ca').checked && !openReal && trades < +$('cm').value && lastTradeCandle !== seq) {
      const btn = findBtn(s[1] === 'up' ? UP : DOWN);
      if (btn) { btn.click(); trades++; lastTradeCandle = seq; real = true; }
      else log('Trade button not found');
    }
    // every signal is tracked for accuracy, traded or not
    pending.push({ name: s[0], dir: s[1], entry: lastPrice, exp: Date.now() / 1000 + Math.max(5, +$('ce').value), real });
    log(`Signal: ${s[0]} → ${s[1].toUpperCase()} score ${q.sc} (${q.why.join(', ')})${real ? ' (traded)' : ''}`);
    render();
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
  $('ct').onchange = () => { candles = []; cur = null; log('Candle size changed - candles reset'); render(); };
  $('cx').onclick = () => { window.__cbCleanup(); p.remove(); };
  render(); log('Loaded. Waiting for socket activity…');
})();
