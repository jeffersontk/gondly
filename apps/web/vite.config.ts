import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  plugins: [react()],
  // SSR test servers must never evict the dependency files used by a running browser.
  cacheDir: process.env.NODE_TEST_CONTEXT ? join(tmpdir(), "gondly-vite-tests", String(process.pid)) : "node_modules/.vite",
  optimizeDeps: {
    noDiscovery: Boolean(process.env.NODE_TEST_CONTEXT),
    // PDF.js already ships browser ESM. Serving it directly avoids stale lazy-import URLs.
    exclude: ["pdfjs-dist"],
    include: process.env.NODE_TEST_CONTEXT ? [] : ["mammoth"],
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          const isPackage = (dependency: string) => normalizedId.includes(`/node_modules/${dependency}/`);
          if (normalizedId.includes("preload-helper")) return "preload-helper";
          if (!normalizedId.includes("node_modules")) return;

          if (
            [
              "mammoth",
              "@xmldom/xmldom",
              "argparse",
              "base64-js",
              "bluebird",
              "dingbat-to-unicode",
              "jszip",
              "lop",
              "path-is-absolute",
              "underscore",
              "xmlbuilder",
            ].some(isPackage)
          ) {
            return "mammoth";
          }
          if (["react", "react-dom", "react-router", "react-router-dom", "scheduler"].some(isPackage)) return "react-vendor";
          if (isPackage("@tanstack/react-query")) return "query-vendor";
          if (["socket.io-client", "engine.io-client", "socket.io-parser", "engine.io-parser"].some(isPackage)) return "realtime-vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/receitas": { target: "http://127.0.0.1:3333", rewrite: path => path.replace(/^\/receitas/, "/public-recipe-pages") },
      "/sitemap-recipes.xml": { target: "http://127.0.0.1:3333", rewrite: () => "/public-recipe-pages/sitemap.xml" },
    },
  },
});
