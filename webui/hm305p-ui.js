/* HM305P / HM310P – custom web UI for the ESPHome web_server (v3).
 * Served by the ESP itself as /0.js (web_server: js_include).
 * Uses the ESPHome REST API + Server-Sent Events (/events). No internet needed.
 * The original ESPHome page stays available via the "ESPHome view" button.
 * MIT License – https://github.com/danneloi/hm305p-esphome
 */
(function () {
  "use strict";

  // ---------- entity mapping (EN + DE entity names, normalised) ----------
  const KEYS = {
    v: ["voltage", "spannung"],
    i: ["current", "strom"],
    p: ["power", "leistung"],
    out: ["output", "ausgang"],
    mode: ["operatingmode", "betriebsmodus"],
    prot: ["protectionstatus", "schutzstatus"],
    setv: ["setvoltage", "sollspannung"],
    seti: ["currentlimit", "strombegrenzung"],
    ovp: ["ovplimit", "ovpgrenzwert"],
    ocp: ["ocplimit", "ocpgrenzwert"],
    opp: ["opplimit", "oppgrenzwert"],
    beep: ["keybeep", "tastenton"],
    model: ["modelid", "modellkennung"],
    wifi: ["wifisignal", "wlansignal"],
    p33: ["preset33v05a"],
    p5: ["preset5v1a"],
    p12: ["preset12v2a"],
    p20: ["preset20v2a"],
    short: ["shorthunting1v1a", "kurzschlusssuche1v1a"],
    m1: ["loadm1", "m1laden"], m2: ["loadm2", "m2laden"], m3: ["loadm3", "m3laden"],
    m4: ["loadm4", "m4laden"], m5: ["loadm5", "m5laden"], m6: ["loadm6", "m6laden"],
  };
  const DE_HINT = ["spannung", "ausgang", "sollspannung"];

  // ---------- texts ----------
  const TXT = {
    en: {
      title: "Bench power supply", vlab: "Voltage", ilab: "Current", plab: "Power", output: "Output", on: "ON", off: "OFF",
      setv: "Set voltage", seti: "Current limit", ovp: "OVP limit", ocp: "OCP limit",
      apply: "Set", presets: "Presets", memory: "Device memory",
      short: "Short hunting", presetHint: "Presets switch the output off first. Turn it on afterwards.",
      prot: "Protection", ok: "OK", mode: "Mode", device: "Device",
      beep: "Key beep", opp: "OPP limit", model: "Model ID", wifi: "WiFi",
      offline: "No connection to the device …", connected: "Connected",
      haTitle: "Add to Home Assistant (optional)",
      haText: "Home Assistant usually finds this device automatically (notification “New device discovered”). Otherwise add it manually with the ESPHome integration:",
      haHost: "Host", haPort: "Port", haBtn: "Open in Home Assistant",
      espView: "ESPHome view", backView: "Back to panel",
      tripped: "Protection tripped", setFail: "Command failed",
    },
    de: {
      title: "Labornetzteil", vlab: "Spannung", ilab: "Strom", plab: "Leistung", output: "Ausgang", on: "AN", off: "AUS",
      setv: "Sollspannung", seti: "Strombegrenzung", ovp: "OVP-Grenzwert", ocp: "OCP-Grenzwert",
      apply: "Setzen", presets: "Presets", memory: "Gerätespeicher",
      short: "Kurzschlusssuche", presetHint: "Presets schalten den Ausgang zuerst aus. Danach selbst einschalten.",
      prot: "Schutz", ok: "OK", mode: "Modus", device: "Gerät",
      beep: "Tastenton", opp: "OPP-Grenzwert", model: "Modellkennung", wifi: "WLAN",
      offline: "Keine Verbindung zum Gerät …", connected: "Verbunden",
      haTitle: "Zu Home Assistant hinzufügen (optional)",
      haText: "Home Assistant findet dieses Gerät meist automatisch (Meldung „Neues Gerät gefunden“). Sonst manuell über die ESPHome-Integration hinzufügen:",
      haHost: "Host", haPort: "Port", haBtn: "In Home Assistant öffnen",
      espView: "ESPHome-Ansicht", backView: "Zurück zum Bedienfeld",
      tripped: "Schutz ausgelöst", setFail: "Befehl fehlgeschlagen",
    },
  };
  let lang = (navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en";
  const t = (k) => TXT[lang][k] || TXT.en[k] || k;

  // ---------- state ----------
  const ent = {};   // logical key -> {domain, url, value, state}
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const keyFor = (obj) => {
    const n = norm(obj);
    for (const k in KEYS) if (KEYS[k].includes(n)) return k;
    return null;
  };

  // ---------- styles ----------
  const css = `
  :root{--bg:#0e1116;--card:#171b22;--line:#2a313b;--txt:#e6edf3;--mut:#8b949e;
        --v:#ffb300;--i:#29b6f6;--p:#ef5350;--ok:#3fb950;--bad:#f85149}
  #psu{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--txt);
       background:var(--bg);min-height:100vh;padding:16px;box-sizing:border-box}
  #psu *{box-sizing:border-box}
  #psu .wrap{max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
  #psu .top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  #psu h1{font-size:22px;margin:0;font-weight:700}
  #psu .dot{width:10px;height:10px;border-radius:50%;background:var(--bad)}
  #psu .dot.on{background:var(--ok)}
  #psu .conn{font-size:13px;color:var(--mut)}
  #psu .sp{flex:1}
  #psu button{font:inherit;color:var(--txt);background:#222a35;border:1px solid var(--line);
       border-radius:10px;padding:9px 14px;cursor:pointer}
  #psu button:hover{background:#2b3542}
  #psu button:disabled{opacity:.4;cursor:default}
  #psu .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
  #psu .lcd{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  #psu .lcd .card{text-align:center;padding:18px 8px}
  #psu .big{font-family:ui-monospace,"DejaVu Sans Mono",monospace;font-size:44px;font-weight:700;
       letter-spacing:1px;line-height:1.1}
  #psu .unit{font-size:20px;color:var(--mut);margin-left:4px}
  #psu .lab{font-size:13px;color:var(--mut);margin-top:6px}
  #psu .v{color:var(--v)} #psu .i{color:var(--i)} #psu .p{color:var(--p)}
  #psu .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  #psu .outbtn{font-size:20px;font-weight:700;padding:16px 26px;min-width:190px;border-radius:14px}
  #psu .outbtn.on{background:var(--ok);border-color:var(--ok);color:#06210d}
  #psu .badge{padding:6px 12px;border-radius:999px;background:#222a35;font-size:14px}
  #psu .badge.bad{background:var(--bad);color:#fff}
  #psu .badge.cc{background:#7a4a00;color:#ffd27a}
  #psu .grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  #psu .set .name{font-size:13px;color:var(--mut);margin-bottom:8px}
  #psu .set .ctl{display:flex;gap:6px;align-items:center}
  #psu .set .ctl button{padding:9px 11px;flex:0 0 auto}
  #psu .set input{flex:1;min-width:0;font:inherit;font-size:18px;text-align:center;color:var(--txt);
       background:#0e1116;border:1px solid var(--line);border-radius:10px;padding:8px}
  #psu .set .cur{font-size:12px;color:var(--mut);margin-top:6px}
  #psu .presets{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  #psu .mem{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
  #psu .hint{font-size:12.5px;color:var(--mut);margin:8px 0 0}
  #psu h2{font-size:15px;margin:0 0 10px;font-weight:600}
  #psu .kv{display:grid;grid-template-columns:1fr auto;gap:8px 16px;font-size:14px}
  #psu .kv span:nth-child(even){color:var(--mut);text-align:right}
  #psu code{background:#0e1116;border:1px solid var(--line);border-radius:6px;padding:2px 6px}
  #psu a.btn{display:inline-block;text-decoration:none;color:#fff;background:#03a9f4;
       border-radius:10px;padding:9px 14px;margin-top:10px}
  #psu .toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--bad);
       color:#fff;padding:10px 16px;border-radius:10px;display:none}
  @media(max-width:720px){#psu .lcd{grid-template-columns:1fr}#psu .big{font-size:38px}
       #psu .grid2{grid-template-columns:1fr}#psu .presets{grid-template-columns:repeat(2,1fr)}
       #psu .mem{grid-template-columns:repeat(3,1fr)}}
  body.psu-ui > esp-app{display:none}
  `;

  // ---------- layout ----------
  function render() {
    const host = location.hostname;
    return `
    <div class="wrap">
      <div class="top">
        <h1>⚡ <span data-t="title"></span></h1>
        <span class="dot" id="dot"></span><span class="conn" id="conn"></span>
        <span class="sp"></span>
        <button id="lang">${lang === "de" ? "EN" : "DE"}</button>
        <button id="espview" data-t="espView"></button>
      </div>

      <div class="lcd">
        <div class="card"><div class="big v"><span id="vv">--.--</span><span class="unit">V</span></div><div class="lab" data-t="vlab"></div></div>
        <div class="card"><div class="big i"><span id="iv">-.---</span><span class="unit">A</span></div><div class="lab" data-t="ilab"></div></div>
        <div class="card"><div class="big p"><span id="pv">--.--</span><span class="unit">W</span></div><div class="lab" data-t="plab"></div></div>
      </div>

      <div class="card row">
        <button class="outbtn" id="out"></button>
        <span class="badge" id="mode">–</span>
        <span class="badge" id="prot">–</span>
      </div>

      <div class="grid2">
        ${setCard("setv", "V", 0.1, 2)}
        ${setCard("seti", "A", 0.01, 3)}
        ${setCard("ovp", "V", 0.1, 2)}
        ${setCard("ocp", "A", 0.01, 3)}
      </div>

      <div class="card">
        <h2 data-t="presets"></h2>
        <div class="presets">
          <button data-press="p33">3.3 V · 0.5 A</button>
          <button data-press="p5">5 V · 1 A</button>
          <button data-press="p12">12 V · 2 A</button>
          <button data-press="p20">20 V · 2 A</button>
          <button data-press="short" data-t="short"></button>
        </div>
        <p class="hint" data-t="presetHint"></p>
        <h2 style="margin-top:14px" data-t="memory"></h2>
        <div class="mem">
          ${[1,2,3,4,5,6].map(n => `<button data-press="m${n}">M${n}</button>`).join("")}
        </div>
      </div>

      <div class="grid2">
        <div class="card">
          <h2 data-t="device"></h2>
          <div class="kv">
            <span data-t="beep"></span><span><button id="beep" style="padding:4px 12px">–</button></span>
            <span data-t="opp"></span><span id="opp">–</span>
            <span data-t="model"></span><span id="model">–</span>
            <span data-t="wifi"></span><span id="wifi">–</span>
          </div>
        </div>
        <div class="card">
          <h2 data-t="haTitle"></h2>
          <div style="font-size:13.5px;color:var(--mut)" data-t="haText"></div>
          <div class="kv" style="margin-top:10px">
            <span data-t="haHost"></span><span><code>${host}</code></span>
            <span data-t="haPort"></span><span><code>6053</code></span>
          </div>
          <a class="btn" target="_blank" rel="noopener"
             href="https://my.home-assistant.io/redirect/config_flow_start/?domain=esphome" data-t="haBtn"></a>
        </div>
      </div>
    </div>
    <div class="toast" id="toast"></div>`;
  }
  function setCard(key, unit, step, dec) {
    return `<div class="card set">
      <div class="name" data-t="${key}"></div>
      <div class="ctl">
        <button data-step="${key}" data-d="-${step}">−</button>
        <input id="in-${key}" type="number" step="${step}" inputmode="decimal" data-dec="${dec}">
        <button data-step="${key}" data-d="${step}">+</button>
        <button data-apply="${key}" data-t="apply"></button>
      </div>
      <div class="cur"><span id="cur-${key}">–</span> ${unit}</div>
    </div>`;
  }
  function applyTexts() {
    document.querySelectorAll("#psu [data-t]").forEach(el => { el.textContent = t(el.dataset.t); });
    document.getElementById("lang").textContent = lang === "de" ? "EN" : "DE";
    const dot = document.getElementById("dot");
    if (dot) setText("conn", dot.classList.contains("on") ? t("connected") : t("offline"));
    updateAll();
  }

  // ---------- REST commands ----------
  async function post(url) {
    try {
      const r = await fetch(url, { method: "POST" });
      if (!r.ok) throw new Error(r.status);
    } catch (e) { toast(t("setFail")); }
  }
  const cmd = {
    press: (k) => ent[k] && post(ent[k].url + "/press"),
    sw: (k, on) => ent[k] && post(ent[k].url + (on ? "/turn_on" : "/turn_off")),
    num: (k, v) => ent[k] && post(ent[k].url + "/set?value=" + encodeURIComponent(v)),
  };
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg; el.style.display = "block";
    clearTimeout(toast._t); toast._t = setTimeout(() => el.style.display = "none", 2500);
  }

  // ---------- display ----------
  const fmt = (v, d) => (v === undefined || v === null || isNaN(v)) ? null :
    Number(v).toFixed(d).replace(".", lang === "de" ? "," : ".");
  const val = (k) => ent[k] && ent[k].value;
  const sval = (k) => ent[k] && (ent[k].state !== undefined ? ent[k].state : ent[k].value);
  function setText(id, s) { const el = document.getElementById(id); if (el) el.textContent = s; }

  function updateAll() {
    setText("vv", fmt(val("v"), 2) || "--.--");
    setText("iv", fmt(val("i"), 3) || "-.---");
    setText("pv", fmt(val("p"), 2) || "--.--");

    const on = val("out") === true || sval("out") === "ON";
    const ob = document.getElementById("out");
    ob.textContent = "⏻ " + t("output") + ": " + (on ? t("on") : t("off"));
    ob.classList.toggle("on", on); ob.disabled = !ent.out; ob.dataset.on = on ? "1" : "";

    const mode = sval("mode");
    const mb = document.getElementById("mode");
    mb.textContent = t("mode") + ": " + (mode || "–");
    mb.classList.toggle("cc", /^CC/.test(mode || ""));

    const prot = sval("prot");
    const pb = document.getElementById("prot");
    const okp = !prot || prot === "OK" || /unknown|unbekannt/i.test(prot);
    pb.textContent = okp ? t("prot") + ": " + (prot ? t("ok") : "–") : "⚠ " + t("tripped") + ": " + prot;
    pb.classList.toggle("bad", !okp);

    [["setv", 2], ["seti", 3], ["ovp", 2], ["ocp", 3]].forEach(([k, d]) => {
      setText("cur-" + k, fmt(val(k), d) || "–");
      const inp = document.getElementById("in-" + k);
      if (inp && document.activeElement !== inp && val(k) !== undefined) inp.value = Number(val(k)).toFixed(d);
    });

    const beep = val("beep") === true || sval("beep") === "ON";
    const bb = document.getElementById("beep");
    bb.textContent = ent.beep ? (beep ? t("on") : t("off")) : "–"; bb.dataset.on = beep ? "1" : "";
    setText("opp", fmt(val("opp"), 1) ? fmt(val("opp"), 1) + " W" : "–");
    setText("model", val("model") !== undefined ? String(Math.round(val("model"))) : "–");
    setText("wifi", val("wifi") !== undefined ? Math.round(val("wifi")) + " dBm" : "–");

    document.querySelectorAll("#psu [data-press]").forEach(b => { b.disabled = !ent[b.dataset.press]; });
  }

  // ---------- events ----------
  function onState(d) {
    if (!d || !d.id) return;
    const m = String(d.id).match(/^([a-z_]+)[-\/](.+)$/);
    if (!m) return;
    const domain = m[1], obj = m[2];
    const k = keyFor(obj) || (d.name ? keyFor(d.name) : null);
    if (!k) return;
    if (k === "v" || k === "setv") if (domain !== (k === "v" ? "sensor" : "number")) return;
    if (k === "i" || k === "seti") if (domain !== (k === "i" ? "sensor" : "number")) return;
    ent[k] = Object.assign(ent[k] || {}, {
      domain, url: "/" + domain + "/" + encodeURIComponent(obj),
      value: d.value, state: d.state,
    });
    if (DE_HINT.includes(norm(obj)) && !connect._langSet) { lang = "de"; connect._langSet = true; applyTexts(); }
    schedule();
  }
  let pend = false;
  function schedule() { if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; updateAll(); }); } }

  function connect() {
    const es = new EventSource("/events");
    const dot = document.getElementById("dot");
    es.onopen = () => { dot.classList.add("on"); setText("conn", t("connected")); };
    es.onerror = () => { dot.classList.remove("on"); setText("conn", t("offline")); };
    es.addEventListener("state", e => { try { onState(JSON.parse(e.data)); } catch (_) {} });
  }

  // ---------- wiring ----------
  function bind() {
    const root = document.getElementById("psu");
    root.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "out") return cmd.sw("out", !b.dataset.on);
      if (b.id === "beep") return cmd.sw("beep", !b.dataset.on);
      if (b.id === "lang") { lang = lang === "de" ? "en" : "de"; connect._langSet = true; return applyTexts(); }
      if (b.id === "espview") {
        const show = document.body.classList.toggle("psu-ui");
        document.getElementById("psu").style.display = show ? "" : "none";
        if (!show) showBack();
        return;
      }
      if (b.dataset.press) return cmd.press(b.dataset.press);
      if (b.dataset.step) {
        const inp = document.getElementById("in-" + b.dataset.step);
        const d = Number(inp.dataset.dec);
        inp.value = Math.max(0, (Number(inp.value) || 0) + Number(b.dataset.d)).toFixed(d);
        return;
      }
      if (b.dataset.apply) {
        const v = Number(document.getElementById("in-" + b.dataset.apply).value);
        if (!isNaN(v)) cmd.num(b.dataset.apply, v);
      }
    });
    root.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.id && e.target.id.startsWith("in-")) {
        const k = e.target.id.slice(3), v = Number(e.target.value);
        if (!isNaN(v)) cmd.num(k, v);
      }
    });
  }
  function showBack() {
    let b = document.getElementById("psu-back");
    if (!b) {
      b = document.createElement("button");
      b.id = "psu-back";
      b.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:9999;padding:10px 14px;border-radius:10px;border:0;background:#03a9f4;color:#fff;font:14px system-ui;cursor:pointer";
      b.onclick = () => { document.body.classList.add("psu-ui"); document.getElementById("psu").style.display = ""; b.remove(); };
      document.body.appendChild(b);
    }
    b.textContent = t("backView");
  }

  function init() {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const root = document.createElement("div"); root.id = "psu"; root.innerHTML = render();
    document.body.prepend(root);
    document.body.classList.add("psu-ui");
    document.title = "HM305P";
    applyTexts(); bind(); connect();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
