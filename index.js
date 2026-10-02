/**
 * ============================================================
 *  SMC QUOTEX AUTO BOT v2.6 — browser console script
 *  Paste the entire file into DevTools Console (F12) on the
 *  QUOTEX trading platform page, then press Enter.
 *
 *  WHAT'S NEW IN v2.6 — SOCKET.IO PROTOCOL FIX + OWN DIRECT SOCKET
 *   - FIX (root cause of "NO PRICE DATA"): QUOTEX speaks Socket.IO EIO=3.
 *     Frames arrive as 42["event",data] and 451-["event",placeholder]+binary.
 *     The old parser gate ("payload must start with { or [") REJECTED
 *     every Socket.IO frame. v2.6 unwraps the prefixes before parsing.
 *   - NEW Source 5: the bot opens its OWN WebSocket to the QUOTEX trade
 *     server (wss://ws2.qxbroker.com), authorizes with the page session
 *     token (window.settings.token) and subscribes to the asset itself.
 *     This works even when the page's socket lives in a Worker/closure.
 *   - NEW Source 6: Web Worker tap — injects a capture shim into
 *     same-origin workers so sockets living inside workers are captured.
 *   - Panel: new "Asset" field for the direct socket (auto-detected
 *     from the page by default).
 *   - __QX999_FEED_REPORT__() console command: full one-shot
 *     diagnosis of every data channel + protocol shape samples
 *   - Candle-endpoint self-poll: re-fetches the platform's own
 *     candle history HTTP endpoint if the live feed dies
 *
 *  WHAT'S NEW vs v1
 *   - Real signal engine: RSI + EMA trend + Bollinger Bands +
 *     candle-pattern confluence voting (trade only when N votes agree)
 *   - Live price feed: DOM price watcher + WebSocket tick hook
 *   - Instant execution on fresh signals (configurable entry delay)
 *   - Money management: Fixed / Martingale / % of balance
 *   - Stop-Loss auto stop + live win-rate dashboard
 *   - AUTO mode (trade every valid signal) and SEMI mode
 *     (tap to arm, next valid signal fires one trade)
 *
 *  CONTROLS (same as v1)
 *   - 1 tap  : start / stop (AUTO) or arm / disarm (SEMI)
 *   - 3 taps : settings panel
 *   - Drag   : move the widget
 *
 *  CONSOLE COMMANDS
 *   window.__QX999_STOP__()    remove the bot
 *   window.__QX999_DEBUG__     inspect feed / bot / settings
 *
 *  RISK WARNING
 *   No bot can guarantee wins. Binary options carry extreme risk.
 *   Always test on a DEMO account first. Use at your own risk.
 * ============================================================
 */
(function () {
  if (window.__QX999_ACTIVE__) {
    console.warn("SMC already running.");
    return;
  }

  /* ==================== PASSWORD CONFIG ==================== */

  const QX999_PASSWORD = "Jokar99T";
  const PW_STORAGE_KEY = "qx999_saved_password";

  function getSavedPassword() {
    try {
      return (
        localStorage.getItem(PW_STORAGE_KEY) ||
        sessionStorage.getItem(PW_STORAGE_KEY) ||
        ""
      );
    } catch {
      return "";
    }
  }

  function rememberPassword(pw) {
    try {
      localStorage.setItem(PW_STORAGE_KEY, pw);
    } catch {
      try {
        sessionStorage.setItem(PW_STORAGE_KEY, pw);
      } catch {
        /* ignore */
      }
    }
  }

  function showPasswordGate(onSuccess) {
    const loginStyle = document.createElement("style");
    loginStyle.id = "qx999-login-style";
    loginStyle.textContent = `
      #qx999-login-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.72);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      #qx999-login-box {
        width: min(320px, calc(100vw - 32px));
        padding: 22px 20px 18px;
        border-radius: 14px;
        background: linear-gradient(160deg, #0d1f14 0%, #0a0f0c 100%);
        border: 1px solid rgba(0, 255, 102, 0.4);
        box-shadow: 0 0 40px rgba(0,255,102,0.25), 0 12px 40px rgba(0,0,0,0.55);
        color: #e8ffe8;
      }
      #qx999-login-box h3 {
        margin: 0 0 6px;
        text-align: center;
        color: #00ff66;
        letter-spacing: 0.06em;
        font-size: 18px;
      }
      #qx999-login-box p {
        margin: 0 0 12px;
        text-align: center;
        font-size: 12px;
        color: #9fd4ad;
      }
      #qx999-login-input {
        box-sizing: border-box;
        width: 100%;
        padding: 11px 12px;
        border-radius: 8px;
        border: 1px solid rgba(0,255,102,0.3);
        background: rgba(0,0,0,0.35);
        color: #fff;
        font-size: 15px;
        outline: none;
      }
      #qx999-login-input:focus {
        border-color: #00ff66;
        box-shadow: 0 0 0 2px rgba(0,255,102,0.2);
      }
      #qx999-login-btn {
        display: block;
        width: 100%;
        margin-top: 12px;
        padding: 12px 14px;
        border: none;
        border-radius: 8px;
        background: #00ff66;
        color: #052210;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
      }
      #qx999-login-btn:active { background: #00e65c; }
      #qx999-login-err {
        min-height: 18px;
        margin-top: 8px;
        text-align: center;
        font-size: 12px;
        color: #ff6b6b;
        font-weight: 600;
      }
    `;
    document.head.appendChild(loginStyle);

    const overlay = document.createElement("div");
    overlay.id = "qx999-login-overlay";
    overlay.innerHTML = `
      <div id="qx999-login-box">
        <h3>SMC Login</h3>
        <p>Enter password to continue</p>
        <input id="qx999-login-input" type="password" autocomplete="current-password" />
        <button type="button" id="qx999-login-btn">Enter</button>
        <p id="qx999-login-err"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("#qx999-login-input");
    const errEl = overlay.querySelector("#qx999-login-err");
    const btn = overlay.querySelector("#qx999-login-btn");

    input.value = getSavedPassword();

    function tryLogin() {
      const pw = input.value;
      if (pw === QX999_PASSWORD) {
        rememberPassword(pw);
        overlay.remove();
        loginStyle.remove();
        onSuccess();
        return;
      }
      errEl.textContent = "Wrong password";
      input.focus();
      input.select();
    }

    btn.addEventListener("click", tryLogin);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tryLogin();
      }
    });

    setTimeout(() => input.focus(), 50);
    if (input.value) {
      setTimeout(() => input.select(), 60);
    }
  }

  function initQX999() {
    window.__QX999_ACTIVE__ = true;

    /* ==================== CONSTANTS & SETTINGS ==================== */

    const LOGO_URL =
      (window.__SMC_ASSET_BASE__ ||
        "https://legendary-douhua-a9f877.netlify.app") + "/new%20logo.png";
    const LABEL = "SMC";
    const STORAGE_KEY = "qx999_settings_v4"; // v4: trend mode default
    const TAP_REQUIRED = 3;
    const TAP_SETTLE_MS = 380;
    const TAP_SEQUENCE_MS = 650;

    const defaults = {
      mode: "auto",            // "auto" | "semi"
      direction: "trend",      // "trend" | "signal" | "up" | "down" | "random"
      minVotes: 2,             // confluence votes required (2-4)
      candleSec: 5,            // synthetic candle interval (5/15/30/60) - 5s = fastest first trade
      signalExpirySec: 6,      // signal older than this is not traded
      expirySec: 60,           // trade expiry time set on the platform
      entryDelaySec: 0.3,      // delay between signal and click
      cooldownSec: 2,          // min gap between trades
      stakeMode: "fixed",      // "fixed" | "martingale" | "percent"
      baseAmount: 1,
      martMultiplier: 2,
      martMaxSteps: 3,
      percentOfBalance: 2,
      stopLoss: 0,             // session loss that stops the bot (0 = off)
      asset: "EURUSD_otc",     // asset the direct socket subscribes to
    };

    function clampNum(v, def, min, max, round) {
      const n = Number(v);
      if (!Number.isFinite(n)) return def;
      const c = Math.max(min, Math.min(max, n));
      return round ? Math.round(c) : c;
    }

    function parseStored(raw) {
      if (!raw) return null;
      const s = JSON.parse(raw);
      return {
        mode: s.mode === "semi" ? "semi" : defaults.mode,
        direction: ["trend", "signal", "up", "down", "random"].includes(s.direction)
          ? s.direction
          : defaults.direction,
        minVotes: clampNum(s.minVotes, defaults.minVotes, 2, 4, true),
        candleSec: [5, 15, 30, 60].includes(Number(s.candleSec))
          ? Number(s.candleSec)
          : defaults.candleSec,
        signalExpirySec: clampNum(s.signalExpirySec, defaults.signalExpirySec, 1, 30, true),
        expirySec: clampNum(s.expirySec, defaults.expirySec, 5, 3600, true),
        entryDelaySec: clampNum(s.entryDelaySec, defaults.entryDelaySec, 0, 10, false),
        cooldownSec: clampNum(s.cooldownSec, defaults.cooldownSec, 0, 120, true),
        stakeMode: ["fixed", "martingale", "percent"].includes(s.stakeMode)
          ? s.stakeMode
          : defaults.stakeMode,
        baseAmount: clampNum(s.baseAmount, defaults.baseAmount, 0.1, 100000, false),
        martMultiplier: clampNum(s.martMultiplier, defaults.martMultiplier, 1.1, 5, false),
        martMaxSteps: clampNum(s.martMaxSteps, defaults.martMaxSteps, 1, 10, true),
        percentOfBalance: clampNum(s.percentOfBalance, defaults.percentOfBalance, 0.1, 50, false),
        stopLoss: clampNum(s.stopLoss, defaults.stopLoss, 0, 1000000, false),
        asset:
          typeof s.asset === "string" && /^[A-Za-z0-9#_]{3,30}$/.test(s.asset.trim())
            ? s.asset.trim()
            : defaults.asset,
      };
    }

    function loadSettings() {
      const sources = [
        () => localStorage.getItem(STORAGE_KEY),
        () => sessionStorage.getItem(STORAGE_KEY),
        () => {
          const b = window.__QX999_SETTINGS_BACKUP__;
          return b ? JSON.stringify(b) : null;
        },
      ];
      for (const get of sources) {
        try {
          const parsed = parseStored(get());
          if (parsed) return parsed;
        } catch {
          /* try next */
        }
      }
      return { ...defaults };
    }

    function saveSettings(s) {
      const json = JSON.stringify(s);
      window.__QX999_SETTINGS_BACKUP__ = { ...s };
      let ok = false;
      try {
        localStorage.setItem(STORAGE_KEY, json);
        ok = true;
      } catch {
        /* blocked */
      }
      try {
        sessionStorage.setItem(STORAGE_KEY, json);
        ok = true;
      } catch {
        /* blocked */
      }
      return ok;
    }

    let settings = loadSettings();

    /* ==================== STYLES ==================== */

    const style = document.createElement("style");
    style.id = "qx999-style";
    style.textContent = `
    #qx999-widget {
      position: fixed;
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.45));
      transition: filter 0.25s ease;
    }
    #qx999-widget.qx999-glow {
      filter: drop-shadow(0 0 12px #00ff66) drop-shadow(0 0 28px #00ff66)
        drop-shadow(0 0 48px rgba(0,255,102,0.55));
    }
    #qx999-widget:active { cursor: grabbing; }
    #qx999-logo-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      overflow: hidden;
      background: rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    #qx999-logo-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }
    #qx999-label {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #fff;
      text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      pointer-events: none;
      white-space: nowrap;
    }
    #qx999-widget.qx999-glow #qx999-label {
      color: #b8ffd4;
      text-shadow: 0 0 8px #00ff66, 0 0 18px #00ff66, 0 0 32px rgba(0,255,102,0.8);
    }
    #qx999-stats {
      min-width: 168px;
      box-sizing: border-box;
      padding: 8px 10px;
      border-radius: 10px;
      background: linear-gradient(160deg, rgba(13,31,20,0.95) 0%, rgba(10,15,12,0.95) 100%);
      border: 1px solid rgba(0,255,102,0.35);
      box-shadow: 0 0 24px rgba(0,255,102,0.15), 0 6px 20px rgba(0,0,0,0.5);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #e8ffe8;
      pointer-events: none;
      line-height: 1.45;
    }
    #qx999-stats .qx999-st-status {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #9fd4ad;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #qx999-stats .qx999-st-status.qx999-st-live { color: #00ff66; }
    #qx999-stats .qx999-st-status.qx999-st-danger { color: #ff6b6b; }
    #qx999-stats .qx999-st-line {
      font-size: 11px;
      color: #cfeeda;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #qx999-stats .qx999-st-feed {
      font-size: 10px;
      color: #6a9a78;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #qx999-stats .qx999-st-diag {
      font-size: 10px;
      color: #ffd166;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 190px;
    }
    #qx999-stats .qx999-st-diag.qx999-alarm {
      color: #ff6b6b;
      font-weight: 700;
    }
    #qx999-stats .qx999-st-pl-pos { color: #00ff66; font-weight: 700; }
    #qx999-stats .qx999-st-pl-neg { color: #ff6b6b; font-weight: 700; }
    #qx999-scan-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483645;
      pointer-events: none;
      overflow: hidden;
      display: none;
    }
    #qx999-scan-overlay.qx999-scan-on { display: block; }
    #qx999-scan-line {
      position: absolute;
      left: 0;
      width: 100%;
      height: 5px;
      background: linear-gradient(
        180deg,
        #3ad67f 0%,
        #22c464 16%,
        #14ad56 40%,
        #009e4a 58%,
        #008a40 82%,
        rgba(0, 110, 48, 0.55) 100%
      );
      box-shadow:
        0 -88px 130px rgba(0, 220, 115, 1),
        0 -68px 100px rgba(0, 200, 100, 1),
        0 -50px 78px rgba(0, 185, 92, 0.98),
        0 -34px 58px rgba(0, 170, 85, 0.96),
        0 -22px 40px rgba(0, 155, 78, 0.94),
        0 -12px 26px rgba(0, 140, 72, 0.9),
        0 -6px 14px rgba(0, 125, 65, 0.88),
        0 0 28px rgba(0, 150, 75, 0.85),
        0 0 55px rgba(0, 130, 65, 0.55);
      top: -8%;
      animation: qx999-scan-move 1.45s linear infinite;
    }
    @keyframes qx999-scan-move {
      0% { top: -8%; }
      100% { top: 108%; }
    }
    #qx999-panel {
      position: fixed;
      z-index: 2147483647;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      opacity: 0;
      pointer-events: none;
      width: min(340px, calc(100vw - 32px));
      max-height: 84vh;
      overflow-y: auto;
      box-sizing: border-box;
      padding: 18px 16px 14px;
      border-radius: 14px;
      background: linear-gradient(160deg, #0d1f14 0%, #0a0f0c 100%);
      border: 1px solid rgba(0,255,102,0.35);
      box-shadow: 0 0 40px rgba(0,255,102,0.25), 0 12px 40px rgba(0,0,0,0.55);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: #e8ffe8;
    }
    #qx999-panel.qx999-panel-open {
      opacity: 1;
      pointer-events: auto;
    }
    #qx999-panel h3 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 700;
      text-align: center;
      color: #00ff66;
      letter-spacing: 0.06em;
    }
    #qx999-panel .qx999-sec {
      margin: 14px 0 10px;
      padding: 5px 10px;
      border-radius: 6px;
      background: rgba(0,255,102,0.08);
      border-left: 3px solid #00ff66;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #00ff66;
    }
    #qx999-panel .qx999-row {
      margin-bottom: 12px;
    }
    #qx999-panel label {
      display: block;
      font-size: 12px;
      color: #9fd4ad;
      margin-bottom: 6px;
    }
    #qx999-panel .qx999-subhint {
      margin: -2px 0 6px;
      font-size: 10px;
      color: #6a9a78;
      line-height: 1.3;
    }
    #qx999-panel .qx999-grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    #qx999-panel .qx999-input-block {
      display: block;
      width: 100%;
    }
    #qx999-panel .qx999-time-input {
      box-sizing: border-box;
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(0,255,102,0.3);
      background: rgba(0,0,0,0.35);
      color: #fff;
      font-size: 15px;
      font-family: inherit;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    }
    #qx999-panel .qx999-time-input:focus {
      border-color: #00ff66;
      box-shadow: 0 0 0 2px rgba(0,255,102,0.2);
    }
    #qx999-panel .qx999-time-input::-webkit-outer-spin-button,
    #qx999-panel .qx999-time-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    #qx999-panel .qx999-time-input[type="number"] {
      -moz-appearance: textfield;
    }
    #qx999-panel .qx999-save-btn {
      flex-shrink: 0;
      padding: 10px 14px;
      border: none;
      border-radius: 8px;
      background: #00ff66;
      color: #052210;
      font-weight: 700;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
    }
    #qx999-panel .qx999-save-btn:active {
      background: #00e65c;
    }
    #qx999-panel .qx999-save-btn-block {
      display: block;
      width: 100%;
      margin-top: 4px;
      padding: 12px 14px;
      font-size: 14px;
    }
    #qx999-panel .qx999-seg {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    #qx999-panel .qx999-seg button {
      flex: 1 1 auto;
      min-width: 60px;
      padding: 10px 8px;
      border-radius: 8px;
      border: 1px solid rgba(0,255,102,0.25);
      background: rgba(0,0,0,0.3);
      color: #dfffe8;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    #qx999-panel .qx999-seg button.qx999-seg-active {
      background: rgba(0,255,102,0.18);
      border-color: #00ff66;
      box-shadow: 0 0 16px rgba(0,255,102,0.35);
      color: #00ff66;
    }
    #qx999-panel .qx999-force-row {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    #qx999-panel .qx999-force-btn {
      flex: 1;
      padding: 9px 6px;
      border-radius: 8px;
      border: 1px solid rgba(0,255,102,0.45);
      background: rgba(0,0,0,0.3);
      color: #dfffe8;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, box-shadow 0.15s;
    }
    #qx999-panel .qx999-force-btn:active {
      background: rgba(0,255,102,0.15);
      box-shadow: 0 0 12px rgba(0,255,102,0.3);
    }
    #qx999-panel .qx999-force-btn.qx999-force-down {
      border-color: rgba(255,80,80,0.55);
    }
    #qx999-panel .qx999-force-btn.qx999-force-down:active {
      background: rgba(255,80,80,0.15);
      box-shadow: 0 0 12px rgba(255,80,80,0.3);
    }
    #qx999-panel-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
    }
    #qx999-panel-backdrop.qx999-backdrop-open {
      opacity: 1;
      pointer-events: auto;
    }
    #qx999-panel-hint {
      margin: 10px 0 0;
      font-size: 11px;
      text-align: center;
      color: #6a9a78;
      line-height: 1.35;
    }
    #qx999-save-status {
      min-height: 18px;
      margin: 8px 0 0;
      font-size: 12px;
      text-align: center;
      color: #00ff66;
      font-weight: 600;
    }
    #qx999-panel button,
    #qx999-panel input {
      touch-action: manipulation;
    }
  `;
    document.head.appendChild(style);

    /* ==================== DOM: OVERLAYS, PANEL, WIDGET ==================== */

    const scanOverlay = document.createElement("div");
    scanOverlay.id = "qx999-scan-overlay";
    scanOverlay.innerHTML = '<div id="qx999-scan-line"></div>';
    document.body.appendChild(scanOverlay);

    const backdrop = document.createElement("div");
    backdrop.id = "qx999-panel-backdrop";

    const panel = document.createElement("div");
    panel.id = "qx999-panel";
    panel.innerHTML = `
      <h3>SMC Auto Bot v2</h3>

      <div class="qx999-sec">Trading</div>

      <div class="qx999-row">
        <label>Asset</label>
        <input id="qx999-in-asset" class="qx999-time-input" type="text" maxlength="30" placeholder="EURUSD_otc" spellcheck="false" />
        <p class="qx999-subhint">Pair for the direct price feed (auto-detected from the page). Examples: EURUSD_otc, GBPJPY_otc, BTCUSD_otc.</p>
      </div>

      <div class="qx999-row">
        <label>Mode</label>
        <div class="qx999-seg" id="qx999-seg-mode">
          <button type="button" data-val="auto">AUTO</button>
          <button type="button" data-val="semi">SEMI</button>
        </div>
        <p class="qx999-subhint">AUTO = trades every valid signal until stopped. SEMI = tap icon to arm, next signal fires one trade.</p>
      </div>

      <div class="qx999-row">
        <label>Trade direction</label>
        <div class="qx999-seg" id="qx999-seg-dir">
          <button type="button" data-val="trend">TREND ⚡</button>
          <button type="button" data-val="signal">REVERSAL</button>
          <button type="button" data-val="up">UP</button>
          <button type="button" data-val="down">DOWN</button>
          <button type="button" data-val="random">RANDOM</button>
        </div>
        <p class="qx999-subhint">TREND ⚡ = follows EMA trend, fast pullback/momentum entries (recommended). REVERSAL = strict 5-voter confluence.</p>
      </div>

      <div class="qx999-grid2">
        <div class="qx999-row">
          <label>Platform expiry (s)</label>
          <p class="qx999-subhint">Expiry you set on QUOTEX</p>
          <input id="qx999-in-expiry" class="qx999-time-input" type="number" min="5" max="3600" step="1" />
        </div>
        <div class="qx999-row">
          <label>Entry delay (s)</label>
          <p class="qx999-subhint">Wait after signal</p>
          <input id="qx999-in-entrydelay" class="qx999-time-input" type="number" min="0" max="10" step="0.1" />
        </div>
      </div>

      <div class="qx999-grid2">
        <div class="qx999-row">
          <label>Cooldown (s)</label>
          <p class="qx999-subhint">Gap between trades</p>
          <input id="qx999-in-cooldown" class="qx999-time-input" type="number" min="0" max="120" step="1" />
        </div>
        <div class="qx999-row">
          <label>Signal expiry (s)</label>
          <p class="qx999-subhint">Max age of a signal</p>
          <input id="qx999-in-sigexpiry" class="qx999-time-input" type="number" min="1" max="30" step="1" />
        </div>
      </div>

      <div class="qx999-sec">Signal engine</div>

      <div class="qx999-row">
        <label>Min confluence votes</label>
        <div class="qx999-seg" id="qx999-seg-votes">
          <button type="button" data-val="2">2 / 5</button>
          <button type="button" data-val="3">3 / 5</button>
          <button type="button" data-val="4">4 / 5</button>
        </div>
        <p class="qx999-subhint">RSI + EMA + Bollinger + open/close pattern + High/Low sweep = 5 voters. More votes = stricter filter.</p>
      </div>

      <div class="qx999-row">
        <label>Candle interval</label>
        <div class="qx999-seg" id="qx999-seg-candle">
          <button type="button" data-val="5">5s</button>
          <button type="button" data-val="15">15s</button>
          <button type="button" data-val="30">30s</button>
          <button type="button" data-val="60">60s</button>
        </div>
        <p class="qx999-subhint">5s ≈ 105s warmup + fastest signals · 15s ≈ 5min · 60s = slowest but smoother. Shorter = faster.</p>
      </div>

      <div class="qx999-sec">Diagnose</div>

      <div class="qx999-row">
        <label>Force test trade</label>
        <p class="qx999-subhint">Fires ONE real trade NOW on the current asset at your saved stake. If a trade opens, the order pipeline is OK — any "not trading" issue is feed/signal related and the widget shows the reason.</p>
        <div class="qx999-force-row">
          <button type="button" id="qx999-force-up" class="qx999-force-btn">▲ TEST UP</button>
          <button type="button" id="qx999-force-down" class="qx999-force-btn qx999-force-down">▼ TEST DOWN</button>
        </div>
      </div>

      <div class="qx999-sec">Money management</div>

      <div class="qx999-row">
        <label>Stake mode</label>
        <div class="qx999-seg" id="qx999-seg-stake">
          <button type="button" data-val="fixed">FIXED</button>
          <button type="button" data-val="martingale">MARTI</button>
          <button type="button" data-val="percent">% BAL</button>
        </div>
      </div>

      <div class="qx999-grid2">
        <div class="qx999-row">
          <label>Base amount ($)</label>
          <input id="qx999-in-base" class="qx999-time-input" type="number" min="0.1" max="100000" step="0.1" />
        </div>
        <div class="qx999-row">
          <label>Stop-Loss ($, 0 = off)</label>
          <input id="qx999-in-stoploss" class="qx999-time-input" type="number" min="0" max="1000000" step="0.5" />
        </div>
      </div>

      <div class="qx999-grid2">
        <div class="qx999-row">
          <label>Marti multiplier</label>
          <input id="qx999-in-mult" class="qx999-time-input" type="number" min="1.1" max="5" step="0.1" />
        </div>
        <div class="qx999-row">
          <label>Marti max steps</label>
          <input id="qx999-in-martsteps" class="qx999-time-input" type="number" min="1" max="10" step="1" />
        </div>
      </div>

      <div class="qx999-row">
        <label>Percent of balance (%)</label>
        <p class="qx999-subhint">Used only in % BAL mode, e.g. 2 = 2% of current balance per trade.</p>
        <input id="qx999-in-percent" class="qx999-time-input qx999-input-block" type="number" min="0.1" max="50" step="0.1" />
      </div>

      <button type="button" id="qx999-save-all" class="qx999-save-btn qx999-save-btn-block">Save</button>
      <p id="qx999-save-status"></p>
      <p id="qx999-panel-hint">3 taps on icon to open · tap outside to close</p>
    `;
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    panel.addEventListener("mousedown", (e) => e.stopPropagation());
    panel.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    panel.addEventListener("touchend", (e) => e.stopPropagation());

    /* ==================== PANEL LOGIC ==================== */

    const inExpiry = panel.querySelector("#qx999-in-expiry");
    const inEntryDelay = panel.querySelector("#qx999-in-entrydelay");
    const inCooldown = panel.querySelector("#qx999-in-cooldown");
    const inSigExpiry = panel.querySelector("#qx999-in-sigexpiry");
    const inBase = panel.querySelector("#qx999-in-base");
    const inStopLoss = panel.querySelector("#qx999-in-stoploss");
    const inMult = panel.querySelector("#qx999-in-mult");
    const inMartSteps = panel.querySelector("#qx999-in-martsteps");
    const inPercent = panel.querySelector("#qx999-in-percent");
    const inAsset = panel.querySelector("#qx999-in-asset");
    const saveStatus = panel.querySelector("#qx999-save-status");
    let saveStatusTimer = null;

    const pending = {
      mode: settings.mode,
      direction: settings.direction,
      minVotes: String(settings.minVotes),
      candleSec: String(settings.candleSec),
      stakeMode: settings.stakeMode,
    };

    function syncSeg(id, val) {
      const seg = panel.querySelector("#" + id);
      if (!seg) return;
      seg.querySelectorAll("button").forEach((btn) => {
        btn.classList.toggle("qx999-seg-active", btn.dataset.val === String(val));
      });
    }

    function bindSeg(id, key, isNumeric) {
      const seg = panel.querySelector("#" + id);
      if (!seg) return;
      seg.querySelectorAll("button").forEach((btn) => {
        bindPanelAction(btn, () => {
          pending[key] = isNumeric ? btn.dataset.val : btn.dataset.val;
          syncSeg(id, btn.dataset.val);
        });
      });
    }

    function syncPanelUI() {
      inExpiry.value = String(settings.expirySec);
      inEntryDelay.value = String(settings.entryDelaySec);
      inCooldown.value = String(settings.cooldownSec);
      inSigExpiry.value = String(settings.signalExpirySec);
      inBase.value = String(settings.baseAmount);
      inStopLoss.value = String(settings.stopLoss);
      inMult.value = String(settings.martMultiplier);
      inMartSteps.value = String(settings.martMaxSteps);
      inPercent.value = String(settings.percentOfBalance);
      if (inAsset) inAsset.value = String(settings.asset || "");
      pending.mode = settings.mode;
      pending.direction = settings.direction;
      pending.minVotes = String(settings.minVotes);
      pending.candleSec = String(settings.candleSec);
      pending.stakeMode = settings.stakeMode;
      syncSeg("qx999-seg-mode", pending.mode);
      syncSeg("qx999-seg-dir", pending.direction);
      syncSeg("qx999-seg-votes", pending.minVotes);
      syncSeg("qx999-seg-candle", pending.candleSec);
      syncSeg("qx999-seg-stake", pending.stakeMode);
    }

    function openPanel() {
      syncPanelUI();
      backdrop.classList.add("qx999-backdrop-open");
      panel.classList.add("qx999-panel-open");
    }

    function closePanel() {
      backdrop.classList.remove("qx999-backdrop-open");
      panel.classList.remove("qx999-panel-open");
      saveStatus.textContent = "";
    }

    function showSaveStatus(msg, isError) {
      saveStatus.textContent = msg;
      saveStatus.style.color = isError ? "#ff6b6b" : "#00ff66";
      if (saveStatusTimer) clearTimeout(saveStatusTimer);
      saveStatusTimer = setTimeout(() => {
        saveStatus.textContent = "";
      }, 2500);
    }

    function numFrom(input, def, min, max, round) {
      return clampNum(String(input.value).trim(), def, min, max, round);
    }

    function applyAllSettings() {
      const prevCandleSec = settings.candleSec;
      settings.mode = pending.mode === "semi" ? "semi" : "auto";
      settings.direction = ["trend", "signal", "up", "down", "random"].includes(pending.direction)
        ? pending.direction
        : defaults.direction;
      settings.minVotes = clampNum(pending.minVotes, defaults.minVotes, 2, 4, true);
      settings.candleSec = [5, 15, 30, 60].includes(Number(pending.candleSec))
        ? Number(pending.candleSec)
        : defaults.candleSec;
      settings.stakeMode = ["fixed", "martingale", "percent"].includes(pending.stakeMode)
        ? pending.stakeMode
        : defaults.stakeMode;
      settings.expirySec = numFrom(inExpiry, defaults.expirySec, 5, 3600, true);
      settings.entryDelaySec = numFrom(inEntryDelay, defaults.entryDelaySec, 0, 10, false);
      settings.cooldownSec = numFrom(inCooldown, defaults.cooldownSec, 0, 120, true);
      settings.signalExpirySec = numFrom(inSigExpiry, defaults.signalExpirySec, 1, 30, true);
      settings.baseAmount = numFrom(inBase, defaults.baseAmount, 0.1, 100000, false);
      settings.stopLoss = numFrom(inStopLoss, defaults.stopLoss, 0, 1000000, false);
      settings.martMultiplier = numFrom(inMult, defaults.martMultiplier, 1.1, 5, false);
      settings.martMaxSteps = numFrom(inMartSteps, defaults.martMaxSteps, 1, 10, true);
      settings.percentOfBalance = numFrom(inPercent, defaults.percentOfBalance, 0.1, 50, false);
      try {
        let a = ((inAsset && inAsset.value) || "").trim().replace(/\s+/g, "").toUpperCase();
        if (/OTC$/.test(a)) a = a.slice(0, -3).replace(/_$/, "") + "_otc";
        if (/^[A-Z0-9#_]{3,30}$/.test(a)) settings.asset = a;
      } catch (e) { /* keep current */ }

      if (settings.candleSec !== prevCandleSec) {
        resetFeedCandles();
        console.log("SMC: candle interval changed to", settings.candleSec + "s — feed re-warming");
      }

      const stored = saveSettings(settings);
      syncPanelUI();
      closePanel();
      console.log(
        "SMC: settings saved | mode:", settings.mode,
        "| dir:", settings.direction,
        "| votes:", settings.minVotes,
        "| candle:", settings.candleSec + "s",
        "| stake:", settings.stakeMode,
        "| base:", settings.baseAmount,
        "| SL:", settings.stopLoss === 0 ? "off" : "$" + settings.stopLoss,
        "| asset:", settings.asset,
        stored ? "" : "(storage blocked)"
      );
    }

    function bindPanelAction(el, handler) {
      let lock = false;
      const run = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (lock) return;
        lock = true;
        setTimeout(() => {
          lock = false;
        }, 300);
        handler();
      };
      el.addEventListener("pointerup", run);
      el.addEventListener("click", run);
    }

    bindSeg("qx999-seg-mode", "mode", false);
    bindSeg("qx999-seg-dir", "direction", false);
    bindSeg("qx999-seg-votes", "minVotes", true);
    bindSeg("qx999-seg-candle", "candleSec", true);
    bindSeg("qx999-seg-stake", "stakeMode", false);

    bindPanelAction(panel.querySelector("#qx999-save-all"), applyAllSettings);

    function onSettingsEnter(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        applyAllSettings();
      }
    }
    [
      inExpiry, inEntryDelay, inCooldown, inSigExpiry,
      inBase, inStopLoss, inMult, inMartSteps, inPercent, inAsset,
    ].forEach((el) => { if (el) el.addEventListener("keydown", onSettingsEnter); });

    bindPanelAction(backdrop, closePanel);

    /* ---- Force test trade: verifies the ORDER pipeline without waiting for a signal ---- */
    const forceUpBtn = panel.querySelector("#qx999-force-up");
    const forceDownBtn = panel.querySelector("#qx999-force-down");
    function forceTestTrade(dir) {
      if (bot.tradeInFlight) {
        showSaveStatus("A trade is already in flight…", true);
        return;
      }
      console.log("SMC: FORCE TEST TRADE (" + dir + ") — user requested manual order");
      fireTrade(dir, null, null, ["manual force test"]);
      showSaveStatus(
        "Force trade fired (" + dir.toUpperCase() + ") — watch the platform.",
        false
      );
    }
    bindPanelAction(forceUpBtn, () => forceTestTrade("up"));
    bindPanelAction(forceDownBtn, () => forceTestTrade("down"));

    /* ==================== WIDGET + STATS CARD ==================== */

    const widget = document.createElement("div");
    widget.id = "qx999-widget";
    widget.innerHTML = `
      <div id="qx999-logo-wrap"><img src="${LOGO_URL}" alt="SMC" draggable="false" /></div>
      <span id="qx999-label">${LABEL}</span>
      <div id="qx999-stats">
        <div class="qx999-st-status" id="qx999-st-status">IDLE</div>
        <div class="qx999-st-line" id="qx999-st-line1">W 0 · L 0 · WR —</div>
        <div class="qx999-st-line" id="qx999-st-line2">P/L $0.00</div>
        <div class="qx999-st-feed" id="qx999-st-feed">feed: starting…</div>
        <div class="qx999-st-diag" id="qx999-st-diag"></div>
      </div>
    `;
    document.body.appendChild(widget);

    const labelEl = widget.querySelector("#qx999-label");
    const stStatus = widget.querySelector("#qx999-st-status");
    const stLine1 = widget.querySelector("#qx999-st-line1");
    const stLine2 = widget.querySelector("#qx999-st-line2");
    const stFeed = widget.querySelector("#qx999-st-feed");
    const stDiag = widget.querySelector("#qx999-st-diag");

    /* ==================== PRICE FEED ====================
     * Two sources, best available wins:
     *  1. DOM watcher  - observes the on-page price element (works
     *     immediately because the page sockets already exist).
     *  2. WebSocket hook - captures ticks from sockets opened AFTER
     *     the bot loads (page reconnects, navigation between assets).
     * Ticks are bucketed into synthetic candles (settings.candleSec).
     */

    const feed = {
      source: null,          // "dom" | "ws" | null
      priceEl: null,
      priceObserver: null,
      lastPrice: null,
      lastTickAt: 0,
      ticks: 0,
      candles: [],           // closed candles: {t,o,h,l,c}
      current: null,         // forming candle
      wsThrottleAt: 0,
      rediscoveryAt: 0,
      domHuntAt: 0,
      socketHuntAt: 0,
      huntUntil: 0,
      realMode: false,       // true = analysis runs on the platform's REAL candles
      realPeriod: 60,        // real candle period in seconds (detected from data)
      lastHistoryTs: 0,
      // diagnostics: which protocol channels are actually delivering data
      wsMsgs: 0,             // JSON payloads processed (any tap source)
      ohlcHits: 0,           // messages containing real candle history
      relHits: 0,            // messages containing [ts, price] realtime rows
      domTicks: 0,           // ticks captured from DOM price node
      dupHits: 0,            // duplicate payloads skipped (tap dedupe ring)
      binFrames: 0,          // binary WS frames seen (protocol diagnostic)
      tapStats: {},          // payloads processed per tap source
      shapes: new Map(),     // payload shape -> { n, src, head } protocol dictionary
      endpoints: {},         // discovered candle-history endpoints -> { n }
      pollFails: 0,
      lastDeepScan: 0,
      lastPollAt: 0,
      tapsOn: false,
      frameTaps: 0,
      sioFrames: 0,          // Socket.IO event frames unwrapped (v2.6)
      workerMsgs: 0,         // payloads forwarded from worker realms
    };

    function resetFeedCandles() {
      feed.candles = [];
      feed.current = null;
      feed.lastPrice = null;
    }

    function parsePriceText(txt) {
      if (!txt) return null;
      const cleaned = txt.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "");
      const m = cleaned.match(/-?\d+(\.\d+)?/);
      if (!m) return null;
      const v = parseFloat(m[0]);
      return Number.isFinite(v) && v > 0 ? v : null;
    }

    function feedTick(price, src, ts) {
      if (!Number.isFinite(price) || price <= 0) return;
      if (src === "dom") feed.domTicks += 1;
      const now = ts > 0 ? ts : Date.now();

      // Sanity check: reject wild jumps unless feed was silent a while
      // (asset switch or feed restart) - then accept and rebuild candles.
      if (feed.lastPrice != null && now - feed.lastTickAt < 15000) {
        const drift = Math.abs(price - feed.lastPrice) / feed.lastPrice;
        if (drift > 0.1) return;
      } else if (feed.lastPrice != null && now - feed.lastTickAt >= 15000) {
        const drift = Math.abs(price - feed.lastPrice) / feed.lastPrice;
        if (drift > 0.001) {
          // Likely a different asset: start a fresh feed
          console.log("SMC: price feed restart (asset change?) — candles rebuilt");
          feed.candles = [];
          feed.current = null;
        }
      }

      if (!feed.source || src === "dom") feed.source = src;
      feed.lastPrice = price;
      feed.lastTickAt = now;
      feed.ticks += 1;

      const bucketMs = (feed.realMode ? feed.realPeriod : settings.candleSec) * 1000;
      const bucket = Math.floor(now / bucketMs) * bucketMs;
      if (!feed.current || feed.current.t !== bucket) {
        if (feed.current) {
          feed.candles.push(feed.current);
          if (feed.candles.length > 400) feed.candles.shift();
        }
        feed.current = { t: bucket, o: price, h: price, l: price, c: price };
      } else {
        if (price > feed.current.h) feed.current.h = price;
        if (price < feed.current.l) feed.current.l = price;
        feed.current.c = price;
      }
    }

    /* ---- Source 1: DOM price element watcher ---- */

    function findPriceElement() {
      const selectors = [
        '[class*="current-price" i]',
        '[class*="quote-price" i]',
        '[class*="asset-price" i]',
        '[class*="price" i]:not(input):not(button):not(script):not(style)',
      ];
      for (const sel of selectors) {
        let nodes;
        try {
          nodes = document.querySelectorAll(sel);
        } catch {
          continue;
        }
        for (const el of nodes) {
          if (!el || el.closest("#qx999-widget") || el.closest("#qx999-panel")) continue;
          const txt = (el.textContent || "").trim();
          if (txt.length === 0 || txt.length > 16) continue;
          if (!/\d/.test(txt) || !/[.,]/.test(txt)) continue;
          if (el.children.length > 1) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (parsePriceText(txt) != null) return el;
        }
      }
      return null;
    }

    function attachPriceWatcher() {
      const el = findPriceElement();
      if (!el) return false;
      if (feed.priceObserver) {
        try { feed.priceObserver.disconnect(); } catch { /* ignore */ }
      }
      feed.priceEl = el;
      const obs = new MutationObserver(() => {
        const price = parsePriceText(el.textContent);
        if (price != null) feedTick(price, "dom");
      });
      obs.observe(el, { characterData: true, childList: true, subtree: true });
      feed.priceObserver = obs;
      const first = parsePriceText(el.textContent);
      if (first != null) feedTick(first, "dom");
      console.log("SMC: DOM price watcher attached");
      return true;
    }

    function priceWatchdog() {
      const now = Date.now();
      const elGone = feed.priceEl && !document.contains(feed.priceEl);
      const dead = feed.ticks === 0 || now - feed.lastTickAt > 15000;

      // Self-poll: if we know a candle-history endpoint and the feed is
      // dead ≥30s, re-fetch it ourselves to keep candles flowing.
      try {
        smcSelfPoll();
      } catch (e) {
        /* ignore */
      }

      // Source 5: OWN direct socket to the QUOTEX trade server (guaranteed
      // channel — independent of the page's sockets/workers)
      try {
        ensureDirectSocket();
      } catch (e) {
        /* ignore */
      }

      // Source 3: hunt already-open WebSockets every 6s until we hold one
      if (now - feed.socketHuntAt > 6000) {
        feed.socketHuntAt = now;
        const found = huntExistingSockets();
        if (found > 0) {
          console.log("SMC: socket hunter attached", found, "live WebSocket(s) — total", smcLiveSockets.length);
        }
      }

      if (!dead && !elGone) return;

      // Feed dead or price node vanished: try classic selectors, then universal hunt
      if (elGone || now - feed.rediscoveryAt > 9000) {
        feed.rediscoveryAt = now;
        if (attachPriceWatcher()) return;
        if (now > feed.huntUntil && now - feed.domHuntAt > 9000) {
          feed.domHuntAt = now;
          universalDomHunt();
        }
      }
    }

    /* ---- Source 2: WebSocket hook (sockets opened after bot load) ---- */

    const NativeWebSocket = window.WebSocket;

    /* Native refs captured BEFORE any wrapping (used by the tap layer).
     * On the Tampermonkey edition the prehook saved the true native
     * JSON.parse in __SMC_NATIVE_PARSE__ before wrapping it itself. */
    const NativeJSONParse = window.__SMC_NATIVE_PARSE__ || JSON.parse;
    let NativeTextDecoderDecode = null;
    let NativeFetchRef = null;
    const smcNativeDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;
    const smcSavedXHR =
      window.XMLHttpRequest
        ? { open: XMLHttpRequest.prototype.open, send: XMLHttpRequest.prototype.send }
        : null;

    function extractWsPrice(node, depth, out) {
      if (depth > 6 || node == null || out.count >= 4) return;
      if (Array.isArray(node)) {
        for (const item of node) extractWsPrice(item, depth + 1, out);
        return;
      }
      if (typeof node !== "object") return;
      const keys = Object.keys(node);
      for (const key of ["price", "quote", "close", "last", "rate", "currentPrice"]) {
        const v = node[key];
        let num = null;
        if (typeof v === "number" && v > 0.0001 && v < 10000000) num = v;
        else if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v)) num = parseFloat(v);
        if (num != null) {
          out.price = num;
          out.count += 1;
          return;
        }
      }
      for (const key of keys) {
        if (key === "asset" || key === "symbol" || key === "time") continue;
        extractWsPrice(node[key], depth + 1, out);
      }
    }

    /* ---- QUOTEX protocol extraction ----
     * QUOTEX sends realtime updates as ARRAY rows, not keyed objects:
     *   realtime: {"asset":"EURUSD_otc","rel":[[unixSec, price], ...]}
     *   history:  [[unixSec, open, close, high, low], ...] (minute candles)
     * The old parser only understood object keys ("price", "quote"...) which is
     * why ticks stayed at 0. These extractors read the array protocol directly.
     */

    function plausiblePriceNum(v) {
      return typeof v === "number" && Number.isFinite(v) && v > 0.0001 && v < 10000000 ? v : null;
    }

    function tsSecondsOk(t) {
      if (typeof t !== "number" || !Number.isFinite(t)) return false;
      const nowS = Date.now() / 1000;
      return t > nowS - 172800 && t < nowS + 300; // last 48h, small future slack
    }

    function extractRelTicks(node, out, depth, seen) {
      if (depth > 10 || out.length >= 60 || node == null) return;
      if (Array.isArray(node)) {
        if (
          node.length === 2 &&
          tsSecondsOk(node[0]) &&
          plausiblePriceNum(node[1]) != null
        ) {
          out.push({ t: node[0] * 1000, price: node[1] });
          return;
        }
        for (const item of node) extractRelTicks(item, out, depth + 1, seen);
        return;
      }
      if (typeof node !== "object") return;
      if (seen.has(node)) return;
      seen.add(node);
      for (const k of Object.keys(node)) {
        try { extractRelTicks(node[k], out, depth + 1, seen); } catch { /* ignore */ }
      }
    }

    function tryParseOhlcRow(row) {
      if (!Array.isArray(row) || row.length !== 5) return null;
      if (!tsSecondsOk(row[0])) return null;
      for (let i = 1; i < 5; i++) {
        if (typeof row[i] !== "number" || !Number.isFinite(row[i])) return null;
      }
      // QUOTEX order [ts, open, close, high, low] vs standard [ts, open, high, low, close]
      const a = { t: row[0] * 1000, o: row[1], c: row[2], h: row[3], l: row[4] };
      if (a.h >= Math.max(a.o, a.c) - 1e-9 && a.l <= Math.min(a.o, a.c) + 1e-9) return a;
      const b = { t: row[0] * 1000, o: row[1], h: row[2], l: row[3], c: row[4] };
      if (b.h >= Math.max(b.o, b.c) - 1e-9 && b.l <= Math.min(b.o, b.c) + 1e-9) return b;
      return null;
    }

    function extractOhlcRows(node, out, depth, seen) {
      if (depth > 10 || node == null) return;
      if (Array.isArray(node)) {
        if (node.length >= 5) {
          let allOk = true;
          for (const r of node) {
            if (!tryParseOhlcRow(r)) {
              allOk = false;
              break;
            }
          }
          if (allOk) {
            for (const r of node) out.push(tryParseOhlcRow(r));
            return;
          }
        }
        for (const item of node) extractOhlcRows(item, out, depth + 1, seen);
        return;
      }
      if (typeof node !== "object") return;
      if (seen.has(node)) return;
      seen.add(node);
      for (const k of Object.keys(node)) {
        try { extractOhlcRows(node[k], out, depth + 1, seen); } catch { /* ignore */ }
      }
    }

    /* Ingest REAL platform candles: instant warmup on the platform's own
     * minute candles (open/high/low/close) — exactly what the user asked for. */
    function ingestRealCandles(rows) {
      if (!rows || rows.length < 5) return 0;
      // Synthetic feed healthy, warm AND fresh? Keep it, no need for real history.
      // (A stale feed >30s silent lets real history take over — self-poll path.)
      if (
        !feed.realMode &&
        feed.ticks > 0 &&
        feed.candles.length >= candlesNeeded() &&
        Date.now() - feed.lastTickAt < 30000
      )
        return 0;

      rows.sort((a, b) => a.t - b.t);
      const diffs = [];
      for (let i = 1; i < rows.length; i++) diffs.push(rows[i].t - rows[i - 1].t);
      diffs.sort((a, b) => a - b);
      const periodMs = diffs.length ? diffs[Math.floor(diffs.length / 2)] : 0;
      if (periodMs < 10000) return 0; // ticks, not candles — ignore

      const periodS = Math.round(periodMs / 1000);
      if (!feed.realMode) {
        // Switch to real-candle mode: drop synthetic data entirely
        feed.realMode = true;
        feed.realPeriod = periodS;
        feed.candles = [];
        feed.current = null;
        console.log("SMC: REAL candle mode ON — platform " + periodS + "s candles (open/high/low/close analysis)");
      } else if (Math.abs(periodS - feed.realPeriod) > 2) {
        return 0; // different period blob — skip to protect timeframe consistency
      }

      const have = new Set(feed.candles.map((c) => c.t));
      let added = 0;
      for (const r of rows) {
        if (have.has(r.t)) continue;
        have.add(r.t);
        feed.candles.push(r);
        added += 1;
      }
      if (added > 0) {
        feed.candles.sort((a, b) => a.t - b.t);
        while (feed.candles.length > 400) feed.candles.shift();
        feed.lastTickAt = Date.now(); // history counts as feed activity
        const newest = rows[rows.length - 1];
        if (newest.t > feed.lastHistoryTs) feed.lastHistoryTs = newest.t;
      }
      return added;
    }

    /* ==================== UNIVERSAL DATA TAPS ====================
     * THE FIX for "NO PRICE DATA (never)": the console WS hook only sees
     * sockets opened AFTER the bot is pasted, and the socket hunter cannot
     * reach sockets kept in closures/workers. But the PAGE ITSELF parses
     * every incoming WS message inside our JavaScript realm — long after
     * our patch is installed. So we tap the parsing layer itself:
     *   Tap A  JSON.parse            — every text payload the page parses
     *   Tap B  TextDecoder.decode    — binary frames converted to strings
     *   Tap C  fetch / XHR           — HTTP candle-history responses
     *   Tap D  same-origin frames    — taps installed in child frames
     * plus a dedupe ring so the same payload is processed exactly once.
     * This works no matter WHEN the WebSocket was opened.
     */

    const smcTapRing = [];

    /* Socket.IO EIO=3 frame unwrapper.
     * QUOTEX frames look like:
     *   0{"sid":...}              engine.io open
     *   40 | 40{...}              namespace connect/error
     *   2 | 3                     ping / pong
     *   42["event",data]          event (JSON data)
     *   451-["event",placeholder] event with N binary attachments,
     *                             binary frame follows with raw JSON
     * Returns { body, expectBin } or null when the frame carries no data. */
    function smcUnwrapSio(s) {
      const mBin = /^4(\d*)-(?=[\[{])/.exec(s);
      if (mBin) {
        return { body: s.slice(mBin[0].length - 1), expectBin: mBin[1] ? Number(mBin[1]) : 0 };
      }
      if (s.charCodeAt(0) === 52 && (s.charCodeAt(1) === 91 || s.charCodeAt(1) === 123)) {
        return { body: s.slice(1), expectBin: 0 }; // 4[...] / 4{...}
      }
      if (s.charCodeAt(0) === 52 && s.charCodeAt(1) === 50 &&
          (s.charCodeAt(2) === 91 || s.charCodeAt(2) === 123)) {
        return { body: s.slice(2), expectBin: 0 }; // 42[...] / 42{...}
      }
      return null;
    }

    function smcTapString(s, parsed, src, ts) {
      if (typeof s !== "string") return;
      const sLen = s.length;
      if (sLen < 20 || sLen > 300000) return;
      /* Socket.IO EIO=3 unwrapping (v2.6): frames starting with "4" are
       * events / binary-attachment carriers, NOT plain JSON. Strip the
       * prefix so the payload inside gets parsed. This was the root cause
       * of "NO PRICE DATA": the old gate dropped every framed payload. */
      let body = s;
      let sio = false;
      if (body.charCodeAt(0) === 52) { // "4"
        const uw = smcUnwrapSio(body);
        if (!uw) return; // 40/2/3/44{...} etc — control frames, no price data
        body = uw.body;
        sio = true;
        feed.sioFrames += 1;
      }
      if (body[0] !== "{" && body[0] !== "[") return;
      // Dedupe: WS listener + parse tap (and frames) may see the same payload
      const key = sLen + "|" + s.slice(0, 48) + "|" + s.slice(-32);
      if (smcTapRing.indexOf(key) !== -1) {
        feed.dupHits += 1;
        return;
      }
      smcTapRing.push(key);
      if (smcTapRing.length > 120) smcTapRing.shift();
      if (sio) {
        /* also register the UNWRAPPED body so the page's own parser
         * (JSON.parse tap) hitting the same payload later is deduped */
        const bkey = body.length + "|" + body.slice(0, 48) + "|" + body.slice(-32);
        if (smcTapRing.indexOf(bkey) === -1) {
          smcTapRing.push(bkey);
          if (smcTapRing.length > 120) smcTapRing.shift();
        }
      }
      // Big-payload throttle (analytics noise) — but never skip likely candle data
      if (body.length > 6000) {
        const nT = Date.now();
        const marker =
          body.indexOf('"candles"') >= 0 ||
          body.indexOf('"history"') >= 0 ||
          body.indexOf('"rel"') >= 0 ||
          body.indexOf('"open"') >= 0 ||
          body.slice(0, 2) === "[[";
        if (!marker) {
          if (nT - feed.lastDeepScan < 400) {
            feed.tapStats.skipped = (feed.tapStats.skipped || 0) + 1;
            return;
          }
          feed.lastDeepScan = nT;
        }
      }
      let obj = parsed;
      if (obj == null) {
        try {
          obj = NativeJSONParse(body);
        } catch (e) {
          return;
        }
      }
      feed.wsMsgs += 1;
      const statKey = src && src.indexOf("|") >= 0 ? src.slice(0, src.indexOf("|")) : src || "ws";
      feed.tapStats[statKey] = (feed.tapStats[statKey] || 0) + 1;
      try {
        smcRecordShape(body, obj, src);
      } catch (e) {
        /* ignore */
      }
      processParsedPayload(obj, src, ts);
    }

    function smcShapeKey(obj) {
      try {
        if (Array.isArray(obj)) return "[arr " + obj.length + "]";
        const ks = Object.keys(obj).slice(0, 8).sort();
        return "{" + ks.join(",") + "}";
      } catch (e) {
        return "?";
      }
    }

    function smcRecordShape(s, obj, src) {
      const k = smcShapeKey(obj);
      let rec = feed.shapes.get(k);
      if (!rec) {
        if (feed.shapes.size >= 12) return;
        rec = { n: 0, src: src || "ws", head: s.slice(0, 110) };
        feed.shapes.set(k, rec);
      }
      rec.n += 1;
    }

    function smcNativeDecode(buf) {
      if (!smcNativeDecoder || !NativeTextDecoderDecode) return null;
      try {
        return NativeTextDecoderDecode.call(smcNativeDecoder, buf);
      } catch (e) {
        return null;
      }
    }

    function smcNoteEndpoint(url) {
      if (!url || typeof url !== "string" || url.length > 300) return;
      if (url.indexOf("data:") === 0 || url.indexOf("blob:") === 0) return;
      const rec = feed.endpoints[url] || { n: 0 };
      rec.n += 1;
      feed.endpoints[url] = rec;
    }

    function processParsedPayload(obj, src, ts) {
      const replay = ts > 0;

      // Pass 1: REAL OHLC candle history → instant warmup on minute candles
      try {
        const rows = [];
        extractOhlcRows(obj, rows, 0, new Set());
        if (rows.length >= 5) {
          feed.ohlcHits += 1;
          if (typeof src === "string" && (src.indexOf("fetch|") === 0 || src.indexOf("xhr|") === 0)) {
            smcNoteEndpoint(src.slice(src.indexOf("|") + 1));
          }
          const added = ingestRealCandles(rows);
          if (added > 0) {
            console.log("SMC: ingested", added, "REAL platform candles — total", feed.candles.length);
            return;
          }
        }
      } catch (e) {
        /* ignore */
      }

      // Pass 2: [unixSec, price] realtime pairs
      try {
        const ticks = [];
        extractRelTicks(obj, ticks, 0, new Set());
        if (ticks.length) {
          feed.relHits += 1;
          if (!replay && feed.source === "dom" && Date.now() - feed.lastTickAt < 15000) return;
          for (const tk of ticks) {
            feedTick(tk.price, "ws", tk.t);
          }
          return;
        }
      } catch (e) {
        /* ignore */
      }

      // Pass 3: legacy object-key extraction (other platforms / fallback)
      const out = { price: null, count: 0 };
      extractWsPrice(obj, 0, out);
      if (out.price == null) return;
      if (!replay) {
        const now = Date.now();
        if (now - feed.wsThrottleAt < 250) return;
        feed.wsThrottleAt = now;
        if (feed.source === "dom" && now - feed.lastTickAt < 15000) return;
        feedTick(out.price, "ws");
      } else {
        feedTick(out.price, "ws", ts);
      }
    }

    function onSocketMessage(data, ts) {
      // Accepts string | ArrayBuffer | Blob (WS message payloads)
      try {
        if (typeof data === "string") {
          smcTapString(data, null, "ws", ts);
          return;
        }
        if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
          feed.binFrames += 1;
          const s = smcNativeDecode(data);
          if (typeof s === "string") smcTapString(s, null, "bin", ts);
          return;
        }
        if (typeof Blob !== "undefined" && data instanceof Blob) {
          feed.binFrames += 1;
          try {
            data.text()
              .then((s) => {
                try {
                  if (typeof s === "string") smcTapString(s, null, "bin", ts > 0 ? ts : 0);
                } catch (e) {
                  /* ignore */
                }
              })
              .catch(() => {});
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        /* ignore */
      }
    }

    function installUniversalTaps() {
      if (feed.tapsOn) return;
      feed.tapsOn = true;

      // Capture native refs BEFORE wrapping
      try {
        NativeTextDecoderDecode = TextDecoder.prototype.decode;
      } catch (e) {
        NativeTextDecoderDecode = null;
      }
      try {
        NativeFetchRef = window.fetch;
      } catch (e) {
        NativeFetchRef = null;
      }

      // Tap A: JSON.parse — console edition (Tampermonkey prehook already tapped it)
      if (!window.__SMC_PREHOOK__ && !window.__SMC_PARSE_TAP__) {
        try {
          const wrappedParse = function (text, reviver) {
            const res = NativeJSONParse.call(JSON, text, reviver);
            try {
              smcTapString(text, res, "parse");
            } catch (e) {
              /* ignore */
            }
            return res;
          };
          try {
            wrappedParse.toString = NativeJSONParse.toString.bind(NativeJSONParse);
          } catch (e) {
            /* ignore */
          }
          JSON.parse = wrappedParse;
          window.__SMC_PARSE_TAP__ = true;
        } catch (e) {
          /* ignore */
        }
      }
      if (window.__SMC_PREHOOK__) {
        // Prehook taps JSON.parse from birth and calls this sink for new payloads
        window.__SMC_TAP_SINK__ = function (s) {
          try {
            smcTapString(s, null, "prehook", 0);
          } catch (e) {
            /* ignore */
          }
        };
      }

      // Tap B: TextDecoder.decode — catches binary/compressed WS frames
      if (typeof TextDecoder !== "undefined" && !window.__SMC_DECODE_TAP__) {
        try {
          const pd = TextDecoder.prototype;
          const wrappedDecode = function (input, options) {
            const s = NativeTextDecoderDecode.call(this, input, options);
            try {
              smcTapString(s, null, "decode");
            } catch (e) {
              /* ignore */
            }
            return s;
          };
          try {
            wrappedDecode.toString = NativeTextDecoderDecode.toString.bind(NativeTextDecoderDecode);
          } catch (e) {
            /* ignore */
          }
          pd.decode = wrappedDecode;
          window.__SMC_DECODE_TAP__ = true;
        } catch (e) {
          /* ignore */
        }
      }

      // Tap C: fetch — learns candle-history HTTP endpoints (self-poll fallback)
      if (typeof window.fetch === "function" && !window.__SMC_FETCH_TAP__) {
        try {
          const nf = window.fetch;
          window.fetch = function (...args) {
            const p = nf.apply(this, args);
            try {
              let url = "";
              const a0 = args[0];
              if (typeof a0 === "string") url = a0;
              else if (a0 && typeof a0 === "object" && a0.url) url = String(a0.url);
              if (url && url.length < 300) {
                p.then((res) => {
                  try {
                    if (!res || !res.ok) return;
                    res.clone()
                      .text()
                      .then((t) => {
                        try {
                          smcTapString(t, null, "fetch|" + url);
                        } catch (e) {
                          /* ignore */
                        }
                      })
                      .catch(() => {});
                  } catch (e) {
                    /* ignore */
                  }
                }).catch(() => {});
              }
            } catch (e) {
              /* ignore */
            }
            return p;
          };
          try {
            window.fetch.toString = nf.toString.bind(nf);
          } catch (e) {
            /* ignore */
          }
          window.__SMC_FETCH_TAP__ = true;
        } catch (e) {
          /* ignore */
        }
      }

      // Tap D: XHR — same purpose as fetch tap
      if (window.XMLHttpRequest && !window.__SMC_XHR_TAP__) {
        try {
          const xOpen = XMLHttpRequest.prototype.open;
          const xSend = XMLHttpRequest.prototype.send;
          XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            try {
              this.__smcUrl = String(url || "").slice(0, 300);
            } catch (e) {
              /* ignore */
            }
            return xOpen.call(this, method, url, ...rest);
          };
          XMLHttpRequest.prototype.send = function (...args) {
            try {
              this.addEventListener("load", () => {
                try {
                  const url = this.__smcUrl || "";
                  let txt = null;
                  try {
                    txt = this.responseText;
                  } catch (e) {
                    txt = null;
                  }
                  if (typeof txt === "string" && this.status >= 200 && this.status < 300) {
                    smcTapString(txt, null, "xhr|" + url);
                  }
                } catch (e) {
                  /* ignore */
                }
              });
            } catch (e) {
              /* ignore */
            }
            return xSend.apply(this, args);
          };
          window.__SMC_XHR_TAP__ = true;
        } catch (e) {
          /* ignore */
        }
      }

      // Tap E: Web Worker realms — QUOTEX may run its socket inside a Worker
      try {
        installWorkerTap();
      } catch (e) {
        /* ignore */
      }

      console.log(
        "SMC: universal data taps installed (JSON.parse" +
          (window.__SMC_PARSE_TAP__ ? " ✓" : " prehook") +
          ", TextDecoder" +
          (window.__SMC_DECODE_TAP__ ? " ✓" : " n/a") +
          ", fetch" +
          (window.__SMC_FETCH_TAP__ ? " ✓" : " n/a") +
          ", XHR" +
          (window.__SMC_XHR_TAP__ ? " ✓" : " n/a") +
          ") — capture works even for sockets opened BEFORE the bot"
      );
    }

    /* Tap D2: same-origin child frames get their own JSON.parse tap */
    function smcInstallFrameTaps() {
      let n = 0;
      try {
        for (let i = 0; i < window.frames.length && n < 4; i++) {
          let fwin = null;
          try {
            fwin = window.frames[i];
          } catch (e) {
            continue;
          }
          if (!fwin || fwin === window) continue;
          try {
            if (fwin.__SMC_FRAME_TAPS__) continue;
            const fj = fwin.JSON; // throws on cross-origin
            if (!fj || typeof fj.parse !== "function") continue;
            const fnjp = fj.parse;
            fj.parse = function (t, r) {
              const res = fnjp.call(fj, t, r);
              try {
                if (typeof t === "string") smcTapString(t, res, "frame");
              } catch (e) {
                /* ignore */
              }
              return res;
            };
            fwin.__SMC_FRAME_TAPS__ = true;
            n += 1;
          } catch (e) {
            /* cross-origin frame — unreachable */
          }
        }
      } catch (e) {
        /* ignore */
      }
      feed.frameTaps = n;
      if (n > 0) console.log("SMC: JSON.parse tap installed in", n, "same-origin frame(s)");
      return n;
    }

    /* Self-poll: if the live feed dies, re-fetch the platform's own
     * candle-history endpoint (learned via fetch/XHR taps) to stay fed. */
    function smcSelfPoll() {
      const now = Date.now();
      const dead = feed.lastTickAt === 0 || now - feed.lastTickAt > 30000;
      if (!dead) return;
      if (now - feed.lastPollAt < 15000) return;
      const url = Object.keys(feed.endpoints)[0];
      if (!url || !NativeFetchRef) return;
      feed.lastPollAt = now;
      try {
        const p = NativeFetchRef.call(window, url, { credentials: "include" });
        p.then((r) => {
          if (!r || !r.ok) throw new Error("HTTP " + (r ? r.status : "?"));
          return r.text();
        })
          .then((t) => {
            smcTapString(t, null, "selfpoll");
            console.log("SMC: self-poll refresh OK —", url.slice(0, 90));
          })
          .catch(() => {
            feed.pollFails += 1;
            if (feed.pollFails >= 3) {
              console.log("SMC: self-poll endpoint failing — dropping", url.slice(0, 90));
              delete feed.endpoints[url];
              feed.pollFails = 0;
            }
          });
      } catch (e) {
        /* ignore */
      }
    }

    /* One-shot console diagnosis: run __QX999_FEED_REPORT__() */
    function feedReport() {
      const age =
        feed.lastTickAt > 0 ? Math.max(0, Math.round((Date.now() - feed.lastTickAt) / 1000)) + "s ago" : "never";
      const L = [];
      L.push("===== SMC FEED REPORT v2.6 =====");
      L.push(
        "feed: " + feed.ticks + " ticks | candles " + feed.candles.length +
          (feed.realMode ? " (REAL " + feed.realPeriod + "s)" : " (synthetic " + settings.candleSec + "s)") +
          " | last tick " + age
      );
      L.push(
        "direct socket (own connection to ws2.qxbroker.com): " + DIRECT.state +
          (DIRECT.authed ? " AUTHED" : "") +
          (DIRECT.asset ? " | asset " + DIRECT.asset : "") +
          " | msgs " + DIRECT.msgs + " | bin " + DIRECT.bin +
          (DIRECT.lastErr ? " | lastErr " + DIRECT.lastErr : "")
      );
      L.push(
        "taps: JSON.parse " + (window.__SMC_PARSE_TAP__ || window.__SMC_PREHOOK__ ? "ON" : "off") +
          " | TextDecoder " + (window.__SMC_DECODE_TAP__ ? "ON" : "off") +
          " | fetch " + (window.__SMC_FETCH_TAP__ ? "ON" : "off") +
          " | XHR " + (window.__SMC_XHR_TAP__ ? "ON" : "off") +
          " | Worker " + (window.__SMC_WORKER_TAP__ ? "ON" : "off") +
          " | frames " + feed.frameTaps +
          " | WS-hook " + (window.__SMC_WS_HOOKED__ ? "ON" : "off") +
          " | sockets held " + smcLiveSockets.length
      );
      L.push(
        "payloads: seen " + feed.wsMsgs + " | sio-frames " + feed.sioFrames +
          " | ohlc-history " + feed.ohlcHits +
          " | realtime-ticks " + feed.relHits + " | dom " + feed.domTicks +
          " | binary-frames " + feed.binFrames + " | duplicates " + feed.dupHits +
          " | worker " + feed.workerMsgs
      );
      const tsKeys = Object.keys(feed.tapStats);
      L.push("by source: " + (tsKeys.length ? tsKeys.map((k) => k + " " + feed.tapStats[k]).join(" | ") : "nothing yet"));
      if (feed.shapes && feed.shapes.size) {
        L.push("payload shapes (protocol dictionary):");
        for (const entry of feed.shapes) {
          L.push("  " + entry[0] + " x" + entry[1].n + "  via " + entry[1].src + "  e.g. " + entry[1].head);
        }
      } else {
        L.push("payload shapes: none seen yet");
      }
      const eps = Object.keys(feed.endpoints);
      L.push(
        "candle endpoints: " +
          (eps.length
            ? eps.map((u) => u.slice(0, 90) + " x" + feed.endpoints[u].n).join(" | ")
            : "none discovered yet (switch asset or timeframe once while the bot runs)")
      );
      if (feed.binFrames > 0 && feed.wsMsgs === 0) {
        L.push("VERDICT: BINARY protocol detected — copy the whole report and send it to the developer.");
      } else if (DIRECT.state === "no-token") {
        L.push("VERDICT: direct socket has NO session token (window.settings.token missing) — are you logged in and on the trade page?");
      } else if (DIRECT.state === "auth-failed") {
        L.push("VERDICT: direct socket session rejected — log out, log back in, reload the page and restart the bot.");
      } else if (DIRECT.authed && feed.ticks === 0) {
        L.push("VERDICT: direct socket authorized but no price frames yet — check the Asset field in the panel matches your pair, wait 30s and run this again.");
      } else if (feed.wsMsgs > 0 && feed.ticks === 0 && feed.relHits === 0 && feed.ohlcHits === 0) {
        L.push("VERDICT: payloads arrive but no price extracted — copy the whole report (shapes above) and send it to the developer.");
      } else if (feed.wsMsgs === 0 && !DIRECT.authed) {
        L.push("VERDICT: no payloads captured yet — switch asset once (A→B→A), wait 30s, run __QX999_FEED_REPORT__() again and send the output.");
      } else {
        L.push("VERDICT: price data flowing OK.");
      }
      const txt = L.join("\n");
      console.log(txt);
      return txt;
    }

    /* ---- Source 5: OWN direct socket to the QUOTEX trade server ----
     * QUOTEX speaks Socket.IO EIO=3 on wss://ws2.qxbroker.com. The page's
     * own socket may live in a Web Worker or a closure we cannot reach.
     * This channel opens OUR OWN connection, authorizes with the page's
     * session token (window.settings.token) and subscribes to the asset —
     * completely independent of what the page does. Verified live:
     * handshake + instruments/list arrive even without auth. */

    const DIRECT = {
      ws: null,
      state: "off",        // off|connecting|authing|live|no-token|auth-failed|reconnecting|error
      authed: false,
      session: null,
      msgs: 0,
      bin: 0,
      lastAttemptAt: 0,
      lastSubAt: 0,
      lastErr: "",
      asset: "",
      pendingBin: 0,
      resubTimer: null,
    };

    function directSession() {
      try {
        const st = window.settings;
        if (st && typeof st.token === "string" && st.token.length > 10) {
          return { token: st.token, isDemo: st.isDemo ? 1 : 0 };
        }
      } catch (e) {
        /* ignore */
      }
      try {
        const ls = window.localStorage;
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (!k || !/auth|token|ssid|session/i.test(k)) continue;
          const v = ls.getItem(k);
          if (!v) continue;
          let cand = null;
          try {
            const o = JSON.parse(v);
            cand = o && (o.token || o.ssid || o.session);
          } catch (e2) {
            cand = /^[A-Za-z0-9\-_.]{20,2000}$/.test(v) ? v : null;
          }
          if (typeof cand === "string" && cand.length > 10) {
            return { token: cand, isDemo: 1 };
          }
        }
      } catch (e) {
        /* ignore */
      }
      return null;
    }

    function directDetectAsset() {
      /* Best effort: find the asset label on the trade page
       * ("EURUSD (OTC)", "EURUSD_otc", "EURUSD OTC" ...) in the upper area */
      try {
        const nodes = document.querySelectorAll("div,span,p,b");
        for (const n of nodes) {
          if (n.childElementCount && n.childElementCount > 0) continue;
          const t = (n.textContent || "").trim();
          if (t.length < 3 || t.length > 20) continue;
          const m = /^([A-Z0-9#]{3,10})(?:[\s_-]*otc)?$/i.exec(t);
          if (!m) continue;
          const r = n.getBoundingClientRect();
          if (r.width < 20 || r.height < 8 || r.top < 0 || r.top > 420) continue;
          let name = m[1].toUpperCase();
          if (/otc/i.test(t)) name += "_otc";
          return name;
        }
      } catch (e) {
        /* ignore */
      }
      return "";
    }

    function directSend(s) {
      try {
        if (DIRECT.ws && DIRECT.ws.readyState === 1) DIRECT.ws.send(s);
      } catch (e) {
        /* ignore */
      }
    }

    function directSubscribe() {
      if (!DIRECT.ws || DIRECT.ws.readyState !== 1 || !DIRECT.authed) return;
      let asset = (settings.asset || "").trim();
      if (!asset) asset = "EURUSD_otc";
      const det = directDetectAsset();
      if (det && det !== asset) {
        console.log("SMC: direct socket following detected asset", det, "(panel:", asset + ")");
        asset = det;
      }
      DIRECT.asset = asset;
      const A = JSON.stringify(asset);
      /* subscription sequence (verified against pyquotex/quotexpy libs) */
      directSend('42["instruments/update",{"asset":' + A + ',"period":60}]');
      directSend('42["tick"]');
      directSend('42["depth/follow",' + A + "]");
      directSend('42["chart_notification/get",{"asset":' + A + ',"version":"1.0.0"}]');
      /* candle history for instant warmup */
      const idx = Math.floor(Date.now() / 1000);
      directSend('42["history/load",{"asset":' + A + ',"index":' + idx + ',"time":' + idx + ',"offset":' + idx + ',"period":60}]');
      DIRECT.lastSubAt = Date.now();
      console.log("SMC: direct socket subscribed to", asset);
    }

    function directHandleText(txt) {
      DIRECT.msgs += 1;
      const t = (txt || "").trim();
      if (!t) return;
      const c0 = t[0];
      if (c0 === "0") {
        directSend("40"); // engine.io open -> namespace connect
        return;
      }
      if (c0 === "2") {
        directSend("3"); // engine.io ping -> pong
        return;
      }
      if (c0 === "3" || c0 === "6") return;
      if (t === "40" || /^40\{/.test(t)) {
        if (DIRECT.session && !DIRECT.authed) {
          DIRECT.state = "authing";
          const sess = DIRECT.session;
          directSend('42["authorization",{"session":' + JSON.stringify(sess.token) +
            ',"isDemo":' + (sess.isDemo ? 1 : 0) + ',"tournamentId":0}]');
          setTimeout(() => {
            try {
              if (!DIRECT.authed) directSubscribe(); // some servers skip successauth
            } catch (e) { /* ignore */ }
          }, 4000);
        }
        return;
      }
      if (t.indexOf('"successauth"') !== -1) {
        DIRECT.authed = true;
        DIRECT.state = "live";
        console.log("SMC: direct socket authorized ✓");
        directSubscribe();
        return;
      }
      if (t.indexOf('"failauth"') !== -1 || t.indexOf('"error_auth"') !== -1) {
        DIRECT.state = "auth-failed";
        DIRECT.lastErr = "session rejected";
        return;
      }
      if (c0 === "4") {
        const uw = smcUnwrapSio(t);
        if (!uw) return;
        if (uw.expectBin > 0) DIRECT.pendingBin = uw.expectBin;
        feed.sioFrames += 1;
        smcTapString(uw.body, null, "direct", 0);
        return;
      }
      if (c0 === "{" || c0 === "[") {
        smcTapString(t, null, "direct", 0);
      }
    }

    function directHandleBinary(buf) {
      DIRECT.bin += 1;
      feed.binFrames += 1;
      let s = null;
      s = smcNativeDecode(buf);
      if (!s) {
        try {
          const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
          let out = "";
          const CH = 8192;
          for (let i = 0; i < u8.length; i += CH) {
            out += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
          }
          s = out;
        } catch (e) {
          s = null;
        }
      }
      if (typeof s === "string" && s.length > 1) {
        DIRECT.pendingBin = Math.max(0, DIRECT.pendingBin - 1);
        smcTapString(s, null, "direct-bin", 0);
      }
    }

    function ensureDirectSocket() {
      if (DIRECT.ws && (DIRECT.ws.readyState === 0 || DIRECT.ws.readyState === 1)) {
        /* already connected — re-subscribe periodically to track asset changes */
        if (DIRECT.authed && Date.now() - DIRECT.lastSubAt > 120000) {
          directSubscribe();
        }
        return;
      }
      const now = Date.now();
      if (now - DIRECT.lastAttemptAt < 12000) return;
      DIRECT.lastAttemptAt = now;
      const sess = directSession();
      if (!sess) {
        DIRECT.state = "no-token";
        return;
      }
      DIRECT.session = sess;
      let ws;
      try {
        ws = new NativeWebSocket("wss://ws2.qxbroker.com/socket.io/?EIO=3&transport=websocket");
      } catch (e) {
        DIRECT.state = "error";
        DIRECT.lastErr = String((e && e.message) || e).slice(0, 80);
        return;
      }
      DIRECT.ws = ws;
      DIRECT.authed = false;
      DIRECT.state = "connecting";
      ws.onopen = () => {
        DIRECT.state = "authing";
      };
      ws.onmessage = (ev) => {
        try {
          if (typeof ev.data === "string") directHandleText(ev.data);
          else if (ev.data instanceof ArrayBuffer) directHandleBinary(ev.data);
          else if (typeof Blob !== "undefined" && ev.data instanceof Blob) {
            ev.data.text()
              .then((s2) => {
                try {
                  DIRECT.bin += 1;
                  feed.binFrames += 1;
                  if (typeof s2 === "string" && s2.length > 1) smcTapString(s2, null, "direct-bin", 0);
                } catch (e) { /* ignore */ }
              })
              .catch(() => {});
          }
        } catch (e) { /* ignore */ }
      };
      ws.onclose = () => {
        if (DIRECT.ws === ws) {
          DIRECT.state = DIRECT.authed ? "reconnecting" : "closed";
          DIRECT.authed = false;
          DIRECT.ws = null;
        }
      };
      ws.onerror = () => {
        DIRECT.lastErr = "socket error";
      };
      console.log("SMC: direct socket connecting to QUOTEX trade server…");
    }

    /* ---- Source 6: Web Worker tap ----
     * The page may run its socket inside a Worker. We prepend a tiny
     * capture shim into same-origin/blob worker scripts so their
     * JSON.parse calls and WebSocket messages get forwarded here. */

    const SMC_WORKER_TAP_SRC =
      '(function(){try{' +
      'var NP=JSON.parse;' +
      'JSON.parse=function(t,r){var v=NP.call(JSON,t,r);' +
      'try{if(typeof t==="string"&&t.length>20)postMessage({__smcTap:t});}catch(e){}' +
      'return v;};' +
      'var OW=WebSocket;' +
      'if(OW){var H=function(){return function(ev){try{var d=ev&&ev.data;' +
      'if(typeof d==="string"&&d.length>20)postMessage({__smcTap:d});' +
      'else if(d instanceof ArrayBuffer){' +
      'var u=new Uint8Array(d);var o="";for(var i=0;i<u.length;i+=8192){o+=String.fromCharCode.apply(null,u.subarray(i,i+8192));}' +
      'if(o.length>20)postMessage({__smcTap:o});}}catch(e){}};};' +
      'WebSocket=function(u,p){var w=p!==undefined?new OW(u,p):new OW(u);' +
      'var h=H(w);w.addEventListener("message",h);' +
      'return w;};' +
      'WebSocket.prototype=OW.prototype;WebSocket.CONNECTING=0;WebSocket.OPEN=1;' +
      'WebSocket.CLOSING=2;WebSocket.CLOSED=3;}' +
      '}catch(e){}})();';

    function installWorkerTap() {
      if (!window.Worker || window.__SMC_WORKER_TAP__) return;
      const NW = window.Worker;
      function makeTapped(url, opts) {
        try {
          const u = String(url);
          const rewriteable =
            u.slice(0, 5) === "blob:" ||
            u.slice(0, 1) === "/" ||
            u.indexOf(window.location.origin + "/") === 0;
          if (rewriteable) {
            const x = new XMLHttpRequest();
            x.open("GET", u, false); // sync — allowed on main thread
            x.send(null);
            const src = x.status === 200 || x.status === 0 ? x.responseText : null;
            if (typeof src === "string" && src.length > 0 && src.indexOf("__smcTap") === -1) {
              const blob = new Blob([SMC_WORKER_TAP_SRC + src], { type: "application/javascript" });
              const burl = URL.createObjectURL(blob);
              const w = new NW(burl, opts);
              w.addEventListener("message", (ev) => {
                try {
                  const d = ev && ev.data;
                  if (d && typeof d === "object" && typeof d.__smcTap === "string") {
                    feed.workerMsgs += 1;
                    smcTapString(d.__smcTap, null, "worker", 0);
                  }
                } catch (e) { /* ignore */ }
              });
              console.log("SMC: worker tap injected into", u.slice(0, 60));
              return w;
            }
          }
        } catch (e) { /* fall through to plain worker */ }
        const w2 = new NW(url, opts);
        try {
          w2.addEventListener("message", (ev) => {
            try {
              const d = ev && ev.data;
              if (d && typeof d === "object" && typeof d.__smcTap === "string") {
                feed.workerMsgs += 1;
                smcTapString(d.__smcTap, null, "worker", 0);
              }
            } catch (e) { /* ignore */ }
          });
        } catch (e) { /* ignore */ }
        return w2;
      }
      function WrappedWorker(url, opts) {
        return makeTapped(url, opts);
      }
      WrappedWorker.prototype = NW.prototype;
      try {
        window.Worker = WrappedWorker;
        window.__SMC_NATIVE_WORKER__ = NW;
        window.__SMC_WORKER_TAP__ = true;
      } catch (e) { /* ignore */ }
    }

    function installWebSocketHook() {
      if (window.__SMC_WS_HOOKED__) return;
      window.__SMC_WS_HOOKED__ = true;
      function HookedWebSocket(url, protocols) {
        const ws =
          protocols !== undefined
            ? new NativeWebSocket(url, protocols)
            : new NativeWebSocket(url);
        try {
          ws.addEventListener("message", (ev) => {
            try { onSocketMessage(ev.data); } catch { /* ignore */ }
          });
        } catch {
          /* ignore */
        }
        return ws;
      }
      HookedWebSocket.prototype = NativeWebSocket.prototype;
      window.__SMC_HOOKED_WS__ = HookedWebSocket;
      HookedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
      HookedWebSocket.OPEN = NativeWebSocket.OPEN;
      HookedWebSocket.CLOSING = NativeWebSocket.CLOSING;
      HookedWebSocket.CLOSED = NativeWebSocket.CLOSED;
      window.WebSocket = HookedWebSocket;
      console.log("SMC: WebSocket hook installed (new connections only)");
    }

    /* ---- Source 3: live-socket hunter (captures sockets opened BEFORE the bot) ---- */

    const smcLiveSockets = [];

    function smcAttachSocket(ws) {
      try {
        if (!(ws instanceof NativeWebSocket) || ws.__smcHooked) return false;
        ws.addEventListener("message", (ev) => {
          try { onSocketMessage(ev.data); } catch { /* ignore */ }
        });
        ws.__smcHooked = true;
        smcLiveSockets.push(ws);
        return true;
      } catch {
        return false;
      }
    }

    function smcCollectReactRoots() {
      const roots = [];
      const scanEl = (el) => {
        try {
          for (const k of Object.keys(el)) {
            if (k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")) {
              roots.push(el[k]);
            }
          }
        } catch { /* ignore */ }
      };
      for (const id of ["root", "app", "__next", "main", "wrapper"]) {
        const el = document.getElementById(id);
        if (el) scanEl(el);
      }
      if (roots.length === 0 && document.body) {
        const all = document.body.getElementsByTagName("*");
        for (let i = 0; i < all.length && i < 300; i++) {
          scanEl(all[i]);
          if (roots.length >= 4) break;
        }
      }
      return roots;
    }

    function huntExistingSockets() {
      let attached = 0;

      // (a) window globals — cheapest pass, always runs
      for (const k of Object.getOwnPropertyNames(window)) {
        if (k.startsWith("qx999") || k.startsWith("__SMC") || k.startsWith("QX999")) continue;
        let v;
        try { v = window[k]; } catch { continue; }
        if (v && typeof v === "object") {
          if (smcAttachSocket(v)) attached += 1;
        }
      }

      // (b) bounded BFS through React internals — only while we hold no socket
      if (smcLiveSockets.length === 0 || feed.ticks === 0) {
        const visited = new Set();
        const queue = [];
        for (const r of smcCollectReactRoots()) queue.push({ v: r, d: 0 });
        let qi = 0;
        let visits = 0;
        const MAX_VISITS = 4500;
        const MAX_DEPTH = 5;
        while (qi < queue.length && visits < MAX_VISITS) {
          const item = queue[qi++];
          const v = item.v;
          const d = item.d;
          if (v == null || d > MAX_DEPTH) continue;
          if (typeof v !== "object") continue;
          if (v instanceof NativeWebSocket) {
            if (smcAttachSocket(v)) attached += 1;
            continue;
          }
          if (v.nodeType || typeof v.nodeName === "string") {
            try {
              for (const k of Object.keys(v)) {
                if (k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")) {
                  queue.push({ v: v[k], d: d + 1 });
                }
              }
            } catch { /* ignore */ }
            continue;
          }
          if (visited.has(v)) continue;
          visited.add(v);
          visits += 1;
          if (Array.isArray(v)) {
            const n = Math.min(v.length, 60);
            for (let i = 0; i < n; i++) queue.push({ v: v[i], d: d + 1 });
            continue;
          }
          let keys;
          try { keys = Object.keys(v); } catch { continue; }
          if (keys.length > 150) keys = keys.slice(0, 150);
          for (const k of keys) {
            let cv;
            try { cv = v[k]; } catch { continue; }
            if (cv && typeof cv === "object") queue.push({ v: cv, d: d + 1 });
          }
        }
      }
      return attached;
    }

    /* ---- Early-socket adoption (Tampermonkey document-start mode) ---- */

    function adoptEarlySockets() {
      let n = 0;
      try {
        for (const ws of window.__SMC_EARLY_SOCKETS__ || []) {
          if (smcAttachSocket(ws)) n += 1;
        }
        const log = window.__SMC_EARLY_LOG__;
        if (log && log.length) {
          console.log("SMC: replaying", log.length, "buffered pre-load WS messages (instant warmup)");
          for (const item of log) {
            try {
              feed.wsThrottleAt = 0; // bypass throttle during replay
              onSocketMessage(item.d, item.t);
            } catch (e) {
              /* ignore */
            }
          }
        }
        // Replay payloads the prehook JSON.parse tap captured before bot boot
        const tapLog = window.__SMC_EARLY_TAP__;
        if (tapLog && tapLog.length) {
          const cutoff = Date.now(); // newer items were already delivered via the sink
          let m = 0;
          for (const it of tapLog) {
            if (it.t >= cutoff) continue;
            try {
              smcTapString(it.s, null, "early", it.t);
              m += 1;
            } catch (e) {
              /* ignore */
            }
          }
          if (m > 0) console.log("SMC: replayed", m, "pre-boot parsed payloads (instant warmup)");
        }
      } catch (e) {
        /* ignore */
      }
      return n;
    }

    /* ---- Source 4: universal DOM price hunter ----
     * Finds the live price node WITHOUT knowing its class names:
     * watches every price-like text node for 4s and locks onto
     * the one that updates most frequently (= the real ticker).
     */

    function looksLikePriceText(txt) {
      if (!txt || txt.length === 0 || txt.length > 16) return false;
      if (!/^[\d.,\s\u00a0\u2009\u202f+-]+$/.test(txt)) return false; // pure number, no $ % letters
      if (!/\d/.test(txt) || !/[.,]/.test(txt)) return false;
      return parsePriceText(txt) != null;
    }

    function collectPriceCandidates() {
      const out = [];
      if (!document.body) return out;
      const all = document.body.getElementsByTagName("*");
      for (let i = 0; i < all.length && out.length < 60; i++) {
        const el = all[i];
        const tag = el.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "INPUT" || tag === "TEXTAREA" || tag === "NOSCRIPT") continue;
        try {
          if (el.closest("#qx999-widget") || el.closest("#qx999-panel")) continue;
        } catch { /* ignore */ }
        if (el.children.length > 2) continue;
        const txt = (el.textContent || "").trim();
        if (!looksLikePriceText(txt)) continue;
        let r;
        try { r = el.getBoundingClientRect(); } catch { continue; }
        if (r.width === 0 || r.height === 0) continue;
        if (r.bottom < 0 || r.top > (window.innerHeight || 900)) continue;
        out.push(el);
      }
      return out;
    }

    function universalDomHunt() {
      const candidates = collectPriceCandidates();
      if (candidates.length === 0) {
        console.log("SMC: universal hunt — no price-like nodes visible");
        return false;
      }
      feed.huntUntil = Date.now() + 4500;
      const counts = new Map();
      const observers = [];
      for (const el of candidates) {
        try {
          const o = new MutationObserver(() => {
            counts.set(el, (counts.get(el) || 0) + 1);
          });
          o.observe(el, { characterData: true, childList: true, subtree: true });
          observers.push(o);
        } catch { /* ignore */ }
      }
      console.log("SMC: universal hunt watching", candidates.length, "price-like nodes for 4s…");
      setTimeout(() => {
        for (const o of observers) {
          try { o.disconnect(); } catch { /* ignore */ }
        }
        let best = null;
        let bestCount = 0;
        for (const entry of counts) {
          if (entry[1] >= bestCount) {
            bestCount = entry[1];
            best = entry[0];
          }
        }
        if (best && bestCount >= 2) {
          if (feed.priceObserver) {
            try { feed.priceObserver.disconnect(); } catch { /* ignore */ }
          }
          feed.priceEl = best;
          const obs = new MutationObserver(() => {
            const price = parsePriceText(best.textContent);
            if (price != null) feedTick(price, "dom");
          });
          obs.observe(best, { characterData: true, childList: true, subtree: true });
          feed.priceObserver = obs;
          const first = parsePriceText(best.textContent);
          if (first != null) feedTick(first, "dom");
          console.log("SMC: universal hunt LOCKED live price node (changed " + bestCount + "x in 4s)");
        } else {
          console.log("SMC: universal hunt — no node updated enough (best: " + bestCount + " changes)");
        }
      }, 4200);
      return true;
    }

    function candlesNeeded() {
      // Hard floor = longest indicator warmup: EMA slow (21) needs 21 closes,
      // Bollinger needs 20, RSI needs period+1. Exactly 21 for RSI(14) - no waste.
      return Math.max(21, (settings.rsiPeriod || 14) + 1, 20);
    }

    function feedStatusText() {
      if (feed.realMode) {
        return "feed: REAL " + feed.realPeriod + "s ×" + feed.candles.length;
      }
      if (feed.ticks > 0) {
        if (feed.source === "dom") return "feed: DOM live";
        if (feed.source === "ws") return "feed: WS live";
        return "feed: live";
      }
      if (DIRECT.authed) return "feed: DIRECT socket…";
      if (DIRECT.state === "authing" || DIRECT.state === "connecting") return "feed: direct connecting…";
      if (smcLiveSockets.length > 0) return "feed: socket hooked…";
      if (feed.priceEl) return "feed: price node locked…";
      return "feed: hunting…";
    }

    function feedStatusLine() {
      const parts = [feedStatusText(), feed.candles.length + "c", feed.ticks + " ticks"];
      if (feed.lastTickAt > 0) {
        parts.push(Math.max(0, Math.round((Date.now() - feed.lastTickAt) / 1000)) + "s ago");
      }
      // Channel counters: shows whether the QUOTEX protocol channels are alive
      const chans = [];
      if (feed.wsMsgs > 0) chans.push("msg" + feed.wsMsgs);
      if (feed.ohlcHits > 0) chans.push("ohlc" + feed.ohlcHits);
      if (feed.relHits > 0) chans.push("rel" + feed.relHits);
      if (feed.domTicks > 0) chans.push("dom" + feed.domTicks);
      if (feed.binFrames > 0) chans.push("bin" + feed.binFrames);
      if (DIRECT.authed) chans.push("direct✓");
      else if (DIRECT.state === "authing" || DIRECT.state === "connecting") chans.push("direct…");
      else if (DIRECT.state === "no-token") chans.push("direct:no-token");
      if (chans.length) parts.push(chans.join("/"));
      return parts.join(" · ");
    }

    /* ==================== INDICATORS ==================== */

    function calcRSI(closes, period) {
      if (closes.length < period + 1) return 50;
      const slice = closes.slice(-(period * 6 + 1)); // cap work
      let gains = 0;
      let losses = 0;
      for (let i = 1; i <= period; i++) {
        const d = slice[i] - slice[i - 1];
        if (d > 0) gains += d;
        else losses -= d;
      }
      let avgGain = gains / period;
      let avgLoss = losses / period;
      for (let i = period + 1; i < slice.length; i++) {
        const d = slice[i] - slice[i - 1];
        avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
      }
      if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
      const rs = avgGain / avgLoss;
      return 100 - 100 / (1 + rs);
    }

    function emaLast(values, period) {
      if (!values || values.length < period) return null;
      const k = 2 / (period + 1);
      let e = values[0];
      for (let i = 1; i < values.length; i++) {
        e = values[i] * k + e * (1 - k);
      }
      return e;
    }

    function calcBollinger(closes, period, mult) {
      if (closes.length < period) return null;
      const slice = closes.slice(-period);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance =
        slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / period;
      const sd = Math.sqrt(variance);
      return { mid: mean, upper: mean + mult * sd, lower: mean - mult * sd };
    }

    /* ---- Candle pattern detection (needs last two CLOSED candles) ---- */

    function candleBody(c) {
      return Math.abs(c.c - c.o);
    }
    function upperWick(c) {
      return c.h - Math.max(c.o, c.c);
    }
    function lowerWick(c) {
      return Math.min(c.o, c.c) - c.l;
    }

    function detectPattern(prev, last) {
      if (!prev || !last) return 0;
      const body = candleBody(last);
      const prevBody = candleBody(prev);
      const range = last.h - last.l;
      if (range <= 0 || body <= 0) return 0;

      // Bullish / bearish engulfing
      const bullEngulf =
        last.c > last.o &&
        prev.c < prev.o &&
        last.c >= prev.o &&
        last.o <= prev.c &&
        body > prevBody;
      const bearEngulf =
        last.c < last.o &&
        prev.c > prev.o &&
        last.c <= prev.o &&
        last.o >= prev.c &&
        body > prevBody;
      if (bullEngulf) return 1;
      if (bearEngulf) return -1;

      // Hammer (bullish pin) / shooting star (bearish pin)
      // Classic definition: wick >= 2x body, opposite wick <= body,
      // small body relative to total range.
      const hammer =
        lowerWick(last) >= 2 * body &&
        upperWick(last) <= body &&
        body / range < 0.4;
      const star =
        upperWick(last) >= 2 * body &&
        lowerWick(last) <= body &&
        body / range < 0.4;
      if (hammer) return 1;
      if (star) return -1;

      return 0;
    }

    /* ==================== SIGNAL ENGINE (CONFLUENCE VOTING) ====================
     * 5 independent votes: RSI, EMA trend, Bollinger reversal, candle pattern,
     * candle high/low sweep rejection.
     * A signal is valid when the winning side has >= settings.minVotes.
     */

    const signalState = {
      last: null,   // {dir, votes, confidence, reasons[], ts, candleT}
      block: null,  // human-readable "why not trading right now"
      evaluating: false,
      tradedCandleT: 0, // one trade per closed candle (prevents repeat-firing on 1m real candles)
    };

    function evaluateSignal() {
      if (signalState.evaluating) return signalState.last;
      signalState.evaluating = true;
      try {
        if (feed.current) {
          // Only closed candles are used; forming candle is excluded.
          if (feed.candles.length === 0 || feed.candles[feed.candles.length - 1].t !== feed.current.t) {
            // forming candle not yet pushed - fine
          }
        }
        const need = candlesNeeded();
        if (feed.candles.length < need) {
          signalState.last = null;
          signalState.block = "warming " + feed.candles.length + "/" + need;
          return null;
        }
        const candles = feed.candles;
        const closes = candles.map((c) => c.c);
        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];

        let up = 0;
        let down = 0;
        const reasons = [];

        // Vote 1: RSI reversal
        const rsi = calcRSI(closes, settings.rsiPeriod || 14);
        if (rsi <= 30) {
          up += 1;
          reasons.push("RSI " + rsi.toFixed(1) + " oversold");
        } else if (rsi >= 70) {
          down += 1;
          reasons.push("RSI " + rsi.toFixed(1) + " overbought");
        }

        // Vote 2: EMA trend
        const ef = emaLast(closes, settings.emaFast || 9);
        const es = emaLast(closes, settings.emaSlow || 21);
        if (ef != null && es != null) {
          if (ef > es) {
            up += 1;
            reasons.push("EMA uptrend");
          } else if (ef < es) {
            down += 1;
            reasons.push("EMA downtrend");
          }
        }

        // Vote 3: Bollinger edge reversal
        const bb = calcBollinger(closes, 20, 2);
        if (bb) {
          if (last.c <= bb.lower) {
            up += 1;
            reasons.push("BB lower touch");
          } else if (last.c >= bb.upper) {
            down += 1;
            reasons.push("BB upper touch");
          }
        }

        // Vote 4: Candle pattern (open vs close body analysis)
        const pat = detectPattern(prev, last);
        if (pat > 0) {
          up += 1;
          reasons.push("Bullish pattern");
        } else if (pat < 0) {
          down += 1;
          reasons.push("Bearish pattern");
        }

        // Vote 5: Candle high/low sweep rejection (S/R from recent extremes)
        const lookback = candles.slice(-11, -1); // previous 10 closed candles
        if (lookback.length >= 6) {
          let hi = -Infinity;
          let lo = Infinity;
          for (const c of lookback) {
            if (c.h > hi) hi = c.h;
            if (c.l < lo) lo = c.l;
          }
          if (last.l < lo && last.c > lo) {
            up += 1;
            reasons.push("HL low sweep reject");
          } else if (last.h > hi && last.c < hi) {
            down += 1;
            reasons.push("HL high sweep reject");
          }
        }

        if (up === down || Math.max(up, down) === 0) {
          signalState.last = null;
          signalState.block =
            Math.max(up, down) === 0
              ? "no votes fired (0 up / 0 down)"
              : "tied votes (" + up + " up / " + down + " down)";
          return null;
        }
        const dir = up > down ? "up" : "down";
        const votes = Math.max(up, down);
        signalState.block = null;
        signalState.last = {
          dir,
          votes,
          confidence: Math.round((votes / 5) * 100),
          reasons,
          ts: Date.now(),
          candleT: last.t,
        };
        return signalState.last;
      } finally {
        signalState.evaluating = false;
      }
    }

    function signalFreshAndValid() {
      const sig = signalState.last;
      if (!sig) return null;
      const ageMs = Date.now() - sig.ts;
      if (ageMs > settings.signalExpirySec * 1000) return null;
      if (sig.votes < settings.minVotes) return null;
      if (sig.candleT && sig.candleT === signalState.tradedCandleT) return null; // already traded this candle
      return sig;
    }

    /* ---- TREND-FOLLOWING FAST ENTRY (direction = "trend") ----
     * Follows the EMA trend instead of betting against it.
     * Trend: EMA fast vs EMA slow, confirmed on the previous bar too (no chop).
     * Entry triggers (fire IMMEDIATELY, no vote waiting):
     *   A) Pullback resume: candle dipped into the fast EMA zone, then closed
     *      back in the trend direction -> enter with the trend.
     *   B) Momentum continuation: two consecutive trend-direction candles
     *      riding the fast EMA, last one making a local high/low.
     * Uses the FORMING candle when available -> entries happen mid-candle, fast.
     */

    const trendState = {
      last: null,        // {dir, confidence, reason, ts, candleT}
      block: null,       // human-readable "why not trading right now"
      lastDir: null,     // "up" | "down" | null — live EMA trend direction
      tradedCandleT: 0,  // one entry per candle bucket
    };

    function evaluateTrendSignal() {
      const need = candlesNeeded();
      if (feed.candles.length < need) {
        trendState.last = null;
        trendState.block = "warming " + feed.candles.length + "/" + need;
        return null;
      }
      const closes = feed.candles.map((c) => c.c);
      const ef = emaLast(closes, settings.emaFast || 9);
      const es = emaLast(closes, settings.emaSlow || 21);
      if (ef == null || es == null || ef === es) {
        trendState.last = null;
        trendState.block = "indicators warming";
        return null;
      }

      // Stability: EMA order must agree on data WITHOUT the last close (no whipsaw)
      const efP = emaLast(closes.slice(0, -1), settings.emaFast || 9);
      const esP = emaLast(closes.slice(0, -1), settings.emaSlow || 21);
      if (efP == null || esP == null) {
        trendState.last = null;
        trendState.block = "indicators warming";
        return null;
      }
      // Chop guard: EMAs must be meaningfully separated
      const gap = Math.abs(ef - es) / es;
      if (gap < 0.00003) {
        trendState.last = null;
        trendState.block = "flat market (EMAs tight)";
        return null;
      }
      const trendUp = ef > es && efP > esP;
      const trendDown = ef < es && efP < esP;
      trendState.lastDir = trendUp ? "up" : trendDown ? "down" : null;
      if (!trendUp && !trendDown) {
        trendState.last = null;
        trendState.block = "EMAs mixed — no trend";
        return null;
      }

      // Fast entry: evaluate the FORMING candle when present (enters mid-candle)
      const ref = feed.current || feed.candles[feed.candles.length - 1];
      const refPrev = feed.current
        ? feed.candles[feed.candles.length - 1]
        : feed.candles[feed.candles.length - 2];
      if (!ref || !refPrev) {
        trendState.last = null;
        trendState.block = "candles building";
        return null;
      }

      const fastEma = settings.emaFast || 9;
      let dir = null;
      let reason = "";
      let confidence = 0;

      if (trendUp) {
        const pulledBack = ref.l <= ef;                     // dipped into fast EMA zone
        const bullResume = ref.c > ref.o && ref.c > ef;     // closed bullish above it
        const momo =
          ref.c > ref.o && refPrev.c > refPrev.o &&         // two bullish candles
          ref.c > refPrev.c &&                              // making a local high
          ref.c > ef && refPrev.c > efP;                    // riding the fast EMA
        if (pulledBack && bullResume) {
          dir = "up";
          reason = "trend UP · pullback resumed at EMA" + fastEma;
          confidence = 75;
        } else if (momo) {
          dir = "up";
          reason = "trend UP · momentum continuation";
          confidence = 70;
        }
      } else if (trendDown) {
        const pulledBack = ref.h >= ef;                     // bounced into fast EMA zone
        const bearResume = ref.c < ref.o && ref.c < ef;     // closed bearish below it
        const momo =
          ref.c < ref.o && refPrev.c < refPrev.o &&         // two bearish candles
          ref.c < refPrev.c &&                              // making a local low
          ref.c < ef && refPrev.c < efP;                    // riding the fast EMA
        if (pulledBack && bearResume) {
          dir = "down";
          reason = "trend DOWN · pullback resumed at EMA" + fastEma;
          confidence = 75;
        } else if (momo) {
          dir = "down";
          reason = "trend DOWN · momentum continuation";
          confidence = 70;
        }
      }

      if (!dir) {
        trendState.last = null;
        trendState.block =
          "trend " + (trendUp ? "▲ up" : "▼ down") + " · waiting entry setup";
        return null;
      }
      trendState.block = null;
      trendState.last = {
        dir,
        confidence,
        reason,
        ts: Date.now(),
        candleT: ref.t,
      };
      return trendState.last;
    }

    /* ==================== TRADE EXECUTION ==================== */

    let tradeButtonsCache = null;
    let tradeButtonsCacheAt = 0;

    function classifyButtonByColor(btn) {
      try {
        const bg = getComputedStyle(btn).backgroundColor || "";
        const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        const r = +m[1];
        const g = +m[2];
        const b = +m[3];
        if (g > r + 30 && g > b + 30) return "up";
        if (r > g + 30 && r > b + 30) return "down";
      } catch {
        /* ignore */
      }
      return null;
    }

    function getTradeButtons() {
      const now = Date.now();
      if (tradeButtonsCache && now - tradeButtonsCacheAt < 1500) {
        return tradeButtonsCache;
      }

      let up = null;
      let down = null;

      // Strategy 1: v1 known classes inside #trade-button
      const root = document.getElementById("trade-button");
      if (root) {
        up = root.querySelector("button.JQZcs");
        down = root.querySelector("button.twQq3");
      }

      // Strategy 2: known classes anywhere
      if (!up) up = document.querySelector("button.JQZcs");
      if (!down) down = document.querySelector("button.twQq3");

      // Strategy 3: colored buttons in the trade area / lower page
      if (!up || !down) {
        const candidates = document.querySelectorAll(
          '#trade-button button, [class*="trade" i] button, [class*="controls" i] button, [class*="actions" i] button'
        );
        for (const btn of candidates) {
          if (btn.closest("#qx999-widget") || btn.closest("#qx999-panel")) continue;
          const side = classifyButtonByColor(btn);
          if (side === "up" && !up) up = btn;
          if (side === "down" && !down) down = btn;
          if (up && down) break;
        }
      }

      // Strategy 4: last resort - any colored buttons in the lower viewport
      if (!up || !down) {
        const all = document.querySelectorAll("button");
        for (const btn of all) {
          if (btn.closest("#qx999-widget") || btn.closest("#qx999-panel")) continue;
          const rect = btn.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.55) continue;
          if (rect.width < 40 || rect.height < 25) continue;
          const side = classifyButtonByColor(btn);
          if (side === "up" && !up) up = btn;
          if (side === "down" && !down) down = btn;
          if (up && down) break;
        }
      }

      tradeButtonsCache = { up, down };
      tradeButtonsCacheAt = now;
      return tradeButtonsCache;
    }

    function invalidateButtonCache() {
      tradeButtonsCache = null;
      tradeButtonsCacheAt = 0;
    }

    /* ---- Amount input (needed for martingale / percent stake) ---- */

    let amountInputCache = null;

    function findAmountInput() {
      const selectors = [
        'input[name="amount"]',
        'input[id*="amount" i]',
        'input[placeholder*="amount" i]',
        '[class*="investment" i] input',
        '[data-testid*="amount" i] input',
        '[class*="amount" i] input',
      ];
      for (const sel of selectors) {
        let nodes;
        try {
          nodes = document.querySelectorAll(sel);
        } catch {
          continue;
        }
        for (const el of nodes) {
          if (!el || el.closest("#qx999-panel")) continue;
          const type = (el.getAttribute("type") || "text").toLowerCase();
          if (type !== "number" && type !== "text" && type !== "tel") continue;
          if (!el.offsetParent && el.getClientRects().length === 0) continue;
          return el;
        }
      }
      return null;
    }

    function setNativeValue(el, value) {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value");
      if (setter && setter.set) setter.set.call(el, String(value));
      else el.value = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function setAmount(value) {
      let el = amountInputCache;
      if (!el || !document.contains(el)) {
        el = findAmountInput();
        amountInputCache = el;
      }
      if (!el) {
        console.warn("SMC: amount input not found - stake stays at platform value");
        return false;
      }
      try {
        setNativeValue(el, value);
        const readBack = parseFloat(el.value);
        if (!Number.isFinite(readBack) || Math.abs(readBack - value) > 0.001) {
          console.warn("SMC: amount input did not accept value", value);
          return false;
        }
        return true;
      } catch (err) {
        console.warn("SMC: setAmount failed:", err && err.message);
        return false;
      }
    }

    /* ---- Balance reader (for results & % of balance) ---- */

    let balanceElCache = null;

    function findBalanceElement() {
      const selectors = [
        '[data-testid*="balance" i]',
        "#balance",
        '[class*="balance" i]',
        '[id*="balance" i]',
      ];
      for (const sel of selectors) {
        let nodes;
        try {
          nodes = document.querySelectorAll(sel);
        } catch {
          continue;
        }
        for (const el of nodes) {
          if (!el || el.closest("#qx999-widget") || el.closest("#qx999-panel")) continue;
          const txt = (el.textContent || "").replace(/\s/g, "");
          if (txt.length === 0 || txt.length > 40) continue;
          if (!/\d/.test(txt)) continue;
          return el;
        }
      }
      return null;
    }

    function readBalance() {
      let el = balanceElCache;
      if (!el || !document.contains(el)) {
        el = findBalanceElement();
        balanceElCache = el;
      }
      if (!el) return null;
      const m = (el.textContent || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
      if (!m) return null;
      const v = parseFloat(m[0]);
      return Number.isFinite(v) ? v : null;
    }

    /* ==================== MONEY MANAGEMENT ==================== */

    const money = {
      martStep: 0,          // current martingale step (consecutive losses)
    };

    function computeStake() {
      if (settings.stakeMode === "percent") {
        const bal = readBalance();
        if (bal != null && bal > 0) {
          const raw = (bal * settings.percentOfBalance) / 100;
          return Math.max(0.1, Math.round(raw * 100) / 100);
        }
        return settings.baseAmount;
      }
      if (settings.stakeMode === "martingale") {
        const raw =
          settings.baseAmount * Math.pow(settings.martMultiplier, money.martStep);
        return Math.max(0.1, Math.round(raw * 100) / 100);
      }
      return settings.baseAmount;
    }

    /* ==================== BOT STATE, RESULTS, STATS ==================== */

    const bot = {
      running: false,       // AUTO mode active
      armed: false,         // SEMI mode armed
      tradeInFlight: false,
      lastTradeAt: 0,
      stoppedByStopLoss: false,
      blockReason: "",      // visible "why:" diagnostic (set every controller tick)
      session: {
        wins: 0,
        losses: 0,
        unresolved: 0,
        pl: 0,
        trades: 0,
        streak: 0,          // + = win streak, - = loss streak
      },
    };

    function checkStopLoss() {
      if (settings.stopLoss <= 0) return;
      if (bot.session.pl <= -Math.abs(settings.stopLoss)) {
        bot.stoppedByStopLoss = true;
        stopBotInternal("STOP-LOSS HIT");
        console.warn(
          "SMC: STOP-LOSS hit at P/L", bot.session.pl.toFixed(2), "- bot stopped for your safety"
        );
      }
    }

    function resolveTrade(trade, delta) {
      bot.tradeInFlight = false;
      if (delta == null) {
        bot.session.unresolved += 1;
        console.log("SMC: trade result unknown (balance not readable)");
      } else if (delta > 0) {
        bot.session.wins += 1;
        bot.session.pl = Math.round((bot.session.pl + delta) * 100) / 100;
        bot.session.streak = bot.session.streak >= 0 ? bot.session.streak + 1 : 1;
        money.martStep = 0;
        console.log("SMC: WIN", "+" + delta.toFixed(2), "| P/L", bot.session.pl.toFixed(2));
      } else {
        bot.session.losses += 1;
        bot.session.pl = Math.round((bot.session.pl + delta) * 100) / 100;
        bot.session.streak = bot.session.streak <= 0 ? bot.session.streak - 1 : -1;
        if (settings.stakeMode === "martingale") {
          money.martStep = Math.min(money.martStep + 1, settings.martMaxSteps);
        }
        console.log("SMC: LOSS", delta.toFixed(2), "| P/L", bot.session.pl.toFixed(2));
      }
      bot.lastTradeAt = Date.now();
      checkStopLoss();
    }

    function trackResult(trade) {
      const startedAt = Date.now();
      const deadline = startedAt + (settings.expirySec + 5) * 1000;
      const poll = setInterval(() => {
        const bal = readBalance();
        const now = Date.now();
        // Early win detection: payout credited before expiry estimate
        if (bal != null && trade.balanceBefore != null) {
          const delta = bal - trade.balanceBefore;
          if (delta > 0.000001) {
            clearInterval(poll);
            resolveTrade(trade, delta);
            return;
          }
        }
        if (now >= deadline) {
          clearInterval(poll);
          if (bal != null && trade.balanceBefore != null) {
            const delta = bal - trade.balanceBefore;
            resolveTrade(trade, Math.abs(delta) < 0.000001 ? null : delta);
          } else {
            resolveTrade(trade, null);
          }
        }
      }, 500);
    }

    function fireTrade(dir, confidence, votes, reasons) {
      if (bot.tradeInFlight) return;
      const { up, down } = getTradeButtons();
      const btn = dir === "up" ? up : down;
      if (!btn) {
        invalidateButtonCache();
        bot.lastTradeAt = Date.now(); // throttle retry to cooldown interval
        console.warn("SMC: trade button not found for", dir, "- will retry");
        return;
      }
      const stake = computeStake();
      const amountOk = setAmount(stake);
      const balanceBefore = readBalance();

      bot.tradeInFlight = true;
      if (settings.mode !== "auto") bot.armed = false; // SEMI: one shot

      const entryDelayMs = Math.max(0, settings.entryDelaySec * 1000);
      setTimeout(() => {
        try {
          btn.click();
        } catch (err) {
          console.warn("SMC: click failed:", err && err.message);
          bot.tradeInFlight = false;
          return;
        }
        bot.session.trades += 1;
        bot.lastTradeAt = Date.now();
        console.log(
          "SMC TRADE:", dir.toUpperCase(),
          "| stake:", amountOk ? "$" + stake.toFixed(2) : "(platform)",
          settings.stakeMode === "martingale" ? "(marti step " + money.martStep + ")" : "",
          confidence != null
            ? "| signal " + confidence + "%" + (votes != null ? " (" + votes + " votes)" : "")
            : "",
          reasons && reasons.length ? "| " + reasons.join(", ") : "",
          balanceBefore != null ? "| bal " + balanceBefore.toFixed(2) : ""
        );
        const trade = { dir, stake, balanceBefore, openedAt: Date.now() };
        trackResult(trade);
      }, entryDelayMs);
    }

    /* ==================== CONTROLLER (MAIN LOOP) ==================== */

    function startBot() {
      closePanel();
      bot.stoppedByStopLoss = false;
      if (settings.mode === "semi") bot.armed = true;
      else bot.running = true;
      widget.classList.add("qx999-glow");
      scanOverlay.classList.add("qx999-scan-on");
      console.log(
        "SMC: bot started | mode:", settings.mode,
        "| dir:", settings.direction,
        "| stake:", settings.stakeMode, "$" + settings.baseAmount
      );
    }

    function stopBotInternal(reason) {
      bot.running = false;
      bot.armed = false;
      widget.classList.remove("qx999-glow");
      scanOverlay.classList.remove("qx999-scan-on");
      if (reason) console.log("SMC: bot stopped |", reason);
    }

    function controllerTick() {
      priceWatchdog();
      if (settings.direction === "signal") evaluateSignal();
      else if (settings.direction === "trend") evaluateTrendSignal();

      // Gate chain — the LAST gate that blocks becomes the visible "why:" reason
      bot.blockReason = "";
      if (bot.stoppedByStopLoss) {
        bot.blockReason = "stop-loss hit";
      } else {
        const wantTrade = bot.running || bot.armed;
        if (!wantTrade) {
          bot.blockReason = "paused — tap icon to start";
        } else if (bot.tradeInFlight) {
          bot.blockReason = "in trade…";
        } else if (panel.classList.contains("qx999-panel-open")) {
          bot.blockReason = "close settings panel to trade";
        } else {
          const sinceTrade = Date.now() - bot.lastTradeAt;
          if (sinceTrade < settings.cooldownSec * 1000) {
            bot.blockReason =
              "cooldown " + Math.ceil((settings.cooldownSec * 1000 - sinceTrade) / 1000) + "s";
          } else if (settings.direction === "signal") {
            const sig = signalFreshAndValid();
            if (!sig) {
              bot.blockReason = signalState.block || "waiting for confluence";
            } else {
              signalState.tradedCandleT = sig.candleT || 0;
              fireTrade(sig.dir, sig.confidence, sig.votes, sig.reasons);
            }
          } else if (settings.direction === "trend") {
            const tsig = trendState.last;
            if (!tsig) {
              bot.blockReason = trendState.block || "watching";
            } else if (Date.now() - tsig.ts > 3000) {
              bot.blockReason = "setup stale — re-checking"; // act fast: trigger must be fresh
            } else if (tsig.candleT === trendState.tradedCandleT) {
              bot.blockReason = "this candle already traded"; // one entry per candle
            } else {
              trendState.tradedCandleT = tsig.candleT;
              fireTrade(tsig.dir, tsig.confidence, null, [tsig.reason]);
            }
          } else {
            const dir =
              settings.direction === "random"
                ? Math.random() < 0.5
                  ? "up"
                  : "down"
                : settings.direction;
            fireTrade(dir, null, null, null);
          }
        }
      }
      renderStatus();
    }

    /* ==================== STATUS RENDERING ==================== */

    function renderStatus() {
      const s = bot.session;
      const decided = s.wins + s.losses;
      const wr = decided > 0 ? Math.round((s.wins / decided) * 100) : null;

      stLine1.textContent =
        "W " + s.wins + " · L " + s.losses + " · WR " + (wr == null ? "—" : wr + "%") +
        (s.unresolved > 0 ? " · ?" + s.unresolved : "");

      const plTxt =
        (s.pl >= 0 ? "+$" : "-$") + Math.abs(s.pl).toFixed(2);
      const martiTxt =
        settings.stakeMode === "martingale" && money.martStep > 0
          ? " · marti x" + money.martStep
          : "";
      stLine2.textContent = "P/L " + plTxt + martiTxt;
      stLine2.className =
        "qx999-st-line " + (s.pl >= 0 ? "qx999-st-pl-pos" : "qx999-st-pl-neg");

      stFeed.textContent = feedStatusLine();

      // Diagnostic line: live reason why the bot is not trading right now
      if (stDiag) {
        const running = bot.running || bot.armed;
        const tickAgeS =
          feed.lastTickAt > 0 ? Math.round((Date.now() - feed.lastTickAt) / 1000) : null;
        const dataDead = running && (feed.ticks === 0 || (tickAgeS != null && tickAgeS > 12));
        if (dataDead) {
          stDiag.textContent =
            "⚠ NO PRICE DATA " + (tickAgeS == null ? "(never)" : tickAgeS + "s") +
            " — console: __QX999_FEED_REPORT__()";
          stDiag.className = "qx999-st-diag qx999-alarm";
        } else {
          stDiag.textContent = bot.blockReason ? "why: " + bot.blockReason : "";
          stDiag.className = "qx999-st-diag";
        }
      }

      let txt = "IDLE";
      let cls = "";
      if (bot.stoppedByStopLoss) {
        txt = "STOP-LOSS HIT";
        cls = "qx999-st-danger";
      } else if (bot.tradeInFlight) {
        txt = "IN TRADE…";
        cls = "qx999-st-live";
      } else if (bot.running || bot.armed) {
        if (settings.direction === "trend") {
          const need = candlesNeeded();
          if (feed.candles.length < need) {
            txt = "WARMING " + feed.candles.length + "/" + need;
          } else {
            const t = trendState.last;
            const base = bot.running ? "TREND" : "ARMED";
            const arrow =
              trendState.lastDir === "up" ? " ▲" : trendState.lastDir === "down" ? " ▼" : "";
            txt = t
              ? base + (t.dir === "up" ? " ▲" : " ▼") + " " + t.confidence + "%"
              : base + arrow + " · watching";
            cls = "qx999-st-live";
          }
        } else if (settings.direction === "signal") {
          const need = candlesNeeded();
          if (feed.candles.length < need) {
            txt = "WARMING " + feed.candles.length + "/" + need;
          } else {
            const sig = signalState.last;
            const base = bot.running ? "SCANNING" : "ARMED";
            txt = sig
              ? base + " · " + sig.dir.toUpperCase() + " " + sig.confidence + "%"
              : base + "…";
            cls = "qx999-st-live";
          }
        } else {
          txt = (bot.running ? "AUTO " : "ARMED ") + settings.direction.toUpperCase();
          cls = "qx999-st-live";
        }
      } else if (s.trades > 0) {
        txt = "PAUSED";
      }
      stStatus.textContent = txt;
      stStatus.className = "qx999-st-status" + (cls ? " " + cls : "");

      let label = LABEL;
      if (bot.stoppedByStopLoss) label = "STOP HIT";
      else if (bot.tradeInFlight) label = "TRADING";
      else if (bot.running)
        label =
          settings.direction === "signal"
            ? "SCANNING"
            : settings.direction === "trend"
              ? "TREND"
              : "AUTO";
      else if (bot.armed) label = "ARMED";
      labelEl.textContent = label;
    }

    /* ==================== TAP LOGIC ==================== */

    let tapCount = 0;
    let tapSettleTimer = null;
    let lastTapAt = 0;

    function resetTapCounter() {
      tapCount = 0;
      if (tapSettleTimer) {
        clearTimeout(tapSettleTimer);
        tapSettleTimer = null;
      }
    }

    function registerTap() {
      if (panel.classList.contains("qx999-panel-open")) return;

      const now = Date.now();
      if (now - lastTapAt > TAP_SEQUENCE_MS) tapCount = 0;
      lastTapAt = now;
      tapCount += 1;

      if (tapSettleTimer) {
        clearTimeout(tapSettleTimer);
        tapSettleTimer = null;
      }

      if (tapCount >= TAP_REQUIRED) {
        resetTapCounter();
        openPanel();
        return;
      }

      tapSettleTimer = setTimeout(() => {
        tapSettleTimer = null;
        if (tapCount === 1) {
          if (bot.running || bot.armed) {
            stopBotInternal("manual stop");
          } else {
            startBot();
          }
        }
        tapCount = 0;
      }, TAP_SETTLE_MS);
    }

    /* ==================== DRAG (MOUSE + TOUCH) ==================== */

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const DRAG_THRESHOLD = 8;

    function clampPosition(left, top) {
      const rect = widget.getBoundingClientRect();
      const maxL = window.innerWidth - rect.width;
      const maxT = window.innerHeight - rect.height;
      return {
        left: Math.max(0, Math.min(left, maxL)),
        top: Math.max(0, Math.min(top, maxT)),
      };
    }

    function onPointerDown(clientX, clientY) {
      dragging = true;
      moved = false;
      const r = widget.getBoundingClientRect();
      startX = clientX;
      startY = clientY;
      startLeft = r.left;
      startTop = r.top;
      widget.style.transform = "none";
      widget.style.left = startLeft + "px";
      widget.style.top = startTop + "px";
    }

    function onPointerMove(clientX, clientY) {
      if (!dragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        moved = true;
      }
      const pos = clampPosition(startLeft + dx, startTop + dy);
      widget.style.left = pos.left + "px";
      widget.style.top = pos.top + "px";
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      if (!moved) {
        registerTap();
      }
    }

    widget.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onPointerDown(e.clientX, e.clientY);
    });

    widget.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        onPointerDown(t.clientX, t.clientY);
      },
      { passive: false }
    );

    document.addEventListener("mousemove", (e) => {
      onPointerMove(e.clientX, e.clientY);
    });

    document.addEventListener(
      "touchmove",
      (e) => {
        if (!dragging || e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        onPointerMove(t.clientX, t.clientY);
      },
      { passive: false }
    );

    document.addEventListener("mouseup", onPointerUp);
    document.addEventListener("touchend", onPointerUp);
    document.addEventListener("touchcancel", onPointerUp);

    /* ==================== CLEANUP & BOOT ==================== */

    const controllerTimer = setInterval(controllerTick, 300);

    window.__QX999_STOP__ = function () {
      stopBotInternal("removed");
      resetTapCounter();
      closePanel();
      clearInterval(controllerTimer);
      try {
        if (feed.priceObserver) feed.priceObserver.disconnect();
      } catch {
        /* ignore */
      }
      try {
        if (window.WebSocket === window.__SMC_HOOKED_WS__) {
          window.WebSocket = NativeWebSocket;
        }
      } catch {
        /* ignore */
      }
      window.__SMC_WS_HOOKED__ = false;
      /* restore native functions wrapped by the universal taps */
      try {
        if (window.__SMC_PARSE_TAP__ && NativeJSONParse) {
          JSON.parse = NativeJSONParse;
          window.__SMC_PARSE_TAP__ = false;
        }
      } catch {
        /* ignore */
      }
      try {
        if (window.__SMC_DECODE_TAP__ && NativeTextDecoderDecode) {
          TextDecoder.prototype.decode = NativeTextDecoderDecode;
          window.__SMC_DECODE_TAP__ = false;
        }
      } catch {
        /* ignore */
      }
      try {
        if (window.__SMC_FETCH_TAP__ && NativeFetchRef) {
          window.fetch = NativeFetchRef;
          window.__SMC_FETCH_TAP__ = false;
        }
      } catch {
        /* ignore */
      }
      try {
        if (window.__SMC_XHR_TAP__ && smcSavedXHR) {
          XMLHttpRequest.prototype.open = smcSavedXHR.open;
          XMLHttpRequest.prototype.send = smcSavedXHR.send;
          window.__SMC_XHR_TAP__ = false;
        }
      } catch {
        /* ignore */
      }
      try {
        if (window.__SMC_WORKER_TAP__ && window.__SMC_NATIVE_WORKER__) {
          window.Worker = window.__SMC_NATIVE_WORKER__;
          window.__SMC_WORKER_TAP__ = false;
        }
      } catch {
        /* ignore */
      }
      /* close the direct socket */
      try {
        if (DIRECT.ws) {
          try { DIRECT.ws.onclose = null; } catch (e2) { /* ignore */ }
          DIRECT.ws.close();
        }
      } catch {
        /* ignore */
      }
      DIRECT.ws = null;
      DIRECT.authed = false;
      DIRECT.state = "off";
      try {
        delete window.__SMC_TAP_SINK__;
      } catch {
        /* ignore */
      }
      widget.remove();
      scanOverlay.remove();
      backdrop.remove();
      panel.remove();
      style.remove();
      delete window.__QX999_ACTIVE__;
      delete window.__QX999_STOP__;
      delete window.__QX999_DEBUG__;
      delete window.__SMC_HOOKED_WS__;
      try {
        delete window.__QX999_FEED_REPORT__;
      } catch {
        /* ignore */
      }
      console.log("SMC removed.");
    };

    window.__QX999_DEBUG__ = {
      get feed() { return feed; },
      get bot() { return bot; },
      get settings() { return settings; },
      get money() { return money; },
      get signal() { return signalState.last; },
      get direct() { return DIRECT; },
      get trend() { return trendState; },
      stats() { return { ...bot.session }; },
      report() { return feedReport(); },
    };
    window.__QX999_FEED_REPORT__ = feedReport;

    /* Taps FIRST so payloads parsed during boot replay are already captured */
    installUniversalTaps();
    smcInstallFrameTaps();
    installWebSocketHook();
    const earlyAdopted = adoptEarlySockets();
    const bootSockets = huntExistingSockets();
    if (earlyAdopted > 0) console.log("SMC: adopted", earlyAdopted, "pre-load socket(s)");
    if (bootSockets > 0) console.log("SMC: socket hunter found", bootSockets, "existing WebSocket(s) at boot");
    setTimeout(() => {
      if (!attachPriceWatcher()) {
        console.log("SMC: classic price selectors found nothing — universal DOM hunt + socket hunter will keep retrying every few seconds");
        universalDomHunt();
      }
    }, 800);
    syncPanelUI();

    const warmupMin = Math.ceil((candlesNeeded() * settings.candleSec) / 60);
    console.log(
      "SMC v2.5 TREND loaded — universal data taps ON (captures prices from sockets opened BEFORE the bot)" +
      " | 1 tap: start/stop | 3 taps: settings",
      "| mode:", settings.mode,
      "| dir:", settings.direction,
      "| votes:", settings.minVotes + "/5",
      "| candle:", settings.candleSec + "s",
      "| stake:", settings.stakeMode, "$" + settings.baseAmount,
      "| SL:", settings.stopLoss === 0 ? "off" : "$" + settings.stopLoss
    );
    console.log(
      "SMC v2.5: if the widget ever shows NO PRICE DATA, run __QX999_FEED_REPORT__() in this console and send me the output — it pinpoints the exact blocked channel. Also switch asset once (A→B→A) to trigger a fresh candle-history fetch."
    );
    console.log(
      "SMC: signal engine needs " + candlesNeeded() +
      " closed candles (≈" + warmupMin + " min warmup at " + settings.candleSec +
      "s — or INSTANT if the platform sends real candle history)."
    );
    console.log("SMC: RISK WARNING — no bot can guarantee wins. Test on DEMO first.");
  }

  showPasswordGate(initQX999);
})();
