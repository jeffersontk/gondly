import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import { createServer, loadEnv } from "vite";
import { publicPaths } from "../src/editorial/catalog.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
const readJson = async (file) =>
  JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
const content = await readJson(path.join(root, "src/editorial/content.json"));
if (content.some((article) => article.status !== "published"))
  throw new Error("Mantenha rascunhos em drafts.json, nunca em content.json");
const paths = publicPaths(content);
const env = loadEnv("production", root, "VITE_");
const origin = new URL(
  process.env.VITE_PUBLIC_SITE_URL ||
    env.VITE_PUBLIC_SITE_URL ||
    "https://gondly.com.br",
).origin;
if (!origin.startsWith("https://"))
  throw new Error("VITE_PUBLIC_SITE_URL precisa usar HTTPS no build público");
const template = await readFile(path.join(dist, "index.html"), "utf8");
const manifest = await readJson(path.join(dist, ".vite/manifest.json"));
const css =
  Object.values(manifest).find(
    (entry) => entry.src === "src/editorial/public-main.tsx",
  )?.css ?? [];
const escape = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
try {
  const { renderMarketingPage } = await server.ssrLoadModule("/src/seo/render.tsx");
  const { marketingPaths, marketingMeta, siteIdentity } = await server.ssrLoadModule("/src/seo/metadata.ts");
  // Preserve an empty, non-indexable entry for authenticated routes before rendering the home.
  await writeFile(path.join(dist, "app-shell.html"), template.replace("</head>", '<meta name="robots" content="noindex, follow">\n</head>'));
  const socialHead = (title, description, route) => `
<meta property="og:type" content="website">
<meta property="og:site_name" content="Gondly">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(origin + route)}">
<meta property="og:image" content="${escape(origin)}/gondly-logo-small.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">`;
  for (const route of marketingPaths) {
    const meta = marketingMeta(route);
    const structured = route === "/" ? `<script type="application/ld+json">${JSON.stringify(siteIdentity(origin)).replaceAll("<", "\\u003c")}</script>` : "";
    const head = `<title>${escape(meta.title)}</title>
<meta name="description" content="${escape(meta.description)}">
<link rel="canonical" href="${escape(origin + route)}">
${socialHead(meta.title, meta.description, route)}
${structured}`;
    const html = template.replace(/<title>[\s\S]*?<\/title>/, "")
      .replace(/<meta name="description"[^>]*>/, "")
      .replace("</head>", `${head}\n</head>`)
      .replace('<div id="root"></div>', `<div id="root">${renderMarketingPage(route, process.env.VITE_GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID)}</div>`);
    const filename = route === "/" ? path.join(dist, "index.html") : path.join(dist, route.slice(1), "index.html");
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, html);
  }
  const { renderPublic, pageMeta } = await server.ssrLoadModule(
    "/src/editorial/render.tsx",
  );
  for (const route of [...paths, "/404"]) {
    const meta = pageMeta(route);
    const head = `<title>${escape(meta.title)} | Gondly</title>\n<meta name="description" content="${escape(meta.description)}">\n${route === "/404" ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${escape(origin + route)}">`}\n${css.map((file) => `<link rel="stylesheet" href="/${file}">`).join("\n")}`;
    let html = template
      .replace(/<title>[\s\S]*?<\/title>/, "")
      .replace(/<meta name="description"[^>]*>/, "")
      .replace("</head>", `${head}\n${route === "/404" ? "" : socialHead(`${meta.title} | Gondly`, meta.description, route)}\n</head>`)
      .replace(
        '<div id="root"></div>',
        `<div id="root">${renderPublic(route)}</div>`,
      );
    if (route === "/404") {
      // Unknown paths must keep the 404 content instead of booting the app's redirect.
      html = html.replace(/<script type="module"[^>]*><\/script>/g, "");
      await writeFile(path.join(dist, "404.html"), html);
    }
    const filename =
      route === "/404"
        ? path.join(dist, "editorial-404.html")
        : path.join(dist, route.slice(1), "index.html");
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, html);
  }
  const all = [...marketingPaths, ...paths];
  await writeFile(
    path.join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${all.map((route) => `<url><loc>${escape(origin + route)}</loc></url>`).join("")}</urlset>\n`,
  );
  await writeFile(
    path.join(dist, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
  );
  const ads = await readFile(path.join(dist, "ads.txt"), "utf8");
  if (!/^google\.com, pub-\d+, DIRECT, f08c47fec0942fa0\s*$/.test(ads.trim()))
    throw new Error("ads.txt inválido");
  // New asset URLs must install a new offline shell on every changed build.
  const revision = createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex")
    .slice(0, 12);
  const worker = await readFile(path.join(root, "public/sw.js"), "utf8");
  await writeFile(
    path.join(dist, "sw.js"),
    worker.replace('"gondly-cache-v5"', `"gondly-cache-v5-${revision}"`),
  );
  console.log(
    `Editorial: ${paths.length} páginas públicas geradas; rascunhos excluídos.`,
  );
} finally {
  await server.close();
}
