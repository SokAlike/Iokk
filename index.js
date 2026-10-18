(function () {
  if (window.__QX_MANE_EXTENSION__) {
    return;
  }
  window.__QX_MANE_EXTENSION__ = true;
  // Persistent notice: this script is not a broker account switcher.
  try {
    const addSimulationNotice = () => {
      if (!document.body || document.getElementById("qx-simulation-notice")) return;
      const notice = document.createElement("div");
      notice.id = "qx-simulation-notice";
      notice.textContent = "SIMULATION / TEST SCRIPT — NOT A REAL LIVE ACCOUNT";
      Object.assign(notice.style, { position: "fixed", top: "0", left: "0", right: "0", zIndex: "2147483647", padding: "7px 10px", background: "#7c2d12", color: "#fff", font: "700 12px/1.3 Arial,sans-serif", textAlign: "center", pointerEvents: "none" });
      document.body.appendChild(notice);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addSimulationNotice, { once: true });
    else addSimulationNotice();
  } catch (_) {}

  const vLSsvgClassiconprofilel = "<svg class=\"icon-profile-level-standart\"><use xlink:href=\"/profile/images/spritemap.svg#icon-profile-level-standart\"></use></svg>";
  const vLSsvgClassiconprofilel2 = "<svg class=\"icon-profile-level-pro\"><use xlink:href=\"/profile/images/spritemap.svg#icon-profile-level-pro\"></use></svg>";
  const vLSsvgClassiconprofilel3 = "<svg class=\"icon-profile-level-vip\"><use xlink:href=\"/profile/images/spritemap.svg#icon-profile-level-vip\"></use></svg>";
  const vO = {
    STANDARD: {
      href: "/profile/images/spritemap.svg#icon-profile-level-standart",
      class: "icon-profile-level-standart"
    },
    PRO: {
      href: "/profile/images/spritemap.svg#icon-profile-level-pro",
      class: "icon-profile-level-pro"
    },
    VIP: {
      href: "/profile/images/spritemap.svg#icon-profile-level-vip",
      class: "icon-profile-level-vip"
    }
  };
  const vLSTraderNiloyX = "Trader niloy x";
  const vLSrootDivDivUFs_mapp__ = "#root > div > div.UFs_m.app__page.bdVZy > header > div.RyAkb > div.QE4Zb.Mblsx.GsbWf > div.p0Ijl.Qx5RW > ul.IkdIG > li > div.Xun17 > div.OCZRh > div.nKm6H";
  const vLSrootDivDivUFs_mapp__2 = "#root > div > div.UFs_m.app__page.bdVZy > header > div.RyAkb > div.QE4Zb.Mblsx.GsbWf > div.p0Ijl.Qx5RW > ul.IkdIG > li > div.Xun17 > div.OCZRh > div.nKm6H > svg";
  const vLSrootDivAsideFczWcapp = "#root > div > aside.FczWc.app__sidepanel.U6IJq.HGMSN.S0jcI > div.M_p_O > div.tlUK7";
  const vLSrootDivAsideFczWcapp2 = "#root > div > aside.FczWc.app__sidepanel.U6IJq.HGMSN.S0jcI > div.M_p_O > div.xQvJK > div.egHS4 > div.c_7BP";
  const vLSrootDivAsideFczWcapp3 = "#root > div > aside.FczWc.app__sidepanel.U6IJq.HGMSN.S0jcI > div.M_p_O > div.xQvJK > div.egHS4 > div.DRWB2";
  const vLS0faf59 = "#0faf59";
  const vLN2 = 2;
  const vLSQx5RW = "Qx5RW";
  const vLSUlIkdIGDivLiRDtBnUlI = "ul.IkdIG > div > li.RDtBn, ul.IkdIG li.RDtBn";
  const vLS$50000 = "$500.00";
  const vLSQx_trusted_live_bala = "qx_trusted_live_balance";
  const vLSQx_header_balance = "qx_header_balance";
  const vLSrootDivDivUFs_mapp__3 = "#root > div > div.UFs_m.app__page.bdVZy > header > div.q04vx > div";
  const vLSrootDivappappfixedan = "#root > div.app.app--fixed.animate > div.UFs_m.app__page.bdVZy > main > div.q04vx.o2msZ > picture > img";
  const vLSLive = "Live";
  const vLSLiveAccount = "Live Account";
  const vLN768 = 768;
  const vLSrootDivDivUFs_mapp__4 = "#root > div > div.UFs_m.app__page.bdVZy > header > div.RyAkb > div.QE4Zb > div > div.qKWSR";
  function f() {
    const v = String(location.hostname || "").toLowerCase();
    const v2 = String(location.pathname || "").replace(/\/+$/, "") || "/";
    const v3 = v2.match(/^\/([a-z]{2})(?=\/(?:demo-)?trade(?:\/|$))/i);
    const v4 = /(^|\.)qxbroker\.com$/i.test(v) || !!v3;
    const v5 = v4 ? "/" + (v3 && v3[1] || "en").toLowerCase() : "";
    const v6 = v5 + "/trade";
    const v7 = v5 + "/demo-trade";
    return {
      isIndiaSite: v4,
      locale: v5,
      LIVE_PATH: v6,
      DEMO_PATH: v7,
      LIVE_TRADE: location.origin + v6,
      DEMO_TRADE: location.origin + v7,
      LIVE_TITLE: "Live trading | Quotex"
    };
  }
  const vF = f();
  const v8 = String(location.pathname || "").replace(/\/+$/, "").toLowerCase();
  const v9 = v8.endsWith("/demo-trade");
  const v10 = (v8 === vF.LIVE_PATH || /(^|\/)trade$/.test(v8)) && !v9;
  const vA = ["https://binaryqx.pro", "https://www.binaryqx.pro", "http://200.234.32.148"];
  const v11 = vA[0];
  const vLSHttpsipostimgcc1zbGb = "https://i.postimg.cc/1zbGbpxc/photo-2026-06-18-03-15-17.jpg";
  const vLSHttpstmetraderniloyx = "https://t.me/traderniloyx";
  const vLSHttpstmeTrader_niloy = "https://t.me/Trader_niloyx";
  const vLSTrader_niloyx = "@Trader_niloyx";
  const vLSQx_quotex_license_ke = "qx_quotex_license_key";
  const vLSQx_quotex_device_id = "qx_quotex_device_id";
  const vLSQx_quotex_license_ac = "qx_quotex_license_active";
  const vLSQx_quotex_license_re = "qx_quotex_license_reason";
  const vLSQx_quotex_last_check = "qx_quotex_last_check";
  const vLN120000 = 120000;
  const vLSQx_panel_lb_name = "qx_panel_lb_name";
  const vLSQx_panel_lb_seed = "qx_panel_lb_seed";
  const vLSQx_panel_demo_bal = "qx_panel_demo_bal";
  const vLSrootDivDivUFs_mapp__5 = "#root > div > div.UFs_m.app__page.bdVZy > header > div.RyAkb > div.QE4Zb.Mblsx > div.p0Ijl.Qx5RW > ul.IkdIG > div > li:nth-child(2) > div.WjlOy > b";
  let v12 = localStorage.getItem(vLSQx_panel_lb_name) || "";
  let vF2 = (() => {
    const v13 = localStorage.getItem(vLSQx_panel_demo_bal);
    if (v13 == null || v13 === "") {
      return null;
    }
    const vParseFloat = parseFloat(v13);
    if (!Number.isFinite(vParseFloat) || vParseFloat < 0) {
      return null;
    }
    return "$" + vParseFloat.toFixed(2);
  })();
  let v14 = null;
  let v15 = null;
  let v16 = false;
  let v17 = false;
  function f2(p) {
    const v18 = String(p || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12);
    if (v18.length !== 12) {
      return v18;
    }
    return v18.slice(0, 4) + "-" + v18.slice(4, 8) + "-" + v18.slice(8, 12);
  }
  function f3(p2) {
    const vF22 = f2(p2);
    if (/^[A-Z]{4}-[A-Z]{4}-[A-Z]{4}$/.test(vF22)) {
      return vF22;
    } else {
      return "";
    }
  }
  function f4() {
    try {
      let v19 = localStorage.getItem(vLSQx_quotex_device_id);
      if (!v19) {
        v19 = "qx_" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
        localStorage.setItem(vLSQx_quotex_device_id, v19);
      }
      return v19;
    } catch {
      return "unknown-device";
    }
  }
  function f5() {
    const v20 = navigator.userAgent || "";
    let vLSUnknown = "Unknown";
    if (/Edg\//.test(v20)) {
      vLSUnknown = "Edge";
    } else if (/OPR\/|Opera\//.test(v20)) {
      vLSUnknown = "Opera";
    } else if (/Firefox\//.test(v20)) {
      vLSUnknown = "Firefox";
    } else if (/Chrome\//.test(v20) && !/Chromium/.test(v20)) {
      vLSUnknown = "Chrome";
    } else if (/Safari\//.test(v20) && !/Chrome\//.test(v20)) {
      vLSUnknown = "Safari";
    }
    let vLSUnknown2 = "Unknown";
    if (/Windows NT 10|Windows NT 11/.test(v20)) {
      vLSUnknown2 = "Windows 10/11";
    } else if (/Windows/.test(v20)) {
      vLSUnknown2 = "Windows";
    } else if (/Android/.test(v20)) {
      const v21 = v20.match(/Android\s([\d.]+)/);
      vLSUnknown2 = v21 ? "Android " + v21[1] : "Android";
    } else if (/iPhone|iPad/.test(v20)) {
      vLSUnknown2 = "iOS";
    } else if (/Mac OS X/.test(v20)) {
      vLSUnknown2 = "macOS";
    } else if (/Linux/.test(v20)) {
      vLSUnknown2 = "Linux";
    }
    return {
      browser: vLSUnknown,
      os: vLSUnknown2,
      type: /Mobile|Android|iPhone|iPad/.test(v20) ? "Mobile" : "Desktop",
      screen: window.screen && window.screen.width && window.screen.height ? window.screen.width + "x" + window.screen.height : "N/A",
      user_agent: v20
    };
  }
  function f6(p3, p4) {
    return new Promise((p5, p6) => {
      const vSetTimeout = setTimeout(() => p6(new Error("timeout")), p4);
      p3.then(p7 => {
        clearTimeout(vSetTimeout);
        p5(p7);
      }, p8 => {
        clearTimeout(vSetTimeout);
        p6(p8);
      });
    });
  }
  async function f7() {
    const vA2 = ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json"];
    for (let vLN0 = 0; vLN0 < vA2.length; vLN0++) {
      try {
        const v22 = await f6(fetch(vA2[vLN0], {
          cache: "no-store",
          mode: "cors"
        }), 800);
        const v23 = await v22.json();
        const v24 = v23 && v23.ip || "";
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v24)) {
          return v24;
        }
      } catch {}
    }
    return "";
  }
  function f8(p9, p10, p11, p12) {
    const v25 = typeof GM !== "undefined" && GM.xmlHttpRequest || (typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null);
    if (!v25) {
      return Promise.reject(new Error("no_gm"));
    }
    return new Promise((p13, p14) => {
      v25({
        method: p10,
        url: p9,
        headers: p11 || {},
        data: p12 || undefined,
        timeout: 12000,
        anonymous: true,
        onload: p15 => {
          try {
            p13(JSON.parse(p15.responseText || "{}"));
          } catch {
            p13({
              ok: false,
              active: false,
              error: "bad_response"
            });
          }
        },
        onerror: () => p14(new Error("gm_network")),
        ontimeout: () => p14(new Error("timeout"))
      });
    });
  }
  async function f9(p16, p17, p18, p19) {
    const vO2 = {
      method: p17,
      headers: p18,
      body: p19 || undefined,
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer"
    };
    const v26 = await f6(fetch(p16, vO2), 10000);
    try {
      return await v26.json();
    } catch {
      return {
        ok: false,
        active: false,
        error: "bad_response"
      };
    }
  }
  async function f10(p20, p21, p22) {
    const v27 = vA.map(p23 => String(p23).replace(/\/$/, "") + p20);
    const v28 = location.protocol === "https:";
    let v29 = null;
    for (let vLN02 = 0; vLN02 < v27.length; vLN02++) {
      const v30 = v27[vLN02];
      const v31 = v30.indexOf("http://") === 0;
      if (!v28 || !v31) {
        try {
          return await f9(v30, "POST", p21, p22);
        } catch (e) {
          v29 = e;
        }
      }
      try {
        return await f8(v30, "POST", p21, p22);
      } catch (e2) {
        v29 = e2;
      }
    }
    throw v29 || new Error("server_unreachable");
  }
  function f11() {
    try {
      const vF3 = f3(localStorage.getItem(vLSQx_quotex_license_ke));
      if (!vF3) {
        return false;
      }
      if (localStorage.getItem(vLSQx_quotex_license_ac) !== "1") {
        return false;
      }
      const v32 = localStorage.getItem(vLSQx_quotex_license_re) || "";
      if (v32 === "blocked" || v32 === "not_found") {
        return false;
      }
      if (v32 === "device_limit" || v32 === "device_limit_exceeded") {
        return false;
      }
      return v32 === "ok";
    } catch {
      return false;
    }
  }
  function f12(p24) {
    v17 = !!p24;
  }
  function f13(p25, p26, p27) {
    try {
      if (p27) {
        localStorage.setItem(vLSQx_quotex_license_ke, p27);
      }
      localStorage.setItem(vLSQx_quotex_license_ac, p25 ? "1" : "0");
      localStorage.setItem(vLSQx_quotex_license_re, p26 || (p25 ? "ok" : "inactive"));
      localStorage.setItem(vLSQx_quotex_last_check, String(Date.now()));
    } catch {}
  }
  function f14(p28) {
    if (p28 === "blocked") {
      return "License blocked on server";
    }
    if (p28 === "not_found") {
      return "License not found or deleted";
    }
    if (p28 === "device_limit" || p28 === "device_limit_exceeded") {
      return "Device limit reached";
    }
    if (p28 === "server_unreachable") {
      return "License server unreachable";
    }
    if (p28 === "permission_needed") {
      return "Click Allow, then Verify again";
    }
    return "Invalid or inactive license";
  }
  function f15(p29) {
    if (!p29) {
      return "Verification failed";
    }
    if (p29.error === "invalid_key_format") {
      return "Invalid license key";
    }
    if (p29.reason === "not_found") {
      return "License not found";
    }
    if (p29.reason === "blocked") {
      if (p29.auto_blocked) {
        return "Device limit reached";
      } else {
        return "License blocked";
      }
    }
    if (p29.error === "permission_needed") {
      return "Click Allow, then Verify again";
    }
    return f14(p29.reason || "inactive");
  }
  async function f16(p30) {
    const SIMPLE_LICENSE_KEY = "SOKA-LIKE-OKOK";
    const vF32 = String(p30 || localStorage.getItem(vLSQx_quotex_license_ke) || "").trim();
    if (vF32 !== SIMPLE_LICENSE_KEY) {
      f13(false, "invalid_key");
      f12(false);
      return false;
    }
    f13(true, "ok", SIMPLE_LICENSE_KEY);
    f12(true);
    return true;
  }
  function f17() {
    if (v14) {
      v14();
    }
    if (typeof window.__qxRefreshLicenseUi === "function") {
      window.__qxRefreshLicenseUi(true);
    }
  }
  function f18() {
    if (v14) {
      v14();
    }
    if (typeof window.__qxRefreshLicenseUi === "function") {
      window.__qxRefreshLicenseUi(false);
    }
  }
  function f19() {}
  let v36 = null;
  let v37 = null;
  let vLN03 = 0;
  function f20() {
    try {
      window.location.assign(vLSHttpstmeTrader_niloy);
    } catch (e3) {
      window.location.href = vLSHttpstmeTrader_niloy;
    }
  }
  function f21() {
    if (v36) {
      clearTimeout(v36);
      v36 = null;
    }
    if (v37) {
      clearInterval(v37);
      v37 = null;
    }
    const v38 = document.getElementById("qx-alert-root");
    if (v38) {
      v38.classList.remove("show");
    }
  }
  function f22() {
    if (document.getElementById("qx-alert-root")) {
      return;
    }
    const v39 = document.createElement("style");
    v39.textContent = "\n#qx-alert-root{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;background:rgba(8,15,30,.85);backdrop-filter:blur(10px);padding:16px;font-family:Inter,Segoe UI,system-ui,sans-serif;opacity:0;transition:opacity .25s ease}\n#qx-alert-root.show{display:flex!important;opacity:1}\n.qx-alert-card{width:min(360px,94vw);background:#141a28;border:1px solid #2a3550;overflow:hidden;box-shadow:0 28px 70px #000}\n.qx-alert-top{padding:22px 16px 16px;text-align:center;color:#fff}\n.qx-alert-top.wrong{background:#dc2626}\n.qx-alert-top.blocked{background:#7f1d1d}\n.qx-alert-icon{width:52px;height:52px;margin:0 auto 10px;border-radius:50%;background:#1c2436;border:1px solid #fff;display:flex;align-items:center;justify-content:center;font-size:22px}\n.qx-alert-badge{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.22);margin-bottom:8px}\n.qx-alert-top h3{margin:0;font-size:22px;font-weight:800}\n.qx-alert-body{padding:16px 16px 18px}\n.qx-alert-sec{border:1px solid #2a3550;padding:12px;margin-bottom:10px;background:#1c2436}\n.qx-alert-sec-label{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}\n.qx-alert-sec p{margin:0;font-size:13px;font-weight:600;color:#fff;line-height:1.45}\n.qx-alert-help{font-size:12px;color:#94a3b8;text-align:center;margin:4px 0 12px;line-height:1.45}\n.qx-alert-tg{display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;color:#fff;font-weight:800;font-size:13px;background:#229ED9;padding:12px}\n.qx-alert-tg:hover{background:#1b8bc0}\n.qx-alert-count{margin-top:14px;text-align:center;font-size:12px;font-weight:700;color:#94a3b8}\n.qx-alert-count b{color:#f87171;font-size:18px}\n.qx-alert-progress{margin-top:10px;height:6px;border-radius:999px;background:#1c2436;overflow:hidden}\n.qx-alert-progress>span{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ef4444,#f97316);transform-origin:left center;animation:qx-bar 10s linear forwards}\n@keyframes qx-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}\n";
    document.documentElement.appendChild(v39);
    const v40 = document.createElement("div");
    v40.id = "qx-alert-root";
    v40.innerHTML = "<div class=\"qx-alert-card\"><div class=\"qx-alert-top wrong\" id=\"qx-alert-top\"><div class=\"qx-alert-icon\"><i class=\"fas fa-exclamation\"></i></div><div class=\"qx-alert-badge\" id=\"qx-alert-badge\">WRONG</div><h3 id=\"qx-alert-title\">WRONG LICENSE</h3></div><div class=\"qx-alert-body\"><div class=\"qx-alert-sec\"><div class=\"qx-alert-sec-label\">Bangla</div><p id=\"qx-alert-bn\"></p></div><div class=\"qx-alert-sec\"><div class=\"qx-alert-sec-label\">English</div><p id=\"qx-alert-en\"></p></div><p class=\"qx-alert-help\">সমাধানের জন্য ডেভেলপারের সাথে কথা বলুন / Contact the developer for help</p><a class=\"qx-alert-tg\" id=\"qx-alert-tg\" href=\"" + vLSHttpstmeTrader_niloy + "\" target=\"_blank\" rel=\"noopener noreferrer\"><i class=\"fab fa-telegram-plane\"></i><span>Developer: <span class=\"tg-ico\"><i class=\"fab fa-telegram-plane\"></i></span><span><div class=\"tg-meta\">Telegram Channel</div><div class=\"tg-value\">t.me/traderniloyx</div></span></a><span class=\"tg-ico\"><i class=\"fas fa-user\"></i></span><span><div class=\"tg-meta\">Developer</div><div class=\"tg-value\">" + vLSTrader_niloyx + "</span></a><div class=\"qx-alert-count\">Redirecting in <b id=\"qx-alert-sec\">10</b>s → " + vLSTrader_niloyx + "<div style=\"margin-top:4px;font-size:11px;font-weight:600;color:#64748b\">Channel: t.me/traderniloyx</div></div><div class=\"qx-alert-progress\"><span id=\"qx-alert-bar\"></span></div></div></div>";
    document.documentElement.appendChild(v40);
  }
  function f23(p33) {
    f22();
    const v41 = ++vLN03;
    const v42 = document.getElementById("qx-alert-root");
    const v43 = p33 === "blocked";
    const v44 = v42.querySelector("#qx-alert-top");
    const v45 = v42.querySelector("#qx-alert-badge");
    const v46 = v42.querySelector("#qx-alert-title");
    const v47 = v42.querySelector("#qx-alert-bn");
    const v48 = v42.querySelector("#qx-alert-en");
    const v49 = v42.querySelector("#qx-alert-sec");
    const v50 = v42.querySelector("#qx-alert-bar");
    const v51 = v42.querySelector("#qx-alert-tg");
    if (v36) {
      clearTimeout(v36);
    }
    if (v37) {
      clearInterval(v37);
    }
    v36 = null;
    v37 = null;
    v44.className = "qx-alert-top " + (v43 ? "blocked" : "wrong");
    if (v45) {
      v45.textContent = v43 ? "BLOCKED" : "WRONG";
    }
    v46.textContent = v43 ? "LICENSE BLOCKED" : "WRONG LICENSE";
    if (v51) {
      v51.href = vLSHttpstmeTrader_niloy;
    }
    if (v43) {
      v47.textContent = "আপনার লাইসেন্সটি ব্লক করা হয়েছে। ব্লক খুলতে ডেভেলপারের সাথে যোগাযোগ করুন।";
      v48.textContent = "Your license is BLOCKED. Contact the developer to unblock it.";
    } else {
      v47.textContent = "আপনার লাইসেন্সটি ভুল। সঠিক লাইসেন্স নিন অথবা ডেভেলপারের সাথে কথা বলুন।";
      v48.textContent = "Your license key is WRONG. Get a valid license or contact the developer.";
    }
    v42.classList.remove("show");
    v42.offsetWidth;
    if (v50) {
      v50.style.animation = "none";
      v50.offsetWidth;
      v50.style.animation = "";
    }
    let vLN10 = 10;
    if (v49) {
      v49.textContent = String(vLN10);
    }
    v42.classList.add("show");
    v37 = setInterval(() => {
      if (v41 !== vLN03) {
        return;
      }
      vLN10 -= 1;
      if (vLN10 <= 0) {
        if (v49) {
          v49.textContent = "0";
        }
        clearInterval(v37);
        v37 = null;
        return;
      }
      if (v49) {
        v49.textContent = String(vLN10);
      }
    }, 1000);
    v36 = setTimeout(() => {
      if (v41 !== vLN03) {
        return;
      }
      f21();
      f20();
    }, 10000);
  }
  function f24() {
    f22();
    v16 = true;
  }
  let v52 = null;
  function f25(p34 = location.href) {
    try {
      return new URL(p34, location.origin).pathname.replace(/\/+$/, "").toLowerCase();
    } catch {
      return "";
    }
  }
  function f26(p35) {
    const v53 = p35 ? f25(p35) : f25();
    return v53 === vF.DEMO_PATH || v53.endsWith("/demo-trade");
  }
  function f27(p36) {
    const v54 = p36 ? f25(p36) : f25();
    return v54 === vF.LIVE_PATH || /(^|\/)trade$/.test(v54) && !v54.endsWith("/demo-trade");
  }
  function f28(p37) {
    if (document.title !== p37) {
      document.title = p37;
    }
  }
  function f29(p38) {
    if (v52) {
      return;
    }
    const v55 = document.querySelector("title");
    if (!v55) {
      return;
    }
    v52 = new MutationObserver(() => {
      if (document.title !== p38) {
        document.title = p38;
      }
    });
    v52.observe(v55, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
  function f30() {
    if (!f26()) {
      f28(vF.LIVE_TITLE);
      return;
    }
    try {
      history.replaceState(history.state, vF.LIVE_TITLE, vF.LIVE_PATH + location.search + location.hash);
    } catch (e4) {}
    f28(vF.LIVE_TITLE);
  }
  function f31() {
    // Account routing/title masking disabled for transparent simulation testing.
  }
  function f32() {
    // Never redirect Live routes to Demo automatically.
  }
  let v60 = false;
  let v61 = null;
  let v62 = -1;
  let vLN04 = 0;
  let vO5 = {
    ...vO.STANDARD,
    level: "STANDARD",
    profit: "+0% profit"
  };
  let v63 = null;
  let vLN05 = 0;
  let v64 = null;
  let v65 = null;
  let vF4 = (() => {
    const v66 = localStorage.getItem(vLSQx_panel_lb_seed);
    if (v66 == null || v66 === "") {
      return 0;
    }
    const vParseFloat2 = parseFloat(v66);
    if (Number.isFinite(vParseFloat2)) {
      return vParseFloat2;
    } else {
      return 0;
    }
  })();
  let vF6 = (() => {
    const v67 = localStorage.getItem(vLSQx_panel_lb_seed);
    return v67 != null && v67 !== "" && Number.isFinite(Number(v67));
  })();
  let v68 = null;
  const v69 = document.createElement("style");
  v69.id = "qx-main-effects-style";
  v69.innerHTML = "";
  (document.head || document.documentElement).appendChild(v69);
  v69.disabled = true;
  function f33() {
    return v17 && f11();
  }
  function f34(p40) {
    const v70 = document.getElementById("qx-main-effects-style");
    if (v70) {
      v70.disabled = !p40;
    }
    if (p40) {
      f38();
      f32();
    } else {
      const v71 = document.getElementById("qx-leaderboard-name-style");
      if (v71) {
        v71.textContent = "";
      }
      document.querySelectorAll("b.YnoT0[data-qx-balance-ready=\"1\"]").forEach(p41 => {
        p41.removeAttribute("data-qx-balance-ready");
      });
    }
  }
  function f35() {
    f12(false);
    f34(false);
  }
  function f36() {
    if (!f11()) {
      f12(false);
      f34(false);
      return;
    }
    f12(true);
    f34(true);
    f115();
    f130();
  }
  function f37() {
    return v12 || vLSTraderNiloyX;
  }
  function f38() {
    const v72 = document.getElementById("qx-leaderboard-name-style");
    if (!v72) {
      return;
    }
    if (!f33() || !v12) {
      v72.textContent = "";
      return;
    }
    const v73 = v12.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    v72.textContent = "\n        #root > div > aside.FczWc.app__sidepanel.U6IJq.HGMSN.S0jcI > div.M_p_O > div.xQvJK > div.egHS4 > div.Bsca8 > div.d6ijp > p,\n        aside.FczWc div.Bsca8 > div.d6ijp > p {\n            font-size: 0 !important;\n        }\n        #root > div > aside.FczWc.app__sidepanel.U6IJq.HGMSN.S0jcI > div.M_p_O > div.xQvJK > div.egHS4 > div.Bsca8 > div.d6ijp > p::before,\n        aside.FczWc div.Bsca8 > div.d6ijp > p::before {\n            content: \"" + v73 + "\" !important;\n            font-size: 14px !important;\n            color: #ffffff !important;\n            font-weight: bold !important;\n            display: inline-block !important;\n        }";
  }
  function f39() {
    return vF2 || vLS$50000;
  }
  function f40(p42) {
    const v_0x3023c5 = f66(p42);
    if (!v_0x3023c5) {
      return false;
    }
    return v_0x3023c5 === f39() || v_0x3023c5 === vLS$50000;
  }
  function f41() { /* Simulated account balance display disabled. */ }
  function f42(p43) {
    if (!p43 || !p43.isConnected) {
      return;
    }
    p43.style.setProperty("display", "none", "important");
    p43.style.setProperty("visibility", "hidden", "important");
    p43.style.setProperty("opacity", "0", "important");
    p43.style.setProperty("pointer-events", "none", "important");
    p43.style.setProperty("height", "0", "important");
    p43.style.setProperty("max-height", "0", "important");
    p43.style.setProperty("overflow", "hidden", "important");
    p43.dataset.qxBannerRemoved = "1";
  }
  function f43() {
    if (!f33()) {
      return;
    }
    const v75 = new Set();
    [vLSrootDivDivUFs_mapp__3, vLSrootDivappappfixedan, "main div.q04vx.o2msZ", "main div.q04vx.o2msZ picture", "img.LSmI1", "img[alt=\"welcome bonus\"]", "img[src*=\"welcome-banner-bg\"]"].forEach(p44 => {
      document.querySelectorAll(p44).forEach(p45 => v75.add(p45));
    });
    const v76 = document.querySelector(vLSrootDivDivUFs_mapp__3);
    if (v76) {
      v75.add(v76);
    }
    document.querySelectorAll("header div.r7UKG, div.r7UKG").forEach(p46 => v75.add(p46));
    v75.forEach(f42);
  }
  function f44() {
    f43();
    const v77 = [document.querySelector("header"), document.querySelector("main"), document.getElementById("root")].filter(Boolean);
    const v78 = new MutationObserver(() => {
      f43();
    });
    v77.forEach(p47 => {
      v78.observe(p47, {
        childList: true,
        subtree: true
      });
    });
  }
  function f45() {
    return window.matchMedia("(max-width: " + vLN768 + "px)").matches;
  }
  function f46() {
    if (f45()) {
      return vLSLive;
    } else {
      return vLSLiveAccount;
    }
  }
  function f47() {
    document.querySelectorAll(vLSrootDivDivUFs_mapp__4 + ", header div.qKWSR").forEach(p48 => {
      if (p48.textContent.trim()) {
        p48.textContent = "";
      }
      p48.removeAttribute("data-qx-live-label-ready");
      p48.style.setProperty("display", "none", "important");
      p48.style.setProperty("visibility", "hidden", "important");
      p48.style.setProperty("height", "0", "important");
      p48.style.setProperty("max-height", "0", "important");
      p48.style.setProperty("overflow", "hidden", "important");
      p48.style.setProperty("margin", "0", "important");
      p48.style.setProperty("padding", "0", "important");
      p48.style.setProperty("pointer-events", "none", "important");
    });
  }
  function f48(p49, p50) {
    if (!p49 || !p49.isConnected) {
      return;
    }
    if (p49.classList.contains("qKWSR")) {
      return;
    }
    if (p49.textContent.trim() !== p50) {
      p49.textContent = p50;
    }
    p49.style.color = "#0faf59";
    p49.classList.remove("lTzTl", "TmWTp");
    p49.classList.add("X6PB5");
    p49.setAttribute("data-qx-live-label-ready", "1");
  }
  function f49() { /* Account label spoofing disabled. */ }
  function f50() {
    f49();
    const v80 = document.querySelector("header");
    if (!v80) {
      return;
    }
    const v81 = new MutationObserver(() => {
      f49();
    });
    v81.observe(v80, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  function f51(p53) {
    if (p53 >= 10000) {
      return {
        ...vO.VIP,
        level: "VIP",
        profit: "+4% profit"
      };
    }
    if (p53 >= 5000) {
      return {
        ...vO.PRO,
        level: "PRO",
        profit: "+2% profit"
      };
    }
    return {
      ...vO.STANDARD,
      level: "STANDARD",
      profit: "+0% profit"
    };
  }
  function f52(p54, p55) {
    const v82 = p54.querySelector("use");
    if (!v82) {
      return false;
    }
    const v83 = v82.getAttribute("href") || v82.getAttribute("xlink:href") || "";
    const v84 = p54.getAttribute("class") || "";
    const v85 = String(v83).includes("#") ? "#" + String(v83).split("#").pop() : v83;
    const v86 = String(p55.href).includes("#") ? "#" + String(p55.href).split("#").pop() : p55.href;
    return v85 !== v86 || v84 !== p55.class;
  }
  function f53(p56, p57) {
    if (!p56 || !p56.isConnected) {
      return false;
    }
    const v87 = p56.querySelector("use");
    if (!v87) {
      return false;
    }
    if (!f52(p56, p57) && p56.getAttribute("data-qx-badge-ready") === "1") {
      return true;
    }
    v87.setAttribute("xlink:href", p57.href);
    v87.setAttribute("href", p57.href);
    p56.setAttribute("class", p57.class);
    p56.setAttribute("data-qx-badge-ready", "1");
    return true;
  }
  function f54(p58, p59) {
    if (!p58) {
      return;
    }
    const v88 = p58.querySelector("svg") || (p58.tagName === "SVG" ? p58 : null);
    if (v88) {
      f53(v88, p59);
      return;
    }
    const v89 = p58.querySelector("use");
    if (!v89) {
      return;
    }
    const v90 = v89.getAttribute("href") || v89.getAttribute("xlink:href") || "";
    if (v90 === p59.href) {
      return;
    }
    v89.setAttribute("xlink:href", p59.href);
    v89.setAttribute("href", p59.href);
    const v91 = v89.closest("svg");
    if (v91) {
      v91.setAttribute("class", p59.class);
      v91.setAttribute("data-qx-badge-ready", "1");
    }
  }
  const vLSDivh5aTJ = "div.h5aTJ";
  const vLSrootDivDivUFs_mapp__6 = "#root > div > div.UFs_m.app__page.bdVZy > header > div.RyAkb > div.QE4Zb > div > div.h5aTJ > svg";
  function f55(p60) {
    if (!f33()) {
      return;
    }
    const v92 = p60 || vO5;
    const v93 = document.querySelector(vLSDivh5aTJ);
    if (v93) {
      f54(v93, v92);
    }
    const v94 = document.querySelector(vLSrootDivDivUFs_mapp__6) || document.querySelector("div.h5aTJ > svg");
    if (v94) {
      f53(v94, v92);
    }
  }
  function f56() {
    f55();
    f87();
    const v95 = document.querySelector("header") || document.getElementById("root") || document.body || document.documentElement;
    const v96 = new MutationObserver(() => {
      f55();
      f87();
    });
    v96.observe(v95, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "href", "xlink:href"]
    });
  }
  function f57(p61) {
    document.querySelectorAll("div.nKm6H").forEach(p62 => {
      const v97 = Array.from(p62.querySelectorAll("svg"));
      v97.forEach((p63, p64) => {
        if (p64 === 0) {
          f53(p63, p61);
        } else {
          p63.style.display = "none";
          p63.style.opacity = "0";
          p63.style.visibility = "hidden";
        }
      });
    });
    const v98 = document.querySelector(vLSrootDivDivUFs_mapp__2);
    if (v98) {
      f53(v98, p61);
    }
  }
  function f58(p65, p66) {
    document.querySelectorAll(".qjGlZ, .wFviC").forEach(p67 => {
      const v99 = p65 + ":";
      if (p67.textContent !== v99) {
        p67.textContent = v99;
      }
      p67.setAttribute("data-qx-text-ready", "1");
    });
    document.querySelectorAll(".VgpLl, .UkDJi").forEach(p68 => {
      if (p68.textContent !== p66) {
        p68.textContent = p66;
      }
      p68.setAttribute("data-qx-text-ready", "1");
    });
  }
  function f59() {
    const v100 = Array.from(document.querySelectorAll(vLSUlIkdIGDivLiRDtBnUlI));
    let v101 = null;
    let v102 = null;
    v100.forEach(p69 => {
      const v103 = p69.querySelector("input.r29tN[type=\"radio\"]");
      const v104 = (v103?.value || "").toLowerCase();
      const v105 = (p69.querySelector("a.yBslY")?.textContent || "").toLowerCase();
      if (v104 === "live" || v105.includes("live account")) {
        v101 = p69;
      }
      if (v104 === "demo" || v105.includes("demo account")) {
        v102 = p69;
      }
    });
    if (!v101 && v100.length > 0) {
      v101 = v100[0];
    }
    if (!v102 && v100.length > 1) {
      v102 = v100[1];
    }
    return {
      live: v101,
      demo: v102
    };
  }
  let v106 = false;
  const v107 = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
  function f60(p70, p71) {
    if (!p70) {
      return;
    }
    if (p71) {
      p70.setAttribute("checked", "");
    } else {
      p70.removeAttribute("checked");
    }
    if (p70.dataset.qxCheckedLock === String(p71)) {
      try {
        if (v107?.set) {
          v107.set.call(p70, p71);
        }
      } catch (e7) {}
      return;
    }
    p70.dataset.qxCheckedLock = String(p71);
    try {
      if (v107?.set) {
        v107.set.call(p70, p71);
      }
    } catch (e8) {}
    try {
      Object.defineProperty(p70, "checked", {
        configurable: true,
        enumerable: true,
        get() {
          return p71;
        },
        set() {
          try {
            if (v107?.set) {
              v107.set.call(this, p71);
            }
          } catch (e9) {}
          if (p71) {
            this.setAttribute("checked", "");
          } else {
            this.removeAttribute("checked");
          }
        }
      });
    } catch (e10) {
      p70.checked = p71;
    }
  }
  function f61() {
    if (v106) {
      return;
    }
    if (!f33()) {
      return;
    }
    const {
      live: _0x157a8e,
      demo: _0x32a9e7
    } = f59();
    if (!_0x157a8e || !_0x32a9e7) {
      return;
    }
    const v108 = _0x157a8e.querySelector("input.r29tN[value=\"live\"], input.r29tN[type=\"radio\"]");
    const v109 = _0x32a9e7.querySelector("input.r29tN[value=\"demo\"], input.r29tN[type=\"radio\"]");
    const v110 = _0x157a8e.querySelector("a.yBslY");
    const v111 = _0x32a9e7.querySelector("a.yBslY");
    const v112 = _0x157a8e.classList.contains(vLSQx5RW) && !_0x32a9e7.classList.contains(vLSQx5RW) && v110?.classList.contains("active") && v110?.getAttribute("aria-current") === "page" && !v111?.classList.contains("active") && !v111?.hasAttribute("aria-current") && v108?.dataset?.qxCheckedLock === "true" && v109?.dataset?.qxCheckedLock === "false";
    if (v112) {
      return;
    }
    v106 = true;
    try {
      _0x32a9e7.classList.remove(vLSQx5RW);
      if (v111) {
        v111.classList.remove("active");
        v111.removeAttribute("aria-current");
      }
      f60(v109, false);
      _0x157a8e.classList.add(vLSQx5RW);
      if (v110) {
        v110.classList.add("active");
        v110.setAttribute("aria-current", "page");
      }
      f60(v108, true);
    } finally {
      v106 = false;
    }
  }
  function f62(p72) {
    const v113 = p72?.closest?.("li.RDtBn");
    return !!v113 && !!v113.querySelector("input.r29tN[value=\"demo\"]");
  }
  function f63(p73) {
    if (!p73?.closest || !f62(p73)) {
      return false;
    }
    if (p73.matches?.("input.r29tN") || p73.closest?.(".yJFvf, .RUgzE, span.yJFvf")) {
      return false;
    }
    return !!p73.closest?.("button, svg, [role='button']") || !!p73.closest?.("div.WjlOy") || !!p73.closest?.("input:not(.r29tN), textarea");
  }
  function f64(p74) {
    if (!p74?.closest || f63(p74)) {
      return false;
    }
    return !!p74.closest?.("a.yBslY[href*=\"demo-trade\"]") || !!p74.matches?.("input.r29tN[value=\"demo\"]") || !!p74.closest?.("label.pBke3:has(input.r29tN[value=\"demo\"])");
  }
  function f65(p75) {
    if (!p75) {
      return false;
    }
    const v114 = p75.querySelector("input:not(.r29tN), textarea, [contenteditable='true']");
    if (!v114) {
      return false;
    }
    const v115 = window.getComputedStyle(v114);
    return v115.display !== "none" && v115.visibility !== "hidden" && v114.offsetWidth > 0 && v114.offsetHeight > 0;
  }
  function f66(p76) {
    const v_0x389e74 = f75(p76);
    if (!Number.isFinite(v_0x389e74) || v_0x389e74 <= 0) {
      return "";
    }
    return "$" + v_0x389e74.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  function f67(p77) {
    const vF66 = f66(p77);
    if (!vF66 || f40(vF66)) {
      return false;
    }
    v63 = vF66;
    vLN05 = f75(vF66);
    f79();
    return true;
  }
  function f68() {
    if (document.documentElement.dataset.qxTickLock === "1") {
      return;
    }
    document.documentElement.dataset.qxTickLock = "1";
    const vF7 = () => {
      f61();
      f70();
    };
    const vF8 = () => {
      const vF9 = () => {
        f61();
        f70();
      };
      vF9();
      setTimeout(vF9, 200);
      setTimeout(vF9, 600);
      setTimeout(vF9, 1200);
    };
    ["pointerdown", "mousedown", "mouseup", "click"].forEach(p78 => {
      document.addEventListener(p78, p79 => {
        if (f63(p79.target)) {
          if (p78 === "click") {
            const v116 = p79.target.closest?.("li.RDtBn");
            const v117 = v116?.querySelector("input:not(.r29tN), textarea");
            if (v117?.value) {
              f67(v117.value);
            }
            vF8();
          }
          return;
        }
        if (!f64(p79.target)) {
          if (p79.target?.closest?.("ul.IkdIG, div.p0Ijl")) {
            vF7();
          }
          return;
        }
        p79.preventDefault();
        p79.stopPropagation();
        p79.stopImmediatePropagation();
        vF7();
      }, true);
    });
    document.addEventListener("change", p80 => {
      if (p80.target?.matches?.("input.r29tN")) {
        p80.preventDefault();
        p80.stopPropagation();
        p80.stopImmediatePropagation();
        vF7();
        return;
      }
      if (f62(p80.target) && p80.target?.matches?.("input:not(.r29tN), textarea, select")) {
        f67(p80.target.value);
        vF8();
      }
    }, true);
    document.addEventListener("keydown", p81 => {
      if (p81.key !== "Enter") {
        return;
      }
      if (!f62(p81.target)) {
        return;
      }
      if (!p81.target?.matches?.("input:not(.r29tN), textarea")) {
        return;
      }
      f67(p81.target.value);
      vF8();
    }, true);
  }
  function f69(p82) {
    if (!p82) {
      return null;
    }
    return p82.querySelector("div.WjlOy > b.YnoT0") || p82.querySelector("b.YnoT0");
  }
  function f70() {
    if (!f33()) {
      return;
    }
    const {
      live: _0x197e42,
      demo: _0x36be3e
    } = f59();
    if (!_0x197e42 || !_0x36be3e) {
      return;
    }
    const vF69 = f69(_0x197e42);
    const vF692 = f69(_0x36be3e);
    if (!vF69 || !vF692) {
      return;
    }
    const vF65 = f65(_0x36be3e);
    const v118 = (vF692.textContent || "").trim();
    if (!vF65 && f66(v118) && !f40(v118)) {
      f67(v118);
      vF692.dataset.qxRealBalance = f66(v118);
    }
    if (vF65) {
      const v119 = _0x36be3e.querySelector("input:not(.r29tN), textarea, [contenteditable='true']");
      const v120 = v119?.value || v119?.textContent || "";
      f67(v120);
    }
    const v121 = v63 || vF692.dataset.qxRealBalance || vF69.dataset.qxLiveDisplay || "$0.00";
    if (vF69.textContent !== v121) {
      vF69.textContent = v121;
    }
    vF69.dataset.qxLiveDisplay = v121;
    vF69.setAttribute("data-qx-balance-ready", "1");
    if (!vF65) {
      const vF392 = f39();
      if (vF692.textContent !== vF392) {
        vF692.textContent = vF392;
      }
      vF692.setAttribute("data-qx-balance-ready", "1");
    }
  }
  let v122 = false;
  function f71() {
    if (v122) {
      return;
    }
    if (!f33()) {
      return;
    }
    v122 = true;
    try {
      f57(vO5);
      f58(vO5.level, vO5.profit);
      f61();
      f70();
    } finally {
      v122 = false;
    }
  }
  function f72() {
    f68();
    f71();
    const v123 = document.querySelector("header") || document.getElementById("root") || document.documentElement;
    const v124 = new MutationObserver(p83 => {
      let v125 = false;
      let v126 = false;
      for (const v127 of p83) {
        const v128 = v127.target;
        if (v128?.matches?.("input.r29tN, li.RDtBn, a.yBslY, ul.IkdIG, div.p0Ijl") || v128?.closest?.("ul.IkdIG, li.RDtBn")) {
          v125 = true;
        }
        if (v127.type === "childList" || v128?.matches?.("div.nKm6H, .qjGlZ, .wFviC, .VgpLl, .UkDJi, b.YnoT0") || v128?.closest?.("div.p0Ijl, ul.IkdIG")) {
          v126 = true;
        }
      }
      if (v125) {
        f61();
      }
      if (v126) {
        f70();
        f71();
      }
    });
    v124.observe(v123, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "checked", "aria-current", "value", "href"]
    });
    setInterval(() => {
      if (document.querySelector("ul.IkdIG input.r29tN")) {
        f61();
      }
    }, 50);
  }
  function f73() {
    const v129 = document.querySelector("ul.IkdIG") || document.querySelector("div.p0Ijl.Qx5RW");
    return !!v129 && v129.offsetParent !== null;
  }
  function f74() {
    const v130 = document.querySelector("#root > div > div.UFs_m.app__page.bdVZy > header > div.RyAkb > div.QE4Zb.Mblsx > div.Xlyoi.Mblsx > div.zfJUm > div.Zt1hG") || document.querySelector("div.Zt1hG");
    if (!v130) {
      return {
        currentBalance: vLN05,
        formattedBalance: v63 || "$0.00"
      };
    }
    const v131 = v130.textContent.trim();
    const v_0x389e742 = f75(v131);
    if (!v131 || v_0x389e742 <= 0) {
      return {
        currentBalance: vLN05,
        formattedBalance: v63 || "$0.00"
      };
    }
    if (!f40(v131)) {
      vLN05 = v_0x389e742;
      v63 = v131;
      f79();
    }
    return {
      currentBalance: v_0x389e742,
      formattedBalance: v131
    };
  }
  function f75(p84) {
    const v132 = String(p84 || "").replace(/[^0-9.]/g, "");
    if (v132) {
      return parseFloat(v132);
    } else {
      return 0;
    }
  }
  function f76(p85) {
    const v133 = String(p85 || "").trim();
    const v134 = v133.startsWith("-") || v133.startsWith("−");
    const v135 = v133.replace(/[^0-9.]/g, "");
    return (v134 ? "-" : "") + v135;
  }
  function f77(p86) {
    const vF76 = f76(p86);
    const v136 = vF76.startsWith("-");
    const vF75 = f75(vF76);
    if (!Number.isFinite(vF75)) {
      return 0;
    }
    if (v136) {
      return -vF75;
    } else {
      return vF75;
    }
  }
  function f78() {
    try {
      v64 = f66(localStorage.getItem(vLSQx_header_balance) || "") || null;
    } catch (e11) {}
    try {
      const v137 = localStorage.getItem(vLSQx_trusted_live_bala);
      if (!v137) {
        return;
      }
      const v138 = f66(v137) || String(v137).trim();
      const vF752 = f75(v138);
      if (!v138 || vF752 <= 0) {
        return;
      }
      v63 = v138;
      vLN05 = vF752;
    } catch (e12) {}
  }
  function f79() {
    if (!v63 || vLN05 <= 0) {
      return;
    }
    try {
      localStorage.setItem(vLSQx_trusted_live_bala, v63);
    } catch (e13) {}
  }
  function f80(p87) {
    if (!p87 || p87 === v64) {
      return;
    }
    if (f40(p87)) {
      return;
    }
    v64 = p87;
    try {
      localStorage.setItem(vLSQx_header_balance, p87);
    } catch (e14) {}
  }
  function f81() {
    return v63 || f66(localStorage.getItem(vLSQx_trusted_live_bala) || "") || v64 || null;
  }
  function f82() {
    if (!f33()) {
      return;
    }
    document.querySelectorAll("div.Zt1hG").forEach(p88 => {
      const v139 = (p88.textContent || "").trim();
      if (!v139 || f75(v139) <= 0) {
        const vF81 = f81();
        if (!vF81) {
          return;
        }
        if (p88.dataset.qxBalDisplay !== vF81) {
          p88.dataset.qxBalDisplay = vF81;
        }
        return;
      }
      f80(f66(v139));
      if (p88.dataset.qxBalDisplay) {
        delete p88.dataset.qxBalDisplay;
      }
    });
  }
  let v140 = false;
  function f83() {
    if (v140) {
      return;
    }
    v140 = true;
    requestAnimationFrame(() => {
      v140 = false;
      f82();
    });
  }
  function f84() {
    const v141 = document.documentElement;
    if (v141) {
      new MutationObserver(f83).observe(v141, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    f82();
  }
  function f85(p89) {
    const v142 = p89 || vO5;
    const v143 = document.querySelector("div.usermenu__level.js-levels-profile-button") || document.querySelector("div.usermenu__level-info > div.usermenu__level");
    if (!v143) {
      return;
    }
    const v144 = (v142.level || "STANDARD") + ":";
    const v145 = v142.profit || "+0% profit";
    v143.querySelectorAll("div.usermenu__level-icon.js-balance-visible-usermenu").forEach(p90 => {
      if (p90.classList.contains("hidden")) {
        return;
      }
      const v146 = p90.querySelector("svg:not(.icon-profile-level-visible)");
      if (v146) {
        f53(v146, v142);
      } else {
        f54(p90, v142);
      }
    });
    v143.querySelectorAll("div.usermenu__level-name.js-balance-visible-usermenu").forEach(p91 => {
      if (p91.classList.contains("hidden")) {
        return;
      }
      if (p91.textContent !== v144) {
        p91.textContent = v144;
      }
      p91.setAttribute("data-qx-text-ready", "1");
    });
    v143.querySelectorAll("div.usermenu__level-profit.js-balance-visible-usermenu").forEach(p92 => {
      if (p92.classList.contains("hidden")) {
        return;
      }
      if (p92.textContent !== v145) {
        p92.textContent = v145;
      }
      p92.setAttribute("data-qx-text-ready", "1");
    });
  }
  function f86() {
    const v147 = Array.from(document.querySelectorAll("ul.usermenu__select > li.usermenu__select-item--radio"));
    if (!v147.length) {
      return;
    }
    let v148 = null;
    let v149 = null;
    v147.forEach(p93 => {
      const v150 = (p93.querySelector("a.usermenu__select-name")?.getAttribute("href") || "").toLowerCase();
      const v151 = (p93.querySelector("a.usermenu__select-name")?.textContent || "").toLowerCase();
      if (v150.includes("demo-trade") || v151.includes("demo")) {
        v149 = p93;
      } else if (v150.includes("/trade") || v151.includes("live")) {
        v148 = p93;
      }
    });
    if (!v148 && v147[0]) {
      v148 = v147.find(p94 => p94 !== v149) || v147[0];
    }
    if (!v149 && v147[1]) {
      v149 = v147.find(p95 => p95 !== v148) || v147[1];
    }
    const v152 = v63 || f66(localStorage.getItem(vLSQx_trusted_live_bala) || "") || null;
    const vF10 = (p96, p97) => {
      if (!p96 || !p97) {
        return;
      }
      p96.querySelectorAll("b.usermenu__select-balance.js-balance-visible-usermenu").forEach(p98 => {
        if (p98.classList.contains("hidden")) {
          return;
        }
        if (p98.textContent.trim() !== p97) {
          p98.textContent = " " + p97 + " ";
        }
      });
    };
    if (v152) {
      vF10(v148, v152);
    }
    vF10(v149, f39());
  }
  function f87(p99) {
    if (!f33()) {
      return;
    }
    const v153 = p99 || vO5;
    const v154 = vLN05 > 0 ? vLN05 : f75(v63 || localStorage.getItem(vLSQx_trusted_live_bala) || "");
    const v155 = v154 > 0 ? f51(v154) : v153;
    vO5 = v155;
    const v156 = document.querySelector("div.usermenu__info") || document.querySelector("body > div.app__page.page > header div.usermenu__info");
    const v157 = v63 || f66(localStorage.getItem(vLSQx_trusted_live_bala) || "") || null;
    if (v156 && v157) {
      v156.querySelectorAll("div.usermenu__info-balance.js-balance-visible-usermenu").forEach(p100 => {
        if (p100.classList.contains("-off") || p100.classList.contains("hidden")) {
          return;
        }
        if (p100.textContent.trim() !== v157) {
          p100.textContent = " " + v157 + " ";
        }
      });
      const v158 = v156.querySelector("div.usermenu__info-levels");
      if (v158) {
        f54(v158, v155);
      }
      const v159 = v156.querySelector("div.usermenu__info-levels > svg");
      if (v159) {
        f53(v159, v155);
      }
    }
    f85(v155);
    f86();
    f89();
  }
  function f88(p101) {
    const vF662 = f66(p101);
    if (!vF662) {
      return "";
    }
    return vF662.replace(/^\$/, "") + " $";
  }
  function f89() {
    const v160 = v63 || f66(localStorage.getItem(vLSQx_trusted_live_bala) || "") || null;
    if (!v160) {
      return;
    }
    const vF88 = f88(v160);
    if (!vF88) {
      return;
    }
    const v161 = document.querySelectorAll("dl.balance-list dd.balance-list__value, #trade-page dl.balance-list dd.balance-list__value");
    if (!v161.length) {
      return;
    }
    v161.forEach(p102 => {
      if ((p102.textContent || "").trim() !== vF88.trim()) {
        p102.textContent = vF88;
      }
    });
  }
  function f90(p103) {
    const vNumber2 = Number(p103);
    if (!Number.isFinite(vNumber2)) {
      return 0;
    }
    return Math.round(vNumber2 * 100) / 100;
  }
  function f91(p104) {
    const vF90 = f90(p104);
    return "$" + vF90.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  function f92(p105, p106) {
    vF4 = f90(p105);
    vF6 = true;
    if (Number.isFinite(p106) && p106 > 0) {
      v68 = p106;
    } else if (Number.isFinite(vLN05) && vLN05 > 0) {
      v68 = vLN05;
    } else {
      v68 = null;
    }
    v62 = -1;
    v61 = null;
    v60 = false;
  }
  function f93(p107) {
    const vF902 = f90(p107);
    const v162 = Math.abs(vF902).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    if (Math.abs(vF902) < 0.005) {
      return "$0.00";
    }
    if (vF902 < 0) {
      return v162 + "$";
    }
    return "$" + v162;
  }
  function f94(p108) {
    if (!Number.isFinite(p108) || p108 <= 0) {
      return;
    }
    if (v68 === null || !Number.isFinite(v68)) {
      v68 = p108;
    }
  }
  function f95(p109) {
    if (!Number.isFinite(p109)) {
      return f90(vF4);
    }
    if (v68 === null || !Number.isFinite(v68)) {
      return f90(vF4);
    }
    return f90(vF4 + (p109 - v68));
  }
  function f96(p110) {
    f94(p110);
    const vF95 = f95(p110);
    return {
      displayValue: vF95,
      formattedDisplay: f93(vF95)
    };
  }
  function f97(p111) {
    const v163 = p111.children.length;
    if (v163 === vLN04) {
      return;
    }
    vLN04 = v163;
    v62 = -1;
    v61 = null;
    v60 = false;
  }
  function f98(p112) {
    p112.querySelectorAll("div.ePgNa").forEach(p113 => {
      const v164 = (p113.textContent || "").trim();
      if (v164 && !p113.dataset.qxOrigProfit) {
        p113.dataset.qxOrigProfit = v164;
      }
    });
    const vF37 = f37();
    p112.querySelectorAll("div.hKWVz").forEach(p114 => {
      const v165 = (p114.textContent || "").trim();
      if (v165 && v165 !== vF37 && !p114.dataset.qxOrigName) {
        p114.dataset.qxOrigName = v165;
      }
    });
  }
  function f99(p115) {
    if (!p115) {
      return;
    }
    const v166 = p115.querySelector("div.hKWVz");
    const v167 = p115.querySelector("div.ePgNa");
    if (v166 && v166.dataset.qxOrigName && v166.textContent !== v166.dataset.qxOrigName) {
      v166.textContent = v166.dataset.qxOrigName;
    }
    if (v167 && v167.dataset.qxOrigProfit && v167.textContent !== v167.dataset.qxOrigProfit) {
      v167.textContent = v167.dataset.qxOrigProfit;
      v167.style.color = "";
    }
    p115.removeAttribute("data-qx-user-row");
  }
  function f100() {
    if (!f33()) {
      return;
    }
    const v168 = document.querySelector("#root > div > aside.FczWc.app__sidepanel.U6IJq.HGMSN.S0jcI > div.M_p_O > div.xQvJK > div.egHS4 > div.Bsca8 > div.d6ijp > p") || document.querySelector("aside.FczWc div.Bsca8 > div.d6ijp > p");
    if (!v168) {
      return;
    }
    const vF372 = f37();
    if (v168.textContent !== vF372) {
      v168.textContent = vF372;
    }
    v168.setAttribute("data-qx-name-ready", "1");
  }
  function f101() {
    f100();
    const v169 = document.querySelector("aside.FczWc div.xQvJK") || document.querySelector("aside.FczWc") || document.getElementById("root") || document.documentElement;
    const v170 = new MutationObserver(() => {
      f100();
    });
    v170.observe(v169, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  function f102(p116) {
    const v171 = p116.closest("aside") || document;
    const v172 = v171.querySelector("div.xQvJK") || null;
    const v173 = Array.from(v171.querySelectorAll("div.hKWVz"));
    const v174 = Array.from(v171.querySelectorAll("div.ePgNa"));
    const v175 = v172 ? v173.filter(p117 => !v172.contains(p117)) : v173;
    const v176 = v172 ? v174.filter(p118 => !v172.contains(p118)) : v174;
    return {
      names: v175,
      balances: v176
    };
  }
  function f103(p119, p120) {
    let vLN06 = 0;
    for (let vLN07 = 0; vLN07 < p119.length; vLN07++) {
      const v177 = p119[vLN07].dataset.qxOrigProfit || p119[vLN07].textContent || "";
      const vF753 = f75(v177);
      if (vF753 > p120) {
        vLN06++;
      }
    }
    return vLN06 + 1;
  }
  function f104(p121, p122, p123) {
    return Math.min(p123, Math.max(p122, p121));
  }
  function f105(p124, p125, p126) {
    return p124 + (p125 - p124) * p126;
  }
  function f106(p127, p128) {
    let vP128 = p128;
    p127.forEach(p129 => {
      const v178 = p129.dataset.qxOrigProfit || p129.textContent || "";
      const vF754 = f75(v178);
      if (vF754 > vP128) {
        vP128 = vF754;
      }
    });
    return vP128;
  }
  function f107(p130, p131, p132) {
    if (!Number.isFinite(p131)) {
      return 0;
    }
    if (Math.abs(p131) < 0.005) {
      return 0;
    }
    const vF106 = f106(p132, p131);
    const v179 = vF106 > 0 ? Math.max(p131, 0) / vF106 * 100 : 0;
    const v180 = v68 || v65 || 1;
    const vP131 = p131;
    const v181 = v180 > 0 ? vP131 / v180 * 100 : 0;
    let vLN08 = 0;
    if (v181 >= 60 || p130 === 1) {
      vLN08 = 100;
    } else if (v181 > 0) {
      vLN08 = f104(20 + v181 / 60 * 75, 20, 99);
    } else if (v181 < 0) {
      const v182 = Math.abs(v181);
      if (v182 >= 60) {
        vLN08 = 1;
      } else if (v182 >= 50) {
        vLN08 = f105(2, 1, f104((v182 - 50) / 10, 0, 1));
      } else if (v182 >= 40) {
        vLN08 = f105(15, 2, f104((v182 - 40) / 10, 0, 1));
      } else if (v182 >= 30) {
        vLN08 = f105(20, 15, f104((v182 - 30) / 10, 0, 1));
      } else {
        vLN08 = f105(35, 20, f104(v182 / 30, 0, 1));
      }
    } else if (p130 === 2) {
      vLN08 = f104(Math.max(v179 * 0.92, 80), 70, 95);
    } else if (p130 === 3) {
      vLN08 = f104(Math.max(v179 * 0.88, 70), 60, 90);
    } else if (p130 <= 5) {
      vLN08 = f104(v179 * 0.75, 35, 70);
    } else if (p130 <= 10) {
      vLN08 = f104(v179 * 0.6, 20, 50);
    } else if (p130 <= 20) {
      vLN08 = f104(v179 * 0.45, 10, 35);
    } else {
      vLN08 = 5;
    }
    if (p130 === 1) {
      vLN08 = Math.max(vLN08, f104(v179, 90, 100));
    }
    return f104(Math.round(vLN08 * 10) / 10, 0, 100);
  }
  function f108(p133, p134, p135) {
    const v183 = document.querySelector(vLSrootDivAsideFczWcapp3) || document.querySelector("div.DRWB2");
    if (!v183) {
      return;
    }
    const v184 = v183.querySelector("span.uQuVa") || v183.querySelector("span");
    if (!v184) {
      return;
    }
    const vF107 = f107(p133, p134, p135);
    const v185 = vF107 + "%";
    if (v184.style.width !== v185) {
      v184.style.width = v185;
    }
    v183.style.height = vLN2 + "px";
    v183.style.minHeight = vLN2 + "px";
    v184.style.background = vLS0faf59;
    v184.style.display = vF107 <= 0 ? "none" : "block";
    v184.style.height = vLN2 + "px";
    v184.style.minHeight = vLN2 + "px";
    v184.style.borderRadius = "100px";
    v184.setAttribute("data-qx-bar-ready", "1");
  }
  function f109(p136, p137) {
    if (!Number.isFinite(p137) || Math.abs(p137) < 0.005) {
      return "-";
    }
    if (!Number.isFinite(p136) || p136 < 1) {
      return "-";
    }
    if (p136 > 20) {
      return "100+";
    }
    return String(p136);
  }
  function f110(p138, p139) {
    const v186 = document.querySelector(vLSrootDivAsideFczWcapp2) || document.querySelector("div.c_7BP");
    if (!v186) {
      return;
    }
    const vF109 = f109(p138, p139);
    const v187 = v186.querySelector(".YkAuV");
    if (v187 && v187.textContent !== "Your position:") {
      v187.textContent = "Your position:";
    }
    let v188 = v186.querySelector("[data-qx-position-value]");
    if (!v188) {
      v186.childNodes.forEach(p140 => {
        if (p140.nodeType === 3) {
          p140.textContent = "";
        }
      });
      v188 = document.createElement("span");
      v188.setAttribute("data-qx-position-value", "1");
      v188.style.color = "#ffffff";
      v186.appendChild(v188);
    }
    if (v188.textContent !== vF109) {
      v188.textContent = vF109;
    }
  }
  function f111(p141) {
    if (!p141 || p141.dataset.qxHoverBound === "1") {
      return;
    }
    p141.dataset.qxHoverBound = "1";
    p141.addEventListener("mouseenter", () => {
      v60 = true;
    });
    p141.addEventListener("mouseleave", () => {
      v60 = false;
    });
  }
  function f112(p142, p143, p144, p145) {
    const vF373 = f37();
    if (p142 && p142.textContent !== vF373) {
      p142.textContent = vF373;
    }
    if (p143) {
      if (p143.textContent !== p144) {
        p143.textContent = p144;
      }
      const v189 = Number.isFinite(p145) && p145 < -0.004 ? "#ff4d4f" : "#0faf59";
      if (p143.style.color !== v189) {
        p143.style.color = v189;
      }
    }
  }
  function f113(p146, p147, p148) {
    try {
      if (!p146 || !p146.isConnected) {
        return;
      }
      f97(p146);
      f98(p146);
      const {
        names: _0x84d073,
        balances: _0x5b1cd8
      } = f102(p146);
      if (!_0x5b1cd8.length) {
        return;
      }
      const v190 = !Number.isFinite(p147) || Math.abs(p147) < 0.005;
      const v191 = v190 ? 0 : f103(_0x5b1cd8, p147);
      f110(v191, p147);
      f108(v191 || 21, p147, _0x5b1cd8);
      if (v190 || !_0x84d073.length || v191 > 20) {
        return;
      }
      const v192 = v191 - 1;
      if (v192 >= _0x84d073.length || v192 >= _0x5b1cd8.length) {
        return;
      }
      const v193 = _0x84d073[v192];
      const v194 = _0x5b1cd8[v192];
      const v195 = v193.closest("div")?.parentElement || v193.parentElement;
      if (v60 && v61 && v61.isConnected) {
        const v196 = v61.querySelector("div.hKWVz");
        const v197 = v61.querySelector("div.ePgNa");
        f112(v196, v197, p148, p147);
        return;
      }
      if (v61 && v61 !== v195) {
        f99(v61);
      }
      if (v62 === v192 && v61 === v195) {
        f112(v193, v194, p148, p147);
        return;
      }
      if (v195) {
        v195.dataset.qxUserRow = "1";
        f111(v195);
        v61 = v195;
      }
      f112(v193, v194, p148, p147);
      v62 = v192;
    } catch (e15) {
      v62 = -1;
      v61 = null;
    }
  }
  function f114() {
    return f26() || f27();
  }
  function f115() {
    if (!f33()) {
      return;
    }
    try {
      f43();
      if (f114()) {
        f49();
      }
      f82();
      const {
        currentBalance: _0x4d6ba8
      } = f74();
      const vF51 = f51(_0x4d6ba8 > 0 ? _0x4d6ba8 : vLN05);
      vO5 = vF51;
      f87(vF51);
      if (!f114()) {
        return;
      }
      const vF73 = f73();
      const vF96 = f96(_0x4d6ba8);
      f61();
      f70();
      f41();
      f54(document.querySelector("div.h5aTJ"), vF51);
      f55(vF51);
      if (vF73) {
        f71();
      } else {
        f57(vF51);
        f58(vF51.level, vF51.profit);
      }
      f100();
      const v198 = document.querySelector("#root > div > aside.FczWc.app__sidepanel.U6IJq.HGMSN.S0jcI > div.M_p_O > div.xQvJK > div.egHS4 > div.Bsca8 > div.ord28.o8xRM");
      if (v198 && v198.textContent !== vF96.formattedDisplay) {
        v198.textContent = vF96.formattedDisplay;
        v198.style.color = vF96.displayValue < 0 ? "#ff4d4f" : "#0faf59";
      }
      const v199 = document.querySelector(vLSrootDivAsideFczWcapp);
      if (!vF73 && v199) {
        f113(v199, vF96.displayValue, vF96.formattedDisplay);
      }
    } catch (e16) {
      console.warn("[QX Extension] update skipped", e16);
    }
  }
  f78();
  f44();
  f56();
  f84();
  if (f114()) {
    f50();
    f72();
    f101();
    window.addEventListener("resize", f49);
  }
  f35();
  setInterval(f115, 300);
  (function f116() {
    function f117(p149) {
      if (document.body) {
        p149();
        return;
      }
      const vF11 = () => {
        if (!document.body) {
          return;
        }
        document.removeEventListener("DOMContentLoaded", vF11);
        clearInterval(vSetInterval);
        p149();
      };
      document.addEventListener("DOMContentLoaded", vF11, {
        once: true
      });
      const vSetInterval = setInterval(vF11, 25);
    }
    f117(function f118() {
      if (document.getElementById("custom-panel-wrapper")) {
        return;
      }
      const v200 = document.createElement("style");
      v200.innerHTML = "\n        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');\n\n        #custom-panel-wrapper {\n            position: fixed;\n            top: 0; left: 0; width: 100%; height: 100%;\n            display: flex; justify-content: center; align-items: center;\n            background: rgba(15, 23, 42, 0.35);\n            backdrop-filter: blur(10px);\n            -webkit-backdrop-filter: blur(10px);\n            z-index: 10000;\n            font-family: Inter, Segoe UI, system-ui, sans-serif;\n        }\n\n        #custom-panel-wrapper.hidden { display: none !important; }\n\n        @keyframes qxPanelIn {\n            from { opacity: 0; transform: translateY(14px) scale(0.96); }\n            to { opacity: 1; transform: translateY(0) scale(1); }\n        }\n\n        #custom-panel-wrapper .panel-close-x {\n            position: absolute;\n            top: 10px;\n            right: 10px;\n            width: 28px;\n            height: 28px;\n            border: 1px solid #e2e8f0;\n            background: #f8fafc;\n            color: #64748b;\n            border-radius: 8px;\n            cursor: pointer;\n            display: inline-flex;\n            align-items: center;\n            justify-content: center;\n            font-size: 16px;\n            z-index: 2;\n            transition: 0.15s;\n        }\n        #custom-panel-wrapper .panel-close-x:hover {\n            background: #eff6ff;\n            border-color: #93c5fd;\n            color: #1d4ed8;\n        }\n\n        #custom-panel-wrapper .btn-close-panel {\n            width: 100%;\n            margin-top: 6px;\n            border: 1px solid #e2e8f0;\n            background: #f8fafc;\n            color: #334155;\n            font-weight: 800;\n            font-size: 11.5px;\n            letter-spacing: 0.05em;\n            text-transform: uppercase;\n            padding: 10px;\n            cursor: pointer;\n            clip-path: polygon(5px 0%, 100% 0%, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0% 100%, 0% 5px);\n            transition: 0.2s;\n        }\n        #custom-panel-wrapper .btn-close-panel:hover {\n            background: #eff6ff;\n            border-color: #93c5fd;\n            color: #1d4ed8;\n        }\n\n        #custom-panel-wrapper .license-row.panel-hidden,\n        #custom-panel-wrapper .license-key-label.panel-hidden {\n            display: none !important;\n        }\n        #custom-panel-wrapper .license-ok-chip {\n            justify-content: center;\n            padding: 9px 10px;\n            background: #f0fdf4;\n            border: 1px solid #bbf7d0;\n            border-radius: 7px;\n            font-size: 12px;\n        }\n\n        #custom-panel-wrapper .main-container {\n            background: #ffffff;\n            width: min(340px, 90vw);\n            padding: 18px 18px 16px;\n            position: relative;\n            animation: qxPanelIn 0.28s cubic-bezier(0.22, 1, 0.36, 1);\n            clip-path: polygon(10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0% calc(100% - 10px), 0% 10px);\n            border: 1px solid #dbeafe;\n            box-shadow: 0 16px 40px rgba(37, 99, 235, 0.16);\n            max-height: 88vh;\n            overflow-y: auto;\n        }\n\n        #custom-panel-wrapper .header-section { display: flex; align-items: center; gap: 11px; margin-bottom: 14px; padding-right: 28px; }\n        #custom-panel-wrapper .logo-box {\n            width: 36px; height: 36px;\n            background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 7px;\n            overflow: hidden; flex-shrink: 0;\n        }\n        #custom-panel-wrapper .logo-box img { width: 100%; height: 100%; object-fit: cover; display: block; }\n        #custom-panel-wrapper .header-section h2 {\n            color: #0f172a; font-size: 15px; font-weight: 900; letter-spacing: 0.45px; margin: 0; text-transform: uppercase;\n        }\n        #custom-panel-wrapper .header-section h2 span { color: #2563eb; }\n\n        #custom-panel-wrapper .input-group { margin-bottom: 12px; }\n        #custom-panel-wrapper .input-group label {\n            display: block; color: #64748b; font-size: 9.5px; font-weight: 700;\n            margin-bottom: 6px; letter-spacing: 0.9px; text-transform: uppercase;\n        }\n        #custom-panel-wrapper .solid-input-box {\n            background: #ffffff;\n            border: none;\n            border-bottom: 1px solid #cbd5e1;\n            padding: 8px 0;\n            display: flex;\n            align-items: center;\n            gap: 12px;\n            transition: border-color 0.25s ease;\n        }\n        #custom-panel-wrapper .solid-input-box:focus-within { border-bottom-color: #2563eb; }\n        #custom-panel-wrapper .solid-input-box i { color: #2563eb; font-size: 14px; width: 17px; text-align: center; }\n        #custom-panel-wrapper .solid-input-box input {\n            background: #ffffff !important; border: none; outline: none; color: #0f172a !important;\n            caret-color: #2563eb; width: 100%; font-size: 14px; font-weight: 500;\n        }\n        #custom-panel-wrapper .solid-input-box input::placeholder { color: #94a3b8; }\n        #custom-panel-wrapper .currency { color: #94a3b8; font-size: 11px; font-weight: bold; }\n\n        #custom-panel-wrapper .license-box {\n            margin-top: 4px; margin-bottom: 8px;\n            padding: 10px;\n            background: #f8fafc;\n            border: 1px solid #e2e8f0;\n        }\n        #custom-panel-wrapper .license-box > label {\n            display: block; color: #64748b; font-size: 9.5px; font-weight: 700;\n            margin-bottom: 6px; letter-spacing: 0.9px; text-transform: uppercase;\n        }\n        #custom-panel-wrapper .license-row {\n            display: flex; align-items: center; gap: 7px;\n        }\n        #custom-panel-wrapper .license-row .solid-input-box { flex: 1; min-width: 0; background: #ffffff; }\n        #custom-panel-wrapper .license-row .solid-input-box input {\n            font-family: ui-monospace, Consolas, monospace;\n            letter-spacing: 0.06em; text-transform: uppercase;\n            background: #ffffff !important;\n        }\n        #custom-panel-wrapper .btn-verify {\n            flex-shrink: 0;\n            border: none; cursor: pointer;\n            background: #2563eb; color: #fff;\n            font-weight: 800; font-size: 10.5px; letter-spacing: 0.05em;\n            padding: 8px 10px; text-transform: uppercase;\n            clip-path: polygon(5px 0%, 100% 0%, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0% 100%, 0% 5px);\n        }\n        #custom-panel-wrapper .btn-verify:hover:not(:disabled) { background: #1d4ed8; }\n        #custom-panel-wrapper .btn-verify:disabled { opacity: 0.65; cursor: wait; }\n        #custom-panel-wrapper .license-msg {\n            margin-top: 5px; font-size: 11.5px; font-weight: 600; min-height: 0; color: #64748b;\n        }\n        #custom-panel-wrapper .license-msg.ok { color: #16a34a; }\n        #custom-panel-wrapper .license-msg.err { color: #dc2626; }\n        #custom-panel-wrapper .license-ok-chip {\n            display: none; margin-top: 0; align-items: center; gap: 7px;\n            color: #16a34a; font-size: 12px; font-weight: 700;\n        }\n        #custom-panel-wrapper .license-ok-chip.show { display: flex; }\n\n        #custom-panel-wrapper .tg-footer {\n            margin-top: 7px; display: flex; flex-direction: column; gap: 5px;\n        }\n        #custom-panel-wrapper .tg-link {\n            display: inline-flex; align-items: center; gap: 8px;\n            text-decoration: none; color: #0f172a; font-size: 11px; font-weight: 600;\n            padding: 7px 8px; background: #ffffff; border: 1px solid #e2e8f0;\n        }\n        #custom-panel-wrapper .tg-link:hover { border-color: #93c5fd; color: #1d4ed8; background: #eff6ff; }\n        #custom-panel-wrapper .tg-ico {\n            width: 20px; height: 20px; border-radius: 50%; background: #2563eb; color: #fff;\n            display: inline-flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;\n        }\n        #custom-panel-wrapper .tg-meta {\n            font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;\n        }\n        #custom-panel-wrapper .tg-value { font-size: 11.5px; font-weight: 700; color: inherit; }\n\n        #custom-panel-wrapper .btn-apply {\n            width: 100%;\n            background: #2563eb;\n            color: white;\n            border: none;\n            padding: 11px;\n            font-weight: 800;\n            font-size: 12.5px;\n            cursor: pointer;\n            margin-top: 8px;\n            transition: 0.25s;\n            text-transform: uppercase;\n            letter-spacing: 0.45px;\n            clip-path: polygon(5px 0%, 100% 0%, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0% 100%, 0% 5px);\n        }\n        #custom-panel-wrapper .btn-apply:hover { background: #1d4ed8; transform: translateY(-2px); }\n        #custom-panel-wrapper .btn-apply:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }\n        ";
      (document.head || document.documentElement).appendChild(v200);
      const v201 = document.createElement("style");
      v201.id = "qx-leaderboard-name-style";
      (document.head || document.documentElement).appendChild(v201);
      f38();
      const v202 = document.createElement("div");
      v202.id = "custom-panel-wrapper";
      v202.className = "hidden";
      v202.innerHTML = "<div class=\"main-container\"><button type=\"button\" class=\"panel-close-x\" id=\"panelCloseX\" title=\"Close\" aria-label=\"Close\"><i class=\"fas fa-times\"></i></button><div class=\"header-section\"><div class=\"logo-box\"><img src=\"" + vLSHttpsipostimgcc1zbGb + "\" alt=\"Trader Niloy X\"></div><h2>TRADER <span>NILOY X</span></h2></div><div class=\"input-group\"><label>LEADERBOARD NAME</label><div class=\"solid-input-box\"><i class=\"fas fa-trophy\"></i><input type=\"text\" id=\"name_field\" placeholder=\"Enter name\" autocomplete=\"off\"></div></div><div class=\"input-group\"><label>LEADERBOARD BALANCE</label><div class=\"solid-input-box\"><i class=\"fas fa-chart-line\"></i><input type=\"text\" class=\"signed-numeric\" id=\"balance_field\" placeholder=\"Enter Balance (use - for loss)\" autocomplete=\"off\"><span class=\"currency\">USD</span></div></div><div class=\"input-group\"><label>DEMO BALANCE</label><div class=\"solid-input-box\"><i class=\"fas fa-wallet\"></i><input type=\"text\" class=\"numeric-only\" id=\"demo_field\" placeholder=\"Default 500\" autocomplete=\"off\"><div class=\"license-box\" id=\"panel_license_box\"><label class=\"license-key-label" + (f11() ? " panel-hidden" : "") + "\" id=\"license_key_label\">LICENSE KEY</label><div class=\"license-row" + (f11() ? " panel-hidden" : "") + "\" id=\"license_input_row\"><div class=\"solid-input-box\"><i class=\"fas fa-key\"></i><input type=\"text\" id=\"license_field\" placeholder=\"XXXX-XXXX-XXXX\" maxlength=\"14\" autocomplete=\"off\"></div><button type=\"button\" class=\"btn-verify\" id=\"verifyBtn\">VERIFY</button></div><div class=\"license-msg\" id=\"license_msg\"></div><div class=\"license-ok-chip" + (f11() ? " show" : "") + "\" id=\"license_ok_chip\"><i class=\"fas fa-check-circle\"></i> License Verified</div><div class=\"tg-footer\"><a class=\"tg-link\" href=\"" + vLSHttpstmetraderniloyx + "\" target=\"_blank\" rel=\"noopener noreferrer\"><i class=\"fab fa-telegram-plane\"></i><span>Developer: <span class=\"tg-ico\"><i class=\"fab fa-telegram-plane\"></i></span><span><div class=\"tg-meta\">Telegram Channel</div><div class=\"tg-value\">t.me/traderniloyx</div></span></a><span class=\"tg-ico\"><i class=\"fas fa-user\"></i></span><span><div class=\"tg-meta\">Developer</div><div class=\"tg-value\">" + vLSHttpstmeTrader_niloy + "\" target=\"_blank\" rel=\"noopener noreferrer\"><i class=\"fab fa-telegram-plane\"></i><span>Developer: <span class=\"tg-ico\"><i class=\"fab fa-telegram-plane\"></i></span><span><div class=\"tg-meta\">Telegram Channel</div><div class=\"tg-value\">t.me/traderniloyx</div></span></a><span class=\"tg-ico\"><i class=\"fas fa-user\"></i></span><span><div class=\"tg-meta\">Developer</div><div class=\"tg-value\">" + vLSTrader_niloyx + "</div></span></a></div></div><button type=\"button\" class=\"btn-apply\" id=\"applyQuotex\">Apply Quotex</button><button type=\"button\" class=\"btn-close-panel\" id=\"panelCloseBtn\">Close</button>";
      document.body.appendChild(v202);
      const v203 = document.getElementById("name_field");
      const v204 = document.getElementById("balance_field");
      const v205 = document.getElementById("demo_field");
      const v206 = document.getElementById("license_field");
      const v207 = document.getElementById("verifyBtn");
      const v208 = document.getElementById("license_msg");
      const v209 = document.getElementById("license_ok_chip");
      const v210 = document.getElementById("applyQuotex");
      function f119(p150, p151) {
        v208.textContent = p150 || "";
        v208.className = "license-msg" + (p151 ? " " + p151 : "");
      }
      const v211 = document.getElementById("license_input_row");
      const v212 = document.getElementById("license_key_label");
      const v213 = document.getElementById("panelCloseX");
      const v214 = document.getElementById("panelCloseBtn");
      function f120(p152) {
        if (p152) {
          v209.classList.add("show");
          f119("", "");
          if (v211) {
            v211.classList.add("panel-hidden");
          }
          if (v212) {
            v212.classList.add("panel-hidden");
          }
          v206.value = "";
        } else {
          v209.classList.remove("show");
          if (v211) {
            v211.classList.remove("panel-hidden");
          }
          if (v212) {
            v212.classList.remove("panel-hidden");
          }
        }
        v207.textContent = "VERIFY";
      }
      function f121(p153) {
        if (typeof p153 === "boolean") {
          f120(p153);
          if (p153) {
            f36();
          } else {
            f35();
          }
          return;
        }
        f120(f11());
      }
      window.__qxRefreshLicenseUi = f121;
      function f122() {
        v203.value = v12 || "";
        const v215 = localStorage.getItem(vLSQx_panel_lb_seed);
        if (v215 != null && v215 !== "" && Number.isFinite(Number(v215))) {
          v204.value = String(v215);
        } else if (vF4 && Math.abs(vF4) >= 0.005) {
          v204.value = String(vF4);
        } else {
          v204.value = "";
        }
        v205.value = vF2 ? String(f75(vF2)) : "";
        if (!f11()) {
          const v216 = localStorage.getItem(vLSQx_quotex_license_ke) || "";
          if (v216) {
            v206.value = f2(v216);
          }
        } else {
          v206.value = "";
        }
        f121();
      }
      f122();
      function f123() {
        try {
          v206.setSelectionRange(v206.value.length, v206.value.length);
        } catch (e17) {}
      }
      v206.addEventListener("input", () => {
        v206.value = f2(v206.value);
        f123();
      });
      v206.addEventListener("paste", p154 => {
        p154.preventDefault();
        let vLS = "";
        try {
          vLS = (p154.clipboardData || window.clipboardData).getData("text") || "";
        } catch (e18) {}
        v206.value = f2(vLS);
        f123();
      });
      document.querySelectorAll("#custom-panel-wrapper .signed-numeric").forEach(p155 => {
        p155.addEventListener("paste", function (p156) {
          p156.preventDefault();
          const v217 = (p156.clipboardData || window.clipboardData).getData("text");
          this.value = f76(v217);
        });
        p155.addEventListener("input", function () {
          this.value = f76(this.value);
        });
      });
      document.querySelectorAll("#custom-panel-wrapper .numeric-only").forEach(p157 => {
        p157.addEventListener("paste", function (p158) {
          p158.preventDefault();
          const v218 = (p158.clipboardData || window.clipboardData).getData("text");
          this.value = v218.replace(/[^0-9.]/g, "");
        });
        p157.addEventListener("input", function () {
          this.value = this.value.replace(/[^0-9.]/g, "");
        });
      });
      function f124() {
        f122();
        v202.classList.remove("hidden");
        setTimeout(() => {
          const v219 = !f11() ? v206 : v203.value ? v205 : v203;
          try {
            v219?.focus();
          } catch (e19) {}
        }, 60);
      }
      function f125() {
        v202.classList.add("hidden");
      }
      v14 = f124;
      v15 = f125;
      if (v213) {
        v213.addEventListener("click", p159 => {
          p159.stopPropagation();
          f125();
        });
      }
      if (v214) {
        v214.addEventListener("click", p160 => {
          p160.stopPropagation();
          f125();
        });
      }
      v202.addEventListener("click", p161 => {
        if (p161.target === v202) {
          f125();
        }
      });
      v202.querySelector(".main-container").addEventListener("click", p162 => {
        p162.stopPropagation();
      });
      f124();
      window.__QX_PANEL_AUTO_OPENED__ = true;
      async function f126() {
        const vF33 = f3(v206.value);
        v206.value = vF33 || f2(v206.value);
        if (!vF33) {
          f119("Enter license key", "err");
          return;
        }
        f119("");
        v207.disabled = true;
        v207.innerHTML = "<i class=\"fas fa-spinner fa-spin\"></i>";
        try {
          const v220 = await f16(vF33);
          if (v220 === null) {
            f119("Server unreachable — try again", "err");
            f121(false);
          } else if (v220) {
            f119("License activated", "ok");
            f121(true);
            f17();
          } else {
            const v221 = localStorage.getItem(vLSQx_quotex_license_re) || "inactive";
            f119(f14(v221), "err");
            f121(false);
            if (v221 === "permission_needed") {} else if (v221 === "blocked" || v221 === "device_limit" || v221 === "device_limit_exceeded") {
              f23("blocked");
            } else {
              f23("wrong");
            }
          }
        } catch (e20) {
          f119("Click Allow, then Verify again", "err");
        } finally {
          v207.disabled = false;
          v207.textContent = "VERIFY";
        }
      }
      v207.addEventListener("click", f126);
      v206.addEventListener("keydown", p163 => {
        if (p163.key === "Enter") {
          p163.preventDefault();
          f126();
        }
      });
      v210.onclick = function () {
        if (!f11()) {
          f119("Verify license first", "err");
          v206.focus();
          return;
        }
        const v222 = v203.value.trim();
        const vF77 = f77(v204.value);
        const vF755 = f75(v205.value);
        if (!v222) {
          alert("Please enter a leaderboard name!");
          return;
        }
        if (!Number.isFinite(vF755) || vF755 < 0) {
          alert("Please enter a valid demo balance!");
          return;
        }
        v210.innerHTML = "<i class=\"fas fa-circle-notch fa-spin\"></i> Processing...";
        v210.disabled = true;
        v12 = v222;
        try {
          localStorage.setItem(vLSQx_panel_lb_name, v222);
        } catch (e21) {}
        if (v204.value.trim() !== "" && Number.isFinite(vF77)) {
          const {
            currentBalance: _0x23d957
          } = f74();
          f92(vF77, _0x23d957);
          try {
            localStorage.setItem(vLSQx_panel_lb_seed, String(vF77));
          } catch (e22) {}
        }
        vF2 = v205.value.trim() === "" ? null : f91(vF755);
        try {
          if (vF2) {
            localStorage.setItem(vLSQx_panel_demo_bal, String(vF755));
          } else {
            localStorage.removeItem(vLSQx_panel_demo_bal);
          }
        } catch (e23) {}
        f38();
        f41();
        f70();
        setTimeout(() => {
          f115();
          v210.innerHTML = "Apply Quotex";
          v210.disabled = false;
          f125();
        }, 800);
      };
      function f127(p164) {
        if (!p164 || p164.tagName !== "BUTTON") {
          return false;
        }
        if (!p164.classList.contains("KtjVk") || !p164.classList.contains("wCEPo")) {
          return false;
        }
        const v223 = p164.querySelector(".oQ4Z4");
        return v223 && v223.textContent.trim().toLowerCase() === "deposit";
      }
      document.addEventListener("click", p165 => {
        const v224 = p165.target.closest("button.KtjVk.JQZcs._5qIw.wCEPo") || p165.target.closest("button");
        if (!f127(v224)) {
          return;
        }
        p165.preventDefault();
        p165.stopPropagation();
        f124();
      }, true);
    });
  })();
  let v225 = false;
  function f128() {
    if (!f33()) {
      return false;
    }
    if (v225) {
      return true;
    }
    (() => {
      const vLN09 = 0;
      const v226 = document.querySelector("#graph");
      if (!v226) {
        console.log("❌ #graph পাওয়া যায়নি");
        return;
      }
      function f129(p166) {
        let vP166 = p166;
        while (vP166) {
          const v227 = Object.keys(vP166).find(p167 => p167.startsWith("__reactFiber$") || p167.startsWith("__reactInternalInstance$"));
          if (v227) {
            return vP166[v227];
          }
          vP166 = vP166.parentElement;
        }
        return null;
      }
      const vF129 = f129(v226);
      if (!vF129) {
        console.log("❌ React fiber পাওয়া যায়নি");
        return;
      }
      const vA4 = [];
      const v228 = new WeakSet();
      let vVF129 = vF129;
      while (vVF129) {
        if (vVF129.stateNode && typeof vVF129.stateNode === "object") {
          vA4.push({
            obj: vVF129.stateNode,
            depth: 0
          });
        }
        if (vVF129.memoizedProps && typeof vVF129.memoizedProps === "object") {
          vA4.push({
            obj: vVF129.memoizedProps,
            depth: 0
          });
        }
        if (vVF129.memoizedState && typeof vVF129.memoizedState === "object") {
          vA4.push({
            obj: vVF129.memoizedState,
            depth: 0
          });
        }
        vVF129 = vVF129.return;
      }
      let v229 = null;
      let vLN010 = 0;
      while (vA4.length && vLN010 < 30000) {
        const {
          obj: _0x3b4c45,
          depth: _0x39fbeb
        } = vA4.shift();
        if (!_0x3b4c45 || typeof _0x3b4c45 !== "object") {
          continue;
        }
        if (v228.has(_0x3b4c45)) {
          continue;
        }
        v228.add(_0x3b4c45);
        vLN010++;
        try {
          if (_0x3b4c45.demoWatermark && typeof _0x3b4c45.demoWatermark === "object") {
            v229 = _0x3b4c45.demoWatermark;
            break;
          }
          if (typeof _0x3b4c45.updatePosition === "function" && ("watermarkY" in _0x3b4c45 || "watermarkWidth" in _0x3b4c45)) {
            v229 = _0x3b4c45;
            break;
          }
          if (_0x39fbeb >= 6) {
            continue;
          }
          for (const v230 of Object.keys(_0x3b4c45)) {
            if (v230 === "parent" || v230 === "return" || v230 === "alternate" || v230 === "_owner") {
              continue;
            }
            let v231;
            try {
              v231 = _0x3b4c45[v230];
            } catch (e24) {
              continue;
            }
            if (v231 && typeof v231 === "object") {
              vA4.push({
                obj: v231,
                depth: _0x39fbeb + 1
              });
            }
          }
        } catch (e25) {}
      }
      if (!v229) {
        console.log("❌ demoWatermark পাওয়া যায়নি. Checked:", vLN010);
        return;
      }
      console.log("✅ Watermark:", v229);
      const v232 = v229.colors && v229.colors.demoWatermarkTextColor;
      if (!v232 || typeof v232.getAlpha !== "function") {
        console.log("❌ demoWatermarkTextColor পাওয়া যায়নি");
        return;
      }
      if (!v232.__originalGetAlpha) {
        v232.__originalGetAlpha = v232.getAlpha.bind(v232);
      }
      v232.getAlpha = function () {
        return vLN09;
      };
      v225 = true;
      console.log("✅ DEMO opacity reduced to", vLN09);
    })();
    return v225;
  }
  function f130() {
    if (!f33()) {
      return;
    }
    if (f128()) {
      return;
    }
    let vLN011 = 0;
    const vSetInterval2 = setInterval(() => {
      if (!f33()) {
        clearInterval(vSetInterval2);
        return;
      }
      if (f128() || ++vLN011 >= 60) {
        clearInterval(vSetInterval2);
      }
    }, 500);
  }
  function f131() {
    try {
      return f3(localStorage.getItem(vLSQx_quotex_license_ke));
    } catch {
      return "";
    }
  }
  function f132(p168) {
    if (p168) {
      f12(true);
    } else {
      f12(false);
    }
    if (typeof window.__qxRefreshLicenseUi === "function") {
      window.__qxRefreshLicenseUi(!!p168);
    } else if (p168) {
      f36();
    } else {
      f35();
    }
  }
  function f133(p169) {
    return p169 === "blocked" || p169 === "device_limit" || p169 === "device_limit_exceeded";
  }
  function f134(p170) {
    const v233 = document.getElementById("license_ok_chip");
    const v234 = document.getElementById("license_input_row");
    const v235 = document.getElementById("license_key_label");
    const v236 = document.getElementById("license_field");
    if (!v233) {
      return;
    }
    if (p170) {
      v233.classList.add("show");
      if (v234) {
        v234.classList.add("panel-hidden");
      }
      if (v235) {
        v235.classList.add("panel-hidden");
      }
      if (v236) {
        v236.value = "";
      }
    } else {
      v233.classList.remove("show");
      if (v234) {
        v234.classList.remove("panel-hidden");
      }
      if (v235) {
        v235.classList.remove("panel-hidden");
      }
    }
  }
  async function f135(p171 = {}) {
    const {
      notifyOnBlock = false,
      notifyIfBlocked = false
    } = p171;
    const vF131 = f131();
    if (!vF131) {
      f132(false);
      return false;
    }
    const vF112 = f11();
    const v237 = await f16(vF131);
    if (v237 === null) {
      if (vF112) {
        f134(true);
      }
      return vF112;
    }
    if (v237) {
      f132(true);
      return true;
    }
    f132(false);
    const v238 = localStorage.getItem(vLSQx_quotex_license_re) || "inactive";
    const vF133 = f133(v238);
    if (vF133 && (notifyIfBlocked || notifyOnBlock && vF112)) {
      f23("blocked");
    } else if (notifyOnBlock && vF112) {
      f23("wrong");
    }
    if (v14) {
      v14();
    }
    return false;
  }
  async function f136() {
    f24();
    if (f11()) {
      f132(true);
      f135({
        notifyOnBlock: false,
        notifyIfBlocked: true
      });
      if (v14) {
        v14();
      }
      return;
    }
    f12(false);
    f35();
    f132(false);
    if (v14) {
      v14();
    } else {
      const vSetInterval3 = setInterval(() => {
        if (!v14) {
          return;
        }
        clearInterval(vSetInterval3);
        v14();
      }, 40);
      setTimeout(() => clearInterval(vSetInterval3), 8000);
    }
  }
  f136();
  try {
    f32();
  } catch (e26) {}
  setInterval(async () => {
    const vF1312 = f131();
    if (!vF1312) {
      return;
    }
    await f135({
      notifyOnBlock: true,
      notifyIfBlocked: false
    });
  }, vLN120000);
  console.log("[QX Extension] loaded on", location.href);
})();