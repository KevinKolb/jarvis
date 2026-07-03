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
const LIGHTS_MEMBERS = ["22", "21", "20", "63", "62"];  // its bulbs (for true color)
let lightsOn = null;         // true / false / null (unknown)
let pendingColor = null;     // { body, css } current color selection (default white)
let pendingBri = 254;        // current brightness selection (default 100%)
let selectedSwatchEl = null; // currently highlighted swatch
let dirty = false;           // selection changed since last engage / load?

function selectSwatch(el) {
  if (selectedSwatchEl) selectedSwatchEl.classList.remove("sel");
  selectedSwatchEl = el;
  if (el) el.classList.add("sel");
}

// Send a state change to the kitchen group via the Pi relay.
function runHue(body) {
  runHueProxy({ path: "/groups/" + LIGHTS_GROUP + "/action", body: body });
}

// Black (= off) + White + ROYGBV. `css` is the swatch color; `body` is sent
// to the bridge. White uses color temperature; colors use Hue's hue wheel.
const COLORS = [
  { name: "Black",  css: "#000000", off: true },
  { name: "White",  css: "#ffffff", body: { on: true, sat: 0, ct: 250 } },
  { name: "Red",    css: "#e53935", body: { on: true, hue: 0,     sat: 254 } },
  { name: "Orange", css: "#fb8c00", body: { on: true, hue: 4500,  sat: 254 } },
  { name: "Yellow", css: "#fdd835", body: { on: true, hue: 10500, sat: 254 } },
  { name: "Green",  css: "#43a047", body: { on: true, hue: 25500, sat: 254 } },
  { name: "Blue",   css: "#1e88e5", body: { on: true, hue: 43690, sat: 254 } },
  { name: "Purple", css: "#8e24aa", body: { on: true, hue: 54000, sat: 254 } },
];

/* ---------- Kitchen Sonos (stereo pair, via the Pi) ---------- */
// Channel buttons. `fav` must match the Sonos favorite title exactly.
const MUSIC = {
  radio: [
    { label: "John Mayer", fav: "CH 14 - Life with John Mayer" },
    { label: "Yacht Rock", fav: "CH 17 - Yacht Rock Radio" },
    { label: "The Bridge", fav: "CH 27 - The Bridge" },
    { label: "Chill", fav: "CH 55 - SiriusXM Chill" },
    { label: "Classic Vinyl", fav: "CH 26 - Classic Vinyl" },
    { label: "WWOZ", fav: "WWOZ" },
  ],
  jukebox: [
    { label: "Juicy Playlist", fav: "A Juicy Playlist" },
    { label: "Happy Rock", fav: "Happy Rock" },
    { label: "Southern Nights", fav: "Southern Nights" },
    { label: "Vivid", fav: "Vivid" },
    { label: "Simple", fav: "Simple" },
  ],
  podcasts: [
    { label: "Learn French", fav: "Learn French" },
  ],
};

let sonosVol = 0, sonosMuted = false, npTrack = "", npPlaying = false;

function renderVol() {
  const out = document.getElementById("vol-val");
  if (out) out.textContent = sonosVol + "%";
  const s = document.getElementById("volume");
  if (s && sonosVol >= 1 && sonosVol <= 99) s.value = sonosVol;
  const bm = document.getElementById("vol-mute");
  if (bm) bm.textContent = sonosMuted ? "Unmute" : "Mute";
}
function renderNP() {
  const np = document.getElementById("np-line");
  if (!np) return;
  const vp = sonosVol + "%";
  if (npPlaying && npTrack) np.textContent = npTrack + " · " + vp;
  else if (npPlaying) np.textContent = vp;
  else np.textContent = "Paused · " + vp;
}
function setSonosVolume(level) {
  fetch("/sonos/volume", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level: level }), keepalive: true }).catch(() => {});
}
function updateSonos() {
  fetch("/sonos/state", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => {
      if (!d || d.error) return;
      if (typeof d.volume === "number") sonosVol = d.volume;
      sonosMuted = !!d.mute;
      npPlaying = !!d.playing;
      npTrack = d.track || "";
      renderVol();
      renderNP();
    })
    .catch(() => {});
}
function playFavorite(fav, label) {
  fetch("/sonos/favorite", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: fav }), keepalive: true }).catch(() => {});
  toast("Playing " + label + ".");
  window.setTimeout(updateSonos, 1500);
}
function renderShare() {
  const host = document.getElementById("row-share");
  if (!host) return;
  fetch("/sonos/rooms", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => {
      if (!d || !d.rooms) return;
      host.innerHTML = "";
      d.rooms.forEach((rm) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chan-btn share-btn";
        b.textContent = rm.name;
        if (rm.grouped) b.classList.add("on");
        b.addEventListener("click", () => {
          const join = !b.classList.contains("on");
          b.classList.toggle("on", join);
          fetch("/sonos/group", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room: rm.name, join: join }), keepalive: true }).catch(() => {});
          toast(join ? "Sharing kitchen audio to " + rm.name + "." : "Stopped sharing to " + rm.name + ".");
        });
        host.appendChild(b);
      });
    })
    .catch(() => {});
}
function renderMusic() {
  [["row-radio", MUSIC.radio], ["row-jukebox", MUSIC.jukebox], ["row-podcasts", MUSIC.podcasts]]
    .forEach(([id, list]) => {
      const host = document.getElementById(id);
      if (!host) return;
      list.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chan-btn";
        b.textContent = c.label;
        b.addEventListener("click", () => playFavorite(c.fav, c.label));
        host.appendChild(b);
      });
    });
}
function bindVolume() {
  const s = document.getElementById("volume");
  const bmute = document.getElementById("vol-mute");
  const b100 = document.getElementById("vol-100");
  let t;
  if (s) s.addEventListener("input", () => {
    sonosVol = Number(s.value);             // 1..99
    renderVol(); renderNP();
    clearTimeout(t);
    t = window.setTimeout(() => setSonosVolume(sonosVol), 120);
  });
  if (b100) b100.addEventListener("click", () => {
    sonosVol = 100; if (s) s.value = 99;
    renderVol(); renderNP(); setSonosVolume(100);
  });
  if (bmute) bmute.addEventListener("click", () => {
    sonosMuted = !sonosMuted;
    renderVol(); renderNP();
    fetch("/sonos/mute", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mute: sonosMuted }), keepalive: true }).catch(() => {});
  });
}

// Real "Kitchen · online/offline" indicator, based on bridge reachability.
function setConn(online) {
  const state = online ? "online" : "offline";
  const txt = document.getElementById("conn-text");
  const dot = document.getElementById("conn-dot");
  if (txt) { txt.textContent = state; txt.dataset.conn = state; }
  if (dot) dot.dataset.conn = state;
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
function rgbToHue(rgb) {
  const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
// Pure light color (hue only) for the hero: red is red — brightness/sat ignored.
function lightRGB(a) {
  if (!a) return [204, 204, 204];
  if (a.colormode === "ct" || a.sat == null || a.sat < 20) {
    const ct = a.ct || 300;                      // white: warm/cool by color temp
    const f = Math.max(0, Math.min(1, (ct - 153) / (500 - 153)));
    const mix = (p, q) => Math.round(p + (q - p) * f);
    return [mix(219, 255), mix(233, 214), mix(255, 160)];
  }
  const hueDeg = (a.colormode === "xy" && Array.isArray(a.xy))
    ? rgbToHue(xyToRgb(a.xy[0], a.xy[1]))
    : ((a.hue || 0) / 65535) * 360;
  return hslToRgb(hueDeg / 360, 1, 0.5);         // pure, fully saturated
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
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [200, 200, 200];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// Map the actual bulb color to the nearest swatch (so red reads as our red).
function nearestSwatch(state) {
  if (!state || state.colormode === "ct" || state.sat == null || state.sat < 20) {
    return COLORS.find((c) => c.name === "White");
  }
  const rgb = (state.colormode === "xy" && Array.isArray(state.xy))
    ? xyToRgb(state.xy[0], state.xy[1])
    : hslToRgb((state.hue || 0) / 65535, (state.sat || 0) / 254, 0.5);
  const h = rgbToHue(rgb);
  let best = null, bestD = Infinity;
  COLORS.forEach((c) => {
    if (c.off || c.name === "White") return;
    let d = Math.abs(h - rgbToHue(hexToRgb(c.css)));
    if (d > 180) d = 360 - d;
    if (d < bestD) { bestD = d; best = c; }
  });
  return best || COLORS.find((c) => c.name === "White");
}
// Hero reflects the ACTUAL current light (on/off + color), not the staged pick.
function paintHero(on, state) {
  // Colors the kitchen hero AND the Kitchen button on the home page identically.
  const els = [document.getElementById("kitchen-hero"), document.getElementById("room-kitchen")].filter(Boolean);
  if (!els.length) return;
  let bg, fg;
  if (on && state) {
    const sw = nearestSwatch(state);
    bg = sw.css;
    fg = textColorFor(sw.css);
  } else {
    bg = "#000000";      // lights off -> black
    fg = "#b8b8b8";      // light gray text
  }
  els.forEach((el) => { el.style.background = bg; el.style.color = fg; });
}

function updateLightsStatus() {
  Promise.all([
    fetch("/hue/groups/" + LIGHTS_GROUP, { cache: "no-store" }).then((r) => r.json()),
    ...LIGHTS_MEMBERS.map((id) =>
      fetch("/hue/lights/" + id, { cache: "no-store" }).then((r) => r.json()).catch(() => null)
    ),
  ])
    .then(([grp, ...lights]) => {
      setConn(true);
      const gstate = (grp && grp.state) || {};
      const on = !!gstate.any_on;
      // representative on-bulb for color: prefer one that's actually colored
      const onLights = lights.filter((l) => l && l.state && l.state.on && l.state.reachable);
      const rep = onLights.find((l) => l.state.colormode !== "ct" && (l.state.sat || 0) >= 20)
        || onLights[0]
        || lights.find((l) => l && l.state);
      const lstate = rep ? rep.state : {};
      const bri = typeof lstate.bri === "number"
        ? lstate.bri
        : (grp && grp.action ? grp.action.bri : null);
      lightsOn = on;
      const text = document.getElementById("lights-line-text");
      if (on) {
        const pct = typeof bri === "number" ? Math.round((bri / 254) * 100) : null;
        if (text) text.textContent = "Lights on" + (pct != null ? " " + pct + "%" : "");
      } else if (text) {
        text.textContent = "Lights off";
      }
      paintHero(on, lstate);
      updateToggle();
    })
    .catch(() => {
      setConn(false);
      lightsOn = null;
      const text = document.getElementById("lights-line-text");
      if (text) text.textContent = "Lights —";
      paintHero(false, null);
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
  const white = COLORS.find((c) => c.name === "White");
  pendingColor = { body: white.body, css: white.css, name: white.name };
  pendingBri = 254;                                 // 100%
  dirty = false;
  const slider = document.getElementById("brightness");
  const out = document.getElementById("bri-val");
  if (slider) slider.value = 99;
  if (out) out.textContent = "100%";
  selectSwatch(document.querySelector('#swatches .swatch[data-name="White"]'));
  setTrackColor(white.css);
  updateToggle();
}

/* ---------- On/Off toggle: label + action follow current state ---------- */
function updateToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  const txt = btn.querySelector(".toggle-txt");
  const pct = pendingBri != null ? Math.round((pendingBri / 254) * 100) : 100;
  const name = pendingColor ? pendingColor.name : "";
  const isOff = pendingBri === 0 || (pendingColor && pendingColor.off);
  if (txt) txt.textContent = isOff ? "Lights off" : pct + "% " + name + " Engage";
  btn.style.background = "";
  btn.style.color = "";
  btn.dataset.state = lightsOn === true ? "on" : lightsOn === false ? "off" : "unknown";
  if (isOff) {                                // black or 0% -> off preview
    btn.style.background = "#000000";
    btn.style.color = "#b8b8b8";              // light gray, like the off hero
  } else if (pendingColor) {                  // show the selected color
    btn.style.background = pendingColor.css;
    btn.style.color = textColorFor(pendingColor.css);
  }
  // 100% button mirrors the staged color (like the Engage button)
  const b100 = document.getElementById("bri-100");
  if (b100 && pendingColor) {
    b100.style.background = pendingColor.css;
    b100.style.color = textColorFor(pendingColor.css);
  }
}

function bindLightsToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const isOff = pendingBri === 0 || (pendingColor && pendingColor.off);
    if (isOff || (lightsOn && !dirty)) {
      // black or 0% selected, or on with nothing newly selected -> turn off
      runAction("Kitchen Lights Off");
      resetLightControls();
      lightsOn = false;
      toast("The kitchen lights are off.");
    } else {
      // enact the current selection (turn on / update in place); keep selection
      const body = pendingColor && pendingColor.body ? Object.assign({}, pendingColor.body) : { on: true };
      if (pendingBri != null && pendingBri > 0) body.bri = pendingBri;
      runHue(body);
      dirty = false;
      lightsOn = true;
      toast("Engaged.");
    }
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
      b.dataset.name = c.name;
      b.addEventListener("click", () => {
        selectSwatch(b);
        setTrackColor(c.css);              // brightness bar takes the color
        pendingColor = { body: c.body, css: c.css, name: c.name, off: c.off };   // always stage
        dirty = true;
        updateToggle();
        toast(c.name + " staged — press Engage.");
      });
      swatches.appendChild(b);
    });
  }

  const slider = document.getElementById("brightness");
  const out = document.getElementById("bri-val");
  if (slider) {
    slider.addEventListener("input", () => {
      const pct = Number(slider.value);            // 1..99
      if (out) out.textContent = pct + "%";
      pendingBri = Math.round((pct / 100) * 254);
      dirty = true;
      updateToggle();
    });
  }
  const b0 = document.getElementById("bri-0");     // 0% = off
  const b100 = document.getElementById("bri-100"); // 100% = brightest
  if (b0) b0.addEventListener("click", () => {
    pendingBri = 0; dirty = true;
    if (out) out.textContent = "0%";
    updateToggle();
  });
  if (b100) b100.addEventListener("click", () => {
    pendingBri = 254; dirty = true;
    if (out) out.textContent = "100%";
    updateToggle();
  });
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
  resetLightControls();     // default selection: white + 100%
  bindVolume();
  renderMusic();
  renderShare();
  updateLightsStatus();
  updateSonos();
  window.setInterval(updateSonos, 10000);   // keep now-playing/volume fresh
});
