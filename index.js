/*
 * QUOTEX AI Signal Bot (DEMO ONLY) - paste into the browser console.
 * - Captures your chart via the browser's screen-share API (no page selectors needed)
 * - Sends downscaled JPEG frames to Gemini vision
 * - Confirms trend + support/resistance + Parabolic SAR locally, otherwise WAIT
 * - Stats are based on results YOU confirm (win/loss), never guessed
 * No profit is guaranteed. Binary options carry a high risk of loss.
 */
(() => {
  'use strict';
  const HOST_ID = 'qx-ai-signal-panel';
  document.getElementById(HOST_ID)?.remove();

  /* ===================== CONFIG ===================== */
  const CFG = {
    model: 'gemini-2.5-flash',      // fast vision model
    thinkingOff: true,              // set false if you switch to a "pro" model
    proxyUrl: '',                   // e.g. 'http://localhost:8787' (recommended; see server.js)
    proxyToken: '',                 // optional, must match PROXY_TOKEN on the proxy
    expirySec: 60,                  // trade duration you use
    analyzeEveryMs: 15000,          // auto-analyze cadence
    minIntervalMs: 8000,            // hard floor between API calls
    maxSignalAgeMs: 25000,          // signals older than this are STALE and unusable
    minConfidence: 65,              // below this -> WAIT
    maxImageWidth: 960,             // downscale for speed/cost
    jpegQuality: 0.7,
    requestTimeoutMs: 20000,
    frozenFrameLimit: 3,            // identical frames in a row -> "chart frozen" warning
    stake: 1,
    payoutPct: 80,
    maxConsecLossesStop: 3,         // auto-stop after N losses in a row
    requireManualConfirm: true,
    // Optional click automation. Leave null = signals only (you click manually).
    // Only fill these with selectors YOU verified on your page. A "demo" indicator is mandatory.
    selectors: { call: null, put: null, demoBadge: null },
  };

  /* ===================== STATE ===================== */
  const S = {
    running: false, auto: false, demoAuto: false,
    stream: null, video: null, region: null,
    busy: false, abort: null, timer: null,
    lastHash: null, frozen: 0, lastCallAt: 0, backoffUntil: 0, fails: 0,
    key: sessionStorage.getItem('qx_ai_k') || '',
    last: null, pending: null, offer: null,
    usedBuckets: new Set(), usedIds: new Set(),
  };
  const STATS_KEY = 'qx_ai_stats_v1';
  let stats = { trades: 0, wins: 0, losses: 0, consec: 0, pnl: 0 };
  try { stats = { ...stats, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') }; } catch {}
  const saveStats = () => { try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {} };

  /* ===================== HELPERS ===================== */
  const h = (t, p = {}, ...c) => {
    const e = document.createElement(t);
    for (const [k, v] of Object.entries(p)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const x of c.flat()) e.append(x);
    return e;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const bucketOf = t => Math.floor(t / (CFG.expirySec * 1000));
  class ApiError extends Error { constructor(kind, msg, retryMs = 0) { super(msg); this.kind = kind; this.retryMs = retryMs; } }

  /* ===================== UI ===================== */
  const host = h('div', { id: HOST_ID, style: 'position:fixed;inset:0;z-index:2147483647;pointer-events:none' });
  const root = host.attachShadow({ mode: 'closed' }); // closed: page scripts can't reach the key input
  const css = `
  *{box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif}
  .panel{position:fixed;width:330px;max-height:92vh;overflow:auto;background:#12151c;color:#e6e9ef;border:1px solid #2a3040;border-radius:12px;box-shadow:0 10px 40px #000a;pointer-events:auto;font-size:12px}
  .head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#1a1f2b;cursor:move;border-radius:12px 12px 0 0;user-select:none;touch-action:none}
  .head b{font-size:13px}.body{padding:10px;display:flex;flex-direction:column;gap:8px}.min .body{display:none}
  .row{display:flex;gap:6px;align-items:center}.row>*{flex:1}
  input,select{background:#0c0f14;color:#e6e9ef;border:1px solid #2a3040;border-radius:6px;padding:6px;min-width:0;width:100%}
  button{background:#232a3a;color:#e6e9ef;border:1px solid #333c52;border-radius:6px;padding:6px 8px;cursor:pointer;font-size:12px}
  button:hover{background:#2c3550}button:disabled{opacity:.4;cursor:not-allowed}
  button.on{background:#1f6f43;border-color:#2a9d5f}button.stop{background:#7a2530;border-color:#b23a48}
  .sig{text-align:center;padding:10px;border-radius:10px;background:#0c0f14;border:1px solid #2a3040}
  .sig .big{font-size:26px;font-weight:800;letter-spacing:1px}
  .CALL{color:#2ecc71}.PUT{color:#ff5c6c}.WAIT{color:#f0b429}.STALE{color:#7b8499}
  .muted{color:#8a93a8}.reason{margin-top:4px;line-height:1.35}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px}
  .kv{display:flex;justify-content:space-between;gap:6px;padding:3px 0;border-bottom:1px solid #1d2230}
  .kv span:last-child{font-weight:600;text-align:right}
  .status{padding:6px;border-radius:6px;background:#0c0f14;color:#aab2c5;min-height:28px}
  .warn{background:#3a2c0b;color:#ffd27a;padding:6px;border-radius:6px}
  .ov{position:fixed;inset:0;background:#0006;cursor:crosshair;pointer-events:auto}
  .ov .box{position:fixed;border:2px dashed #4da3ff;background:#4da3ff22}
  .ovhint{position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#12151c;color:#fff;padding:6px 10px;border-radius:6px}
  .tiny{font-size:10px}`;
  try { const sh = new CSSStyleSheet(); sh.replaceSync(css); root.adoptedStyleSheets = [sh]; }
  catch { const st = document.createElement('style'); st.textContent = css; root.append(st); }

  const E = {}; // element refs
  const kv = (label, key) => { E[key] = h('span', {}, '—'); return h('div', { class: 'kv' }, h('span', { class: 'muted' }, label), E[key]); };

  E.key = h('input', { type: 'password', placeholder: S.key ? 'Key saved (session) ••••' + S.key.slice(-4) : 'Paste Gemini API key', autocomplete: 'off', spellcheck: 'false' });
  E.show = h('button', { onclick: () => { const p = E.key.type === 'password'; E.key.type = p ? 'text' : 'password'; E.show.textContent = p ? 'Hide' : 'Show'; } }, 'Show');
  E.saveKey = h('button', { onclick: () => {
    const v = E.key.value.trim();
    S.key = v; v ? sessionStorage.setItem('qx_ai_k', v) : sessionStorage.removeItem('qx_ai_k');
    E.key.value = ''; E.key.type = 'password'; E.show.textContent = 'Show';
    E.key.placeholder = v ? 'Key saved (session) ••••' + v.slice(-4) : 'Paste Gemini API key';
    status(v ? 'Key saved for this tab session only.' : 'Key cleared.');
  } }, 'Save');

  E.pick = h('button', { onclick: () => pickSource() }, '1 · Pick chart tab');
  E.region = h('button', { onclick: pickRegion }, 'Region');
  E.full = h('button', { onclick: () => { S.region = null; status('Using full frame.'); } }, 'Full');
  E.startBtn = h('button', { onclick: () => (S.running ? stop('Stopped.') : start()) }, 'Start');
  E.autoBtn = h('button', { onclick: () => { S.auto = !S.auto; E.autoBtn.classList.toggle('on', S.auto); S.auto ? schedule() : clearTimeout(S.timer); } }, 'Auto Analyze');
  E.demoBtn = h('button', { onclick: toggleDemo }, 'Demo Auto Trade');
  E.nowBtn = h('button', { onclick: () => analyzeOnce(true) }, 'Analyze now');

  E.sigWord = h('div', { class: 'big WAIT' }, '—');
  E.conf = h('div', { class: 'muted' }, 'Confidence —');
  E.reason = h('div', { class: 'reason' }, 'No analysis yet.');
  E.checks = h('div', { class: 'tiny muted' }, '');
  E.logBtn = h('button', { onclick: () => tryLog(S.last, 'manual') }, 'I placed this DEMO trade (log it)');
  E.logBtn.disabled = true;

  E.offer = h('div', { class: 'warn', style: 'display:none' });
  E.pendBox = h('div', { class: 'warn', style: 'display:none' });
  E.status = h('div', { class: 'status' }, 'Step 1: pick the Quotex tab (share "This tab").');
  const status = m => { E.status.textContent = m; };

  E.stake = h('input', { type: 'number', min: '0', step: '0.5', value: String(CFG.stake), onchange: e => (CFG.stake = Math.max(0, +e.target.value || 0)) });
  E.payout = h('input', { type: 'number', min: '1', max: '100', value: String(CFG.payoutPct), onchange: e => (CFG.payoutPct = Math.min(100, Math.max(1, +e.target.value || 80))) });
  E.expiry = h('select', { onchange: e => (CFG.expirySec = +e.target.value) },
    ...[30, 60, 120, 300].map(s => h('option', { value: s, ...(s === CFG.expirySec ? { selected: '' } : {}) }, s + 's')));

  const panel = h('div', { class: 'panel', style: `left:${Math.max(8, innerWidth - 350)}px;top:60px` },
    h('div', { class: 'head' }, h('b', {}, 'QUOTEX AI Signals · DEMO'),
      h('span', {},
        h('button', { onclick: () => panel.classList.toggle('min') }, '–'), ' ',
        h('button', { onclick: destroy }, '×'))),
    h('div', { class: 'body' },
      h('div', { class: 'row' }, E.key, E.show, E.saveKey),
      h('div', { class: 'tiny muted' }, CFG.proxyUrl ? 'Using backend proxy – key stays on your server.' : 'Direct mode: key kept in memory/session only. Proxy recommended.'),
      h('div', { class: 'row' }, E.pick, E.region, E.full),
      h('div', { class: 'row' }, E.startBtn, E.autoBtn, E.nowBtn),
      h('div', { class: 'row' }, E.demoBtn),
      h('div', { class: 'sig' }, E.sigWord, E.conf, E.reason, E.checks),
      E.logBtn, E.offer, E.pendBox,
      h('div', { class: 'grid' }, kv('Trend', 'vTrend'), kv('SAR', 'vSar'), kv('Support', 'vSup'), kv('Resistance', 'vRes'),
        kv('Zone', 'vZone'), kv('Pattern', 'vPat'), kv('Analyzed', 'vTime'), kv('Latency', 'vLat')),
      h('div', { class: 'muted' }, 'Stats (user-confirmed demo results)'),
      h('div', { class: 'grid' }, kv('Trades', 'sT'), kv('Win rate', 'sWR'), kv('Wins', 'sW'), kv('Losses', 'sL'),
        kv('Consec. losses', 'sC'), kv('Demo P/L', 'sP')),
      h('div', { class: 'row' },
        h('label', { class: 'tiny muted' }, 'Stake', E.stake), h('label', { class: 'tiny muted' }, 'Payout %', E.payout),
        h('label', { class: 'tiny muted' }, 'Expiry', E.expiry)),
      h('div', { class: 'row' }, h('button', { onclick: () => { if (confirm('Reset all stats?')) { stats = { trades: 0, wins: 0, losses: 0, consec: 0, pnl: 0 }; saveStats(); renderStats(); } } }, 'Reset stats')),
      E.status,
      h('div', { class: 'tiny muted' }, 'Not financial advice. No outcome is guaranteed; you can lose your whole stake.')));
  root.append(panel);
  (document.body || document.documentElement).append(host);

  // Drag
  const head = panel.querySelector('.head');
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const mv = ev => {
      panel.style.left = Math.min(Math.max(0, ev.clientX - dx), innerWidth - 60) + 'px';
      panel.style.top = Math.min(Math.max(0, ev.clientY - dy), innerHeight - 40) + 'px';
    };
    const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); };
    head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
  });

  /* ===================== CAPTURE ===================== */
  async function pickSource() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 5, max: 10 } }, audio: false, preferCurrentTab: true,
      });
      S.stream?.getTracks().forEach(t => t.stop());
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.srcObject = stream;
      await v.play();
      stream.getVideoTracks()[0].addEventListener('ended', () => { S.video = null; S.stream = null; stop('Screen share ended. Pick the chart tab again.'); });
      S.stream = stream; S.video = v; S.lastHash = null; S.frozen = 0;
      status('Chart source ready. Optionally set a Region, then press Start.');
      return true;
    } catch (e) { status('Capture cancelled or blocked: ' + (e.message || e.name)); return false; }
  }

  function pickRegion() {
    const ov = h('div', { class: 'ov' }), box = h('div', { class: 'box' });
    ov.append(box, h('div', { class: 'ovhint' }, 'Drag over the chart area (Esc to cancel)'));
    root.append(ov); panel.style.visibility = 'hidden';
    let sx, sy, drag = false;
    const done = () => { ov.remove(); panel.style.visibility = 'visible'; removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') done(); };
    addEventListener('keydown', esc, true);
    ov.addEventListener('pointerdown', e => { drag = true; sx = e.clientX; sy = e.clientY; ov.setPointerCapture(e.pointerId); });
    ov.addEventListener('pointermove', e => {
      if (!drag) return;
      Object.assign(box.style, { left: Math.min(sx, e.clientX) + 'px', top: Math.min(sy, e.clientY) + 'px',
        width: Math.abs(e.clientX - sx) + 'px', height: Math.abs(e.clientY - sy) + 'px' });
    });
    ov.addEventListener('pointerup', e => {
      drag = false;
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY), w = Math.abs(e.clientX - sx), hh = Math.abs(e.clientY - sy);
      if (w > 80 && hh > 80) { S.region = { x: x / innerWidth, y: y / innerHeight, w: w / innerWidth, h: hh / innerHeight }; status('Region saved.'); }
      done();
    });
  }

  const cv = document.createElement('canvas'), cvx = cv.getContext('2d');
  const hv = document.createElement('canvas'); hv.width = hv.height = 32;
  const hx = hv.getContext('2d', { willReadFrequently: true });

  function overlapsPanel() {
    if (!S.region) return true;
    const r = panel.getBoundingClientRect(), g = S.region;
    const rx = g.x * innerWidth, ry = g.y * innerHeight, rw = g.w * innerWidth, rh = g.h * innerHeight;
    return !(r.right < rx || r.left > rx + rw || r.bottom < ry || r.top > ry + rh);
  }

  async function grabFrame() {
    const v = S.video;
    if (!v || !v.videoWidth) throw new Error('No capture source. Pick the chart tab first.');
    const hide = overlapsPanel();
    if (hide) { panel.style.visibility = 'hidden'; await raf2(); await sleep(60); }
    const capturedAt = Date.now();
    try {
      let sx = 0, sy = 0, sw = v.videoWidth, sh = v.videoHeight;
      if (S.region) { sx = S.region.x * sw; sy = S.region.y * sh; sw = S.region.w * sw; sh = S.region.h * sh; }
      const sc = Math.min(1, CFG.maxImageWidth / sw);
      cv.width = Math.round(sw * sc); cv.height = Math.round(sh * sc);
      cvx.drawImage(v, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    } finally { if (hide) panel.style.visibility = 'visible'; }

    // cheap 32x32 luminance fingerprint to detect unchanged/frozen frames
    hx.drawImage(cv, 0, 0, 32, 32);
    const d = hx.getImageData(0, 0, 32, 32).data, hash = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) hash[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0;
    let diff = 1e9;
    if (S.lastHash) { diff = 0; for (let i = 0; i < 1024; i++) diff += Math.abs(hash[i] - S.lastHash[i]); diff /= 1024; }
    const unchanged = diff < 0.3;
    S.lastHash = hash;
    S.frozen = unchanged ? S.frozen + 1 : 0;
    return { capturedAt, unchanged, b64: unchanged ? null : cv.toDataURL('image/jpeg', CFG.jpegQuality).split(',')[1] };
  }

  /* ===================== GEMINI ===================== */
  const SYS = 'You read ONE screenshot of a candlestick chart. Report only what is visible. Use null for any price level you cannot read. ' +
    'Be conservative: if the chart is unclear or indicators conflict, answer WAIT. Output JSON only. This is not financial advice and no outcome is guaranteed.';
  const prompt = () => `Analyze this chart for a ${CFG.expirySec}-second binary trade.
1) trend of the last ~10-20 candles (UP/DOWN/SIDEWAYS)
2) nearest support and resistance (prices if readable)
3) zone: NEAR_SUPPORT, NEAR_RESISTANCE or BETWEEN
4) most recent candlestick pattern
5) Parabolic SAR: BULLISH if dots are below candles, BEARISH if above, UNKNOWN if no SAR visible
6) signal: CALL only if trend UP + SAR BULLISH + not near resistance; PUT only if trend DOWN + SAR BEARISH + not near support; otherwise WAIT.
confidence 0-100. reason max 20 words.`;
  const SCHEMA = {
    type: 'OBJECT',
    properties: {
      chartReadable: { type: 'BOOLEAN' },
      trend: { type: 'STRING', enum: ['UP', 'DOWN', 'SIDEWAYS'] },
      support: { type: 'NUMBER', nullable: true },
      resistance: { type: 'NUMBER', nullable: true },
      zone: { type: 'STRING', enum: ['NEAR_SUPPORT', 'NEAR_RESISTANCE', 'BETWEEN'] },
      pattern: { type: 'STRING' },
      sar: { type: 'STRING', enum: ['BULLISH', 'BEARISH', 'UNKNOWN'] },
      signal: { type: 'STRING', enum: ['CALL', 'PUT', 'WAIT'] },
      confidence: { type: 'INTEGER' },
      reason: { type: 'STRING' },
    },
    required: ['chartReadable', 'trend', 'zone', 'pattern', 'sar', 'signal', 'confidence', 'reason'],
  };

  async function callGemini(b64) {
    const body = {
      systemInstruction: { parts: [{ text: SYS }] },
      contents: [{ role: 'user', parts: [{ text: prompt() }, { inlineData: { mimeType: 'image/jpeg', data: b64 } }] }],
      generationConfig: {
        temperature: 0.1, maxOutputTokens: 400, responseMimeType: 'application/json', responseSchema: SCHEMA,
        ...(CFG.thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    };
    const ctrl = new AbortController(); S.abort = ctrl;
    let timedOut = false;
    const to = setTimeout(() => { timedOut = true; ctrl.abort(); }, CFG.requestTimeoutMs);
    let res;
    try {
      res = CFG.proxyUrl
        ? await fetch(CFG.proxyUrl.replace(/\/$/, '') + '/analyze', {
            method: 'POST', signal: ctrl.signal,
            headers: { 'Content-Type': 'application/json', ...(CFG.proxyToken ? { 'x-proxy-token': CFG.proxyToken } : {}) },
            body: JSON.stringify({ model: CFG.model, body }),
          })
        : await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(CFG.model)}:generateContent`, {
            method: 'POST', signal: ctrl.signal,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.key },
            body: JSON.stringify(body),
          });
    } catch (e) {
      if (e.name === 'AbortError') throw new ApiError(timedOut ? 'timeout' : 'aborted', timedOut ? 'Gemini request timed out' : 'Cancelled');
      throw new ApiError('network', 'Network/CORS/CSP error reaching ' + (CFG.proxyUrl ? 'proxy' : 'Gemini'));
    } finally { clearTimeout(to); S.abort = null; }

    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const msg = data?.error?.message || res.statusText || 'HTTP ' + res.status;
      if (res.status === 429) {
        let ms = (+res.headers.get('retry-after') || 0) * 1000;
        const ri = data?.error?.details?.find(d => String(d['@type'] || '').includes('RetryInfo'))?.retryDelay;
        if (ri) ms = Math.max(ms, parseFloat(ri) * 1000);
        throw new ApiError('rate', 'Rate limited', Math.max(ms, 10000) * (1 + Math.min(S.fails, 3) * 0.5));
      }
      if (res.status === 400 && /API key/i.test(msg)) throw new ApiError('auth', 'API key invalid');
      if (res.status === 401 || res.status === 403) throw new ApiError('auth', 'Key/permission rejected (' + res.status + ')');
      if (res.status >= 500) throw new ApiError('server', 'Gemini server error ' + res.status);
      throw new ApiError('bad', msg.slice(0, 160));
    }
    if (data?.promptFeedback?.blockReason) throw new ApiError('bad', 'Blocked: ' + data.promptFeedback.blockReason);
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch { throw new ApiError('bad', 'Unparseable model output'); }
  }

  /* ===================== CONFIRMATION LOGIC ===================== */
  function verify(r) {
    const conf = Math.max(0, Math.min(100, Math.round(+r.confidence || 0)));
    const out = { ...r, confidence: conf, final: 'WAIT', checks: [], why: r.reason || '' };
    if (!r.chartReadable) { out.why = 'Chart not readable.'; return out; }
    if (r.signal === 'WAIT') return out;
    const up = r.signal === 'CALL';
    const trendOk = up ? r.trend === 'UP' : r.trend === 'DOWN';
    const sarOk = up ? r.sar === 'BULLISH' : r.sar === 'BEARISH';
    const srOk = up ? r.zone !== 'NEAR_RESISTANCE' : r.zone !== 'NEAR_SUPPORT';
    const confOk = conf >= CFG.minConfidence;
    out.checks = [['Trend', trendOk], ['S/R', srOk], ['SAR', sarOk], ['Conf', confOk]];
    if (trendOk && sarOk && srOk && confOk) out.final = r.signal;
    else {
      const bad = out.checks.filter(c => !c[1]).map(c => c[0]).join(', ');
      out.why = `Conflict/weak (${bad}). ${r.reason || ''}`.trim();
    }
    return out;
  }

  /* ===================== ANALYSIS LOOP ===================== */
  async function analyzeOnce(force = false) {
    if (S.busy) return;
    const now = Date.now();
    if (now < S.backoffUntil) return status(`Cooling down ${Math.ceil((S.backoffUntil - now) / 1000)}s (rate limit/error).`);
    if (now - S.lastCallAt < CFG.minIntervalMs) return status('Throttled: too soon after last call.');
    if (!S.video) return status('Pick the chart tab first.');
    if (!CFG.proxyUrl && !S.key) return status('Paste and Save your Gemini API key first.');
    S.busy = true;
    const t0 = performance.now();
    try {
      const f = await grabFrame();
      if (f.unchanged && !force) {
        status(S.frozen >= CFG.frozenFrameLimit ? '⚠ Chart looks frozen/not updating. Signals withheld.' : 'Chart unchanged — skipped (saves quota).');
        return;
      }
      if (f.unchanged && force && S.frozen >= CFG.frozenFrameLimit) { status('⚠ Chart looks frozen. Not analyzing.'); return; }
      const b64 = f.b64 || cv.toDataURL('image/jpeg', CFG.jpegQuality).split(',')[1];
      S.lastCallAt = Date.now();
      status('Analyzing…');
      const raw = await callGemini(b64);
      if (!S.running && !force) return;
      const age = Date.now() - f.capturedAt;
      if (age > CFG.maxSignalAgeMs) { status(`Discarded stale result (${Math.round(age / 1000)}s old).`); return; }
      const v = verify(raw);
      v.capturedAt = f.capturedAt; v.id = f.capturedAt + ':' + v.final; v.ms = Math.round(performance.now() - t0);
      v.at = new Date().toLocaleTimeString();
      S.last = v; S.fails = 0;
      render(); status(`Done in ${v.ms} ms.`);
      if (S.demoAuto && v.final !== 'WAIT') offerTrade(v);
    } catch (e) { handleError(e); }
    finally { S.busy = false; }
  }

  function handleError(e) {
    if (e.kind === 'aborted') return;
    if (!(e instanceof ApiError)) return status('Error: ' + (e.message || e));
    if (e.kind === 'rate') { S.backoffUntil = Date.now() + e.retryMs; S.fails++; status(`Rate limited — waiting ${Math.ceil(e.retryMs / 1000)}s.`); }
    else if (e.kind === 'auth') { stop('API key problem: ' + e.message + '. Fix the key and press Start.'); }
    else if (e.kind === 'server' || e.kind === 'timeout' || e.kind === 'network') {
      S.fails++; const ms = Math.min(60000, 2000 * 2 ** S.fails); S.backoffUntil = Date.now() + ms;
      status(`${e.message}. Retrying after ${Math.ceil(ms / 1000)}s.`);
    } else status('API error: ' + e.message);
  }

  function schedule() {
    clearTimeout(S.timer);
    if (!S.running || !S.auto) return;
    const wait = Math.max(CFG.analyzeEveryMs, S.backoffUntil - Date.now());
    S.timer = setTimeout(async () => { await analyzeOnce(); schedule(); }, wait);
  }

  async function start() {
    if (!S.video && !(await pickSource())) return;
    S.running = true; E.startBtn.textContent = 'Stop'; E.startBtn.classList.add('stop');
    await analyzeOnce(true); schedule();
  }
  function stop(msg) {
    S.running = false; clearTimeout(S.timer); S.abort?.abort();
    E.startBtn.textContent = 'Start'; E.startBtn.classList.remove('stop');
    if (msg) status(msg);
  }
  function destroy() { stop(); S.stream?.getTracks().forEach(t => t.stop()); clearInterval(tickId); host.remove(); }

  /* ===================== TRADES & STATS ===================== */
  function canTrade(sig) {
    if (!sig || sig.final === 'WAIT') return 'No actionable signal.';
    if (Date.now() - sig.capturedAt > CFG.maxSignalAgeMs) return 'Signal is stale.';
    if (S.pending) return 'A trade is still open/unresolved.';
    if (S.usedIds.has(sig.id)) return 'Duplicate signal already used.';
    if (S.usedBuckets.has(bucketOf(Date.now()))) return 'Already traded in this candle window.';
    if (stats.consec >= CFG.maxConsecLossesStop) return `Paused after ${stats.consec} straight losses (reset stats to resume).`;
    return null;
  }

  function toggleDemo() {
    S.demoAuto = !S.demoAuto; E.demoBtn.classList.toggle('on', S.demoAuto);
    const s = CFG.selectors;
    status(S.demoAuto
      ? (s.call && s.put && s.demoBadge ? 'Demo auto-trade ON (click automation with demo check).' : 'Demo mode ON: no click selectors configured → signals + confirm & log only; you click manually.')
      : 'Demo auto-trade OFF.');
    if (!S.demoAuto) clearOffer();
  }

  function offerTrade(sig) {
    const why = canTrade(sig); if (why) return status(why);
    if (!CFG.requireManualConfirm && CFG.selectors.call && CFG.selectors.put && CFG.selectors.demoBadge) return tryLog(sig, 'auto');
    S.offer = sig; E.offer.style.display = 'block'; E.offer.replaceChildren(
      `${sig.final} (${sig.confidence}%) — confirm DEMO trade? `,
      h('button', { onclick: () => { clearOffer(); tryLog(sig, 'auto'); } }, 'Confirm'), ' ',
      h('button', { onclick: clearOffer }, 'Skip'));
  }
  const clearOffer = () => { S.offer = null; E.offer.style.display = 'none'; };

  function execClick(dir) {
    const s = CFG.selectors; const sel = dir === 'CALL' ? s.call : s.put;
    if (!sel || !s.demoBadge) return false;
    const badge = document.querySelector(s.demoBadge);
    if (!badge || !/demo/i.test(badge.textContent || '')) throw new Error('Demo account not confirmed on page — click aborted.');
    const btn = document.querySelector(sel);
    if (!btn) throw new Error('Trade button selector not found — click aborted.');
    btn.click(); return true;
  }

  function tryLog(sig, mode) {
    const why = canTrade(sig); if (why) return status(why);
    try {
      let clicked = false;
      if (mode === 'auto') clicked = execClick(sig.final);
      const t = Date.now();
      S.usedIds.add(sig.id); S.usedBuckets.add(bucketOf(t));
      S.pending = { dir: sig.final, openedAt: t, expiresAt: t + CFG.expirySec * 1000, stake: CFG.stake, payout: CFG.payoutPct };
      status(clicked ? `${sig.final} demo trade clicked and logged.` : `Logged ${sig.final}. Place it manually on the DEMO account now.`);
      renderPending();
    } catch (e) { status(e.message); }
  }

  function resolve(result) {
    const p = S.pending; if (!p) return;
    if (result !== 'void') {
      stats.trades++;
      if (result === 'win') { stats.wins++; stats.consec = 0; stats.pnl += p.stake * p.payout / 100; }
      else { stats.losses++; stats.consec++; stats.pnl -= p.stake; }
      saveStats();
    }
    S.pending = null; renderPending(); renderStats();
    if (stats.consec >= CFG.maxConsecLossesStop) { S.auto = false; E.autoBtn.classList.remove('on'); S.demoAuto = false; E.demoBtn.classList.remove('on'); clearTimeout(S.timer); status(`Auto features paused: ${stats.consec} losses in a row.`); }
  }

  /* ===================== RENDER ===================== */
  const fmt = n => (n == null || n === '' ? '—' : String(n));
  function render() {
    const v = S.last; if (!v) return;
    E.vTrend.textContent = v.trend; E.vSar.textContent = v.sar === 'BULLISH' ? 'Bullish (below)' : v.sar === 'BEARISH' ? 'Bearish (above)' : 'Unknown';
    E.vSup.textContent = fmt(v.support); E.vRes.textContent = fmt(v.resistance);
    E.vZone.textContent = v.zone.replace('_', ' '); E.vPat.textContent = v.pattern || '—';
    E.vTime.textContent = v.at; E.vLat.textContent = v.ms + ' ms';
    E.reason.textContent = v.why;
    E.checks.textContent = v.checks.map(c => (c[1] ? '✓ ' : '✗ ') + c[0]).join('   ');
    tick();
  }
  function renderStats() {
    const d = stats.wins + stats.losses;
    E.sT.textContent = stats.trades; E.sW.textContent = stats.wins; E.sL.textContent = stats.losses;
    E.sWR.textContent = d ? (stats.wins / d * 100).toFixed(1) + '%' : '—';
    E.sC.textContent = stats.consec; E.sP.textContent = (stats.pnl >= 0 ? '+' : '') + stats.pnl.toFixed(2);
    E.sP.style.color = stats.pnl >= 0 ? '#2ecc71' : '#ff5c6c';
  }
  function renderPending() {
    const p = S.pending;
    if (!p) { E.pendBox.style.display = 'none'; return; }
    E.pendBox.style.display = 'block';
    const left = Math.ceil((p.expiresAt - Date.now()) / 1000);
    if (left > 0) { E.pendBox.replaceChildren(`${p.dir} open — result in ${left}s`); return; }
    E.pendBox.replaceChildren(`${p.dir} expired. Result from your demo account? `,
      h('button', { onclick: () => resolve('win') }, 'Win'), ' ',
      h('button', { onclick: () => resolve('loss') }, 'Loss'), ' ',
      h('button', { onclick: () => resolve('void') }, 'Void'));
  }
  function tick() {
    const v = S.last;
    if (v) {
      const age = Date.now() - v.capturedAt, stale = age > CFG.maxSignalAgeMs;
      E.sigWord.textContent = stale ? 'STALE' : v.final;
      E.sigWord.className = 'big ' + (stale ? 'STALE' : v.final);
      E.conf.textContent = `Confidence ${v.confidence}% · ${Math.round(age / 1000)}s old`;
      E.logBtn.disabled = !!canTrade(v);
    }
    // refresh pending countdown only when structure needs it
    if (S.pending) { const left = S.pending.expiresAt - Date.now(); if (left > 0 || !E.pendBox.querySelector('button')) renderPending(); }
  }
  const tickId = setInterval(tick, 500);
  renderStats();
  console.log('%cQUOTEX AI Signal Bot loaded (DEMO only).', 'color:#2ecc71;font-weight:bold');
})();
