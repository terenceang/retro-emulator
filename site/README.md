# emu-site — single server for emu.terenceang.com

One hardened Node service (zero dependencies) replaces the previous stack:

```
Internet → Cloudflare → cloudflared tunnel → emu-site (127.0.0.1:8080)
```

| Serves | What |
|---|---|
| `/` | Landing page (`/home/terence/emu` static tree, unchanged deploy flow) |
| `/appleii/` | Apple //e emulator dist + COOP/COEP + real `/appleii/healthz` |
| `/zx-spectrum/` | ZX Spectrum dist + COOP/COEP + `/zx-spectrum/healthz` |
| `/api/count` | Visitor counter (absorbed from emu-counter; IP-throttled, atomic persist) |
| `/healthz` | Root liveness for tunnel/uptime checks |

Headers are defined once here: security set (CSP allows the MCP bridge
`ws://localhost:8791`/`8790` — the old nginx CSP silently blocked it),
COOP/COEP on the two emulator subpaths, `immutable` caching for hashed
`assets/` bundles, `no-cache` for HTML, gzip for compressible types.

## Files

- `server.mjs` — the server (plain node:http)
- `test/server.test.mjs` — `node --test test/server.test.mjs`
- `emu-site.service` — systemd unit (hardened; `ReadWritePaths` only for this dir)
- `cutover.sh` — **sudo** script: install unit, flip cloudflared, retire nginx + emu-counter
- `count.json` — visitor counter state (gitignored; seeded from emu-counter)

## Local development

```
node --test test/server.test.mjs
EMU_SITE_ROOT=/home/terence/emu PORT=8080 node server.mjs
```

## Cutover

1. `cp /home/terence/backup-repos/emu-counter/count.json /home/terence/emu-monorepo/site/` (preserve the count)
2. `sudo bash /home/terence/emu-monorepo/site/cutover.sh`
   - installs + starts `emu-site.service`
   - points cloudflared ingress at `http://localhost:8080` and restarts the tunnel
   - disables `nginx` and `emu-counter`
3. Verify: `curl -s https://emu.terenceang.com/appleii/healthz`, `/api/count`,
   `curl -sI https://emu.terenceang.com/appleii/ | grep -i cross-origin`

## Rollback

```
sudo systemctl start nginx emu-counter
sudo sed -i 's|http://localhost:8080|http://localhost:80|' /home/terence/.cloudflared/config.yml
sudo systemctl restart cloudflared
sudo systemctl stop emu-site
```

Old nginx/systemd configs are preserved in this repo under `deploy/` (pre-consolidation copies live in `~/backup-repos/`).

## Notes

- Node 22 (same interpreter as the old counter: `~/.local/opt/node/bin/node`).
- No range-request support (no media files served); no SPA fallback (404s are real 404s).
- `count.json` lives in this directory; the unit grants write access only here.
