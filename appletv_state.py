#!/usr/bin/env python3
"""Read Apple TV metadata with pyatv and emit compact JSON for JARVIS."""

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import warnings

warnings.filterwarnings("ignore", message="Python 3.7 is no longer supported.*")
import pyatv
from pyatv.const import Protocol


def clean(value):
    if value is None:
        return ""
    text = str(value)
    if "." in text:
        text = text.rsplit(".", 1)[-1]
    return "" if text == "None" else text


def episode_label(series, season, episode):
    bits = []
    if season not in (None, "", 0):
        bits.append("S%s" % season)
    if episode not in (None, "", 0):
        bits.append("E%s" % episode)
    return (series + (" " + " ".join(bits) if bits else "")) if series else " ".join(bits)


def art_extension(mimetype):
    mt = (mimetype or "").lower()
    if "png" in mt:
        return "png"
    if "webp" in mt:
        return "webp"
    return "jpg"


def load_credentials(args):
    """Load optional per-room Apple TV credentials from a private Pi-side file."""
    credentials = {}
    path = args.credentials_file or "appletv_credentials.json"
    if path and os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as src:
                data = json.load(src)
            room_data = data.get(args.room, {}) if isinstance(data, dict) else {}
            id_data = data.get(args.identifier, {}) if isinstance(data, dict) else {}
            if isinstance(room_data, dict):
                credentials.update(room_data)
            if isinstance(id_data, dict):
                credentials.update(id_data)
        except Exception:
            pass
    if args.companion_credentials:
        credentials["companion"] = args.companion_credentials
    return credentials


async def read_state(args):
    loop = asyncio.get_event_loop()
    hosts = [args.host] if args.host else None
    devices = await pyatv.scan(loop, timeout=args.timeout, identifier=args.identifier, hosts=hosts)
    if not devices:
        return {"ok": False, "available": False, "error": "not_found", "id": args.identifier}

    credentials = load_credentials(args)
    if credentials.get("companion"):
        devices[0].set_credentials(Protocol.Companion, credentials["companion"])

    atv = await pyatv.connect(devices[0], loop)
    try:
        playing = await atv.metadata.playing()
        state = {
            "ok": True,
            "available": True,
            "id": args.identifier,
            "name": devices[0].name,
            "title": playing.title or "",
            "artist": playing.artist or "",
            "album": playing.album or "",
            "series_name": playing.series_name or "",
            "season_number": playing.season_number,
            "episode_number": playing.episode_number,
            "genre": playing.genre or "",
            "media_type": clean(playing.media_type),
            "device_state": clean(playing.device_state),
            "position": playing.position,
            "total_time": playing.total_time,
            "app_name": "",
            "app_id": "",
            "art": "",
        }

        try:
            app = atv.metadata.app
            state["app_name"] = getattr(app, "name", "") or ""
            state["app_id"] = getattr(app, "identifier", "") or ""
        except Exception:
            pass

        try:
            artwork = await atv.metadata.artwork()
            if artwork and getattr(artwork, "bytes", None):
                data = artwork.bytes
                digest = hashlib.sha1(data).hexdigest()[:12]
                ext = art_extension(getattr(artwork, "mimetype", ""))
                base = re.sub(r"[^a-z0-9_-]+", "-", (args.room or "appletv").lower()).strip("-") or "appletv"
                filename = "appletv-%s.%s" % (base, ext)
                path = os.path.join(args.art_dir, filename)
                os.makedirs(args.art_dir, exist_ok=True)
                with open(path, "wb") as out:
                    out.write(data)
                state["art"] = "%s/%s?v=%s" % (args.art_url.rstrip("/"), filename, digest)
        except Exception:
            pass

        subtitle = (
            episode_label(state["series_name"], state["season_number"], state["episode_number"])
            or state["artist"]
            or state["album"]
            or state["app_name"]
        )
        state["subtitle"] = subtitle
        state["display_title"] = state["title"] or state["series_name"] or state["app_name"] or ""
        return state
    finally:
        atv.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", dest="identifier", required=True)
    parser.add_argument("--room", default="appletv")
    parser.add_argument("--host", default="")
    parser.add_argument("--companion-credentials", default=os.environ.get("APPLE_TV_COMPANION_CREDENTIALS", ""))
    parser.add_argument("--credentials-file", default=os.environ.get("APPLE_TV_CREDENTIALS_FILE", ""))
    parser.add_argument("--timeout", type=int, default=4)
    parser.add_argument("--art-dir", default="assets")
    parser.add_argument("--art-url", default="/assets")
    args = parser.parse_args()

    try:
        result = asyncio.get_event_loop().run_until_complete(read_state(args))
    except Exception as exc:
        result = {"ok": False, "available": False, "error": str(exc), "id": args.identifier}
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
