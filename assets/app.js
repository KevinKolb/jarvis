/* =========================================================
   JARVIS — Residence Butler
   Edit CONFIG to match your own iOS Shortcuts. Every control
   fires shortcuts://run-shortcut?name=<Shortcut Name>, so
   music playback lives on Alexa/HomePod and keeps going after
   the phone walks away.
   ========================================================= */

const PI_ORIGIN = "http://192.168.86.147";
const PI_ROOM_PATHS = ["kitchen", "bed", "bathroom", "living"];

function piPagePath() {
  const path = decodeURIComponent(window.location.pathname || "/").toLowerCase();
  if (path.indexOf("/admin.html") !== -1) return "/admin.html";
  for (const room of PI_ROOM_PATHS) {
    if (path.indexOf("/" + room + "/") !== -1 || path.endsWith("/" + room)) {
      return "/" + room + "/";
    }
  }
  return "/";
}

function piUrl(path) {
  if (!path) return PI_ORIGIN + "/";
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return PI_ORIGIN + (path.charAt(0) === "/" ? path : "/" + path);
}

(function redirectToPiOrigin() {
  if (window.location.origin === PI_ORIGIN) return;
  const target = PI_ORIGIN + piPagePath() + window.location.search + window.location.hash;
  if (window.location.href !== target) window.location.replace(target);
})();

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
const HOUSE_ICON = '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10.5 9-7.5 9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/></svg>';
const LIVING_ICON = '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11a2 2 0 0 1 2 2v3h16v-3a2 2 0 0 1 2-2 2 2 0 0 0-2 2v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a2 2 0 0 0-2-2Z"/><path d="M4 18v2"/><path d="M20 18v2"/></svg>';
const ROOM_OFF_ICONS = { living: LIVING_ICON };

function setIconButtonLabel(btn, icon, label) {
  btn.innerHTML = (icon || "") + '<span class="btn-label"></span>';
  btn.querySelector(".btn-label").textContent = label;
}

/* ---------- Toast ---------- */
// Notifications are disabled — feedback lives in the header (Jarvis line) and the
// controls themselves. Kept as a no-op so existing callers stay harmless.
function toast(message) { /* notifications removed */ }

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
  fetch(piUrl(req.url), {
    method: req.method || "POST",
    headers: req.body ? { "Content-Type": "application/json" } : undefined,
    body: req.body || undefined,
    mode: "no-cors",     // fire-and-forget; response is opaque
    keepalive: true,
  }).catch(() => { /* ignore — request still leaves the device */ });
}

/* ---------- Ask the Pi relay to talk to the Hue bridge ---------- */
function runHueProxy(hue) {
  HUE_WRITE.forEach((bridge) => runHueProxyToBridge(bridge, hue));       // "all" = send to both hubs
}

function runHueProxyToBridge(bridge, hue) {
  const bridges = bridge === "all" ? HUE_ALL_BRIDGES : [bridge || "main"];
  bridges.forEach((bridge) => {
    fetch(piUrl("/hue"), {              // Pi, not the bridge
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ bridge: bridge }, hue)),
      keepalive: true,
    }).catch(() => { /* relay unreachable — Pi off, or not on SpamNet */ });
  });
}

/* ---------- Per-room config (set by data-* on .page) ---------- */
function sonosRoomKey(value) {
  const key = String(value || "").trim().toLowerCase();
  return ({
    "": "kitchen",
    "bed": "bedroom",
    "bath": "bathroom",
    "living room": "living",
    "whole house": "house",
  })[key] || key;
}

const PAGE = document.querySelector(".page") || document.body;
const CFG = PAGE.dataset || {};
const ROOM = sonosRoomKey(CFG.sonosRoom || "kitchen");   // Sonos target room key
const ROOM_LABEL = (CFG.room || ROOM).replace(/^\w/, (c) => c.toUpperCase());  // "Bathroom"
const HUE_BRIDGE = CFG.hueBridge || "main";              // which Hue bridge ("all" = both)
const HUE_ALL_BRIDGES = ["main", "bedroom"];
const HUE_WRITE = HUE_BRIDGE === "all" ? HUE_ALL_BRIDGES : [HUE_BRIDGE];        // bridges to command
const HUE_READ = HUE_BRIDGE === "all" ? HUE_ALL_BRIDGES : [HUE_BRIDGE];         // bridges to read status from
const RQ = "?page=" + encodeURIComponent(ROOM);          // GET query for sonos
let npCategory = "";                                      // music row now playing (drives next/back)
const withRoom = (o) => JSON.stringify(Object.assign({ page: ROOM, category: npCategory }, o));  // POST body

/* ---------- Read + show current light status ---------- */
function idList(value) {
  return String(value || "").split(",").map((id) => id.trim()).filter(Boolean);
}

const LIGHTS_GROUP = CFG.lightsGroup || "82";            // Hue group id
const LIGHTS_MEMBERS = idList(CFG.lightsMembers || "22,21,20,63,62");  // bulbs in this room
let lightsOn = null;         // true / false / null (unknown)
let lightsBri = null;        // current on-brightness as 0-100 %, or null
let lightsColor = null;      // current light color mapped to a swatch name, or null
let lightHeroBg = "#8a8a8a"; // current light color css (for the header on the Lights deck)
let lightHeroFg = "#141410"; // matching ink for that tint
let pendingColor = null;     // { body, css } current color selection (default white)
let pendingBri = null;       // current brightness selection (null = none chosen yet)
let pendingBriVis = 1;       // display-only shade for that selection (0-1)
let selectedSwatchEl = null; // currently highlighted swatch
let selectedBriEl = null;    // currently highlighted brightness box
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
// Send a state change to specific lights (used to skip a light the group hits).
function runHueLights(ids, body) {
  ids.forEach((id) => runHueProxy({ path: "/lights/" + id + "/state", body: body }));
}
// The office/desk lamp is dimmable-only (no color). It joins group commands
// normally — white scenes and every OFF button hit the whole group — EXCEPT
// when a colored (hue) scene is engaged: then the office lamp is turned OFF
// (it can't show the color) and only the color-capable members get the scene.
const OFFICE_LAMP = CFG.officeLamp || "";
const COLOR_OFF_MEMBERS = idList(CFG.colorOffMembers || OFFICE_LAMP);
const WHITE_ONLY_MEMBERS = idList(CFG.whiteOnlyMembers || "");
let selectedLightTargetKey = "room";
let lastControlsKey = null;   // last live state the pick columns were synced to
let lightTargetStatusByKey = {};
let lightTargetStatusReadSeq = {};

function lightTarget(label, icon, parts) {
  return { label: label, icon: icon, parts: parts };
}

const FOH_LIGHT_MEMBERS = idList(CFG.fohLightsMembers || "");
const BOH_LIGHT_MEMBERS = idList(CFG.bohLightsMembers || "");
// TV lights: never controlled by this room — excluded from EVERY command (even white).
const TV_MEMBERS = idList(CFG.tvMembers || "");
const FOH_TV_MEMBERS = idList(CFG.fohTvMembers || CFG.tvMembers || "");
const BOH_TV_MEMBERS = idList(CFG.bohTvMembers || "");
const LIGHT_TARGETS = {
  room: lightTarget(ROOM_LABEL + " Lights", ROOM_OFF_ICONS[ROOM], [{
    bridge: HUE_BRIDGE,
    group: LIGHTS_GROUP,
    members: LIGHTS_MEMBERS,
    colorOff: COLOR_OFF_MEMBERS,
    whiteOnly: WHITE_ONLY_MEMBERS,
    exclude: TV_MEMBERS,
  }]),
  foh: lightTarget("Front of House Lights", HOUSE_ICON, [{
    bridge: "main",
    group: "0",
    members: FOH_LIGHT_MEMBERS,
    colorOff: idList(CFG.fohColorOffMembers || ""),
    whiteOnly: idList(CFG.fohWhiteOnlyMembers || CFG.whiteOnlyMembers || ""),
    exclude: FOH_TV_MEMBERS,
  }]),
  boh: lightTarget("Back of House Lights", HOUSE_ICON, [{
    bridge: "bedroom",
    group: "0",
    members: BOH_LIGHT_MEMBERS,
    colorOff: idList(CFG.bohColorOffMembers || ""),
    whiteOnly: idList(CFG.bohWhiteOnlyMembers || ""),
    exclude: BOH_TV_MEMBERS,
  }]),
  house: lightTarget("Whole House Lights", HOUSE_ICON, [{
    bridge: "main",
    group: "0",
    members: FOH_LIGHT_MEMBERS,
    colorOff: idList(CFG.fohColorOffMembers || ""),
    whiteOnly: idList(CFG.fohWhiteOnlyMembers || CFG.whiteOnlyMembers || ""),
    exclude: FOH_TV_MEMBERS,
  }, {
    bridge: "bedroom",
    group: "0",
    members: BOH_LIGHT_MEMBERS,
    colorOff: idList(CFG.bohColorOffMembers || ""),
    whiteOnly: idList(CFG.bohWhiteOnlyMembers || ""),
    exclude: BOH_TV_MEMBERS,
  }]),
};

function currentLightTarget() {
  return LIGHT_TARGETS[selectedLightTargetKey] || LIGHT_TARGETS.room;
}

function primaryLightStatusTargetKey() {
  return LIGHT_TARGETS[CFG.defaultLightTarget] ? CFG.defaultLightTarget : "room";
}

function engageTargetLabel(label) {
  return String(label || "").replace(/\s+Lights$/i, "\nLights");
}

function runHueLightsOnBridge(bridge, ids, body) {
  ids.forEach((id) => runHueProxyToBridge(bridge, { path: "/lights/" + id + "/state", body: body }));
}

function applyLightTargetPart(part, body) {
  const colored = body && Object.prototype.hasOwnProperty.call(body, "hue");
  const exclude = part.exclude || [];                       // TV lights: NEVER touched (even white)
  const colorOff = colored ? (part.colorOff || []) : [];
  const whiteOnly = colored ? (part.whiteOnly || []) : [];
  const members = (part.members || []);
  // If anything must be held back, address bulbs individually; otherwise the group
  // command is fine (it hits every group member, so it's only safe with no excludes).
  if (members.length && (exclude.length || colorOff.length || whiteOnly.length)) {
    if (colorOff.length) {
      const offIds = colorOff.filter((id) => exclude.indexOf(id) === -1);
      if (offIds.length) runHueLightsOnBridge(part.bridge, offIds, { on: false });
    }
    const skip = exclude.concat(colorOff).concat(whiteOnly);
    const targetMembers = members.filter((id) => skip.indexOf(id) === -1);
    if (targetMembers.length) runHueLightsOnBridge(part.bridge, targetMembers, body);
  } else {
    runHueProxyToBridge(part.bridge, { path: "/groups/" + part.group + "/action", body: body });
  }
}

function applyLights(body) {
  currentLightTarget().parts.forEach((part) => applyLightTargetPart(part, body));
}

// White + ROYGBV. `css` is the swatch color; `body` is sent to the bridge.
// White uses color temperature; colors use Hue's hue wheel. (No "off" swatch —
// the OFF buttons handle turning lights off.)
const COLORS = [
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
    { label: "WWOZ", fav: "WWOZ" },
    { label: "Yacht Rock", fav: "CH 17 - Yacht Rock Radio" },
    { label: "The Bridge", fav: "CH 27 - The Bridge" },
    { label: "Chill", fav: "CH 55 - SiriusXM Chill" },
    { label: "Classic Vinyl", fav: "CH 26 - Classic Vinyl" },
    { label: "Beatles", fav: "CH 18 - The Beatles Channel" },
  ],
  artists: [
    { label: "Hootie & The Blowfish", shuffle: true, apple: { kind: "playlist", id: "pl.8ed10a4ddd0248d68906350838bcf12a", title: "Hootie & The Blowfish" } },
    { label: "Warren Zevon", shuffle: true, apple: { kind: "playlist", id: "pl.fb29bc376e6d486c81b291dc66515121", title: "Warren Zevon Essentials" } },
  ],
  jukebox: [
    { label: "Junebug!", apple: { kind: "song", id: "6783079574", title: "Junebug" } },
    { label: "Foot of Canal St", fav: "Foot of Canal Street" },
    { label: "Sledgehammer", apple: { kind: "song", id: "987872731", title: "Sledgehammer" } },
  ],
  albums: [
    { label: "Rubber Soul", apple: { kind: "album", id: "1441164359", title: "Rubber Soul" } },
    { label: "Southern Nights", fav: "Southern Nights" },
    { label: "Vivid", fav: "Vivid" },
  ],
  // Playlists shuffle by default.
  playlists: [
    { label: "Morning Alarm", shuffle: true, apple: { kind: "libraryplaylist", id: "p.b16GR55TARxgG", title: "Morning Alarm" } },
    { label: "Juicy Playlist", shuffle: true, fav: "A Juicy Playlist" },
    { label: "Happy Rock", shuffle: true, fav: "Happy Rock" },
    { label: "Simple", shuffle: true, fav: "Simple" },
  ],
  podcasts: [
    { label: "Learn French", fav: "Learn French" },
  ],
};

let sonosVol = 0, sonosMuted = false, npTrack = "", npStation = "", npPlaylist = "", npPlaying = false, npTv = false;
let volHoldUntil = 0;   // your manual volume wins over polling until this time

function renderVol() {
  const out = document.getElementById("vol-val");
  if (out) out.textContent = sonosVol + "%";
  const s = document.getElementById("volume");
  if (s && sonosVol >= 1 && sonosVol <= 99) s.value = sonosVol;
  const bm = document.getElementById("vol-mute");
  if (bm) bm.textContent = sonosMuted ? "Unmute" : "Mute";
  renderVolBoxes();     // the volume column beside the album art
  updateHeroStatus();   // header shows the volume % on the Music deck
}
function renderNP() {
  const t = document.getElementById("np-track");
  const s = document.getElementById("np-sub");
  if (!t || !s) return;
  let line1, line2;
  if (!npPlaylist && !npTrack && !npStation) {
    // genuinely nothing loaded
    line1 = npPlaying ? "Playing" : "Loading...";
    line2 = "";
  } else if (npPlaylist) {
    // Playlist name leads (bold, line 1); the current track sits on line 2.
    line1 = npPlaylist;
    line2 = npTrack || "";
  } else {
    // Track leads (bold, line 1). Station drops to line 2 only when a track
    // occupies line 1; otherwise the one bit we have is the bold line 1.
    line1 = npTrack || npStation || "Playing";
    line2 = (npTrack && npStation) ? npStation : "";
  }
  t.textContent = line1;
  s.textContent = line2;
  // last line: which row this was played from, e.g. "FROM ALBUMS"
  const c = document.getElementById("np-cat");
  if (c) {
    const playing = npPlaying || npPlaylist || npTrack || npStation;
    c.textContent = (!npTv && playing && npCategory) ? "FROM " + npCategory.toUpperCase() : "";
  }
  if (typeof sayJarvis === "function") sayJarvis();   // keep the music line current
}
function setSonosVolume(level) {
  fetch(piUrl("/sonos/volume"), { method: "POST", headers: { "Content-Type": "application/json" },
    body: withRoom({ level: level }), keepalive: true }).catch(() => {});
}
let lastArtUrl = "";
// Pull a lively accent color out of the album art and expose it as CSS vars.
function extractArtColor(img) {
  try {
    const c = document.createElement("canvas");
    const w = (c.width = 24), h = (c.height = 24);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    let ar = 0, ag = 0, ab = 0, n = 0, best = null, bestScore = -1;
    for (let i = 0; i < px.length; i += 4) {
      const R = px[i], G = px[i + 1], B = px[i + 2], A = px[i + 3];
      if (A < 128) continue;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx > 245 && mn > 235) continue;   // skip near-white
      if (mx < 18) continue;                 // skip near-black
      ar += R; ag += G; ab += B; n++;
      const score = (mx - mn) + mx * 0.15;   // prefer saturated + bright
      if (score > bestScore) { bestScore = score; best = [R, G, B]; }
    }
    if (!n) return null;
    const avg = [ar / n, ag / n, ab / n];
    const pick = best || avg;                // blend vivid pixel with the average
    const mix = pick.map((v, k) => Math.round(v * 0.6 + avg[k] * 0.4));
    return "#" + mix.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
  } catch (e) { return null; }
}
function setArtAccent(color) {
  const c = color || "#9a9a9a";             // gray fallback
  const root = document.documentElement.style;
  root.setProperty("--art-accent", c);
  const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  root.setProperty("--art-ink", lum > 0.62 ? "#111111" : "#ffffff");
  // mostly-transparent tint of the border color for the play/pause strip
  root.setProperty("--art-accent-soft", "rgba(" + r + "," + g + "," + b + ",0.34)");
  if (typeof updateHeaderColor === "function") updateHeaderColor();   // Music header follows art
}
function updateSonos() {
  fetch(piUrl("/sonos/state" + RQ), { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => {
      if (!d || d.error) return;
      if (typeof d.volume === "number" && Date.now() > volHoldUntil) sonosVol = d.volume;
      sonosMuted = !!d.mute;
      npPlaying = !!d.playing;
      npTv = !!d.tv;
      npTrack = d.track || "";
      npStation = d.station || "";
      npPlaylist = d.playlist || "";
      const tvBtn = document.getElementById("tv-mode");   // bedroom only
      if (tvBtn) tvBtn.classList.toggle("on", npTv);
      if (npTv) npCategory = "";
      else if (!npCategory && d.category) npCategory = d.category;   // restore on fresh load
      updatePlayPause();
      updateSkip();
      const playbar = document.querySelector(".np-playbar");    // no transport controls in TV mode
      if (playbar) playbar.hidden = !!d.tv;
      const art = document.getElementById("np-art");
      const loading = document.getElementById("np-art-loading");
      const msg = document.getElementById("np-art-msg");
      const tvArt = document.getElementById("np-art-tv");   // bedroom TV graphic
      const sourceName = () => npPlaylist || npStation || npTrack || "No art";
      const artSrc = (url) => /^[a-z][a-z0-9+.-]*:/i.test(url || "") ? url : piUrl(url || "");
      const probeSrc = (url) => /^[a-z][a-z0-9+.-]*:/i.test(url || "")
        ? piUrl("/art?u=" + encodeURIComponent(url))
        : piUrl(url || "");
      const showArtwork = (url) => {
        if (!art || !loading || !url) return false;
        if (url !== lastArtUrl) {
          lastArtUrl = url;
          setArtAccent(null);
          if (msg) msg.textContent = "Loading art...";
          loading.hidden = false;
          art.hidden = true;
          art.onload = () => { art.hidden = false; loading.hidden = true; };
          art.onerror = () => { if (msg) msg.textContent = sourceName(); };
          art.src = artSrc(url);
          const probe = new Image();
          probe.crossOrigin = "anonymous";
          probe.onload = () => setArtAccent(extractArtColor(probe));
          probe.onerror = () => setArtAccent(null);
          probe.src = probeSrc(url);
        }
        return true;
      };
      if (tvArt) tvArt.hidden = !(d.tv && !d.art);
      if (d.tv && d.art && showArtwork(d.art)) {
        if (tvArt) tvArt.hidden = true;
      } else if (d.tv) {                       // TV audio without artwork: show the TV graphic
        lastArtUrl = "";
        if (art) { art.hidden = true; art.removeAttribute("src"); }
        if (loading) loading.hidden = true;
        setArtAccent(lightHeroBg);   // TV has no art -> use the room's current hue light color
      } else if (art && loading) {
        if (d.art) {                           // has artwork (kept while paused, not just playing)
          if (d.art !== lastArtUrl) {
            lastArtUrl = d.art;
            setArtAccent(null);                // gray until the new color loads
            if (msg) msg.textContent = "Loading art…";
            loading.hidden = false;            // placeholder while it decodes
            art.hidden = true;
            art.onload = () => { art.hidden = false; loading.hidden = true; };
            art.onerror = () => { if (msg) msg.textContent = sourceName(); };
            art.src = d.art;                   // display straight from the source
            const probe = new Image();         // sample pixels via the same-origin proxy
            probe.crossOrigin = "anonymous";
            probe.onload = () => setArtAccent(extractArtColor(probe));
            probe.onerror = () => setArtAccent(null);
            probe.src = piUrl("/art?u=" + encodeURIComponent(d.art));
          }
        } else {                               // no art -> show the track / source name
          lastArtUrl = "";
          art.hidden = true; art.removeAttribute("src");
          if (msg) msg.textContent = sourceName();
          loading.hidden = false;
          setArtAccent(null);
        }
      }
      renderVol();
      renderNP();
    })
    .catch(() => {});
}
function playFavorite(fav, label, shuffle) {
  fetch(piUrl("/sonos/favorite"), { method: "POST", headers: { "Content-Type": "application/json" },
    body: withRoom({ name: fav, shuffle: !!shuffle }), keepalive: true }).catch(() => {});
  toast("Now playing " + label);
  window.setTimeout(updateSonos, 1500);
}
function playApple(apple, label) {   // apple = {kind, id, title}
  fetch(piUrl("/sonos/apple"), { method: "POST", headers: { "Content-Type": "application/json" },
    body: withRoom(apple), keepalive: true }).catch(() => {});
  toast("Now playing " + label);
  window.setTimeout(updateSonos, 1500);
}
function playStream(url, label) {   // direct stream URL (like Sonos "Play a URL")
  fetch(piUrl("/sonos/uri"), { method: "POST", headers: { "Content-Type": "application/json" },
    body: withRoom({ url: url, title: label }), keepalive: true }).catch(() => {});
  toast("Now playing " + label);
  window.setTimeout(updateSonos, 1500);
}
function playPodcast(feed, label) {   // newest episode from an Apple Podcasts link / RSS feed
  fetch(piUrl("/sonos/podcast"), { method: "POST", headers: { "Content-Type": "application/json" },
    body: withRoom({ feed: feed }), keepalive: true }).catch(() => {});
  toast("Now playing latest " + label);
  window.setTimeout(updateSonos, 2500);
}
function renderShare() {
  const host = document.getElementById("row-share");
  if (!host) return;
  function setRoom(btn, name, join) {
    btn.classList.toggle("on", join);
    fetch(piUrl("/sonos/group"), { method: "POST", headers: { "Content-Type": "application/json" },
      body: withRoom({ room: name, join: join }), keepalive: true }).catch(() => {});
  }
  fetch(piUrl("/sonos/rooms" + RQ), { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => {
      if (!d || !d.rooms) return;
      host.innerHTML = "";
      // Permanent host indicator: a dummy, always-selected first button (e.g. Bedroom/Office)
      const DUMMY_FIRST = { bedroom: "Bedroom/Office" };
      if (DUMMY_FIRST[ROOM]) {
        const d0 = document.createElement("button");
        d0.type = "button";
        d0.className = "chan-btn share-btn on";
        d0.textContent = DUMMY_FIRST[ROOM];
        d0.setAttribute("aria-disabled", "true");
        d0.addEventListener("click", () => toast("Bedroom shared to Office."));
        host.appendChild(d0);
      }
      const roomBtns = [];
      const macros = [];
      // keep All + each macro lit only when all of their rooms are on
      const syncGroups = () => {
        all.classList.toggle("on", roomBtns.length > 0 && roomBtns.every((x) => x.btn.classList.contains("on")));
        macros.forEach((m) => {
          const targets = roomBtns.filter((x) => m.names.indexOf(x.name) !== -1);
          m.btn.classList.toggle("on", targets.length > 0 && targets.every((x) => x.btn.classList.contains("on")));
        });
      };
      // Pages that don't show the whole-House (All) share button
      const NO_HOUSE_BTN = { bedroom: true };
      const all = document.createElement("button");
      all.type = "button";
      all.className = "chan-btn share-btn share-all";
      all.textContent = "House";
      all.addEventListener("click", () => {
        const join = roomBtns.some((x) => !x.btn.classList.contains("on"));   // any off -> turn all on
        roomBtns.forEach((x) => setRoom(x.btn, x.name, join));
        syncGroups();
        toast(join ? "Sharing to all rooms." : "Stopped sharing to all rooms.");
      });
      // The "House" share button is removed everywhere. `all` is still built
      // because syncGroups() references it; it's just never added to the DOM.
      // FOH / BOH: toggle a fixed subset of rooms at once
      function makeMacro(label, names, toastName) {
        const nm = toastName || label;              // friendly name for the toast
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chan-btn share-btn share-all";
        btn.textContent = label;
        btn.addEventListener("click", () => {
          const targets = roomBtns.filter((x) => names.indexOf(x.name) !== -1);
          const join = targets.some((x) => !x.btn.classList.contains("on"));
          targets.forEach((x) => setRoom(x.btn, x.name, join));
          syncGroups();
          toast(join ? "Playing in " + nm + " too." : "Stopped playing in " + nm + ".");
        });
        macros.push({ btn: btn, names: names });
        host.appendChild(btn);
      }
      // FOH/BOH macros — coordinator room implicit. 3rd item = friendly toast name.
      const MACROS = {
        house: [
          ["FOH", ["Kitchen", "Living Room"]],
          ["ENTRYWAY", ["Entryway"]],
          ["BATH", ["Bathroom"], "Bath"],
          ["BED", ["Bedroom"], "Bed"],
        ],
        kitchen: [["FOH", ["Lounge", "Living Room"]]],
      };
      // Pages that show only All + macros (no individual room buttons)
      const MACROS_ONLY = { house: true, bathroom: true, bedroom: true };
      (MACROS[ROOM] || []).forEach((m) => makeMacro(m[0], m[1], m[2]));
      d.rooms.forEach((rm) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chan-btn share-btn";
        b.textContent = rm.name;
        if (rm.grouped) b.classList.add("on");
        b.addEventListener("click", () => {
          const join = !b.classList.contains("on");
          setRoom(b, rm.name, join);
          syncGroups();
          toast(join ? "Playing in " + rm.name + " too." : "Stopped playing in " + rm.name + ".");
        });
        roomBtns.push({ btn: b, name: rm.name });
        if (MACROS_ONLY[ROOM]) return;   // hidden button still drives macros/All
        host.appendChild(b);
      });
      syncGroups();
      const row = host.closest(".tool-row");
      if (row) row.hidden = host.children.length === 0;
    })
    .catch(() => {});
}
// Play/pause toggle layered on the album art. Shows a pause icon while playing
// (tap to pause) and a play icon while paused (tap to resume).
function updatePlayPause() {
  const btn = document.getElementById("np-playpause");
  if (btn) btn.classList.toggle("paused", !npPlaying);
}
// Next/back only make sense for queue content: playlists, artists, albums.
// The category can be lost (e.g. a server restart clears STATE), so also show
// skip whenever a queue-like track is playing — a track with no radio station.
function updateSkip() {
  const SKIPPABLE = ["playlists", "artists", "albums"];   // multi-track queues
  const NO_SKIP = ["radio", "jukebox", "podcasts", "share"];   // single item -> play/pause only
  let on;
  if (SKIPPABLE.indexOf(npCategory) !== -1) on = true;
  else if (NO_SKIP.indexOf(npCategory) !== -1) on = false;
  else on = !!npTrack && !npStation;   // category lost (e.g. server restart) -> infer from queue-like content
  ["np-prev", "np-next"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.hidden = !on;
  });
}
function bindPlayPause() {
  const btn = document.getElementById("np-playpause");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const action = npPlaying ? "pause" : "play";
    fetch(piUrl("/sonos/transport"), { method: "POST", headers: { "Content-Type": "application/json" },
      body: withRoom({ action: action }), keepalive: true }).catch(() => {});
    npPlaying = !npPlaying;          // optimistic; the next poll confirms
    updatePlayPause();
    toast(action === "pause" ? "Paused" : "Playing");
    window.setTimeout(updateSonos, 800);
  });
}
function bindSkip() {
  [["np-prev", "/sonos/prev"], ["np-next", "/sonos/next"]].forEach(([id, path]) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.addEventListener("click", () => {
      fetch(piUrl(path), { method: "POST", headers: { "Content-Type": "application/json" },
        body: withRoom({}), keepalive: true }).catch(() => {});
      window.setTimeout(updateSonos, 700);
    });
  });
}
// Mouse drag-to-scroll for the horizontal button rows (desktop has no touch
// swipe and the scrollbar is hidden). A real click still fires; a drag doesn't.
function enableDragScroll(el) {
  let down = false, startX = 0, startLeft = 0, moved = false;
  el.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    down = true; moved = false;
    startX = e.pageX; startLeft = el.scrollLeft;
    el.classList.add("dragging");
  });
  window.addEventListener("mousemove", (e) => {
    if (!down) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 4) moved = true;
    el.scrollLeft = startLeft - dx;
  });
  window.addEventListener("mouseup", () => {
    if (!down) return;
    down = false;
    el.classList.remove("dragging");
    if (moved) {                       // swallow the click that follows a real drag
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener("click", swallow, true);
      window.setTimeout(() => el.removeEventListener("click", swallow, true), 0);
    }
  });
}
function bindDragScroll() {
  document.querySelectorAll(".chan-row, .room-nav").forEach(enableDragScroll);
}
function bindTv() {   // bedroom only: switch the room's Sonos to its TV input
  const btn = document.getElementById("tv-mode");
  if (!btn) return;
  btn.addEventListener("click", () => {
    fetch(piUrl("/sonos/tv"), { method: "POST", headers: { "Content-Type": "application/json" },
      body: withRoom({}), keepalive: true }).catch(() => {});
    toast("Switching to TV audio…");
    window.setTimeout(updateSonos, 2000);
  });
}
function renderMusic() {
  fetch(piUrl("/music"), { cache: "no-store" })
    .then((r) => r.json())
    .then((M) => renderMusicRows(M || MUSIC))
    .catch(() => renderMusicRows(MUSIC));
}
let selectedBtn = null;
function markSelected(b) {   // highlight the currently-selected track/station button
  if (selectedBtn) selectedBtn.classList.remove("sel");
  selectedBtn = b;
  b.classList.add("sel");
}
function renderMusicRows(M) {
  [["row-radio", M.radio], ["row-artists", M.artists], ["row-jukebox", M.jukebox],
   ["row-albums", M.albums], ["row-playlists", M.playlists], ["row-podcasts", M.podcasts]]
    .forEach(([id, list]) => {
      const host = document.getElementById(id);
      if (!host || !list) return;
      const category = id.replace("row-", "");   // "albums", "playlists", "artists", …
      host.innerHTML = "";
      list.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chan-btn";
        b.textContent = c.label;
        b.addEventListener("click", () => {
          markSelected(b);
          npCategory = category;      // sent with the play POST; drives next/back visibility
          updateSkip();
          c.podcast ? playPodcast(c.podcast, c.label)
          : c.url   ? playStream(c.url, c.label)
          : c.apple ? playApple(Object.assign({ shuffle: !!c.shuffle }, c.apple), c.label)
                    : playFavorite(c.fav, c.label, !!c.shuffle);
        });
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
    volHoldUntil = Date.now() + 6000;       // your value wins for 6s after adjusting
    renderVol(); renderNP();
    clearTimeout(t);
    t = window.setTimeout(() => setSonosVolume(sonosVol), 150);
  });
  if (b100) b100.addEventListener("click", () => {
    sonosVol = 100; if (s) s.value = 99;
    volHoldUntil = Date.now() + 6000;
    renderVol(); renderNP(); setSonosVolume(100);
  });
  if (bmute) bmute.addEventListener("click", () => {
    sonosMuted = !sonosMuted;
    renderVol(); renderNP();
    fetch(piUrl("/sonos/mute"), { method: "POST", headers: { "Content-Type": "application/json" },
      body: withRoom({ mute: sonosMuted }), keepalive: true }).catch(() => {});
  });
}

/* ---------- Volume as a column of preset boxes (0% = MUTE) ---------- */
const VOL_PRESETS = [100, 75, 50, 25, 10, 5, 0];   // top -> bottom

function sendMute(on) {
  fetch(piUrl("/sonos/mute"), { method: "POST", headers: { "Content-Type": "application/json" },
    body: withRoom({ mute: !!on }), keepalive: true }).catch(() => {});
}
// Paint each box a shade of the album-art accent by its level, and mark the
// box nearest the current volume (or MUTE) as selected.
function renderVolBoxes() {
  const wrap = document.getElementById("vol-boxes");
  if (!wrap || !wrap.children.length) return;
  const accent = (getComputedStyle(document.documentElement).getPropertyValue("--art-accent") || "#9a9a9a").trim();
  const rgb = hexToRgb(accent);
  const sel = sonosMuted ? 0 : VOL_PRESETS.reduce((a, b) => Math.abs(b - sonosVol) < Math.abs(a - sonosVol) ? b : a);
  const n = VOL_PRESETS.length;
  const VOL_VIS_MIN = 0.15;   // darkest (Mute) shade
  wrap.querySelectorAll(".vol-box").forEach((box, i) => {
    const p = Number(box.dataset.vol);
    // even gradient by position: full color at top (100%) down to VOL_VIS_MIN at the bottom (Mute)
    const vf = n <= 1 ? 1 : 1 - (i / (n - 1)) * (1 - VOL_VIS_MIN);
    box.style.background = "rgb(" + Math.round(rgb[0] * vf) + "," + Math.round(rgb[1] * vf) + "," + Math.round(rgb[2] * vf) + ")";
    box.classList.toggle("sel", p === sel);
    if (p === 0) box.textContent = sonosMuted ? "Unmute" : "Mute";   // label follows state
  });
}
function bindVolBoxes() {
  const wrap = document.getElementById("vol-boxes");
  if (!wrap) return;
  VOL_PRESETS.forEach((p) => {
    const box = document.createElement("button");
    box.type = "button";
    box.className = "vol-box";
    box.dataset.vol = String(p);
    box.textContent = p === 0 ? "Mute" : p + "%";
    box.setAttribute("aria-label", p === 0 ? "Mute" : p + "% volume");
    box.__pick = (announce) => {
      volHoldUntil = Date.now() + 6000;
      if (p === 0) {
        sonosMuted = !sonosMuted;   // toggle mute/unmute
        sendMute(sonosMuted);
      } else {
        if (sonosMuted) { sonosMuted = false; sendMute(false); }
        sonosVol = p;
        setSonosVolume(p);
      }
      renderVol(); renderNP();
      if (announce) toast(p === 0 ? (sonosMuted ? "Muted." : "Unmuted.") : "Volume " + p + "%.");
    };
    wrap.appendChild(box);
  });
  bindStripPick(wrap, ".vol-box");
  renderVolBoxes();
}

// Real online/offline indicator, based on Hue bridge reachability.
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
// Map an actual brightness % to the brightness BOXES' display opacity (the
// floored/spread visual), interpolating between the presets. So 1% real -> the
// 1% box's ~0.25 display, not 0.01.
function briDisplayOpacity(pct) {
  if (pct == null) return 1;
  const pairs = BRI_PRESETS
    .map((p, i) => [p, briVis(i, BRI_PRESETS.length, p)])
    .sort((a, b) => a[0] - b[0]);
  if (pct <= pairs[0][0]) return pairs[0][1];
  if (pct >= pairs[pairs.length - 1][0]) return pairs[pairs.length - 1][1];
  for (let i = 1; i < pairs.length; i++) {
    if (pct <= pairs[i][0]) {
      const t = (pct - pairs[i - 1][0]) / (pairs[i][0] - pairs[i - 1][0]);
      return pairs[i - 1][1] + (pairs[i][1] - pairs[i - 1][1]) * t;
    }
  }
  return 1;
}
// Header color follows the active deck: the live light hue on Lights, the
// album-art color on Music.
function updateHeaderColor() {
  applyPageBg();   // deck switch: repaint the body (black on Music, tint on Lights)
  const el = document.querySelector('.kitchen-head .kitchen-title');
  if (!el) return;
  const music = document.getElementById("deck-music");
  if (music && music.classList.contains("deck-active") && CFG.heroPlain !== "true") {
    const accent = (getComputedStyle(document.documentElement).getPropertyValue("--art-accent") || "#9a9a9a").trim();
    el.style.color = accent;
    el.style.opacity = 1;
    el.style.setProperty("-webkit-text-stroke-color", "#ffffff");
  } else {
    el.style.color = "#ffffff";                                   // white fill
    el.style.opacity = 1;
    el.style.setProperty("-webkit-text-stroke-color", "#000000"); // black outline
  }
}
// Paint the page body: the light tint on the Lights deck, always black on Music.
function applyPageBg() {
  const hero = document.getElementById(ROOM + "-hero");
  if (!hero) return;
  const music = document.getElementById("deck-music");
  const onMusic = !!(music && music.classList.contains("deck-active"));
  const bg = onMusic ? "#000000" : lightHeroBg;
  const fg = onMusic ? "#f5f5f4" : lightHeroFg;
  document.body.classList.add("tinted");
  document.body.style.background = bg;
  hero.style.color = fg;
  document.documentElement.style.setProperty("--page-ink", fg);
}
// Hero reflects the ACTUAL current light (on/off + color), not the staged pick.
function paintHero(on, state) {
  let bg, fg;
  if (on && state) {
    const sw = nearestSwatch(state);
    // Dim the page tint by brightness so it carries the same shade the matching
    // box shows in "Choose Brightness" (full color at 100%, darker as it dims).
    const pct = typeof state.bri === "number" ? Math.round((state.bri / 254) * 100) : null;
    const vf = briVisForPct(pct);
    const rgb = hexToRgb(sw.css);
    const dr = Math.round(rgb[0] * vf), dg = Math.round(rgb[1] * vf), db = Math.round(rgb[2] * vf);
    bg = "rgb(" + dr + "," + dg + "," + db + ")";
    const lum = (0.299 * dr + 0.587 * dg + 0.114 * db) / 255;
    fg = lum > 0.6 ? "#141410" : "#ffffff";
  } else {
    bg = "#000000";      // lights off -> black
    fg = "#b8b8b8";      // light gray text
  }
  lightHeroBg = bg;                 // remember the light tint (+ ink) for the header
  lightHeroFg = fg;
  applyPageBg();                    // paint the body: light tint on Lights, black on Music
  const card = document.getElementById("room-" + ROOM);   // home page: tint the room tile
  if (card) { card.style.background = bg; card.style.color = fg; }
  updateHeaderColor();              // header follows deck: light color (Lights) / art color (Music)
  // Lights deck tab reflects the actual light color (black when off)
  const ltab = document.querySelector('.deck-tab[data-deck="deck-lights"]');
  if (ltab) {
    ltab.style.background = bg;
    ltab.style.color = fg;
  }
}

function bridgeList(bridge) {
  if (Array.isArray(bridge)) return bridge;
  return bridge === "all" ? HUE_ALL_BRIDGES : [bridge || "main"];
}
function hueGet(bridge, path) {
  return fetch(piUrl("/hue/" + bridge + path), { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error("Hue " + bridge + " " + path + " " + r.status);
    return r.json();
  });
}
function hueLightsList(data) {
  return Object.keys(data || {}).map((id) => data[id]).filter(Boolean);
}
function readHueBridgeStatus(bridge, group, members) {
  const memberIds = members || [];
  const lightsReq = memberIds.length
    ? Promise.all(memberIds.map((id) => hueGet(bridge, "/lights/" + id).catch(() => null)))
    : hueGet(bridge, "/lights").then(hueLightsList).catch(() => []);

  return Promise.all([hueGet(bridge, "/groups/" + group), lightsReq])
    .then(([grp, lights]) => ({ bridge: bridge, grp: grp, lights: lights.filter(Boolean), ok: true }))
    .catch(() => ({ bridge: bridge, grp: null, lights: [], ok: false }));
}
function readHueStatus(bridge, group, members) {
  const bridges = bridgeList(bridge);
  const all = bridge === "all" || bridges.length > 1;
  const ids = (members || []).filter(Boolean);
  return Promise.all(bridges.map((b) => readHueBridgeStatus(b, group, all ? [] : ids)));
}
function summarizeHueStatus(results) {
  const online = results.filter((r) => r.ok);
  const groups = online.map((r) => r.grp).filter(Boolean);
  const lights = online.reduce((acc, r) => acc.concat(r.lights), []);
  const on = groups.some((grp) => !!(grp && grp.state && grp.state.any_on));
  const onLights = lights.filter((l) => l && l.state && l.state.on && l.state.reachable);
  const rep = onLights.find((l) => l.state.colormode !== "ct" && (l.state.sat || 0) >= 20)
    || onLights[0]
    || lights.find((l) => l && l.state);
  const lstate = rep ? rep.state : {};
  const action = groups.map((grp) => grp && grp.action).find((a) => a && typeof a.bri === "number");
  const bri = typeof lstate.bri === "number" ? lstate.bri : (action ? action.bri : null);
  return {
    online: online.length > 0,
    complete: online.length === results.length,
    on: on,
    state: lstate,
    bri: bri,
  };
}

function lightHasHue(body) {
  return !!(body && Object.prototype.hasOwnProperty.call(body, "hue"));
}

function lightState(entry) {
  return entry && entry.light && entry.light.state ? entry.light.state : null;
}

function lightIsUsable(entry) {
  const state = lightState(entry);
  return !!(state && state.reachable !== false);
}

function lightPct(state) {
  return state && typeof state.bri === "number" ? Math.round((state.bri / 254) * 100) : null;
}

function lightPctMatches(state, pct) {
  const actual = lightPct(state);
  return actual != null && Math.abs(actual - pct) <= 6;
}

function lightColorMatches(state, color) {
  return !!(state && color && nearestSwatch(state).name === color.name);
}

function lightEntryMap(entries) {
  const map = {};
  (entries || []).forEach((entry) => { if (entry && entry.id) map[entry.id] = entry; });
  return map;
}

function readLightTargetPartStatus(part) {
  const memberIds = (part.members || []).filter(Boolean);
  const groupReq = hueGet(part.bridge, "/groups/" + part.group).catch(() => null);
  const lightsReq = memberIds.length
    ? Promise.all(memberIds.map((id) =>
        hueGet(part.bridge, "/lights/" + id)
          .then((light) => ({ id: id, light: light }))
          .catch(() => ({ id: id, light: null }))
      ))
    : hueGet(part.bridge, "/lights")
        .then((data) => Object.keys(data || {}).map((id) => ({ id: id, light: data[id] })))
        .catch(() => []);

  return Promise.all([groupReq, lightsReq]).then(([grp, lights]) => {
    const readLights = (lights || []).filter((entry) => !!(entry && entry.light));
    return { part: part, grp: grp, lights: lights || [], ok: !!grp || readLights.length > 0 };
  });
}

function summarizeLightTargetStatus(partStatuses) {
  const online = partStatuses.filter((partStatus) => partStatus.ok);
  const groups = online.map((partStatus) => partStatus.grp).filter(Boolean);
  const allEntries = online.reduce((acc, partStatus) => {
    return acc.concat((partStatus.lights || []).filter((entry) => !!lightState(entry)));
  }, []);
  const usableEntries = allEntries.filter(lightIsUsable);
  const entries = usableEntries.length ? usableEntries : allEntries;
  const onEntries = entries.filter((entry) => {
    const state = lightState(entry);
    return !!(state && state.on);
  });
  const rep = onEntries.find((entry) => {
    const state = lightState(entry);
    return state && state.colormode !== "ct" && (state.sat || 0) >= 20;
  }) || onEntries[0] || entries[0];
  const state = rep ? lightState(rep) : {};
  const action = groups.map((grp) => grp && grp.action).find((a) => a && typeof a.bri === "number");
  const bri = typeof state.bri === "number" ? state.bri : (action ? action.bri : null);
  const groupOn = groups.some((grp) => !!(grp && grp.state && grp.state.any_on));
  return {
    online: online.length > 0,
    complete: online.length === partStatuses.length,
    on: entries.length ? onEntries.length > 0 : groupOn,
    state: state,
    bri: bri,
    parts: partStatuses,
  };
}

function readLightTargetStatus(key) {
  const target = LIGHT_TARGETS[key] || LIGHT_TARGETS.room;
  return Promise.all(target.parts.map(readLightTargetPartStatus))
    .then(summarizeLightTargetStatus);
}

function refreshLightTargetStatus(key) {
  const targetKey = LIGHT_TARGETS[key] ? key : "room";
  const seq = (lightTargetStatusReadSeq[targetKey] || 0) + 1;
  lightTargetStatusReadSeq[targetKey] = seq;
  return readLightTargetStatus(targetKey)
    .then((status) => {
      if (lightTargetStatusReadSeq[targetKey] !== seq) return status;
      lightTargetStatusByKey[targetKey] = status;
      if (selectedLightTargetKey === targetKey) updateToggle();
      return status;
    })
    .catch(() => {
      if (lightTargetStatusReadSeq[targetKey] !== seq) return null;
      delete lightTargetStatusByKey[targetKey];
      if (selectedLightTargetKey === targetKey) updateToggle();
      return null;
    });
}

function targetStatusIsOff(status) {
  if (!status || !status.online) return false;
  let checked = 0;
  for (const partStatus of status.parts || []) {
    const part = partStatus.part || {};
    const ids = (part.members || []).filter(Boolean);
    const byId = lightEntryMap(partStatus.lights);
    const entries = ids.length ? ids.map((id) => byId[id]).filter(Boolean) : (partStatus.lights || []);
    for (const entry of entries) {
      if (!lightIsUsable(entry)) continue;
      checked += 1;
      const state = lightState(entry);
      if (state && state.on) return false;
    }
  }
  if (checked > 0) return true;
  return (status.parts || []).every((partStatus) => {
    const grp = partStatus.grp;
    return !!(grp && grp.state && grp.state.any_on === false);
  });
}

function targetStatusMatchesSelection(status, isOff, pct, color) {
  if (!status || !status.online) return false;
  if (isOff) return targetStatusIsOff(status);

  const colored = lightHasHue(color && color.body);
  let checked = 0;
  for (const partStatus of status.parts || []) {
    const part = partStatus.part || {};
    const ids = (part.members || []).filter(Boolean);
    const byId = lightEntryMap(partStatus.lights);
    const colorOff = colored ? (part.colorOff || []) : [];
    const whiteOnly = colored ? (part.whiteOnly || []) : [];

    for (const id of ids) {
      const shouldBeOff = colorOff.indexOf(id) !== -1;
      if (!shouldBeOff && whiteOnly.indexOf(id) !== -1) continue;
      const entry = byId[id];
      if (!lightIsUsable(entry)) return false;
      const state = lightState(entry);
      if (shouldBeOff) {
        checked += 1;
        if (state.on) return false;
        continue;
      }
      if (whiteOnly.indexOf(id) !== -1) continue;
      checked += 1;
      if (!state.on || !lightPctMatches(state, pct) || !lightColorMatches(state, color)) return false;
    }
  }
  return checked > 0;
}

function optimisticLightTargetStatus(target, body) {
  const colored = lightHasHue(body);
  const partStatuses = target.parts.map((part) => {
    const colorOff = colored ? (part.colorOff || []) : [];
    const whiteOnly = colored ? (part.whiteOnly || []) : [];
    const lights = (part.members || []).map((id) => {
      if (colored && whiteOnly.indexOf(id) !== -1 && colorOff.indexOf(id) === -1) {
        return { id: id, light: null };
      }
      const state = Object.assign({ reachable: true }, body);
      if (colored && colorOff.indexOf(id) !== -1) state.on = false;
      return { id: id, light: { state: state } };
    });
    return {
      part: part,
      grp: { state: { any_on: body.on !== false }, action: body },
      lights: lights,
      ok: true,
    };
  });
  return summarizeLightTargetStatus(partStatuses);
}

// Home page: tint each room tile with its OWN room's live light color.
// Config (bridge / group / member bulbs) rides on each tile's data-* attrs.
function tintRoomCard(card) {
  const bridge = card.dataset.hueBridge || "main";
  const group = card.dataset.lightsGroup;
  if (!group) return;
  const members = (card.dataset.lightsMembers || "").split(",").filter(Boolean);
  readHueStatus(bridge, group, members)
    .then((results) => {
      const status = summarizeHueStatus(results);
      if (!status.online) return;
      let bg, fg;
      if (status.on) { const sw = nearestSwatch(status.state); bg = sw.css; fg = textColorFor(sw.css); }
      else { bg = "#000000"; fg = "#b8b8b8"; }
      card.style.background = bg;
      card.style.color = fg;
    })
    .catch(() => {});
}
// Light config per room page, keyed by its URL — used to tint the top room-nav
// pills with each room's own live light color (same as the home tiles).
const ROOM_LIGHTS = {
  "/kitchen/":  { bridge: "main",    group: "82",  members: "22,21,20,63,62" },
  "/bed/":      { bridge: "bedroom", group: "99",  members: "43,44,47,48,49,50,53,54" },
  "/bathroom/": { bridge: "bedroom", group: "88",  members: "22,24,20,21,34,35" },
  "/living/":   { bridge: "main",    group: "105", members: "12,13,14,15,16,18,19,40,41" },
};
function initNavLights() {   // stamp each nav pill with its room's light config
  document.querySelectorAll(".room-nav a[href]").forEach((a) => {
    const cfg = ROOM_LIGHTS[a.getAttribute("href")];
    if (!cfg) return;
    a.dataset.hueBridge = cfg.bridge;
    a.dataset.lightsGroup = cfg.group;
    a.dataset.lightsMembers = cfg.members;
  });
}
function tintHomeCards() {   // home tiles + room-nav pills: each tinted by its room
  document.querySelectorAll(".room-card[data-lights-group], .room-nav a[data-lights-group]")
    .forEach(tintRoomCard);
}

function updateLightsStatus() {
  const primaryKey = primaryLightStatusTargetKey();
  readLightTargetStatus(primaryKey)
    .then((status) => {
      if (!status.online) throw new Error("Hue offline");
      lightTargetStatusByKey[primaryKey] = status;
      setConn(status.complete);
      lightsOn = status.on;
      const bpct = typeof status.bri === "number" ? Math.round((status.bri / 254) * 100) : null;
      lightsBri = status.on ? bpct : null;
      lightsColor = status.on ? nearestSwatch(status.state).name : null;
      const text = document.getElementById("lights-line-text");
      if (text) {
        // Brightness block shows "Lights off" only; when on, the slider bubble
        // already reports the % so the line is hidden (and its space collapses).
        text.textContent = status.on ? "" : "Lights off";
        const line = text.closest(".lights-line");
        if (line) line.hidden = status.on;
      }
      paintHero(status.on, status.state);
      updateToggle();
      refreshOffButtons();
      refreshTargetOccupancy();      // repaint the segment fills from live state
      sayJarvis();                   // keep the Jarvis line on the current state
      // Reflect the current state in the color/brightness columns — but only when
      // the selected target IS the one we just read, and only when the state has
      // actually changed (so an in-progress pick isn't wiped by a poll).
      if (selectedLightTargetKey === primaryKey) {
        const ck = [lightsOn, lightsColor, lightsBri].join("|");
        if (ck !== lastControlsKey) { lastControlsKey = ck; syncControlsToTarget(status); }
      }
      if (selectedLightTargetKey !== primaryKey) refreshLightTargetStatus(selectedLightTargetKey);
    })
    .catch(() => {
      setConn(false);
      lightsOn = null;
      lightsBri = null;
      lightsColor = null;
      delete lightTargetStatusByKey[primaryKey];
      const text = document.getElementById("lights-line-text");
      if (text) {
        text.textContent = "Lights —";
        const line = text.closest(".lights-line");
        if (line) line.hidden = false;
      }
      paintHero(false, null);
      updateToggle();
      refreshOffButtons();
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

// Reset the controls to a blank slate: NO color and NO brightness pre-selected.
// The columns instead reflect the live state (see syncControlsToTarget); when the
// lights are off, nothing is selected.
function resetLightControls() {
  const white = COLORS.find((c) => c.name === "White");
  pendingColor = null;                              // no color chosen
  pendingBri = null;                                // no brightness chosen
  pendingBriVis = 1;
  dirty = false;
  selectSwatch(null);
  selectBri(null);
  setTrackColor(white.css);                         // neutral track tint for the bri boxes
  paintBriBoxes(white.css);
  updateToggle();
}

/* ---------- On/Off toggle: label + action follow current state ---------- */
function updateToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  const hasBri = pendingBri != null;
  const pct = hasBri ? Math.round((pendingBri / 254) * 100) : 100;
  const isOff = pendingBri === 0 || (pendingColor && pendingColor.off);
  const targetStatus = lightTargetStatusByKey[selectedLightTargetKey];
  const engaged = targetStatusMatchesSelection(targetStatus, isOff, pct, pendingColor);
  const ctaEl = btn.querySelector(".engage-cta");
  if (ctaEl) ctaEl.textContent = engaged ? "Current" : "Tap to Set";
  const pctEl = document.getElementById("engage-pct");
  if (pctEl) pctEl.textContent = (isOff || !hasBri) ? "" : pct + "%";
  const target = currentLightTarget();
  const targetEl = document.getElementById("engage-target");
  if (targetEl) targetEl.textContent = engageTargetLabel(target.label);
  btn.setAttribute("aria-label", "Toggle " + target.label);
  const nameEl = document.getElementById("engage-color");
  if (nameEl) {
    nameEl.textContent = isOff ? "OFF" : (pendingColor ? pendingColor.name : "");
    nameEl.style.color = "";
    nameEl.style.removeProperty("-webkit-text-stroke-color");
  }
  const paddle = btn.querySelector(".engage-paddle");   // the switch paddle carries the color
  btn.style.color = "";
  btn.dataset.state = targetStatus && targetStatus.on === true ? "on"
    : targetStatus && targetStatus.on === false ? "off"
    : "unknown";
  btn.classList.toggle("is-off-choice", isOff);
  btn.classList.toggle("is-current", engaged);
  if (isOff) {                                // black or 0% -> off preview
    if (paddle) paddle.style.background = "#000000";
    btn.style.color = "#f5f5f4";
  } else if (pendingColor) {                  // paddle = the color at the chosen brightness's display shade
    const frac = pendingBriVis;
    const rgb = hexToRgb(pendingColor.css);
    const r = Math.round(rgb[0] * frac), g = Math.round(rgb[1] * frac), b = Math.round(rgb[2] * frac);
    if (paddle) paddle.style.background = "rgb(" + r + "," + g + "," + b + ")";
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    btn.style.color = lum > 0.6 ? "#141410" : "#ffffff";
  }
  btn.classList.toggle("engaged", engaged);
  updateLightsTab();
}

function selectLightTarget(key) {
  if (!LIGHT_TARGETS[key]) key = "room";
  selectedLightTargetKey = key;
  const host = document.getElementById("light-targets");
  const btns = host ? Array.from(host.querySelectorAll("[data-light-target]")) : [];
  let idx = 0;
  btns.forEach((btn, i) => {
    const selected = btn.dataset.lightTarget === key;
    if (selected) idx = i;
    btn.classList.toggle("is-selected", selected);   // a11y hook; the thumb shows selection
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  if (host) host.style.setProperty("--sel", String(idx));   // slide the thumb to it
  updateToggle();
  // Reflect the chosen target's current color + brightness in the pick columns.
  if (lightTargetStatusByKey[key]) syncControlsToTarget(lightTargetStatusByKey[key]);  // cached, instant
  refreshLightTargetStatus(key).then((status) => {          // then reconcile from bridge
    if (selectedLightTargetKey === key && status) syncControlsToTarget(status);
  });
  refreshTargetOccupancy();
}

// Point the color + brightness columns at a target's CURRENT state: a uniform
// scene selects the matching swatch + brightness box (so the next tweak starts
// from there); "various"/"off"/unknown just clears the brightness selection.
function syncControlsToTarget(status) {
  const u = targetUniformState(status);
  if (u.state === "uniform") {
    const c = COLORS.find((x) => x.name === u.color);
    if (c) {
      const sw = document.querySelector('#swatches .swatch[data-name="' + c.name + '"]');
      if (sw) selectSwatch(sw);
      setTrackColor(c.css);
      paintBriBoxes(c.css);
      pendingColor = { body: c.body, css: c.css, name: c.name, off: c.off };
    }
    if (u.pct != null) {
      let best = null, bestD = Infinity;
      document.querySelectorAll("#bri-boxes .bri-box").forEach((b) => {
        const p = Number(b.dataset.pct);
        if (p === 0) return;
        const d = Math.abs(p - u.pct);
        if (d < bestD) { bestD = d; best = b; }
      });
      if (best) {
        selectBri(best);
        pendingBri = Math.round((Number(best.dataset.pct) / 100) * 254);
        pendingBriVis = Number(best.dataset.vis) || 1;
      }
    }
  } else {
    // off / various / unknown -> no single current value: clear BOTH selections
    // (so lights-off shows no color and no brightness chosen).
    selectSwatch(null);
    pendingColor = null;
    selectBri(null);
    pendingBri = null;
  }
  updateToggle();
}

// White segment = at least one light on in scope; gray = all off.
function setTargetOccupancy(key, anyOn) {
  const host = document.getElementById("light-targets");
  if (!host || anyOn == null) return;
  const btn = host.querySelector('[data-light-target="' + key + '"]');
  if (btn) btn.classList.toggle("is-on", anyOn === true);
}
// UNIFORMITY across a target's scope. Returns one of:
//   { state: "unknown" }                        - not read yet / offline
//   { state: "off" }                            - every light off
//   { state: "various" }                        - a mix (some off, or differing color/%)
//   { state: "uniform", color: "Red", pct: 50 } - all on, one color, one brightness
// The "can't be a color" lights (colorOff / whiteOnly members) are excluded — those
// are the ones the app deliberately drops or keeps white during a colored scene, so
// they shouldn't force VARIOUS on an otherwise-uniform scene.
// Can this bulb actually show a hue? Color/extended-color lights carry a `hue`
// field (and a colorgamut); dimmable-only and color-temperature ("white only")
// bulbs do not. Used to keep white-only bulbs out of the uniform-color check.
function lightCanColor(entry) {
  const l = entry && entry.light;
  if (!l) return false;
  const st = l.state || {};
  if (typeof st.hue === "number" || st.colormode === "hs" || st.colormode === "xy") return true;
  const ctrl = l.capabilities && l.capabilities.control;
  if (ctrl && ctrl.colorgamut) return true;
  const t = (l.type || "").toLowerCase();
  return t.indexOf("color") !== -1 && t.indexOf("temperature") === -1;
}
function targetUniformState(status) {
  if (!status || !status.online) return { state: "unknown" };
  const all = [];        // usable members, minus configured colorOff/whiteOnly
  const colorCap = [];   // of those, the ones that can actually show a color
  (status.parts || []).forEach((ps) => {
    const part = ps.part || {};
    const skip = (part.colorOff || []).concat(part.whiteOnly || []).concat(part.exclude || []);
    const byId = lightEntryMap(ps.lights);
    (part.members || []).forEach((id) => {
      if (skip.indexOf(id) !== -1) return;
      const entry = byId[id];
      if (!(entry && lightState(entry) && lightIsUsable(entry))) return;
      all.push(entry);
      if (lightCanColor(entry)) colorCap.push(entry);
    });
  });
  // Judge by the color-capable bulbs; only if there are none fall back to all
  // (e.g. a scope of purely dimmable lights still reports White + %).
  const list = colorCap.length ? colorCap : all;
  if (!list.length) return status.on ? { state: "various" } : { state: "off" };
  const onList = list.filter((e) => { const s = lightState(e); return s && s.on; });
  if (onList.length === 0) return { state: "off" };
  if (onList.length !== list.length) return { state: "various" };   // a mix of on and off
  let colorName = null, pct = null;
  for (const e of onList) {
    const s = lightState(e);
    const c = nearestSwatch(s).name;
    const p = lightPct(s);
    if (colorName === null) colorName = c; else if (c !== colorName) return { state: "various" };
    if (pct === null) pct = p; else if (p == null || Math.abs(p - pct) > 3) return { state: "various" };
  }
  return { state: "uniform", color: colorName, pct: pct };
}
// A segment's second line: "{COLOR} {pct}%" / "OFF" / "VARIOUS" / "" (unknown).
function targetLine2Text(status) {
  const u = targetUniformState(status);
  if (u.state === "off") return "OFF";
  if (u.state === "various") return "VARIOUS";
  if (u.state === "uniform") return u.pct != null ? u.color + " " + u.pct + "%" : u.color;
  return "";
}
function setTargetLine2(key, text) {
  const host = document.getElementById("light-targets");
  if (!host) return;
  const btn = host.querySelector('[data-light-target="' + key + '"]');
  const sub = btn && btn.querySelector(".target-sub");
  if (sub) sub.textContent = text || "";
}
// Read every segment's own scope and paint both its fill (occupancy) and its
// second line (color + brightness, or OFF).
function refreshTargetOccupancy() {
  const host = document.getElementById("light-targets");
  if (!host) return;
  host.querySelectorAll("[data-light-target]").forEach((btn) => {
    const key = btn.dataset.lightTarget;
    if (!LIGHT_TARGETS[key]) return;
    readLightTargetStatus(key).then((status) => {
      lightTargetStatusByKey[key] = status;
      if (status && status.online) setTargetOccupancy(key, status.on);
      setTargetLine2(key, targetLine2Text(status));
    }).catch(() => {});
  });
}

function bindLightTargets() {
  const host = document.getElementById("light-targets");
  if (!host) return;
  const btns = Array.from(host.querySelectorAll("[data-light-target]"));
  host.style.setProperty("--seg-count", String(btns.length));
  if (!host.querySelector(".target-thumb")) {          // the sliding selection ring
    const thumb = document.createElement("span");
    thumb.className = "target-thumb";
    thumb.setAttribute("aria-hidden", "true");
    host.appendChild(thumb);
  }
  btns.forEach((btn) => {
    const target = LIGHT_TARGETS[btn.dataset.lightTarget];
    if (!target) return;
    // Line 1 = the target's name (icon + label); line 2 = its live state.
    btn.innerHTML =
      '<span class="target-top">' + (target.icon || "") +
      '<span class="btn-label">' + target.label + "</span></span>" +
      '<span class="target-sub" aria-hidden="true"></span>';
    btn.addEventListener("click", () => selectLightTarget(btn.dataset.lightTarget));
  });
  selectLightTarget(CFG.defaultLightTarget || "room");
  refreshTargetOccupancy();
}

/* ---------- Jarvis, the butler: a line that editorializes on each change ---------- */
function fillLine(bank, vars) {
  const s = bank[Math.floor(Math.random() * bank.length)] || "";
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}
function jarvisRemark() {
  const label = currentLightTarget().label;
  const t2 = label.replace(/\s+Lights$/i, "").trim();   // "Whole House", "Living Room"
  const vars = { t: label, t2: t2, c: lightsColor || "White", p: lightsBri != null ? lightsBri : 100 };
  if (lightsOn === false) {
    return fillLine([
      "{t2}, extinguished. Dramatic.",
      "Lights out in the {t2}. Bold move.",
      "{t2} off. I'll be here in the dark, then.",
      "Darkness it is. Very mysterious of you.",
    ], vars);
  }
  if (lightsOn !== true) return "";
  // Tone tracks the %: hushed when low, easy in the middle, brazen when high.
  // Every line names the color and the brightness. And every line is a little sassy.
  let bank;
  if (vars.p <= 25) {          // low — never "bold" down here
    bank = [
      "{c} at {p}%. Barely trying, but I respect it.",
      "A moody {c}, {p}%. Very film-noir of you.",
      "{c} dimmed to {p}%. Setting a mood, are we?",
      "{p}% {c}. Practically candlelight — I'll pretend it's lighting.",
      "{c}, {p}%. Cozy. Or you forgot to turn it up. No judgment.",
      "Whispering {c} at {p}%. Intimate. I'll avert my eyes.",
      "{c} at {p}%. Romantic, or you're hiding something.",
    ];
  } else if (vars.p >= 75) {   // high — go big
    bank = [
      "{c} at {p}%. Now THAT is a statement.",
      "Full {c}, {p}%. Blinding. Magnificent. Mildly aggressive.",
      "{c} cranked to {p}%. Subtlety has left the building.",
      "{p}% {c}. Bold. I'm practically getting a tan.",
      "{c} at {p}%. Go big or go home, evidently.",
      "Blazing {c}, {p}%. The neighbors say hello.",
      "{c} at {p}%. Maximum drama. I approve.",
    ];
  } else {                     // middle — sensible, faintly unimpressed
    bank = [
      "{c} at {p}%. Sensible. How refreshingly boring.",
      "{p}% {c}. The Goldilocks setting. Well played.",
      "{c}, {p}%. Comfortable, adequate, chef's kiss, I suppose.",
      "A tasteful {c} at {p}%. Look at you, having taste.",
      "{c} at {p}%. Not too much, not too little. Diplomatic.",
      "{p}% of {c}. Perfectly reasonable. Yawn.",
    ];
  }
  return fillLine(bank, vars);
}
// Music-deck remark — reflects what the Sonos is doing.
function jarvisMusicRemark() {
  const room = ROOM_LABEL;
  if (npTv) return fillLine(["TV audio in the {r}.", "Playing the telly through the {r}."], { r: room });
  const track = (npTrack || npStation || npPlaylist || "").trim();
  if (!npPlaying || !track) {
    return fillLine(["Silence in the {r}, for now.", "Nothing playing.", "The {r} is quiet."], { r: room });
  }
  return fillLine(["Now playing: {x} · {v}%.", "{x}, at {v}%.", "Spinning {x} — {v}%."], { x: track, v: sonosVol });
}
let lastJarvisKey = null;
function sayJarvis(force) {
  const el = document.getElementById("jarvis-line");
  if (!el) return;
  // Match the active deck; only re-phrase when the state actually changes (so a
  // status poll doesn't keep reshuffling the wording).
  const music = document.getElementById("deck-music");
  const onMusic = !!(music && music.classList.contains("deck-active"));
  const key = onMusic
    ? ["music", npPlaying, npTv, npTrack, npStation, npPlaylist, sonosMuted, sonosVol].join("|")
    : ["lights", selectedLightTargetKey, lightsOn, lightsColor, lightsBri].join("|");
  if (!force && key === lastJarvisKey) return;
  lastJarvisKey = key;
  el.textContent = (onMusic ? jarvisMusicRemark() : jarvisRemark()) || "";   // unsigned
}

// The "Lights" deck tab reflects status: "Lights 75%" when on, "Lights Off"
// when off, plain "Lights" until the first bridge read.
function updateLightsTab() {
  const suffix = document.querySelector('.deck-tab[data-deck="deck-lights"] .deck-tab-pct');
  if (suffix) {
    if (lightsOn === true) suffix.textContent = lightsBri != null ? "(" + lightsBri + "%)" : "";
    else if (lightsOn === false) suffix.textContent = "(Off)";
    else suffix.textContent = "";
  }
  updateHeroStatus();
}

// Header shows the light status after "Bed Lights" — e.g. "Bed Lights 75%" /
// "Bed Lights Off" — but only while the Lights deck is showing.
function updateHeroStatus() {
  const el = document.getElementById("hero-status");
  const colorEl = document.getElementById("hero-color");   // sits between "Lights" and the %
  if (!el) return;
  const lights = document.getElementById("deck-lights");
  const music = document.getElementById("deck-music");
  const titleOnly = !!document.getElementById("light-targets") || CFG.heroPlain === "true";
  if (lights && lights.classList.contains("deck-active")) {          // Lights deck
    if (titleOnly) {
      // Title = "<Room> <deck word>" only (e.g. "Living Room Lights"); the Jarvis
      // line / target buttons carry the actual state, so drop color + %.
      if (colorEl) colorEl.textContent = "";
      el.textContent = "";
    } else if (lightsOn === true) {                                 // Lights: color + brightness
      if (colorEl) colorEl.textContent = lightsColor || "";
      el.textContent = lightsBri != null ? lightsBri + "%" : "";
    } else if (lightsOn === false) {
      if (colorEl) colorEl.textContent = "OFF";
      el.textContent = "";
    } else {
      if (colorEl) colorEl.textContent = "";
      el.textContent = "";
    }
  } else if (music && music.classList.contains("deck-active")) {     // Music deck
    if (colorEl) colorEl.textContent = "";
    // Plain-header pages (e.g. Living) show just "<Room> Music"; others append volume.
    el.textContent = CFG.heroPlain === "true" ? "" : (sonosMuted ? "Muted" : sonosVol + "%");
  } else {
    if (colorEl) colorEl.textContent = "";
    el.textContent = "";
  }
  sayJarvis();   // keep the Jarvis line matched to the active deck + state
}

// Enact the staged color + brightness on the selected target (turn on / off in place).
// Called immediately when a brightness box is picked. opts.live = true for the
// throttled updates while a finger is dragging down the column: those skip the
// toast, the butler line, and the follow-up bridge read (the final release does
// the full version).
function engageLights(opts) {
  opts = opts || {};
  const live = !!opts.live;
  const targetKey = selectedLightTargetKey;
  const target = currentLightTarget();
  const isOff = pendingBri === 0 || (pendingColor && pendingColor.off);
  const rememberTargetStatus = (body) => {
    lightTargetStatusByKey[targetKey] = optimisticLightTargetStatus(target, body);
  };
  if (isOff) {
    // the chosen setting is itself "off" (black or 0%) -> apply off
    applyLights({ on: false, transitiontime: 0 });   // snap, no fade
    dirty = false;
    rememberTargetStatus({ on: false });
    lightsOn = false;
    lightsColor = null; lightsBri = null;   // optimistic: room is now off
    setTargetOccupancy(targetKey, false);
    setTargetLine2(targetKey, "OFF");
    if (!live) { toast(target.label + " off."); sayJarvis(); }
  } else {
    // enact the current selection (turn on / update in place); keep selection
    const body = pendingColor && pendingColor.body ? Object.assign({}, pendingColor.body) : { on: true };
    if (pendingBri != null && pendingBri > 0) body.bri = pendingBri;
    body.transitiontime = 0;   // snap to the new color/brightness, no fade
    applyLights(body);   // colored scene skips the office lamp; white/off include it
    dirty = false;
    rememberTargetStatus(body);
    lightsOn = true;
    // optimistic: room now matches the staged selection (switch flips on)
    lightsColor = pendingColor ? pendingColor.name : null;
    lightsBri = pendingBri != null ? Math.round((pendingBri / 254) * 100) : 100;
    setTargetOccupancy(targetKey, true);
    setTargetLine2(targetKey, (lightsColor || "White") + " " + lightsBri + "%");
    if (!live) { toast(target.label + " engaged."); sayJarvis(); }
  }
  updateToggle();
  updateLightsTab();   // header color/% + deck-tab reflect the new state at once
  if (!live) {
    window.setTimeout(() => {                            // confirm from bridge
      updateLightsStatus();
      if (targetKey !== "room") refreshLightTargetStatus(targetKey);
      refreshTargetOccupancy();
    }, 500);
  }
}

// Live dimming: while dragging the brightness column, apply at most ~1x/150ms so
// the bulbs track the finger without flooding the bridge. Always trailing-edge
// so the last position lands even if it arrived mid-throttle.
let briLiveTimer = null, briLivePending = false;
function engageLightsLive() {
  if (briLiveTimer) { briLivePending = true; return; }
  engageLights({ live: true });
  briLiveTimer = window.setTimeout(() => {
    briLiveTimer = null;
    if (briLivePending) { briLivePending = false; engageLightsLive(); }
  }, 150);
}
function engageLightsFinal() {
  if (briLiveTimer) { window.clearTimeout(briLiveTimer); briLiveTimer = null; }
  briLivePending = false;
  engageLights();
}

function bindLightsToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  btn.addEventListener("click", engageLightsFinal);
}

// Turn off only THIS room's lights (its own Hue group, on its own bridge).
function bindRoomOff() {
  const btn = document.getElementById("room-off");
  if (!btn) return;
  setIconButtonLabel(btn, ROOM_OFF_ICONS[ROOM], ROOM_LABEL.toUpperCase() + " LIGHTS OFF");
  btn.addEventListener("click", () => {
    if (isOffDisabled(btn)) return;
    runHue({ on: false });
    toast(ROOM_LABEL + " lights off.");
    window.setTimeout(updateLightsStatus, 500);
  });
}
// Turn off EVERY light on this room's Hue hub. main hub = Front of House,
// bedroom hub = Back of House. Group 0 is the bridge's built-in "all lights".
function bindHouseOff() {
  const btn = document.getElementById("house-off");
  if (!btn) return;
  const foh = HUE_BRIDGE === "main";
  const label = foh ? "FRONT OF HOUSE OFF" : "BACK OF HOUSE OFF";
  setIconButtonLabel(btn, HOUSE_ICON, label);
  btn.addEventListener("click", () => {
    if (isOffDisabled(btn)) return;
    runHueProxy({ path: "/groups/0/action", body: { on: false } });
    toast((foh ? "Front" : "Back") + " of house off.");
    window.setTimeout(updateLightsStatus, 500);
  });
}
// Turn off EVERY light in the house (both Hue hubs), from any room page.
function bindHouseOffAll() {
  const btn = document.getElementById("house-off-all");
  if (!btn) return;
  setIconButtonLabel(btn, HOUSE_ICON, "WHOLE HOUSE OFF");
  btn.addEventListener("click", () => {
    if (isOffDisabled(btn)) return;
    HUE_ALL_BRIDGES.forEach((bridge) => {
      fetch(piUrl("/hue"), { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridge: bridge, path: "/groups/0/action", body: { on: false } }),
        keepalive: true }).catch(() => {});
    });
    toast("All House lights off.");
    window.setTimeout(updateLightsStatus, 500);
  });
}

function isOffDisabled(btn) {
  return !!btn && btn.getAttribute("aria-disabled") === "true";
}
// Mark an OFF action as inactive when it would do nothing. Do not use native
// disabled here; Safari restyles disabled buttons and breaks the nav-button look.
function setOffDisabled(btn, disabled) {
  if (!btn) return;
  btn.disabled = false;
  btn.setAttribute("aria-disabled", disabled ? "true" : "false");
}
// Refresh the three OFF buttons' disabled state against live bridge status:
//   room-off (BED OFF)      -> disabled when this room's own lights are all off
//   house-off (BOH/FOH OFF) -> disabled when this hub's lights are all off
//   house-off-all (HOUSE)   -> disabled when every light in the house is off
// Group 0 is each bridge's built-in "all lights"; its state.any_on tells us
// whether anything on that hub is still lit.
function refreshOffButtons() {
  setOffDisabled(document.getElementById("room-off"), lightsOn === false);
  const hubBtn = document.getElementById("house-off");
  const houseBtn = document.getElementById("house-off-all");
  if (!hubBtn && !houseBtn) return;
  Promise.all(HUE_ALL_BRIDGES.map((b) =>
    hueGet(b, "/groups/0")
      .then((g) => ({ b: b, any: !!(g && g.state && g.state.any_on) }))
      .catch(() => ({ b: b, any: null }))          // unreachable -> leave as-is
  )).then((res) => {
    if (hubBtn) {
      const hub = HUE_BRIDGE === "all"
        ? res.some((r) => r.any === true)
        : (res.find((r) => r.b === HUE_BRIDGE) || {}).any;
      if (hub === true || hub === false) setOffDisabled(hubBtn, hub === false);
    }
    if (houseBtn && res.every((r) => r.any !== null)) {
      setOffDisabled(houseBtn, !res.some((r) => r.any === true));
    }
  });
}

/* ---------- Color swatches (col 1) + brightness preset boxes (col 2) ---------- */
// Brightness shown as stacked boxes, top -> bottom. 0 is the selected-target off command.
const BRI_PRESETS = [100, 90, 75, 50, 25, 10, 1, 0];
// Display-only shade per box: spread evenly from full (top row) down to
// BRI_VIS_MIN (bottom row) so all 7 look distinct even though the real light
// values bunch up at the low end. Labels + actual light settings are unaffected.
const BRI_VIS_MIN = 0.22;
// Per-preset display-shade overrides (by label %). Tweak these freely; they only
// change how a box/Engage looks, never the label or the light value.
const BRI_VIS_OVERRIDE = { 1: 0.25, 0: 0 };
function briVis(i, n, p) {
  if (BRI_VIS_OVERRIDE[p] != null) return BRI_VIS_OVERRIDE[p];
  return n <= 1 ? 1 : 1 - (i / (n - 1)) * (1 - BRI_VIS_MIN);
}
// The display shade for a given brightness %, matching the nearest "Choose
// Brightness" box — used to dim the page tint the same way.
function briVisForPct(pct) {
  if (pct == null) return 1;
  let bi = 0, bd = Infinity;
  BRI_PRESETS.forEach((p, i) => { const d = Math.abs(p - pct); if (d < bd) { bd = d; bi = i; } });
  return briVis(bi, BRI_PRESETS.length, BRI_PRESETS[bi]);
}

function selectBri(el) {
  if (selectedBriEl) selectedBriEl.classList.remove("sel");
  selectedBriEl = el;
  if (el) el.classList.add("sel");
}

// Tap or slide a finger across a column of pickable boxes (each carries __pick).
function bindStripPick(container, itemSel) {
  if (!container) return;
  let picking = false, pointerUsed = false, lastEl = null;
  const itemAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest(itemSel) : null;
  };
  container.addEventListener("pointerdown", (e) => {
    picking = true; pointerUsed = true; lastEl = null;
    if (container.setPointerCapture) container.setPointerCapture(e.pointerId);
    const it = itemAt(e.clientX, e.clientY);
    if (it && it.__pick) { it.__pick(false); lastEl = it; }
    e.preventDefault();
  });
  container.addEventListener("pointermove", (e) => {
    if (!picking) return;
    const it = itemAt(e.clientX, e.clientY);
    if (it && it.__pick && it !== lastEl) { it.__pick(false); lastEl = it; }
  });
  const end = () => {
    if (!picking) return;
    picking = false;
    // Commit the final element here (works for both tap and drag). preventDefault on
    // pointerdown can swallow the click event on touch, so don't rely on click for taps.
    if (lastEl && lastEl.__pick) lastEl.__pick(true);
  };
  container.addEventListener("pointerup", end);
  container.addEventListener("pointercancel", end);
  container.addEventListener("click", (e) => {                     // keyboard / synthetic only
    if (pointerUsed) { pointerUsed = false; return; }              // pointer path already committed
    const it = e.target.closest ? e.target.closest(itemSel) : null;
    if (it && it.__pick) it.__pick(true);
  });
}

// Tint the brightness boxes to shades of the chosen color (dimmer box = darker).
function paintBriBoxes(css) {
  const rgb = hexToRgb(css);
  const isWhite = css.toLowerCase() === "#ffffff";
  const text = isWhite ? "#000000" : "#ffffff";   // black only for White
  const boxes = document.getElementById("bri-boxes");
  if (boxes) boxes.classList.toggle("on-white", isWhite);   // black selection ring for White
  document.querySelectorAll("#bri-boxes .bri-box").forEach((box) => {
    const vf = Number(box.dataset.vis);   // display shade (spread, floored) — set at build
    const r = Math.round(rgb[0] * vf), g = Math.round(rgb[1] * vf), b = Math.round(rgb[2] * vf);
    box.style.background = "rgb(" + r + "," + g + "," + b + ")";
    box.style.color = box.dataset.pct === "0" ? "#ffffff" : text;
  });
}

function bindLightTools() {
  // Jarvis's line sits inside the header, right under the title words.
  const title = document.querySelector(".kitchen-head .kitchen-title");
  if (title && !document.getElementById("jarvis-line")) {
    const line = document.createElement("p");
    line.id = "jarvis-line";
    line.className = "jarvis-line";
    line.textContent = "At your service.";
    title.insertAdjacentElement("afterend", line);
  }

  // Column 1 — colors (White top -> Purple bottom)
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
      b.__pick = (announce) => {
        if (selectedSwatchEl === b && !announce) return;
        selectSwatch(b);
        setTrackColor(c.css);
        paintBriBoxes(c.css);                     // brightness column takes the chosen color
        pendingColor = { body: c.body, css: c.css, name: c.name, off: c.off };
        dirty = true;
        updateToggle();
        if (!announce) return;
        // Lights already on -> recolor them in place at once. Off -> just stage the
        // color; the user picks a brightness (which turns them on).
        if (lightsOn === true) engageLightsFinal();
        else toast(c.name + " — now choose a brightness.");
      };
      swatches.appendChild(b);
    });
    bindStripPick(swatches, ".swatch");
  }

  // Column 2 — brightness presets (100% top -> 1% bottom), darker box = dimmer
  const briBoxes = document.getElementById("bri-boxes");
  if (briBoxes) {
    BRI_PRESETS.forEach((p, i) => {
      const box = document.createElement("button");
      box.type = "button";
      box.className = "bri-box";
      box.dataset.pct = String(p);
      const vis = briVis(i, BRI_PRESETS.length, p);
      box.dataset.vis = String(vis);
      const v = Math.round(vis * 255);
      box.style.background = "rgb(" + v + "," + v + "," + v + ")";
      const label = p === 0 ? "OFF" : p + "%";
      box.textContent = label;
      box.setAttribute("aria-label", p === 0 ? "Off" : p + "% brightness");
      box.__pick = (announce) => {
        if (selectedBriEl === box && !announce) return;
        selectBri(box);
        pendingBri = Math.round((p / 100) * 254);
        pendingBriVis = vis;
        dirty = true;
        updateToggle();
        // Picking a brightness engages color + brightness immediately (no Engage tap).
        // announce = the finger lifted (final) -> full engage; otherwise it's a drag
        // step -> live throttled dim so the lights track the finger.
        if (announce) engageLightsFinal();
        else engageLightsLive();
      };
      briBoxes.appendChild(box);
    });
    bindStripPick(briBoxes, ".bri-box");
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
    toast("Now playing " + title);
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
// Each print button targets its own sheet by id (data-print="ps-kitchen").
// Only the targeted sheet gets `.printing`, so the others stay hidden.
function bindPrint() {
  document.querySelectorAll("[data-print]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-print");
      const sheet = (id && id !== "true" && document.getElementById(id))
        || document.querySelector(".print-sheet");
      document.querySelectorAll(".print-sheet.printing")
        .forEach((s) => s.classList.remove("printing"));
      if (sheet) sheet.classList.add("printing");
      const cleanup = () => {
        if (sheet) sheet.classList.remove("printing");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.print();
    });
  });
}

/* ---------- Rooms not yet in service (home page) ---------- */
function bindSoonRooms() {
  document.querySelectorAll("[data-soon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toast(btn.dataset.soon + " isn't ready yet.");
    });
  });
}

function ensureSonosCompanion() {
  if (!CFG.sonosEnsureCompanion) return;
  fetch(piUrl("/sonos/ensure-companion"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: withRoom({}),
    keepalive: true,
  }).catch(() => {});
}

let syncingCompanionVolume = false;
function syncSonosCompanionVolume() {
  if (!CFG.sonosSyncCompanionVolume || syncingCompanionVolume || document.hidden) return;
  syncingCompanionVolume = true;
  fetch(piUrl("/sonos/sync-companion-volume"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: withRoom({}),
    keepalive: true,
  }).catch(() => {}).then(() => { syncingCompanionVolume = false; });
}

document.addEventListener("DOMContentLoaded", () => {
  setGreeting();
  renderChannels();
  renderPodcasts();
  bindShortcutButtons();
  bindPrint();
  bindSoonRooms();
  bindLightsToggle();
  bindRoomOff();
  bindHouseOff();
  bindHouseOffAll();
  bindDragScroll();
  bindLightTools();
  bindLightTargets();
  resetLightControls();     // default selection: white + 100%
  bindVolume();
  bindVolBoxes();
  renderMusic();
  renderShare();
  bindTv();
  bindPlayPause();
  bindSkip();
  ensureSonosCompanion();
  syncSonosCompanionVolume();
  if (CFG.sonosSyncCompanionVolume) {
    window.setInterval(syncSonosCompanionVolume, 4000);
    window.addEventListener("visibilitychange", () => { if (!document.hidden) syncSonosCompanionVolume(); });
  }
  if (!document.querySelector(".room-grid")) {
    updateLightsStatus();      // room page: its own lights section + hero tint
    window.setInterval(updateLightsStatus, 8000);   // keep status + OFF-button enabled states fresh
    window.addEventListener("visibilitychange", () => { if (!document.hidden) updateLightsStatus(); });
  }
  initNavLights();             // give the top nav pills their room light configs
  tintHomeCards();             // tint home tiles AND room-nav pills by room light color
  window.setInterval(tintHomeCards, 10000);
  window.addEventListener("visibilitychange", () => { if (!document.hidden) tintHomeCards(); });
  if (CFG.sonosSolo) {                        // this room plays alone — eject anyone grouped in
    fetch(piUrl("/sonos/isolate"), { method: "POST", headers: { "Content-Type": "application/json" },
      body: withRoom({}), keepalive: true }).catch(() => {});
  }
  updateSonos();
  window.setInterval(updateSonos, 5000);    // keep now-playing/volume fresh
});
