# archive

Retired and one-time files kept for historical reference only — not part of the active deploy.

- `cutover.sh` — the one-time script that installed `emu-site.service`, flipped cloudflared
  to port 8080, and retired nginx + `emu-counter`. Already run; not needed for routine
  changes (see the root README's "After editing deploy/ units" section).
- `deploy-legacy/emu-counter.service` — the old visitor-counter service, folded into
  `emu-site`'s `/api/count`.
- `deploy-legacy/emu.terenceang.com.conf`, `deploy-legacy/emu-security.conf` — the old
  nginx vhost + security headers, superseded by `emu-site.service`'s built-in headers.

These stay recoverable via git history regardless — this directory will be deleted once
the current flat repo layout has proven itself running in production for a while.
