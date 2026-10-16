import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RealtimeService } from "../src/realtime/realtime.service";

describe("RealtimeService events", () => {
  it("adds the standard envelope to list item events without removing the legacy payload", () => {
    const service = new RealtimeService();
    const item = { id: "item-1", productName: "Arroz", updatedAt: new Date("2026-07-02T10:00:00.000Z") };

    const event = service.buildEventPayload("listItemUpdated", {
      listId: "list-1",
      item,
      action: "state_changed",
      byUserId: "user-1",
    }) as Record<string, unknown>;

    assert.equal(typeof event.eventId, "string");
    assert.equal(event.entityType, "listItem");
    assert.equal(event.entityId, "item-1");
    assert.equal(event.action, "state_changed");
    assert.equal(event.updatedAt, "2026-07-02T10:00:00.000Z");
    assert.equal(event.actorUserId, "user-1");
    assert.equal(event.listId, "list-1");
    assert.equal(event.item, item);
    assert.deepEqual(event.payload, { listId: "list-1", item, action: "state_changed", byUserId: "user-1" });
  });

  it("infers purchase item delete metadata from itemId", () => {
    const service = new RealtimeService();

    const event = service.buildEventPayload("purchaseItemDeleted", {
      purchaseId: "purchase-1",
      itemId: "item-1",
      byUserId: "user-1",
    }) as Record<string, unknown>;

    assert.equal(typeof event.eventId, "string");
    assert.equal(event.entityType, "purchaseItem");
    assert.equal(event.entityId, "item-1");
    assert.equal(event.action, "deleted");
    assert.equal(typeof event.updatedAt, "string");
    assert.equal(event.actorUserId, "user-1");
    assert.equal(event.purchaseId, "purchase-1");
    assert.equal(event.itemId, "item-1");
  });

  it("adds the actor name to server events and keeps their order", async () => {
    let lookups = 0;
    const prisma = {
      user: {
        findUnique: async () => {
          lookups += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { name: "Ana" };
        },
      },
    };
    const emitted: Array<{ event: string; payload: Record<string, unknown> }> = [];
    const service = new RealtimeService(prisma as never);
    service.bindServer({ to: () => ({ emit: (event: string, payload: Record<string, unknown>) => emitted.push({ event, payload }) }) } as never);

    service.emitToPurchase("purchase-1", "purchaseItemCreated", { purchaseId: "purchase-1", item: { id: "item-1" }, byUserId: "user-1" });
    service.emitToPurchase("purchase-1", "purchaseTotalUpdated", { purchaseId: "purchase-1", subtotalCalculated: 10, byUserId: "user-1" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.deepEqual(emitted.map((entry) => entry.event), ["purchaseItemCreated", "purchaseTotalUpdated"]);
    assert.deepEqual(emitted[0].payload.by, { userId: "user-1", name: "Ana" });
    assert.equal(lookups, 1);
  });
});
