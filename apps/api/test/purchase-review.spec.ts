import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { ProductsService } from "../src/products/products.service";
import { PurchasesService } from "../src/purchases/purchases.service";

function completedPurchase(items: Array<Record<string, unknown>>) {
  return {
    id: "purchase-1",
    userId: "user-1",
    status: "completed",
    startedAt: new Date("2026-10-10T12:00:00.000Z"),
    market: { name: "Mercado Bom" },
    sourceList: { name: "Compra do mês", userId: "user-1", members: [] },
    participants: [{ userId: "user-1" }],
    items,
  };
}

describe("purchase review", () => {
  it("creates a list with only the items that never went to the cart", async () => {
    const purchase = completedPurchase([
      { productName: "Arroz", pricePaid: 25, quantity: 1, unit: "un" },
      { productName: "Feijão", pricePaid: 0, quantity: 2, unit: "un" },
    ]);
    let listName = "";
    let copied: Array<{ productName: string }> = [];
    const tx = {
      marketList: {
        create: async ({ data }: { data: { name: string } }) => {
          listName = data.name;
          return { id: "list-2" };
        },
        findUnique: async () => ({ id: "list-2", name: listName, items: copied }),
      },
      listMember: { create: async () => undefined },
      marketListItem: {
        createMany: async ({ data }: { data: Array<{ productName: string }> }) => {
          copied = data;
        },
      },
    };
    const prisma = { purchase: { findFirst: async () => purchase }, $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) };
    const service = new PurchasesService(prisma as never, {} as never, {} as never);

    await service.duplicateAsList("user-1", "purchase-1", { onlyMissing: true });

    assert.deepEqual(copied.map((item) => item.productName), ["Feijão"]);
    assert.match(listName, /^Faltou: Compra do mês/);
  });

  it("refuses to create a missing-items list when everything was bought", async () => {
    const purchase = completedPurchase([{ productName: "Arroz", pricePaid: 25, quantity: 1, unit: "un" }]);
    const prisma = { purchase: { findFirst: async () => purchase } };
    const service = new PurchasesService(prisma as never, {} as never, {} as never);

    await assert.rejects(() => service.duplicateAsList("user-1", "purchase-1", { onlyMissing: true }), BadRequestException);
  });

  it("summarizes what the user usually pays, ignoring prices in another unit", async () => {
    const at = (day: number) => ({ completedAt: new Date(`2026-10-${day}T12:00:00.000Z`), market: { name: `Mercado ${day}` } });
    const prisma = {
      purchaseItem: {
        findMany: async () => [
          { unitPriceNormalized: 6, normalizedUnitLabel: "R$/kg", purchase: at(12) },
          { unitPriceNormalized: 5, normalizedUnitLabel: "R$/kg", purchase: at(5) },
          { unitPriceNormalized: 3, normalizedUnitLabel: "R$/un", purchase: at(1) },
        ],
      },
    };
    const service = new ProductsService(prisma as never);

    const hint = await service.priceHint("user-1", "Arroz");

    assert.deepEqual(hint, {
      normalizedUnitLabel: "R$/kg",
      lastUnitPrice: 6,
      averageUnitPrice: 5.5,
      minUnitPrice: 5,
      purchasesCount: 2,
      lastPurchasedAt: new Date("2026-10-12T12:00:00.000Z"),
      lastMarketName: "Mercado 12",
    });
    assert.equal(await service.priceHint("user-1", "  "), null);
  });
});
