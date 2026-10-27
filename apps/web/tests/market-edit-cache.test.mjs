import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("saving a market updates the edit form cache, list and summary without resetting purchase totals", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  const client = new QueryClient();
  try {
    const { updateMarketCaches, marketLocationLabel } = await server.ssrLoadModule("/src/lib/marketCache.ts");
    const original = { id: "market-1", name: "Guanabara", address: "Rua antiga, 1", neighborhood: "Campo Grande", city: "Rio de Janeiro", state: "RJ" };
    const saved = { ...original, address: "Rua nova, 123" };
    client.setQueryData(["market", original.id], original);
    client.setQueryData(["markets"], [original]);
    client.setQueryData(["market-summary", original.id], { market: original, totalSpent: 1060.81, purchaseCount: 1 });
    await updateMarketCaches(client, saved);
    assert.equal(client.getQueryData(["market", saved.id]).address, saved.address);
    assert.equal(client.getQueryData(["markets"])[0].address, saved.address);
    const summary = client.getQueryData(["market-summary", saved.id]);
    assert.equal(summary.market.address, saved.address);
    assert.equal(summary.totalSpent, 1060.81);
    assert.equal(summary.purchaseCount, 1);
    assert.equal(marketLocationLabel(saved), "Rua nova, 123 · Campo Grande · Rio de Janeiro · RJ");
    await updateMarketCaches(client, { ...saved, id: "new-market" });
    assert.equal(client.getQueryData(["market-summary", "new-market"]), undefined, "do not fabricate a zero-purchase summary");
  } finally { client.clear(); await server.close(); }
});
