import { useCallback, useEffect, useState } from "react";
import type { Unit } from "@gondly/types";
import { ApiError, api, isNetworkFailure } from "./api";
import { outboxDelete, outboxGetAll, outboxPut } from "./db";
import { queryClient } from "./queryClient";
import type { Purchase } from "../types";

const OUTBOX_CHANGED_EVENT = "gondly:outbox-changed";
const OUTBOX_SYNC_EVENT = "gondly:outbox-sync";
const OUTBOX_SYNC_INTERVAL = 30_000;

export type PurchaseItemPayload = {
  productId?: string;
  productName: string;
  brand?: string;
  category?: string;
  quantity: number;
  unit: Unit;
  pricePaid: number;
  notes?: string;
};

type PurchaseItemUpsertEntry = {
  id: string;
  type: "purchase-item-upsert";
  purchaseId: string;
  itemId?: string;
  localItemId?: string;
  method: "POST" | "PUT";
  body: PurchaseItemPayload;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastError?: string;
};

type PurchaseItemDeleteEntry = {
  id: string;
  type: "purchase-item-delete";
  purchaseId: string;
  itemId: string;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastError?: string;
};

type OutboxEntry = PurchaseItemUpsertEntry | PurchaseItemDeleteEntry;

let syncRunning = false;

export function createLocalItemId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isLocalId(id: string | undefined | null) {
  return Boolean(id?.startsWith("local-"));
}

export async function queuePurchaseItemUpsert({
  purchaseId,
  itemId,
  localItemId,
  body,
}: {
  purchaseId: string;
  itemId?: string | null;
  localItemId?: string;
  body: PurchaseItemPayload;
}) {
  const now = Date.now();
  const pendingLocalId = localItemId ?? (isLocalId(itemId) ? itemId ?? undefined : undefined);
  const method = itemId && !isLocalId(itemId) ? "PUT" : "POST";
  const id = method === "PUT" ? `purchase-item-upsert:${purchaseId}:${itemId}` : pendingLocalId ?? createLocalItemId();
  const existing = await getOutboxEntry(id);

  await outboxPut<PurchaseItemUpsertEntry>({
    id,
    type: "purchase-item-upsert",
    purchaseId,
    itemId: method === "PUT" ? itemId ?? undefined : undefined,
    localItemId: method === "POST" ? id : undefined,
    method,
    body,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    attempts: existing?.attempts ?? 0,
  });
  notifyOutboxChanged();
}

export async function queuePurchaseItemDelete(purchaseId: string, itemId: string) {
  if (isLocalId(itemId)) {
    await outboxDelete(itemId);
    notifyOutboxChanged();
    return;
  }

  await outboxDelete(`purchase-item-upsert:${purchaseId}:${itemId}`);
  await outboxPut<PurchaseItemDeleteEntry>({
    id: `purchase-item-delete:${purchaseId}:${itemId}`,
    type: "purchase-item-delete",
    purchaseId,
    itemId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: 0,
  });
  notifyOutboxChanged();
}

export async function syncOutbox() {
  if (syncRunning || !navigator.onLine) return;

  syncRunning = true;
  notifySyncChanged(true);

  try {
    const entries = await getOutboxEntries();

    for (const entry of entries) {
      try {
        if (entry.type === "purchase-item-upsert") {
          const purchase =
            entry.method === "POST"
              ? await api<Purchase>(`/purchases/${entry.purchaseId}/items`, { method: "POST", body: entry.body })
              : await api<Purchase>(`/purchases/${entry.purchaseId}/items/${entry.itemId}`, { method: "PUT", body: entry.body });

          queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => reconcilePurchaseCache(current, purchase, entry.localItemId));
          await outboxDelete(entry.id);
        } else {
          const purchase = await api<Purchase>(`/purchases/${entry.purchaseId}/items/${entry.itemId}`, { method: "DELETE" });
          queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => reconcilePurchaseCache(current, purchase));
          await outboxDelete(entry.id);
        }

        notifyOutboxChanged();
      } catch (error) {
        await markOutboxAttempt(entry, error);
        if (isNetworkFailure(error) || (error instanceof ApiError && error.status >= 500)) break;
      }
    }
  } finally {
    syncRunning = false;
    notifySyncChanged(false);
  }
}

export function installOfflineQueueSync() {
  if (typeof window === "undefined") return () => undefined;

  const run = () => {
    if (document.visibilityState !== "hidden") void syncOutbox();
  };

  const startupSync = window.setTimeout(run, 2_000);
  const interval = window.setInterval(run, OUTBOX_SYNC_INTERVAL);
  window.addEventListener("online", run);
  window.addEventListener("visibilitychange", run);

  return () => {
    window.clearTimeout(startupSync);
    window.clearInterval(interval);
    window.removeEventListener("online", run);
    window.removeEventListener("visibilitychange", run);
  };
}

export function useOutboxStatus(purchaseId?: string) {
  const [status, setStatus] = useState({ pendingCount: 0, failedCount: 0, isSyncing: syncRunning });

  const refresh = useCallback(async () => {
    const entries = await getOutboxEntries();
    const filtered = purchaseId ? entries.filter((entry) => entry.purchaseId === purchaseId) : entries;
    setStatus({
      pendingCount: filtered.length,
      failedCount: filtered.filter((entry) => Boolean(entry.lastError)).length,
      isSyncing: syncRunning,
    });
  }, [purchaseId]);

  useEffect(() => {
    void refresh();
    window.addEventListener(OUTBOX_CHANGED_EVENT, refresh);
    window.addEventListener(OUTBOX_SYNC_EVENT, refresh);
    return () => {
      window.removeEventListener(OUTBOX_CHANGED_EVENT, refresh);
      window.removeEventListener(OUTBOX_SYNC_EVENT, refresh);
    };
  }, [refresh]);

  return { ...status, syncNow: syncOutbox };
}

async function getOutboxEntry(id: string) {
  return (await getOutboxEntries()).find((entry) => entry.id === id);
}

async function getOutboxEntries() {
  const entries = await outboxGetAll<OutboxEntry>();
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

async function markOutboxAttempt(entry: OutboxEntry, error: unknown) {
  const message = error instanceof Error ? error.message : "Falha ao sincronizar";
  await outboxPut<OutboxEntry>({
    ...entry,
    attempts: entry.attempts + 1,
    updatedAt: Date.now(),
    lastError: message,
  });
  notifyOutboxChanged();
}

function notifyOutboxChanged() {
  window.dispatchEvent(new CustomEvent(OUTBOX_CHANGED_EVENT));
}

function notifySyncChanged(isSyncing: boolean) {
  window.dispatchEvent(new CustomEvent(OUTBOX_SYNC_EVENT, { detail: { isSyncing } }));
}

function reconcilePurchaseCache(purchases: Purchase[] | undefined, nextPurchase: Purchase, completedLocalItemId?: string) {
  if (!purchases) return purchases;

  return purchases.map((purchase) => {
    if (purchase.id !== nextPurchase.id) return purchase;

    const pendingLocalItems = purchase.items.filter((item) => item.id.startsWith("local-") && item.id !== completedLocalItemId);
    const items = [...pendingLocalItems, ...nextPurchase.items];

    return {
      ...nextPurchase,
      items,
      subtotalCalculated: roundMoney(items.reduce((sum, entry) => sum + Number(entry.pricePaid ?? 0), 0)),
    };
  });
}

export function removePurchaseItemCache(purchases: Purchase[] | undefined, purchaseId: string, itemId: string) {
  if (!purchases) return purchases;

  return purchases.map((purchase) => {
    if (purchase.id !== purchaseId) return purchase;

    const items = purchase.items.filter((entry) => entry.id !== itemId);
    return {
      ...purchase,
      items,
      subtotalCalculated: roundMoney(items.reduce((sum, entry) => sum + Number(entry.pricePaid ?? 0), 0)),
    };
  });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
