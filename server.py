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
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# ---- Hue bridges (this house has two).  Each room's page says which one. --
BRIDGES = {
    "main":    {"ip": "192.168.86.151", "user": "qu7RZKY7O0HUL6vkpSnOpOXqRNKre0JzcSTf5v9a"},
    "bedroom": {"ip": "192.168.86.152", "user": "IzOBRHVpdUoI0O2zatQC6kiDrqaLnaL2Hl7CSPKg"},
}
BRIDGE_IP = BRIDGES["main"]["ip"]           # for the startup banner
HUE_USER  = BRIDGES["main"]["user"]
PORT      = 80
# ---- Sonos.  The kitchen is an illusion: the UI says "Kitchen" but the REAL
#      coordinator is the LOUNGE speaker, and the kitchen pair secretly joins
#      it.  Other rooms (e.g. bedroom) are their own coordinator, no illusion.
SONOS_IP   = "192.168.86.48"                # LOUNGE — kitchen's real coordinator
SONOS_UUID = "RINCON_F0F6C1CF5CCA01400"     # lounge coordinator UUID
KITCHEN_IP = "192.168.86.41"                # kitchen pair — secretly grouped to lounge
SONOS_SN    = "9"                           # Apple Music account serial on this system
SONOS_CDUDN = "SA_RINCON52231_X_#Svc52231-0-Token"   # Apple Music service token
# Per-room Sonos target: coordinator ip/uuid, and a speaker that secretly
# joins it ("join", kitchen only).  A page picks its target with ?room=/…"room".
SONOS_TARGETS = {
    "house":   {"ip": SONOS_IP,       "uuid": SONOS_UUID,                 "join": None},  # whole-house: music from the lounge
    "kitchen": {"ip": SONOS_IP,       "uuid": SONOS_UUID,                 "join": KITCHEN_IP},
    "bedroom": {"ip": "192.168.86.156", "uuid": "RINCON_48A6B84B8E5401400", "join": "192.168.86.43"},  # Office joins bedroom by default
    "bathroom": {"ip": "192.168.86.159", "uuid": "RINCON_542A1BFC18E601400", "join": None},  # stereo pair (.159 primary, .63 satellite)
}
# Rooms each page can share its audio to (grouped to that page's coordinator).
ALL_ROOMS = {
    "Kitchen":     "192.168.86.41",
    "Lounge":      "192.168.86.48",
    "Living Room": "192.168.86.34",
    "Bedroom":     "192.168.86.156",
    "Office":      "192.168.86.43",
    "Bathroom":    "192.168.86.159",
    "Entryway":    "192.168.86.38",
}
SHARE_ROOMS = {
    # House page: lounge is the coordinator (music source), so it's left out.
    "house": [("Kitchen", ALL_ROOMS["Kitchen"]), ("Living Room", ALL_ROOMS["Living Room"]),
              ("Bedroom", ALL_ROOMS["Bedroom"]), ("Office", ALL_ROOMS["Office"]),
              ("Bathroom", ALL_ROOMS["Bathroom"]), ("Entryway", ALL_ROOMS["Entryway"])],
    "kitchen": [("Lounge", ALL_ROOMS["Lounge"]), ("Living Room", ALL_ROOMS["Living Room"]),
                ("Bedroom", ALL_ROOMS["Bedroom"]), ("Office", ALL_ROOMS["Office"]),
                ("Bathroom", ALL_ROOMS["Bathroom"]), ("Entryway", ALL_ROOMS["Entryway"])],
    # Office is left out on purpose: it's the bedroom's permanent companion (auto-
    # joined on every play), not a toggle. Bedroom is always its coordinator/host.
    "bedroom": [("Kitchen", ALL_ROOMS["Kitchen"]), ("Lounge", ALL_ROOMS["Lounge"]),
                ("Living Room", ALL_ROOMS["Living Room"]),
                ("Bathroom", ALL_ROOMS["Bathroom"]), ("Entryway", ALL_ROOMS["Entryway"])],
    "bathroom": [("Bedroom", ALL_ROOMS["Bedroom"])],
}
SONOS_ROOMS = SHARE_ROOMS["kitchen"]        # back-compat alias
# Share buttons that pull a companion speaker along, so the two move as a unit.
# The Bedroom button carries Office (office is linked to the bedroom); grouping
# Bedroom into another room brings Office too, and ungrouping sends Office back
# to the bedroom's own coordinator.
SHARE_COMPANIONS = {
    "Bedroom": {"ips": [ALL_ROOMS["Office"]], "coord": SONOS_TARGETS["bedroom"]["uuid"]},
}
# Live playback context that Sonos' metadata doesn't carry (e.g. which
# playlist is playing — the queue only exposes the current track).
STATE = {"playlist": "", "category": ""}   # category = which music row is playing (for next/back)
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
    # Default Sonos target (kitchen) — overridden per request by _set_target.
    s_room = "kitchen"
    s_ip = SONOS_IP
    s_uuid = SONOS_UUID
    s_join = KITCHEN_IP

    def _set_target(self, room):
        """Point this request at a room's Sonos coordinator (defaults to kitchen)."""
        t = SONOS_TARGETS.get(room)
        self.s_room = room if t else "kitchen"
        t = t or SONOS_TARGETS["kitchen"]
        self.s_ip, self.s_uuid, self.s_join = t["ip"], t["uuid"], t["join"]

    # Serve files quietly; only note errors.
    def log_message(self, *args):
        pass

    # Never let browsers cache the app, so phones always get the latest code.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def _bridge(self, method, bridge_path, body=None, bridge="main"):
        """Forward a request to the named Hue bridge and return its raw bytes."""
        b = BRIDGES.get(bridge, BRIDGES["main"])
        url = "http://{}/api/{}{}".format(b["ip"], b["user"], bridge_path)
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
        url = "http://%s:1400/MediaRenderer/%s/Control" % (self.s_ip, service)
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
            "http://%s:1400/MediaServer/ContentDirectory/Control" % self.s_ip, data=env.encode(),
            headers={"Content-Type": 'text/xml; charset="utf-8"',
                     "SOAPAction": '"urn:schemas-upnp-org:service:ContentDirectory:1#%s"' % action})
        with urllib.request.urlopen(req, timeout=6) as resp:
            return resp.read().decode("utf-8", "ignore")

    def _favorites_map(self):
        """Browse Sonos favorites (FV:2) once -> {title: (uri, resMD)}."""
        xml = self._sonos_ct("Browse",
            '<u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">'
            '<ObjectID>FV:2</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag>'
            '<Filter>*</Filter><StartingIndex>0</StartingIndex>'
            '<RequestedCount>300</RequestedCount><SortCriteria></SortCriteria></u:Browse>')
        m = re.search(r"<Result>(.*?)</Result>", xml, re.S)
        didl = html.unescape(m.group(1)) if m else ""
        out = {}
        for item in re.findall(r"<item.*?</item>", didl, re.S):
            t = re.search(r"<dc:title>(.*?)</dc:title>", item, re.S)
            r = re.search(r"<res[^>]*>(.*?)</res>", item, re.S)
            if not (t and r):
                continue
            md = re.search(r"<r:resMD>(.*?)</r:resMD>", item, re.S)
            out[html.unescape(t.group(1)).strip()] = (
                html.unescape(r.group(1)), html.unescape(md.group(1)) if md else "")
        return out

    def _find_favorite(self, name):
        return self._favorites_map().get(name, (None, None))

    def _play_favorite(self, name, shuffle=False):
        self._ensure_kitchen_grouped()
        STATE["playlist"] = ""
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
                '<CurrentURI>x-rincon-queue:%s#0</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % self.s_uuid)
        else:                                              # radio stream -> direct
            self._sonos("AVTransport", "SetAVTransportURI",
                '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                '<CurrentURI>%s</CurrentURI><CurrentURIMetaData>%s</CurrentURIMetaData></u:SetAVTransportURI>'
                % (esc(res), esc(meta)))
        if res.startswith("x-rincon-cpcontainer"):
            self._set_play_mode(shuffle)
        self._sonos("AVTransport", "Play",
            '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>')

    def _play_stream(self, url, title="Stream", art=""):
        """Play a plain internet-radio / audio stream URL directly (no service)."""
        self._ensure_kitchen_grouped()
        STATE["playlist"] = ""
        esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        art_tag = ("<upnp:albumArtURI>%s</upnp:albumArtURI>" % esc(art)) if art else ""
        meta = ('<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
                'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
                'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" '
                'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
                '<item id="-1" parentID="-1" restricted="true"><dc:title>%s</dc:title>'
                '<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>%s'
                '<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">RINCON_AssociatedZPUDN</desc>'
                '</item></DIDL-Lite>') % (esc(title), art_tag)
        self._sonos("AVTransport", "SetAVTransportURI",
            '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
            '<CurrentURI>%s</CurrentURI><CurrentURIMetaData>%s</CurrentURIMetaData></u:SetAVTransportURI>'
            % (esc(url), esc(meta)))
        self._sonos("AVTransport", "Play",
            '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>')

    def _resolve_feed(self, feed):
        """Turn an Apple Podcasts link/id into its RSS feed; pass RSS URLs through."""
        feed = (feed or "").strip()
        if "podcasts.apple.com" in feed or feed.isdigit():
            m = re.search(r"(\d{5,})", feed)
            if not m:
                raise Exception("no Apple Podcasts id in: %s" % feed)
            look = urllib.request.Request(
                "https://itunes.apple.com/lookup?id=%s&entity=podcast" % m.group(1),
                headers={"User-Agent": "JARVIS"})
            j = json.loads(urllib.request.urlopen(look, timeout=8).read().decode("utf-8", "ignore"))
            results = j.get("results", [])
            if results and results[0].get("feedUrl"):
                return results[0]["feedUrl"]
            raise Exception("could not resolve Apple Podcasts feed")
        return feed

    def _play_podcast(self, feed):
        """Fetch a podcast RSS feed and play its newest episode as a direct stream."""
        feed_url = self._resolve_feed(feed)
        req = urllib.request.Request(feed_url, headers={"User-Agent": "JARVIS"})
        # newest episode is at the top, so read only the first couple MB — big
        # archive feeds (hundreds of episodes) can be 10+ MB and would time out.
        xml = urllib.request.urlopen(req, timeout=20).read(2_000_000).decode("utf-8", "ignore")
        decode = lambda s: html.unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", s)).strip()
        cm = re.search(r"<title>(.*?)</title>", xml, re.S)
        show = decode(cm.group(1)) if cm else ""
        im = re.search(r"<item[ >].*?</item>", xml, re.S)
        item = im.group(0) if im else ""
        em = re.search(r'<enclosure[^>]*\burl="([^"]+)"', item)
        if not em:
            raise Exception("no episode audio in feed")
        audio = html.unescape(em.group(1))
        tm = re.search(r"<title>(.*?)</title>", item, re.S)
        ep = decode(tm.group(1)) if tm else "Latest episode"
        def art_of(block):
            m = re.search(r'<itunes:image[^>]*\bhref="([^"]+)"', block)
            if m:
                return html.unescape(m.group(1))
            m = re.search(r"<image>.*?<url>(.*?)</url>", block, re.S)
            return html.unescape(m.group(1).strip()) if m else ""
        art = art_of(item) or art_of(xml)   # episode art, else the show's cover
        self._play_stream(audio, (show + " — " + ep) if show else ep, art)

    def _set_play_mode(self, shuffle):
        self._sonos("AVTransport", "SetPlayMode",
            '<u:SetPlayMode xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
            '<NewPlayMode>%s</NewPlayMode></u:SetPlayMode>' % ("SHUFFLE" if shuffle else "NORMAL"))

    def _play_apple(self, kind, cid, title, shuffle=False):
        """Play an Apple Music album/song/playlist by its id (no favorite needed)."""
        self._ensure_kitchen_grouped()
        esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        title = title or "Apple Music"
        STATE["playlist"] = title if kind in ("playlist", "libraryplaylist") else ""
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
            '<CurrentURI>x-rincon-queue:%s#0</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % self.s_uuid)
        self._set_play_mode(shuffle)
        self._sonos("AVTransport", "Play",
            '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>')

    def _zone_groups(self):
        """Return [(coordinator_uuid, [member_ips])] from the Sonos topology."""
        env = ('<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
               's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>'
               '<u:GetZoneGroupState xmlns:u="urn:schemas-upnp-org:service:ZoneGroupTopology:1"></u:GetZoneGroupState>'
               '</s:Body></s:Envelope>')
        req = urllib.request.Request("http://%s:1400/ZoneGroupTopology/Control" % self.s_ip, data=env.encode(),
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

    def _realign_to_coordinator(self):
        """If this room's speaker is currently a MEMBER of another room's group
        (e.g. it was shared into one via /sonos/group), repoint s_ip/s_uuid at
        that group's live coordinator. Sonos rejects transport/group calls sent
        to a non-coordinator, so without this a shared-in room's page 502s."""
        try:
            env = ('<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
                   's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>'
                   '<u:GetZoneGroupState xmlns:u="urn:schemas-upnp-org:service:ZoneGroupTopology:1"></u:GetZoneGroupState>'
                   '</s:Body></s:Envelope>')
            req = urllib.request.Request("http://%s:1400/ZoneGroupTopology/Control" % self.s_ip, data=env.encode(),
                headers={"Content-Type": 'text/xml; charset="utf-8"',
                         "SOAPAction": '"urn:schemas-upnp-org:service:ZoneGroupTopology:1#GetZoneGroupState"'})
            xml = urllib.request.urlopen(req, timeout=6).read().decode("utf-8", "ignore")
            m = re.search(r"<ZoneGroupState>(.*?)</ZoneGroupState>", xml, re.S)
            state = html.unescape(m.group(1)) if m else ""
            for cm in re.finditer(r'<ZoneGroup[^>]*Coordinator="([^"]+)"[^>]*>(.*?)</ZoneGroup>', state, re.S):
                coord, body = cm.group(1), cm.group(2)
                members = re.findall(r'<ZoneGroupMember[^>]*UUID="([^"]+)"[^>]*Location="http://([\d.]+):1400', body)
                if self.s_ip in [ip for (_u, ip) in members] and coord != self.s_uuid:
                    cip = next((ip for (u, ip) in members if u == coord), None)
                    if cip:
                        self.s_ip, self.s_uuid = cip, coord
                    return
        except Exception:
            pass

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
        """Join this room's default companion (s_join) to its coordinator on every
        play. Kitchen: the hidden kitchen pair joins the lounge coordinator (the
        'Kitchen' illusion). Bedroom: the Office speaker joins bedroom by default
        (no illusion — bedroom is the real coordinator). No-op when s_join is None."""
        if not self.s_join:
            return
        try:
            self._avt_ip(self.s_join, "SetAVTransportURI",
                '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                '<CurrentURI>x-rincon:%s</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % self.s_uuid)
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
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        self._set_target(q.get("page", ["kitchen"])[0])
        sp = self.path.split("?")[0]              # path without ?page=… for route matching
        # Image proxy so the browser can sample album-art pixels same-origin
        # (a canvas can't read cross-origin CDN images).  GET /art?u=<url>
        if self.path.startswith("/art?"):
            try:
                u = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("u", [""])[0]
                if not u.startswith("http"):
                    raise Exception("bad url")
                req = urllib.request.Request(u, headers={"User-Agent": "JARVIS"})
                with urllib.request.urlopen(req, timeout=6) as r:
                    data = r.read()
                    ctype = r.headers.get("Content-Type", "image/jpeg")
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(data)
            except Exception as exc:
                self.send_response(502)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(("art proxy error: %s" % exc).encode())
            return

        # Read Sonos volume:  GET /sonos/volume
        if sp == "/sonos/volume":
            try:
                xml = self._sonos("GroupRenderingControl", "GetGroupVolume",
                    '<u:GetGroupVolume xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1">'
                    '<InstanceID>0</InstanceID></u:GetGroupVolume>')
                m = re.search(r"<CurrentVolume>(\d+)</CurrentVolume>", xml)
                self._json({"volume": int(m.group(1)) if m else 0})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        if sp == "/sonos/mute":
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
        if sp == "/sonos/state":
            try:
                self._realign_to_coordinator()   # keep working if this room is shared into a group
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
                # the live song/track, if any
                song = ""
                if "|" in stream and ("TITLE" in stream.upper() or "ARTIST" in stream.upper()):
                    # SiriusXM style: "TYPE=SNG|TITLE <title>|ARTIST <artist>|ALBUM <album>"
                    fields = {}
                    for seg in stream.split("|"):
                        seg = seg.strip()
                        for key in ("TITLE", "ARTIST"):
                            if seg.upper().startswith(key):
                                fields[key] = seg[len(key):].strip().lstrip("=").strip()
                    t, a = fields.get("TITLE", ""), fields.get("ARTIST", "")
                    if t and a:
                        song = a + " — " + t
                    elif t or a:
                        song = t or a
                elif not junk(stream):
                    song = stream
                elif title and not junk(title):
                    song = (creator + " — " + title) if creator and not junk(creator) else title
                # station name (from media metadata); drop buffering placeholders
                st = station
                if not st or "zpstr" in st.lower() or "buffering" in st.lower():
                    st = ""
                if re.match(r"CH\s*\d", st):        # SiriusXM channel -> label it
                    st = "SXM " + st
                # song + station returned separately so the client can put them on
                # two lines (track leads, station second)
                art = tag("upnp:albumArtURI")
                if not art:   # radio: logo lives in the station (media) metadata, not the track
                    art = html.unescape(first(r"<upnp:albumArtURI[^>]*>(.*?)</upnp:albumArtURI>", src)).strip()
                if art.startswith("/"):
                    art = "http://%s:1400%s" % (self.s_ip, art)
                # show the remembered playlist name only while a queue is playing
                cur_uri = first(r"<CurrentURI>(.*?)</CurrentURI>", mi)
                playlist = STATE["playlist"] if (cur_uri.startswith("x-rincon-queue") and STATE["playlist"]) else ""
                # TV (HDMI/optical) input — report it plainly, no track/station/art
                tv = cur_uri.startswith("x-sonos-htastream")
                if tv:
                    song, st, art, playlist = "TV playing", "", "", ""
                    playing = True
                category = "" if tv else STATE.get("category", "")
                self._json({"volume": vol, "mute": mute, "playing": playing, "tv": tv,
                            "track": song, "station": st, "playlist": playlist,
                            "art": art, "category": category})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Rooms this page can share to + whether each is grouped to its coordinator.
        # On the kitchen page, Lounge IS the coordinator, so its button tracks mute.
        if sp == "/sonos/rooms":
            try:
                group_ips = set()
                for coord, ips in self._zone_groups():
                    if coord == self.s_uuid:
                        group_ips = set(ips)
                lounge_on = (self.s_room == "kitchen") and (not self._lounge_muted())
                rooms = [{"name": n,
                          "grouped": (lounge_on if (n == "Lounge" and self.s_room == "kitchen")
                                      else ip in group_ips)}
                         for (n, ip) in SHARE_ROOMS.get(self.s_room, SONOS_ROOMS)]
                self._json({"rooms": rooms})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Music buttons config (for the kitchen page + admin)
        if sp == "/music":
            self._json(load_music())
            return
        # Read light state:  GET /hue/<bridge>/groups/82  ->  that bridge /groups/82
        if self.path.startswith("/hue/"):
            try:
                bkey, _, bpath = self.path[5:].partition("/")
                result = self._bridge("GET", "/" + bpath.split("?")[0], bridge=bkey)
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
        try:
            self._set_target(json.loads(raw or b"{}").get("page") or "kitchen")
        except Exception:
            self._set_target("kitchen")

        # Set Sonos group volume:  POST /sonos/volume  {"level": 0-100}
        if self.path == "/sonos/volume":
            try:
                level = max(0, min(100, int(json.loads(raw or b"{}").get("level", 0))))
                # Set EVERY speaker in this room's group to exactly this level
                # (absolute, not relative) so it never drifts/pops back.
                ips = [self.s_ip]
                for coord, member_ips in self._zone_groups():
                    if coord == self.s_uuid and member_ips:
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
                self._realign_to_coordinator()   # shared-in rooms: mute the group's coordinator
                mute = 1 if json.loads(raw or b"{}").get("mute") else 0
                self._sonos("GroupRenderingControl", "SetGroupMute",
                    '<u:SetGroupMute xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1">'
                    '<InstanceID>0</InstanceID><DesiredMute>%d</DesiredMute></u:SetGroupMute>' % mute)
                self._json({"ok": True, "mute": bool(mute)})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Skip to next / previous track (queue content only):  POST /sonos/next | /sonos/prev
        if self.path in ("/sonos/next", "/sonos/prev"):
            try:
                self._realign_to_coordinator()
                action = "Next" if self.path.endswith("next") else "Previous"
                self._sonos("AVTransport", action,
                    '<u:%s xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:%s>' % (action, action))
                self._json({"ok": True})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Play / pause the current track:  POST /sonos/transport  {"action":"play"|"pause"}
        if self.path == "/sonos/transport":
            try:
                self._realign_to_coordinator()   # act on the group's coordinator when shared in
                act = (json.loads(raw or b"{}").get("action") or "play").lower()
                if act == "pause":
                    self._sonos("AVTransport", "Pause",
                        '<u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Pause>')
                else:
                    self._sonos("AVTransport", "Play",
                        '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>')
                self._json({"ok": True, "action": act})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Switch this room's Sonos to its TV (HDMI/optical) input:  POST /sonos/tv
        if self.path == "/sonos/tv":
            try:
                self._ensure_kitchen_grouped()   # keep Office (bedroom's default companion) in the group
                self._sonos("AVTransport", "SetAVTransportURI",
                    '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                    '<CurrentURI>x-sonos-htastream:%s:spdif</CurrentURI>'
                    '<CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % self.s_uuid)
                self._sonos("AVTransport", "Play",
                    '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>')
                self._json({"ok": True, "tv": True})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Group / ungroup a room to the kitchen:  POST /sonos/group  {"room","join"}
        if self.path == "/sonos/group":
            try:
                p = json.loads(raw or b"{}")
                room, join = p.get("room"), bool(p.get("join"))
                ip = dict(SHARE_ROOMS.get(self.s_room, SONOS_ROOMS)).get(room)
                if not ip:
                    raise Exception("unknown room: %s" % room)
                if room == "Lounge" and self.s_room == "kitchen":
                    # Lounge is the kitchen's hidden coordinator — never ungroup it (that
                    # would dissolve everyone's group). Toggling it mutes/unmutes lounge.
                    self._rc_ip(ip, "SetMute",
                        '<u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID>'
                        '<Channel>Master</Channel><DesiredMute>%d</DesiredMute></u:SetMute>' % (0 if join else 1))
                elif join:
                    comp = SHARE_COMPANIONS.get(room, {})
                    join_ips = [ip] + [c for c in comp.get("ips", []) if c != ip]
                    # speakers currently in these rooms (before they join this coordinator)
                    room_ips = list(join_ips)
                    for coord, ips in self._zone_groups():
                        if any(j in ips for j in join_ips):
                            for m in ips:
                                if m not in room_ips:
                                    room_ips.append(m)
                    for jip in join_ips:
                        self._avt_ip(jip, "SetAVTransportURI",
                            '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                            '<CurrentURI>x-rincon:%s</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % self.s_uuid)
                    # pop the added rooms to this room's volume (then group volume keeps them together)
                    kvol = self._kitchen_volume()
                    for rip in room_ips:
                        try:
                            self._rc_ip(rip, "SetVolume",
                                '<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID>'
                                '<Channel>Master</Channel><DesiredVolume>%d</DesiredVolume></u:SetVolume>' % kvol)
                        except Exception:
                            pass
                else:
                    comp = SHARE_COMPANIONS.get(room, {})
                    self._avt_ip(ip, "BecomeCoordinatorOfStandaloneGroup",
                        '<u:BecomeCoordinatorOfStandaloneGroup xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:BecomeCoordinatorOfStandaloneGroup>')
                    # companion(s) rejoin the primary room's own coordinator, so they
                    # stay paired (e.g. Office follows the Bedroom back out)
                    for cip in comp.get("ips", []):
                        if cip == ip:
                            continue
                        try:
                            self._avt_ip(cip, "SetAVTransportURI",
                                '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>'
                                '<CurrentURI>x-rincon:%s</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>' % comp.get("coord", self.s_uuid))
                        except Exception:
                            pass
                self._json({"ok": True, "room": room, "grouped": join})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Play a Sonos favorite by name:  POST /sonos/favorite  {"name": "..."}
        if self.path == "/sonos/favorite":
            try:
                p = json.loads(raw or b"{}")
                STATE["category"] = p.get("category", "")
                name = p.get("name", "")
                self._play_favorite(name, bool(p.get("shuffle")))
                self._json({"ok": True, "name": name})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Play a direct stream URL (like the Sonos "Play a URL"):
        #   POST /sonos/uri  {"url": "https://.../stream.mp3", "title": "..."}
        if self.path == "/sonos/uri":
            try:
                p = json.loads(raw or b"{}")
                STATE["category"] = p.get("category", "")
                url = (p.get("url") or "").strip()
                if not (url.startswith("http") or url.startswith("x-")):
                    raise Exception("bad url")
                self._play_stream(url, p.get("title", "Stream"))
                self._json({"ok": True})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Play a podcast's newest episode:  POST /sonos/podcast  {"feed": "<apple url / rss>"}
        if self.path == "/sonos/podcast":
            try:
                p = json.loads(raw or b"{}")
                STATE["category"] = p.get("category", "")
                feed = (p.get("feed") or "").strip()
                if not feed:
                    raise Exception("no feed")
                self._play_podcast(feed)
                self._json({"ok": True})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
            return

        # Play Apple Music by id:  POST /sonos/apple  {"kind","id","title"}
        if self.path == "/sonos/apple":
            try:
                p = json.loads(raw or b"{}")
                STATE["category"] = p.get("category", "")
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

        # Admin: reorder a button:  POST /music/move  {"section","from","to"}
        if self.path == "/music/move":
            try:
                p = json.loads(raw or b"{}")
                section, frm, to = p.get("section"), int(p.get("from", -1)), int(p.get("to", 0))
                cfg = load_music()
                lst = cfg.get(section, [])
                if 0 <= frm < len(lst):
                    item = lst.pop(frm)
                    lst.insert(max(0, min(len(lst), to)), item)
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
            result = self._bridge("PUT", path, body, bridge=payload.get("bridge", "main"))
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
