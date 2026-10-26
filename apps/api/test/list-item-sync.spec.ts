import assert from "node:assert/strict";
import { it } from "node:test";
import { ListsService } from "../src/lists/lists.service";

it("syncs an item added by a shared list editor into the ongoing purchase and notifies shoppers", async () => {
  const product = { id: "product-1", name: "Arroz", brandId: null, brand: null, category: null, packageSize: null, packageUnit: null };
  const item = { id: "list-item-1", listId: "list-1", productId: product.id, productName: product.name,
    brand: null, brandId: null, brandNameSnapshot: null, category: null, packageSize: null, packageUnit: null,
    expectedQuantity: 2, unit: "un" as const, status: "pending" as const };
  const purchaseItems: Array<Record<string, unknown>> = [];
  const events: Array<{ room: string; event: string }> = [];
  const prisma = {
    marketList: { findFirst: async () => ({ id: "list-1", userId: "owner-1", members: [
      { userId: "editor-1", role: "editor", status: "accepted" },
    ] }) },
    product: { findFirst: async () => product },
    marketListItem: { create: async () => item },
    purchase: {
      findMany: async () => [{ id: "purchase-1", items: [...purchaseItems] }],
      update: async () => undefined,
    },
    purchaseItem: {
      create: async ({ data }: { data: Record<string, unknown> }) => { purchaseItems.push(data); },
      aggregate: async () => ({ _sum: { pricePaid: 0 } }),
    },
  };
  const service = new ListsService(prisma as never, {} as never, {
    emitToList: (room: string, event: string) => events.push({ room, event }),
    emitToPurchase: (room: string, event: string) => events.push({ room, event }),
  } as never);

  const saved = await service.addItem("editor-1", "list-1", {
    productId: product.id, productName: product.name, expectedQuantity: 2, unit: "un",
  });

  assert.equal(saved.id, item.id);
  assert.equal(purchaseItems.length, 1, "the new list item must appear in the ongoing purchase");
  assert.equal(purchaseItems[0].sourceListItemId, item.id);
  assert.equal(purchaseItems[0].quantity, 2);
  assert.equal(purchaseItems[0].pricePaid, 0);
  assert.equal(purchaseItems[0].addedByUserId, "editor-1");
  assert.ok(events.some(({ room, event }) => room === "purchase-1" && event === "purchaseItemsSynced"));
  assert.ok(events.some(({ room, event }) => room === "list-1" && event === "listItemUpdated"));
});
