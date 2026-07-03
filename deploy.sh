#!/usr/bin/env bash
# =====================================================================
#  Push the current files straight to the Pi (no GitHub) and restart.
#  Usage:  bash deploy.sh USER@192.168.86.147
#          (or set PI_HOST once:  export PI_HOST=USER@192.168.86.147)
# =====================================================================
set -e

PI="${1:-$PI_HOST}"
if [ -z "$PI" ]; then
  echo "usage: bash deploy.sh USER@192.168.86.147"
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Copying files to $PI ..."
scp -q -r \
  "$DIR/index.html" \
  "$DIR/admin.html" \
  "$DIR/kitchen" \
  "$DIR/assets" \
  "$DIR/server.py" \
  "$DIR/favicon.ico" \
  "$DIR/kitchen.ico" \
  "$DIR/home-touch.png" \
  "$DIR/kitchen-touch.png" \
  "$DIR/setup-pi.sh" \
  "$PI:~/jarvis/"

echo "Restarting the server on the Pi ..."
ssh "$PI" "sudo systemctl restart jarvis"

echo "Done — deployed to $PI."
