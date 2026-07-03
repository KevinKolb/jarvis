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
# ---- Kitchen Sonos (stereo pair; .41 = the pair's coordinator) ----------
SONOS_IP   = "192.168.86.41"
SONOS_UUID = "RINCON_7828CAE1ACD801400"   # coordinator (for queue playback)
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

    def _play_favorite(self, name):
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
        self._sonos("AVTransport", "Play",
            '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>')

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
                self._json({"volume": vol, "mute": mute, "playing": playing, "track": track})
            except Exception as exc:
                self._json({"error": str(exc)}, 502)
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
                self._sonos("GroupRenderingControl", "SetGroupVolume",
                    '<u:SetGroupVolume xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1">'
                    '<InstanceID>0</InstanceID><DesiredVolume>%d</DesiredVolume></u:SetGroupVolume>' % level)
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

        # Play a Sonos favorite by name:  POST /sonos/favorite  {"name": "..."}
        if self.path == "/sonos/favorite":
            try:
                name = json.loads(raw or b"{}").get("name", "")
                self._play_favorite(name)
                self._json({"ok": True, "name": name})
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
