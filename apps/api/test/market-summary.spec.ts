import assert from "node:assert/strict";
import { it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { MarketsService } from "../src/markets/markets.service";

it("counts a completed shared purchase at its market with the final paid amount", async () => {
  const market = { id: "guanabara", name: "Guanabara", createdByUserId: "viewer" };
  const purchase = { id: "shared-purchase", userId: "other-owner", marketId: market.id, status: "completed", deletedAt: null,
    finalPaidAmount: 1060.81, subtotalCalculated: 1100, items: [
      { productName: "Arroz", quantity: 3, pricePaid: 30 },
      { productName: "Feijão não comprado", quantity: 100, pricePaid: 0 },
    ] };
  let purchaseScope: Record<string, unknown> | undefined;
  const service = new MarketsService({
    market: { findFirst: async () => market },
    purchase: { findMany: async ({ where }: { where: Record<string, unknown> }) => {
      purchaseScope = where;
      return where.userId ? [] : where.OR ? [purchase] : [];
    } },
  } as never);
  const result = await service.summary("viewer", market.id);
  assert.equal(result.totalSpent, 1060.81);
  assert.equal(result.purchaseCount, 1);
  assert.equal(result.averageTicket, 1060.81);
  assert.equal(result.lastPurchase?.id, purchase.id);
  assert.equal(result.topProduct, "Arroz", "planned items must not count as purchased products");
  assert.equal(purchaseScope?.marketId, market.id);
  assert.equal(purchaseScope?.status, "completed");
  assert.equal(purchaseScope?.deletedAt, null);
  assert.equal(purchaseScope?.userId, undefined);
  assert.deepEqual(purchaseScope?.OR, [
    { userId: "viewer" },
    { sourceList: { members: { some: { userId: "viewer", status: "accepted" } } } },
    { participants: { some: { userId: "viewer" } }, OR: [{ sourceListId: null }, { status: { not: "in_progress" } }] },
  ]);
});

it("does not expose summaries of markets the user cannot access", async () => {
  let queriedPurchases = false;
  const service = new MarketsService({
    market: { findFirst: async () => null },
    purchase: { findMany: async () => { queriedPurchases = true; return []; } },
  } as never);
  await assert.rejects(() => service.summary("intruder", "private-market"), NotFoundException);
  assert.equal(queriedPurchases, false);
});
