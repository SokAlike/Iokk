/* Demo-only strategy bot v3
   Strategies: SuperTrend, RSI, Support/Resistance, S/R + RSI.
   Rules for ALL strategies:
   - the signal is checked when a candle CLOSES, and the trade opens at the NEXT candle open
   - only one trade at a time, and no repeat in the same direction until the opposite signal appears
   Paste in the console on the DEMO page. If you pasted older versions, reload the page (F5) first. */
(() => {
  if (!location.href.includes('demo')) { console.warn('Demo page only.'); return; }
  const hadOld = typeof window.__cbCleanup === 'function' && !window.__cbAutoStart;   // an older copy was pasted on this page
  document.getElementById('cbPanel')?.remove();
  if (window.__cbCleanup) { try { window.__cbCleanup(); } catch {} }
  let dead = false;

  const UP = ['up', 'higher', 'call', 'buy'];
  const DOWN = ['down', 'lower', 'put', 'sell'];

  let candles = [], cur = null, asset = null, ticks = 0, lastPrice = null;
  let trades = 0, rawLeft = 3, seq = 0, histLogged = false, indT = 0, maxT = -Infinity, prevWall = 0, histUntil = 0;
  let lastDir = null, pending = [], done = [];
  const delays = [];                         // how long after the new candle opened each trade was placed
  const t0 = Date.now(), STALL_RELOAD = 180;   // seconds without any price before the optional auto-reload
  let lastTickWall = Date.now(), wake = null;

  // ---------- UI ----------
  const p = document.createElement('div');
  p.id = 'cbPanel';
  p.style.cssText = 'position:fixed;top:60px;right:10px;z-index:999999;width:min(94vw,330px)';
  p.innerHTML = `
<style>
#cbPanel{--bg:#0e1320;--card:#161c2c;--card2:#1b2336;--line:#26304a;--tx:#e7ecf6;--mu:#8b97b0;--ac:#4f8cff;--gr:#22c55e;--rd:#ef4444;--am:#f59e0b;
  background:var(--bg);color:var(--tx);font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;border:1px solid var(--line);
  border-radius:16px;box-shadow:0 14px 44px #000b;overflow:hidden;-webkit-tap-highlight-color:transparent}
#cbPanel *{box-sizing:border-box}
#cbPanel .hd{display:flex;align-items:center;gap:7px;padding:10px;background:linear-gradient(135deg,#1b2850,#121a30);cursor:move;border-bottom:1px solid var(--line);user-select:none}
#cbPanel .logo{flex:none;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-weight:800;background:linear-gradient(135deg,#4f8cff,#8b5cf6)}
#cbPanel .tt{min-width:0;flex:1}
#cbPanel .ttl{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cbPanel .sub{font-size:11px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cbPanel .pill{flex:none;display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap;background:#12351f;color:#4ade80}
#cbPanel .pill i{width:7px;height:7px;border-radius:50%;background:currentColor;animation:cbp 1.6s infinite}
#cbPanel .pill.am{background:#3a2c10;color:#fbbf24}
#cbPanel .pill.rd{background:#3a1d24;color:#f87171}
#cbPanel .pill.bl{background:#16294d;color:#7aa8ff}
@keyframes cbp{50%{opacity:.3}}
#cbPanel .ib{flex:none;width:26px;height:26px;display:grid;place-items:center;border-radius:8px;background:#ffffff14;cursor:pointer;font-size:14px}
#cbPanel .body{padding:12px;max-height:calc(100vh - 150px);overflow-y:auto}
#cbPanel .tabs{display:flex;gap:4px;padding:4px;margin-bottom:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;user-select:none}
#cbPanel .tab{flex:1;border:0;background:transparent;color:var(--mu);padding:8px 4px;border-radius:9px;font:600 12px system-ui,sans-serif}
#cbPanel .tab.on{background:var(--ac);color:#fff}
#cbPanel .pane{display:none}
#cbPanel .pane.on{display:block}
#cbPanel .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:11px;margin-bottom:10px}
#cbPanel .ct{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mu);margin-bottom:8px}
#cbPanel .row{display:flex;align-items:center;justify-content:space-between;gap:8px}
#cbPanel .mu{color:var(--mu);font-size:11px}
#cbPanel .big{font-size:24px;font-weight:800;letter-spacing:-.01em}
#cbPanel .md{font-size:16px;font-weight:700;text-align:right}
#cbPanel .bar{height:6px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:8px}
#cbPanel .bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#4f8cff,#8fb4ff);transition:width .9s linear}
#cbPanel .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:10px}
#cbPanel .stat{display:flex;flex-direction:column;justify-content:center;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:8px 4px;text-align:center;user-select:none}
#cbPanel .stat label{display:block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--mu)}
#cbPanel .stat b{display:block;font-size:20px;margin-top:2px}
#cbPanel .stat.w b{color:#4ade80}
#cbPanel .stat.l b{color:#f87171}
#cbPanel .ring{--p:0;--c:#4f8cff;position:relative;width:46px;height:46px;margin:2px auto 0;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c) calc(var(--p)*1%),#26304a 0)}
#cbPanel .ring::before{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--card2)}
#cbPanel .ring b{position:relative;font-size:12px;margin:0}
#cbPanel .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
#cbPanel .chip{padding:3px 8px;border-radius:99px;background:var(--card2);border:1px solid var(--line);font-size:11px;color:#b8c3da}
#cbPanel .chip.bad{background:#3a1d24;border-color:#6b2630;color:#ffb4b4}
#cbPanel .info{font-size:11.5px;color:#b8c3da;line-height:1.5}
#cbPanel .info + .info{margin-top:4px}
#cbPanel #ed{color:#6ee7b7}
#cbPanel .f{display:flex;flex-direction:column;gap:4px}
#cbPanel .f>span{font-size:11px;color:var(--mu)}
#cbPanel .g2{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}
#cbPanel .s2{grid-column:1/3}
#cbPanel input[type=number],#cbPanel select{width:100%;background:#0d1424;border:1px solid var(--line);color:var(--tx);border-radius:10px;padding:9px 10px;font-size:13px;outline:none;user-select:text}
#cbPanel input[type=number]:focus,#cbPanel select:focus{border-color:var(--ac)}
#cbPanel .desc{margin-top:8px;padding:8px 10px;border-radius:10px;background:#101a33;color:#9db5e8;font-size:11.5px}
#cbPanel .tg{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--line);cursor:pointer;user-select:none}
#cbPanel .tg:first-of-type{border-top:0}
#cbPanel .tg small{display:block;color:var(--mu);font-size:11px;margin-top:1px}
#cbPanel .tg input{position:absolute;opacity:0;pointer-events:none}
#cbPanel .tg .sw{flex:none;position:relative;width:44px;height:26px;border-radius:99px;background:#2a3550;transition:.2s}
#cbPanel .tg .sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}
#cbPanel .tg input:checked+.sw{background:var(--gr)}
#cbPanel .tg input:checked+.sw::after{left:21px}
#cbPanel .btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#cbPanel .btn{border:0;border-radius:11px;padding:11px 8px;font:600 13px system-ui,sans-serif;color:#fff;background:#25314f;user-select:none}
#cbPanel .btn.dan{background:#3a1d24;color:#ff9a9a}
#cbPanel #wn{display:none;background:#40191f;border:1px solid #6b2630;color:#ffb4b4;border-radius:10px;padding:8px 10px;margin-bottom:10px;font-size:11.5px}
#cbPanel #cl{max-height:170px;overflow:auto;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#0a0f1b;border:1px solid var(--line);border-radius:10px;padding:8px}
#cbPanel .ln.win{color:#4ade80}#cbPanel .ln.lose{color:#f87171}#cbPanel .ln.trade{color:#8fb4ff}
#cbPanel .ln.sig{color:#fbbf24}#cbPanel .ln.warn{color:#fb923c}#cbPanel .ln.dim{color:#7f8aa3}
</style>
<div id="ch" class="hd">
  <div class="logo">S</div>
  <div class="tt"><div class="ttl">Strategy Bot</div><div class="sub" id="hs">DEMO · next-candle entry</div></div>
  <div id="stt" class="pill rd"><i></i><span id="stx">STARTING</span></div>
  <span id="cmn" class="ib">–</span><span id="cx" class="ib">✕</span></div>
<div id="cb" class="body">
  <div id="wn"></div>
  <div class="tabs"><button class="tab on" data-tab="live">Live</button><button class="tab" data-tab="strat">Strategy</button><button class="tab" data-tab="set">Settings</button></div>

  <div class="pane on" data-pane="live">
    <div class="card">
      <div class="row"><div><div class="mu">Balance</div><div class="big" id="bb">–</div></div>
        <div><div class="mu" style="text-align:right">Session P/L</div><div class="md" id="bp">–</div></div></div>
      <div class="row" style="margin-top:8px"><div class="mu" id="as">waiting for prices…</div><div class="mu" id="cdt">next candle –</div></div>
      <div class="bar"><i id="cdb"></i></div>
      <div class="chips" id="chips"></div>
      <div id="cs" style="display:none"></div>
    </div>
    <div class="stats">
      <div class="stat w"><label>WIN</label><b id="sw">0</b></div>
      <div class="stat l"><label>LOSE</label><b id="sl">0</b></div>
      <div class="stat"><label>TIE</label><b id="st">0</b></div>
      <div class="stat"><label>ACCURACY</label><div class="ring" id="ring"><b id="sa">–</b></div></div>
    </div>
    <div class="card"><div class="ct">Signal status</div>
      <div class="info" id="ci"></div><div class="info" id="ed"></div><div class="info" id="sp"></div></div>
    <div class="card"><div class="ct">Activity log</div><div id="cl"></div></div>
  </div>

  <div class="pane" data-pane="strat">
    <div class="card"><div class="ct">Strategy</div>
      <select id="sg">
        <option value="st">SuperTrend</option><option value="rsi">RSI</option>
        <option value="sr">Support / Resistance</option><option value="both">S/R + RSI must agree</option>
        <option value="bob">Bob05 (RSI channel)</option><option value="tr">Trend + RSI (pullback)</option>
        <option value="hl">High/Low + RSI</option><option value="ema">EMA crossover</option>
        <option value="cp">Candle patterns</option><option value="tl">Trend lines</option></select>
      <div class="desc" id="sdesc"></div>
      <div id="gst" class="g2">
        <label class="f"><span>ATR period</span><input id="tp" type="number" value="10" min="2"></label>
        <label class="f"><span>Multiplier</span><input id="tm" type="number" value="3" step="0.1"></label></div>
      <div id="grs" class="g2">
        <label class="f"><span>RSI period</span><input id="rl" type="number" value="3" min="2"></label>
        <label class="f"><span>Trigger</span><select id="rt"><option value="entry">On entry</option><option value="zone">While in zone</option></select></label>
        <label class="f"><span>Buy at (≤)</span><input id="rb" type="number" value="35"></label>
        <label class="f"><span>Sell at (≥)</span><input id="rs" type="number" value="65"></label></div>
      <div id="gcp" class="g2">
        <label class="f s2"><span>Patterns</span><select id="pg">
          <option value="all">All patterns</option><option value="eng">Engulfing + piercing / dark cloud</option>
          <option value="star">Morning / evening star</option><option value="pin">Hammer / shooting star</option></select></label>
        <label class="tg s2"><span>Only after a prior move<small>Fewer false signals</small></span><input id="pm" type="checkbox" checked><i class="sw"></i></label></div>
      <div id="gtl" class="g2">
        <label class="f s2"><span>Mode</span><select id="tmd">
          <option value="bounce">Bounce off the line</option><option value="breakout">Breakout through the line</option><option value="both">Both</option></select></label>
        <label class="f"><span>Pivot strength</span><input id="tn" type="number" value="2" min="1"></label>
        <label class="f"><span>Look-back</span><input id="tb" type="number" value="80" min="20"></label>
        <label class="f"><span>Zone (x ATR)</span><input id="tk" type="number" value="0.3" step="0.1"></label></div>
      <div id="gem" class="g2">
        <label class="f"><span>Fast EMA</span><input id="ef" type="number" value="9" min="2"></label>
        <label class="f"><span>Slow EMA</span><input id="es" type="number" value="21" min="3"></label>
        <label class="f s2"><span>Signal</span><select id="em"><option value="x">Fast crosses slow</option><option value="p">Price crosses slow EMA</option></select></label></div>
      <div id="ghl" class="g2">
        <label class="f"><span>Look-back candles</span><input id="hn" type="number" value="10" min="3"></label>
        <label class="f"><span>Mode</span><select id="hm"><option value="rev">Reversal (fade)</option><option value="brk">Breakout (follow)</option></select></label></div>
      <div id="gbb" class="g2">
        <label class="f"><span>RSI length</span><input id="bl" type="number" value="2" min="1"></label>
        <label class="f"><span>Half length</span><input id="bh" type="number" value="2" min="1"></label>
        <label class="f"><span>Dev period</span><input id="bd" type="number" value="100" min="5"></label>
        <label class="f"><span>Deviations</span><input id="bk" type="number" value="0.7" step="0.1"></label></div>
      <div id="gsr" class="g2">
        <label class="f s2"><span>Speed</span><select id="qs">
          <option value="n">Normal (fewer, stronger levels)</option><option value="f" selected>Faster (more signals)</option>
          <option value="x">Fastest (many, weaker signals)</option><option value="c">Custom</option></select></label>
        <label class="f s2"><span>Mode</span><select id="qm">
          <option value="bounce">Bounce (reversal)</option><option value="breakout">Breakout</option><option value="both">Both</option></select></label>
        <label class="f"><span>Pivot strength</span><input id="qn" type="number" value="2" min="1"></label>
        <label class="f"><span>Look-back</span><input id="qb" type="number" value="60" min="10"></label>
        <label class="f"><span>Min touches</span><input id="qt" type="number" value="1" min="1"></label>
        <label class="f"><span>Zone (x ATR)</span><input id="qk" type="number" value="0.3" step="0.1"></label>
        <label class="f s2"><span>Warm-up candles</span><input id="cw" type="number" value="10" min="8"></label></div>
    </div>
    <div class="card"><div class="ct">Trading rules</div>
      <label class="tg"><span>Auto trade<small>Press Buy / Sell when a signal appears</small></span><input id="ca" type="checkbox" checked><i class="sw"></i></label>
      <label class="tg"><span>One trade at a time<small>Wait for the open trade to finish</small></span><input id="fo" type="checkbox" checked><i class="sw"></i></label>
      <label class="tg"><span>No repeat in same direction<small>Wait for the opposite signal first</small></span><input id="fa" type="checkbox" checked><i class="sw"></i></label>
      <div class="g2"><label class="f s2"><span>Max trades (0 = unlimited)</span><input id="cm" type="number" value="0" min="0"></label></div>
    </div>
  </div>

  <div class="pane" data-pane="set">
    <div class="card"><div class="ct">Timing</div>
      <div class="g2" style="margin-top:0">
        <label class="f"><span>Candle size (sec)</span><input id="ct" type="number" value="60" min="5"></label>
        <label class="f"><span>Trade expiry (sec)</span><input id="ce" type="number" value="60" min="5"></label>
        <label class="f s2"><span>Max entry delay after the candle opens (sec)</span><input id="md" type="number" value="3" min="0.5" step="0.5"></label></div>
      <div class="mu" style="margin-top:8px">Candle size must match your chart timeframe. Trade expiry must match the platform timer.</div></div>
    <div class="card"><div class="ct">Reliability</div>
      <label class="tg"><span>Keep screen awake<small>Stops the phone from sleeping</small></span><input id="kw" type="checkbox"><i class="sw"></i></label>
      <label class="tg"><span>Auto-reload if no prices<small>Reloads the page after 3 minutes without data</small></span><input id="ar" type="checkbox"><i class="sw"></i></label></div>
    <div class="card"><div class="ct">Tools</div>
      <div class="btns"><button id="cr" class="btn dan">Reset results</button><button id="cp" class="btn">Pick balance</button></div></div>
  </div>
</div>`;
  document.body.appendChild(p);
  const elCache = {};
  const $ = id => elCache[id] || (elCache[id] = p.querySelector('#' + id));   // look each element up once
  const log = m => {
    const k = /WIN/.test(m) ? 'win' : /LOSE/.test(m) ? 'lose' : /Trade opened/.test(m) ? 'trade' : /Signal:/.test(m) ? 'sig'
      : /Skipped|OFF|FAILED|error|not found|Max trades|Already|⚠|No price/i.test(m) ? 'warn' : 'dim';
    const c = $('cl');
    c.innerHTML = `<span class="ln ${k}">${new Date().toLocaleTimeString()} ${m}</span><br>` + c.innerHTML;
    while (c.childNodes.length > 400) c.removeChild(c.lastChild);     // keep the log short
  };
  p.querySelectorAll('.tab').forEach(b => { b.onclick = () => {       // tabs: Live / Strategy / Settings
    p.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    p.querySelectorAll('.pane').forEach(x => x.classList.toggle('on', x.dataset.pane === b.dataset.tab));
  }; });
  // ---------- Save / restore (settings and results survive a page reload) ----------
  const KEY = 'cbV3';
  const store = {
    get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del: k => { try { localStorage.removeItem(k); } catch {} },
  };
  const saveSettings = () => {
    const o = {};
    p.querySelectorAll('input,select').forEach(e => { if (e.id) o[e.id] = e.type === 'checkbox' ? e.checked : e.value; });
    store.set(KEY + 'S', o);
  };
  const loadSettings = () => {
    const o = store.get(KEY + 'S'); if (!o) return;
    Object.entries(o).forEach(([id, v]) => {
      const e = p.querySelector('#' + id); if (!e) return;
      if (e.type === 'checkbox') e.checked = !!v; else e.value = v;
    });
  };
  const saveStats = () => store.set(KEY + 'T', { done: done.slice(-300), trades, startBal });

  // ---------- Keep the screen awake (phones suspend background/sleeping pages) ----------
  const setWake = async on => {
    try {
      if (on) {
        if (!navigator.wakeLock) { log('Wake lock not supported by this browser'); return; }
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener && wake.addEventListener('release', () => { wake = null; });
        log('Screen will stay on while this tab is visible');
      } else if (wake) { await wake.release(); wake = null; log('Screen wake lock released'); }
    } catch (e) { log('Wake lock failed: ' + e.message); }
  };
  const onVis = () => { if (!document.hidden && $('kw').checked && !wake) setWake(true); };
  document.addEventListener('visibilitychange', onVis);

  if (hadOld) {
    $('wn').style.display = 'block';
    $('wn').textContent = '⚠ Older bot copies may still be running on this page. Their button clicks are blocked, but reload the page (F5) and paste only this file for a clean start.';
  }

  // drag (mouse + touch) and minimize
  let dx, dy, drag = false;
  $('ch').onmousedown = e => { if (e.target.closest('#cmn,#cx')) return; drag = true; dx = e.clientX - p.offsetLeft; dy = e.clientY - p.offsetTop; };
  $('ch').addEventListener('touchstart', e => { if (e.target.closest('#cmn,#cx')) return; const t = e.touches[0]; drag = true; dx = t.clientX - p.offsetLeft; dy = t.clientY - p.offsetTop; }, { passive: true });
  const moveTo = (x, y) => { p.style.left = x - dx + 'px'; p.style.top = y - dy + 'px'; p.style.right = 'auto'; };
  const mm = e => { if (drag) moveTo(e.clientX, e.clientY); };
  const tm = e => { if (drag) moveTo(e.touches[0].clientX, e.touches[0].clientY); };
  const mu = () => { drag = false; };
  document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
  document.addEventListener('touchmove', tm, { passive: true }); document.addEventListener('touchend', mu);
  $('cmn').onclick = () => { const b = $('cb'); b.style.display = b.style.display === 'none' ? '' : 'none'; };

  let lastRender = 0;
  // write to the page only when the value really changed (keeps the panel light on a phone)
  const setT = (id, v) => { const e = $(id); v = String(v); if (e._v !== v) { e._v = v; e.textContent = v; } };
  const setH = (id, v) => { const e = $(id); if (e._v !== v) { e._v = v; e.innerHTML = v; } };
  const setCls = (id, v) => { const e = $(id); if (e._v !== v) { e._v = v; e.className = v; } };
  const setCss = (id, prop, v) => { const e = $(id), k = '_' + prop; if (e[k] !== v) { e[k] = v; e.style.setProperty(prop, v); } };
  const render = () => {
    lastRender = Date.now();
    const w = done.filter(d => d.r === 'W').length, l = done.filter(d => d.r === 'L').length;
    const t = done.length - w - l;
    setT('sw', w); setT('sl', l); setT('st', t);
    setT('sa', w + l ? Math.round(100 * w / (w + l)) + '%' : '–');
    const by = {};
    done.forEach(d => { (by[d.name] ||= { w: 0, n: 0 }); if (d.r !== 'T') { by[d.name].n++; if (d.r === 'W') by[d.name].w++; } });
    setH('sp', Object.entries(by).filter(([, v]) => v.n)
      .map(([k, v]) => `${k}: ${v.w}/${v.n} (${Math.round(100 * v.w / v.n)}%)`).join('<br>') +
      (pending.length ? '<br>' + pending.map(s =>
        `⏳ ${s.name} @${fmt(s.entry)} → ${Math.max(0, Math.round(s.exp - Date.now() / 1000))}s`).join('<br>') : ''));
    if (Date.now() - indT > 1000) { indT = Date.now(); try { setT('ci', indText()); } catch {} }
    const size = Math.max(5, +$('ct').value);
    const feedNow = maxT === -Infinity ? null : maxT + (Date.now() / 1000 - prevWall);
    const secLeft = feedNow === null ? null : Math.ceil(size - (feedNow % size));
    const left = secLeft === null ? '?' : secLeft + 's';
    setT('ed', delays.length
      ? `Entry timing: avg ${(delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(1)}s after the new candle opens, worst ${Math.max(...delays).toFixed(1)}s (${delays.length} trades)`
      : 'Entry mode: NEXT CANDLE ONLY, for every strategy');
    const idle = (Date.now() - lastTickWall) / 1000, up = Math.floor((Date.now() - t0) / 60000);
    // --- visual extras: status pill, countdown bar, accuracy ring, header summary ---
    const acc = w + l ? Math.round(100 * w / (w + l)) : null, warm = candles.length < minC();
    let pc = '', pt;
    if (ticks === 0 || idle > 20) { pc = 'rd'; pt = ticks === 0 ? 'NO DATA' : 'STALLED'; }
    else if (Date.now() < histUntil) { pc = 'am'; pt = 'SYNCING'; }
    else if (warm) { pc = 'am'; pt = `WARM ${candles.length}/${minC()}`; }
    else if ($('ca').checked) pt = 'AUTO';
    else { pc = 'bl'; pt = 'SIGNALS'; }
    setCls('stt', 'pill ' + pc); setT('stx', pt);
    setCss('ring', '--p', String(acc === null ? 0 : acc));
    setCss('ring', '--c', acc === null ? '#4f8cff' : acc >= 55 ? '#22c55e' : acc >= 50 ? '#f59e0b' : '#ef4444');
    setT('hs', done.length ? `${w}W · ${l}L${acc !== null ? ' · ' + acc + '%' : ''}` : 'DEMO · next-candle entry');
    setT('as', asset || 'waiting for prices…');
    setT('cdt', secLeft === null ? 'next candle –' : `next candle in ${left}`);
    setCss('cdb', 'width', secLeft === null ? '0%' : Math.round(100 * (1 - secLeft / size)) + '%');
    setH('chips', [`${candles.length} candles`, `${trades} trades`, `last: ${lastDir ? lastDir.toUpperCase() : '–'}`, `up ${Math.floor(up / 60)}h ${up % 60}m`]
      .map(x => `<span class="chip">${x}</span>`).join('') + (idle > 20 ? `<span class="chip bad">⚠ no price data ${Math.round(idle)}s</span>` : ''));
    setT('cs', `${asset || '?'} | next candle ${left} | candles ${candles.length} | trades ${trades} | last ${lastDir ? lastDir.toUpperCase() : '-'} | up ${Math.floor(up / 60)}h${up % 60}m` +
      (idle > 20 ? ` | ⚠ no price data ${Math.round(idle)}s` : ''));
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
    if (dead) return;
    let s;
    try {
      if (typeof data === 'string') s = data;
      else if (data instanceof Blob) s = await data.text();
      else s = new TextDecoder().decode(data);
    } catch { return; }
    if (dead) return;
    if (rawLeft > 0 && s.length < 400) { rawLeft--; log('raw: ' + s.slice(0, 90).replace(/</g, '&lt;')); }
    const i = s.search(/[\[{]/);
    if (i < 0) return;
    let j; try { j = JSON.parse(s.slice(i)); } catch { return; }
    const out = []; walk(j, out);
    out.forEach(onTick);
  };

  const onTick = ({ a, t, p: price }) => {
    if (dead) return;
    if (!asset && a) asset = a;
    if (a && asset && a !== asset) return;
    ticks++; lastPrice = price; lastTickWall = Date.now();
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
      if (cur) { candles.push(cur); seq++; if (candles.length > 300) candles.shift(); onCandleClose(live, t); }
      cur = { slot, o: price, h: price, l: price, c: price };
    } else {
      cur.h = Math.max(cur.h, price); cur.l = Math.min(cur.l, price); cur.c = price;
    }
    resolve(); if (Date.now() - lastRender >= 250) render();        // at most ~4 redraws per second from price ticks
  };

  // ---------- Win/lose resolution ----------
  const resolve = () => {
    const now = Date.now() / 1000;
    pending = pending.filter(s => {
      if (now < s.exp) return true;
      const diff = lastPrice - s.entry;
      const r = diff === 0 ? 'T' : ((diff > 0) === (s.dir === 'up') ? 'W' : 'L');
      done.push({ ...s, r }); saveStats();
      log(`${r === 'W' ? '✅ WIN' : r === 'L' ? '❌ LOSE' : '➖ TIE'} ${s.name} ${s.dir.toUpperCase()} ${fmt(s.entry)}→${fmt(lastPrice)} ${s.real ? '(traded)' : '(signal)'}`);
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
  const reloadPage = () => (window.__cbReload ? window.__cbReload() : location.reload());
  let reloading = false, saveTick = 0;
  const timerId = setInterval(() => {
    if (dead) return;
    if (++saveTick % 5 === 0) saveSettings();          // also save every 5s, whatever way a setting was changed
    // the page may remove our panel (it re-renders): put it back, all state is kept
    if (document.body && !document.body.contains(p)) { document.body.appendChild(p); log('Panel was removed by the page - restored'); }
    try { resolve(); } catch (e) { log('resolve error: ' + e.message); }
    try { render(); } catch (e) { log('render error: ' + e.message); }
    try { updateBal(); } catch (e) { log('balance error: ' + e.message); }
    if ($('ar').checked && !reloading && (Date.now() - lastTickWall) / 1000 > STALL_RELOAD) {
      reloading = true; log('No price data for 3 min - reloading the page'); saveStats(); reloadPage();
    }
  }, 1000);

  // ---------- Pressing Buy / Sell ----------
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

  // Safety net: older pasted copies of this bot can still be alive on the page (their socket listeners
  // cannot be removed from outside). Only THIS copy is allowed to press Buy/Sell programmatically.
  // Real finger taps are not affected.
  let allow = false;
  const origClick = window.__cbOrigClick || HTMLElement.prototype.click;
  const origDispatch = window.__cbOrigDispatch || EventTarget.prototype.dispatchEvent;
  window.__cbOrigClick = origClick; window.__cbOrigDispatch = origDispatch;
  const isTradeEl = el => {
    try { const b = (el.closest && el.closest('button,[role=button]')) || el; const l = label(b); return UP.includes(l) || DOWN.includes(l); }
    catch { return false; }
  };
  HTMLElement.prototype.click = function (...a) {
    if (!allow && isTradeEl(this)) return;
    return origClick.apply(this, a);
  };
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (!allow && ev && ev.isTrusted === false && this instanceof Element &&
        /^(click|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend)$/.test(ev.type) && isTradeEl(this)) return true;
    return origDispatch.apply(this, arguments);
  };

  const press = el => {
    const t = el.closest('button,[role=button]') || el;
    const o = { bubbles: true, cancelable: true, view: window };
    allow = true;
    try {
      try {
        t.dispatchEvent(new PointerEvent('pointerdown', o)); t.dispatchEvent(new MouseEvent('mousedown', o));
        t.dispatchEvent(new PointerEvent('pointerup', o)); t.dispatchEvent(new MouseEvent('mouseup', o));
      } catch {}
      t.click();
    } finally { allow = false; }
    return t.tagName.toLowerCase() + ' "' + label(t).slice(0, 12) + '"';
  };

  // ---------- Strategy: SuperTrend ----------
  const fmt = v => Number(v).toPrecision(6);
  const superTrend = (list, per, mult) => {
    const n = list.length;
    if (n < per + 2) return null;
    const tr = list.map((c, i) => i === 0 ? c.h - c.l
      : Math.max(c.h - c.l, Math.abs(c.h - list[i - 1].c), Math.abs(c.l - list[i - 1].c)));
    let a = 0;
    for (let i = 0; i < per; i++) a += tr[i];
    a /= per;                                                  // Wilder ATR seeded with a simple average
    const trend = new Array(n).fill(1);
    let up = null, dn = null, line = null;
    for (let i = per - 1; i < n; i++) {
      if (i >= per) a = (a * (per - 1) + tr[i]) / per;
      const hl2 = (list[i].h + list[i].l) / 2;
      let u = hl2 - mult * a, d = hl2 + mult * a;
      if (i > per - 1) {
        if (list[i - 1].c > up) u = Math.max(u, up);
        if (list[i - 1].c < dn) d = Math.min(d, dn);
        const prev = trend[i - 1];
        trend[i] = prev === -1 && list[i].c > dn ? 1 : prev === 1 && list[i].c < up ? -1 : prev;
      }
      up = u; dn = d;
      line = trend[i] === 1 ? up : dn;
    }
    return { trend, line };
  };

  // signal only on the candle where the trend FLIPS (down->up = UP, up->down = DOWN)
  const stSignal = (list = candles) => {
    const per = Math.max(2, Math.round(+$('tp').value) || 10), mult = +$('tm').value || 3;
    const r = superTrend(list, per, mult), n = list.length;
    if (!r || n < per + 4) return { warm: true };
    const a = r.trend[n - 1], b = r.trend[n - 2];
    if (a === b) return { dir: null, now: a, line: r.line };
    return { dir: a === 1 ? 'up' : 'down', now: a, line: r.line, detail: `trend flipped ${a === 1 ? 'up' : 'down'}, line ${fmt(r.line)}` };
  };

  // ---------- Strategy: RSI (default period 3, buy at 35, sell at 65) ----------
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
  // trigger "entry": only on the candle that first enters the zone; "zone": every candle inside it.
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

  // ---------- Strategy: Support & Resistance ----------
  // Levels = clusters of confirmed swing highs (resistance) / swing lows (support) on closed candles.
  // BOUNCE: price touches a level and the candle closes back away from it  -> trade the reversal
  // BREAKOUT: candle closes decisively through a level                      -> trade the break
  const P = () => ({
    mode: $('qm').value,
    N: Math.max(1, Math.round(+$('qn').value || 2)),
    LB: Math.max(10, Math.round(+$('qb').value || 60)),
    T: Math.max(1, Math.round(+$('qt').value || 1)),
    K: +$('qk').value || 0.3,
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

  // ---------- Strategy: Bob05 (RSI + TMA channel, ported from Bob05.mq4) ----------
  // RSI(length) -> triangular-weighted mid line (half length) -> bands = mid +/- StdDev(RSI, dev period) * deviations
  // UP   when RSI crosses below the lower band (RS[0] < Dn[0] and RS[1] > Dn[1])
  // DOWN when RSI crosses above the upper band (RS[0] > Up[0] and RS[1] < Up[1])
  const BP = () => ({
    L: Math.max(1, Math.round(+$('bl').value || 2)),
    H: Math.max(1, Math.round(+$('bh').value || 2)),
    D: Math.max(5, Math.round(+$('bd').value || 100)),
    K: +$('bk').value || 0.7,
  });
  const bobBands = (rs, sh, pr) => {          // sh = shift: 0 = last closed candle, 1 = the one before
    const n = rs.length;
    const at = k => { const i = n - 1 - k; return i >= 0 && !isNaN(rs[i]) ? rs[i] : null; };
    const c = at(sh); if (c === null) return null;
    let sum = (pr.H + 1) * c, sumw = pr.H + 1;
    for (let j = 1, k = pr.H; j <= pr.H; j++, k--) {
      const past = at(sh + j);
      if (past !== null) { sum += k * past; sumw += k; }
      if (j <= sh) { const fut = at(sh - j); if (fut !== null) { sum += k * fut; sumw += k; } }
    }
    const mid = sum / sumw, w = [];
    for (let k = 0; k < pr.D; k++) { const v = at(sh + k); if (v === null) break; w.push(v); }
    if (w.length < 6) return null;                       // not enough RSI history yet
    const mean = w.reduce((x, y) => x + y, 0) / w.length;
    const dev = Math.sqrt(w.reduce((x, y) => x + (y - mean) ** 2, 0) / w.length);
    return { r: c, mid, up: mid + dev * pr.K, dn: mid - dev * pr.K };
  };
  const bobSignal = (list = candles) => {
    const pr = BP(), rs = wilderRSI(list.map(c => c.c), pr.L);
    const b0 = bobBands(rs, 0, pr), b1 = bobBands(rs, 1, pr);
    if (!b0 || !b1) return { warm: true };
    let dir = null;
    if (b0.r < b0.dn && b1.r > b1.dn) dir = 'up';
    else if (b0.r > b0.up && b1.r < b1.up) dir = 'down';
    return { dir, b0, detail: `RSI ${b0.r.toFixed(0)} vs band ${b0.dn.toFixed(0)}-${b0.up.toFixed(0)}` };
  };

  // ---------- Strategy: Trend + RSI (pullback in the direction of the SuperTrend) ----------
  // UP   when SuperTrend is UP   and RSI drops into the buy zone  (dip in an uptrend)
  // DOWN when SuperTrend is DOWN and RSI rises into the sell zone (bounce in a downtrend)
  const trSignal = (list = candles) => {
    const t = stSignal(list), r = rsiSignal(list);
    if (t.warm || r.warm) return { warm: true };
    const trend = t.now === 1 ? 'up' : 'down';
    if (!r.dir || r.dir !== trend) return { dir: null, trend, r: r.r };
    return { dir: r.dir, trend, r: r.r, detail: `trend ${trend}, RSI ${r.r.toFixed(0)}` };
  };

  // ---------- Strategy: High/Low + RSI ----------
  // hi/lo = highest high / lowest low of the N candles BEFORE the signal candle.
  // Reversal (fade):  signal candle takes out the N-candle LOW  and RSI <= buy level  -> UP
  //                   signal candle takes out the N-candle HIGH and RSI >= sell level -> DOWN
  // Breakout (follow): candle CLOSES above the N-candle high with RSI >= 50 -> UP
  //                    candle CLOSES below the N-candle low  with RSI <= 50 -> DOWN
  const hlSignal = (list = candles) => {
    const N = Math.max(3, Math.round(+$('hn').value) || 10), rev = $('hm').value === 'rev';
    const z = rsiSignal(list, true);
    if (z.warm || list.length < N + 2) return { warm: true };
    const c = list[list.length - 1], prev = list.slice(-N - 1, -1);
    const hi = Math.max(...prev.map(k => k.h)), lo = Math.min(...prev.map(k => k.l));
    let dir = null;
    if (rev) {
      if (c.l <= lo && z.r <= z.lo) dir = 'up';
      else if (c.h >= hi && z.r >= z.hi) dir = 'down';
    } else {
      if (c.c > hi && z.r >= 50) dir = 'up';
      else if (c.c < lo && z.r <= 50) dir = 'down';
    }
    const what = dir === 'up' ? (rev ? `new ${N}-candle low ${fmt(lo)}` : `close above ${N}-candle high ${fmt(hi)}`)
      : dir === 'down' ? (rev ? `new ${N}-candle high ${fmt(hi)}` : `close below ${N}-candle low ${fmt(lo)}`) : '';
    return { dir, hi, lo, r: z.r, detail: `${what}, RSI ${z.r.toFixed(0)}` };
  };

  // ---------- Strategy: EMA ----------
  // Fast/slow crossover: UP when the fast EMA crosses above the slow EMA, DOWN when it crosses below.
  // "Price crosses slow EMA": UP when the close crosses above the slow EMA, DOWN when it crosses below.
  // Checked on closed candles, so it trades only the candle where the cross happens (not every candle after).
  const emaSeries = (cl, n) => {
    const out = new Array(cl.length).fill(NaN);
    if (cl.length < n) return out;
    let e = 0; for (let i = 0; i < n; i++) e += cl[i]; e /= n; out[n - 1] = e;       // seeded with a simple average
    const k = 2 / (n + 1);
    for (let i = n; i < cl.length; i++) { e = cl[i] * k + e * (1 - k); out[i] = e; }
    return out;
  };
  const emaPeriods = () => {
    const f = Math.max(2, Math.round(+$('ef').value) || 9);
    return { f, sl: Math.max(f + 1, Math.round(+$('es').value) || 21) };
  };
  const emaSignal = (list = candles) => {
    const { f, sl } = emaPeriods(), mode = $('em').value, cl = list.map(c => c.c), n = cl.length;
    if (n < sl + 2) return { warm: true };
    const fa = emaSeries(cl, f), sa = emaSeries(cl, sl);
    const a0 = mode === 'x' ? fa[n - 1] : cl[n - 1], a1 = mode === 'x' ? fa[n - 2] : cl[n - 2], b0 = sa[n - 1], b1 = sa[n - 2];
    if ([a0, a1, b0, b1].some(isNaN)) return { warm: true };
    let dir = null;
    if (a1 <= b1 && a0 > b0) dir = 'up'; else if (a1 >= b1 && a0 < b0) dir = 'down';
    const what = mode === 'x' ? `EMA${f} crossed ${dir === 'up' ? 'above' : 'below'} EMA${sl}` : `price crossed ${dir === 'up' ? 'above' : 'below'} EMA${sl}`;
    return { dir, f, sl, mode, fast: fa[n - 1], slow: b0, detail: what };
  };

  // ---------- Strategy: Candle patterns ----------
  // Reversal patterns on the last 1-3 CLOSED candles. "Only after a prior move": a bullish pattern needs the
  // market to have fallen into it (close 1 candle before the pattern lower than 3 candles earlier), bearish needs a rise.
  const cpBody = c => Math.abs(c.c - c.o), cpRange = c => (c.h - c.l) || 1e-9;
  const cpBull = c => c.c > c.o, cpBear = c => c.c < c.o;
  const patternSignal = (list = candles) => {
    const n = list.length;
    if (n < 8) return { warm: true };
    const grp = $('pg').value, need = $('pm').checked;
    const c = list[n - 1], b = list[n - 2], a = list[n - 3];
    const fell = i0 => list[i0 - 1].c < list[i0 - 4].c, rose = i0 => list[i0 - 1].c > list[i0 - 4].c;
    const out = [];
    const add = (name, dir, i0) => { if (!need || (dir === 'up' ? fell(i0) : rose(i0))) out.push([name, dir]); };
    const bc = cpBody(c), rc = cpRange(c), top = Math.max(c.o, c.c), bot = Math.min(c.o, c.c);
    const upW = c.h - top, lowW = bot - c.l;
    if (grp === 'all' || grp === 'eng') {
      if (cpBear(b) && cpBull(c) && c.o <= b.c && c.c >= b.o && bc > cpBody(b)) add('Bullish engulfing', 'up', n - 2);
      if (cpBull(b) && cpBear(c) && c.o >= b.c && c.c <= b.o && bc > cpBody(b)) add('Bearish engulfing', 'down', n - 2);
      if (cpBear(b) && cpBull(c) && c.o < b.c && c.c > (b.o + b.c) / 2 && c.c < b.o) add('Piercing line', 'up', n - 2);
      if (cpBull(b) && cpBear(c) && c.o > b.c && c.c < (b.o + b.c) / 2 && c.c > b.o) add('Dark cloud cover', 'down', n - 2);
    }
    if (grp === 'all' || grp === 'star') {
      const sm = k => cpBody(k) / cpRange(k) <= 0.3 && cpBody(k) < 0.5 * cpBody(a);
      if (cpBear(a) && sm(b) && cpBull(c) && c.c > (a.o + a.c) / 2) add('Morning star', 'up', n - 3);
      if (cpBull(a) && sm(b) && cpBear(c) && c.c < (a.o + a.c) / 2) add('Evening star', 'down', n - 3);
    }
    if (grp === 'all' || grp === 'pin') {
      if (bc / rc <= 0.35 && lowW >= 0.55 * rc && upW <= 0.25 * rc) add('Hammer', 'up', n - 1);
      if (bc / rc <= 0.35 && upW >= 0.55 * rc && lowW <= 0.25 * rc) add('Shooting star', 'down', n - 1);
    }
    if (!out.length || out.some(o => o[1] !== out[0][1])) return { sig: null };      // none, or conflicting
    return { sig: ['Candle ' + out[0][0], out[0][1]], detail: out.map(o => o[0]).join(' + ') + (need ? ', after a prior move' : '') };
  };

  // ---------- Strategy: Trend lines ----------
  // Uptrend line = rising line through swing LOWS (support); downtrend line = falling line through swing HIGHS (resistance).
  // The bot tries pairs of the latest swings, keeps lines that price never closed through, and prefers lines with most touches.
  // BOUNCE: candle touches the line and closes back away from it.  BREAKOUT: strong candle closes through the line.
  const TP = () => ({
    N: Math.max(1, Math.round(+$('tn').value || 2)), LB: Math.max(20, Math.round(+$('tb').value || 80)),
    K: +$('tk').value || 0.3, mode: $('tmd').value,
  });
  const pivotIdx = (list, N, type) => {
    const out = [];
    for (let i = N; i < list.length - N; i++) {
      let ok = true;
      for (let k = 1; k <= N && ok; k++) {
        if (type === 'hi') { if (!(list[i].h > list[i - k].h && list[i].h >= list[i + k].h)) ok = false; }
        else if (!(list[i].l < list[i - k].l && list[i].l <= list[i + k].l)) ok = false;
      }
      if (ok) out.push({ i, p: type === 'hi' ? list[i].h : list[i].l });
    }
    return out;
  };
  const bestLine = (pts, type, list, tol, upto) => {
    const cand = pts.slice(-5);
    let best = null;
    for (let x = 0; x < cand.length; x++) for (let y = x + 1; y < cand.length; y++) {
      const A = cand[x], B = cand[y];
      if (B.i - A.i < 3) continue;                                         // points too close together
      const slope = (B.p - A.p) / (B.i - A.i);
      if (type === 'lo' ? slope <= 0 : slope >= 0) continue;               // support must rise, resistance must fall
      const at = i => A.p + slope * (i - A.i);
      let ok = true;
      for (let i = A.i; i <= upto && ok; i++) if (type === 'lo' ? list[i].c < at(i) - tol : list[i].c > at(i) + tol) ok = false;
      if (!ok) continue;                                                   // price closed through it: not a valid line
      const touches = cand.filter(P => Math.abs(P.p - at(P.i)) <= tol).length;
      if (!best || touches > best.touches || (touches === best.touches && B.i > best.B.i)) best = { A, B, slope, touches, at };
    }
    return best;
  };
  const tlLines = (list, pr) => {
    const w = list.slice(-pr.LB), a = atrOf(w);
    if (!a || a <= 0) return null;
    const tol = a * pr.K, n = w.length, lows = pivotIdx(w, pr.N, 'lo'), highs = pivotIdx(w, pr.N, 'hi');
    return { w, a, tol, n, nl: lows.length, nh: highs.length, sup: bestLine(lows, 'lo', w, tol, n - 2), res: bestLine(highs, 'hi', w, tol, n - 2) };
  };
  const tlSignal = (list = candles) => {
    const pr = TP();
    if (list.length < Math.max(12, pr.N * 2 + 10)) return { warm: true };
    const L = tlLines(list, pr);
    if (!L) return { warm: true };
    const { w, a, tol, n, sup, res } = L, c = w[n - 1], q = w[n - 2], hits = [];
    if (sup) {
      const v = sup.at(n - 1), vq = sup.at(n - 2);
      if (pr.mode !== 'breakout' && c.l <= v + tol && c.l >= v - 2 * tol && c.c > v && c.c > c.o) hits.push(['Trendline Bounce Up', 'up', v, sup]);
      if (pr.mode !== 'bounce' && q.c >= vq - tol * 0.5 && c.c < v - tol && c.c < c.o && c.o - c.c >= 0.5 * a) hits.push(['Trendline Break Down', 'down', v, sup]);
    }
    if (res) {
      const v = res.at(n - 1), vq = res.at(n - 2);
      if (pr.mode !== 'breakout' && c.h >= v - tol && c.h <= v + 2 * tol && c.c < v && c.c < c.o) hits.push(['Trendline Bounce Down', 'down', v, res]);
      if (pr.mode !== 'bounce' && q.c <= vq + tol * 0.5 && c.c > v + tol && c.c > c.o && c.c - c.o >= 0.5 * a) hits.push(['Trendline Break Up', 'up', v, res]);
    }
    if (!hits.length || hits.some(h => h[1] !== hits[0][1])) return { sig: null };
    hits.sort((x, y) => y[3].touches - x[3].touches);
    const [name, dir, v, ln] = hits[0];
    return { sig: [name, dir], detail: `line ${fmt(v)}, ${ln.touches} touches` };
  };

  // ---------- Strategy chooser ----------
  const minC = () => {
    const m = $('sg').value;
    if (m === 'rsi') return Math.max(5, (Math.round(+$('rl').value) || 3) + 3);
    if (m === 'st' || m === 'tr') return Math.max(8, (Math.round(+$('tp').value) || 10) + 5);
    if (m === 'bob') return Math.max(8, (Math.round(+$('bl').value) || 2) + 10);
    if (m === 'ema') return Math.max(8, emaPeriods().sl + 3);
    if (m === 'cp') return 8;
    if (m === 'tl') return Math.max(12, (Math.round(+$('tn').value) || 2) * 2 + 10);
    if (m === 'hl') return Math.max(8, (Math.round(+$('hn').value) || 10) + 3, (Math.round(+$('rl').value) || 3) + 3);
    return Math.max(8, +$('cw').value || 10);
  };
  const getSignal = (list = candles) => {
    const m = $('sg').value, nm = d => (d === 'up' ? 'Up' : 'Down');
    if (m === 'st') {
      const x = stSignal(list);
      if (x.warm) return { warm: true };
      return x.dir ? { sig: ['SuperTrend ' + nm(x.dir), x.dir], detail: x.detail } : { sig: null };
    }
    if (m === 'rsi') {
      const x = rsiSignal(list);
      if (x.warm) return { warm: true };
      return x.dir ? { sig: ['RSI ' + nm(x.dir), x.dir], detail: `RSI ${x.r.toFixed(0)}` } : { sig: null };
    }
    if (m === 'bob') {
      const x = bobSignal(list);
      if (x.warm) return { warm: true };
      return x.dir ? { sig: ['Bob05 ' + nm(x.dir), x.dir], detail: x.detail } : { sig: null };
    }
    if (m === 'cp' || m === 'tl') {
      const x = m === 'cp' ? patternSignal(list) : tlSignal(list);
      return x.warm ? { warm: true } : x;
    }
    if (m === 'ema') {
      const x = emaSignal(list);
      if (x.warm) return { warm: true };
      return x.dir ? { sig: ['EMA ' + nm(x.dir), x.dir], detail: x.detail } : { sig: null };
    }
    if (m === 'hl') {
      const x = hlSignal(list);
      if (x.warm) return { warm: true };
      return x.dir ? { sig: ['HiLo+RSI ' + nm(x.dir), x.dir], detail: x.detail } : { sig: null };
    }
    if (m === 'tr') {
      const x = trSignal(list);
      if (x.warm) return { warm: true };
      return x.dir ? { sig: ['Trend+RSI ' + nm(x.dir), x.dir], detail: x.detail } : { sig: null };
    }
    const y = srSignal(list);                                  // 'sr' or 'both'
    if (y.warm || m === 'sr' || !y.sig) return y;
    const z = rsiSignal(list, true);
    if (z.warm || z.dir !== y.sig[1]) return { sig: null };
    return { sig: ['S/R+RSI ' + nm(y.sig[1]), y.sig[1]], detail: `${y.detail}, RSI ${z.r.toFixed(0)}` };
  };
  const indText = () => {
    const m = $('sg').value;
    if (candles.length < minC()) return `warming up: ${candles.length}/${minC()} candles`;
    const parts = [];
    if (m === 'st') {
      const x = stSignal(candles);
      parts.push(x.warm ? 'SuperTrend warming up' : `SuperTrend ${x.now === 1 ? 'UP' : 'DOWN'} (line ${fmt(x.line)})`);
    }
    if (m === 'bob') {
      const x = bobSignal(candles);
      parts.push(x.warm ? 'Bob05 warming up' : `Bob05 RSI ${x.b0.r.toFixed(0)} | low ${x.b0.dn.toFixed(0)} | high ${x.b0.up.toFixed(0)}`);
    }
    if (m === 'cp') parts.push(`Watching candle patterns (${$('pg').options[$('pg').selectedIndex].text}${$('pm').checked ? ', prior move required' : ''})`);
    if (m === 'tl') {
      const pr = TP(), L = tlLines(candles, pr);
      parts.push(L ? `Uptrend line ${L.sup ? fmt(L.sup.at(L.n - 1)) + ' (' + L.sup.touches + ' pts)' : 'none'} | Downtrend line ${L.res ? fmt(L.res.at(L.n - 1)) + ' (' + L.res.touches + ' pts)' : 'none'} | swings ${L.nl} low, ${L.nh} high` : 'Trend lines: not enough data');
    }
    if (m === 'ema') {
      const x = emaSignal(candles);
      parts.push(x.warm ? 'EMA warming up' : `EMA${x.f} ${fmt(x.fast)} | EMA${x.sl} ${fmt(x.slow)} | ${x.mode === 'x' ? (x.fast > x.slow ? 'fast above slow' : 'fast below slow') : 'watching price vs slow EMA'}`);
    }
    if (m === 'hl') {
      const x = hlSignal(candles);
      parts.push(x.warm ? 'High/Low warming up' : `Range high ${fmt(x.hi)} | low ${fmt(x.lo)} | RSI ${x.r.toFixed(0)}`);
    }
    if (m === 'tr') {
      const x = trSignal(candles);
      parts.push(x.warm ? 'Trend+RSI warming up' : `Trend ${x.trend.toUpperCase()} | RSI ${x.r.toFixed(0)}`);
    }
    if (m === 'sr' || m === 'both') {
      const pr = P(), lv = srLevels(candles, pr);
      if (lv) {
        const w = candles.slice(-pr.LB);
        parts.push(`Levels: ${lv.sup.length} support, ${lv.res.length} resistance (need ${pr.T}+ touch${pr.T > 1 ? 'es' : ''}; swings seen: ${pivots(w, pr.N, 'lo').length} low, ${pivots(w, pr.N, 'hi').length} high)`);
        const px = candles[candles.length - 1].c;
        const s = lv.sup.filter(z => z.price <= px).sort((x, y) => y.price - x.price)[0];
        const r = lv.res.filter(z => z.price >= px).sort((x, y) => x.price - y.price)[0];
        parts.push(`Support ${s ? fmt(s.price) + ' x' + s.touches : '-'} | Resist ${r ? fmt(r.price) + ' x' + r.touches : '-'}`);
      } else parts.push('S/R: not enough data');
    }
    if (m === 'rsi' || m === 'both') {
      const x = rsiSignal(candles, true);
      parts.push(x.warm ? 'RSI warming up' : `RSI ${x.r.toFixed(0)} (buy ≤${x.lo}, sell ≥${x.hi})`);
    }
    return parts.join(' | ');
  };

  // ---------- Placing trades ----------
  // Filters (apply to every strategy):
  //  1) one trade at a time        2) no repeat in the same direction until the opposite signal
  // Only signals that pass are traded AND counted in WIN/LOSE.
  const fire = (sig, detail, info, late = 0) => {
    const dir = sig[1], other = dir === 'up' ? 'DOWN' : 'UP', nowS = Date.now() / 1000;
    if ($('fo').checked && pending.some(x => x.exp - nowS > 3)) { log(`Skipped ${sig[0]}: previous trade still open`); return; }
    if ($('fa').checked && lastDir === dir) { log(`Skipped ${sig[0]}: same direction as last trade (waiting for a ${other} signal)`); return; }

    const entry = { name: sig[0], dir, entry: lastPrice, exp: nowS + Math.max(5, +$('ce').value), real: false };
    const mx = +$('cm').value;                                 // 0 = unlimited
    if (!$('ca').checked) log('Auto trade is OFF - signal only');
    else if (mx > 0 && trades >= mx) log('Max trades reached - signal only');
    else {
      const labels = dir === 'up' ? UP : DOWN;
      const btn = findBtn(labels);
      if (btn) { const what = press(btn); trades++; saveStats(); delays.push(late); entry.real = true; log(`Trade opened: ${what} (${info})`); }
      else {
        log('Trade button not found - retrying');
        let tries = 0;
        const t = setInterval(() => {
          const b2 = dead ? null : findBtn(labels);
          if (b2) { clearInterval(t); const what = press(b2); trades++; saveStats(); delays.push(late + 0.2 * (tries + 1)); entry.real = true; log(`Trade opened (retry): ${what}`); }
          else if (dead || ++tries >= 5) { clearInterval(t); if (!dead) log('Trade FAILED: Buy/Sell button never found'); }
        }, 200);
      }
    }
    pending.push(entry);
    lastDir = dir;
    log(`Signal: ${sig[0]} → ${dir.toUpperCase()} (${detail})${entry.real ? ' (traded)' : ''}`);
    render();
  };

  // The signal is checked when a candle closes; this runs on the FIRST price of the new candle.
  const onCandleClose = (live, t) => {
    if (!live) return;                          // history is never traded
    if (candles.length < minC()) return;        // warming up
    const x = getSignal();
    if (x.warm || !x.sig) return;
    const late = t - (cur.slot + 1) * Math.max(5, +$('ct').value);   // how long after the candle opened
    const maxLate = Math.max(0.5, +$('md').value || 3);
    if (late > maxLate) { log(`Skipped ${x.sig[0]}: first price of the new candle came ${late.toFixed(1)}s late (limit ${maxLate}s) - never trades mid-candle`); return; }
    fire(x.sig, x.detail, `next candle open +${Math.max(0, late).toFixed(1)}s`, Math.max(0, late));
  };

  // ---------- Hook existing sockets ----------
  const hooked = new WeakSet(), listeners = [];
  const origSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (...a) {
    if (!dead && !hooked.has(this)) {
      hooked.add(this);
      const fn = e => handle(e.data);
      this.addEventListener('message', fn); listeners.push([this, fn]);
      log('Socket hooked');
    }
    return origSend.apply(this, a);
  };
  window.__cbCleanup = () => {                  // fully stops this copy (used when you paste a newer one)
    dead = true;
    WebSocket.prototype.send = origSend;
    HTMLElement.prototype.click = origClick;
    EventTarget.prototype.dispatchEvent = origDispatch;
    listeners.forEach(([s, fn]) => { try { s.removeEventListener('message', fn); } catch {} });
    clearInterval(timerId);
    document.removeEventListener('visibilitychange', onVis);
    try { wake && wake.release(); } catch {}
    document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
    document.removeEventListener('touchmove', tm); document.removeEventListener('touchend', mu);
  };

  $('cr').onclick = () => {
    candles = []; cur = null; asset = null; ticks = 0; trades = 0; pending = []; done = [];
    rawLeft = 3; startBal = null; lastDir = null; delays.length = 0; store.del(KEY + 'T'); render();
  };
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
  const DESC = {
    st: 'SuperTrend: trades the candle where the trend flips (down to up = UP, up to down = DOWN).',
    rsi: 'RSI: UP when oversold, DOWN when overbought (default period 3, buy at 35, sell at 65).',
    sr: 'Support / Resistance: bounce off, or break of, levels built from swing highs and lows.',
    both: 'S/R + RSI: a support/resistance signal that the RSI zone confirms.',
    bob: 'Bob05: RSI channel crossing from your MQ4 indicator.',
    tr: 'Trend + RSI: RSI pullbacks in the direction of the SuperTrend.',
    hl: 'High/Low + RSI: price takes out the recent high or low while RSI is at an extreme.',
    ema: 'EMA: fast/slow EMA crossover, or price crossing the slow EMA.',
    cp: 'Candle patterns: engulfing, piercing, morning/evening star, hammer and shooting star.',
    tl: 'Trend lines: bounce off, or break of, lines through swing lows (up) and swing highs (down).',
  };
  const showGroups = () => {
    const m = $('sg').value;
    $('sdesc').textContent = DESC[m] || '';
    $('gst').style.display = (m === 'st' || m === 'tr') ? 'grid' : 'none';
    $('grs').style.display = (m === 'rsi' || m === 'both' || m === 'tr' || m === 'hl') ? 'grid' : 'none';
    $('ghl').style.display = m === 'hl' ? 'grid' : 'none';
    $('gem').style.display = m === 'ema' ? 'grid' : 'none';
    $('gcp').style.display = m === 'cp' ? 'grid' : 'none';
    $('gtl').style.display = m === 'tl' ? 'grid' : 'none';
    $('gbb').style.display = m === 'bob' ? 'grid' : 'none';
    $('gsr').style.display = (m === 'sr' || m === 'both') ? 'grid' : 'none';
  };
  const SPEED = { n: [2, 2, 0.3, 60, 15], f: [2, 1, 0.3, 60, 10], x: [1, 1, 0.5, 40, 8] };   // pivot, touches, zone, look-back, warm-up
  const SPEED_IDS = ['qn', 'qt', 'qk', 'qb', 'cw'];
  $('qs').onchange = () => {
    const m = SPEED[$('qs').value]; if (!m) return;
    SPEED_IDS.forEach((id, i) => { $(id).value = m[i]; });
    saveSettings(); log('S/R speed: ' + $('qs').options[$('qs').selectedIndex].text);
  };
  SPEED_IDS.forEach(id => $(id).addEventListener('input', () => { $('qs').value = 'c'; }));   // editing a number = Custom
  $('kw').onchange = () => setWake($('kw').checked);
  if (window.__cbAutoStart) $('ar').checked = true;          // unattended mode: reload automatically if the feed dies
  loadSettings();                                            // restore what you set last time
  { const t = store.get(KEY + 'T'); if (t) { done = t.done || []; trades = t.trades || 0; startBal = t.startBal ?? null; log(`Restored ${done.length} earlier results`); } }
  p.addEventListener('change', saveSettings); p.addEventListener('input', saveSettings);
  if ($('kw').checked) setWake(true);
  $('sg').onchange = () => { showGroups(); lastDir = null; log('Strategy: ' + $('sg').options[$('sg').selectedIndex].text); };
  showGroups();
  $('ct').onchange = () => { candles = []; cur = null; lastDir = null; histUntil = Date.now() + 5000; log('Candle size changed - candles reset'); render(); };
  $('cx').onclick = () => { window.__cbUserClosed = true; window.__cbCleanup(); p.remove(); };   // closed by you: auto-start will not bring it back until a reload
  render(); log('Loaded. Waiting for socket activity…');
})();
