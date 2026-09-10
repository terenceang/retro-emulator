# retro-emulator

Single repo for emu.terenceang.com: site server, ops/deploy files, and both emulator codebases.

## Layout

| Path | What it is |
|---|---|
| `site/` | Live site server (`server.mjs`): landing page + apple2e + zx-spectrum + visitor counter |
| `deploy/` | systemd units, cloudflared service, Caddy/nginx config (canonical copies) |
| `emulator/apple2e/` | Apple //e emulator monorepo (pnpm workspaces) |
| `emulator/zx-spectrum/` | ZX Spectrum emulator monorepo (pnpm workspaces) |

## Runtime (unchanged paths)

- Static web root: `/home/terence/emu` (built output, not in this repo)
- Service: `emu-site.service` runs `site/server.mjs` on port 8080
- `/home/terence/emu-site` is a symlink to `site/` so the running unit keeps working

## After editing deploy/ units

The installed copy in `/etc/systemd/system` is NOT auto-synced. To apply changes:

```
sudo cp deploy/emu-site.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl restart emu-site
```

or run `sudo bash site/cutover.sh` (idempotent).

## History

Pre-merge repos are archived in `~/backup-repos/` (with their `.git` dirs):
`apple-ii`, `zx-spectrum`, `emu-site`, `emu-deploy`, plus the retired `emu-counter`.
All four git histories were merged here with `git subtree` — `git log --follow` works across the merge.
