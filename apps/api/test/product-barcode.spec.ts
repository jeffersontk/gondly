import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { Unit } from "@prisma/client";
import { ProductsService } from "../src/products/products.service";

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-1",
    userId: "user-1",
    name: "Arroz Branco",
    normalizedName: "arroz branco",
    brand: "Tio Joao",
    brandId: "brand-1",
    brandRef: { id: "brand-1", name: "Tio Joao", normalizedName: "tio joao" },
    category: "Mercearia",
    categoryId: null,
    defaultUnit: Unit.kg,
    barcode: "7891234567890",
    packageSize: 5,
    packageUnit: Unit.kg,
    deletedAt: null,
    ...overrides,
  };
}

describe("ProductsService barcode lookup", () => {
  it("returns an existing product by normalized barcode with the last known price", async () => {
    let barcodeWhere: unknown;
    const prisma = {
      product: {
        findFirst: async ({ where }: { where: unknown }) => {
          barcodeWhere = where;
          return product();
        },
      },
      purchaseItem: {
        findFirst: async () => ({
          pricePaid: 24.9,
          unitPriceNormalized: 4.98,
          normalizedUnitLabel: "kg",
          createdAt: new Date("2026-07-01T12:00:00.000Z"),
          purchase: {
            completedAt: new Date("2026-07-02T12:00:00.000Z"),
            market: { id: "market-1", name: "Mercado Central" },
          },
        }),
      },
    };
    const service = new ProductsService(prisma as never);

    const result = await service.findBarcode("user-1", "789 123-4567890");

    assert.deepEqual(barcodeWhere, {
      userId: "user-1",
      barcode: "7891234567890",
      deletedAt: null,
    });
    assert.equal(result.product.id, "product-1");
    assert.deepEqual(result.brand, product().brandRef);
    assert.equal(result.category, "Mercearia");
    assert.equal(result.packageSize, 5);
    assert.equal(result.packageUnit, Unit.kg);
    assert.equal(result.unit, Unit.kg);
    assert.deepEqual(result.lastKnownPrice, {
      pricePaid: 24.9,
      normalizedPrice: 4.98,
      normalizedUnit: "kg",
      market: { id: "market-1", name: "Mercado Central" },
      purchasedAt: new Date("2026-07-02T12:00:00.000Z"),
    });
  });

  it("returns the existing product instead of duplicating a barcode on create", async () => {
    let created = false;
    const prisma = {
      product: {
        findFirst: async () => product({ id: "existing-product" }),
        create: async () => {
          created = true;
          return product({ id: "created-product" });
        },
      },
    };
    const service = new ProductsService(prisma as never);

    const result = await service.create("user-1", {
      name: "Arroz",
      defaultUnit: Unit.kg,
      barcode: "789 123",
    });

    assert.equal(result.id, "existing-product");
    assert.equal(created, false);
  });

  it("does not allow updating a product with another active product barcode", async () => {
    const prisma = {
      product: {
        findFirst: async ({ where }: { where: { id?: string; barcode?: string } }) => {
          if (where.id === "product-1") return product();
          if (where.barcode === "789123") return { id: "product-2" };
          return null;
        },
        update: async () => product({ id: "updated-product" }),
      },
    };
    const service = new ProductsService(prisma as never);

    await assert.rejects(
      () => service.update("user-1", "product-1", { barcode: "789 123" }),
      BadRequestException,
    );
  });
});
