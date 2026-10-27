import "reflect-metadata";
import assert from "node:assert/strict";
import { it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PriceLibraryQueryDto } from "../src/price-comparison/dto";
import { PriceComparisonService } from "../src/price-comparison/price-comparison.service";

it("accepts browser coordinates and rejects incomplete or invalid radius filters", async () => {
  const options = { enableImplicitConversion: true };
  assert.equal((await validate(plainToInstance(PriceLibraryQueryDto, { latitude: "-22.9", longitude: "-43.2", radiusKm: "5" }, options), { whitelist: true, forbidNonWhitelisted: true })).length, 0);
  for (const values of [{ latitude: -22 }, { radiusKm: 5 }, { latitude: 91, longitude: 0, radiusKm: 5 }]) {
    assert.ok((await validate(plainToInstance(PriceLibraryQueryDto, values, options))).length);
  }
});

it("excludes stores outside the circular radius and records without coordinates", async () => {
  const records = [
    { marketId: "near", latitudeApprox: -22.91, longitudeApprox: -43.21 },
    { marketId: "corner", latitudeApprox: -22.94, longitudeApprox: -43.24 },
    { marketId: "unknown", latitudeApprox: null, longitudeApprox: null },
  ].map(value => ({ ...value, pricePaid: 10, normalizedPrice: 10, normalizedUnit: "kg", purchasedAt: new Date(), createdAt: new Date() }));
  const service = new PriceComparisonService({ sharedPriceRecord: { findMany: async () => records } } as never);
  const result = await service.priceLibraryMarkets({ productName: "Arroz", latitude: -22.9, longitude: -43.2, radiusKm: 5 });
  assert.deepEqual(result.map(value => value.marketId), ["near"]);
});

it("applies the same distance filter to product aggregates and market details", async () => {
  const calls: any[] = [];
  const service = new PriceComparisonService({ sharedPriceRecord: { findMany: async (args: any) => { calls.push(args); return []; } } } as never);
  const query = { latitude: -22.9, longitude: -43.2, radiusKm: 5, city: "Rio de Janeiro", neighborhood: "Centro" };
  await service.priceLibrary(query);
  await service.priceLibraryMarkets({ ...query, productName: "Arroz" });
  for (const call of calls) {
    assert.ok(call.where.latitudeApprox?.gte < -22.9);
    assert.ok(call.where.longitudeApprox?.lte > -43.2);
    assert.equal(call.where.neighborhood, undefined, "nearby stores across neighborhood boundaries must remain eligible");
    assert.equal(call.where.city, undefined);
  }
});

it("continues reading when the first page contains only stores outside the circle", async () => {
  const makeRecord = (marketId: string, latitudeApprox: number, longitudeApprox: number) => ({ marketId, latitudeApprox, longitudeApprox, pricePaid: 10, normalizedPrice: 10, normalizedUnit: "kg", purchasedAt: new Date(), createdAt: new Date() });
  const records = [...Array.from({ length: 500 }, (_, index) => makeRecord(`corner-${index}`, -22.94, -43.24)), makeRecord("near", -22.91, -43.21)];
  const service = new PriceComparisonService({ sharedPriceRecord: { findMany: async ({ skip = 0, take }: { skip?: number; take: number }) => records.slice(skip, skip + take) } } as never);
  const result = await service.priceLibraryMarkets({ productName: "Arroz", latitude: -22.9, longitude: -43.2, radiusKm: 5 });
  assert.deepEqual(result.map(value => value.marketId), ["near"]);
});
