import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DateRangeFilter, EmptyState, LoadingState, ScreenContainer, SearchBar } from "../../components";
import { AdSlot } from "../../lib/ads";
import { trackSafeSearch } from "../../lib/analytics";
import { api } from "../../lib/api";
import type { Purchase } from "../../types";
import { formatBRL, useDebouncedValue } from "../shared";

export function PurchaseHistoryPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const { data = [], isLoading } = useQuery({ queryKey: ["purchases"], queryFn: () => api<Purchase[]>("/purchases") });
  const completed = data
    .filter((purchase) => purchase.status === "completed")
    .filter((purchase) => {
      const term = q.toLowerCase();
      if (!term) return true;
      return purchase.market?.name.toLowerCase().includes(term) || purchase.items.some((item) => item.productName.toLowerCase().includes(term));
    });

  useEffect(() => {
    trackSafeSearch("history", debouncedQ);
  }, [debouncedQ]);

  return (
    <ScreenContainer title="Histórico">
      <SearchBar placeholder="Buscar mercado ou produto" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="mt-3">
        <DateRangeFilter />
      </div>
      {isLoading ? <LoadingState /> : null}
      {!isLoading && !completed.length ? <EmptyState title="Nenhuma compra registrada ainda." /> : null}
      <div className="space-y-3">
        {completed.map((purchase) => (
          <button key={purchase.id} onClick={() => navigate(`/app/history/${purchase.id}`)} className="w-full rounded-xl bg-white p-4 text-left shadow-soft">
            <p className="text-sm font-black text-ink">{purchase.market?.name ?? "Mercado"}</p>
            <p className="mt-1 text-xs text-ink/55">
              {new Date(purchase.completedAt ?? purchase.startedAt).toLocaleDateString("pt-BR")} ·{" "}
              {formatBRL(purchase.finalPaidAmount ?? purchase.subtotalCalculated)}
            </p>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <AdSlot />
      </div>
    </ScreenContainer>
  );
}
