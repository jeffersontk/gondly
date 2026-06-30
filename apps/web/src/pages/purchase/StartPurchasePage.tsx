import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { AppButton, EmptyState, MarketListCard, ScreenContainer, SectionHeader } from "../../components";
import { api } from "../../lib/api";
import { discardQueuedPurchaseChanges } from "../../lib/offlineQueue";
import type { MarketList, Purchase } from "../../types";
import { addListCache, setActivePurchaseCache } from "../shared";
import { PurchaseTitleDialog } from "./PurchaseTitleDialog";

type StartPurchaseInput = {
  sourceListId?: string;
  cancelActive?: boolean;
  title?: string;
};

export function StartPurchasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [titleDialogRequest, setTitleDialogRequest] = useState<{ cancelActive?: boolean } | null>(null);
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const activePurchase = active.data?.[0];
  const start = useMutation({
    mutationFn: async (payload: StartPurchaseInput = {}) => {
      if (payload.title) {
        const list = await api<MarketList>("/lists", { method: "POST", body: { name: payload.title } });
        const purchase = await api<Purchase>("/purchases/start", {
          method: "POST",
          body: { sourceListId: list.id, cancelActive: payload.cancelActive },
        });
        return { list, purchase };
      }

      const purchase = await api<Purchase>("/purchases/start", { method: "POST", body: payload });
      return { purchase };
    },
    onSuccess: ({ list, purchase }, variables) => {
      setTitleDialogRequest(null);
      if (variables.cancelActive && activePurchase) {
        void discardQueuedPurchaseChanges(activePurchase.id);
      }
      if (list) {
        queryClient.setQueryData<MarketList>(["list", list.id], list);
        queryClient.setQueryData<MarketList[]>(["lists"], (current) => addListCache(current, list));
      }
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => setActivePurchaseCache(current, purchase));
      navigate(`/app/purchase/${purchase.id}`);
    },
  });

  return (
    <ScreenContainer title="Iniciar compra">
      {activePurchase ? (
        <div className="mb-4 rounded-xl bg-white p-4 shadow-soft">
          <p className="text-sm font-black text-ink">Compra ativa encontrada</p>
          <p className="mt-1 text-xs text-ink/55">{activePurchase.items.length} itens no carrinho</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <AppButton variant="secondary" onClick={() => navigate(`/app/purchase/${activePurchase.id}`)}>
              Continuar
            </AppButton>
            <AppButton
              variant="danger"
              onClick={() => setTitleDialogRequest({ cancelActive: true })}
              loading={start.isPending && Boolean(start.variables?.cancelActive && start.variables?.title)}
              loadingLabel="Iniciando"
              disabled={start.isPending && !start.variables?.cancelActive}
            >
              Cancelar e iniciar
            </AppButton>
          </div>
        </div>
      ) : null}
      <AppButton
        full
        icon={<ShoppingCart className="h-5 w-5" />}
        onClick={() => setTitleDialogRequest({})}
        loading={start.isPending && Boolean(start.variables?.title && !start.variables?.cancelActive)}
        loadingLabel="Iniciando"
        disabled={start.isPending && Boolean(start.variables?.sourceListId || start.variables?.cancelActive)}
      >
        Começar do zero
      </AppButton>
      <SectionHeader title="A partir de lista" />
      <div className="space-y-3">
        {lists.data?.map((list) => (
          <MarketListCard
            key={list.id}
            list={list}
            onClick={() => start.mutate({ sourceListId: list.id, cancelActive: Boolean(activePurchase && activePurchase.sourceListId !== list.id) })}
            loading={start.isPending && start.variables?.sourceListId === list.id}
            disabled={start.isPending && start.variables?.sourceListId !== list.id}
          />
        ))}
        {!lists.isLoading && !lists.data?.length ? <EmptyState title="Você ainda não tem listas. Crie sua primeira lista de mercado." /> : null}
      </div>
      <PurchaseTitleDialog
        open={Boolean(titleDialogRequest)}
        loading={start.isPending && Boolean(start.variables?.title)}
        onClose={() => {
          if (!start.isPending) setTitleDialogRequest(null);
        }}
        onConfirm={(title) => start.mutate({ ...(titleDialogRequest ?? {}), title })}
      />
    </ScreenContainer>
  );
}
