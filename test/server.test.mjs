import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createEmuServer } from "../server.mjs";

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "emu-site-"));
  await mkdir(path.join(root, "apple2e", "assets"), { recursive: true });
  await mkdir(path.join(root, "zx-spectrum"), { recursive: true });
  await writeFile(path.join(root, "index.html"), "<h1>landing</h1>");
  await writeFile(path.join(root, "favicon.svg"), "<svg/>");
  await writeFile(path.join(root, "apple2e", "index.html"), "<h1>apple2e</h1>");
  await writeFile(path.join(root, "apple2e", "assets", "index-abc123.js"), "console.log(1)");
  await writeFile(path.join(root, "zx-spectrum", "index.html"), "<h1>zx</h1>");
  return root;
}

async function withServer(fn, { throttleMs = 60_000, seedCount } = {}) {
  const root = await makeFixture();
  const countFile = path.join(root, "..", `count-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  if (seedCount !== undefined) {
    await writeFile(countFile, `${JSON.stringify({ count: seedCount })}\n`);
  }
  const { server, ready } = createEmuServer({ root, countFile, throttleMs });
  await ready();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base, countFile);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
    await rm(countFile, { force: true });
  }
}

test("healthz endpoints answer {ok:true} on all three paths", async () => {
  await withServer(async (base) => {
    for (const p of ["/healthz", "/apple2e/healthz", "/zx-spectrum/healthz"]) {
      const res = await fetch(`${base}${p}`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
      assert.match(res.headers.get("cache-control"), /no-store/);
    }
  });
});

test("security headers are on every response; COOP/COEP only on isolated subpaths", async () => {
  await withServer(async (base) => {
    for (const p of ["/", "/apple2e/", "/zx-spectrum/", "/missing", "/api/count"]) {
      const res = await fetch(`${base}${p}`);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff", p);
      assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN", p);
      assert.match(res.headers.get("content-security-policy"), /default-src 'self'/, p);
    }
    for (const p of ["/apple2e/", "/zx-spectrum/"]) {
      const res = await fetch(`${base}${p}`);
      assert.equal(res.headers.get("cross-origin-opener-policy"), "same-origin", p);
      assert.equal(res.headers.get("cross-origin-embedder-policy"), "require-corp", p);
    }
    for (const p of ["/", "/api/count"]) {
      const res = await fetch(`${base}${p}`);
      assert.equal(res.headers.get("cross-origin-opener-policy"), null, p);
    }
  });
});

test("serves index.html for directories, correct cache per file class", async () => {
  await withServer(async (base) => {
    const page = await fetch(`${base}/apple2e/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.equal(page.headers.get("cache-control"), "no-cache");
    assert.equal(await page.text(), "<h1>apple2e</h1>");

    const asset = await fetch(`${base}/apple2e/assets/index-abc123.js`, {
      headers: { "accept-encoding": "gzip" },
    });
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type"), /javascript/);
    assert.match(asset.headers.get("cache-control"), /immutable/);
  });
});

test("directory without trailing slash redirects", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/apple2e`, { redirect: "manual" });
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), "/apple2e/");
  });
});

test("path traversal is rejected", async () => {
  await withServer(async (base) => {
    for (const p of ["/../server.mjs", "/%2e%2e/server.mjs", "/apple2e/../../etc/passwd"]) {
      const res = await fetch(`${base}${p}`);
      assert.equal(res.status, 404, p);
      assert.ok(!(await res.text()).includes("SERVER"), p);
    }
  });
});

test("unknown paths 404, favicon.ico falls back to favicon.svg", async () => {
  await withServer(async (base) => {
    const missing = await fetch(`${base}/nope.html`);
    assert.equal(missing.status, 404);

    const fav = await fetch(`${base}/favicon.ico`);
    assert.equal(fav.status, 200);
    assert.match(fav.headers.get("content-type"), /svg/);
  });
});

test("etag revalidation returns 304", async () => {
  await withServer(async (base) => {
    const first = await fetch(`${base}/apple2e/`);
    const etag = first.headers.get("etag");
    assert.ok(etag);
    const second = await fetch(`${base}/apple2e/`, { headers: { "if-none-match": etag } });
    assert.equal(second.status, 304);
  });
});

test("count increments per IP, throttles repeats, and persists atomically", async () => {
  await withServer(
    async (base, countFile) => {
      const a1 = await fetch(`${base}/api/count`, { headers: { "x-forwarded-for": "1.2.3.4" } });
      assert.equal((await a1.json()).count, 1);
      const a2 = await fetch(`${base}/api/count`, { headers: { "x-forwarded-for": "1.2.3.4" } });
      assert.equal((await a2.json()).count, 1);
      const b1 = await fetch(`${base}/api/count`, { headers: { "x-forwarded-for": "5.6.7.8" } });
      assert.equal((await b1.json()).count, 2);

      const raw = JSON.parse(await readFile(countFile, "utf8"));
      assert.equal(raw.count, 2);
    },
    { throttleMs: 60_000 },
  );
});

test("count resumes from the persisted file", async () => {
  await withServer(
    async (base) => {
      const res = await fetch(`${base}/api/count`, { headers: { "x-forwarded-for": "9.9.9.9" } });
      assert.equal((await res.json()).count, 42);
    },
    { seedCount: 41 },
  );
});

test("non-GET methods are rejected", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`, { method: "POST" });
    assert.equal(res.status, 405);
  });
});
