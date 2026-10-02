// ==UserScript==
// @name         SMC Quotex Autobot v2.2
// @namespace    smc-quotex
// @version      2.2
// @description  SMC signal engine (RSI+EMA+BB+Patterns confluence) with auto/semi trading, martingale, stop-loss and win-rate dashboard. DEMO TEST FIRST — no profit guarantee.
// @author       SMC
// @match        *://*.quotex.io/*
// @match        *://quotex.io/*
// @match        *://*.qxbroker.com/*
// @match        *://qxbroker.com/*
// @match        *://*.quotex.com/*
// @match        *://quotex.com/*
// ^ If your QUOTEX mirror uses another domain, copy a @match line above
//   and change it to your mirror domain, e.g.  *://*.my-mirror.com/*
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==
(function () {
  'use strict';

  /* ---- SMC document-start prehook: capture the page WebSocket from birth ---- */
  (function () {
    'use strict';
    if (window.__SMC_PREHOOK__) return;
    window.__SMC_PREHOOK__ = true;
    var NativeWS = window.WebSocket;
    window.__SMC_EARLY_SOCKETS__ = [];
    window.__SMC_EARLY_LOG__ = [];
    function SMCPrehookWS(url, protocols) {
      var ws = protocols !== undefined ? new NativeWS(url, protocols) : new NativeWS(url);
      try {
        ws.addEventListener("message", function (ev) {
          try {
            if (typeof ev.data === "string" && ev.data.length <= 30000) {
              var log = window.__SMC_EARLY_LOG__;
              log.push({ d: ev.data, t: Date.now() });
              if (log.length > 400) log.shift();
            }
          } catch (e) {}
        });
        window.__SMC_EARLY_SOCKETS__.push(ws);
      } catch (e) {}
      return ws;
    }
    SMCPrehookWS.prototype = NativeWS.prototype;
    SMCPrehookWS.CONNECTING = NativeWS.CONNECTING;
    SMCPrehookWS.OPEN = NativeWS.OPEN;
    SMCPrehookWS.CLOSING = NativeWS.CLOSING;
    SMCPrehookWS.CLOSED = NativeWS.CLOSED;
    window.WebSocket = SMCPrehookWS;
    window.__SMC_HOOKED_WS__ = SMCPrehookWS;
  })();

  /* ---- Full bot: runs once the page DOM is ready ---- */
  function __smcBoot__() {
    try {
      /**
       * ============================================================
       *  SMC QUOTEX AUTO BOT v2.0 — browser console script
       *  Paste the entire file into DevTools Console (F12) on the
       *  QUOTEX trading platform page, then press Enter.
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
          const STORAGE_KEY = "qx999_settings_v3"; // v3: fast-signal defaults
          const TAP_REQUIRED = 3;
          const TAP_SETTLE_MS = 380;
          const TAP_SEQUENCE_MS = 650;

          const defaults = {
            mode: "auto",            // "auto" | "semi"
            direction: "signal",     // "signal" | "up" | "down" | "random"
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
              direction: ["signal", "up", "down", "random"].includes(s.direction)
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
                <button type="button" data-val="signal">SIGNAL</button>
                <button type="button" data-val="up">UP</button>
                <button type="button" data-val="down">DOWN</button>
                <button type="button" data-val="random">RANDOM</button>
              </div>
              <p class="qx999-subhint">SIGNAL = confluence engine decides UP/DOWN (recommended).</p>
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
                <button type="button" data-val="2">2 / 4</button>
                <button type="button" data-val="3">3 / 4</button>
                <button type="button" data-val="4">4 / 4</button>
              </div>
              <p class="qx999-subhint">RSI + EMA trend + Bollinger + candle pattern vote. More votes = stricter filter.</p>
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
            settings.direction = ["signal", "up", "down", "random"].includes(pending.direction)
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
            inBase, inStopLoss, inMult, inMartSteps, inPercent,
          ].forEach((el) => el.addEventListener("keydown", onSettingsEnter));

          bindPanelAction(backdrop, closePanel);

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
            </div>
          `;
          document.body.appendChild(widget);

          const labelEl = widget.querySelector("#qx999-label");
          const stStatus = widget.querySelector("#qx999-st-status");
          const stLine1 = widget.querySelector("#qx999-st-line1");
          const stLine2 = widget.querySelector("#qx999-st-line2");
          const stFeed = widget.querySelector("#qx999-st-feed");

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

            const bucketMs = settings.candleSec * 1000;
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

          function onSocketMessage(data, ts) {
            if (typeof data !== "string" || data.length > 30000) return;
            const ch = data[0];
            if (ch !== "{" && ch !== "[") return;
            let parsed;
            try {
              parsed = JSON.parse(data);
            } catch {
              return;
            }
            const out = { price: null, count: 0 };
            extractWsPrice(parsed, 0, out);
            if (out.price == null) return;
            const now = ts > 0 ? ts : Date.now();
            if (ts > 0) {
              // replayed history — no throttle, no DOM priority
              feedTick(out.price, "ws", ts);
              return;
            }
            if (now - feed.wsThrottleAt < 250) return; // throttle WS ticks
            feed.wsThrottleAt = now;
            if (feed.source === "dom" && now - feed.lastTickAt < 15000) return; // DOM wins
            feedTick(out.price, "ws");
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
                  } catch { /* ignore */ }
                }
              }
            } catch { /* ignore */ }
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
            if (feed.ticks > 0) {
              if (feed.source === "dom") return "feed: DOM live";
              if (feed.source === "ws") return "feed: WS live";
              return "feed: live";
            }
            if (smcLiveSockets.length > 0) return "feed: socket hooked…";
            if (feed.priceEl) return "feed: price node locked…";
            return "feed: hunting…";
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
           * 4 independent votes: RSI, EMA trend, Bollinger reversal, candle pattern.
           * A signal is valid when the winning side has >= settings.minVotes.
           */

          const signalState = {
            last: null,   // {dir, votes, confidence, reasons[], ts}
            evaluating: false,
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

              // Vote 4: Candle pattern
              const pat = detectPattern(prev, last);
              if (pat > 0) {
                up += 1;
                reasons.push("Bullish pattern");
              } else if (pat < 0) {
                down += 1;
                reasons.push("Bearish pattern");
              }

              if (up === down || Math.max(up, down) === 0) {
                signalState.last = null;
                return null;
              }
              const dir = up > down ? "up" : "down";
              const votes = Math.max(up, down);
              signalState.last = {
                dir,
                votes,
                confidence: Math.round((votes / 4) * 100),
                reasons,
                ts: Date.now(),
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
            return sig;
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
                confidence != null ? "| signal " + confidence + "%" + " (" + votes + " votes)" : "",
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
            renderStatus();

            if (bot.stoppedByStopLoss) return;
            const wantTrade = bot.running || bot.armed;
            if (!wantTrade || bot.tradeInFlight) return;
            if (panel.classList.contains("qx999-panel-open")) return;
            if (Date.now() - bot.lastTradeAt < settings.cooldownSec * 1000) return;

            if (settings.direction === "signal") {
              const sig = signalFreshAndValid();
              if (!sig) return;
              fireTrade(sig.dir, sig.confidence, sig.votes, sig.reasons);
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

            stFeed.textContent =
              feedStatusText() + " · " + feed.candles.length + "c · " + feed.ticks + " ticks";

            let txt = "IDLE";
            let cls = "";
            if (bot.stoppedByStopLoss) {
              txt = "STOP-LOSS HIT";
              cls = "qx999-st-danger";
            } else if (bot.tradeInFlight) {
              txt = "IN TRADE…";
              cls = "qx999-st-live";
            } else if (bot.running || bot.armed) {
              if (settings.direction === "signal") {
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
              label = settings.direction === "signal" ? "SCANNING" : "AUTO";
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
            widget.remove();
            scanOverlay.remove();
            backdrop.remove();
            panel.remove();
            style.remove();
            delete window.__QX999_ACTIVE__;
            delete window.__QX999_STOP__;
            delete window.__QX999_DEBUG__;
            delete window.__SMC_HOOKED_WS__;
            console.log("SMC removed.");
          };

          window.__QX999_DEBUG__ = {
            get feed() { return feed; },
            get bot() { return bot; },
            get settings() { return settings; },
            get money() { return money; },
            get signal() { return signalState.last; },
            stats() { return { ...bot.session }; },
          };

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
            "SMC v2.2 loaded — 1 tap: start/stop | 3 taps: settings",
            "| mode:", settings.mode,
            "| dir:", settings.direction,
            "| votes:", settings.minVotes + "/4",
            "| candle:", settings.candleSec + "s",
            "| stake:", settings.stakeMode, "$" + settings.baseAmount,
            "| SL:", settings.stopLoss === 0 ? "off" : "$" + settings.stopLoss
          );
          console.log(
            "SMC: signal engine needs " + candlesNeeded() +
            " closed candles (≈" + warmupMin + " min warmup at " + settings.candleSec + "s)."
          );
          console.log("SMC: RISK WARNING — no bot can guarantee wins. Test on DEMO first.");
        }

        showPasswordGate(initQX999);
      })();

    } catch (e) { console.error('SMC bot error:', e); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __smcBoot__);
  } else {
    __smcBoot__();
  }
})();
