import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, Plus, ShoppingCart, Tags, X } from "lucide-react";
import { AppButton, EmptyState, LoadingState, ScreenContainer, SearchBar } from "../../components";
import { trackEvent, trackSafeSearch } from "../../lib/analytics";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { discardQueuedPurchaseChanges, useOutboxStatus } from "../../lib/offlineQueue";
import { createRealtimeSocket } from "../../lib/realtime";
import type { Purchase, PurchaseItem } from "../../types";
import {
  formatBRL,
  groupItemsByCategory,
  PurchaseItemRealtimePayload,
  PurchaseViewFilter,
  purchaseItemPriceDescription,
  removeActivePurchaseCache,
  removeRealtimePurchaseItemCache,
  updateRealtimePurchaseTotalCache,
  upsertRealtimePurchaseItemCache,
  useDebouncedValue,
} from "../shared";

export function ActivePurchasePage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseView, setPurchaseView] = useState<PurchaseViewFilter>("list");
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);
  const [showStickySummary, setShowStickySummary] = useState(false);
  const [expandedPurchaseCategories, setExpandedPurchaseCategories] = useState<Set<string>>(() => new Set());
  const debouncedPurchaseSearch = useDebouncedValue(purchaseSearch);
  const totalCardRef = useRef<HTMLDivElement | null>(null);
  const realtimeNoticeTimeoutRef = useRef<number | undefined>(undefined);
  const realtimeRefetchTimeoutRef = useRef<number | undefined>(undefined);
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId");
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const purchase = useMemo(() => active.data?.find((entry) => entry.id === purchaseId) ?? active.data?.[0], [active.data, purchaseId]);
  const outbox = useOutboxStatus(purchase?.id);
  const cancel = useMutation({
    mutationFn: () => api<Purchase>(`/purchases/${purchase?.id}/cancel`, { method: "POST" }),
    onSuccess: (cancelled) => {
      void discardQueuedPurchaseChanges(cancelled.id);
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => removeActivePurchaseCache(current, cancelled.id));
      trackEvent("cancel_purchase", {
        purchase_id: cancelled.id,
        source: "active_purchase",
        items_count: cancelled.items.length,
        cart_items_count: cancelled.items.filter((item) => Number(item.pricePaid ?? 0) > 0).length,
      });
    },
  });

  useEffect(() => {
    if (!purchase?.id || !token) return;

    const socket = createRealtimeSocket(token);
    const schedulePurchaseRefetch = () => {
      if (realtimeRefetchTimeoutRef.current) window.clearTimeout(realtimeRefetchTimeoutRef.current);
      realtimeRefetchTimeoutRef.current = window.setTimeout(() => {
        void queryClient.refetchQueries({ queryKey: ["active-purchases"], type: "active" });
      }, 350);
    };
    const notifyIfFromAnotherUser = (payload: PurchaseItemRealtimePayload, message: string) => {
      const actorId = payload.byUserId ?? payload.by?.userId;
      if (!actorId || actorId === user?.id) return;

      const actorName = payload.by?.name;
      setRealtimeNotice(actorName ? `${actorName}: ${message}` : message);
      if (realtimeNoticeTimeoutRef.current) window.clearTimeout(realtimeNoticeTimeoutRef.current);
      realtimeNoticeTimeoutRef.current = window.setTimeout(() => setRealtimeNotice(null), 4_000);
    };
    const refreshPurchase = (payload?: PurchaseItemRealtimePayload) => {
      if (!payload || payload.purchaseId === purchase.id) schedulePurchaseRefetch();
    };
    const handlePurchaseItemCreated = (payload: PurchaseItemRealtimePayload) => {
      if (payload.purchaseId !== purchase.id || !payload.item) return;
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => upsertRealtimePurchaseItemCache(current, purchase.id, payload.item!));
      notifyIfFromAnotherUser(payload, `${payload.item.productName} foi adicionado ao carrinho.`);
      schedulePurchaseRefetch();
    };
    const handlePurchaseItemUpdated = (payload: PurchaseItemRealtimePayload) => {
      if (payload.purchaseId !== purchase.id || !payload.item) return;
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => upsertRealtimePurchaseItemCache(current, purchase.id, payload.item!));
      notifyIfFromAnotherUser(payload, `${payload.item.productName} foi atualizado no carrinho.`);
      schedulePurchaseRefetch();
    };
    const handlePurchaseItemDeleted = (payload: PurchaseItemRealtimePayload) => {
      if (payload.purchaseId !== purchase.id || !payload.itemId) return;
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => removeRealtimePurchaseItemCache(current, purchase.id, payload.itemId!));
      notifyIfFromAnotherUser(payload, "Um item foi removido do carrinho.");
      schedulePurchaseRefetch();
    };
    const handlePurchaseTotalUpdated = (payload: PurchaseItemRealtimePayload) => {
      if (payload.purchaseId !== purchase.id) return;
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) =>
        updateRealtimePurchaseTotalCache(current, purchase.id, payload.subtotalCalculated, payload.status),
      );
      schedulePurchaseRefetch();
    };
    socket.on("connect", () => socket.emit("joinPurchase", { purchaseId: purchase.id }));
    socket.on("purchaseItemsSynced", refreshPurchase);
    socket.on("purchaseItemCreated", handlePurchaseItemCreated);
    socket.on("purchaseItemUpdated", handlePurchaseItemUpdated);
    socket.on("purchaseItemDeleted", handlePurchaseItemDeleted);
    socket.on("purchaseTotalUpdated", handlePurchaseTotalUpdated);

    return () => {
      socket.emit("leavePurchase", { purchaseId: purchase.id });
      socket.off("purchaseItemsSynced", refreshPurchase);
      socket.off("purchaseItemCreated", handlePurchaseItemCreated);
      socket.off("purchaseItemUpdated", handlePurchaseItemUpdated);
      socket.off("purchaseItemDeleted", handlePurchaseItemDeleted);
      socket.off("purchaseTotalUpdated", handlePurchaseTotalUpdated);
      socket.disconnect();
      if (realtimeRefetchTimeoutRef.current) window.clearTimeout(realtimeRefetchTimeoutRef.current);
    };
  }, [purchase?.id, queryClient, token, user?.id]);

  useEffect(() => {
    return () => {
      if (realtimeNoticeTimeoutRef.current) window.clearTimeout(realtimeNoticeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setPurchaseSearch("");
    setExpandedPurchaseCategories(new Set());
    setShowStickySummary(false);
  }, [purchase?.id]);

  useEffect(() => {
    trackSafeSearch("purchase", debouncedPurchaseSearch);
  }, [debouncedPurchaseSearch]);

  useEffect(() => {
    const node = totalCardRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => setShowStickySummary(!entry.isIntersecting), { threshold: 0.15 });
    observer.observe(node);

    return () => observer.disconnect();
  }, [purchase?.id]);

  if (active.isLoading) return <LoadingState />;
  if (!purchase) {
    return (
      <ScreenContainer title="Compra ativa">
        <EmptyState title="Adicione produtos ao carrinho para começar sua compra." action={<AppButton onClick={() => navigate("/app/purchase/start")}>Iniciar compra</AppButton>} />
      </ScreenContainer>
    );
  }
  const cartItemsCount = purchase.items.filter((item) => Number(item.pricePaid ?? 0) > 0).length;
  const cartItemsLabel = `${cartItemsCount} ${cartItemsCount === 1 ? "produto" : "produtos"} no carrinho`;
  const visiblePurchaseItems = purchaseView === "cart" ? purchase.items.filter((item) => Number(item.pricePaid ?? 0) > 0) : purchase.items;
  const normalizedPurchaseSearch = purchaseSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredPurchaseItems = visiblePurchaseItems.filter(
    (item) =>
      !normalizedPurchaseSearch ||
      item.productName.toLocaleLowerCase("pt-BR").includes(normalizedPurchaseSearch) ||
      item.brand?.toLocaleLowerCase("pt-BR").includes(normalizedPurchaseSearch) ||
      item.category?.toLocaleLowerCase("pt-BR").includes(normalizedPurchaseSearch),
  );
  const groupedPurchaseItems = groupItemsByCategory(filteredPurchaseItems);

  function togglePurchaseCategory(category: string) {
    setExpandedPurchaseCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const purchaseTitle = purchase.sourceList?.name ?? "Compra sem lista";
  const cartItemsShortLabel = `${cartItemsCount} ${cartItemsCount === 1 ? "item" : "itens"}`;

  return (
    <ScreenContainer
      title={purchaseTitle}
      subtitle={`Compra ativa · ${cartItemsLabel}`}
      headerAction={
        <button
          type="button"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-mint px-3 text-xs font-black text-white shadow-soft transition hover:bg-mint/90 active:scale-[0.98]"
          onClick={() => navigate(`/app/purchase/${purchase.id}/item`)}
        >
          <Plus className="h-4 w-4" />
          Item
        </button>
      }
    >
      {showStickySummary ? (
        <div className="fixed inset-x-0 top-0 z-40 border-b border-line bg-white/95 pt-[env(safe-area-inset-top)] shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-ink">{purchaseTitle}</p>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-ink/60">
                {formatBRL(purchase.subtotalCalculated)} · {cartItemsShortLabel}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 flex-none items-center justify-center rounded-xl bg-mint px-3 text-xs font-black text-white shadow-soft transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => navigate(`/app/purchase/${purchase.id}/finish`)}
              disabled={outbox.pendingCount > 0}
            >
              Finalizar
            </button>
          </div>
        </div>
      ) : null}

      <div ref={totalCardRef} className="rounded-3xl bg-ink p-4 text-white shadow-[0_18px_46px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Total atual</p>
            <p className="mt-1.5 text-3xl font-black tracking-[-0.055em]">{formatBRL(purchase.subtotalCalculated)}</p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">{cartItemsShortLabel}</span>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-mint text-white shadow-[0_14px_30px_rgba(79,70,229,0.34)]">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-white/60">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-white/20 text-[11px] font-black">i</span>
          Estimativa antes do caixa
        </p>
      </div>

      <div className="mt-3 grid grid-cols-[1.45fr_1fr] gap-2">
        <AppButton
          variant="primary"
          icon={<Check className="h-4 w-4" />}
          onClick={() => navigate(`/app/purchase/${purchase.id}/finish`)}
          disabled={outbox.pendingCount > 0}
        >
          Finalizar compra
        </AppButton>
        <AppButton variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => cancel.mutate()} loading={cancel.isPending} loadingLabel="Cancelando">
          Cancelar
        </AppButton>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-sm" role="tablist" aria-label="Alternar entre lista e carrinho">
        <button
          type="button"
          className={[
            "flex h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm font-black transition",
            purchaseView === "list" ? "bg-mint text-white shadow-soft" : "bg-white text-ink hover:bg-paper",
          ].join(" ")}
          onClick={() => setPurchaseView("list")}
          role="tab"
          aria-selected={purchaseView === "list"}
        >
          <span>Lista</span>
          <span className={["rounded-full px-2 py-0.5 text-[11px] font-black", purchaseView === "list" ? "bg-white/15 text-white" : "bg-paper text-ink/60"].join(" ")}>
            {purchase.items.length}
          </span>
        </button>
        <button
          type="button"
          className={[
            "flex h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm font-black transition",
            purchaseView === "cart" ? "bg-mint text-white shadow-soft" : "bg-white text-ink hover:bg-paper",
          ].join(" ")}
          onClick={() => setPurchaseView("cart")}
          role="tab"
          aria-selected={purchaseView === "cart"}
        >
          <span>Carrinho</span>
          <span className={["rounded-full px-2 py-0.5 text-[11px] font-black", purchaseView === "cart" ? "bg-white/15 text-white" : "bg-paper text-ink/60"].join(" ")}>
            {cartItemsCount}
          </span>
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-white p-2 shadow-sm">
        <SearchBar
          placeholder="Buscar produto, marca ou categoria"
          value={purchaseSearch}
          onChange={(event) => setPurchaseSearch(event.target.value)}
        />
      </div>

      {outbox.pendingCount > 0 ? (
        <div className="mt-3 rounded-xl border border-line bg-white p-3 text-sm font-semibold text-ink shadow-sm">
          {outbox.isSyncing ? "Sincronizando alterações do carrinho..." : `${outbox.pendingCount} alteração(ões) aguardando sinal.`}
          <button type="button" className="ml-2 font-black underline" onClick={() => void outbox.syncNow()}>
            Sincronizar
          </button>
        </div>
      ) : null}
      {realtimeNotice ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-mint/20 bg-mint/10 p-3 text-sm font-bold text-mint shadow-sm" role="status" aria-live="polite">
          <Check className="h-4 w-4 flex-none" />
          <span>{realtimeNotice}</span>
        </div>
      ) : null}

      {purchaseView === "cart" && cartItemsCount === 0 ? (
        <div className="mt-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <p className="text-base font-black tracking-[-0.02em] text-ink">Seu carrinho ainda está vazio.</p>
          <p className="mt-1 text-sm leading-6 text-ink/60">Adicione produtos conforme for comprando.</p>
          <AppButton className="mt-4" icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/app/purchase/${purchase.id}/item`)}>
            Adicionar primeiro item
          </AppButton>
        </div>
      ) : null}

      <div className="mt-3 space-y-2.5">
        {purchaseView === "list" && !purchase.items.length ? <EmptyState title="A lista desta compra está vazia." /> : null}
        {visiblePurchaseItems.length > 0 && !filteredPurchaseItems.length ? <EmptyState title="Nenhum produto encontrado." /> : null}
        {groupedPurchaseItems.map((group) => {
          const expanded = Boolean(normalizedPurchaseSearch) || expandedPurchaseCategories.has(group.category);
          const categoryId = `purchase-category-${group.category.replace(/\W+/g, "-").toLowerCase()}`;

          return (
            <section
              key={group.category}
              className={[
                "overflow-hidden rounded-2xl border bg-white shadow-sm transition",
                expanded ? "border-[#C7D2FE] ring-1 ring-[#C7D2FE]/70" : "border-line",
              ].join(" ")}
            >
              <button
                type="button"
                className={[
                  "flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-ink transition",
                  expanded ? "bg-[#EEF2FF]" : "bg-white hover:bg-paper",
                ].join(" ")}
                onClick={() => togglePurchaseCategory(group.category)}
                aria-expanded={expanded}
                aria-controls={categoryId}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-black">
                  <Tags className="h-4 w-4 flex-none text-mint" />
                  <span className="truncate">{group.category}</span>
                </span>
                <span className="flex flex-none items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-mint shadow-sm">{group.items.length}</span>
                  {expanded ? <ChevronDown className="h-4 w-4 text-ink/60" /> : <ChevronRight className="h-4 w-4 text-ink/45" />}
                </span>
              </button>
              {expanded ? (
                <div id={categoryId} className="divide-y divide-line/80 border-t border-line bg-white">
                  {group.items.map((item) => (
                    <ActivePurchaseItemRow key={item.id} purchaseId={purchase.id} item={item} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </ScreenContainer>
  );
}

function ActivePurchaseItemRow({ purchaseId, item }: { purchaseId: string; item: PurchaseItem }) {
  const navigate = useNavigate();
  const isPending = item.id.startsWith("local-");
  const pricePaid = Number(item.pricePaid ?? 0);
  const added = Number(item.pricePaid ?? 0) > 0;
  const itemMeta = purchaseItemPriceDescription(item);

  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-paper/80 active:bg-paper"
      onClick={() => navigate(`/app/purchase/${purchaseId}/item?itemId=${item.id}`)}
      aria-label={added ? `Editar ${item.productName} no carrinho` : `Adicionar ${item.productName} ao carrinho`}
    >
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-black tracking-[-0.01em] text-ink">{item.productName}</span>
          {isPending ? <span className="rounded-full bg-mint/10 px-2 py-0.5 text-[10px] font-black text-mint">Pendente</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs font-medium text-ink/55">{itemMeta}</span>
      </span>
      <span className="flex flex-none flex-col items-end gap-1">
        <span
          className={[
            "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-black transition",
            added ? "bg-emerald-50 text-emerald-700" : "border border-mint/35 bg-white text-mint shadow-sm",
          ].join(" ")}
        >
          {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {added ? "Adicionado" : "Adicionar"}
        </span>
        {added ? <span className="pr-1 text-xs font-black text-ink">{formatBRL(pricePaid)}</span> : null}
      </span>
    </button>
  );
}
