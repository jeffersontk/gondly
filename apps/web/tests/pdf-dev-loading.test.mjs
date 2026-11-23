import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("PDF module and worker stay available over HTTP while SSR tests run", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const cacheDir = await mkdtemp(path.join(tmpdir(), "gondly-pdf-dev-"));
  const dev = await createServer({ root, cacheDir, server: { host: "127.0.0.1", port: 0, strictPort: false, hmr: false, ws: false } });
  let ssr;
  try {
    await dev.listen();
    const origin = `http://127.0.0.1:${dev.httpServer.address().port}`;
    const response = await fetch(`${origin}/src/lib/listImport.ts`);
    assert.equal(response.status, 200);
    const source = await response.text();
    const modulePath = source.match(/import\("([^"]*pdfjs-dist\/build\/pdf\.mjs(?:\?[^\"]*)?)"\)/)?.[1];
    assert.ok(modulePath, "PDF must use its native ESM module, not an evictable optimized dependency");
    assert.ok(!modulePath.includes(".vite/deps"));
    assert.equal((await fetch(origin + modulePath)).status, 200);
    ssr = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
    assert.notEqual(ssr.config.cacheDir, dev.config.cacheDir);
    await ssr.ssrLoadModule("/src/pages/recipes/foodPlanImport.ts");
    assert.equal((await fetch(origin + modulePath)).status, 200);
    const workerPath = source.match(/import\("([^"]*pdf\.worker\.min\.mjs\?url)"\)/)?.[1];
    assert.ok(workerPath);
    assert.equal((await fetch(origin + workerPath)).status, 200);
  } finally {
    if (ssr) await ssr.close();
    await dev.close();
    assert.equal(path.dirname(path.resolve(cacheDir)), path.resolve(tmpdir()));
    assert.ok(path.basename(cacheDir).startsWith("gondly-pdf-dev-"));
    await rm(cacheDir, { recursive: true, force: true });
  }
});
