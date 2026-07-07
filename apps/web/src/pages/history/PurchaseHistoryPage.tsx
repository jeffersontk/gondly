import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { AppButton, ConfirmDialog, DateRangeFilter, EmptyState, LoadingState, ScreenContainer, SearchBar } from "../../components";
import { AdSlot } from "../../ads/AdSlot";
import { trackEvent, trackSafeSearch } from "../../lib/analytics";
import { api } from "../../lib/api";
import type { Purchase } from "../../types";
import { formatBRL, useDebouncedValue } from "../shared";

export function PurchaseHistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const [purchaseToRemove, setPurchaseToRemove] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["purchases"], queryFn: () => api<Purchase[]>("/purchases") });
  const completed = data
    .filter((purchase) => purchase.status === "completed")
    .filter((purchase) => {
      const term = q.toLowerCase();
      if (!term) return true;
      return purchase.market?.name.toLowerCase().includes(term) || purchase.items.some((item) => item.productName.toLowerCase().includes(term));
    });

  const removePurchase = useMutation({
    mutationFn: (id: string) => api(`/purchases/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Purchase[]>(["purchases"], (current) => current?.filter((purchase) => purchase.id !== id));
      trackEvent("delete_purchase_history_item", { purchase_id: id });
      setPurchaseToRemove(null);
    },
  });

  const clearHistory = useMutation({
    mutationFn: () => api("/purchases/history", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData<Purchase[]>(["purchases"], (current) => current?.filter((purchase) => purchase.status === "in_progress"));
      trackEvent("clear_purchase_history");
      setClearAllOpen(false);
    },
  });

  useEffect(() => {
    trackSafeSearch("history", debouncedQ);
  }, [debouncedQ]);

  return (
    <ScreenContainer
      title="Histórico"
      headerAction={
        completed.length ? (
          <AppButton variant="secondary" className="h-10 px-3 text-xs" icon={<Trash2 className="h-4 w-4" />} onClick={() => setClearAllOpen(true)}>
            Limpar
          </AppButton>
        ) : undefined
      }
    >
      <SearchBar placeholder="Buscar mercado ou produto" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="mt-3">
        <DateRangeFilter />
      </div>
      {isLoading ? <LoadingState /> : null}
      {!isLoading && !completed.length ? <EmptyState title="Nenhuma compra registrada ainda." /> : null}
      <div className="space-y-3">
        {completed.map((purchase) => (
          <div key={purchase.id} className="flex items-center gap-2 rounded-xl bg-white p-4 shadow-soft">
            <button onClick={() => navigate(`/app/history/${purchase.id}`)} className="min-w-0 flex-1 text-left">
              <p className="text-sm font-black text-ink">{purchase.market?.name ?? "Mercado"}</p>
              <p className="mt-1 text-xs text-ink/55">
                {new Date(purchase.completedAt ?? purchase.startedAt).toLocaleDateString("pt-BR")} ·{" "}
                {formatBRL(purchase.finalPaidAmount ?? purchase.subtotalCalculated)}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPurchaseToRemove(purchase.id)}
              aria-label="Remover compra do histórico"
              className="grid h-9 w-9 flex-none place-items-center rounded-xl text-ink/40 transition hover:bg-paper hover:text-tomato"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <AdSlot slot="history_inline" />
      </div>

      <ConfirmDialog
        open={Boolean(purchaseToRemove)}
        title="Remover compra"
        description="Esta compra será removida do seu histórico. Essa ação não pode ser desfeita."
        onCancel={() => setPurchaseToRemove(null)}
        onConfirm={() => purchaseToRemove && removePurchase.mutate(purchaseToRemove)}
        confirmLoading={removePurchase.isPending}
      />

      <ConfirmDialog
        open={clearAllOpen}
        title="Limpar histórico"
        description="Todas as compras finalizadas serão removidas do seu histórico. Essa ação não pode ser desfeita."
        onCancel={() => setClearAllOpen(false)}
        onConfirm={() => clearHistory.mutate()}
        confirmLoading={clearHistory.isPending}
      />
    </ScreenContainer>
  );
}
