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
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
try {
  const { renderPublic, pageMeta } = await server.ssrLoadModule(
    "/src/editorial/render.tsx",
  );
  for (const route of [...paths, "/404"]) {
    const meta = pageMeta(route);
    const head = `<title>${escape(meta.title)} | Gondly</title>\n<meta name="description" content="${escape(meta.description)}">\n${route === "/404" ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${escape(origin + route)}">`}\n<meta property="og:title" content="${escape(meta.title)}">\n<meta property="og:description" content="${escape(meta.description)}">\n${css.map((file) => `<link rel="stylesheet" href="/${file}">`).join("\n")}`;
    const html = template
      .replace(/<title>[\s\S]*?<\/title>/, "")
      .replace(/<meta name="description"[^>]*>/, "")
      .replace("</head>", `${head}\n</head>`)
      .replace(
        '<div id="root"></div>',
        `<div id="root">${renderPublic(route)}</div>`,
      );
    const filename =
      route === "/404"
        ? path.join(dist, "editorial-404.html")
        : path.join(dist, route.slice(1), "index.html");
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, html);
  }
  const all = ["/", ...paths, "/privacy", "/terms", "/contact"];
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
