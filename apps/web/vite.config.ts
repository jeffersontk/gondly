import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
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
  },
});
