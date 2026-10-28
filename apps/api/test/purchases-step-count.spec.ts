import assert from "node:assert/strict";
import { it } from "node:test";
import { PurchasesService } from "../src/purchases/purchases.service";

it("stores and clears optional stepCount in finish and update", async () => {
  let updatedData: any = null;
  const mockPurchase = {
    id: "purchase-123",
    userId: "user-1",
    sourceListId: null,
    status: "in_progress",
    items: [{ id: "item-1", pricePaid: 10, quantity: 1 }],
    participants: [{ userId: "user-1" }],
    sourceList: null,
  };

  const prismaMock: any = {};
  Object.assign(prismaMock, {
    purchase: {
      findFirst: async () => mockPurchase,
      update: async ({ data }: any) => {
        updatedData = data;
        return { ...mockPurchase, ...data, items: mockPurchase.items, market: { id: "market-1" } };
      },
    },
    purchaseItem: {
      findMany: async () => [{ id: "item-1", pricePaid: 10, quantity: 1, product: null }],
    },
    market: {
      findFirst: async () => ({ id: "market-1", name: "Mercado Teste", userId: "user-1" }),
    },
    purchaseParticipant: {
      upsert: async () => undefined,
    },
    $transaction: async (fn: any) => fn(prismaMock),
  });

  const realtime = {
    emitToPurchase: () => undefined,
  };

  const service = new PurchasesService(prismaMock as never, {} as never, realtime as never);

  // 1. Finish purchase with steps
  await service.finish("user-1", "purchase-123", {
    marketId: "market-1",
    finalPaidAmount: 10,
    stepCount: 1420,
  });

  assert.equal(updatedData.stepCount, 1420);
  assert.equal(updatedData.status, "completed");

  // 2. User chooses to clear / delete step count from historical purchase
  await service.update("user-1", "purchase-123", {
    stepCount: null,
  });

  assert.equal(updatedData.stepCount, null);
});
