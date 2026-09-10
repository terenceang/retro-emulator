# emu-deploy — ops files for emu.terenceang.com

## Active topology (since emu-site cutover)

```
Internet → Cloudflare → cloudflared tunnel → emu-site (127.0.0.1:8080)
                                              ├─ /              landing (~/emu)
                                              ├─ /apple2e/      apple2e dist
                                              ├─ /zx-spectrum/  zx dist
                                              ├─ /api/count     visitor counter
                                              └─ /healthz       liveness
```

- `emu-site.service` — **the single production server** (source of truth: `~/emu-site`)
- `cloudflared.service` — tunnel unit; ingress lives in `~/.cloudflared/config.yml`
  (`service: http://localhost:8080`)

## Retired (kept for rollback)

- `emu.terenceang.com.conf`, `emu-security.conf` — old nginx vhost + header snippet
  (enabled via `/etc/nginx/sites-enabled/`). Superseded: its healthz was a fake 204,
  its CSP blocked the MCP bridge, and `add_header` in location blocks silently dropped
  the server-level security headers.
- `emu-counter.service` — counter folded into emu-site (`/api/count`).

Rollback steps: see `~/emu-site/README.md`.
