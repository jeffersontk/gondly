import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PriceCard, ScreenContainer, SectionHeader, SummaryCard } from "../../components";
import { trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
import type { ProductPriceDetailsReport } from "../../types";
import { formatBRL } from "../shared";

export function ProductPriceDetailPage() {
  const { productId = "" } = useParams();
  const details = useQuery({
    queryKey: ["product-price-details", productId],
    queryFn: () => api<ProductPriceDetailsReport>(`/reports/products/${productId}/price-details`),
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
      <SummaryCard label="Melhor mercado" value={details.data?.best ? `${details.data.best.marketName} · ${formatBRL(details.data.best.averagePrice)}` : "-"} />
      <SectionHeader title="Mercados" />
      <div className="space-y-2">
        {details.data?.markets.map((entry) => (
          <button
            key={entry.marketId}
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
            <PriceCard label={entry.marketName} value={formatBRL(entry.averagePrice)} />
          </button>
        ))}
      </div>
      <SectionHeader title="Histórico" />
      <pre className="overflow-auto rounded-xl bg-white p-3 text-xs text-ink/60">{JSON.stringify(details.data?.history ?? [], null, 2)}</pre>
    </ScreenContainer>
  );
}
