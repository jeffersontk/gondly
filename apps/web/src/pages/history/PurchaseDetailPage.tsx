import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCcw } from "lucide-react";
import { AppButton, ErrorState, LoadingState, PurchaseItemCard, ScreenContainer, SectionHeader, SummaryCard } from "../../components";
import { ReportPriceAction } from "../../components/ReportPriceAction";
import { trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
import type { MarketList, Purchase, PurchaseItem, PurchaseRegionalPriceComparison, RegionalPriceComparison } from "../../types";
import { formatBRL } from "../shared";

export function PurchaseDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [showRegionalComparison, setShowRegionalComparison] = useState(false);
  const purchase = useQuery({ queryKey: ["purchase", id], queryFn: () => api<Purchase>(`/purchases/${id}`), enabled: Boolean(id) });
  const purchaseComparisonQuery = purchase.data ? buildPurchaseComparisonQuery(purchase.data) : "";
  const purchaseComparison = useQuery({
    queryKey: ["purchase-regional-comparison", id, purchaseComparisonQuery],
    queryFn: () => api<PurchaseRegionalPriceComparison>(`/price-comparison/purchase/${id}/regional?${purchaseComparisonQuery}`),
    enabled: showRegionalComparison && Boolean(id) && Boolean(purchase.data),
  });
  const duplicate = useMutation({
    mutationFn: () => api<MarketList>(`/purchases/${id}/duplicate-as-list`, { method: "POST" }),
    onSuccess: (list) => navigate(`/app/lists/${list.id}`),
  });

  useEffect(() => {
    if (!purchase.data) return;
    trackEvent("view_purchase_detail", {
      purchase_id: purchase.data.id,
      market_id: purchase.data.marketId,
      items_count: purchase.data.items.filter((item) => Number(item.pricePaid ?? 0) > 0).length,
      subtotal_calculated: purchase.data.subtotalCalculated,
      final_paid_amount: purchase.data.finalPaidAmount,
    });
  }, [purchase.data?.id]);

  if (purchase.isLoading) return <LoadingState />;
  if (!purchase.data) return <ScreenContainer title="Compra"><ErrorState /></ScreenContainer>;

  const purchasedItems = purchase.data.items.filter((item) => Number(item.pricePaid ?? 0) > 0);

  return (
    <ScreenContainer title={purchase.data.market?.name ?? "Compra"} subtitle={new Date(purchase.data.startedAt).toLocaleDateString("pt-BR")}>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total" value={formatBRL(purchase.data.finalPaidAmount ?? purchase.data.subtotalCalculated)} />
        <SummaryCard label="Desconto" value={formatBRL(purchase.data.discountAmount ?? 0)} tone="tomato" />
      </div>
      <AppButton
        className="mt-3"
        full
        variant="secondary"
        icon={<BarChart3 className="h-4 w-4" />}
        onClick={() => setShowRegionalComparison((current) => !current)}
      >
        {showRegionalComparison ? "Ocultar comparação regional" : "Comparar com região"}
      </AppButton>
      {showRegionalComparison ? <PurchaseRegionalComparisonPanel comparison={purchaseComparison.data} loading={purchaseComparison.isLoading} purchase={purchase.data} /> : null}
      <SectionHeader
        title="Itens"
        action={
          <AppButton variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => duplicate.mutate()} loading={duplicate.isPending} loadingLabel="Criando lista">
            Virar lista
          </AppButton>
        }
      />
      <div className="space-y-3">
        {purchasedItems.map((item) => (
          <div key={item.id} className="space-y-2">
            <PurchaseItemCard item={item} />
            <RegionalPriceComparisonBlock item={item} purchase={purchase.data} />
          </div>
        ))}
      </div>
    </ScreenContainer>
  );
}

function PurchaseRegionalComparisonPanel({
  comparison,
  loading,
  purchase,
}: {
  comparison?: PurchaseRegionalPriceComparison;
  loading: boolean;
  purchase: Purchase;
}) {
  const originalMarketName = comparison?.originalMarket?.marketName ?? purchase.market?.name ?? "mercado";
  const bestMarket = comparison?.estimatedMarkets[0];

  if (loading) {
    return (
      <section className="mt-3 rounded-xl border border-line bg-white p-4 shadow-soft">
        <p className="text-sm font-semibold text-ink/60">Calculando estimativa regional da compra...</p>
      </section>
    );
  }

  if (!comparison || !bestMarket) {
    return (
      <section className="mt-3 rounded-xl border border-line bg-white p-4 shadow-soft">
        <h2 className="text-base font-black text-ink">Comparação regional da compra</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Ainda não temos dados suficientes para comparar esta compra na sua região.
        </p>
        <p className="mt-3 text-xs leading-5 text-ink/50">
          A estimativa só aparece quando há itens e mercados suficientes com registros anônimos recentes.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-xl border border-line bg-white p-4 shadow-soft">
      <h2 className="text-base font-black text-ink">Comparação regional da compra</h2>
      <div className="mt-3 grid gap-2">
        <div className="rounded-lg bg-paper p-3">
          <p className="text-xs font-semibold text-ink/55">Sua compra no {originalMarketName}</p>
          <p className="mt-1 text-lg font-black text-ink">{formatBRL(comparison.originalTotal)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-paper p-3">
            <p className="text-xs font-semibold text-ink/55">Estimativa mais barata encontrada</p>
            <p className="mt-1 text-base font-black text-ink">{formatBRL(bestMarket.estimatedTotal)}</p>
          </div>
          <div className="rounded-lg bg-paper p-3">
            <p className="text-xs font-semibold text-ink/55">Economia estimada</p>
            <p className={bestMarket.estimatedSavings > 0 ? "mt-1 text-base font-black text-mint" : "mt-1 text-base font-black text-ink"}>
              {formatBRL(bestMarket.estimatedSavings)}
            </p>
          </div>
        </div>
      </div>

      <h3 className="mt-4 text-sm font-black text-ink">Mercados estimados</h3>
      <div className="mt-2 space-y-2">
        {comparison.estimatedMarkets.map((market, index) => (
          <div key={market.marketId} className="rounded-xl border border-line bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">
                  {index + 1}. {market.marketName}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-ink/55">
                  {market.matchedItemsCount} item(ns) encontrados · {market.missingItemsCount} ausente(s)
                </p>
              </div>
              <span className="rounded-full bg-mint/10 px-2.5 py-1 text-xs font-black text-mint">{confidenceLabel(market.confidence)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink/60">
              <span>Estimativa: {formatBRL(market.estimatedTotal)}</span>
              <span>Economia estimada: {formatBRL(market.estimatedSavings)}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-4 text-sm font-black text-ink">Detalhe por produto</h3>
      <div className="mt-2 space-y-2">
        {comparison.items.map((item) => (
          <div key={item.purchaseItemId} className="rounded-xl bg-paper p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">{item.productName}</p>
                {item.brandName ? <p className="mt-0.5 truncate text-xs font-semibold text-ink/55">{item.brandName}</p> : null}
              </div>
              <QualityBadges confidence={item.confidence} recordsCount={item.recordsCount} lastUpdatedAt={item.lastUpdatedAt} tone="white" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-ink/60">
              <span>Pago: {formatBRL(item.userPaidPrice)}</span>
              <span>Média: {regionalPriceLabel(item.avgRegionalPrice, item.normalizedUnit)}</span>
              <span>Menor: {regionalPriceLabel(item.bestRegionalPrice, item.normalizedUnit)}</span>
              <span>Mais barato: {item.bestMarketName ?? "-"}</span>
            </div>
            <div className="mt-3">
              <ReportPriceAction recordId={item.reportableRecordId} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-ink/50">
        Estimativa baseada em registros anônimos recentes da região. A economia não é garantida: preços podem variar por loja, data, estoque e promoção.
      </p>
    </section>
  );
}

function RegionalPriceComparisonBlock({ item, purchase }: { item: PurchaseItem; purchase: Purchase }) {
  const queryString = buildRegionalComparisonQuery(item, purchase);
  const comparison = useQuery({
    queryKey: ["regional-price-comparison", item.id, queryString],
    queryFn: () => api<RegionalPriceComparison | null>(`/price-comparison/regional?${queryString}`),
    enabled: Number(item.pricePaid ?? 0) > 0 && Boolean(queryString),
  });

  const paidPrice = Number(item.pricePaid ?? 0);
  const normalizedUserPrice =
    item.unitPriceNormalized != null && item.normalizedUnitLabel ? `${formatBRL(Number(item.unitPriceNormalized))}/${item.normalizedUnitLabel}` : null;

  return (
    <section className="rounded-xl border border-line bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-ink">Preço na sua região</h3>
          <p className="mt-0.5 text-xs font-semibold text-ink/55">{comparison.data ? comparisonLevelLabel(comparison.data.comparisonLevel) : "Estimativa regional"}</p>
        </div>
        {comparison.data ? (
          <QualityBadges confidence={comparison.data.confidence} recordsCount={comparison.data.recordsCount} lastUpdatedAt={comparison.data.lastUpdatedAt} />
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg bg-paper p-2.5">
          <p className="text-[11px] font-semibold text-ink/50">Você pagou</p>
          <p className="mt-1 text-sm font-black text-ink">{formatBRL(paidPrice)}</p>
          {normalizedUserPrice ? <p className="mt-0.5 text-[11px] font-semibold text-ink/55">{normalizedUserPrice}</p> : null}
        </div>

        {comparison.isLoading ? (
          <div className="rounded-lg bg-paper p-2.5 sm:col-span-2">
            <p className="text-sm font-semibold text-ink/60">Carregando estimativa regional...</p>
          </div>
        ) : comparison.data ? (
          <>
            <div className="rounded-lg bg-paper p-2.5">
              <p className="text-[11px] font-semibold text-ink/50">Média regional</p>
              <p className="mt-1 text-sm font-black text-ink">
                {regionalPriceLabel(comparison.data.normalizedAvgPrice ?? comparison.data.avgPrice, comparison.data.normalizedUnit)}
              </p>
            </div>
            <div className="rounded-lg bg-paper p-2.5">
              <p className="text-[11px] font-semibold text-ink/50">Menor preço regional</p>
              <p className="mt-1 text-sm font-black text-ink">
                {regionalPriceLabel(comparison.data.normalizedMinPrice ?? comparison.data.minPrice, comparison.data.normalizedUnit)}
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-paper p-2.5 sm:col-span-2">
            <p className="text-sm font-semibold leading-5 text-ink/65">
              Dados regionais insuficientes por enquanto. Continue registrando suas compras para melhorar a comparação.
            </p>
          </div>
        )}
      </div>

      {comparison.data ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-ink/55">
          <span>Baseado em {comparison.data.recordsCount} registros</span>
          <span>{comparison.data.marketsCount} mercado(s)</span>
          <span>Última atualização: {formatDate(comparison.data.lastUpdatedAt)}</span>
        </div>
      ) : null}

      {comparison.data?.reportableRecordId ? (
        <div className="mt-3">
          <ReportPriceAction recordId={comparison.data.reportableRecordId} />
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-ink/50">
        Estimativa baseada em registros anônimos de usuários da sua região. Preços podem variar por loja, data e promoção.
      </p>
    </section>
  );
}

function buildRegionalComparisonQuery(item: PurchaseItem, purchase: Purchase) {
  const params = new URLSearchParams();
  appendParam(params, "productId", item.productId);
  appendParam(params, "productName", item.productName);
  appendParam(params, "brandId", item.brandId);
  appendParam(params, "unit", item.unit);
  appendParam(params, "packageSize", item.packageSize);
  appendParam(params, "packageUnit", item.packageUnit);
  appendParam(params, "city", purchase.market?.city);
  appendParam(params, "state", purchase.market?.state);
  params.set("periodDays", "30");
  return params.toString();
}

function buildPurchaseComparisonQuery(purchase: Purchase) {
  const params = new URLSearchParams();
  appendParam(params, "city", purchase.market?.city);
  appendParam(params, "state", purchase.market?.state);
  params.set("periodDays", "30");
  return params.toString();
}

function appendParam(params: URLSearchParams, key: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return;
  params.set(key, String(value));
}

function regionalPriceLabel(value: number, unit?: string | null) {
  return unit ? `${formatBRL(value)}/${unit}` : formatBRL(value);
}

function confidenceLabel(confidence: RegionalPriceComparison["confidence"]) {
  if (confidence === "high") return "Alta confiança";
  if (confidence === "medium") return "Média confiança";
  return "Baixa confiança";
}

function QualityBadges({
  confidence,
  recordsCount,
  lastUpdatedAt,
  tone = "mint",
}: {
  confidence: RegionalPriceComparison["confidence"];
  recordsCount: number;
  lastUpdatedAt?: string | null;
  tone?: "mint" | "white";
}) {
  const neutralClass = tone === "white" ? "bg-white text-ink/65" : "bg-paper text-ink/65";
  const badges = [
    { label: confidenceLabel(confidence), className: tone === "white" ? "bg-white text-mint" : "bg-mint/10 text-mint" },
    ...(recordsCount < 5 ? [{ label: "Poucos dados", className: neutralClass }] : []),
    ...(isOldPrice(lastUpdatedAt) ? [{ label: "Preço antigo", className: neutralClass }] : []),
  ];

  return (
    <div className="flex flex-none flex-wrap justify-end gap-1">
      {badges.map((badge) => (
        <span key={badge.label} className={`rounded-full px-2.5 py-1 text-xs font-black ${badge.className}`}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function comparisonLevelLabel(level: RegionalPriceComparison["comparisonLevel"]) {
  if (level === "exact") return "Mesmo produto, marca e embalagem.";
  if (level === "same_brand") return "Mesmo produto e marca.";
  if (level === "similar_product") return "Produto similar na região.";
  return "Produto semelhante na região.";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function isOldPrice(value?: string | null) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() > 30 * 24 * 60 * 60_000;
}
