import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateRangeFilter, EmptyState, PriceCard, ScreenContainer, SearchBar } from "../../components";
import { AdSlot } from "../../lib/ads";
import { api } from "../../lib/api";
import type { PriceComparison } from "../../types";
import { formatBRL, useDebouncedValue } from "../shared";

export function PriceComparisonPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const comparison = useQuery({
    queryKey: ["price-comparison", debouncedQ],
    queryFn: () => api<PriceComparison[]>(`/reports/products-price-comparison?q=${encodeURIComponent(debouncedQ)}`),
  });

  return (
    <ScreenContainer title="Comparar preços">
      <SearchBar placeholder="Buscar produto" value={q} onChange={(event) => setQ(event.target.value)} />
      <DateRangeFilter />
      <div className="mt-4 space-y-3">
        {!comparison.isLoading && !comparison.data?.length ? <EmptyState title="Cadastre seus mercados para comparar preços." /> : null}
        {comparison.data?.map((entry) => (
          <div key={entry.productName} className="rounded-xl bg-white p-4 shadow-soft">
            <p className="font-black text-ink">{entry.productName}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <PriceCard label="Menor" value={formatBRL(entry.minPrice ?? 0)} />
              <PriceCard label="Média" value={formatBRL(entry.averagePrice ?? 0)} />
              <PriceCard label="Maior" value={formatBRL(entry.maxPrice ?? 0)} />
              <PriceCard label="Último mercado" value={entry.lastMarket ?? "-"} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <AdSlot />
      </div>
    </ScreenContainer>
  );
}
