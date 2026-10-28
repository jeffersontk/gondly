import assert from "node:assert/strict";
import { it } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { calculatePurchaseBudget } from "../src/purchases/purchase-budget";
import { PurchasesService } from "../src/purchases/purchases.service";

const item = (overrides: Record<string, unknown> = {}) => ({ id: "item-1", productId: "product-1", productName: "Arroz", brand: "Marca A", brandId: "brand-a", packageSize: 5, packageUnit: "kg", quantity: 2.5, unit: "kg", pricePaid: 0, ...overrides });
const reference = (overrides: Record<string, unknown> = {}) => ({ ...item({ quantity: 1, pricePaid: 10 }), purchase: { completedAt: new Date("2026-10-01T12:00:00Z"), market: { name: "Mercado" } }, ...overrides });

it("estimates only compatible remaining items, counts unknown prices and warns without blocking", () => {
  const purchase = { budgetAmount: 40, status: "in_progress", subtotalCalculated: 20, items: [item(), item({ id: "unknown", productId: "other" })] };
  const result = calculatePurchaseBudget(purchase as never, [reference({ packageSize: 1, pricePaid: 1 }), reference({ brandId: "brand-b", pricePaid: 2 }), reference()] as never);
  assert.equal(result.confirmedAmount, 20);
  assert.equal(result.estimatedRemaining, 25);
  assert.equal(result.estimatedTotal, 45);
  assert.equal(result.unknownItemsCount, 1);
  assert.equal(result.estimatedBalance, null, "a partial estimate must not imply all items fit in budget");
  assert.equal(result.exceeded, true);
  assert.equal(result.references[0].marketName, "Mercado");
  assert.equal(result.references[0].referenceAt, "2026-10-01T12:00:00.000Z");
  assert.equal(result.references[1].estimate, null);
});

it("completed purchases use the final paid amount after discounts and do not estimate unbought items", () => {
  const result = calculatePurchaseBudget({ budgetAmount: 100, status: "completed", subtotalCalculated: 100, finalPaidAmount: 90, items: [item()] } as never, []);
  assert.equal(result.confirmedAmount, 90);
  assert.equal(result.estimatedTotal, 90);
  assert.equal(result.remainingAfterConfirmed, 10);
  assert.equal(result.unknownItemsCount, 0);
});

it("prevents a viewer from changing the shared purchase budget", async () => {
  let writes = 0;
  const purchase = { id: "purchase", userId: "owner", sourceListId: "list", status: "in_progress", items: [], participants: [{ userId: "viewer" }], sourceList: { userId: "owner", members: [{ userId: "viewer", status: "accepted", role: "viewer" }] } };
  const service = new PurchasesService({ purchase: { findFirst: async () => purchase, update: async () => { writes++; } } } as never, {} as never, {} as never);
  await assert.rejects(service.setBudget("viewer", "purchase", { budgetAmount: 50 }), ForbiddenException);
  assert.equal(writes, 0);
});

it("shares the same budget references using list history rather than other private purchases", async () => {
  let historyWhere: any;
  const purchase = { id: "purchase", userId: "owner", sourceListId: "list", budgetAmount: 100, subtotalCalculated: 0, status: "in_progress", items: [item()], participants: [{ userId: "viewer" }], sourceList: { userId: "owner", members: [{ userId: "viewer", status: "accepted", role: "viewer" }] } };
  const service = new PurchasesService({ purchase: { findFirst: async () => purchase }, purchaseItem: { findMany: async ({ where }: any) => { historyWhere = where; return [reference()]; } } } as never, {} as never, {} as never);
  const result = await service.budget("viewer", "purchase");
  assert.equal(historyWhere.purchase.sourceListId, "list");
  assert.equal(historyWhere.purchase.status, "completed");
  assert.equal(result.canEdit, false);
  assert.equal(result.estimatedRemaining, 25);
});
