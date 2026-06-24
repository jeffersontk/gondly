import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListsService } from "../src/lists/lists.service";

describe("list item availability state", () => {
  it("removes unavailable items from active purchases and restores pending items", async () => {
    const purchaseItems = [
      {
        id: "purchase-item-1",
        sourceListItemId: "list-item-1",
        productId: "product-1",
        productName: "Arroz",
      },
    ];
    const item = {
      id: "list-item-1",
      listId: "list-1",
      productId: "product-1",
      productName: "Arroz",
      brand: null,
      category: "Mercearia",
      expectedQuantity: 2,
      unit: "kg" as const,
      checked: false,
      status: "pending" as const,
      assignedToUserId: null,
      assignedAt: null,
      purchasedByUserId: null,
      purchasedAt: null,
      notes: null,
    };
    const prisma = {
      marketList: {
        findFirst: async () => ({ id: "list-1", userId: "user-1", items: [item], members: [], invites: [] }),
      },
      marketListItem: {
        findFirst: async () => item,
        update: async ({ data }: { data: { status: "pending" | "at_home" | "not_needed" } }) => ({
          ...item,
          status: data.status,
        }),
      },
      purchase: {
        findMany: async () => [{ id: "purchase-1", items: [...purchaseItems] }],
        update: async () => undefined,
      },
      purchaseItem: {
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          for (const id of where.id.in) {
            const index = purchaseItems.findIndex((entry) => entry.id === id);
            if (index >= 0) purchaseItems.splice(index, 1);
          }
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          purchaseItems.push({
            id: "purchase-item-restored",
            sourceListItemId: data.sourceListItemId as string,
            productId: data.productId as string,
            productName: data.productName as string,
          });
        },
        update: async () => undefined,
        aggregate: async () => ({ _sum: { pricePaid: 0 } }),
      },
    };
    const realtime = {
      emitToList: () => undefined,
      emitToPurchase: () => undefined,
    };
    const service = new ListsService(prisma as never, {} as never, realtime as never);

    await service.setItemState("user-1", "list-1", "list-item-1", "at_home");
    assert.equal(purchaseItems.length, 0);

    await service.setItemState("user-1", "list-1", "list-item-1", "pending");
    assert.equal(purchaseItems.length, 1);
    assert.equal(purchaseItems[0].sourceListItemId, "list-item-1");
  });
});
