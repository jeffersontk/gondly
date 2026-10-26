import assert from "node:assert/strict";
import { it } from "node:test";
import { ListsService } from "../src/lists/lists.service";

for (const pricePaid of [0, 18]) {
  it(`updates planned quantity without overwriting a cart item priced at ${pricePaid}`, async () => {
    const listItem = { id: "list-item-1", productId: null, productName: "Arroz", brand: null, brandId: null,
      brandNameSnapshot: null, category: null, packageSize: null, packageUnit: null,
      expectedQuantity: 2, unit: "un", status: "pending" };
    let cartItem = { id: "cart-item-1", sourceListItemId: listItem.id, productId: null, productName: "Arroz", quantity: 2, unit: "un", pricePaid };
    const events: string[] = [];
    const prisma = {
      marketList: { findFirst: async () => ({ id: "list-1", userId: "owner-1", members: [] }) },
      marketListItem: {
        findFirst: async () => listItem,
        update: async ({ data }: { data: Record<string, unknown> }) => ({ ...listItem, ...data }),
      },
      purchase: { findMany: async () => [{ id: "purchase-1", items: [cartItem] }], update: async () => undefined },
      purchaseItem: {
        updateMany: async ({ where, data }: { where: { id: string; pricePaid: number }; data: Record<string, unknown> }) => {
          if (cartItem.id === where.id && cartItem.pricePaid === where.pricePaid) cartItem = { ...cartItem, ...data };
        },
        aggregate: async () => ({ _sum: { pricePaid } }),
      },
    };
    const service = new ListsService(prisma as never, {} as never, {
      emitToList: (_id: string, event: string) => events.push(event),
      emitToPurchase: (_id: string, event: string) => events.push(event),
    } as never);
    const saved = await service.updateItem("owner-1", "list-1", listItem.id, { expectedQuantity: 0.75, unit: "kg" });
    assert.equal(saved.expectedQuantity, 0.75);
    assert.equal(cartItem.quantity, pricePaid === 0 ? 0.75 : 2);
    assert.equal(cartItem.unit, pricePaid === 0 ? "kg" : "un");
    assert.equal(cartItem.pricePaid, pricePaid);
    assert.ok(events.includes("listItemUpdated"));
    assert.ok(events.includes("purchaseItemsSynced"));
  });
}
