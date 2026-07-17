# jarvis

A phone-first home control site styled as **Jarvis**, a residence butler. Scan a room's QR code, tap a control, and Jarvis fires the matching iOS Shortcut — so music playback lives on Alexa/HomePod and keeps going after the phone walks away.

## Pages

- `index.html` — home page: **room selection only** (Kitchen is live; other rooms are marked "Soon").
- `kitchen/index.html` — the butler menu for the kitchen: greeting, Lights, SiriusXM channels, Podcasts, and a live Now Playing bar. A QR code to this page sits at the bottom.
- `assets/styles.css` — the shared look (warm hospitality theme, light + dark).
- `assets/app.js` — all wiring. Edit the `CONFIG` block to match your own Shortcuts and channels.
- `assets/kitchen-qr.svg` — QR code encoding the Pi-hosted kitchen page.

## How the controls work

Every control runs an iOS Shortcut via `shortcuts://run-shortcut?name=<Shortcut Name>`. Create Shortcuts with these names (or rename them in `CONFIG` / the `data-shortcut` attributes):

- Lights: `Kitchen-Lights-On`, `Kitchen-Lights-Off`, `Kitchen-Scene-Cooking`, `Kitchen-Scene-Dinner`
- Volume / stop: `Kitchen-Volume-Up`, `Kitchen-Volume-Down`, `Kitchen-Stop`
- SiriusXM / podcasts: see the `CONFIG.channels` and `CONFIG.podcasts` arrays in `assets/app.js`

Each Shortcut should tell Alexa (or your speaker platform) to run the action, keeping audio off the phone.

## Hosting

Run from the Raspberry Pi at **http://192.168.86.147/** with the kitchen at **http://192.168.86.147/kitchen/**. Room pages redirect back to that Pi origin when opened from another host, and all hardware calls are built against the Pi URL.
