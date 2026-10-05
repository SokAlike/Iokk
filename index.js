/* Demo-only candle bot v2: win/loss + accuracy tracking, draggable/minimizable panel. */
(() => {
  if (!location.href.includes('demo')) { console.warn('Demo page only.'); return; }
  document.getElementById('cbPanel')?.remove();
  if (window.__cbCleanup) window.__cbCleanup();

  const UP = ['up', 'higher', 'call', 'buy'];
  const DOWN = ['down', 'lower', 'put', 'sell'];

  let candles = [], cur = null, asset = null, ticks = 0, lastPrice = null;
  let trades = 0, lastTradeCandle = -1, rawLeft = 3, seq = 0, histLogged = false, indT = 0;
  let pending = [], done = [];

  // ---------- UI ----------
  const p = document.createElement('div');
  p.id = 'cbPanel';
  p.style.cssText = 'position:fixed;top:60px;right:10px;z-index:999999;width:240px;background:#1b1f2a;' +
    'color:#fff;font:12px sans-serif;border-radius:10px;box-shadow:0 4px 16px #0008;user-select:none';
  p.innerHTML = `
  <div id="ch" style="padding:8px 10px;cursor:move;display:flex;justify-content:space-between;background:#262c3b;border-radius:10px 10px 0 0">
    <b>Bob05 Bot (demo)</b><span><span id="cmn" style="cursor:pointer;padding:0 6px">–</span><span id="cx" style="cursor:pointer;padding:0 4px">✕</span></span></div>
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
    <div>Warm-up candles (min 5) <input id="cw" type="number" value="12" min="5" style="width:100%"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:4px 0">
      <div>RSI length <input id="bl" type="number" value="2" min="1" style="width:100%"></div>
      <div>Half length <input id="bh" type="number" value="2" min="1" style="width:100%"></div>
      <div>Dev period <input id="bd" type="number" value="100" min="5" style="width:100%"></div>
      <div>Deviations <input id="bk" type="number" value="0.7" step="0.1" style="width:100%"></div></div>
    <div>Max trades (0 = unlimited) <input id="cm" type="number" value="0" min="0" style="width:100%"></div>
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
    const live = Math.abs(Date.now() / 1000 - t) < 30;   // old/history ticks are not live
    if (!live && !histLogged) { histLogged = true; log('History ticks received - used for candles only, no trading on them'); }
    if (!cur || cur.slot !== slot) {
      if (cur) { candles.push(cur); seq++; if (candles.length > 300) candles.shift(); onCandleClose(live); }
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

  const findBtn = labels => [...document.querySelectorAll('button,[role=button],div,a')]
    .filter(e => e.children.length < 4 && !e.closest('#cbPanel'))
    .find(e => labels.includes((e.innerText || '').trim().toLowerCase()));

  // ---------- Strategy: Bob05 (RSI + TMA channel, ported from Bob05.mq4) ----------
  // RSI(RsiLength) on close -> triangular-weighted mid line (HalfLength) -> bands = mid +/- StdDev(RSI, DevPeriod) * Deviations
  // UP   when RSI crosses below the lower band (RS[0] < Dn[0] and RS[1] > Dn[1])
  // DOWN when RSI crosses above the upper band (RS[0] > Up[0] and RS[1] < Up[1])
  const minC = () => Math.max(5, +$('cw').value || 12);
  const P = () => ({
    L: Math.max(1, Math.round(+$('bl').value || 2)),
    H: Math.max(1, Math.round(+$('bh').value || 2)),
    D: Math.max(5, Math.round(+$('bd').value || 100)),
    K: +$('bk').value || 0.7,
  });

  // MT4-style iRSI (Wilder smoothing), aligned with candles; NaN until enough data
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

  // channel values at "shift" sh (0 = last closed candle, 1 = the one before)
  const bobBands = (rs, sh, pr) => {
    const n = rs.length;
    const at = k => { const i = n - 1 - k; return i >= 0 && !isNaN(rs[i]) ? rs[i] : null; };
    const c = at(sh); if (c === null) return null;
    let sum = (pr.H + 1) * c, sumw = pr.H + 1;
    for (let j = 1, k = pr.H; j <= pr.H; j++, k--) {
      const past = at(sh + j);
      if (past !== null) { sum += k * past; sumw += k; }
      if (j <= sh) { const fut = at(sh - j); if (fut !== null) { sum += k * fut; sumw += k; } }
    }
    const mid = sum / sumw;
    const w = [];
    for (let k = 0; k < pr.D; k++) { const v = at(sh + k); if (v === null) break; w.push(v); }
    if (w.length < 8) return null;                       // not enough RSI history yet
    const mean = w.reduce((x, y) => x + y, 0) / w.length;
    const dev = Math.sqrt(w.reduce((x, y) => x + (y - mean) ** 2, 0) / w.length);
    return { r: c, mid, up: mid + dev * pr.K, dn: mid - dev * pr.K };
  };

  const bobSignal = () => {
    const pr = P(), rs = wilderRSI(candles.map(c => c.c), pr.L);
    const b0 = bobBands(rs, 0, pr), b1 = bobBands(rs, 1, pr);
    if (!b0 || !b1) return { warm: true };
    let sig = null;
    if (b0.r < b0.dn && b1.r > b1.dn) sig = ['Bob05 Up', 'up'];
    else if (b0.r > b0.up && b1.r < b1.up) sig = ['Bob05 Down', 'down'];
    return { sig, b0 };
  };

  const indText = () => {
    const x = bobSignal();
    if (x.warm) return `Bob05 warming up: ${candles.length} candles`;
    return `Bob05 RSI ${x.b0.r.toFixed(0)} | low ${x.b0.dn.toFixed(0)} | high ${x.b0.up.toFixed(0)}`;
  };

  const onCandleClose = (live) => {
    if (!live) return;                          // never signal or trade on history
    if (candles.length < minC()) return;        // warming up
    const x = bobSignal();
    if (x.warm || !x.sig) return;
    const s = x.sig;

    let real = false;
    const mx = +$('cm').value;                              // 0 = unlimited
    if ($('ca').checked && (mx <= 0 || trades < mx) && lastTradeCandle !== seq) {
      // click immediately: this is the first live tick of the new candle
      const late = (Date.now() / 1000 - (cur.slot + 1) * Math.max(5, +$('ct').value)).toFixed(1);
      const btn = findBtn(s[1] === 'up' ? UP : DOWN);
      if (btn) { btn.click(); trades++; lastTradeCandle = seq; real = true; log(`Trade opened ${late}s after candle open`); }
      else {
        log('Trade button not found - retrying');
        let tries = 0;
        const t = setInterval(() => {
          const b2 = findBtn(s[1] === 'up' ? UP : DOWN);
          if (b2) { clearInterval(t); b2.click(); trades++; log('Trade opened (retry)'); }
          else if (++tries >= 10) { clearInterval(t); log('Trade FAILED: button never found'); }
        }, 200);
      }
    }
    // every signal is tracked for accuracy, traded or not
    pending.push({ name: s[0], dir: s[1], entry: lastPrice, exp: Date.now() / 1000 + Math.max(5, +$('ce').value), real });
    log(`Signal: ${s[0]} → ${s[1].toUpperCase()} (RSI ${x.b0.r.toFixed(0)})${real ? ' (traded)' : ''}`);
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
