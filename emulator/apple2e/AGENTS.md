# Apple //e Emulator — Agent Guide

## Quick commands

```
npm run dev         # build MCP server, start it, then Vite dev server
npm run build        # build all packages in dependency order
npm run serve        # build everything, then vite preview of packages/app/dist (:4173, sends COOP/COEP)
npm test             # vitest (packages/*/src/**/*.test.ts)
npm run typecheck    # tsc -b (composite project references)
npm run lint         # eslint .
npm run test:all     # typecheck + lint + test (pre-merge gate)
```

Build order matters: `core` → `worker` → `app` → `mcp-server`. The root `npm run build` handles this.

## Monorepo structure

```
packages/core/      6502 CPU, memory/language-card, video, speaker, Disk II, save states
packages/worker/    Web Worker host, shared-memory frame/audio ring buffers
packages/app/       Vite browser app, UI, input mapping, AudioWorklet, IndexedDB storage
packages/mcp-server/ MCP tool server + WebSocket bridge (ws://localhost:8791)
```

Dependency chain: `worker` → `core`; `app` → `core` + `worker`; `mcp-server` → `core`.

## Toolchain

- **Node 22** (`.nvmrc`)
- **TypeScript 5.7** with strict mode, composite references, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **Vitest** for tests, **ESLint** with `typescript-eslint`, **Prettier** (100 width, trailing commas)
- MCP server imports from `../../core/dist/index.js` (built output), so `core` must be built before the MCP server runs

## Deployment & healthz contract

Production is served by the standalone **emu-site** server (`~/emu-site`, its own repo): one
node:http process serves the landing page plus this app's and the ZX Spectrum's static dists,
the visitor counter (`/api/count`), and security/COOP/COEP headers for everything. This repo
ships only a static build — deploy = copy `packages/app/dist/*` to the site root's `apple2e/`
directory.

Healthz contract: the app polls **origin-relative `healthz`** every 5s (4s timeout); **any
2xx response counts as alive** (the body is never inspected). Keep that contract in sync with
emu-site's `/apple2e/healthz` endpoint.

## ROM files

No ROM is bundled in the repo (Apple copyright). The `rom/` and `Disk/` directories are gitignored local dumps — never commit them. The emulator accepts:
- 16KB combined CD+EF dump
- Two 8KB chip dumps (CD + EF)
- 12KB basic/monitor-only dump ($D000-$FFFF)
- 32KB combined dump (only second 16KB used)

## MCP server

The MCP server runs headlessly via stdio (`apple2-mcp` binary). When a browser tab connects to `ws://localhost:8791`, tools auto-route to the browser instance; otherwise they use a private headless `AppleIIe` machine. Key timing detail: `press_key` must hold the key for a few `run_frames` calls (down → run_frames → up).

## Testing notes

- All tests live in `packages/*/src/test/` (one folder per package, enforced by the vitest include pattern) — never colocate `*.test.ts` with sources
- Tests use a mock NOP ROM (`makeNopRom`) — real ROMs are not used in unit tests (except
  optional smoke tests in `pr6-smoke.test.ts` and `dos33-boot-smoke.test.ts`, which skip if
  `rom/APPLE2E.ROM` or `Disk/DOS33.dsk` is absent)
- The CPU suite runs the full Klaus Dormann functional-test exerciser
  (`packages/core/src/test/mos6502.exerciser.test.ts`). The 64KB fixture binary lives in
  `packages/core/src/test/fixtures/` (GPLv3, from Klaus Dormann's repo — no network needed to run).
  Success = self-jam at $3469; any other jam address = CPU bug at that test.
- Disk nibble codec tests pin byte-for-byte vectors against AppleWin/MAME references
  (translate table, aux order, pair swap, checksum convention) — if you change
  `nibbleCodec.ts`, those vectors are the contract with real DOS 3.3 disks
- `DiskII` models two drives (`insertDisk(image, drive)`); $C0EA/$C0EB select the active
  one, and each has independent motor/track/write-protect state. On disk tracks, address
  fields are labeled with physical sector numbers (0..15); DOS 3.3 RWTS handles logical-to-physical
  interleaving in software via its internal `SECTBL` ($3FB8).
- The MCP png test needs no build (png.ts only imports node:zlib)

## Single sources of truth

- Shared constants/types live in `core`: `SPECIAL_KEY_CODES` (io/keyboardCodes.ts), `diskFormatFromPath` + `DISK_EXTENSIONS` (disk/dsk.ts), `Frame` (machines/appleIIe.ts), MCP port + wire commands (io/bridgeProtocol.ts)
- `worker/protocol.ts` derives frame/audio constants from core's `FPS`/screen sizes and re-exports `Frame`/`DiskStatus` — never restate them elsewhere
- Browser storage keys + IndexedDB names: `app/src/utils/storageKeys.ts` (`storageClear.ts` derives its purge list from it, so new keys are covered automatically)
- Drive UI is created per-drive via `app/src/ui/driveUi.ts` (`createDriveUi(0|1)`) — do not add per-drive DOM refs or branchy `drive === 1` UI copies

## Code style

- No `//` comments in code unless explaining non-obvious hardware behavior
- Unused vars/params prefixed with `_` (eslint rule)
- Empty catch blocks allowed (`no-empty` with `allowEmptyCatch`)
