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
  HUE_WRITE.forEach((bridge) => {       // "all" = send to both hubs
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
const LIGHTS_GROUP = CFG.lightsGroup || "82";            // Hue group id
const LIGHTS_MEMBERS = (CFG.lightsMembers || "22,21,20,63,62").split(",").filter(Boolean);  // bulbs (true color)
let lightsOn = null;         // true / false / null (unknown)
let lightsBri = null;        // current on-brightness as 0-100 %, or null
let lightsColor = null;      // current light color mapped to a swatch name, or null
let lightHeroBg = "#8a8a8a"; // current light color css (for the header on the Lights deck)
let pendingColor = null;     // { body, css } current color selection (default white)
let pendingBri = 254;        // current brightness selection (default 100%)
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
function applyLights(body) {
  const colored = body && Object.prototype.hasOwnProperty.call(body, "hue");
  if (OFFICE_LAMP && colored) {
    runHueLights([OFFICE_LAMP], { on: false });   // colored scene starts by turning it off
    const colorMembers = LIGHTS_MEMBERS.filter((id) => id !== OFFICE_LAMP);
    if (colorMembers.length) runHueLights(colorMembers, body);
  } else {
    runHue(body);   // white / brightness-only / off -> whole group (incl. office lamp)
  }
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
    { label: "Warren Zevon", fav: "Warren Zevon" },
    { label: "Hootie and the Blowfish", fav: "Hootie and the Blowfish" },
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

let sonosVol = 0, sonosMuted = false, npTrack = "", npStation = "", npPlaylist = "", npPlaying = false;
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
    c.textContent = (playing && npCategory) ? "FROM " + npCategory.toUpperCase() : "";
  }
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
      npTrack = d.track || "";
      npStation = d.station || "";
      npPlaylist = d.playlist || "";
      const tvBtn = document.getElementById("tv-mode");   // bedroom only
      if (tvBtn) tvBtn.classList.toggle("on", !!d.tv);
      if (!npCategory && d.category) npCategory = d.category;   // restore on fresh load
      updatePlayPause();
      updateSkip();
      const playbar = document.querySelector(".np-playbar");    // no transport controls in TV mode
      if (playbar) playbar.hidden = !!d.tv;
      const art = document.getElementById("np-art");
      const loading = document.getElementById("np-art-loading");
      const msg = document.getElementById("np-art-msg");
      const tvArt = document.getElementById("np-art-tv");   // bedroom TV graphic
      const sourceName = () => npPlaylist || npStation || npTrack || "No art";
      if (tvArt) tvArt.hidden = !d.tv;
      if (d.tv) {                              // TV audio: show the TV graphic, nothing else
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
        house: [["FOH", ["Kitchen", "Living Room"]], ["BOH", ["Bedroom", "Office", "Bathroom"]], ["ENTRYWAY", ["Entryway"]]],
        kitchen: [["FOH", ["Lounge", "Living Room"]], ["BOH", ["Bedroom", "Office", "Bathroom"]]],
        bedroom: [["ADD BATH", ["Bathroom"], "Bath"]],
        bathroom: [["BOH", ["Bedroom"]]],
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
  const el = document.querySelector('.kitchen-head .kitchen-title');
  if (!el) return;
  const music = document.getElementById("deck-music");
  if (music && music.classList.contains("deck-active")) {
    const accent = (getComputedStyle(document.documentElement).getPropertyValue("--art-accent") || "#9a9a9a").trim();
    el.style.color = accent;
    el.style.opacity = 1;
    el.style.setProperty("-webkit-text-stroke-color", "#ffffff");
  } else {
    el.style.color = lightsOn === true ? lightHeroBg : "#8a8a8a";
    el.style.opacity = lightsOn === true ? briDisplayOpacity(lightsBri) : 1;
    const whiteLight = lightsOn === true && lightHeroBg && lightHeroBg.toLowerCase() === "#ffffff";
    el.style.setProperty("-webkit-text-stroke-color", whiteLight ? "#000000" : "#ffffff");
  }
}
// Hero reflects the ACTUAL current light (on/off + color), not the staged pick.
function paintHero(on, state) {
  let bg, fg;
  if (on && state) {
    const sw = nearestSwatch(state);
    bg = sw.css;
    fg = textColorFor(sw.css);
  } else {
    bg = "#000000";      // lights off -> black
    fg = "#b8b8b8";      // light gray text
  }
  const hero = document.getElementById(ROOM + "-hero");   // room page: tint the whole page
  if (hero) {
    document.body.classList.add("tinted");
    document.body.style.background = bg;
    hero.style.color = fg;
    document.documentElement.style.setProperty("--page-ink", fg);   // footer status matches the title
  }
  const card = document.getElementById("room-" + ROOM);   // home page: tint the room tile
  if (card) { card.style.background = bg; card.style.color = fg; }
  lightHeroBg = bg;                 // remember the light color for the header
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
  readHueStatus(HUE_READ, LIGHTS_GROUP, LIGHTS_MEMBERS)
    .then((results) => {
      const status = summarizeHueStatus(results);
      if (!status.online) throw new Error("Hue offline");
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
    })
    .catch(() => {
      setConn(false);
      lightsOn = null;
      lightsBri = null;
      lightsColor = null;
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

// When the lights go off, reset the controls to defaults: white + 100%.
function resetLightControls() {
  const white = COLORS.find((c) => c.name === "White");
  pendingColor = { body: white.body, css: white.css, name: white.name };
  pendingBri = 254;                                 // 100%
  pendingBriVis = 1;
  dirty = false;
  selectSwatch(document.querySelector('#swatches .swatch[data-name="White"]'));
  selectBri(document.querySelector('#bri-boxes .bri-box[data-pct="100"]'));
  setTrackColor(white.css);
  paintBriBoxes(white.css);
  updateToggle();
}

/* ---------- On/Off toggle: label + action follow current state ---------- */
function updateToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  const pct = pendingBri != null ? Math.round((pendingBri / 254) * 100) : 100;
  const name = pendingColor ? pendingColor.name : "";
  const isOff = pendingBri === 0 || (pendingColor && pendingColor.off);
  const pctEl = document.getElementById("engage-pct");
  if (pctEl) pctEl.textContent = isOff ? "Off" : pct + "%";
  const nameEl = document.getElementById("engage-color");
  if (nameEl) {
    nameEl.textContent = pendingColor ? pendingColor.name : "";
    if (pendingColor) {
      nameEl.style.color = pendingColor.css;   // the word IS the color
      // white outline, but black for the white word so it stays visible
      nameEl.style.setProperty("-webkit-text-stroke-color", pendingColor.name === "White" ? "#000000" : "#ffffff");
    }
  }
  const paddle = btn.querySelector(".engage-paddle");   // the switch paddle carries the color
  btn.style.color = "";
  btn.dataset.state = lightsOn === true ? "on" : lightsOn === false ? "off" : "unknown";
  if (isOff) {                                // black or 0% -> off preview
    if (paddle) paddle.style.background = "#000000";
    btn.style.color = "#b8b8b8";              // light gray, like the off hero
  } else if (pendingColor) {                  // paddle = the color at the chosen brightness's display shade
    const frac = pendingBriVis;
    const rgb = hexToRgb(pendingColor.css);
    const r = Math.round(rgb[0] * frac), g = Math.round(rgb[1] * frac), b = Math.round(rgb[2] * frac);
    if (paddle) paddle.style.background = "rgb(" + r + "," + g + "," + b + ")";
    // text: always white, except black when White is the chosen color
    btn.style.color = pendingColor.name === "White" ? "#000000" : "#ffffff";
  }
  // Wall switch reads "on" only when the room actually matches the staged
  // color + brightness (so the default White/100% shows on only if the room
  // is really white at 100%).
  const pctMatch = lightsBri != null && Math.abs(lightsBri - pct) <= 6;
  const colorMatch = pendingColor && lightsColor && pendingColor.name === lightsColor;
  const engaged = lightsOn === true && colorMatch && pctMatch;
  btn.classList.toggle("engaged", engaged);
  // engaged (the "swipe down for off" state) uses our standard gray + light text
  if (engaged && paddle) {
    paddle.style.background = "var(--surface)";
    btn.style.color = "#f5f5f4";
  }
  updateLightsTab();
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
  if (!el) return;
  const lights = document.getElementById("deck-lights");
  const music = document.getElementById("deck-music");
  if (lights && lights.classList.contains("deck-active")) {          // Lights: brightness
    if (lightsOn === true) el.textContent = lightsBri != null ? lightsBri + "%" : "";
    else if (lightsOn === false) el.textContent = "Off";
    else el.textContent = "";
  } else if (music && music.classList.contains("deck-active")) {     // Music: volume
    el.textContent = sonosMuted ? "Muted" : sonosVol + "%";
  } else {
    el.textContent = "";
  }
}

function bindLightsToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  const doEngage = () => {
    const isOff = pendingBri === 0 || (pendingColor && pendingColor.off);
    if (isOff) {
      // the chosen setting is itself "off" (black or 0%) -> apply off
      runHue({ on: false });                // this room's group, on this room's bridge
      resetLightControls();
      lightsOn = false;
      lightsColor = null; lightsBri = null;   // optimistic: room is now off
      toast(ROOM_LABEL + " lights off.");
    } else {
      // enact the current selection (turn on / update in place); keep selection
      const body = pendingColor && pendingColor.body ? Object.assign({}, pendingColor.body) : { on: true };
      if (pendingBri != null && pendingBri > 0) body.bri = pendingBri;
      applyLights(body);   // colored scene skips the office lamp; white/off include it
      dirty = false;
      lightsOn = true;
      // optimistic: room now matches the staged selection (switch flips on)
      lightsColor = pendingColor ? pendingColor.name : null;
      lightsBri = pendingBri != null ? Math.round((pendingBri / 254) * 100) : 100;
      toast(ROOM_LABEL + " lights engaged.");
    }
    updateToggle();
    window.setTimeout(updateLightsStatus, 500);          // confirm from bridge
  };
  // Swipe down = turn off this room's lights (group incl. the office lamp), like
  // the BEDROOM LIGHTS OFF button. Keeps the staged selection.
  const doOff = () => {
    runHue({ on: false });
    lightsOn = false; lightsColor = null; lightsBri = null;   // optimistic: paddle drops
    toast(ROOM_LABEL + " lights off.");
    updateToggle();
    window.setTimeout(updateLightsStatus, 500);
  };

  // Tap or swipe up = engage; swipe down = off.
  let sx = 0, sy = 0, tracking = false, swiped = false;
  btn.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; tracking = true; swiped = false;
  }, { passive: true });
  btn.addEventListener("touchend", (e) => {
    if (!tracking) return; tracking = false;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(dx)) {   // a clear vertical swipe
      swiped = true;
      if (dy < 0) doEngage(); else doOff();                  // up = on, down = off
    }
  }, { passive: true });
  btn.addEventListener("click", () => {
    if (swiped) { swiped = false; return; }   // the swipe already handled it
    // tap/click toggles: if the switch is up (on) turn off, else engage
    if (btn.classList.contains("engaged")) doOff();
    else doEngage();
  });
}

// Turn off only THIS room's lights (its own Hue group, on its own bridge).
function bindRoomOff() {
  const btn = document.getElementById("room-off");
  if (!btn) return;
  btn.textContent = ROOM_LABEL.toUpperCase() + " LIGHTS OFF";
  btn.addEventListener("click", () => {
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
  btn.textContent = label;
  btn.addEventListener("click", () => {
    runHueProxy({ path: "/groups/0/action", body: { on: false } });
    toast((foh ? "Front" : "Back") + " of house off.");
    window.setTimeout(updateLightsStatus, 500);
  });
}
// Turn off EVERY light in the house (both Hue hubs), from any room page.
function bindHouseOffAll() {
  const btn = document.getElementById("house-off-all");
  if (!btn) return;
  btn.textContent = "WHOLE HOUSE OFF";
  btn.addEventListener("click", () => {
    HUE_ALL_BRIDGES.forEach((bridge) => {
      fetch(piUrl("/hue"), { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridge: bridge, path: "/groups/0/action", body: { on: false } }),
        keepalive: true }).catch(() => {});
    });
    toast("All House lights off.");
    window.setTimeout(updateLightsStatus, 500);
  });
}

// Gray out an OFF button when its action would do nothing (all target lights
// are already off). Native `disabled` also blocks the click.
function setOffDisabled(btn, disabled) {
  if (!btn) return;
  btn.disabled = !!disabled;
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
// Brightness shown as 7 stacked boxes, top -> bottom.
const BRI_PRESETS = [100, 90, 75, 50, 25, 10, 1];
// Display-only shade per box: spread evenly from full (top row) down to
// BRI_VIS_MIN (bottom row) so all 7 look distinct even though the real light
// values bunch up at the low end. Labels + actual light settings are unaffected.
const BRI_VIS_MIN = 0.22;
// Per-preset display-shade overrides (by label %). Tweak these freely; they only
// change how a box/Engage looks, never the label or the light value.
const BRI_VIS_OVERRIDE = { 1: 0.25 };
function briVis(i, n, p) {
  if (BRI_VIS_OVERRIDE[p] != null) return BRI_VIS_OVERRIDE[p];
  return n <= 1 ? 1 : 1 - (i / (n - 1)) * (1 - BRI_VIS_MIN);
}

function selectBri(el) {
  if (selectedBriEl) selectedBriEl.classList.remove("sel");
  selectedBriEl = el;
  if (el) el.classList.add("sel");
}

// Tap or slide a finger across a column of pickable boxes (each carries __pick).
function bindStripPick(container, itemSel) {
  if (!container) return;
  let picking = false, dragged = false, lastEl = null;
  const itemAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest(itemSel) : null;
  };
  container.addEventListener("pointerdown", (e) => {
    picking = true; dragged = false; lastEl = null;
    if (container.setPointerCapture) container.setPointerCapture(e.pointerId);
    const it = itemAt(e.clientX, e.clientY);
    if (it && it.__pick) { it.__pick(false); lastEl = it; }
    e.preventDefault();
  });
  container.addEventListener("pointermove", (e) => {
    if (!picking) return;
    const it = itemAt(e.clientX, e.clientY);
    if (it && it.__pick && it !== lastEl) { dragged = true; it.__pick(false); lastEl = it; }
  });
  const end = () => {
    if (!picking) return;
    picking = false;
    if (dragged && lastEl && lastEl.__pick) lastEl.__pick(true);   // announce final pick
  };
  container.addEventListener("pointerup", end);
  container.addEventListener("pointercancel", end);
  container.addEventListener("click", (e) => {                     // tap / keyboard
    const it = e.target.closest ? e.target.closest(itemSel) : null;
    if (dragged) { dragged = false; return; }
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
    box.style.color = text;
  });
}

function bindLightTools() {
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
        if (announce) toast(c.name + " ready — press Engage.");
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
      box.textContent = p + "%";
      box.setAttribute("aria-label", p + "% brightness");
      box.__pick = (announce) => {
        if (selectedBriEl === box && !announce) return;
        selectBri(box);
        pendingBri = Math.round((p / 100) * 254);
        pendingBriVis = vis;
        dirty = true;
        updateToggle();
        if (announce) toast(p + "% ready — press Engage.");
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
  resetLightControls();     // default selection: white + 100%
  bindVolume();
  bindVolBoxes();
  renderMusic();
  renderShare();
  bindTv();
  bindPlayPause();
  bindSkip();
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
