import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs so the built app works both at the server root and
  // under a subpath (emu.terenceang.com/appleii/).
  base: "./",
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
  },
});
