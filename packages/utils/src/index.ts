import type { Unit } from "@gondly/types";

export type NormalizedUnitLabel = "kg" | "l" | "un" | "pacote" | "caixa";
export type PriceInputMode = "unit" | "kg" | "total";
export type PriceCalculationInvalidReason = "invalid_number" | "invalid_quantity" | "invalid_price";

export type NormalizedPrice = {
  unitPriceNormalized: number | null;
  normalizedUnitLabel: NormalizedUnitLabel | null;
  isValid: boolean;
  reason: PriceCalculationInvalidReason | null;
};

export type ItemTotalCalculation = {
  total: number;
  isValid: boolean;
  reason: PriceCalculationInvalidReason | null;
};

export type DecimalLike = number | string | { toString(): string } | null | undefined;

const invalidNormalizedPrice = (reason: PriceCalculationInvalidReason): NormalizedPrice => ({
  unitPriceNormalized: null,
  normalizedUnitLabel: null,
  isValid: false,
  reason,
});

const invalidItemTotal = (reason: PriceCalculationInvalidReason): ItemTotalCalculation => ({
  total: 0,
  isValid: false,
  reason,
});

export function calculateItemTotal(
  quantity: DecimalLike,
  unit: Unit,
  pricePaid: DecimalLike,
  priceInputMode: PriceInputMode = "unit",
): ItemTotalCalculation {
  const numericQuantity = safeDecimalToNumber(quantity, Number.NaN);
  const numericPrice = safeDecimalToNumber(pricePaid, Number.NaN);

  const invalidReason = getInvalidPriceReason(numericQuantity, numericPrice);
  if (invalidReason) return invalidItemTotal(invalidReason);

  if (priceInputMode === "total") {
    return { total: roundMoney(numericPrice), isValid: true, reason: null };
  }

  const quantityMultiplier = priceInputMode === "kg" && unit === "g" ? numericQuantity / 1000 : numericQuantity;
  return { total: roundMoney(quantityMultiplier * numericPrice), isValid: true, reason: null };
}

export function calculateNormalizedPrice(quantity: DecimalLike, unit: Unit, pricePaid: DecimalLike): NormalizedPrice {
  const numericQuantity = safeDecimalToNumber(quantity, Number.NaN);
  const numericPrice = safeDecimalToNumber(pricePaid, Number.NaN);

  const invalidReason = getInvalidPriceReason(numericQuantity, numericPrice);
  if (invalidReason) return invalidNormalizedPrice(invalidReason);

  const normalizedUnitLabel = getNormalizedUnitLabel(unit);
  if (!normalizedUnitLabel) {
    return {
      unitPriceNormalized: null,
      normalizedUnitLabel: null,
      isValid: true,
      reason: null,
    };
  }

  const normalizedQuantity = unit === "g" || unit === "ml" ? numericQuantity / 1000 : numericQuantity;
  return {
    unitPriceNormalized: roundMoney(numericPrice / normalizedQuantity),
    normalizedUnitLabel,
    isValid: true,
    reason: null,
  };
}

export function getNormalizedUnitLabel(unit: Unit | string | null | undefined): NormalizedUnitLabel | null {
  if (unit === "kg" || unit === "g") return "kg";
  if (unit === "l" || unit === "ml") return "l";
  if (unit === "un") return "un";
  if (unit === "pacote") return "pacote";
  if (unit === "caixa") return "caixa";
  return null;
}

export function formatPricePerUnitLabel(price: unknown, unitLabel: string | null | undefined) {
  const numericPrice = safeDecimalToNumber(price, Number.NaN);
  if (!Number.isFinite(numericPrice) || !unitLabel) return "--";
  return `${formatBRL(numericPrice)}/${unitLabel}`;
}

export function parseMoneyToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value !== "string" && typeof value !== "object") return Number.NaN;

  const cleaned = value.toString().trim().replace(/\s/g, "").replace(/[R$]/g, "");
  if (!cleaned) return Number.NaN;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    return Number(cleaned.replaceAll(thousandSeparator, "").replace(decimalSeparator, "."));
  }

  if (lastComma >= 0) {
    return Number(`${cleaned.slice(0, lastComma).replaceAll(",", "")}.${cleaned.slice(lastComma + 1)}`);
  }

  if (lastDot >= 0 && cleaned.indexOf(".") !== lastDot) {
    return Number(`${cleaned.slice(0, lastDot).replaceAll(".", "")}.${cleaned.slice(lastDot + 1)}`);
  }

  return Number(cleaned);
}

export function safeDecimalToNumber(value: unknown, fallback = 0): number {
  const parsed = parseMoneyToNumber(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const roundCurrency = roundMoney;
export const normalizePrice = calculateNormalizedPrice;

export function formatBRL(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(safeDecimalToNumber(value, 0));
}

function getInvalidPriceReason(quantity: number, pricePaid: number): PriceCalculationInvalidReason | null {
  if (!Number.isFinite(quantity) || !Number.isFinite(pricePaid)) return "invalid_number";
  if (quantity <= 0) return "invalid_quantity";
  if (pricePaid < 0) return "invalid_price";
  return null;
}
