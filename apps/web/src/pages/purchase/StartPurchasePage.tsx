import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { AppButton, EmptyState, MarketListCard, ScreenContainer, SectionHeader } from "../../components";
import { api } from "../../lib/api";
import { discardQueuedPurchaseChanges } from "../../lib/offlineQueue";
import type { MarketList, Purchase } from "../../types";
import { setActivePurchaseCache } from "../shared";

export function StartPurchasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const activePurchase = active.data?.[0];
  const start = useMutation({
    mutationFn: (payload: { sourceListId?: string; cancelActive?: boolean } = {}) =>
      api<Purchase>("/purchases/start", { method: "POST", body: payload }),
    onSuccess: (purchase, variables) => {
      if (variables.cancelActive && activePurchase) {
        void discardQueuedPurchaseChanges(activePurchase.id);
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
              onClick={() => start.mutate({ cancelActive: true })}
              loading={start.isPending && Boolean(start.variables?.cancelActive)}
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
        onClick={() => start.mutate({})}
        loading={start.isPending && !start.variables?.sourceListId && !start.variables?.cancelActive}
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
    </ScreenContainer>
  );
}
