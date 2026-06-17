import { BadRequestException } from "@nestjs/common";
import { Unit } from "@prisma/client";

export type NormalizedPrice = {
  unitPriceNormalized: number | null;
  normalizedUnitLabel: "kg" | "l" | "un" | "pacote" | "caixa" | null;
};

export function calculateNormalizedPrice(quantity: number, unit: Unit, pricePaid: number): NormalizedPrice {
  if (quantity <= 0) {
    throw new BadRequestException("Quantity must be greater than zero.");
  }

  if (pricePaid < 0) {
    throw new BadRequestException("Price must be greater than or equal to zero.");
  }

  if (unit === Unit.kg) {
    return { unitPriceNormalized: roundMoney(pricePaid / quantity), normalizedUnitLabel: "kg" };
  }

  if (unit === Unit.g) {
    return { unitPriceNormalized: roundMoney(pricePaid / (quantity / 1000)), normalizedUnitLabel: "kg" };
  }

  if (unit === Unit.l) {
    return { unitPriceNormalized: roundMoney(pricePaid / quantity), normalizedUnitLabel: "l" };
  }

  if (unit === Unit.ml) {
    return { unitPriceNormalized: roundMoney(pricePaid / (quantity / 1000)), normalizedUnitLabel: "l" };
  }

  if (unit === Unit.un) {
    return { unitPriceNormalized: roundMoney(pricePaid / quantity), normalizedUnitLabel: "un" };
  }

  if (unit === Unit.pacote) {
    return { unitPriceNormalized: roundMoney(pricePaid / quantity), normalizedUnitLabel: "pacote" };
  }

  if (unit === Unit.caixa) {
    return { unitPriceNormalized: roundMoney(pricePaid / quantity), normalizedUnitLabel: "caixa" };
  }

  return { unitPriceNormalized: null, normalizedUnitLabel: null };
}

export const normalizePrice = calculateNormalizedPrice;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
