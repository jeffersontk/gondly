import assert from "node:assert/strict";
import { test } from "node:test";
import { ReportsService } from "../src/reports/reports.service";
import { purchaseAccessWhere } from "../src/purchases/purchase-access";

const item = (unit: string, price: number, brand = "A") => ({ productId: "p", productName: "Milk", quantity: 1, pricePaid: price, unitPriceNormalized: price, normalizedUnitLabel: unit, brandNameSnapshot: brand, packageSize: 1, packageUnit: "l", purchaseId: "buy", createdAt: new Date("2026-10-01Z"), purchase: { completedAt: new Date("2026-10-01Z"), market: { id: "m", name: '=HYPERLINK("bad")' } } });
test("CSV keeps authorized scope, ISO dates and decimal money while neutralizing formulas", async () => {
  let query: any;
  const service = new ReportsService({ purchaseItem: { findMany: async (args: any) => { query = args; return [item("l", 3.5)]; } } } as any);
  const csv = await (service as any).exportHistory("viewer", { category: "Dairy", endDate: "2026-10-28" });
  assert.deepEqual(query.where.purchase.OR, purchaseAccessWhere("viewer").OR);
  assert.equal(query.where.category, "Dairy");
  assert.equal(query.where.pricePaid, undefined);
  assert.equal(query.where.purchase.completedAt.lte.toISOString(), "2026-10-28T23:59:59.999Z");
  assert.ok(csv.includes("2026-10-01T00:00:00.000Z"));
  assert.ok(csv.includes('"3.50"'));
  assert.ok(csv.includes("'=HYPERLINK"));
});
test("price summaries separate units and brand alternatives", async () => {
  const service = new ReportsService({ purchaseItem: { findMany: async () => [item("kg", 2), item("l", 8), item("l", 5, "B")] } } as any);
  const result = await service.productsPriceComparison("viewer");
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((r: any) => r.normalizedUnit).sort(), ["kg", "l", "l"]);
});
test("market comparisons never average incompatible units or packaging", async () => {
  const service = new ReportsService({ purchaseItem: { findMany: async () => [item("kg", 2), item("l", 8), item("l", 5, "B")] } } as any);
  assert.equal((await service.productMarketsComparison("viewer", "p")).length, 3);
});

test("CSV never invents a completion date when the historical purchase lacks one", async () => {
  const entry = item("l", 3.5);
  const missingDate = { ...entry, purchase: { ...entry.purchase, completedAt: null } };
  const service = new ReportsService({ purchaseItem: { findMany: async () => [missingDate] } } as never);
  const csv = await service.exportHistory("viewer");
  assert.ok(!csv.includes("2026-10-01T00:00:00.000Z"));
});
test("CSV preserves quantity unit, normalized precision and explicitly repeated checkout totals", async () => {
  const record = { ...item("kg", 12), unit: "g", quantity: 250, unitPriceNormalized: 48.1234 };
  Object.assign(record.purchase, { finalPaidAmount: 10.5, discountAmount: 1.5 });
  const service = new ReportsService({ purchaseItem: { findMany: async () => [record] } } as any);
  const csv = await service.exportHistory("viewer");
  assert.ok(csv.includes('"quantity","quantity_unit"'));
  assert.ok(csv.includes('"250","g"'));
  assert.ok(csv.includes('"48.1234"'));
  assert.ok(csv.includes('"purchase_final_paid_brl_repeated_per_item","purchase_discount_brl_repeated_per_item"'));
  assert.ok(csv.includes('"10.50","1.50"'));
});
