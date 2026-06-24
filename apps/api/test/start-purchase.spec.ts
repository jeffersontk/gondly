import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PurchasesService } from "../src/purchases/purchases.service";

describe("PurchasesService.start", () => {
  it("creates the purchase and all imported items in one nested write", async () => {
    const importedItems = Array.from({ length: 174 }, (_, index) => ({
      id: `list-item-${index}`,
      productId: `product-${index}`,
      productName: `Produto ${index}`,
      brand: null,
      category: "Mercearia",
      expectedQuantity: 1,
      unit: "un" as const,
      status: "pending",
    }));
    let createArgs: Record<string, unknown> | undefined;
    let transactionCalled = false;
    const prisma = {
      purchase: {
        findFirst: async () => null,
        create: async (args: Record<string, unknown>) => {
          createArgs = args;
          return { id: "purchase-1", items: importedItems };
        },
      },
      $transaction: async () => {
        transactionCalled = true;
        throw new Error("start must not use an interactive transaction");
      },
    };
    const listsService = {
      get: async () => ({ id: "list-1", items: importedItems }),
    };
    const service = new PurchasesService(prisma as never, listsService as never, {} as never);

    const result = await service.start("user-1", { sourceListId: "list-1" });

    assert.equal(result.id, "purchase-1");
    assert.equal(transactionCalled, false);
    const data = createArgs?.data as {
      participants: { create: { userId: string } };
      items: { createMany: { data: unknown[] } };
    };
    assert.equal(data.participants.create.userId, "user-1");
    assert.equal(data.items.createMany.data.length, 174);
  });
});
