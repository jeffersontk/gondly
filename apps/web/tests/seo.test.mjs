import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
test("home and legal pages render their real content without browser APIs or authentication", async () => {
  const server = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { renderMarketingPage } = await server.ssrLoadModule("/src/seo/render.tsx");
    const home = renderMarketingPage("/", "test-google-client");
    assert.match(home, /<h1[^>]*>.*lista de compras/i);
    assert.match(home, /compartilh/i);
    assert.match(home, /href="\/guias\/lista-de-compras"/);
    assert.doesNotMatch(home, /Login indisponível/);
    for (const [route, title] of [["/privacy", "Política de privacidade"], ["/terms", "Termos de uso"], ["/contact", "Contato"]]) {
      assert.ok(renderMarketingPage(route).includes(title));
    }
  } finally { await server.close(); }
});

test("production home has content, canonical, social metadata and truthful site identity", async () => {
  const html = await readFile(path.join(root, "dist/index.html"), "utf8");
  assert.match(html, /<h1[^>]*>.*lista de compras/i);
  assert.match(html, /<title>Gondly: lista de compras/);
  assert.match(html, /rel="canonical" href="https:\/\/gondly\.com\.br\/"/);
  assert.match(html, /property="og:url" content="https:\/\/gondly\.com\.br\/"/);
  assert.match(html, /name="twitter:card"/);
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(data["@graph"].some(entry => entry["@type"] === "WebSite" && entry.name === "Gondly"));
  assert.ok(data["@graph"].some(entry => entry["@type"] === "Organization" && entry.url === "https://gondly.com.br/"));
  assert.doesNotMatch(JSON.stringify(data), /aggregateRating|reviewCount/);
  assert.equal((html.match(/<title>/g) ?? []).length, 1);
  const shell = await readFile(path.join(root, "dist/app-shell.html"), "utf8");
  assert.match(shell, /name="robots" content="noindex, follow"/);
  assert.match(shell, /<div id="root"><\/div>/);
  assert.doesNotMatch(shell, /rel="canonical"|application\/ld\+json/);
  for (const route of ["privacy", "terms", "contact"]) {
    const legal = await readFile(path.join(root, `dist/${route}/index.html`), "utf8");
    assert.match(legal, /<h1/);
    assert.ok(legal.includes(`rel="canonical" href="https://gondly.com.br/${route}"`));
  }
  const sitemap = await readFile(path.join(root, "dist/sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /app-shell|\/login|\/app\/|\/invite|\/shared/);
  const missing = await readFile(path.join(root, "dist/editorial-404.html"), "utf8");
  assert.match(missing, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(missing, /<script type="module"/);
});

test("both Vercel deployments distinguish private routes, public files and missing pages", async () => {
  for (const filename of [path.resolve(root, "../../vercel.json"), path.join(root, "vercel.json")]) {
    const { routes } = JSON.parse(await readFile(filename, "utf8"));
    const privateRule = routes.find(rule => rule.dest === "/app-shell.html");
    assert.ok(privateRule, "private requests must not receive the indexable landing");
    const pattern = new RegExp(privateRule.src);
    for (const route of ["/login", "/app/home", "/invite/token", "/shared/token", "/lists/123"]) assert.ok(pattern.test(route));
    for (const route of ["/", "/blog", "/guias/lista-de-compras", "/privacy", "/assets/main.js"]) assert.ok(!pattern.test(route));
    assert.equal(privateRule.headers["X-Robots-Tag"], "noindex, follow");
    const filesystemIndex = routes.findIndex(rule => rule.handle === "filesystem");
    const missingIndex = routes.findIndex(rule => rule.status === 404);
    assert.ok(filesystemIndex >= 0 && missingIndex > filesystemIndex);
    assert.equal(routes[missingIndex].dest, "/404.html");
  }
});
