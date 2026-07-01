import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Unit } from "@prisma/client";
import { calculateNormalizedPrice } from "@gondly/utils";

describe("calculateNormalizedPrice", () => {
  it("normalizes weight, volume and package units", () => {
    assert.deepEqual(calculateNormalizedPrice(2, Unit.kg, 20), {
      unitPriceNormalized: 10,
      normalizedUnitLabel: "kg",
      isValid: true,
      reason: null,
    });
    assert.deepEqual(calculateNormalizedPrice(500, Unit.g, 10), {
      unitPriceNormalized: 20,
      normalizedUnitLabel: "kg",
      isValid: true,
      reason: null,
    });
    assert.deepEqual(calculateNormalizedPrice(2, Unit.l, 8), {
      unitPriceNormalized: 4,
      normalizedUnitLabel: "l",
      isValid: true,
      reason: null,
    });
    assert.deepEqual(calculateNormalizedPrice(500, Unit.ml, 4), {
      unitPriceNormalized: 8,
      normalizedUnitLabel: "l",
      isValid: true,
      reason: null,
    });
    assert.deepEqual(calculateNormalizedPrice(4, Unit.un, 12), {
      unitPriceNormalized: 3,
      normalizedUnitLabel: "un",
      isValid: true,
      reason: null,
    });
    assert.deepEqual(calculateNormalizedPrice(2, Unit.pacote, 18), {
      unitPriceNormalized: 9,
      normalizedUnitLabel: "pacote",
      isValid: true,
      reason: null,
    });
    assert.deepEqual(calculateNormalizedPrice(3, Unit.caixa, 30), {
      unitPriceNormalized: 10,
      normalizedUnitLabel: "caixa",
      isValid: true,
      reason: null,
    });
  });

  it("returns null normalization for unit outro", () => {
    assert.deepEqual(calculateNormalizedPrice(1, Unit.outro, 10), {
      unitPriceNormalized: null,
      normalizedUnitLabel: null,
      isValid: true,
      reason: null,
    });
  });

  it("returns safe invalid results for invalid quantity and price", () => {
    assert.deepEqual(calculateNormalizedPrice(0, Unit.kg, 10), {
      unitPriceNormalized: null,
      normalizedUnitLabel: null,
      isValid: false,
      reason: "invalid_quantity",
    });
    assert.deepEqual(calculateNormalizedPrice(1, Unit.kg, -1), {
      unitPriceNormalized: null,
      normalizedUnitLabel: null,
      isValid: false,
      reason: "invalid_price",
    });
  });
});
