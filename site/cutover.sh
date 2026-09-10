#!/bin/bash
# emu-site cutover — run with sudo:  sudo bash /home/terence/emu-monorepo/site/cutover.sh
# Installs the emu-site service, repoints cloudflared at it, retires nginx + emu-counter.
set -euo pipefail

SYSTEMD=/etc/systemd/system
CLOUDFLARED_CONFIG=/home/terence/.cloudflared/config.yml

echo "==> Installing emu-site.service"
cp /home/terence/emu-monorepo/deploy/emu-site.service "$SYSTEMD/emu-site.service"
systemctl daemon-reload
systemctl enable --now emu-site
sleep 1
systemctl --no-pager status emu-site | head -5

echo "==> Smoke-testing emu-site on 127.0.0.1:8080"
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/appleii/healthz
curl -fsS http://127.0.0.1:8080/api/count
curl -fsSI http://127.0.0.1:8080/appleii/ | grep -i cross-origin

echo "==> Repointing cloudflared ingress to http://localhost:8080"
if grep -q "service: http://localhost:80$" "$CLOUDFLARED_CONFIG"; then
  sed -i 's|service: http://localhost:80$|service: http://localhost:8080|' "$CLOUDFLARED_CONFIG"
  systemctl restart cloudflared
  sleep 3
else
  echo "    cloudflared config already points at :8080 — leaving as is"
fi

echo "==> Retiring nginx and emu-counter"
systemctl disable --now emu-counter || true
systemctl disable --now nginx || true

echo "==> Done. Verify from outside:"
echo "    curl -s https://emu.terenceang.com/appleii/healthz"
echo "    curl -s https://emu.terenceang.com/api/count"
