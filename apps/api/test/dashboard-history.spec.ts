import assert from "node:assert/strict";
import { it } from "node:test";
import { ReportsService } from "../src/reports/reports.service";

it("includes the same shared purchases as history in monthly totals and latest purchase", async () => {
  const today = new Date();
  const own = { id: "own", userId: "viewer", status: "completed", deletedAt: null, completedAt: new Date(today.getFullYear(), today.getMonth(), 15), finalPaidAmount: 22.95, subtotalCalculated: 22.95, discountAmount: 0, market: { id: "mega", name: "Mega supermercado" }, items: [] };
  const shared = { ...own, id: "shared", userId: "other-owner", completedAt: new Date(today.getFullYear(), today.getMonth(), 27), finalPaidAmount: 1060.81, subtotalCalculated: 1060.81, market: { id: "guanabara", name: "Guanabara" } };
  const scopes: Array<Record<string, unknown>> = [];
  const visible = (where: Record<string, unknown>) => {
    scopes.push(where);
    return where.userId ? [own] : where.OR ? [own, shared] : [];
  };
  const service = new ReportsService({
    purchase: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => visible(where).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())[0],
      findMany: async ({ where }: { where: Record<string, unknown> }) => visible(where),
    },
    purchaseItem: { findMany: async ({ where }: { where: { purchase: Record<string, unknown> } }) => { scopes.push(where.purchase); return []; } },
  } as never);
  const report = await service.dashboard("viewer");
  assert.equal(report.totalSpentMonth, 1083.76);
  assert.equal(report.monthPurchasesCount, 2);
  assert.equal(report.lastPurchase?.id, "shared");
  for (const scope of scopes) {
    assert.equal(scope.userId, undefined);
    assert.equal(scope.status, "completed");
    assert.equal(scope.deletedAt, null);
    assert.deepEqual(scope.OR, [
      { userId: "viewer" },
      { sourceList: { members: { some: { userId: "viewer", status: "accepted" } } } },
      { participants: { some: { userId: "viewer" } }, OR: [{ sourceListId: null }, { status: { not: "in_progress" } }] },
    ]);
  }
});
