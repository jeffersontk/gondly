import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { marketingMeta, siteIdentity } from "./metadata";

export function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    const meta = marketingMeta(path);
    const origin = new URL(import.meta.env.VITE_PUBLIC_SITE_URL || "https://gondly.com.br").origin;
    document.title = meta?.title ?? "Gondly";
    const setMeta = (key: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      const node = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`) ?? document.createElement("meta");
      node.setAttribute(attr, key);
      node.content = content;
      document.head.appendChild(node);
    };
    setMeta("robots", meta ? "index, follow" : "noindex, follow");
    setMeta("description", meta?.description ?? "Organize suas listas e compras com o Gondly.");
    document.head.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"]').forEach(node => node.remove());
    document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(node => node.remove());
    if (meta) {
      const canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = origin + path;
      document.head.appendChild(canonical);
      for (const [key, value] of Object.entries({ "og:title": meta.title, "og:description": meta.description, "og:url": origin + path, "og:type": "website", "og:site_name": "Gondly", "og:locale": "pt_BR", "og:image": `${origin}/gondly-logo-small.png` })) setMeta(key, value, true);
      setMeta("twitter:card", "summary");
      setMeta("twitter:title", meta.title);
      setMeta("twitter:description", meta.description);
      if (path === "/") {
        const identity = document.createElement("script");
        identity.type = "application/ld+json";
        identity.textContent = JSON.stringify(siteIdentity(origin));
        document.head.appendChild(identity);
      }
    }
  }, [pathname]);
  return null;
}
