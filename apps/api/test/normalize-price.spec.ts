import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { Unit } from "@prisma/client";
import { calculateNormalizedPrice } from "../src/common/utils/normalize-price";

describe("calculateNormalizedPrice", () => {
  it("normalizes weight, volume and package units", () => {
    assert.deepEqual(calculateNormalizedPrice(2, Unit.kg, 20), {
      unitPriceNormalized: 10,
      normalizedUnitLabel: "kg",
    });
    assert.deepEqual(calculateNormalizedPrice(500, Unit.g, 10), {
      unitPriceNormalized: 20,
      normalizedUnitLabel: "kg",
    });
    assert.deepEqual(calculateNormalizedPrice(2, Unit.l, 8), {
      unitPriceNormalized: 4,
      normalizedUnitLabel: "l",
    });
    assert.deepEqual(calculateNormalizedPrice(500, Unit.ml, 4), {
      unitPriceNormalized: 8,
      normalizedUnitLabel: "l",
    });
    assert.deepEqual(calculateNormalizedPrice(4, Unit.un, 12), {
      unitPriceNormalized: 3,
      normalizedUnitLabel: "un",
    });
    assert.deepEqual(calculateNormalizedPrice(2, Unit.pacote, 18), {
      unitPriceNormalized: 9,
      normalizedUnitLabel: "pacote",
    });
    assert.deepEqual(calculateNormalizedPrice(3, Unit.caixa, 30), {
      unitPriceNormalized: 10,
      normalizedUnitLabel: "caixa",
    });
  });

  it("returns null normalization for unit outro", () => {
    assert.deepEqual(calculateNormalizedPrice(1, Unit.outro, 10), {
      unitPriceNormalized: null,
      normalizedUnitLabel: null,
    });
  });

  it("validates quantity and price", () => {
    assert.throws(() => calculateNormalizedPrice(0, Unit.kg, 10), BadRequestException);
    assert.throws(() => calculateNormalizedPrice(1, Unit.kg, -1), BadRequestException);
  });
});
