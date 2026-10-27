import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("matches store identity and protects other branches and other users' records", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { matchNearbyMarket, marketPlacePayload } = await server.ssrLoadModule("/src/pages/markets/nearbyMarketMatching.ts");
    const place = { placeId: "osm:node:1", name: "Supermercados Guanabara", latitude: -22.9, longitude: -43.2, address: "Rua A, 10", distanceKm: 0.1 };
    const selected = { id: "old-market", name: "Guanabara", createdByUserId: "me", latitude: null, longitude: null };
    assert.equal(matchNearbyMarket([selected], place, selected.id, "me").id, selected.id);
    assert.equal(matchNearbyMarket([{ ...selected, createdByUserId: "other" }], place, selected.id, "me"), undefined);
    assert.equal(matchNearbyMarket([{ ...selected, placeId: "osm:node:2" }], place, selected.id, "me"), undefined);
    assert.equal(matchNearbyMarket([{ ...selected, latitude: -24, longitude: -45 }], place, selected.id, "me"), undefined);
    assert.equal(matchNearbyMarket([{ ...selected, placeId: place.placeId }], place, "", "me").id, selected.id);
    assert.equal(marketPlacePayload(place).latitude, place.latitude);
    assert.equal("distanceKm" in marketPlacePayload(place), false);
  } finally { await server.close(); }
});
