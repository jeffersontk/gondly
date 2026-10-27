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

test("GPS resolves city, state and neighborhood for the form without changing radius search", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { locateComparisonRegion, comparisonRegionParams } = await server.ssrLoadModule("/src/pages/compare/comparisonLocation.ts");
    const gps = { getCurrentPosition(resolve) { resolve({ coords: { latitude: -22.9, longitude: -43.2, accuracy: 127 } }); } };
    const result = await locateComparisonRegion(gps, async location => {
      assert.equal(location.latitude, -22.9);
      return { city: "Rio de Janeiro", state: "RJ", neighborhood: "Campo Grande", country: "BR" };
    });
    assert.deepEqual(result.region, { city: "Rio de Janeiro", state: "RJ", neighborhood: "Campo Grande" });
    assert.equal(result.regionResolved, true);
    assert.deepEqual(comparisonRegionParams(result.region, result.location, 5), { latitude: "-22.9", longitude: "-43.2", radiusKm: "5" });
    const unavailable = await locateComparisonRegion(gps, async () => { throw new Error("provider unavailable"); });
    assert.equal(unavailable.location.accuracy, 127);
    assert.equal(unavailable.regionResolved, false);
    const empty = await locateComparisonRegion(gps, async () => ({ city: null, state: null, neighborhood: null }));
    assert.equal(empty.regionResolved, false, "empty reverse geocode is not a successful autofill");
  } finally { await server.close(); }
});
