import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = {
  slug: "exemplo-revisado",
  title: "Conteúdo aprovado para teste",
  summary: "Um guia de exemplo",
  category: "Organização",
  status: "published",
  author: "Editor de teste",
  reviewedBy: "Revisor de teste",
  publishedAt: "2026-09-24",
  sections: [
    {
      title: "Planejamento",
      paragraphs: ["Conteúdo integral presente sem JavaScript."],
    },
  ],
};
test("published article renders full content and editorial metadata without auth", async () => {
  const server = await createServer({
    root,
    configFile: path.join(root, "vite.config.ts"),
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  try {
    const { renderPublic } = await server.ssrLoadModule(
      "/src/editorial/render.tsx",
    );
    const html = renderPublic("/blog/exemplo-revisado", [fixture]);
    assert.ok(html.includes(fixture.title));
    assert.ok(html.includes(fixture.sections[0].paragraphs[0]));
    assert.ok(html.includes("Editor de teste"));
    assert.ok(!html.includes("adsbygoogle"));
  } finally {
    await server.close();
  }
});
test("production artifacts exclude drafts and have complete public HTML", async () => {
  const dist = path.join(root, "dist");
  const html = await readFile(
    path.join(dist, "guias/comparar-precos/index.html"),
    "utf8",
  );
  assert.ok(html.includes("R$ 16,00/kg"));
  assert.ok(html.includes('rel="canonical"'));
  assert.ok(html.includes("public-main-"));
  const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
  assert.ok(sitemap.includes("/guias/comparar-precos"));
  assert.ok(!sitemap.includes("preview"));
  const drafts = JSON.parse(
    await readFile(path.join(root, "src/editorial/drafts.json"), "utf8"),
  );
  const files = await readdir(path.join(dist, "assets"));
  const js = (
    await Promise.all(
      files
        .filter((f) => f.endsWith(".js"))
        .map((f) => readFile(path.join(dist, "assets", f), "utf8")),
    )
  ).join("");
  for (const draft of drafts) {
    assert.ok(!js.includes(draft.slug));
    assert.ok(!sitemap.includes(draft.slug));
  }
  assert.match(
    await readFile(path.join(dist, "ads.txt"), "utf8"),
    /^google.com, pub-/,
  );
});
