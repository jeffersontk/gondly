import type { ListItemStatus } from "@gondly/types";

export function purchaseDecision(status: ListItemStatus): "pending" | "not_needed" {
  return status === "pending" ? "pending" : "not_needed";
}

export function parsePurchaseQuantity(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}
