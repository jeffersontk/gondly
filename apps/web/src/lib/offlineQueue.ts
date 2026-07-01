import { useCallback, useEffect, useState } from "react";
import type { Unit } from "@gondly/types";
import { roundMoney } from "@gondly/utils";
import { ApiError, api, getStoredToken, isNetworkFailure } from "./api";
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

type OutboxEntry = PurchaseItemUpsertEntry;
type StoredOutboxEntry = OutboxEntry | { id: string; type: string; createdAt: number };

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

export async function discardQueuedPurchaseChanges(purchaseId: string) {
  const entries = await getOutboxEntries();
  const purchaseEntries = entries.filter((entry) => entry.purchaseId === purchaseId);
  await Promise.all(purchaseEntries.map((entry) => outboxDelete(entry.id)));
  if (purchaseEntries.length) notifyOutboxChanged();
}

export async function syncOutbox() {
  if (syncRunning || !navigator.onLine || !getStoredToken()) return;

  syncRunning = true;
  notifySyncChanged(true);

  try {
    let entries = await getOutboxEntries();
    if (!entries.length) return;

    const activePurchases = await queryClient.fetchQuery({
      queryKey: ["active-purchases"],
      queryFn: () => api<Purchase[]>("/purchases/active"),
      staleTime: 0,
      retry: false,
    });
    const activePurchaseIds = new Set(activePurchases.map((purchase) => purchase.id));
    const obsoleteEntries = entries.filter((entry) => !activePurchaseIds.has(entry.purchaseId));

    if (obsoleteEntries.length) {
      await Promise.all(obsoleteEntries.map((entry) => outboxDelete(entry.id)));
      notifyOutboxChanged();
      entries = entries.filter((entry) => activePurchaseIds.has(entry.purchaseId));
    }

    for (const entry of entries) {
      try {
        const purchase =
          entry.method === "POST"
            ? await api<Purchase>(`/purchases/${entry.purchaseId}/items`, { method: "POST", body: entry.body })
            : await api<Purchase>(`/purchases/${entry.purchaseId}/items/${entry.itemId}`, { method: "PUT", body: entry.body });

        queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => reconcilePurchaseCache(current, purchase, entry.localItemId));
        await outboxDelete(entry.id);

        notifyOutboxChanged();
      } catch (error) {
        if (isObsoleteQueuedWrite(error)) {
          await outboxDelete(entry.id);
          queryClient.invalidateQueries({ queryKey: ["active-purchases"] });
          notifyOutboxChanged();
          continue;
        }

        await markOutboxAttempt(entry, error);
        if (
          isNetworkFailure(error) ||
          (error instanceof ApiError && (error.status === 401 || error.status === 408 || error.status === 429 || error.status >= 500))
        ) {
          break;
        }
      }
    }
  } finally {
    syncRunning = false;
    notifySyncChanged(false);
  }
}

function isObsoleteQueuedWrite(error: unknown) {
  if (!(error instanceof ApiError)) return false;

  return error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status);
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
  const entries = await outboxGetAll<StoredOutboxEntry>();
  const obsoleteEntries = entries.filter((entry) => entry.type !== "purchase-item-upsert");
  if (obsoleteEntries.length) {
    await Promise.all(obsoleteEntries.map((entry) => outboxDelete(entry.id)));
    notifyOutboxChanged();
  }

  return entries
    .filter((entry): entry is OutboxEntry => entry.type === "purchase-item-upsert")
    .sort((a, b) => a.createdAt - b.createdAt);
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
