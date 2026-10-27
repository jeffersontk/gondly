import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { useAuth } from "../../lib/auth";
import { createRealtimeSocket } from "../../lib/realtime";
import { invalidatePurchaseReports } from "../../lib/purchaseReportCache";
import type { Purchase } from "../../types";
import {
  createRealtimeApplyState,
  PurchaseItemRealtimePayload,
  realtimeActorId,
  removeRealtimePurchaseItemCache,
  shouldApplyRealtimeEvent,
  updateRealtimePurchaseTotalCache,
  upsertRealtimePurchaseItemCache,
} from "../shared";

const NOTICE_DURATION = 4_000;
const REFETCH_DEBOUNCE = 350;

/**
 * Keeps the ["active-purchases"] cache of one purchase in sync with the other participants and exposes short
 * notices about what they did. Also joins the source list room so the list chat works on the purchase screen.
 */
export function usePurchaseRealtime(purchaseId: string | undefined, sourceListId: string | undefined) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [endedNotice, setEndedNotice] = useState<string | null>(null);
  const noticeTimeoutRef = useRef<number | undefined>(undefined);
  const refetchTimeoutRef = useRef<number | undefined>(undefined);
  const applyStateRef = useRef(createRealtimeApplyState());

  useEffect(() => {
    if (!purchaseId || !token) return;

    const nextSocket = createRealtimeSocket(token);
    setSocket(nextSocket);

    const scheduleRefetch = () => {
      if (refetchTimeoutRef.current) window.clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = window.setTimeout(() => {
        void queryClient.refetchQueries({ queryKey: ["active-purchases"], type: "active" });
      }, REFETCH_DEBOUNCE);
    };
    const showNotice = (payload: PurchaseItemRealtimePayload, message: string) => {
      const actorId = realtimeActorId(payload);
      if (!actorId || actorId === user?.id) return;

      setNotice(payload.by?.name ? `${payload.by.name}: ${message}` : message);
      if (noticeTimeoutRef.current) window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = window.setTimeout(() => setNotice(null), NOTICE_DURATION);
    };
    // Applies an item change to the cache, ignoring duplicated or stale events. Returns whether it was applied.
    const applyItemChange = (payload: PurchaseItemRealtimePayload, itemId: string, deleted: boolean) => {
      const updatedAt = payload.purchaseUpdatedAt ?? payload.purchase?.updatedAt ?? payload.updatedAt;
      let handled = false;
      let applied = false;
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => {
        const currentPurchase = current?.find((entry) => entry.id === purchaseId);
        if (!currentPurchase) return current;

        handled = true;
        const currentItem = currentPurchase.items.find((entry) => entry.id === itemId);
        if (!shouldApplyRealtimeEvent(applyStateRef.current, payload, currentItem?.updatedAt, { entityType: "purchaseItem", entityId: itemId })) {
          return current;
        }

        applied = true;
        return deleted
          ? removeRealtimePurchaseItemCache(current, purchaseId, itemId, payload.subtotalCalculated, updatedAt)
          : upsertRealtimePurchaseItemCache(current, purchaseId, payload.item!, payload.subtotalCalculated, updatedAt);
      });
      if (!handled) scheduleRefetch();
      return applied;
    };

    const handleItemUpsert = (message: (payload: PurchaseItemRealtimePayload, productName: string) => string) => (payload: PurchaseItemRealtimePayload) => {
      if (payload.purchaseId !== purchaseId || !payload.item) return;
      if (applyItemChange(payload, payload.item.id, false)) showNotice(payload, message(payload, payload.item.productName));
    };
    const handleItemCreated = handleItemUpsert((_payload, name) => `${name} foi adicionado ao carrinho.`);
    const handleItemUpdated = handleItemUpsert((payload, name) =>
      payload.action === "claimed" ? `vai pegar ${name}.` : payload.action === "unclaimed" ? `não vai mais pegar ${name}.` : `${name} foi atualizado no carrinho.`,
    );
    const handleItemDeleted = (payload: PurchaseItemRealtimePayload) => {
      if (payload.purchaseId !== purchaseId || !payload.itemId) return;
      if (applyItemChange(payload, payload.itemId, true)) showNotice(payload, "Um item foi removido do carrinho.");
    };
    const handleItemsSynced = (payload?: PurchaseItemRealtimePayload) => {
      if (!payload || payload.purchaseId === purchaseId) scheduleRefetch();
    };
    const handleTotalUpdated = (payload: PurchaseItemRealtimePayload) => {
      if (payload.purchaseId !== purchaseId) return;
      if (payload.status === "completed") void invalidatePurchaseReports(queryClient);
      if (payload.status && payload.status !== "in_progress" && realtimeActorId(payload) !== user?.id) {
        const actorName = payload.by?.name ?? "Outro participante";
        setEndedNotice(`${actorName} ${payload.status === "completed" ? "finalizou" : "cancelou"} esta compra.`);
      }
      if (typeof payload.subtotalCalculated !== "number" && !payload.status) {
        scheduleRefetch();
        return;
      }

      const updatedAt = payload.purchase?.updatedAt ?? payload.purchaseUpdatedAt ?? payload.updatedAt;
      let handled = false;
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => {
        const currentPurchase = current?.find((entry) => entry.id === purchaseId);
        if (!currentPurchase) return current;

        handled = true;
        if (!shouldApplyRealtimeEvent(applyStateRef.current, payload, currentPurchase.updatedAt, { entityType: "purchase", entityId: purchaseId })) {
          return current;
        }
        return updateRealtimePurchaseTotalCache(current, purchaseId, payload.subtotalCalculated, payload.status, updatedAt);
      });
      if (!handled) scheduleRefetch();
    };

    let hasConnected = false;
    nextSocket.on("connect", () => {
      nextSocket.emit("joinPurchase", { purchaseId });
      if (sourceListId) nextSocket.emit("joinList", { listId: sourceListId });
      // Events emitted while the socket was down (screen locked, weak signal) are lost, so resync after reconnecting.
      if (hasConnected) scheduleRefetch();
      hasConnected = true;
    });
    nextSocket.on("purchaseItemsSynced", handleItemsSynced);
    nextSocket.on("purchaseItemCreated", handleItemCreated);
    nextSocket.on("purchaseItemUpdated", handleItemUpdated);
    nextSocket.on("purchaseItemDeleted", handleItemDeleted);
    nextSocket.on("purchaseTotalUpdated", handleTotalUpdated);

    return () => {
      nextSocket.emit("leavePurchase", { purchaseId });
      if (sourceListId) nextSocket.emit("leaveList", { listId: sourceListId });
      nextSocket.removeAllListeners();
      nextSocket.disconnect();
      setSocket(undefined);
      if (refetchTimeoutRef.current) window.clearTimeout(refetchTimeoutRef.current);
    };
  }, [purchaseId, queryClient, sourceListId, token, user?.id]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) window.clearTimeout(noticeTimeoutRef.current);
    };
  }, []);

  return { socket, notice, endedNotice };
}
