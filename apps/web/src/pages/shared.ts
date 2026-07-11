import { useEffect, useState } from "react";
import { z } from "zod";
import type { ListItemStatus, Unit } from "@gondly/types";
import {
  calculateItemTotal,
  calculateNormalizedPrice,
  formatBRL as formatSharedBRL,
  formatPricePerUnitLabel,
  parseMoneyToNumber,
  roundMoney as roundSharedMoney,
  safeDecimalToNumber,
  type PriceInputMode as SharedPriceInputMode,
} from "@gondly/utils";
import { unitLabels } from "../components";
import { isNetworkFailure } from "../lib/api";
import { createLocalItemId, type PurchaseItemPayload } from "../lib/offlineQueue";
import type { ListMessage, MarketList, MarketListItem, Purchase, PurchaseItem } from "../types";

export const units = ["un", "kg", "g", "l", "ml", "pacote", "caixa", "outro"] as const;

export const listSchema = z.object({
  name: z.string().min(2, "Informe um nome"),
  description: z.string().optional(),
});

export const marketSchema = z.object({
  name: z.string().min(2, "Informe um nome"),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, "Use a sigla do estado").optional(),
  country: z.string().max(2).optional(),
  postalCode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeId: z.string().optional(),
  notes: z.string().optional(),
});

export function parseDecimalInput(value: unknown) {
  return parseMoneyToNumber(value);
}

export function decimalValue(value: unknown, fallback = 0) {
  return safeDecimalToNumber(value, fallback);
}

export function roundMoney(value: number) {
  return roundSharedMoney(value);
}

export type PriceInputMode = SharedPriceInputMode;

export function isWeightUnit(unit: Unit) {
  return unit === "g" || unit === "kg";
}

export function calculatePurchaseItemTotal(quantity: number, unit: Unit, priceInput: number, priceInputMode: PriceInputMode) {
  return calculateItemTotal(quantity, unit, priceInput, priceInputMode).total;
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
    return `${quantityLabel} · ${formatPricePerUnitLabel(normalizedPrice, item.normalizedUnitLabel)} · Total ${formatBRL(totalPaid)}`;
  }

  const normalized = calculateNormalizedPrice(item.quantity, item.unit, totalPaid);
  if (normalized.unitPriceNormalized != null && normalized.normalizedUnitLabel) {
    return `${quantityLabel} · ${formatPricePerUnitLabel(normalized.unitPriceNormalized, normalized.normalizedUnitLabel)} · Total ${formatBRL(totalPaid)}`;
  }

  const quantity = Number(item.quantity ?? 0);
  const unitPrice = quantity > 0 ? roundMoney(totalPaid / quantity) : totalPaid;
  return `${quantityLabel} · ${formatBRL(unitPrice)} / ${unitLabels[item.unit]} · Total ${formatBRL(totalPaid)}`;
}

export function toPurchaseItemPayload(values: CartItemForm, productName: string): PurchaseItemPayload {
  const pricePaid = calculatePurchaseItemTotal(Number(values.quantity ?? 0), values.unit, Number(values.pricePaid ?? 0), values.priceInputMode);
  const packageSize = typeof values.packageSize === "number" && Number.isFinite(values.packageSize) && values.packageSize > 0 ? values.packageSize : null;
  const brandName = values.brandNameSnapshot?.trim() || values.brand?.trim() || null;

  return {
    productId: values.productId?.trim() || undefined,
    productName,
    brand: brandName,
    brandId: values.brandId?.trim() || null,
    brandNameSnapshot: brandName,
    category: values.category?.trim() || null,
    packageSize,
    packageUnit: packageSize ? values.packageUnit ?? null : null,
    quantity: values.quantity,
    unit: values.unit,
    pricePaid,
    notes: values.notes,
  };
}

export function optimisticCartItem(values: PurchaseItemPayload, id?: string, currentItem?: PurchaseItem): PurchaseItem {
  const normalized = calculateNormalizedPrice(values.quantity, values.unit, values.pricePaid);
  return {
    id: id ?? createLocalItemId(),
    sourceListItemId: currentItem?.sourceListItemId ?? null,
    productId: values.productId ?? null,
    productName: values.productName,
    brand: values.brand || null,
    brandId: values.brandId || null,
    brandNameSnapshot: values.brandNameSnapshot || values.brand || null,
    category: values.category || null,
    packageSize: values.packageSize ?? null,
    packageUnit: values.packageUnit ?? null,
    quantity: values.quantity,
    unit: values.unit,
    pricePaid: values.pricePaid,
    unitPriceNormalized: normalized.unitPriceNormalized,
    normalizedUnitLabel: normalized.normalizedUnitLabel,
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

export function upsertRealtimePurchaseItemCache(
  purchases: Purchase[] | undefined,
  purchaseId: string,
  nextItem: PurchaseItem,
  subtotalCalculated?: number,
  updatedAt?: string,
) {
  if (!purchases) return purchases;

  const normalizedItem = normalizePurchaseItem(nextItem);
  return purchases.map((purchase) => {
    if (purchase.id !== purchaseId) return purchase;

    const exists = purchase.items.some((item) => item.id === normalizedItem.id);
    const items = exists
      ? purchase.items.map((item) => (item.id === normalizedItem.id ? normalizedItem : item))
      : [normalizedItem, ...purchase.items];

    return {
      ...purchase,
      items,
      subtotalCalculated: typeof subtotalCalculated === "number" ? subtotalCalculated : calculatePurchaseSubtotal(items),
      updatedAt: updatedAt ?? purchase.updatedAt,
    };
  });
}

export function removeRealtimePurchaseItemCache(
  purchases: Purchase[] | undefined,
  purchaseId: string,
  itemId: string,
  subtotalCalculated?: number,
  updatedAt?: string,
) {
  if (!purchases) return purchases;

  return purchases.map((purchase) => {
    if (purchase.id !== purchaseId) return purchase;

    const items = purchase.items.filter((item) => item.id !== itemId);
    return {
      ...purchase,
      items,
      subtotalCalculated: typeof subtotalCalculated === "number" ? subtotalCalculated : calculatePurchaseSubtotal(items),
      updatedAt: updatedAt ?? purchase.updatedAt,
    };
  });
}

export function updateRealtimePurchaseTotalCache(
  purchases: Purchase[] | undefined,
  purchaseId: string,
  subtotalCalculated?: number,
  status?: string,
  updatedAt?: string,
) {
  if (!purchases) return purchases;
  if (status && status !== "in_progress") return purchases.filter((purchase) => purchase.id !== purchaseId);

  return purchases.map((purchase) => {
    if (purchase.id !== purchaseId) return purchase;
    return {
      ...purchase,
      subtotalCalculated: typeof subtotalCalculated === "number" ? subtotalCalculated : calculatePurchaseSubtotal(purchase.items),
      updatedAt: updatedAt ?? purchase.updatedAt,
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

export function upsertListItemCache(list: MarketList | undefined, item: MarketListItem) {
  if (!list) return list;

  const normalizedItem = { ...item, important: Boolean(item.important) };
  const exists = list.items.some((entry) => entry.id === normalizedItem.id);
  return {
    ...list,
    items: exists
      ? list.items.map((entry) => (entry.id === normalizedItem.id ? normalizedItem : entry))
      : [normalizedItem, ...list.items],
  };
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

export type RealtimeEnvelope<TPayload = unknown> = {
  eventId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  updatedAt?: string;
  payload?: TPayload;
  actorUserId?: string;
  byUserId?: string;
  by?: RealtimeActor;
};

export type RealtimeApplyState = {
  seenEventIds: Set<string>;
  seenEventOrder: string[];
  entityUpdatedAt: Map<string, number>;
};

export function createRealtimeApplyState(): RealtimeApplyState {
  return {
    seenEventIds: new Set(),
    seenEventOrder: [],
    entityUpdatedAt: new Map(),
  };
}

export function realtimeActorId(payload: Pick<RealtimeEnvelope, "actorUserId" | "byUserId" | "by">) {
  return payload.actorUserId ?? payload.byUserId ?? payload.by?.userId;
}

export function shouldApplyRealtimeEvent(
  state: RealtimeApplyState,
  event: Pick<RealtimeEnvelope, "eventId" | "entityType" | "entityId" | "updatedAt">,
  currentUpdatedAt?: string | null,
  fallback?: { entityType?: string; entityId?: string },
) {
  if (event.eventId) {
    if (state.seenEventIds.has(event.eventId)) return false;
    state.seenEventIds.add(event.eventId);
    state.seenEventOrder.push(event.eventId);
    while (state.seenEventOrder.length > 1000) {
      const staleEventId = state.seenEventOrder.shift();
      if (staleEventId) state.seenEventIds.delete(staleEventId);
    }
  }

  const entityType = event.entityType ?? fallback?.entityType;
  const entityId = event.entityId ?? fallback?.entityId;
  const eventTimestamp = parseRealtimeTimestamp(event.updatedAt);
  if (!entityType || !entityId || eventTimestamp === undefined) return true;

  const entityKey = `${entityType}:${entityId}`;
  const currentTimestamp = parseRealtimeTimestamp(currentUpdatedAt);
  const knownTimestamp = Math.max(state.entityUpdatedAt.get(entityKey) ?? 0, currentTimestamp ?? 0);
  if (knownTimestamp > eventTimestamp) return false;

  state.entityUpdatedAt.set(entityKey, eventTimestamp);
  return true;
}

function parseRealtimeTimestamp(value?: string | null) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export type ListItemRealtimePayload = RealtimeEnvelope<{
  listId: string;
  item?: MarketListItem;
  itemId?: string;
  action?: string;
}> & {
  listId: string;
  item?: MarketListItem;
  itemId?: string;
};

export type PurchaseItemRealtimePayload = RealtimeEnvelope<{
  purchaseId: string;
  item?: PurchaseItem;
  itemId?: string;
  subtotalCalculated?: number;
  purchaseUpdatedAt?: string;
  status?: string;
  purchase?: Purchase;
}> & {
  purchaseId: string;
  item?: PurchaseItem;
  itemId?: string;
  subtotalCalculated?: number;
  purchaseUpdatedAt?: string;
  status?: string;
  purchase?: Purchase;
};
export type ListPurchaseItemChangedPayload = RealtimeEnvelope<{
  listId: string;
  purchaseId: string;
  action: "created" | "updated" | "deleted";
  item?: PurchaseItem;
  itemId?: string;
}> & {
  listId: string;
  purchaseId: string;
  action: "created" | "updated" | "deleted";
  item?: PurchaseItem;
  itemId?: string;
};

export type ListMessageRealtimePayload = RealtimeEnvelope<{ listId: string; message: ListMessage }> & {
  listId: string;
  message: ListMessage;
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

export function upsertListMessageCache(messages: ListMessage[] | undefined, nextMessage: ListMessage) {
  if (!messages) return messages;
  if (messages.some((message) => message.id === nextMessage.id)) return messages;
  return [...messages, nextMessage];
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
export const optionalDecimalNumber = (message: string) =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    return parseDecimalInput(value);
  }, z.number().min(0, message).optional());

export const productSchema = z.object({
  name: z.string().min(2, "Informe um produto"),
  brand: z.string().optional(),
  brandId: z.string().optional(),
  category: z.string().optional(),
  categoryId: z.string().optional(),
  defaultUnit: z.enum(units),
  barcode: z.string().optional(),
  packageSize: optionalDecimalNumber("Tamanho invalido"),
  packageUnit: z.enum(units).optional(),
});

export const cartItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(2, "Informe um produto"),
  brand: z.string().optional(),
  brandId: z.string().optional(),
  brandNameSnapshot: z.string().optional(),
  category: z.string().optional(),
  packageSize: optionalDecimalNumber("Tamanho invalido"),
  packageUnit: z.enum(units).optional(),
  quantity: positiveDecimalNumber("Quantidade deve ser maior que zero"),
  unit: z.enum(units),
  priceInputMode: z.enum(["unit", "kg", "total"]).default("unit"),
  pricePaid: decimalNumber("Preco deve ser maior ou igual a zero"),
  notes: z.string().optional(),
});

export const finishSchema = z.object({
  marketId: z.string().min(1, "Selecione o mercado"),
  finalPaidAmount: decimalNumber("Valor invalido"),
  sharePrices: z.boolean().default(false),
  notes: z.string().optional(),
});

export type ListForm = z.infer<typeof listSchema>;
export type MarketForm = z.infer<typeof marketSchema>;
export type ProductForm = z.infer<typeof productSchema>;
export type CartItemForm = z.infer<typeof cartItemSchema>;
export type FinishForm = z.infer<typeof finishSchema>;

export function formatBRL(value: number) {
  return formatSharedBRL(value);
}
