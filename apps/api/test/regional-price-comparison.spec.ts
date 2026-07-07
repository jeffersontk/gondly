import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Unit } from "@prisma/client";
import { PriceComparisonService } from "../src/price-comparison/price-comparison.service";

type SharedRecord = {
  id: string;
  purchaseId?: string;
  userId?: string;
  marketId: string;
  marketNameSnapshot?: string | null;
  market?: { name: string };
  pricePaid: number;
  normalizedPrice: number | null;
  normalizedUnit: string | null;
  purchasedAt: Date;
  createdAt: Date;
};

function record(id: string, normalizedPrice: number, marketId = id): SharedRecord {
  const date = new Date("2026-07-01T12:00:00.000Z");
  return {
    id,
    purchaseId: `purchase-${id}`,
    userId: `user-${id}`,
    marketId,
    marketNameSnapshot: `Mercado ${marketId}`,
    market: { name: `Mercado ${marketId}` },
    pricePaid: normalizedPrice,
    normalizedPrice,
    normalizedUnit: "kg",
    purchasedAt: date,
    createdAt: date,
  };
}

function createService(responses: SharedRecord[][]) {
  const whereCalls: unknown[] = [];
  const prisma = {
    product: {
      findFirst: async () => null,
    },
    sharedPriceRecord: {
      findMany: async ({ where }: { where: unknown }) => {
        whereCalls.push(where);
        return responses.shift() ?? [];
      },
    },
  };

  return {
    service: new PriceComparisonService(prisma as never),
    whereCalls,
  };
}

function libraryRecord({
  productNameRaw = "Arroz Branco",
  normalizedProductName = "arroz branco",
  brandId = "brand-1",
  brandNameSnapshot = "Tio Joao",
  packageSize = 5,
  packageUnit = Unit.kg,
  categoryNameSnapshot = "Mercearia",
  marketId,
  normalizedPrice,
}: {
  productNameRaw?: string;
  normalizedProductName?: string;
  brandId?: string | null;
  brandNameSnapshot?: string | null;
  packageSize?: number | null;
  packageUnit?: Unit | null;
  categoryNameSnapshot?: string | null;
  marketId: string;
  normalizedPrice: number;
}) {
  const date = new Date("2026-07-01T12:00:00.000Z");
  return {
    id: marketId,
    productNameRaw,
    normalizedProductName,
    brandId,
    brandNameSnapshot,
    categoryId: null,
    categoryNameSnapshot,
    packageSize,
    packageUnit,
    marketId,
    marketNameSnapshot: `Mercado ${marketId}`,
    pricePaid: normalizedPrice,
    normalizedPrice,
    normalizedUnit: "kg",
    purchasedAt: date,
    createdAt: date,
    market: { name: `Mercado ${marketId}` },
  };
}

describe("PriceComparisonService.regional", () => {
  it("returns exact aggregate data and ignores an extreme outlier", async () => {
    const { service, whereCalls } = createService([
      [record("r1", 10, "m1"), record("r2", 11, "m2"), record("r3", 12, "m3"), record("outlier", 1000, "m4")],
    ]);

    const result = await service.regional("user-1", {
      productName: "Arroz Branco",
      brandId: "brand-1",
      unit: Unit.kg,
      packageSize: 5,
      packageUnit: Unit.kg,
      city: "Sao Paulo",
      state: "SP",
    });

    assert.equal(result?.comparisonLevel, "exact");
    assert.equal(result?.confidence, "high");
    assert.equal(result?.recordsCount, 3);
    assert.equal(result?.marketsCount, 3);
    assert.equal(result?.normalizedMinPrice, 10);
    assert.equal(result?.normalizedAvgPrice, 11);
    assert.equal(result?.normalizedUnit, "kg");
    assert.equal(result?.minPrice, 10);
    assert.equal(result?.avgPrice, 11);
    assert.equal(result?.medianPrice, 11);
    assert.equal(result?.maxPrice, 12);

    assert.deepEqual(whereCalls[0], {
      visibility: "shared",
      status: "valid",
      purchasedAt: { gte: (whereCalls[0] as { purchasedAt: { gte: Date } }).purchasedAt.gte },
      quantity: { gt: 0 },
      pricePaid: { gt: 0 },
      city: { equals: "Sao Paulo", mode: "insensitive" },
      state: { equals: "SP", mode: "insensitive" },
      normalizedUnit: "kg",
      normalizedPrice: { gt: 0 },
      normalizedProductName: "arroz branco",
      brandId: "brand-1",
      packageSize: 5,
      packageUnit: Unit.kg,
    });
  });

  it("falls back from exact to same_brand when exact has insufficient records", async () => {
    const { service } = createService([
      [record("r1", 10)],
      [record("r2", 10, "m1"), record("r3", 11, "m2"), record("r4", 12, "m3")],
    ]);

    const result = await service.regional("user-1", {
      productName: "Leite Integral",
      brandId: "brand-1",
      unit: Unit.l,
      packageSize: 1,
      packageUnit: Unit.l,
    });

    assert.equal(result?.comparisonLevel, "same_brand");
    assert.equal(result?.confidence, "medium");
    assert.equal(result?.recordsCount, 3);
  });

  it("separates similar products from the same brand comparison when brand is known", async () => {
    const { service, whereCalls } = createService([
      [],
      [],
      [record("r1", 9), record("r2", 10), record("r3", 11)],
    ]);

    const result = await service.regional("user-1", {
      productName: "Cafe Torrado",
      brandId: "brand-1",
      unit: Unit.kg,
      packageSize: 500,
      packageUnit: Unit.g,
    });

    assert.equal(result?.comparisonLevel, "similar_product");
    assert.deepEqual((whereCalls[2] as { OR: unknown }).OR, [{ brandId: { not: "brand-1" } }, { brandId: null }]);
  });

  it("returns null when the aggregate has fewer than three shared records", async () => {
    const { service } = createService([[record("r1", 10), record("r2", 11)]]);

    const result = await service.regional("user-1", {
      productName: "Feijao",
      unit: Unit.kg,
    });

    assert.equal(result, null);
  });

  it("estimates a completed purchase by market using regional item aggregates", async () => {
    const findManyCalls: unknown[] = [];
    const recordsByProduct = new Map([
      [
        "arroz branco",
        [
          record("rice-a", 8, "market-a"),
          record("rice-b", 9, "market-b"),
          record("rice-c", 10, "market-c"),
        ],
      ],
      [
        "feijao carioca",
        [
          record("bean-a", 7, "market-a"),
          record("bean-b", 9, "market-b"),
          record("bean-c", 8, "market-c"),
        ],
      ],
    ]);
    const purchaseDate = new Date("2026-07-02T12:00:00.000Z");
    const prisma = {
      purchase: {
        findFirst: async () => ({
          id: "purchase-1",
          userId: "user-1",
          status: "completed",
          marketId: "market-original",
          finalPaidAmount: 30,
          subtotalCalculated: 30,
          market: {
            id: "market-original",
            name: "Mercado Original",
            city: "Sao Paulo",
            state: "SP",
            neighborhood: "Centro",
            latitude: -23.55,
            longitude: -46.64,
          },
          items: [
            {
              id: "item-rice",
              productId: "product-rice",
              productName: "Arroz Branco",
              brand: null,
              brandId: "brand-1",
              brandNameSnapshot: "Tio Joao",
              packageSize: 5,
              packageUnit: Unit.kg,
              quantity: 2,
              unit: Unit.kg,
              pricePaid: 20,
              unitPriceNormalized: 10,
              product: { categoryId: "category-1" },
              createdAt: purchaseDate,
            },
            {
              id: "item-bean",
              productId: "product-bean",
              productName: "Feijao Carioca",
              brand: null,
              brandId: "brand-2",
              brandNameSnapshot: "Kicaldo",
              packageSize: 1,
              packageUnit: Unit.kg,
              quantity: 1,
              unit: Unit.kg,
              pricePaid: 10,
              unitPriceNormalized: 10,
              product: { categoryId: "category-1" },
              createdAt: purchaseDate,
            },
          ],
        }),
      },
      sharedPriceRecord: {
        findMany: async ({ where }: { where: { normalizedProductName?: string } }) => {
          findManyCalls.push(where);
          return recordsByProduct.get(where.normalizedProductName ?? "") ?? [];
        },
      },
    };
    const service = new PriceComparisonService(prisma as never);

    const result = await service.purchaseRegional("user-1", "purchase-1", { periodDays: 30 });

    assert.equal(result.comparableItemsCount, 2);
    assert.equal(result.totalItemsCount, 2);
    assert.equal(result.estimatedMarkets.length, 3);
    assert.deepEqual(result.estimatedMarkets[0], {
      marketId: "market-a",
      marketName: "Mercado market-a",
      estimatedTotal: 23,
      matchedItemsCount: 2,
      missingItemsCount: 0,
      estimatedSavings: 7,
      confidence: "high",
    });
    assert.equal(result.items[0].bestRegionalPrice, 8);
    assert.equal(result.items[0].avgRegionalPrice, 9);
    assert.equal(result.items[0].bestMarketName, "Mercado market-a");

    const firstWhere = findManyCalls[0] as { NOT: unknown };
    assert.deepEqual(firstWhere.NOT, [{ userId: "user-1" }, { purchaseId: "purchase-1" }, { marketId: "market-original" }]);
  });

  it("returns a regional price library with aggregate-only product data", async () => {
    let whereArg: unknown;
    let selectArg: Record<string, unknown> | undefined;
    const prisma = {
      sharedPriceRecord: {
        findMany: async ({ where, select }: { where: unknown; select: Record<string, unknown> }) => {
          whereArg = where;
          selectArg = select;
          return [
            libraryRecord({ marketId: "a", normalizedPrice: 24 }),
            libraryRecord({ marketId: "b", normalizedPrice: 28 }),
            libraryRecord({ marketId: "c", normalizedPrice: 32 }),
            libraryRecord({ productNameRaw: "Cafe", normalizedProductName: "cafe", brandId: null, brandNameSnapshot: null, packageSize: 500, packageUnit: Unit.g, marketId: "a", normalizedPrice: 20 }),
            libraryRecord({ productNameRaw: "Cafe", normalizedProductName: "cafe", brandId: null, brandNameSnapshot: null, packageSize: 500, packageUnit: Unit.g, marketId: "b", normalizedPrice: 21 }),
          ];
        },
      },
    };
    const service = new PriceComparisonService(prisma as never);

    const result = await service.priceLibrary({
      search: "arroz",
      city: "Sao Paulo",
      state: "SP",
      periodDays: 30,
      sort: "cheapest",
    });

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
      productName: "Arroz Branco",
      brandName: "Tio Joao",
      packageSize: 5,
      packageUnit: Unit.kg,
      categoryName: "Mercearia",
      minPrice: 24,
      avgPrice: 28,
      medianPrice: 28,
      normalizedMinPrice: 24,
      normalizedAvgPrice: 28,
      normalizedUnit: "kg",
      cheapestMarketName: "Mercado a",
      recordsCount: 3,
      marketsCount: 3,
      lastUpdatedAt: result[0].lastUpdatedAt,
      confidence: "low",
      reportableRecordId: "a",
      periodDays: 30,
    });
    assert.equal((selectArg as Record<string, unknown>).userId, undefined);
    assert.equal((whereArg as { visibility: string }).visibility, "shared");
    assert.equal((whereArg as { status: string }).status, "valid");
    assert.deepEqual((whereArg as { city: unknown; state: unknown }).city, { equals: "Sao Paulo", mode: "insensitive" });
    assert.deepEqual((whereArg as { city: unknown; state: unknown }).state, { equals: "SP", mode: "insensitive" });
  });
});
