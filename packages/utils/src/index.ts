import type { Unit } from "@gondly/types";

export type NormalizedPrice = {
  unitPriceNormalized: number | null;
  normalizedUnitLabel: "kg" | "l" | "un" | null;
};

export function normalizePrice(quantity: number, unit: Unit, pricePaid: number): NormalizedPrice {
  if (quantity <= 0 || pricePaid < 0) {
    throw new Error("Quantity must be greater than zero and price cannot be negative.");
  }

  if (unit === "kg") {
    return { unitPriceNormalized: roundCurrency(pricePaid / quantity), normalizedUnitLabel: "kg" };
  }

  if (unit === "g") {
    return { unitPriceNormalized: roundCurrency(pricePaid / (quantity / 1000)), normalizedUnitLabel: "kg" };
  }

  if (unit === "l") {
    return { unitPriceNormalized: roundCurrency(pricePaid / quantity), normalizedUnitLabel: "l" };
  }

  if (unit === "ml") {
    return { unitPriceNormalized: roundCurrency(pricePaid / (quantity / 1000)), normalizedUnitLabel: "l" };
  }

  if (unit === "un" || unit === "pacote" || unit === "caixa") {
    return { unitPriceNormalized: roundCurrency(pricePaid / quantity), normalizedUnitLabel: "un" };
  }

  return { unitPriceNormalized: null, normalizedUnitLabel: null };
}

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatBRL(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);
}
