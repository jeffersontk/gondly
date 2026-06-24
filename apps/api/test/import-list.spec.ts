import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListsService } from "../src/lists/lists.service";

describe("list document import", () => {
  it("creates missing products and list items in one transaction", async () => {
    const createdProducts: Array<Record<string, unknown>> = [];
    const createdItems: Array<Record<string, unknown>> = [];
    let productLookup = 0;
    let emittedCount = 0;

    const tx = {
      product: {
        findMany: async () => {
          productLookup += 1;
          return productLookup === 1
            ? [{ id: "product-arroz", name: "Arroz" }]
            : [
                { id: "product-arroz", name: "Arroz" },
                { id: "product-leite", name: "Leite UHT" },
              ];
        },
        createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
          createdProducts.push(...data);
          return { count: data.length };
        },
      },
      marketListItem: {
        createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
          createdItems.push(...data);
          return { count: data.length };
        },
      },
      marketList: {
        findUnique: async () => ({ id: "list-1", items: createdItems, members: [], invites: [] }),
      },
    };
    const prisma = {
      marketList: {
        findFirst: async () => ({
          id: "list-1",
          userId: "user-1",
          items: [],
          members: [],
          invites: [],
        }),
      },
      $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
    };
    const realtime = {
      emitToList: (_listId: string, event: string, payload: { count?: number }) => {
        if (event === "listItemsImported") emittedCount = payload.count ?? 0;
      },
    };
    const service = new ListsService(prisma as never, {} as never, realtime as never);

    await service.importItems("user-1", "list-1", {
      items: [
        { productName: "Arroz", category: "Mercearia", expectedQuantity: 2, unit: "kg" },
        { productName: "Leite UHT", category: "Laticínios & Frios", expectedQuantity: 6, unit: "l" },
      ],
    });

    assert.equal(createdProducts.length, 1);
    assert.equal(createdProducts[0].name, "Leite UHT");
    assert.equal(createdItems.length, 2);
    assert.equal(createdItems[0].productId, "product-arroz");
    assert.equal(createdItems[1].productId, "product-leite");
    assert.equal(createdItems[1].category, "Laticínios & Frios");
    assert.equal(emittedCount, 2);
  });
});
