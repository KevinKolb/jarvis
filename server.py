#!/usr/bin/env python3
"""
JARVIS — Raspberry Pi web server + Hue relay.

Serves this folder as a website AND relays light commands to the Hue
bridge. The browser POSTs to /hue on the Pi; the Pi forwards a PUT to the
bridge. This is needed because browsers block a web page from sending the
PUT/CORS request the Hue bridge requires — but the Pi can do it freely.

The bridge IP + token live HERE (on the Pi), not in the public web code.
"""

import html
import json
import os
import re
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# ---- Your Hue bridge (edit these if they ever change) -------------------
BRIDGE_IP = "192.168.86.151"
HUE_USER  = "qu7RZKY7O0HUL6vkpSnOpOXqRNKre0JzcSTf5v9a"
PORT      = 80
# ---- Sonos: the UI says "Kitchen", but the REAL coordinator is the LOUNGE
#      speaker. Lounge plays; the kitchen pair is secretly grouped to it. ---
SONOS_IP   = "192.168.86.48"                # LOUNGE — real coordinator/source
SONOS_UUID = "RINCON_F0F6C1CF5CCA01400"     # lounge coordinator UUID
KITCHEN_IP = "192.168.86.41"                # kitchen pair — secretly grouped to lounge
SONOS_SN    = "9"                           # Apple Music account serial on this system
SONOS_CDUDN = "SA_RINCON52231_X_#Svc52231-0-Token"   # Apple Music service token
SONOS_ROOMS = [                            # other rooms you can share kitchen audio to
    ("Living Room", "192.168.86.34"),
    ("Bedroom",     "192.168.86.156"),
    ("Bathroom",    "192.168.86.159"),
    ("Office",      "192.168.86.43"),
    ("Lounge",      "192.168.86.48"),
    ("Entryway",    "192.168.86.38"),
]
# ------------------------------------------------------------------------

# Music buttons live in music.json (editable via /admin). Seeded from this
# default the first time the server runs.
MUSIC_FILE = "music.json"
DEFAULT_MUSIC = {
    "radio": [
        {"label": "John Mayer", "fav": "CH 14 - Life with John Mayer"},
        {"label": "WWOZ", "fav": "WWOZ"},
        {"label": "Yacht Rock", "fav": "CH 17 - Yacht Rock Radio"},
        {"label": "The Bridge", "fav": "CH 27 - The Bridge"},
        {"label": "Chill", "fav": "CH 55 - SiriusXM Chill"},
        {"label": "Classic Vinyl", "fav": "CH 26 - Classic Vinyl"},
        {"label": "Beatles", "fav": "CH 18 - The Beatles Channel"},
    ],
    "artists": [],
    "jukebox": [
        {"label": "Foot of Canal St", "fav": "Foot of Canal Street"},
        {"label": "Sledgehammer", "apple": {"kind": "song", "id": "987872731", "title": "Sledgehammer"}},
    ],
    "albums": [
        {"label": "Rubber Soul", "apple": {"kind": "album", "id": "1441164359", "title": "Rubber Soul"}},
        {"label": "Southern Nights", "fav": "Southern Nights"},
        {"label": "Vivid", "fav": "Vivid"},
    ],
    "playlists": [
        {"label": "Morning Alarm", "shuffle": True, "apple": {"kind": "libraryplaylist", "id": "p.b16GR55TARxgG", "title": "Morning Alarm"}},
        {"label": "Juicy Playlist", "shuffle": True, "fav": "A Juicy Playlist"},
        {"label": "Happy Rock", "shuffle": True, "fav": "Happy Rock"},
        {"label": "Simple", "shuffle": True, "fav": "Simple"},
    ],
    "podcasts": [
        {"label": "Learn French", "fav": "Learn French"},
    ],
}

def load_music():
    try:
        with open(MUSIC_FILE) as f:
            return json.load(f)
    except Exception:
        save_music(DEFAULT_MUSIC)
        return dict(DEFAULT_MUSIC)

def save_music(cfg):
    with open(MUSIC_FILE, "w") as f:
        json.dump(cfg, f, indent=2)
# ------------------------------------------------------------------------


class Handler(SimpleHTTPRequestHandler):
    # Serve files quietly; only note errors.
    def log_message(self, *args):
        pass

    # Never let browsers cache the app, so phones always get the latest code.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def _bridge(self, method, bridge_path, body=None):
        """Forward a request to the Hue bridge and return its raw bytes."""
        url = "http://{}/api/{}{}".format(BRIDGE_IP, HUE_USER, bridge_path)
        req = urllib.request.Request(
            url, data=body, method=method,
            headers={"Content-Type": "application/json"} if body else {},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.read()

    def _sonos(self, service, action, inner):
        """Send a SOAP action to the kitchen Sonos and return the XML text."""
        env = ('<?xml version="1.0"?>'
               '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
               's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
               '<s:Body>%s</s:Body></s:Envelope>') % inner
        url = "http://%s:1400/MediaRenderer/%s/Control" % (SONOS_IP, service)
        req = urllib.request.Request(
            url, data=env.encode(),
            headers={"Content-Type": 'text/xml; charset="utf-8"',
                     "SOAPAction": '"urn:schemas-upnp-org:service:%s:1#%s"' % (service, action)})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.read().decode("utf-8", "ignore")

    def _sonos_ct(self, action, inner):
        """ContentDirectory SOAP (MediaServer) — for browsing favorites."""
        env = ('<?xml version="1.0"?>'
               '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
               's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
               '<s:Body>%s</s:Body></s:Envelope>') % inner
        req = urllib.request.Request(
            "http://%s:1400/MediaServer/ContentDirectory/Control" % SONOS_IP, data=env.encode(),
            headers={"Content-Type": 'text/xml; charset="utf-8"',
                     "SOAPAction": '"urn:schemas-upnp-org:service:ContentDirectory:1#%s"' % action})
        with urllib.request.urlopen(req, timeout=6) as resp:
            return resp.read().decode("utf-8", "ignore")

    def _find_favorite(self, name):
        xml = self._sonos_ct("Browse",
            '<u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">'
            '<ObjectID>FV:2</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag>'
            '<Filter>*</Filter><StartingIndex>0</StartingIndex>'
            '<RequestedCount>300</RequestedCount><SortCriteria></SortCriteria></u:Browse>')
        m = re.search(r"<Result>(.*?)</Result>", xml, re.S)
        didl = html.unescape(m.group(1)) if m else ""
        for item in re.findall(r"<item.*?</item>", didl, re.S):
            t = re.search(r"<dc:title>(.*?)</dc:title>", item, re.S)
            if t and html.unescape(t.group(1)).strip() == name:
                res = html.unescape(re.search(r"<res[^>]*>(.*?)</res>", item, re.S).group(1))
                md = re.search(r"<r:resMD>(.*?)</r:resMD>", item, re.S)
                return res, (html.unescape(md.group(1)) if md else "")
        return None, None

    def _play_favorite(self, name, shuffle=False):
        self._ensure_kitchen_grouped()
        res, meta = self._find_favorite(name)
        if not res:
            raise Exception("favorite not found: %s" % name)
        esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if res.startswith("x-rincon-cpcontainer"):        # playlist / album -> queue
            self._sonos("AVTransport", "RemoveAllTracksFromQueue",
                '<u:RemoveAllTracksFromQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:RemoveAllTracksFromQueue>')
            self._sonos("AVTransport", "AddURIToQueue",
                '<u:AddURIToQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                '<EnqueuedURI>%s</EnqueuedURI><EnqueuedURIMetaData>%s</EnqueuedURIMetaData>'
                '<DesiredFirstTrackNumberEnqueued>0</DesiredFirstTrackNumberEnqueued><EnqueueAsNext>0</EnqueueAsNext></u:AddURIToQueue>'
                % (esc(res), esc(meta)))
            self._sonos("AVTransport", "SetAVTransportURI",
                '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                '<CurrentURI>x-rincon-queue:%s#0</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % SONOS_UUID)
        else:                                              # radio stream -> direct
            self._sonos("AVTransport", "SetAVTransportURI",
                '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                '<CurrentURI>%s</CurrentURI><CurrentURIMetaData>%s</CurrentURIMetaData></u:SetAVTransportURI>'
                % (esc(res), esc(meta)))
        if res.startswith("x-rincon-cpcontainer"):
            self._set_play_mode(shuffle)
        self._sonos("AVTransport", "Play",
            '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>')

    def _set_play_mode(self, shuffle):
        self._sonos("AVTransport", "SetPlayMode",
            '<u:SetPlayMode xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
            '<NewPlayMode>%s</NewPlayMode></u:SetPlayMode>' % ("SHUFFLE" if shuffle else "NORMAL"))

    def _play_apple(self, kind, cid, title, shuffle=False):
        """Play an Apple Music album/song/playlist by its id (no favorite needed)."""
        self._ensure_kitchen_grouped()
        esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        title = title or "Apple Music"
        if kind == "album":
            res = "x-rincon-cpcontainer:1004206calbum%%3a%s?sid=204&flags=8300&sn=%s" % (cid, SONOS_SN)
            item_id, cls = "1004206calbum%%3a%s" % cid, "object.container.album.musicAlbum.#AlbumView"
        elif kind == "libraryplaylist":
            res = "x-rincon-cpcontainer:1006206clibraryplaylist%%3a%s?sid=204&flags=8300&sn=%s" % (cid, SONOS_SN)
            item_id, cls = "1006206clibraryplaylist%%3a%s" % cid, "object.container.playlistContainer"
        elif kind == "playlist":
            res = "x-rincon-cpcontainer:1006206cplaylist%%3a%s?sid=204&flags=8300&sn=%s" % (cid, SONOS_SN)
            item_id, cls = "1006206cplaylist%%3a%s" % cid, "object.container.playlistContainer"
        else:  # song
            res = "x-sonos-http:song%%3a%s.mp4?sid=204&flags=8224&sn=%s" % (cid, SONOS_SN)
            item_id, cls = "10032020song%%3a%s" % cid, "object.item.audioItem.musicTrack"
        meta = ('<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
                'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
                'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
                'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
                '<item id="%s" parentID="0" restricted="true"><dc:title>%s</dc:title>'
                '<upnp:class>%s</upnp:class>'
                '<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">%s</desc>'
                '</item></DIDL-Lite>') % (item_id, esc(title), cls, SONOS_CDUDN)
        self._sonos("AVTransport", "RemoveAllTracksFromQueue",
            '<u:RemoveAllTracksFromQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:RemoveAllTracksFromQueue>')
        self._sonos("AVTransport", "AddURIToQueue",
            '<u:AddURIToQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
            '<EnqueuedURI>%s</EnqueuedURI><EnqueuedURIMetaData>%s</EnqueuedURIMetaData>'
            '<DesiredFirstTrackNumberEnqueued>0</DesiredFirstTrackNumberEnqueued><EnqueueAsNext>0</EnqueueAsNext></u:AddURIToQueue>'
            % (esc(res), esc(meta)))
        self._sonos("AVTransport", "SetAVTransportURI",
            '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
            '<CurrentURI>x-rincon-queue:%s#0</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % SONOS_UUID)
        self._set_play_mode(shuffle)
        self._sonos("AVTransport", "Play",
            '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>')

    def _zone_groups(self):
        """Return [(coordinator_uuid, [member_ips])] from the Sonos topology."""
        env = ('<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
               's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>'
               '<u:GetZoneGroupState xmlns:u="urn:schemas-upnp-org:service:ZoneGroupTopology:1"></u:GetZoneGroupState>'
               '</s:Body></s:Envelope>')
        req = urllib.request.Request("http://%s:1400/ZoneGroupTopology/Control" % SONOS_IP, data=env.encode(),
            headers={"Content-Type": 'text/xml; charset="utf-8"',
                     "SOAPAction": '"urn:schemas-upnp-org:service:ZoneGroupTopology:1#GetZoneGroupState"'})
        xml = urllib.request.urlopen(req, timeout=6).read().decode("utf-8", "ignore")
        m = re.search(r"<ZoneGroupState>(.*?)</ZoneGroupState>", xml, re.S)
        state = html.unescape(m.group(1)) if m else ""
        out = []
        for coord, body in re.findall(r'<ZoneGroup[^>]*Coordinator="([^"]+)"[^>]*>(.*?)</ZoneGroup>', state, re.S):
            ips = re.findall(r'<ZoneGroupMember[^>]*Location="http://([\d.]+):1400', body)
            out.append((coord, ips))
        return out

    def _avt_ip(self, ip, action, inner):
        """AVTransport SOAP to a specific speaker IP (used for grouping)."""
        env = ('<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
               's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>%s</s:Body></s:Envelope>') % inner
        req = urllib.request.Request("http://%s:1400/MediaRenderer/AVTransport/Control" % ip, data=env.encode(),
            headers={"Content-Type": 'text/xml; charset="utf-8"',
                     "SOAPAction": '"urn:schemas-upnp-org:service:AVTransport:1#%s"' % action})
        with urllib.request.urlopen(req, timeout=6) as r:
            return r.read()

    def _rc_ip(self, ip, action, inner):
        """RenderingControl SOAP to a specific speaker IP (per-speaker volume)."""
        env = ('<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
               's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>%s</s:Body></s:Envelope>') % inner
        req = urllib.request.Request("http://%s:1400/MediaRenderer/RenderingControl/Control" % ip, data=env.encode(),
            headers={"Content-Type": 'text/xml; charset="utf-8"',
                     "SOAPAction": '"urn:schemas-upnp-org:service:RenderingControl:1#%s"' % action})
        with urllib.request.urlopen(req, timeout=6) as r:
            return r.read()

    def _kitchen_volume(self):
        xml = self._sonos("GroupRenderingControl", "GetGroupVolume",
            '<u:GetGroupVolume xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1"><InstanceID>0</InstanceID></u:GetGroupVolume>')
        m = re.search(r"<CurrentVolume>(\d+)</CurrentVolume>", xml)
        return int(m.group(1)) if m else 30

    def _ensure_kitchen_grouped(self):
        """The illusion: silently join the kitchen pair to the lounge coordinator,
        so 'Kitchen' plays whatever the (hidden) lounge speaker is playing."""
        try:
            self._avt_ip(KITCHEN_IP, "SetAVTransportURI",
                '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                '<CurrentURI>x-rincon:%s</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % SONOS_UUID)
        except Exception:
            pass

    def _lounge_muted(self):
        """True if the lounge speaker is muted (used as the Lounge button's off-state)."""
        try:
            xml = self._rc_ip(SONOS_IP, "GetMute",
                '<u:GetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID>'
                '<Channel>Master</Channel></u:GetMute>').decode("utf-8", "ignore")
            m = re.search(r"<CurrentMute>(\d+)</CurrentMute>", xml)
            return bool(m and m.group(1) == "1")
        except Exception:
            return False

    def _json(self, obj, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode())

    def do_GET(self):
        # Read Sonos volume:  GET /sonos/volume
        if self.path == "/sonos/volume":
            try:
                xml = self._sonos("GroupRenderingControl", "GetGroupVolume",
                    '<u:GetGroupVolume xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1">'
                    '<InstanceID>0</InstanceID></u:GetGroupVolume>')
                m = re.search(r"<CurrentVolume>(\d+)</CurrentVolume>", xml)
                self._json({"volume": int(m.group(1)) if m else 0})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        if self.path == "/sonos/mute":
            try:
                xml = self._sonos("GroupRenderingControl", "GetGroupMute",
                    '<u:GetGroupMute xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1">'
                    '<InstanceID>0</InstanceID></u:GetGroupMute>')
                m = re.search(r"<CurrentMute>(\d+)</CurrentMute>", xml)
                self._json({"mute": bool(int(m.group(1))) if m else False})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Combined state: volume, mute, and what's playing (as specific as possible)
        if self.path == "/sonos/state":
            try:
                vx = self._sonos("GroupRenderingControl", "GetGroupVolume",
                    '<u:GetGroupVolume xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1"><InstanceID>0</InstanceID></u:GetGroupVolume>')
                mx = self._sonos("GroupRenderingControl", "GetGroupMute",
                    '<u:GetGroupMute xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1"><InstanceID>0</InstanceID></u:GetGroupMute>')
                tx = self._sonos("AVTransport", "GetTransportInfo",
                    '<u:GetTransportInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:GetTransportInfo>')
                px = self._sonos("AVTransport", "GetPositionInfo",
                    '<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:GetPositionInfo>')

                def first(pat, s):
                    m = re.search(pat, s, re.S)
                    return m.group(1) if m else ""
                vol = int(first(r"<CurrentVolume>(\d+)</CurrentVolume>", vx) or 0)
                mute = bool(int(first(r"<CurrentMute>(\d+)</CurrentMute>", mx) or 0))
                state = first(r"<CurrentTransportState>(\w+)</CurrentTransportState>", tx)
                playing = state == "PLAYING"

                mi = self._sonos("AVTransport", "GetMediaInfo",
                    '<u:GetMediaInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:GetMediaInfo>')
                src = html.unescape(first(r"<CurrentURIMetaData>(.*?)</CurrentURIMetaData>", mi))
                station = html.unescape(first(r"<dc:title[^>]*>(.*?)</dc:title>", src)).strip()

                didl = html.unescape(first(r"<TrackMetaData>(.*?)</TrackMetaData>", px))
                def tag(t):
                    return html.unescape(first(r"<%s[^>]*>(.*?)</%s>" % (t, t), didl)).strip()
                def junk(s):
                    s = (s or "").lower()
                    return (not s) or any(x in s for x in ("http", ".mp3", "aw_0", "playerid", "listeningsession", "?", "="))
                stream = tag("r:streamContent")
                title, creator = tag("dc:title"), tag("dc:creator")
                if not junk(stream):
                    track = stream
                elif title and not junk(title):
                    track = (creator + " — " + title) if creator and not junk(creator) else title
                else:
                    track = station
                if not track:
                    track = station
                art = tag("upnp:albumArtURI")
                if art.startswith("/"):
                    art = "http://%s:1400%s" % (SONOS_IP, art)
                self._json({"volume": vol, "mute": mute, "playing": playing, "track": track, "art": art})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Rooms + whether each is currently grouped to the (hidden) lounge coordinator.
        # Lounge itself is always the coordinator, so its button tracks mute instead.
        if self.path == "/sonos/rooms":
            try:
                group_ips = set()
                for coord, ips in self._zone_groups():
                    if coord == SONOS_UUID:
                        group_ips = set(ips)
                lounge_on = not self._lounge_muted()
                rooms = [{"name": n, "grouped": (lounge_on if n == "Lounge" else ip in group_ips)}
                         for (n, ip) in SONOS_ROOMS]
                self._json({"rooms": rooms})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Music buttons config (for the kitchen page + admin)
        if self.path == "/music":
            self._json(load_music())
            return
        # Read light state:  GET /hue/groups/82  ->  bridge /groups/82
        if self.path.startswith("/hue/"):
            try:
                result = self._bridge("GET", self.path[4:])
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(result)
            except Exception as exc:
                self.send_response(502)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(("Hue relay error: %s" % exc).encode())
            return
        # Otherwise serve website files normally.
        return super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"

        # Set Sonos group volume:  POST /sonos/volume  {"level": 0-100}
        if self.path == "/sonos/volume":
            try:
                level = max(0, min(100, int(json.loads(raw or b"{}").get("level", 0))))
                # Set EVERY speaker in the kitchen group to exactly this level
                # (absolute, not relative) so it never drifts/pops back.
                ips = [SONOS_IP]
                for coord, member_ips in self._zone_groups():
                    if coord == SONOS_UUID and member_ips:
                        ips = member_ips
                        break
                for ip in ips:
                    try:
                        self._rc_ip(ip, "SetVolume",
                            '<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID>'
                            '<Channel>Master</Channel><DesiredVolume>%d</DesiredVolume></u:SetVolume>' % level)
                    except Exception:
                        pass
                self._json({"ok": True, "volume": level})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Mute / unmute:  POST /sonos/mute  {"mute": true|false}
        if self.path == "/sonos/mute":
            try:
                mute = 1 if json.loads(raw or b"{}").get("mute") else 0
                self._sonos("GroupRenderingControl", "SetGroupMute",
                    '<u:SetGroupMute xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1">'
                    '<InstanceID>0</InstanceID><DesiredMute>%d</DesiredMute></u:SetGroupMute>' % mute)
                self._json({"ok": True, "mute": bool(mute)})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Group / ungroup a room to the kitchen:  POST /sonos/group  {"room","join"}
        if self.path == "/sonos/group":
            try:
                p = json.loads(raw or b"{}")
                room, join = p.get("room"), bool(p.get("join"))
                ip = dict(SONOS_ROOMS).get(room)
                if not ip:
                    raise Exception("unknown room: %s" % room)
                if room == "Lounge":
                    # Lounge is the hidden coordinator — never ungroup it (that would
                    # dissolve everyone's group). Toggling it just mutes/unmutes lounge.
                    self._rc_ip(ip, "SetMute",
                        '<u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID>'
                        '<Channel>Master</Channel><DesiredMute>%d</DesiredMute></u:SetMute>' % (0 if join else 1))
                elif join:
                    # speakers currently in this room (before it joins the kitchen)
                    room_ips = [ip]
                    for coord, ips in self._zone_groups():
                        if ip in ips:
                            room_ips = ips
                            break
                    self._avt_ip(ip, "SetAVTransportURI",
                        '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                        '<CurrentURI>x-rincon:%s</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % SONOS_UUID)
                    # pop the added room to the kitchen volume (then group volume keeps them together)
                    kvol = self._kitchen_volume()
                    for rip in room_ips:
                        try:
                            self._rc_ip(rip, "SetVolume",
                                '<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID>'
                                '<Channel>Master</Channel><DesiredVolume>%d</DesiredVolume></u:SetVolume>' % kvol)
                        except Exception:
                            pass
                else:
                    self._avt_ip(ip, "BecomeCoordinatorOfStandaloneGroup",
                        '<u:BecomeCoordinatorOfStandaloneGroup xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:BecomeCoordinatorOfStandaloneGroup>')
                self._json({"ok": True, "room": room, "grouped": join})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Play a Sonos favorite by name:  POST /sonos/favorite  {"name": "..."}
        if self.path == "/sonos/favorite":
            try:
                p = json.loads(raw or b"{}")
                name = p.get("name", "")
                self._play_favorite(name, bool(p.get("shuffle")))
                self._json({"ok": True, "name": name})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Play Apple Music by id:  POST /sonos/apple  {"kind","id","title"}
        if self.path == "/sonos/apple":
            try:
                p = json.loads(raw or b"{}")
                self._play_apple(p.get("kind", "song"), str(p.get("id", "")), p.get("title", ""), bool(p.get("shuffle")))
                self._json({"ok": True})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Admin: add a music button:  POST /music/add  {"section","item"}
        if self.path == "/music/add":
            try:
                p = json.loads(raw or b"{}")
                cfg = load_music()
                cfg.setdefault(p.get("section"), []).append(p.get("item"))
                save_music(cfg)
                self._json({"ok": True})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Admin: remove a music button:  POST /music/remove  {"section","index"}
        if self.path == "/music/remove":
            try:
                p = json.loads(raw or b"{}")
                section, idx = p.get("section"), int(p.get("index", -1))
                cfg = load_music()
                if section in cfg and 0 <= idx < len(cfg[section]):
                    cfg[section].pop(idx)
                    save_music(cfg)
                self._json({"ok": True})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        if self.path.rstrip("/") != "/hue":
            self.send_error(404)
            return
        try:
            payload = json.loads(raw or b"{}")
            path = payload.get("path", "")            # e.g. /groups/82/action
            body = json.dumps(payload.get("body", {})).encode()
            result = self._bridge("PUT", path, body)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(result)
        except Exception as exc:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(("Hue relay error: %s" % exc).encode())


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print("JARVIS serving on port %d, relaying Hue -> %s" % (PORT, BRIDGE_IP))
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
