import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { COOP_COEP_HEADERS } from "../../../coop-coep.mjs";
import { MACHINE_NAME, MACHINE_NAME_CAPS } from "./src/constants";

// Single source of truth for the displayed version: package.json. The build
// stamps it into index.html wherever the __APP_VERSION__ token appears.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

function injectVersion(): Plugin {
  return {
    name: "inject-version",
    transformIndexHtml(html) {
      return html
        .replaceAll("__APP_VERSION__", pkg.version)
        .replaceAll("__MACHINE_NAME_CAPS__", MACHINE_NAME_CAPS)
        .replaceAll("__MACHINE_NAME__", MACHINE_NAME);
    },
  };
}

export default defineConfig({
  // Relative asset URLs so the built app works both at the server root and
  // under a subpath (emu.terenceang.com/apple2e/).
  base: "./",
  plugins: [injectVersion()],
  server: {
    headers: COOP_COEP_HEADERS,
  },
  preview: {
    headers: COOP_COEP_HEADERS,
  },
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
  },
});
