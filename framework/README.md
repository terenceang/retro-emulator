# @retro/framework

Shared, generic infra code for the `apple2e` and `zx-spectrum` emulator modules in this repo
(`retro-emulator`). Extracted because both modules were independently built the same way and had
accumulated real duplication — some of it byte-identical — in the harness/plumbing layer: the
SharedArrayBuffer ring-buffer transport, the Worker-host client, the AudioWorklet sink, and a
couple of small storage helpers.

**What's deliberately *not* here:** each module's `packages/core/` (CPU, memory, video/ULA, disk
& tape formats) — that's genuinely different hardware (6502 vs Z80) with no real shared logic,
and each module's `packages/mcp-server` (removed entirely, not extracted).

## Layout

```
src/
  ring-buffer.ts       SharedArrayBuffer frame/audio ring primitives (FrameRingWriter/Reader,
                        AudioRing) and the header-length constants/byte-length helpers both
                        modules' worker/protocol.ts re-export rather than restate.
  emulator-client.ts    EmulatorClientBase<THostMsg, TWorkerMsg> — the generic Worker-host
                        client (construction, shared-memory detection, frame/audio buffer
                        allocation, the "ready"/"error"/"frame" message cases, pollFrame() /
                        getFrameCount() / takeFallbackAudio()). Each module's own
                        packages/app/src/worker-client.ts subclasses this with its own
                        machine-specific message handling and public API.
  audio-sink.ts         AudioSink — the AudioWorkletNode wrapper, parameterized by the
                        consuming module's worklet processor URL/name and sample rate (both
                        module-specific; passed in by that module's own main.ts).
  idb.ts                Promise-wrapped IndexedDB helpers (open/get/put/delete a store).
  base64.ts             ArrayBuffer <-> base64 string conversion.
```

Each file is exposed as its own subpath export (`@retro/framework/ring-buffer`,
`@retro/framework/emulator-client`, etc.) resolving straight to the `.ts` source — same
raw-source-via-`package.json` `exports` pattern each module's own `core`/`worker` packages
already use, so there's no build step needed for either consumer to import from this package.

## A build-tooling gotcha worth knowing if you touch `emulator-client.ts` or `audio-sink.ts`

Each module constructs its own `Worker`/`AudioWorklet` module URL via
`new URL("...", import.meta.url)`. **That pattern must appear literally in the consuming
module's own file**, not be passed in from here as an already-resolved value — Vite (and
bundlers generally) only recognize `new Worker(new URL(...))` as a bundleable entry point when
both calls are visibly together in one module. `emulator-client.ts` takes an already-constructed
`Worker` for exactly this reason (see the comment on `EmulatorClientBase`'s constructor); an
earlier version of this code took a `URL` instead and silently broke — the build still exited 0,
but `dist/assets/emulator.worker-*.ts` was a raw, unbundled, unusable copy of the source instead
of the compiled worker script.

## Testing

```
npm test           # vitest run (src/test/**/*.test.ts)
npm run typecheck  # tsc -b
npm run lint       # eslint .
npm run test:all   # all three, same gate as apple2e/zx-spectrum's own test:all
```

Run from this directory (`framework/`) — like `apple2e/` and `zx-spectrum/`, `npm install`
happens once from the repo root; this directory's own `package.json` is a workspace member
directly (unlike `apple2e/package.json`/`zx-spectrum/package.json`, which are non-member
convenience script runners — this package has no per-module sub-packages to route through).
