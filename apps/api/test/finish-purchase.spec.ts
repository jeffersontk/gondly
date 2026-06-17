import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { PurchasesService } from "../src/purchases/purchases.service";

function createService(items: Array<{ pricePaid: number }> = [{ pricePaid: 10 }, { pricePaid: 5.5 }]) {
  const events: Array<{ room: string; event: string; payload: unknown }> = [];
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
      findFirst: async () => ({ id: "market-1", userId: "user-1" }),
    },
    purchaseParticipant: {
      upsert: async () => undefined,
    },
    $transaction: async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  });
  const realtime = {
    emitToPurchase: (room: string, event: string, payload: unknown) => events.push({ room, event, payload }),
  };

  return {
    service: new PurchasesService(prisma as never, {} as never, realtime as never),
    events,
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
});
