import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

test("VPS serves the PDF module worker as JavaScript with a real file and immutable cache", async () => {
  const config = await readFile(fileURLToPath(new URL("../../../deploy/nginx.public.conf", import.meta.url)), "utf8");
  const location = config.match(/location\s+~\s+\^\/assets\/\.\*\\\.mjs\$\s*\{([\s\S]*?)\n\s*\}/)?.[1];
  assert.ok(location, "Native module assets require a dedicated JavaScript MIME mapping");
  assert.match(location, /default_type\s+application\/javascript\s*;/);
  assert.match(location, /try_files\s+\$uri\s+=404\s*;/);
  assert.match(location, /Cache-Control\s+"public, max-age=31536000, immutable"/);
});

test("built PDF worker uses a fresh .js URL so stale octet-stream cache entries cannot be reused", async () => {
  const assets = fileURLToPath(new URL("../dist/assets/", import.meta.url));
  const files = await readdir(assets);
  assert.ok(!files.some(file => /^pdf\.worker.*\.mjs$/.test(file)), "Do not reuse the .mjs worker URL that production cached with an invalid MIME type");
  const candidates = files.filter(file => /^pdf\.worker.*\.js$/.test(file));
  const sources = await Promise.all(candidates.map(file => readFile(assets + file, "utf8")));
  const actualWorker = sources.findIndex(source => source.includes("WorkerMessageHandler") && source.length > 100000);
  assert.ok(actualWorker >= 0, "The actual worker must be emitted as JavaScript");
  assert.ok(sources.some(source => source.includes(`/assets/${candidates[actualWorker]}`)), "The worker loader must reference the new JavaScript asset");
});
