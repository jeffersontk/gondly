import { useEffect, useState } from "react";
import { z } from "zod";
import type { ListItemStatus, Unit } from "@gondly/types";
import { unitLabels } from "../components";
import { isNetworkFailure } from "../lib/api";
import { createLocalItemId, type PurchaseItemPayload } from "../lib/offlineQueue";
import type { MarketList, MarketListItem, Purchase, PurchaseItem } from "../types";

export const units = ["un", "kg", "g", "l", "ml", "pacote", "caixa", "outro"] as const;

export const listSchema = z.object({
  name: z.string().min(2, "Informe um nome"),
  description: z.string().optional(),
});

export const marketSchema = z.object({
  name: z.string().min(2, "Informe um nome"),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

export const productSchema = z.object({
  name: z.string().min(2, "Informe um produto"),
  brand: z.string().optional(),
  category: z.string().optional(),
  defaultUnit: z.enum(units),
  barcode: z.string().optional(),
});

export function parseDecimalInput(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;

  const cleaned = value.trim().replace(/\s/g, "").replace(/[R$]/g, "");
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

export function decimalValue(value: unknown, fallback = 0) {
  const parsed = parseDecimalInput(value);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export type PriceInputMode = "unit" | "kg" | "total";

export function isWeightUnit(unit: Unit) {
  return unit === "g" || unit === "kg";
}

export function calculatePurchaseItemTotal(quantity: number, unit: Unit, priceInput: number, priceInputMode: PriceInputMode) {
  if (priceInputMode === "total") return roundMoney(priceInput);
  if (priceInputMode === "kg") {
    const quantityInKg = unit === "g" ? quantity / 1000 : quantity;
    return roundMoney(quantityInKg * priceInput);
  }
  return roundMoney(quantity * priceInput);
}

export function priceInputFromItem(item: PurchaseItem): { pricePaid: number; priceInputMode: PriceInputMode } {
  const quantity = Number(item.quantity ?? 0);
  const totalPaid = Number(item.pricePaid ?? 0);

  if (isWeightUnit(item.unit)) {
    const normalizedPrice = item.unitPriceNormalized != null ? Number(item.unitPriceNormalized) : null;
    if (normalizedPrice != null && Number.isFinite(normalizedPrice)) {
      return { pricePaid: roundMoney(normalizedPrice), priceInputMode: "kg" };
    }

    const quantityInKg = item.unit === "g" ? quantity / 1000 : quantity;
    if (quantityInKg > 0) return { pricePaid: roundMoney(totalPaid / quantityInKg), priceInputMode: "kg" };
    return { pricePaid: totalPaid, priceInputMode: "kg" };
  }

  if (quantity > 0) return { pricePaid: roundMoney(totalPaid / quantity), priceInputMode: "unit" };
  return { pricePaid: totalPaid, priceInputMode: "total" };
}

export function purchaseItemPriceDescription(item: PurchaseItem) {
  const totalPaid = Number(item.pricePaid ?? 0);
  const quantityLabel = `${item.quantity} ${unitLabels[item.unit]}`;
  if (totalPaid <= 0) return `${quantityLabel} · Último preço: --`;

  const normalizedPrice = item.unitPriceNormalized != null ? Number(item.unitPriceNormalized) : null;
  if (normalizedPrice != null && Number.isFinite(normalizedPrice) && item.normalizedUnitLabel) {
    return `${quantityLabel} · ${formatBRL(normalizedPrice)}/${item.normalizedUnitLabel} · Total ${formatBRL(totalPaid)}`;
  }

  const quantity = Number(item.quantity ?? 0);
  const unitPrice = quantity > 0 ? roundMoney(totalPaid / quantity) : totalPaid;
  return `${quantityLabel} · ${formatBRL(unitPrice)} / ${unitLabels[item.unit]} · Total ${formatBRL(totalPaid)}`;
}

export function toPurchaseItemPayload(values: CartItemForm, productName: string): PurchaseItemPayload {
  const pricePaid = calculatePurchaseItemTotal(Number(values.quantity ?? 0), values.unit, Number(values.pricePaid ?? 0), values.priceInputMode);
  return {
    productId: values.productId,
    productName,
    brand: values.brand,
    category: values.category,
    quantity: values.quantity,
    unit: values.unit,
    pricePaid,
    notes: values.notes,
  };
}

export function optimisticCartItem(values: PurchaseItemPayload, id?: string, currentItem?: PurchaseItem): PurchaseItem {
  return {
    id: id ?? createLocalItemId(),
    sourceListItemId: currentItem?.sourceListItemId ?? null,
    productId: values.productId ?? null,
    productName: values.productName,
    brand: values.brand || null,
    category: values.category || null,
    quantity: values.quantity,
    unit: values.unit,
    pricePaid: values.pricePaid,
    unitPriceNormalized: null,
    normalizedUnitLabel: null,
    notes: values.notes || null,
  };
}

export function patchPurchaseItemCache(purchases: Purchase[] | undefined, purchaseId: string, item: PurchaseItem, itemId?: string) {
  if (!purchases) return purchases;

  return purchases.map((purchase) => {
    if (purchase.id !== purchaseId) return purchase;

    const items = itemId ? purchase.items.map((entry) => (entry.id === itemId ? item : entry)) : [item, ...purchase.items];
    return {
      ...purchase,
      items,
      subtotalCalculated: calculatePurchaseSubtotal(items),
    };
  });
}

export function upsertRealtimePurchaseItemCache(purchases: Purchase[] | undefined, purchaseId: string, nextItem: PurchaseItem) {
  if (!purchases) return purchases;

  const normalizedItem = normalizePurchaseItem(nextItem);
  return purchases.map((purchase) => {
    if (purchase.id !== purchaseId) return purchase;

    const exists = purchase.items.some((item) => item.id === normalizedItem.id);
    const items = exists
      ? purchase.items.map((item) => (item.id === normalizedItem.id ? normalizedItem : item))
      : [normalizedItem, ...purchase.items];

    return { ...purchase, items, subtotalCalculated: calculatePurchaseSubtotal(items) };
  });
}

export function removeRealtimePurchaseItemCache(purchases: Purchase[] | undefined, purchaseId: string, itemId: string) {
  if (!purchases) return purchases;

  return purchases.map((purchase) => {
    if (purchase.id !== purchaseId) return purchase;

    const items = purchase.items.filter((item) => item.id !== itemId);
    return { ...purchase, items, subtotalCalculated: calculatePurchaseSubtotal(items) };
  });
}

export function updateRealtimePurchaseTotalCache(purchases: Purchase[] | undefined, purchaseId: string, subtotalCalculated?: number, status?: string) {
  if (!purchases) return purchases;
  if (status && status !== "in_progress") return purchases.filter((purchase) => purchase.id !== purchaseId);

  return purchases.map((purchase) => {
    if (purchase.id !== purchaseId) return purchase;
    return {
      ...purchase,
      subtotalCalculated: typeof subtotalCalculated === "number" ? subtotalCalculated : calculatePurchaseSubtotal(purchase.items),
    };
  });
}

export function calculatePurchaseSubtotal(items: PurchaseItem[]) {
  return roundMoney(items.reduce((sum, entry) => sum + Number(entry.pricePaid ?? 0), 0));
}

export function normalizePurchaseItem(item: PurchaseItem): PurchaseItem {
  return {
    ...item,
    quantity: Number(item.quantity ?? 0),
    pricePaid: Number(item.pricePaid ?? 0),
    unitPriceNormalized: item.unitPriceNormalized === null || item.unitPriceNormalized === undefined ? item.unitPriceNormalized : Number(item.unitPriceNormalized),
  };
}

export function reconcilePurchaseCache(purchases: Purchase[] | undefined, nextPurchase: Purchase, completedLocalItemId?: string) {
  if (!purchases) return purchases;
  return purchases.map((purchase) => {
    if (purchase.id !== nextPurchase.id) return purchase;

    const pendingLocalItems = purchase.items.filter((item) => item.id.startsWith("local-") && item.id !== completedLocalItemId);
    const items = [...pendingLocalItems, ...nextPurchase.items];

    return {
      ...nextPurchase,
      items,
      subtotalCalculated: calculatePurchaseSubtotal(items),
    };
  });
}

export function setActivePurchaseCache(purchases: Purchase[] | undefined, nextPurchase: Purchase) {
  if (!purchases?.length) return [nextPurchase];
  return [nextPurchase, ...purchases.filter((purchase) => purchase.id !== nextPurchase.id && purchase.status === "in_progress")];
}

export function removeActivePurchaseCache(purchases: Purchase[] | undefined, purchaseId?: string) {
  if (!purchases) return purchases;
  return purchases.filter((purchase) => purchase.id !== purchaseId);
}

export function isQueueableWriteError(error: unknown) {
  return isNetworkFailure(error);
}

export function updateListItemCache(list: MarketList | undefined, item: MarketListItem) {
  if (!list) return list;
  return { ...list, items: list.items.map((entry) => (entry.id === item.id ? { ...item, important: Boolean(item.important) } : entry)) };
}

export function removeListItemCache(list: MarketList | undefined, itemId: string) {
  if (!list) return list;
  return { ...list, items: list.items.filter((entry) => entry.id !== itemId) };
}

export function addListItemCache(list: MarketList | undefined, item: MarketListItem) {
  if (!list) return list;
  return { ...list, items: [{ ...item, important: Boolean(item.important) }, ...list.items.filter((entry) => entry.id !== item.id)] };
}

export function normalizeMarketList(list: MarketList): MarketList {
  return {
    ...list,
    items: (list.items ?? []).map((item) => ({ ...item, important: Boolean(item.important) })),
    members: list.members ?? [],
    invites: list.invites ?? [],
  };
}

export function mergeMarketList(current: MarketList | undefined, nextList: MarketList): MarketList {
  const normalized = normalizeMarketList(nextList);
  if (!current) return normalized;
  return {
    ...current,
    ...normalized,
    items: nextList.items ?? current.items ?? [],
    members: nextList.members ?? current.members,
    invites: nextList.invites ?? current.invites,
  };
}

export function updateListsCache(lists: MarketList[] | undefined, nextList: MarketList) {
  if (!lists) return lists;
  return lists.map((list) => (list.id === nextList.id ? mergeMarketList(list, nextList) : list));
}

export function addListCache(lists: MarketList[] | undefined, nextList: MarketList) {
  const normalized = normalizeMarketList(nextList);
  if (!lists) return lists;
  return [normalized, ...lists.filter((list) => list.id !== normalized.id)];
}

export function removeListCache(lists: MarketList[] | undefined, listId: string) {
  if (!lists) return lists;
  return lists.filter((list) => list.id !== listId);
}

export function groupItemsByCategory<T extends { category?: string | null }>(items: T[]) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const category = item.category?.trim() || "Sem setor";
    const current = groups.get(category) ?? [];
    current.push(item);
    groups.set(category, current);
  }

  const orderedGroups = [...groups.entries()].map(([category, groupedItems]) => ({ category, items: groupedItems }));
  const uncategorized = orderedGroups.find((group) => group.category === "Sem setor");
  return [
    ...orderedGroups.filter((group) => group.category !== "Sem setor"),
    ...(uncategorized ? [uncategorized] : []),
  ];
}

export type ListStatusFilter = "all" | ListItemStatus;
export type ListSortFilter = "default" | "important" | "name_asc" | "name_desc" | "sector" | "status";
export type PurchaseViewFilter = "list" | "cart";
export type RealtimeActor = { userId?: string; name?: string };
export type PurchaseItemRealtimePayload = {
  purchaseId: string;
  item?: PurchaseItem;
  itemId?: string;
  subtotalCalculated?: number;
  status?: string;
  byUserId?: string;
  by?: RealtimeActor;
};
export type ListPurchaseItemChangedPayload = {
  listId: string;
  purchaseId: string;
  action: "created" | "updated" | "deleted";
  item?: PurchaseItem;
  itemId?: string;
  byUserId?: string;
  by?: RealtimeActor;
};

export function matchesListStatus(item: MarketListItem, status: ListStatusFilter) {
  return status === "all" || item.status === status;
}

export function sortListItems(items: MarketListItem[], sort: ListSortFilter) {
  const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
  const statusOrder: Record<ListItemStatus, number> = { pending: 0, at_home: 1, not_needed: 2 };
  const originalIndex = new Map(items.map((item, index) => [item.id, index]));
  const originalOrder = (left: MarketListItem, right: MarketListItem) => (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0);

  return [...items].sort((left, right) => {
    if (sort === "important") return Number(right.important) - Number(left.important) || originalOrder(left, right);
    if (sort === "name_asc") return collator.compare(left.productName, right.productName) || originalOrder(left, right);
    if (sort === "name_desc") return collator.compare(right.productName, left.productName) || originalOrder(left, right);
    if (sort === "sector") return collator.compare(left.category?.trim() || "Sem setor", right.category?.trim() || "Sem setor") || collator.compare(left.productName, right.productName);
    if (sort === "status") return statusOrder[left.status] - statusOrder[right.status] || collator.compare(left.productName, right.productName);
    return originalOrder(left, right);
  });
}

export function upsertById<T extends { id: string }>(items: T[] | undefined, nextItem: T) {
  if (!items) return items;
  return [nextItem, ...items.filter((item) => item.id !== nextItem.id)];
}

export function removeById<T extends { id: string }>(items: T[] | undefined, itemId: string) {
  if (!items) return items;
  return items.filter((item) => item.id !== itemId);
}

export function useDebouncedValue<T>(value: T, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

export const decimalNumber = (message: string) => z.preprocess(parseDecimalInput, z.number().min(0, message));
export const positiveDecimalNumber = (message: string) => z.preprocess(parseDecimalInput, z.number().positive(message));

export const cartItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(2, "Informe um produto"),
  brand: z.string().optional(),
  category: z.string().optional(),
  quantity: positiveDecimalNumber("Quantidade deve ser maior que zero"),
  unit: z.enum(units),
  priceInputMode: z.enum(["unit", "kg", "total"]).default("unit"),
  pricePaid: decimalNumber("Preco deve ser maior ou igual a zero"),
  notes: z.string().optional(),
});

export const finishSchema = z.object({
  marketId: z.string().min(1, "Selecione o mercado"),
  finalPaidAmount: decimalNumber("Valor invalido"),
  notes: z.string().optional(),
});

export type ListForm = z.infer<typeof listSchema>;
export type MarketForm = z.infer<typeof marketSchema>;
export type ProductForm = z.infer<typeof productSchema>;
export type CartItemForm = z.infer<typeof cartItemSchema>;
export type FinishForm = z.infer<typeof finishSchema>;

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
