#!/usr/bin/env python3
"""
JARVIS — Raspberry Pi web server + Hue relay.

Serves this folder as a website AND relays light commands to the Hue
bridge. The browser POSTs to /hue on the Pi; the Pi forwards a PUT to the
bridge. This is needed because browsers block a web page from sending the
PUT/CORS request the Hue bridge requires — but the Pi can do it freely.

The bridge IP + token live HERE (on the Pi), not in the public web code.
"""

import json
import os
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# ---- Your Hue bridge (edit these if they ever change) -------------------
BRIDGE_IP = "192.168.86.151"
HUE_USER  = "qu7RZKY7O0HUL6vkpSnOpOXqRNKre0JzcSTf5v9a"
PORT      = 80
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

    def do_GET(self):
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
        if self.path.rstrip("/") != "/hue":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
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
