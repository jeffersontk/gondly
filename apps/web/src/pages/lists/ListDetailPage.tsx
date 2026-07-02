import { Fragment, lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Menu, Plus, ShoppingCart, SlidersHorizontal, Star, Tags, Trash2 } from "lucide-react";
import type { ListItemStatus } from "@gondly/types";
import { AppButton, ConfirmDialog, EmptyState, ErrorState, ListItemRow, LoadingState, PriceCard, ScreenContainer, SectionHeader } from "../../components";
import { trackEvent, trackSafeSearch } from "../../lib/analytics";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { ParsedShoppingList } from "../../lib/listImport";
import { discardQueuedPurchaseChanges } from "../../lib/offlineQueue";
import { createRealtimeSocket } from "../../lib/realtime";
import type { ListInvite, MarketList, MarketListItem, Purchase } from "../../types";
import {
  addListCache,
  createRealtimeApplyState,
  groupItemsByCategory,
  ListItemRealtimePayload,
  ListPurchaseItemChangedPayload,
  ListSortFilter,
  ListStatusFilter,
  matchesListStatus,
  normalizeMarketList,
  realtimeActorId,
  removeRealtimePurchaseItemCache,
  removeListCache,
  removeListItemCache,
  setActivePurchaseCache,
  shouldApplyRealtimeEvent,
  sortListItems,
  updateListItemCache,
  updateListsCache,
  upsertListItemCache,
  upsertRealtimePurchaseItemCache,
  useDebouncedValue,
} from "../shared";
import { ListActionsDrawer } from "./ListActionsDrawer";
import { ListFiltersDrawer } from "./ListFiltersDrawer";
import { ListSharingPanel } from "./SharedListMembers";

const ListImportPanel = lazy(() =>
  import("./ListImportPanel").then((module) => ({
    default: module.ListImportPanel,
  })),
);

export function ListDetailPage() {
  const { id = "" } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedShoppingList | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ListStatusFilter>("all");
  const [sortFilter, setSortFilter] = useState<ListSortFilter>("default");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [listRealtimeNotice, setListRealtimeNotice] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => new Set());
  const [replacePurchaseOpen, setReplacePurchaseOpen] = useState(false);
  const debouncedItemSearch = useDebouncedValue(itemSearch);
  const listRealtimeNoticeTimeoutRef = useRef<number | undefined>(undefined);
  const realtimeStateRef = useRef(createRealtimeApplyState());
  const list = useQuery({ queryKey: ["list", id], queryFn: () => api<MarketList>(`/lists/${id}`), enabled: Boolean(id) });
  const activePurchases = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const activePurchase = activePurchases.data?.[0];
  const removeItem = useMutation({
    mutationFn: (itemId: string) => api<MarketListItem>(`/lists/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: (_item, itemId) => queryClient.setQueryData<MarketList>(["list", id], (current) => removeListItemCache(current, itemId)),
  });
  const archive = useMutation({
    mutationFn: () => api<MarketList>(`/lists/${id}/archive`, { method: "POST" }),
    onSuccess: (archived) => {
      queryClient.setQueryData(["list", id], archived);
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => updateListsCache(current, archived));
      setActionsOpen(false);
    },
  });
  const duplicate = useMutation({
    mutationFn: () => api<MarketList>(`/lists/${id}/duplicate`, { method: "POST" }),
    onSuccess: (copy) => {
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => addListCache(current, copy));
      trackEvent("duplicate_list", {
        list_id: id,
        source: "list_detail",
        items_count: copy.items.length,
      });
      navigate(`/app/lists/${copy.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/lists/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["list", id] });
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => removeListCache(current, id));
      navigate("/app/lists");
    },
  });
  const setItemState = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: ListItemStatus }) =>
      api<MarketListItem>(`/lists/${id}/items/${itemId}/state`, { method: "PATCH", body: { status } }),
    onSuccess: (item) => {
      queryClient.setQueryData<MarketList>(["list", id], (current) => updateListItemCache(current, item));
      void queryClient.invalidateQueries({ queryKey: ["active-purchases"] });
    },
  });
  const setItemImportant = useMutation({
    mutationFn: ({ itemId, important }: { itemId: string; important: boolean }) =>
      api<MarketListItem>(`/lists/${id}/items/${itemId}/important`, { method: "PATCH", body: { important } }),
    onSuccess: (item) => {
      queryClient.setQueryData<MarketList>(["list", id], (current) => updateListItemCache(current, item));
    },
  });
  const start = useMutation({
    mutationFn: (payload: { sourceListId: string; cancelActive?: boolean }) =>
      api<Purchase>("/purchases/start", { method: "POST", body: payload }),
    onSuccess: (purchase, variables) => {
      if (variables.cancelActive && activePurchase) {
        void discardQueuedPurchaseChanges(activePurchase.id);
      }
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => setActivePurchaseCache(current, purchase));
      setReplacePurchaseOpen(false);
      trackEvent("start_purchase", {
        purchase_id: purchase.id,
        source: "list_detail",
        has_source_list: true,
        items_count: purchase.items.length,
        cart_items_count: purchase.items.filter((item) => Number(item.pricePaid ?? 0) > 0).length,
      });
      navigate(`/app/purchase/${purchase.id}`);
    },
  });
  const importItems = useMutation({
    mutationFn: (preview: ParsedShoppingList) =>
      api<MarketList>(`/lists/${id}/items/import`, { method: "POST", body: { items: preview.items } }),
    onSuccess: (imported) => {
      queryClient.setQueryData(["list", id], imported);
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => updateListsCache(current, imported));
      setImportPreview(null);
      setImportError(null);
      setShowImport(false);
      trackEvent("add_item_to_list", {
        list_id: id,
        source: "import",
        items_count: imported.items.length,
      });
    },
    onError: () => {
      setImportError("Não foi possível importar os itens. Tente novamente.");
    },
  });

  async function handleImportFile(file: File) {
    setImportParsing(true);
    setImportError(null);
    setImportPreview(null);
    try {
      const { parseShoppingListFile } = await import("../../lib/listImport");
      setImportPreview(await parseShoppingListFile(file));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    } finally {
      setImportParsing(false);
    }
  }

  const shareLink = useMutation({
    mutationFn: () => api<ListInvite>(`/lists/${id}/share-link`, { method: "POST" }),
    onSuccess: (invite) => {
      queryClient.setQueryData<MarketList>(["list", id], (current) =>
        current
          ? {
              ...current,
              invites: [invite, ...(current.invites ?? []).filter((entry) => entry.id !== invite.id)],
            }
          : current,
      );
      setShareFeedback("Link de compartilhamento pronto.");
      trackEvent("share_list", { list_id: id, method: "link", source: "list_detail" });
    },
  });
  const approveMember = useMutation({
    mutationFn: (memberId: string) => api(`/lists/${id}/members/${memberId}/approve`, { method: "PUT" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["list", id] });
    },
  });
  const rejectMember = useMutation({
    mutationFn: (memberId: string) => api(`/lists/${id}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["list", id] });
    },
  });

  useEffect(() => {
    if (!id || !token) return;

    const socket = createRealtimeSocket(token);
    const refetchListFallback = () => {
      void queryClient.refetchQueries({ queryKey: ["list", id], type: "active" });
      void queryClient.refetchQueries({ queryKey: ["lists"], type: "active" });
    };
    const refetchActivePurchasesFallback = () => {
      void queryClient.refetchQueries({ queryKey: ["active-purchases"], type: "active" });
    };
    const showListRealtimeNotice = (message: string) => {
      setListRealtimeNotice(message);
      if (listRealtimeNoticeTimeoutRef.current) window.clearTimeout(listRealtimeNoticeTimeoutRef.current);
      listRealtimeNoticeTimeoutRef.current = window.setTimeout(() => setListRealtimeNotice(null), 4_000);
    };
    const handleListItemRealtime = (payload: ListItemRealtimePayload) => {
      if (payload.listId !== id) return;

      const action = payload.action ?? "updated";
      const item = payload.item;
      const itemId = payload.entityId ?? payload.itemId ?? item?.id;
      if (!itemId || (action !== "deleted" && !item)) {
        refetchListFallback();
        return;
      }

      let handled = false;
      const nextList = queryClient.setQueryData<MarketList>(["list", id], (current) => {
        if (!current) return current;

        const currentItem = current.items.find((entry) => entry.id === itemId);
        if (!shouldApplyRealtimeEvent(realtimeStateRef.current, payload, currentItem?.updatedAt, { entityType: "listItem", entityId: itemId })) {
          handled = true;
          return current;
        }

        handled = true;
        return action === "deleted" ? removeListItemCache(current, itemId) : upsertListItemCache(current, item!);
      });

      if (!handled) {
        refetchListFallback();
        return;
      }

      if (nextList) {
        queryClient.setQueryData<MarketList[]>(["lists"], (current) => updateListsCache(current, nextList));
      }
    };
    const handlePurchaseItemChanged = (payload: ListPurchaseItemChangedPayload) => {
      if (payload.listId !== id) return;

      const item = payload.item;
      const itemId = payload.entityId ?? payload.itemId ?? item?.id;
      if (!itemId || (payload.action !== "deleted" && !item)) {
        refetchActivePurchasesFallback();
      } else {
        let handled = false;
        queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => {
          const currentPurchase = current?.find((entry) => entry.id === payload.purchaseId);
          const currentItem = currentPurchase?.items.find((entry) => entry.id === itemId);
          if (!currentPurchase) return current;

          if (!shouldApplyRealtimeEvent(realtimeStateRef.current, payload, currentItem?.updatedAt, { entityType: "purchaseItem", entityId: itemId })) {
            handled = true;
            return current;
          }

          handled = true;
          return payload.action === "deleted"
            ? removeRealtimePurchaseItemCache(current, payload.purchaseId, itemId)
            : upsertRealtimePurchaseItemCache(current, payload.purchaseId, item!);
        });
        if (!handled) refetchActivePurchasesFallback();
      }

      const actorId = realtimeActorId(payload);
      if (actorId === user?.id) return;

      const productName = payload.item?.productName ?? "Um produto";
      const actionMessage =
        payload.action === "created"
          ? `${productName} foi adicionado ao carrinho.`
          : payload.action === "updated"
            ? `${productName} foi atualizado no carrinho.`
            : "Um produto foi removido do carrinho.";
      showListRealtimeNotice(payload.by?.name ? `${payload.by.name}: ${actionMessage}` : actionMessage);
    };
    const directListItemEvents = ["listItemUpdated", "itemAssigned", "itemPurchased", "itemSkipped"];
    const fallbackListEvents = ["listItemsImported", "accessRequested", "memberApproved", "memberRemoved"];

    socket.on("connect", () => socket.emit("joinList", { listId: id }));
    directListItemEvents.forEach((event) => socket.on(event, handleListItemRealtime));
    fallbackListEvents.forEach((event) => socket.on(event, refetchListFallback));
    socket.on("purchaseItemChanged", handlePurchaseItemChanged);

    return () => {
      socket.emit("leaveList", { listId: id });
      directListItemEvents.forEach((event) => socket.off(event, handleListItemRealtime));
      fallbackListEvents.forEach((event) => socket.off(event, refetchListFallback));
      socket.off("purchaseItemChanged", handlePurchaseItemChanged);
      socket.disconnect();
    };
  }, [id, queryClient, token, user?.id]);

  useEffect(() => {
    return () => {
      if (listRealtimeNoticeTimeoutRef.current) window.clearTimeout(listRealtimeNoticeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    trackSafeSearch("lists", debouncedItemSearch);
  }, [debouncedItemSearch]);

  if (list.isLoading) return <LoadingState />;
  if (list.isError || !list.data) return <ScreenContainer title="Lista"><ErrorState /></ScreenContainer>;

  const currentList = normalizeMarketList(list.data);
  const neededItems = currentList.items.filter((item) => item.status === "pending");
  const atHomeItems = currentList.items.filter((item) => item.status === "at_home");
  const notNeededItems = currentList.items.filter((item) => item.status === "not_needed");
  const acceptedMembers = currentList.members?.filter((member) => member.status === "accepted") ?? [];
  const isOwner = currentList.userId === user?.id;
  const pendingMembers = currentList.members?.filter((member) => member.status === "invited") ?? [];
  const collaborators = acceptedMembers.filter((member) => member.role !== "owner");
  const sectors = [...new Set(currentList.items.map((item) => item.category?.trim() || "Sem setor"))].sort((left, right) => left.localeCompare(right, "pt-BR"));
  const normalizedSearch = itemSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredItems = currentList.items.filter((item) => {
    const matchesSearch =
      !normalizedSearch ||
      item.productName.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
      item.brand?.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
      item.category?.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    const matchesSector = sectorFilter === "all" || (item.category?.trim() || "Sem setor") === sectorFilter;
    return matchesSearch && matchesSector && matchesListStatus(item, statusFilter);
  });
  const sortedItems = sortListItems(filteredItems, sortFilter);
  const groupedItems = groupItemsByCategory(sortedItems);
  const activeFiltersCount = Number(Boolean(normalizedSearch)) + Number(sectorFilter !== "all") + Number(statusFilter !== "all") + Number(sortFilter !== "default");
  const activeShareLink =
    shareLink.data ??
    currentList.invites?.find(
      (invite) => !invite.inviteEmail && invite.status === "pending" && new Date(invite.expiresAt) > new Date(),
    );
  const shareUrl = activeShareLink ? `${window.location.origin}/shared/${activeShareLink.inviteToken}` : "";

  function toggleCategory(category: string) {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function handleStartPurchaseFromList() {
    if (activePurchase && activePurchase.sourceListId !== id) {
      setReplacePurchaseOpen(true);
      return;
    }

    start.mutate({ sourceListId: id });
  }

  return (
    <ScreenContainer title={currentList.name} subtitle={currentList.description ?? undefined}>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <AppButton icon={<ShoppingCart className="h-5 w-5" />} onClick={handleStartPurchaseFromList} loading={start.isPending} loadingLabel="Iniciando">
          Comprar
        </AppButton>
        <AppButton className="w-14 px-0" variant="secondary" icon={<Menu className="h-5 w-5" />} onClick={() => setActionsOpen(true)} aria-label="Abrir ações da lista">
          <span className="sr-only">Ações</span>
        </AppButton>
      </div>
      {listRealtimeNotice ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-mint/20 bg-mint/10 p-3 text-sm font-bold text-mint shadow-sm" role="status" aria-live="polite">
          <ShoppingCart className="h-4 w-4 flex-none" />
          <span>{listRealtimeNotice}</span>
        </div>
      ) : null}

      <ListActionsDrawer
        open={actionsOpen}
        isOwner={isOwner}
        pendingRequests={pendingMembers.length}
        archiving={archive.isPending}
        duplicating={duplicate.isPending}
        onClose={() => setActionsOpen(false)}
        onEdit={() => {
          setActionsOpen(false);
          navigate(`/app/lists/${id}/edit`);
        }}
        onArchive={() => {
          archive.mutate();
        }}
        onDuplicate={() => {
          duplicate.mutate();
        }}
        onImport={() => {
          setActionsOpen(false);
          setShowShare(false);
          setShowImport(true);
        }}
        onShare={() => {
          setActionsOpen(false);
          setShowImport(false);
          setShowShare(true);
        }}
        onDelete={() => {
          setActionsOpen(false);
          setDeleteOpen(true);
        }}
      />

      <ListFiltersDrawer
        open={filtersOpen}
        sectors={sectors}
        itemSearch={itemSearch}
        sectorFilter={sectorFilter}
        statusFilter={statusFilter}
        sortFilter={sortFilter}
        activeFiltersCount={activeFiltersCount}
        onClose={() => setFiltersOpen(false)}
        onSearchChange={setItemSearch}
        onSectorChange={setSectorFilter}
        onStatusChange={setStatusFilter}
        onSortChange={setSortFilter}
        onClear={() => {
          setItemSearch("");
          setSectorFilter("all");
          setStatusFilter("all");
          setSortFilter("default");
        }}
      />

      {showShare && isOwner ? (
        <div className="mt-4">
          <ListSharingPanel
            shareUrl={shareUrl}
            pendingMembers={pendingMembers}
            collaborators={collaborators}
            creatingLink={shareLink.isPending}
            approvingMemberId={approveMember.isPending ? approveMember.variables : undefined}
            rejectingMemberId={rejectMember.isPending ? rejectMember.variables : undefined}
            feedback={shareFeedback}
            onCreateLink={() => shareLink.mutate()}
            onCopy={async () => {
              await navigator.clipboard.writeText(shareUrl);
              setShareFeedback("Link copiado.");
            }}
            onShare={async () => {
              if (navigator.share) {
                await navigator.share({ title: currentList.name, text: `Solicite acesso à lista ${currentList.name}`, url: shareUrl });
              } else {
                await navigator.clipboard.writeText(shareUrl);
                setShareFeedback("Link copiado.");
              }
            }}
            onApprove={(memberId) => approveMember.mutate(memberId)}
            onReject={(memberId) => rejectMember.mutate(memberId)}
          />
        </div>
      ) : null}

      {showImport ? (
        <div className="mt-4">
          <Suspense fallback={<ImportPanelFallback />}>
            <ListImportPanel
              preview={importPreview}
              parsing={importParsing}
              importing={importItems.isPending}
              error={importError}
              onFile={handleImportFile}
              onClear={() => {
                setImportPreview(null);
                setImportError(null);
              }}
              onImport={() => {
                if (importPreview) importItems.mutate(importPreview);
              }}
            />
          </Suspense>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <PriceCard label="Não tenho" value={neededItems.length} />
        <PriceCard label="Tenho em casa" value={atHomeItems.length} />
        <PriceCard label="Não precisa" value={notNeededItems.length} />
      </div>

      <SectionHeader
        title="Itens"
        action={
          <div className="flex items-center gap-2">
            <AppButton className="h-10 px-3" variant="secondary" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setFiltersOpen(true)}>
              <span className="flex items-center gap-1.5">
                Filtrar
                {activeFiltersCount ? <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-black text-white">{activeFiltersCount}</span> : null}
              </span>
            </AppButton>
            <AppButton className="h-10 px-3" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/app/lists/${id}/edit`)}>
              Adicionar
            </AppButton>
          </div>
        }
      />
      {activeFiltersCount ? (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink/60 shadow-sm">
          <span>{activeFiltersCount} filtro(s) ativo(s)</span>
          <button
            type="button"
            className="font-black text-mint"
            onClick={() => {
              setItemSearch("");
              setSectorFilter("all");
              setStatusFilter("all");
              setSortFilter("default");
            }}
          >
            Limpar
          </button>
        </div>
      ) : null}
      <div className="space-y-3">
        {!currentList.items.length ? <EmptyState title="Adicione produtos ao carrinho para começar sua compra." /> : null}
        {currentList.items.length && !filteredItems.length ? <EmptyState title="Nenhum item corresponde aos filtros selecionados." /> : null}
        {groupedItems.map((group) => (
          <section key={group.category} className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3.5 py-3 text-left text-ink shadow-sm transition hover:border-mint/25"
              onClick={() => toggleCategory(group.category)}
              aria-expanded={!collapsedCategories.has(group.category)}
              aria-controls={`list-category-${group.category.replace(/\W+/g, "-").toLowerCase()}`}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-black">
                <Tags className="h-4 w-4 flex-none text-mint" />
                <span className="truncate">{group.category}</span>
              </span>
              <span className="flex flex-none items-center gap-2">
                <span className="rounded-full bg-mint/10 px-2 py-0.5 text-xs font-bold text-mint">{group.items.length}</span>
                {collapsedCategories.has(group.category) ? <ChevronRight className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
              </span>
            </button>
            {!collapsedCategories.has(group.category) ? (
              <div id={`list-category-${group.category.replace(/\W+/g, "-").toLowerCase()}`} className="space-y-2">
                {group.items.map((item) => (
                  <Fragment key={item.id}>
                    <div className="rounded-2xl border border-line bg-white p-2.5 shadow-sm">
                      <div className="flex gap-2">
                        <div className="min-w-0 flex-1">
                          <ListItemRow item={item} />
                        </div>
                        <button
                          type="button"
                          className={[
                            "grid h-auto w-11 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50",
                            item.important ? "bg-amber-50 text-amber-500 hover:bg-amber-100" : "bg-paper text-ink/35 hover:bg-line hover:text-ink/60",
                          ].join(" ")}
                          onClick={() => setItemImportant.mutate({ itemId: item.id, important: !item.important })}
                          disabled={setItemImportant.isPending && setItemImportant.variables?.itemId === item.id}
                          aria-pressed={item.important}
                          aria-label={item.important ? `Remover ${item.productName} dos importantes` : `Marcar ${item.productName} como importante`}
                        >
                          {setItemImportant.isPending && setItemImportant.variables?.itemId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Star className={["h-4 w-4", item.important ? "fill-current" : ""].join(" ")} />
                          )}
                        </button>
                        <button
                          type="button"
                          className="grid h-auto w-11 place-items-center rounded-xl bg-paper text-ink transition hover:bg-line disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => removeItem.mutate(item.id)}
                          disabled={removeItem.isPending && removeItem.variables === item.id}
                          aria-busy={(removeItem.isPending && removeItem.variables === item.id) || undefined}
                        >
                          {removeItem.isPending && removeItem.variables === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="mt-2">
                        <select
                          className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-mint"
                          value={item.status}
                          onChange={(event) => setItemState.mutate({ itemId: item.id, status: event.target.value as ListItemStatus })}
                          disabled={setItemState.isPending && setItemState.variables?.itemId === item.id}
                          aria-label={`Estado de ${item.productName}`}
                        >
                          <option value="pending">Não tenho em casa</option>
                          <option value="at_home">Tenho em casa</option>
                          <option value="not_needed">Não precisa esse mês</option>
                        </select>
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Excluir lista"
        description="Esta lista sera removida. Compras ja finalizadas continuam no historico."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
        confirmLoading={remove.isPending}
      />
      <ConfirmDialog
        open={replacePurchaseOpen}
        title="Trocar compra ativa"
        description="Existe outra compra em andamento. Para iniciar esta lista, a compra ativa atual será cancelada."
        onCancel={() => setReplacePurchaseOpen(false)}
        onConfirm={() => start.mutate({ sourceListId: id, cancelActive: true })}
        confirmLoading={start.isPending}
      />
    </ScreenContainer>
  );
}

function ImportPanelFallback() {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
      <div className="h-4 w-36 rounded-full bg-paper" />
      <div className="mt-3 h-11 rounded-xl bg-paper" />
    </div>
  );
}
