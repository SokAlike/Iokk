/* Demo-only candle bot v2: win/loss + accuracy tracking, draggable/minimizable panel. */
(() => {
  if (!location.href.includes('demo')) { console.warn('Demo page only.'); return; }
  document.getElementById('cbPanel')?.remove();
  if (window.__cbCleanup) window.__cbCleanup();

  const UP = ['up', 'higher', 'call', 'buy'];
  const DOWN = ['down', 'lower', 'put', 'sell'];

  let candles = [], cur = null, asset = null, ticks = 0, lastPrice = null;
  let trades = 0, lastTradeCandle = -1, rawLeft = 3;
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
    <div id="sp" style="color:#9ab;font-size:11px;margin-bottom:6px"></div>
    <div>Candle size (sec) <input id="ct" type="number" value="30" min="5" style="width:100%"></div>
    <div>Trade expiry (sec) <input id="ce" type="number" value="60" min="5" style="width:100%"></div>
    <div>Max trades <input id="cm" type="number" value="10" min="1" style="width:100%"></div>
    <label><input id="ca" type="checkbox"> Auto trade on signal</label>
    <div style="display:flex;gap:6px;margin:6px 0">
      <button id="cr" style="flex:1">Reset</button></div>
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
    if (!cur || cur.slot !== slot) {
      if (cur) { candles.push(cur); if (candles.length > 100) candles.shift(); onCandleClose(); }
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
  const MONEY = /^[$€£]\d[\d,]*(\.\d+)?$/;   // leading currency symbol, e.g. $9,900.00
  const norm = e => (e.textContent || '').replace(/[\s\u00a0\u202f]/g, '');
  const isMoney = e => MONEY.test(norm(e));
  let dbgDone = false;
  const readBal = () => {
    const all = [...document.querySelectorAll('body *')].filter(e => {
      if (e.closest('#cbPanel') || e.closest('script,style')) return false;
      const r = e.getBoundingClientRect();
      return r.height > 0 && r.width > 0;
    });
    const hits = all.filter(e => isMoney(e) && ![...e.children].some(isMoney));
    if (!hits.length) {
      if (!dbgDone) {
        dbgDone = true;
        const seen = all.map(norm).filter(t => t.includes('$') && t.length < 25);
        log('balance debug ($ items): ' + ([...new Set(seen)].slice(0, 10).join(' | ') || 'none'));
      }
      return null;
    }
    hits.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return parseFloat(norm(hits[0]).replace(/[^\d.]/g, ''));
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

  const onCandleClose = () => {
    const s = detect(); if (!s) return;
    let real = false;
    if ($('ca').checked && trades < +$('cm').value && lastTradeCandle !== candles.length) {
      const btn = findBtn(s[1] === 'up' ? UP : DOWN);
      if (btn) { btn.click(); trades++; lastTradeCandle = candles.length; real = true; }
      else log('Trade button not found');
    }
    // every signal is tracked for accuracy, traded or not
    pending.push({ name: s[0], dir: s[1], entry: lastPrice, exp: Date.now() / 1000 + Math.max(5, +$('ce').value), real });
    log(`Signal: ${s[0]} → ${s[1].toUpperCase()}${real ? ' (traded)' : ''}`);
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
  $('cx').onclick = () => { window.__cbCleanup(); p.remove(); };
  render(); log('Loaded. Waiting for socket activity…');
})();
