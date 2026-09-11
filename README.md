# retro-emulator

Repo for emu.terenceang.com: site server, ops/deploy files, and both emulator codebases — all live directly at the repo root.

## Layout

| Path | What it is |
|---|---|
| `server.mjs` | Site server: landing page + apple2e + zx-spectrum + visitor counter |
| `test/server.test.mjs` | Site server tests (`node --test test/server.test.mjs`) |
| `count.json` | Visitor counter state (gitignored) |
| `deploy/` | systemd units, cloudflared service (canonical copies) |
| `landing/` | Landing page source (`/`) — HTML/CSS/JS + machine photos |
| `public/` | Served root (`EMU_SITE_ROOT`) — symlinks only, into `landing/` and the two dist builds |
| `apple2e/` | Apple //e emulator monorepo |
| `zx-spectrum/` | ZX Spectrum emulator monorepo |
| `archive/` | Retired/one-time files kept for historical reference only (not part of the active deploy) — see `archive/README.md` |

## Site server

One hardened Node service (zero runtime dependencies) serves everything:

```
Internet → Cloudflare → cloudflared tunnel → emu-site (127.0.0.1:8080)
```

| Serves | What |
|---|---|
| `/` | Landing page (source: `landing/`, served via `public/` symlinks) |
| `/apple2e/` | Apple //e emulator dist + COOP/COEP + real `/apple2e/healthz` |
| `/zx-spectrum/` | ZX Spectrum dist + COOP/COEP + `/zx-spectrum/healthz` |
| `/api/count` | Visitor counter (IP-throttled, atomic persist) |
| `/healthz` | Root liveness for tunnel/uptime checks |

Headers are defined once here: security set, COOP/COEP on the two emulator subpaths,
`immutable` caching for hashed `assets/` bundles, `no-cache` for HTML,
gzip for compressible types.

Notes:
- Node 22 (`~/.local/opt/node/bin/node`).
- No range-request support (no media files served); no SPA fallback (404s are real 404s).

### Local development

```
node --test test/server.test.mjs
EMU_SITE_ROOT=$(pwd)/public PORT=8080 node server.mjs
```

## Runtime (unchanged paths)

- Static web root: `public/`, inside this repo — every entry in it is a symlink
  (`index.html`, `favicon.svg`, `assets/` → `landing/`; `apple2e/` → `apple2e/packages/app/dist`;
  `zx-spectrum/` → `zx-spectrum/packages/app/dist`), so this repo is the single source of
  truth for everything served and nothing lives only on the deploy host.
- Service: `emu-site.service` runs `server.mjs` on port 8080, directly from this repo
  (`ExecStart=.../node /home/terence/retro-emulator/server.mjs`,
  `EMU_SITE_ROOT=/home/terence/retro-emulator/public`)
- `count.json` lives at the repo root; the systemd unit's `ReadWritePaths` grants write
  access to the whole repo root for this (a tradeoff of the flat layout — narrower
  sandboxing would mean moving `count.json` into its own subdirectory)

## After editing deploy/ units

The installed copy in `/etc/systemd/system` is NOT auto-synced. To apply changes:

```
sudo cp deploy/emu-site.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl restart emu-site
```

(The one-time install/cutover script that originally set this up is archived at
`archive/cutover.sh` — routine changes just use the two lines above.)

## History

Pre-merge repos are archived in `~/backup-repos/` (with their `.git` dirs):
`apple-ii`, `zx-spectrum`, `emu-site`, `emu-deploy`, plus the retired `emu-counter`.
All four git histories were merged here with `git subtree` — `git log --follow` works across the merge.

Retired/superseded files from later refactors (old nginx config, `emu-counter.service`,
the one-time cutover script) are kept in `archive/` for now — see `archive/README.md`.
They'll be deleted once the flat layout has proven itself in production.
