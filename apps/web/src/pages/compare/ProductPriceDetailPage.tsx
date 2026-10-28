import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, LoadingState, PriceCard, ScreenContainer, SectionHeader, SummaryCard } from "../../components";
import { trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
type Market = { marketId: string; marketName: string; averagePrice: number; comparisonKey: string; normalizedUnit: string | null; brandName: string | null; packageSize: number | null; packageUnit: string | null; lastPurchasedAt: string; samplesCount: number };
type HistoryEntry = { id: string; productName: string; unitPriceNormalized: number | string | null; normalizedUnitLabel: string | null; brandNameSnapshot: string | null; packageSize: number | null; packageUnit: string | null; createdAt: string; purchase: { completedAt: string | null; market: { name: string } | null } };
type ProductPriceDetailsReport = { history: HistoryEntry[]; markets: Market[]; best: Market | null };
import { formatBRL } from "../shared";

export function ProductPriceDetailPage() {
  const { productId = "" } = useParams();
  const [period, setPeriod] = useState("90d");
  const details = useQuery({
    queryKey: ["product-price-details", productId, period],
    queryFn: () => api<ProductPriceDetailsReport>(`/reports/products/${productId}/price-details?period=${period}`),
    enabled: Boolean(productId),
  });

  useEffect(() => {
    if (!productId || !details.data) return;
    trackEvent("compare_product_prices", {
      product_id: productId,
      results_count: details.data.markets.length,
    });
  }, [details.data, productId]);

  return (
    <ScreenContainer title="Preço do produto">
      <p className="mb-3 text-sm text-ink/60">Origem pessoal: compras próprias e compartilhadas às quais você tem acesso. Alternativas de marca ou embalagem são apresentadas separadamente. Preços normalizados não incluem o desconto geral da compra.</p>
      <label className="text-sm">Período <select className="mb-3 rounded-xl p-2" value={period} onChange={e => setPeriod(e.target.value)}><option value="30d">30 dias</option><option value="90d">90 dias</option><option value="1y">1 ano</option><option value="all">Todo o histórico</option></select></label>
      {details.isLoading ? <LoadingState /> : null}
      {details.isError ? <p role="alert">Não foi possível carregar os preços.</p> : null}
      <SummaryCard label="Melhor mercado" value={details.data?.best ? `${details.data.best.marketName} · ${formatBRL(details.data.best.averagePrice)}` : "-"} />
      <SectionHeader title="Mercados" />
      <div className="space-y-2">
        {details.data?.markets.map((entry) => (
          <button
            key={entry.marketId + entry.comparisonKey}
            type="button"
            className="block w-full text-left"
            onClick={() =>
              trackEvent("select_market_from_comparison", {
                product_id: productId,
                market_id: entry.marketId,
                results_count: details.data?.markets.length ?? 0,
              })
            }
          >
            <PriceCard label={entry.marketName} value={formatBRL(entry.averagePrice) + "/" + (entry.normalizedUnit ?? "unidade não informada")} />
            <p className="p-2 text-xs text-ink/60">{entry.brandName ?? "Marca não informada"} · {entry.packageSize ?? "?"} {entry.packageUnit} · {entry.samplesCount} registro(s) · {new Date(entry.lastPurchasedAt).toLocaleDateString("pt-BR")}{entry.samplesCount < 3 ? " · Amostra pequena" : ""}</p>
          </button>
        ))}
      </div>
      <SectionHeader title="Histórico" />
      {details.data && !details.data.history.length ? <EmptyState title="Sem preços neste período." /> : null}
      <div className="space-y-2">{details.data?.history.map(entry => <article key={entry.id} className="rounded-xl bg-white p-3 text-sm">
        <p className="font-bold">{entry.productName} · {entry.unitPriceNormalized === null ? "Sem preço comparável" : formatBRL(Number(entry.unitPriceNormalized)) + "/" + (entry.normalizedUnitLabel ?? "?")}</p>
        <p className="text-xs text-ink/60">{new Date(entry.purchase.completedAt ?? entry.createdAt).toLocaleDateString("pt-BR")} · {entry.purchase.market?.name ?? "Mercado não informado"} · Pessoal</p>
        <p className="text-xs text-ink/60">{entry.brandNameSnapshot ?? "Marca não informada"} · {entry.packageSize ?? "?"} {entry.packageUnit}</p>
      </article>)}</div>
    </ScreenContainer>
  );
}
