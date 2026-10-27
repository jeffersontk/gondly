import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("GPS requests send the radius and coordinates, manual regions never pretend to use a radius", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { comparisonRegionParams, requestComparisonLocation } = await server.ssrLoadModule("/src/pages/compare/comparisonLocation.ts");
    assert.deepEqual(comparisonRegionParams({ city: "Rio", state: "RJ", neighborhood: "Centro" }, null, 5), { city: "Rio", state: "RJ", neighborhood: "Centro" });
    assert.deepEqual(comparisonRegionParams({ city: "Rio", state: "RJ", neighborhood: "Centro" }, { latitude: 0, longitude: -43 }, 2), { latitude: "0", longitude: "-43", radiusKm: "2" });
    const location = await requestComparisonLocation({ getCurrentPosition(resolve, reject, options) {
      assert.equal(options.enableHighAccuracy, true);
      assert.equal(options.maximumAge, 0);
      resolve({ coords: { latitude: -22.9, longitude: -43.2, accuracy: 30 } });
    } });
    assert.equal(location.latitude, -22.9);
    assert.equal(location.accuracy, 30);
  } finally { await server.close(); }
});
