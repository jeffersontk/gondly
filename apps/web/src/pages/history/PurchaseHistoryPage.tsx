import { useEffect, useState } from "react";
import { historyPeriodBounds, localHistoryDate } from "./historyPeriod";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { AppButton, ConfirmDialog, EmptyState, LoadingState, ScreenContainer, SearchBar } from "../../components";
import { AdSlot } from "../../ads/AdSlot";
import { trackEvent, trackSafeSearch } from "../../lib/analytics";
import { API_URL, getStoredToken, api } from "../../lib/api";
import { invalidatePurchaseReports } from "../../lib/purchaseReportCache";
import type { Purchase } from "../../types";
import { formatBRL, useDebouncedValue } from "../shared";

export function PurchaseHistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [marketId, setMarketId] = useState("");
  const [category, setCategory] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const debouncedQ = useDebouncedValue(q);
  const [purchaseToRemove, setPurchaseToRemove] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const { data = [], isLoading, isError } = useQuery({ queryKey: ["purchases"], queryFn: () => api<Purchase[]>("/purchases") });
  const completed = data
    .filter((purchase) => purchase.status === "completed")
    .filter((purchase) => {
      const date = localHistoryDate(purchase.completedAt ?? purchase.startedAt);
      return (!startDate || date >= startDate) && (!endDate || date <= endDate) && (!marketId || purchase.market?.id === marketId) && (!category || purchase.items.some(item => item.category === category));
    })
    .filter((purchase) => {
      const term = q.toLowerCase();
      if (!term) return true;
      return purchase.market?.name.toLowerCase().includes(term) || purchase.items.some((item) => item.productName.toLowerCase().includes(term));
    });

  const removePurchase = useMutation({
    mutationFn: (id: string) => api(`/purchases/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Purchase[]>(["purchases"], (current) => current?.filter((purchase) => purchase.id !== id));
      void invalidatePurchaseReports(queryClient);
      trackEvent("delete_purchase_history_item", { purchase_id: id });
      setPurchaseToRemove(null);
    },
  });

  const clearHistory = useMutation({
    mutationFn: () => api("/purchases/history", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData<Purchase[]>(["purchases"], (current) => current?.filter((purchase) => purchase.status === "in_progress"));
      void invalidatePurchaseReports(queryClient);
      trackEvent("clear_purchase_history");
      setClearAllOpen(false);
    },
  });

  useEffect(() => {
    trackSafeSearch("history", debouncedQ);
  }, [debouncedQ]);

  async function exportHistory() {
    setExporting(true); setExportError("");
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries({ ...historyPeriodBounds(startDate, endDate), marketId, category, q })) if (value) params.set(key, value);
      const response = await fetch(`${API_URL}/reports/history.csv?${params}`, { headers: { Authorization: `Bearer ${getStoredToken()}` } });
      if (!response.ok) throw new Error("Export failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "gondly-history.csv"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setExportError("Não foi possível exportar. Confira sua conexão e tente novamente."); }
    finally { setExporting(false); }
  }

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
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Início (UTC)<input className="block w-full rounded-xl p-2" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label className="text-xs">Fim (UTC)<input className="block w-full rounded-xl p-2" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
          <select aria-label="Mercado" className="rounded-xl p-2" value={marketId} onChange={e => setMarketId(e.target.value)}><option value="">Todos os mercados</option>{[...new Map(data.filter(p => p.market).map(p => [p.market!.id, p.market!])).values()].map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <select aria-label="Categoria" className="rounded-xl p-2" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{[...new Set(data.flatMap(p => p.items.map(i => i.category)).filter(Boolean))].map(c => <option key={c!} value={c!}>{c}</option>)}</select>
        </div>
        <AppButton variant="secondary" className="my-3" disabled={exporting || isLoading} onClick={() => void exportHistory()}>{exporting ? "Exportando..." : "Exportar CSV"}</AppButton>
        {exportError ? <p role="alert" className="text-sm text-tomato">{exportError}</p> : null}
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
        <AdSlot slot="history_inline" hasContent={completed.length > 0} disabled={isLoading || isError} />
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
