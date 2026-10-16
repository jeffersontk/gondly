import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { purchaseAccessWhere } from "../src/purchases/purchase-access";
import { PurchasesService } from "../src/purchases/purchases.service";

function sharedPurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: "purchase-1",
    userId: "owner-1",
    status: "in_progress",
    sourceListId: "list-1",
    subtotalCalculated: 0,
    items: [],
    market: null,
    participants: [{ userId: "owner-1" }],
    sourceList: {
      id: "list-1",
      userId: "owner-1",
      members: [
        { userId: "owner-1", role: "owner", status: "accepted" },
        { userId: "guest-1", role: "editor", status: "accepted" },
      ],
    },
    ...overrides,
  };
}

const realtime = { emitToPurchase: () => undefined, emitToList: () => undefined };

describe("shared list purchases", () => {
  it("joins the purchase already open for the list instead of creating a parallel one", async () => {
    const purchase = sharedPurchase();
    let created = false;
    let participantUserId: string | undefined;
    const prisma = {
      purchase: {
        findFirst: async (args: { where: { userId?: string } }) => (args.where.userId ? null : purchase),
        create: async () => {
          created = true;
          return purchase;
        },
      },
      purchaseParticipant: {
        upsert: async (args: { create: { userId: string } }) => {
          participantUserId = args.create.userId;
          purchase.participants.push({ userId: args.create.userId });
        },
      },
    };
    const listsService = { get: async () => ({ id: "list-1", items: [] }) };
    const service = new PurchasesService(prisma as never, listsService as never, realtime as never);

    const result = await service.start("guest-1", { sourceListId: "list-1" });

    assert.equal(result.id, "purchase-1");
    assert.equal(created, false);
    assert.equal(participantUserId, "guest-1");
  });

  it("lets a guest put a list item that references the owner's product in the cart", async () => {
    const purchase = sharedPurchase({ participants: [{ userId: "owner-1" }, { userId: "guest-1" }] });
    let productWhere: { userId?: { in: string[] } } | undefined;
    const prisma = {
      purchase: {
        findFirst: async () => purchase,
        update: async () => ({ ...purchase, updatedAt: new Date() }),
      },
      purchaseItem: {
        findFirst: async () => ({ id: "item-1", purchaseId: "purchase-1", productId: "owner-product", productName: "Arroz", quantity: 1, unit: "un", pricePaid: 0 }),
        update: async ({ data }: { data: Record<string, unknown> }) => ({ id: "item-1", ...data }),
        findMany: async () => [{ pricePaid: 25 }],
      },
      product: {
        findFirst: async (args: { where: { userId?: { in: string[] } } }) => {
          productWhere = args.where;
          return { id: "owner-product", name: "Arroz", brandId: null, brand: null, category: "Mercearia", packageSize: null, packageUnit: null };
        },
      },
    };
    const service = new PurchasesService(prisma as never, {} as never, realtime as never);

    await service.updateItem("guest-1", "purchase-1", "item-1", {
      productId: "owner-product",
      productName: "Arroz",
      quantity: 1,
      unit: "un",
      pricePaid: 25,
    } as never);

    assert.ok(productWhere?.userId?.in.includes("owner-1"));
    assert.ok(productWhere?.userId?.in.includes("guest-1"));
  });

  it("lets a guest editor cancel the shared purchase and notifies the other participants", async () => {
    const purchase = sharedPurchase({ participants: [{ userId: "owner-1" }, { userId: "guest-1" }] });
    const events: Array<{ event: string; payload: { status?: string; byUserId?: string } }> = [];
    const prisma = {
      purchase: {
        findFirst: async () => purchase,
        update: async ({ data }: { data: { status: string } }) => ({ ...purchase, ...data }),
      },
    };
    const service = new PurchasesService(prisma as never, {} as never, {
      emitToPurchase: (_id: string, event: string, payload: { status?: string; byUserId?: string }) => events.push({ event, payload }),
    } as never);

    const cancelled = await service.cancel("guest-1", "purchase-1");

    assert.equal(cancelled.status, "cancelled");
    assert.deepEqual(events.map(({ event, payload }) => [event, payload.status, payload.byUserId]), [["purchaseTotalUpdated", "cancelled", "guest-1"]]);
  });

  it("lets a participant claim an item and blocks a second claim from someone else", async () => {
    const purchase = sharedPurchase({ participants: [{ userId: "owner-1" }, { userId: "guest-1" }] });
    let item: Record<string, unknown> = { id: "item-1", purchaseId: "purchase-1", productName: "Café", claimedByUserId: null };
    const events: string[] = [];
    const prisma = {
      purchase: {
        findFirst: async () => purchase,
        findUniqueOrThrow: async () => ({ ...purchase, updatedAt: new Date() }),
      },
      purchaseItem: {
        findFirst: async () => item,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          item = { ...item, ...data };
          return item;
        },
      },
    };
    const service = new PurchasesService(prisma as never, {} as never, {
      emitToPurchase: (_id: string, event: string, payload: { action?: string }) => events.push(`${event}:${payload.action}`),
      emitToList: () => undefined,
    } as never);

    await service.claimItem("guest-1", "purchase-1", "item-1", true);
    assert.equal(item.claimedByUserId, "guest-1");
    assert.deepEqual(events, ["purchaseItemUpdated:claimed"]);

    await assert.rejects(() => service.claimItem("owner-1", "purchase-1", "item-1", true), ConflictException);

    await service.claimItem("guest-1", "purchase-1", "item-1", false);
    assert.equal(item.claimedByUserId, null);
  });

  it("only grants past participants access to list purchases that already ended", () => {
    const where = purchaseAccessWhere("guest-1");

    assert.deepEqual(where.OR, [
      { userId: "guest-1" },
      { sourceList: { members: { some: { userId: "guest-1", status: "accepted" } } } },
      {
        participants: { some: { userId: "guest-1" } },
        OR: [{ sourceListId: null }, { status: { not: "in_progress" } }],
      },
    ]);
  });

  it("blocks edits from a member removed from the list even if they joined the purchase before", async () => {
    const purchase = sharedPurchase({
      participants: [{ userId: "owner-1" }, { userId: "guest-1" }],
      sourceList: {
        id: "list-1",
        userId: "owner-1",
        members: [
          { userId: "owner-1", role: "owner", status: "accepted" },
          { userId: "guest-1", role: "editor", status: "removed" },
        ],
      },
    });
    const prisma = { purchase: { findFirst: async () => purchase } };
    const service = new PurchasesService(prisma as never, {} as never, realtime as never);

    await assert.rejects(
      () => service.addItem("guest-1", "purchase-1", { productName: "Leite", quantity: 1, unit: "un", pricePaid: 5 } as never),
      ForbiddenException,
    );
  });
});
