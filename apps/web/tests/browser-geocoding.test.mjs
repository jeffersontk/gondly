import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("fills the region without a Google key using browser geocoding, preserving GPS radius", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { reverseGeocodeForComparison } = await server.ssrLoadModule("/src/pages/compare/browserGeocoding.ts");
    const { locateComparisonRegion, comparisonRegionParams } = await server.ssrLoadModule("/src/pages/compare/comparisonLocation.ts");
    const payload = { city: "Rio de Janeiro", locality: "Campo Grande", principalSubdivisionCode: "BR-RJ", countryCode: "BR" };
    let calls = 0;
    const fetcher = async (url, options) => {
      calls++;
      const query = new URL(url);
      assert.equal(query.hostname, "api.bigdatacloud.net");
      assert.equal(query.searchParams.get("latitude"), "-22.9");
      assert.equal(query.searchParams.get("localityLanguage"), "pt");
      assert.equal(options.credentials, "omit");
      return { ok: true, json: async () => payload };
    };
    const unavailableGoogle = async () => { throw new Error("GOOGLE_MAPPS_KEY not configured"); };
    const gps = { getCurrentPosition(resolve) { resolve({ coords: { latitude: -22.9, longitude: -43.2, accuracy: 117 } }); } };
    const result = await locateComparisonRegion(gps, location => reverseGeocodeForComparison(location, unavailableGoogle, fetcher));
    assert.deepEqual(result.region, { city: "Rio de Janeiro", state: "RJ", neighborhood: "Campo Grande" });
    assert.equal(result.regionResolved, true);
    assert.equal(calls, 1);
    assert.deepEqual(comparisonRegionParams(result.region, result.location, 5), { latitude: "-22.9", longitude: "-43.2", radiusKm: "5" });
    const known = await reverseGeocodeForComparison(result.location, async () => ({ city: "Rio", state: "RJ", neighborhood: "Centro" }), fetcher);
    assert.equal(known.neighborhood, "Centro");
    assert.equal(calls, 1, "do not contact fallback when configured provider succeeds");
    payload.locality = payload.city;
    const noNeighborhood = await reverseGeocodeForComparison(result.location, async () => ({ city: null, state: null, neighborhood: null }), fetcher);
    assert.equal(noNeighborhood.neighborhood, null, "city must not be copied into neighborhood");
    await assert.rejects(reverseGeocodeForComparison(result.location, unavailableGoogle, async () => ({ ok: false })), /regi/);
  } finally { await server.close(); }
});

test("uses the Brazilian municipality and neighborhood hierarchy instead of metropolitan labels", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { reverseGeocodeForComparison } = await server.ssrLoadModule("/src/pages/compare/browserGeocoding.ts");
    const payload = {
      city: "Região Metropolitana do Rio de Janeiro", locality: "Rio de Janeiro", countryCode: "BR", principalSubdivisionCode: "BR-RJ",
      localityInfo: { administrative: [
        { name: "Rio de Janeiro", adminLevel: 4 },
        { name: "Região Metropolitana do Rio de Janeiro", adminLevel: 6 },
        { name: "Rio de Janeiro", adminLevel: 8 },
        { name: "Campo Grande", adminLevel: 10 },
      ] },
    };
    const resolve = () => reverseGeocodeForComparison({ latitude: -22.9, longitude: -43.2, accuracy: 117 }, async () => { throw new Error("no Google key"); }, async () => ({ ok: true, json: async () => payload }));
    assert.deepEqual(await resolve(), { city: "Rio de Janeiro", state: "RJ", neighborhood: "Campo Grande" });
    payload.localityInfo.administrative.pop();
    assert.deepEqual(await resolve(), { city: "Rio de Janeiro", state: "RJ", neighborhood: null }, "municipality must never become neighborhood when details are absent");
    payload.localityInfo.administrative = [];
    assert.deepEqual(await resolve(), { city: "Rio de Janeiro", state: "RJ", neighborhood: null });
  } finally { await server.close(); }
});
