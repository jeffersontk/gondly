const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateItemTotal,
  calculateNormalizedPrice,
  formatPricePerUnitLabel,
  getNormalizedUnitLabel,
  parseMoneyToNumber,
  safeDecimalToNumber,
} = require("../dist/index.js");

function expectNormalized(unit, quantity, pricePaid, unitPriceNormalized, normalizedUnitLabel) {
  assert.deepEqual(calculateNormalizedPrice(quantity, unit, pricePaid), {
    unitPriceNormalized,
    normalizedUnitLabel,
    isValid: true,
    reason: null,
  });
}

describe("price calculations", () => {
  it("normalizes kg prices", () => {
    expectNormalized("kg", 2, 20, 10, "kg");
  });

  it("normalizes g prices to kg", () => {
    expectNormalized("g", 500, 10, 20, "kg");
  });

  it("normalizes l prices", () => {
    expectNormalized("l", 2, 8, 4, "l");
  });

  it("normalizes ml prices to l", () => {
    expectNormalized("ml", 500, 4, 8, "l");
  });

  it("normalizes unit prices", () => {
    expectNormalized("un", 4, 12, 3, "un");
  });

  it("normalizes package prices", () => {
    expectNormalized("pacote", 2, 18, 9, "pacote");
  });

  it("normalizes box prices", () => {
    expectNormalized("caixa", 3, 30, 10, "caixa");
  });

  it("does not normalize outro", () => {
    expectNormalized("outro", 1, 10, null, null);
  });

  it("returns an explicit safe result for zero quantity", () => {
    assert.deepEqual(calculateNormalizedPrice(0, "kg", 10), {
      unitPriceNormalized: null,
      normalizedUnitLabel: null,
      isValid: false,
      reason: "invalid_quantity",
    });
  });

  it("keeps zero price valid", () => {
    expectNormalized("kg", 2, 0, 0, "kg");
  });

  it("returns an explicit safe result for negative price", () => {
    assert.deepEqual(calculateNormalizedPrice(1, "kg", -1), {
      unitPriceNormalized: null,
      normalizedUnitLabel: null,
      isValid: false,
      reason: "invalid_price",
    });
  });

  it("calculates item totals from input modes", () => {
    assert.deepEqual(calculateItemTotal(500, "g", 20, "kg"), {
      total: 10,
      isValid: true,
      reason: null,
    });
    assert.deepEqual(calculateItemTotal(3, "un", 4, "unit"), {
      total: 12,
      isValid: true,
      reason: null,
    });
    assert.deepEqual(calculateItemTotal(3, "un", 9.9, "total"), {
      total: 9.9,
      isValid: true,
      reason: null,
    });
  });

  it("maps normalized unit labels", () => {
    assert.equal(getNormalizedUnitLabel("g"), "kg");
    assert.equal(getNormalizedUnitLabel("ml"), "l");
    assert.equal(getNormalizedUnitLabel("pacote"), "pacote");
    assert.equal(getNormalizedUnitLabel("outro"), null);
  });

  it("formats price per unit labels", () => {
    assert.match(formatPricePerUnitLabel(10, "kg"), /^R\$\s?10,00\/kg$/u);
    assert.equal(formatPricePerUnitLabel(null, "kg"), "--");
    assert.equal(formatPricePerUnitLabel(10, null), "--");
  });

  it("parses money and decimal-like values", () => {
    assert.equal(parseMoneyToNumber("R$ 1.234,56"), 1234.56);
    assert.equal(parseMoneyToNumber("12,50"), 12.5);
    assert.equal(safeDecimalToNumber({ toString: () => "19.90" }), 19.9);
    assert.equal(safeDecimalToNumber("abc", 7), 7);
  });
});
