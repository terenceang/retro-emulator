import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

// Single source of truth for the displayed version: package.json. The build
// stamps it into index.html wherever the __APP_VERSION__ token appears.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

function injectVersion(): Plugin {
  return {
    name: "inject-version",
    transformIndexHtml(html) {
      return html.replaceAll("__APP_VERSION__", pkg.version);
    },
  };
}

export default defineConfig({
  // Relative asset URLs so the built app works both at the server root and
  // under a subpath (emu.terenceang.com/appleii/).
  base: "./",
  plugins: [injectVersion()],
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
