#!/usr/bin/env bash
# =====================================================================
#  JARVIS — Raspberry Pi setup
#  Run this ONCE on the Pi. It makes the Pi serve this website on your
#  network and restart automatically every time the Pi powers on.
#
#  Usage:
#     bash setup-pi.sh
# =====================================================================
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Setting up JARVIS to serve from: $DIR"

sudo tee /etc/systemd/system/jarvis.service >/dev/null <<EOF
[Unit]
Description=JARVIS home control web server
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$DIR
ExecStart=/usr/bin/python3 $DIR/server.py
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable jarvis.service
sudo systemctl restart jarvis.service   # restart so code changes take effect

IP="$(hostname -I | awk '{print $1}')"

echo ""
echo "======================================================"
echo " DONE. JARVIS is running and will auto-start on boot."
echo ""
echo " On any phone connected to SpamNet Wi-Fi, open:"
echo "     http://$IP/            (room picker)"
echo "     http://$IP/kitchen/    (kitchen controls)"
echo ""
echo " >>> Tell Claude this Pi address:  $IP"
echo "======================================================"
