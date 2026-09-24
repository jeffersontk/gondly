import { createRoot, hydrateRoot } from "react-dom/client";
import { PublicSite, articles, pageMeta } from "./PublicSite";
import type { Article } from "./types";
import "./editorial.css";

async function start() {
  const params = new URLSearchParams(location.search);
  const preview = import.meta.env.DEV && params.get("preview") === "1";
  let items = articles;
  if (import.meta.env.DEV && preview) {
    const drafts = await import("./drafts.json");
    items = [...articles, ...(drafts.default as Article[])];
  }
  const path = location.pathname.replace(/\/$/, "") || "/";
  const meta = pageMeta(path, items);
  document.title = `${preview ? "[Prévia] " : ""}${meta.title} | Gondly`;
  if (preview || !meta.found) {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
  }
  const node = document.getElementById("root")!;
  const category = params.get("categoria") ?? "Todas";
  const render = (
    <PublicSite
      path={path}
      items={items}
      preview={preview}
      category={category}
    />
  );
  // Filtered views have a different tree from the canonical static HTML.
  if (node.hasChildNodes() && !preview && category === "Todas")
    hydrateRoot(node, render);
  else createRoot(node).render(render);
}
void start();
