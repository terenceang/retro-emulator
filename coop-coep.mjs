// Cross-origin isolation headers required by the SharedArrayBuffer-based
// emulator workers. Single source of truth for server.mjs (production) and
// both apps' vite.config.ts (dev/preview) — edit only this file to change them.
export const COOP_COEP_HEADERS = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
};
