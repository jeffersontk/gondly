import { useQuery } from "@tanstack/react-query";
import { PriceCard, ScreenContainer, SectionHeader } from "../components";
import { AdSlot } from "../lib/ads";
import { api } from "../lib/api";
import type { InsightsReport } from "../types";
import { formatBRL } from "./shared";

export function InsightsPage() {
  const insights = useQuery({ queryKey: ["insights"], queryFn: () => api<InsightsReport>("/reports/insights") });

  return (
    <ScreenContainer title="Insights">
      <AdSlot />
      <SectionHeader title="Gasto mensal" />
      <div className="space-y-2">
        {insights.data?.monthly.map((entry) => <PriceCard key={entry.month} label={entry.month} value={formatBRL(entry.total)} />)}
      </div>
      <SectionHeader title="Mercados" />
      <div className="space-y-2">
        {insights.data?.markets.map((entry) => <PriceCard key={entry.marketName} label={entry.marketName} value={formatBRL(entry.total)} />)}
      </div>
      <SectionHeader title="Produtos" />
      <div className="space-y-2">
        {insights.data?.products.map((entry) => <PriceCard key={entry.productName} label={entry.productName} value={`${entry.quantity}`} />)}
      </div>
      <SectionHeader title="Variacao" />
      <div className="space-y-2">
        {insights.data?.variation.map((entry) => <PriceCard key={entry.productName} label={entry.productName} value={formatBRL(entry.variation)} />)}
      </div>
    </ScreenContainer>
  );
}
