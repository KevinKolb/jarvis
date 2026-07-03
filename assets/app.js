/* =========================================================
   JARVIS — Residence Butler
   Edit CONFIG to match your own iOS Shortcuts. Every control
   fires shortcuts://run-shortcut?name=<Shortcut Name>, so
   music playback lives on Alexa/HomePod and keeps going after
   the phone walks away.
   ========================================================= */

const CONFIG = {
  // SiriusXM channels shown under "Kitchen speakers".
  // `shortcut` is the exact name of the iOS Shortcut to run.
  channels: [
    { title: "Life with John Mayer", ch: "Ch 4",   shortcut: "Kitchen-SXM-JohnMayer" },
    { title: "Yacht Rock Radio",     ch: "Ch 311", shortcut: "Kitchen-SXM-YachtRock" },
    { title: "The Bridge",           ch: "Ch 32",  shortcut: "Kitchen-SXM-TheBridge" },
    { title: "SiriusXM Chill",       ch: "Ch 53",  shortcut: "Kitchen-SXM-Chill" },
    { title: "The Beatles Channel",  ch: "Ch 18",  shortcut: "Kitchen-SXM-Beatles" },
    { title: "Classic Vinyl",        ch: "Ch 26",  shortcut: "Kitchen-SXM-ClassicVinyl" },
    { title: "The Blend",            ch: "Ch 16",  shortcut: "Kitchen-SXM-TheBlend" },
    { title: "Coffee House",         ch: "Ch 14",  shortcut: "Kitchen-SXM-CoffeeHouse" },
  ],
  channelsVisible: 3, // how many to show before "+ N more channels"

  podcasts: [
    { title: "Latest episodes", meta: "Your podcast queue", shortcut: "Kitchen-Podcast-Latest" },
  ],

  /* ---- How controls fire ----------------------------------------------
     mode "shortcut": tap opens the Shortcuts app and runs the named
                      Shortcut. Music uses this (Alexa has no local API).
     mode "fetch":    tap fires a silent request — NO app switch. Actions
                      listed in `endpoints` use it; anything else falls
                      back to a Shortcut.

     Hue lights go through the Pi's built-in relay (server.py) at POST
     /hue — the browser never contacts the bridge directly (browsers block
     the PUT/CORS request a Hue bridge needs). The bridge IP + token live
     in server.py on the Pi, NOT in this public file.
  --------------------------------------------------------------------- */
  control: {
    mode: "fetch",             // "shortcut" | "fetch"

    endpoints: {
      // Kitchen = Hue group 82. The toggle button sends On or Off based on
      // the light's current state. `path` + `body` are forwarded to the
      // bridge by the Pi relay.
      "Kitchen Lights On":  { hue: { path: "/groups/82/action", body: { on: true } } },
      "Kitchen Lights Off": { hue: { path: "/groups/82/action", body: { on: false } } },

      // Non-Hue example (Home Assistant webhook, direct https):
      //   "Kitchen Lights On": { url: "https://<YOUR-HA>/api/webhook/kitchen_lights_on" },
    },
  },
};

/* ---------- Icons ---------- */
const RADIO_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.5M19.1 4.9a10 10 0 0 1 0 14.2M16.2 7.8a6 6 0 0 1 0 8.5"/><circle cx="12" cy="12" r="2"/></svg>';
const PODCAST_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v4a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4M8 22h8"/></svg>';
const CHEV_ICON = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

/* ---------- Toast (butler voice) ---------- */
let toastTimer = null;
function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.innerHTML =
    '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' +
    '<span></span>';
  el.querySelector("span").textContent = message;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------- Run an iOS Shortcut (opens Shortcuts app) ---------- */
function runShortcut(name) {
  if (!name) return;
  // Give the toast a beat to render before the app switch on iOS.
  window.setTimeout(() => {
    window.location.href = "shortcuts://run-shortcut?name=" + encodeURIComponent(name);
  }, 180);
}

/* ---------- Fire a silent background request (no app switch) ---------- */
function runFetch(req) {
  fetch(req.url, {
    method: req.method || "POST",
    headers: req.body ? { "Content-Type": "application/json" } : undefined,
    body: req.body || undefined,
    mode: "no-cors",     // fire-and-forget; response is opaque
    keepalive: true,
  }).catch(() => { /* ignore — request still leaves the device */ });
}

/* ---------- Ask the Pi relay to talk to the Hue bridge ---------- */
function runHueProxy(hue) {
  fetch("/hue", {                       // same-origin: the Pi, not the bridge
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hue),
    keepalive: true,
  }).catch(() => { /* relay unreachable — Pi off, or not on SpamNet */ });
}

/* ---------- Read + show current light status ---------- */
const LIGHTS_GROUP = "82";   // kitchen Hue group
const LIGHTS_SAMPLE = "22";  // a representative bulb in that group (true color)
let lightsOn = null;         // true / false / null (unknown)
let pendingColor = null;     // { body, css } chosen while OFF, applied on next turn-on
let pendingBri = null;       // brightness chosen while OFF, applied on next turn-on
let selectedSwatchEl = null; // currently highlighted swatch

function selectSwatch(el) {
  if (selectedSwatchEl) selectedSwatchEl.classList.remove("sel");
  selectedSwatchEl = el;
  if (el) el.classList.add("sel");
}

// Send a state change to the kitchen group via the Pi relay.
function runHue(body) {
  runHueProxy({ path: "/groups/" + LIGHTS_GROUP + "/action", body: body });
}

// White + ROYGBIV. `css` is the swatch color; `body` is sent to the bridge.
// (White uses color temperature; the rest use Hue's 0–65535 hue wheel.)
const COLORS = [
  { name: "White",  css: "#ffffff", body: { on: true, sat: 0, ct: 250 } },
  { name: "Red",    css: "#e53935", body: { on: true, hue: 0,     sat: 254 } },
  { name: "Orange", css: "#fb8c00", body: { on: true, hue: 4500,  sat: 254 } },
  { name: "Yellow", css: "#fdd835", body: { on: true, hue: 10500, sat: 254 } },
  { name: "Green",  css: "#43a047", body: { on: true, hue: 25500, sat: 254 } },
  { name: "Blue",   css: "#1e88e5", body: { on: true, hue: 43690, sat: 254 } },
  { name: "Indigo", css: "#3949ab", body: { on: true, hue: 47000, sat: 254 } },
  { name: "Violet", css: "#8e24aa", body: { on: true, hue: 54000, sat: 254 } },
];

// Real "Kitchen · online/offline" indicator, based on bridge reachability.
function setConn(online) {
  const txt = document.getElementById("conn-text");
  if (txt) {
    txt.textContent = online ? "online" : "offline";
    txt.dataset.conn = online ? "online" : "offline";
  }
}

// Current light color as [r,g,b] (used to paint the hero background).
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
// Philips xy (CIE) -> sRGB, for lights in "xy" color mode.
function xyToRgb(x, y) {
  if (!y) y = 0.0001;
  const Y = 1, X = (Y / y) * x, Z = (Y / y) * (1 - x - y);
  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;
  const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  r = gam(r); g = gam(g); b = gam(b);
  const m = Math.max(r, g, b);
  if (m > 1) { r /= m; g /= m; b /= m; }
  const cl = (c) => Math.round(Math.max(0, Math.min(1, c)) * 255);
  return [cl(r), cl(g), cl(b)];
}
function lightRGB(a) {
  if (!a) return [204, 204, 204];
  if (a.colormode === "xy" && Array.isArray(a.xy)) return xyToRgb(a.xy[0], a.xy[1]);
  if (a.colormode === "ct" || a.sat == null || a.sat < 20) {
    const ct = a.ct || 300;                      // white: warm/cool by color temp
    const f = Math.max(0, Math.min(1, (ct - 153) / (500 - 153)));
    const mix = (p, q) => Math.round(p + (q - p) * f);
    return [mix(219, 255), mix(233, 214), mix(255, 160)];
  }
  return hslToRgb((a.hue || 0) / 65535, (a.sat || 0) / 254, 0.52);
}
function textForRgb(rgb) {
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return lum > 0.6 ? "#141410" : "#ffffff";
}
// Paint the hero background/text to reflect the current light color.
function setTrackColor(css) {
  const slider = document.getElementById("brightness");
  if (slider) slider.style.setProperty("--track-color", css);
}
function paintHero(action, on) {
  const hero = document.getElementById("kitchen-hero");
  if (on && action) {
    const rgb = lightRGB(action);
    const css = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    if (hero) { hero.style.background = css; hero.style.color = textForRgb(rgb); }
    setTrackColor(css);
  } else {
    if (hero) { hero.style.background = ""; hero.style.color = ""; }
    setTrackColor(pendingColor ? pendingColor.css : "#ffffff");
  }
}

function updateLightsStatus() {
  Promise.all([
    fetch("/hue/groups/" + LIGHTS_GROUP, { cache: "no-store" }).then((r) => r.json()),
    fetch("/hue/lights/" + LIGHTS_SAMPLE, { cache: "no-store" }).then((r) => r.json()),
  ])
    .then(([grp, light]) => {
      setConn(true);
      const gstate = (grp && grp.state) || {};
      const lstate = (light && light.state) || {};
      const on = !!gstate.any_on;
      const bri = typeof lstate.bri === "number"
        ? lstate.bri
        : (grp && grp.action ? grp.action.bri : null);
      lightsOn = on;
      // Keep the brightness slider in sync with the real value (while on).
      const slider = document.getElementById("brightness");
      const briOut = document.getElementById("bri-val");
      if (on && typeof bri === "number" && slider) {
        const pct = Math.round((bri / 254) * 100);
        slider.value = pct;
        if (briOut) briOut.textContent = pct + "%";
      }
      const text = document.getElementById("lights-line-text");
      if (on) {
        const pct = typeof bri === "number" ? Math.round((bri / 254) * 100) : null;
        if (text) text.textContent = "Lights on" + (pct != null ? " " + pct + "%" : "");
      } else if (text) {
        text.textContent = "Lights off";
      }
      paintHero(on ? lstate : null, on);   // real bulb color, pure hue (bri ignored)
      updateToggle();
    })
    .catch(() => {
      setConn(false);
      lightsOn = null;
      const text = document.getElementById("lights-line-text");
      if (text) text.textContent = "Lights —";
      paintHero(null, false);
      updateToggle();
    });
}

// Pick black or white text for a given hex background (by luminance).
function textColorFor(css) {
  const m = /^#?([0-9a-f]{6})$/i.exec(css || "");
  if (!m) return "#141410";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#141410" : "#ffffff";
}

// When the lights go off, reset the controls to defaults: white + 100%.
function resetLightControls() {
  const white = COLORS[0];                          // white is the first swatch
  pendingColor = { body: white.body, css: white.css };
  pendingBri = 254;                                 // 100%
  const slider = document.getElementById("brightness");
  const out = document.getElementById("bri-val");
  if (slider) slider.value = 100;
  if (out) out.textContent = "100%";
  selectSwatch(document.querySelector("#swatches .swatch"));
  setTrackColor(white.css);
}

/* ---------- On/Off toggle: label + action follow current state ---------- */
function updateToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  const txt = btn.querySelector(".toggle-txt");
  if (txt) txt.textContent = "Engage";
  btn.style.background = "";
  btn.style.color = "";
  if (lightsOn === true) {
    btn.dataset.state = "on";
  } else if (lightsOn === false) {
    btn.dataset.state = "off";
    if (pendingColor) {                       // preview the staged color
      btn.style.background = pendingColor.css;
      btn.style.color = textColorFor(pendingColor.css);
    }
  } else {
    btn.dataset.state = "unknown";
  }
}

function bindLightsToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const turningOn = !lightsOn;                         // null -> turn ON
    if (turningOn) {
      const body = pendingColor ? Object.assign({}, pendingColor.body) : { on: true };
      if (pendingBri != null) body.bri = pendingBri;    // apply staged brightness
      if (pendingColor || pendingBri != null) runHue(body);
      else runAction("Kitchen Lights On");
      pendingColor = null;
      pendingBri = null;
      toast("The kitchen lights are on.");
    } else {
      runAction("Kitchen Lights Off");
      resetLightControls();
      toast("The kitchen lights are off.");
    }
    lightsOn = turningOn;                                // optimistic
    updateToggle();
    window.setTimeout(updateLightsStatus, 500);          // confirm from bridge
  });
}

/* ---------- Brightness slider + ROYGBIV color swatches ---------- */
function bindLightTools() {
  const swatches = document.getElementById("swatches");
  if (swatches) {
    COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.style.background = c.css;
      b.title = c.name;
      b.setAttribute("aria-label", c.name);
      b.addEventListener("click", () => {
        selectSwatch(b);
        setTrackColor(c.css);              // brightness bar takes the color
        if (lightsOn) {
          // Lights on: apply the color now.
          runHue(c.body);
          pendingColor = null;
          toast("Kitchen lights set to " + c.name.toLowerCase() + ".");
          window.setTimeout(updateLightsStatus, 500);
        } else {
          // Lights off: stage for next turn-on (shown on the toggle button +
          // selected swatch; the hero square stays gray to mean "off").
          pendingColor = { body: c.body, css: c.css };
          updateToggle();
          toast(c.name + " ready — applies when the lights turn on.");
        }
      });
      swatches.appendChild(b);
    });
  }

  const slider = document.getElementById("brightness");
  const out = document.getElementById("bri-val");
  if (slider) {
    let t;
    slider.addEventListener("input", () => {
      const pct = Number(slider.value);
      if (out) out.textContent = pct + "%";
      const bri = Math.max(1, Math.round((pct / 100) * 254));
      if (!lightsOn) {
        pendingBri = bri;                    // lights off: stage for next turn-on
        updateToggle();
        return;
      }
      clearTimeout(t);                       // throttle while dragging
      t = window.setTimeout(() => { runHue({ on: true, bri: bri }); }, 150);
    });
    // On release (when on), re-read the real state so everything stays in sync.
    slider.addEventListener("change", () => {
      if (lightsOn) window.setTimeout(updateLightsStatus, 500);
    });
  }
}

/* ---------- Decide how an action runs ---------- */
function runAction(name, el) {
  // Element-level override wins: data-fetch / data-method / data-body
  if (el && el.dataset && el.dataset.fetch) {
    runFetch({ url: el.dataset.fetch, method: el.dataset.method, body: el.dataset.body });
    return;
  }
  const ep = CONFIG.control.endpoints[name];
  if (CONFIG.control.mode === "fetch" && ep) {
    if (ep.hue) { runHueProxy(ep.hue); return; }
    if (ep.url) { runFetch(ep); return; }
  }
  runShortcut(name);
}

/* ---------- Greeting by time of day ---------- */
function setGreeting() {
  const el = document.getElementById("greeting");
  if (!el) return;
  const h = new Date().getHours();
  el.textContent = h < 5 ? "Still awake." : h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

/* ---------- Now Playing ---------- */
function setNowPlaying(text) {
  const el = document.getElementById("np-track");
  if (el) el.textContent = text;
}
function markPlaying(activeBtn) {
  document.querySelectorAll("#channel-list .list-item, #podcast-list .list-item")
    .forEach((b) => b.classList.remove("is-playing"));
  if (activeBtn) activeBtn.classList.add("is-playing");
}

/* ---------- Build a list row ---------- */
function makeRow({ icon, title, meta, shortcut, nowPlaying }) {
  const btn = document.createElement("button");
  btn.className = "list-item";
  btn.type = "button";
  btn.innerHTML =
    '<span class="badge">' + icon + "</span>" +
    '<span class="body"><span class="title"></span>' +
    (meta ? '<span class="meta"></span>' : "") +
    "</span>" + CHEV_ICON;
  btn.querySelector(".title").textContent = title;
  if (meta) btn.querySelector(".meta").textContent = meta;

  btn.addEventListener("click", () => {
    if (nowPlaying) {
      setNowPlaying(nowPlaying);
      markPlaying(btn);
    }
    toast('Very good. Playing "' + title + '" in the kitchen.');
    runAction(shortcut);
  });
  return btn;
}

/* ---------- Render SiriusXM ---------- */
function renderChannels() {
  const host = document.getElementById("channel-list");
  if (!host) return;
  const { channels, channelsVisible } = CONFIG;

  channels.forEach((c, i) => {
    const row = makeRow({
      icon: RADIO_ICON,
      title: c.title,
      meta: c.ch,
      shortcut: c.shortcut,
      nowPlaying: c.title + " · " + c.ch,
    });
    if (i >= channelsVisible) row.classList.add("hidden", "extra-channel");
    host.appendChild(row);
  });

  const hiddenCount = channels.length - channelsVisible;
  if (hiddenCount > 0) {
    const more = document.createElement("button");
    more.className = "list-item more";
    more.type = "button";
    more.textContent = "+ " + hiddenCount + " more channels";
    more.addEventListener("click", () => {
      host.querySelectorAll(".extra-channel").forEach((el) => el.classList.remove("hidden"));
      more.remove();
    });
    host.appendChild(more);
  }
}

/* ---------- Render Podcasts ---------- */
function renderPodcasts() {
  const host = document.getElementById("podcast-list");
  if (!host) return;
  CONFIG.podcasts.forEach((p) => {
    host.appendChild(makeRow({
      icon: PODCAST_ICON,
      title: p.title,
      meta: p.meta,
      shortcut: p.shortcut,
      nowPlaying: p.title,
    }));
  });
}

/* ---------- Bind simple [data-shortcut] controls (lights, volume, stop) ---------- */
function bindShortcutButtons() {
  document.querySelectorAll("[data-shortcut]").forEach((btn) => {
    if (btn.closest("#channel-list, #podcast-list")) return; // handled above
    btn.addEventListener("click", () => {
      if (btn.dataset.stop) {
        setNowPlaying("Nothing playing");
        markPlaying(null);
      }
      if (btn.dataset.toast) toast(btn.dataset.toast);
      runAction(btn.dataset.shortcut, btn);
      // If this was a light control, re-read the status shortly after.
      if (btn.closest(".theme-lights")) {
        window.setTimeout(updateLightsStatus, 500);
      }
    });
  });
}

/* ---------- Print the QR sheet ---------- */
function bindPrint() {
  document.querySelectorAll("[data-print]").forEach((btn) => {
    btn.addEventListener("click", () => window.print());
  });
}

/* ---------- Rooms not yet in service (home page) ---------- */
function bindSoonRooms() {
  document.querySelectorAll("[data-soon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toast("My apologies — " + btn.dataset.soon + " isn't in service just yet.");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setGreeting();
  renderChannels();
  renderPodcasts();
  bindShortcutButtons();
  bindPrint();
  bindSoonRooms();
  bindLightsToggle();
  bindLightTools();
  updateLightsStatus();
});
