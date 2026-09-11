#!/usr/bin/env node
/**
 * emu-site — single server for emu.terenceang.com.
 *
 * Replaces the previous four overlapping serving systems: the nginx vhost
 * (static + COOP/COEP + security headers + stubbed healthz), the emu-counter
 * systemd service (visitor counting), @apple2/server (unused Express static
 * server), and the header definitions scattered across Vite configs.
 *
 * Zero runtime dependencies: node:http + node:fs + node:zlib only.
 *
 * Layout served (default /home/terence/emu):
 *   /              landing page
 *   /apple2e/      Apple //e emulator (static, cross-origin isolated)
 *   /zx-spectrum/  ZX Spectrum emulator (static, cross-origin isolated)
 *   /api/count     visitor counter (persisted, IP-throttled)
 *   /healthz       liveness for the tunnel / uptime checks
 *   /apple2e/healthz, /zx-spectrum/healthz   origin-relative app heartbeats
 */
import http from "node:http";
import { createReadStream, constants as fsConstants } from "node:fs";
import { stat, readFile, writeFile, rename, access } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url));

const DEFAULTS = {
  root: "/home/terence/emu",
  port: 8080,
  host: "127.0.0.1",
  countFile: path.join(SITE_DIR, "count.json"),
  throttleMs: 60_000,
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

const COMPRESSIBLE = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".svg",
  ".json",
  ".txt",
  ".xml",
  ".webmanifest",
  ".wasm",
]);

const CSP =
  "default-src 'self'; " +
  "img-src 'self' data:; " +
  "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; " +
  "font-src https://fonts.gstatic.com; " +
  "connect-src 'self'; " +
  "frame-ancestors 'self'; base-uri 'self'; form-action 'self'";

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy": CSP,
};

const COOP_COEP = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
};

const ISOLATED_PREFIXES = ["/apple2e", "/zx-spectrum"];
const HASHED_ASSET_MARKER = "/assets/";

export function createEmuServer(options = {}) {
  const root = path.resolve(options.root ?? process.env.EMU_SITE_ROOT ?? DEFAULTS.root);
  const countFile = options.countFile ?? process.env.COUNT_FILE ?? DEFAULTS.countFile;
  const throttleMs = options.throttleMs ?? DEFAULTS.throttleMs;

  let count = 0;
  const lastVisit = new Map();
  let loaded = loadCount().then((n) => {
    count = n;
    return n;
  });

  async function loadCount() {
    try {
      return JSON.parse(await readFile(countFile, "utf8")).count || 0;
    } catch {
      return 0;
    }
  }

  async function persistCount() {
    const tmp = `${countFile}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ count })}\n`, "utf8");
    await rename(tmp, countFile);
  }

  function send(req, res, status, headers, body) {
    const h = { ...SECURITY_HEADERS, ...headers };
    if (req.method === "HEAD") {
      res.writeHead(status, h);
      res.end();
      return;
    }
    res.writeHead(status, h);
    res.end(body);
  }

  function json(req, res, status, value, extra = {}) {
    send(req, res, status, {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...extra,
    }, `${JSON.stringify(value)}\n`);
  }

  function clientIp(req) {
    const fwd = req.headers["x-forwarded-for"];
    const ip = fwd ? String(fwd).split(",")[0].trim() : req.socket.remoteAddress;
    return ip || "?";
  }

  async function handleCount(req, res) {
    const ip = clientIp(req);
    const now = Date.now();
    if (now - (lastVisit.get(ip) || 0) >= throttleMs) {
      await loaded;
      count += 1;
      lastVisit.set(ip, now);
      if (lastVisit.size > 10_000) {
        for (const [k, t] of lastVisit) {
          if (now - t >= throttleMs) lastVisit.delete(k);
          if (lastVisit.size <= 10_000) break;
        }
      }
      try {
        await persistCount();
      } catch {
        /* keep serving even if the write fails */
      }
    }
    json(req, res, 200, { count });
  }

  /** Resolves a decoded pathname inside root, or null if it escapes. */
  function resolveSafe(pathname) {
    const resolved = path.normalize(path.join(root, pathname));
    if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
    return resolved;
  }

  function etagOf(stats) {
    return `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
  }

  function cacheControlFor(resolvedPath) {
    // Vite emits content-hashed bundles under assets/; only those (and the
    // landing page's hashed tree) are safely immutable.
    if (resolvedPath.includes(HASHED_ASSET_MARKER)) return "public, max-age=604800, immutable";
    if (resolvedPath.endsWith(".html")) return "no-cache";
    return undefined;
  }

  async function serveFile(req, res, filePath, extraHeaders = {}) {
    let stats;
    try {
      stats = await stat(filePath);
    } catch {
      return false;
    }
    if (!stats.isFile()) return false;

    const ext = path.extname(filePath).toLowerCase();
    const acceptsGzip =
      COMPRESSIBLE.has(ext) && String(req.headers["accept-encoding"] ?? "").includes("gzip");

    const headers = {
      ...SECURITY_HEADERS,
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": cacheControlFor(filePath) ?? "no-cache",
      etag: etagOf(stats),
      vary: "Accept-Encoding",
      "content-length": stats.size,
      ...extraHeaders,
    };
    if (acceptsGzip) {
      headers["content-encoding"] = "gzip";
      delete headers["content-length"];
    }

    if (req.headers["if-none-match"] === headers.etag) {
      delete headers["content-length"];
      res.writeHead(304, headers);
      res.end();
      return true;
    }

    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return true;
    }

    res.writeHead(200, headers);
    const stream = createReadStream(filePath);
    if (acceptsGzip) stream.pipe(zlib.createGzip()).pipe(res);
    else stream.pipe(res);
    await new Promise((resolve, reject) => {
      stream.on("error", reject);
      res.on("finish", resolve);
      res.on("error", reject);
    });
    return true;
  }

  async function handleStatic(req, res, pathname) {
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      json(req, res, 400, { error: "bad request" });
      return;
    }

    const isolated = ISOLATED_PREFIXES.some(
      (p) => decoded === p || decoded.startsWith(`${p}/`),
    );
    const extraHeaders = isolated ? COOP_COEP : {};

    let resolved = resolveSafe(decoded);
    if (!resolved) {
      json(req, res, 404, { error: "not found" });
      return;
    }

    let stats = await stat(resolved).catch(() => null);
    if (stats?.isDirectory()) {
      if (!decoded.endsWith("/")) {
        send(req, res, 301, { location: `${decoded}/` });
        return;
      }
      resolved = path.join(resolved, "index.html");
      stats = await stat(resolved).catch(() => null);
    }
    if (!stats) {
      // Legacy favicon path: serve the landing favicon instead of a 404.
      if (decoded === "/favicon.ico") {
        const svg = path.join(root, "favicon.svg");
        if (await access(svg, fsConstants.F_OK).then(() => true, () => false)) {
          await serveFile(req, res, svg);
          return;
        }
      }
      json(req, res, 404, { error: "not found" });
      return;
    }

    const served = await serveFile(req, res, resolved, extraHeaders);
    if (!served) json(req, res, 404, { error: "not found" });
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        json(req, res, 405, { error: "method not allowed" }, { allow: "GET, HEAD" });
        return;
      }
      const { pathname } = new URL(req.url, "http://localhost");

      if (pathname === "/healthz" || pathname === "/apple2e/healthz" || pathname === "/zx-spectrum/healthz") {
        json(req, res, 200, { ok: true });
        return;
      }
      if (pathname === "/api/count") {
        await handleCount(req, res);
        return;
      }
      await handleStatic(req, res, pathname);
    } catch (err) {
      json(req, res, 500, { error: "internal error" });
      console.error(`${new Date().toISOString()} ${req.method} ${req.url}:`, err);
    }
  });

  return {
    server,
    /** Resolves once the counter file has been read. */
    ready: () => loaded,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? DEFAULTS.port);
  const host = process.env.HOST ?? DEFAULTS.host;
  const { server, ready } = createEmuServer();
  ready()
    .then((n) => {
      server.listen(port, host, () => {
        console.log(`emu-site listening on http://${host}:${port} count=${n} root=${process.env.EMU_SITE_ROOT ?? DEFAULTS.root}`);
      });
    })
    .catch((err) => {
      console.error("failed to start:", err);
      process.exit(1);
    });
}
