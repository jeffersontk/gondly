import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { Unit } from "@prisma/client";
import { PurchasesService } from "../src/purchases/purchases.service";

function createService(items: Array<Record<string, unknown>> = [{ pricePaid: 10 }, { pricePaid: 5.5 }]) {
  const events: Array<{ room: string; event: string; payload: unknown }> = [];
  const sharedPriceCreateManyCalls: Array<{ data: Array<Record<string, unknown>> }> = [];
  const purchase = {
    id: "purchase-1",
    userId: "user-1",
    status: "in_progress",
    participants: [{ userId: "user-1" }],
    sourceList: null,
    items: [],
  };
  const prisma: Record<string, unknown> = {};
  Object.assign(prisma, {
    purchase: {
      findFirst: async () => purchase,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...purchase, ...data, items, market: { id: "market-1" } }),
    },
    purchaseItem: {
      findMany: async () => items,
    },
    market: {
      findFirst: async () => ({
        id: "market-1",
        name: "Mercado Central",
        userId: "user-1",
        city: "Sao Paulo",
        state: "SP",
        neighborhood: "Centro",
        latitude: -23.5489,
        longitude: -46.6388,
      }),
    },
    purchaseParticipant: {
      upsert: async () => undefined,
    },
    userPriceSharingPreference: {
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => ({
        userId: "user-1",
        sharePrices: update.sharePrices ?? create.sharePrices ?? false,
        shareLocationLevel: "city",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    sharedPriceRecord: {
      findMany: async () => [],
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        sharedPriceCreateManyCalls.push(args);
        return { count: args.data.length };
      },
      updateMany: async () => ({ count: 0 }),
    },
    $transaction: async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  });
  const realtime = {
    emitToPurchase: (room: string, event: string, payload: unknown) => events.push({ room, event, payload }),
  };

  return {
    service: new PurchasesService(prisma as never, {} as never, realtime as never),
    events,
    sharedPriceCreateManyCalls,
  };
}

describe("PurchasesService.finish", () => {
  it("calculates subtotal and discount inside the backend transaction", async () => {
    const { service, events } = createService();

    const result = await service.finish("user-1", "purchase-1", {
      marketId: "market-1",
      finalPaidAmount: 15,
    });

    assert.equal(result.status, "completed");
    assert.equal(result.subtotalCalculated, 15.5);
    assert.equal(result.discountAmount, 0.5);
    assert.equal(events[0].event, "purchaseTotalUpdated");
  });

  it("does not finish an empty purchase", async () => {
    const { service } = createService([]);

    await assert.rejects(
      () => service.finish("user-1", "purchase-1", { marketId: "market-1", finalPaidAmount: 0 }),
      BadRequestException,
    );
  });

  it("creates shared price records for valid items when sharing is enabled", async () => {
    const { service, sharedPriceCreateManyCalls } = createService([
      {
        id: "item-1",
        productId: "product-1",
        productName: "Arroz Branco",
        brandId: "brand-1",
        brandNameSnapshot: "Tio Joao",
        brand: null,
        category: "Mercearia",
        product: { categoryId: "category-1", category: "Mercearia" },
        packageSize: 5,
        packageUnit: Unit.kg,
        quantity: 2,
        unit: Unit.kg,
        pricePaid: 20,
      },
      {
        id: "item-zero",
        productName: "Feijao",
        quantity: 1,
        unit: Unit.kg,
        pricePaid: 0,
        product: null,
      },
      {
        id: "item-invalid-quantity",
        productName: "Cafe",
        quantity: 0,
        unit: Unit.un,
        pricePaid: 15,
        product: null,
      },
    ]);

    await service.finish("user-1", "purchase-1", {
      marketId: "market-1",
      finalPaidAmount: 35,
      sharePrices: true,
    });

    assert.equal(sharedPriceCreateManyCalls.length, 1);
    assert.equal(sharedPriceCreateManyCalls[0].data.length, 1);
    assert.deepEqual(sharedPriceCreateManyCalls[0].data[0], {
      userId: "user-1",
      purchaseId: "purchase-1",
      purchaseItemId: "item-1",
      marketId: "market-1",
      marketNameSnapshot: "Mercado Central",
      productId: "product-1",
      canonicalProductId: null,
      productNameRaw: "Arroz Branco",
      normalizedProductName: "arroz branco",
      brandId: "brand-1",
      brandNameSnapshot: "Tio Joao",
      categoryId: "category-1",
      categoryNameSnapshot: "Mercearia",
      quantity: 2,
      unit: Unit.kg,
      packageSize: 5,
      packageUnit: Unit.kg,
      pricePaid: 20,
      normalizedPrice: 10,
      normalizedUnit: "kg",
      purchasedAt: sharedPriceCreateManyCalls[0].data[0].purchasedAt,
      city: "Sao Paulo",
      state: "SP",
      neighborhood: null,
      latitudeApprox: -23.55,
      longitudeApprox: -46.64,
      visibility: "shared",
      status: "valid",
      qualityReason: null,
      confidenceScore: 1,
    });
  });

  it("does not create shared price records when sharing is disabled", async () => {
    const { service, sharedPriceCreateManyCalls } = createService([
      {
        id: "item-1",
        productName: "Arroz Branco",
        quantity: 1,
        unit: Unit.kg,
        pricePaid: 10,
        product: null,
      },
    ]);

    await service.finish("user-1", "purchase-1", {
      marketId: "market-1",
      finalPaidAmount: 10,
      sharePrices: false,
    });

    assert.equal(sharedPriceCreateManyCalls.length, 0);
  });
});
