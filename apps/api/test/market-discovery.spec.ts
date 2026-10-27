import "reflect-metadata";
import assert from "node:assert/strict";
import { it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { NearbyMarketQueryDto } from "../src/markets/dto";
import { MarketDiscoveryService } from "../src/markets/market-discovery.service";
import { MarketsService } from "../src/markets/markets.service";

it("discovers real shop coordinates, ignores unnamed/far shops and caches identical requests", async context => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    calls++;
    assert.equal(new URL(url).hostname, "overpass.private.coffee");
    assert.match(String(options.body), /supermarket/);
    return { ok: true, json: async () => ({ elements: [
      { type: "node", id: 1, lat: -22.901, lon: -43.201, tags: { name: "Mercado Sul", "addr:street": "Rua A", "addr:housenumber": "10", "addr:city": "Rio de Janeiro", "addr:state": "RJ" } },
      { type: "way", id: 2, center: { lat: -22.902, lon: -43.202 }, tags: { name: "Mercado Norte" } },
      { type: "node", id: 3, lat: -24, lon: -43.2, tags: { name: "Distante" } },
      { type: "node", id: 4, lat: -22.9, lon: -43.2, tags: {} },
    ] }) };
  });
  const service = new MarketDiscoveryService({ get: () => undefined } as never);
  const query = { latitude: -22.9, longitude: -43.2, radiusKm: 3 };
  const [first, second] = await Promise.all([service.discover(query), service.discover(query)]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.equal(first[0].placeId, "osm:node:1");
  assert.equal(first[0].address, "Rua A, 10");
  assert.equal(first[0].latitude, -22.901, "store coordinates must not be replaced by the user's GPS");
  assert.equal(first[1].placeId, "osm:way:2");
  assert.equal(first[1].address, undefined);
  await service.discover(query);
  assert.equal(calls, 1);
});

it("rejects missing and out-of-range discovery coordinates", async () => {
  for (const values of [{}, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: 0, longitude: 0, radiusKm: 100 }]) {
    assert.ok((await validate(plainToInstance(NearbyMarketQueryDto, values, { enableImplicitConversion: true }))).length);
  }
  assert.equal((await validate(plainToInstance(NearbyMarketQueryDto, { latitude: "0", longitude: "0", radiusKm: "3" }, { enableImplicitConversion: true }))).length, 0);
});

it("reuses an already saved map place instead of creating another market", async () => {
  const existing = { id: "existing", name: "Mercado Sul", placeId: "osm:node:1" };
  const service = new MarketsService({ market: {
    findFirst: async ({ where }: any) => {
      assert.equal(where.placeId, existing.placeId);
      assert.equal(where.createdByUserId, "me");
      return existing;
    },
    create: async () => { throw new Error("duplicate store"); },
  } } as never);
  assert.equal((await service.create("me", { name: existing.name, placeId: existing.placeId })).id, existing.id);
});

it("rejects another area promptly while a map request is in progress", async context => {
  let release!: (response: any) => void;
  let calls = 0;
  context.mock.method(globalThis, "fetch", () => { calls++; return new Promise(resolve => { release = resolve; }); });
  const service = new MarketDiscoveryService({ get: () => undefined } as never);
  const first = service.discover({ latitude: 0, longitude: 0 });
  try {
    await Promise.race([
      assert.rejects(service.discover({ latitude: 1, longitude: 1 }), (error: any) => error.getStatus() === 503),
      new Promise((_, reject) => setTimeout(() => reject(new Error("must not leave another lookup queued")), 100)),
    ]);
    assert.equal(calls, 1);
  } finally { release({ ok: true, json: async () => ({ elements: [] }) }); await first; }
});

it("allows retry after a provider failure without caching an error or holding the slot", async context => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 1 ? { ok: false } : { ok: true, json: async () => ({ elements: [] }) };
  });
  const service = new MarketDiscoveryService({ get: () => undefined } as never);
  await assert.rejects(service.discover({ latitude: 0, longitude: 0 }));
  assert.deepEqual(await service.discover({ latitude: 0, longitude: 0 }), []);
  assert.equal(calls, 2);
});
