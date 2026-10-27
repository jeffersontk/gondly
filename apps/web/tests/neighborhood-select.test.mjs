import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("neighborhood select filters city/state, deduplicates names and preserves the GPS choice", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { neighborhoodOptions, NeighborhoodSelect } = await server.ssrLoadModule("/src/pages/compare/NeighborhoodSelect.tsx");
    const markets = [
      { city: "Rio de Janeiro", state: "RJ", neighborhood: "Centro" },
      { city: " RIO DE JANEIRO ", state: "rj", neighborhood: "centro" },
      { city: "Rio de Janeiro", state: "RJ", neighborhood: "Tijuca" },
      { city: "Rio de Janeiro", state: "SP", neighborhood: "Outro estado" },
      { city: "Niterói", state: "RJ", neighborhood: "Icaraí" },
    ];
    const options = neighborhoodOptions(markets, "Rio de Janeiro", "RJ", "Campo Grande");
    assert.deepEqual(options, ["Campo Grande", "Centro", "Tijuca"]);
    assert.deepEqual(neighborhoodOptions(markets, "", "", ""), []);
    const html = renderToStaticMarkup(createElement(NeighborhoodSelect, { markets, city: "Rio de Janeiro", state: "RJ", value: "Campo Grande", onChange() {} }));
    assert.match(html, /<select/);
    assert.match(html, /selected="">Campo Grande/);
    assert.match(html, /Todos os bairros/);
    assert.match(html, /Informar outro bairro/);
    assert.doesNotMatch(html, /Icaraí/);
  } finally { await server.close(); }
});
