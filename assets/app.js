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
let lightsOn = null;         // true / false / null (unknown)

function updateLightsStatus() {
  const el = document.getElementById("lights-status");
  fetch("/hue/groups/" + LIGHTS_GROUP, { cache: "no-store" })
    .then((r) => r.json())
    .then((g) => {
      const state = (g && g.state) || {};
      const on = !!state.any_on;
      const bri = g && g.action ? g.action.bri : null;
      lightsOn = on;
      if (el) {
        el.dataset.state = on ? "on" : "off";
        const txt = el.querySelector(".txt");
        if (!on) {
          txt.textContent = "Lights are OFF";
        } else {
          let label = state.all_on ? "Lights are ON" : "Some lights ON";
          if (typeof bri === "number") label += " · " + Math.round((bri / 254) * 100) + "%";
          txt.textContent = label;
        }
      }
      updateToggle();
    })
    .catch(() => {
      lightsOn = null;
      if (el) {
        el.dataset.state = "unknown";
        el.querySelector(".txt").textContent = "Light status unavailable";
      }
      updateToggle();
    });
}

/* ---------- On/Off toggle: label + action follow current state ---------- */
function updateToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  const txt = btn.querySelector(".toggle-txt");
  btn.dataset.state = lightsOn === null ? "unknown" : lightsOn ? "on" : "off";
  txt.textContent = lightsOn === null ? "Toggle Lights" : lightsOn ? "Turn Off" : "Turn On";
}

function bindLightsToggle() {
  const btn = document.getElementById("lights-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const turningOn = !lightsOn;                         // null -> turn ON
    runAction(turningOn ? "Kitchen Lights On" : "Kitchen Lights Off");
    toast(turningOn ? "The kitchen lights are on." : "The kitchen lights are off.");
    lightsOn = turningOn;                                // optimistic
    updateToggle();
    window.setTimeout(updateLightsStatus, 500);          // confirm from bridge
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
  updateLightsStatus();
});
