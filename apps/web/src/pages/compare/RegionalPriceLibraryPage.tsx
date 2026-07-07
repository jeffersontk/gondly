import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppInput, EmptyState, LoadingState, ScreenContainer, SearchBar, formatPackageSize } from "../../components";
import { ReportPriceAction } from "../../components/ReportPriceAction";
import { trackEvent, trackSafeSearch } from "../../lib/analytics";
import { api } from "../../lib/api";
import type { Brand, Market, PriceLibraryItem } from "../../types";
import { formatBRL, useDebouncedValue } from "../shared";

type SortOption = "cheapest" | "most_recent" | "most_records";

export function RegionalPriceLibraryPage() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [periodDays, setPeriodDays] = useState(30);
  const [sort, setSort] = useState<SortOption>("most_recent");
  const debouncedSearch = useDebouncedValue(search);
  const debouncedCategory = useDebouncedValue(categoryName);
  const queryString = useMemo(
    () =>
      buildPriceLibraryQuery({
        search: debouncedSearch,
        city,
        state,
        neighborhood,
        categoryName: debouncedCategory,
        brandId,
        marketId,
        periodDays,
        sort,
      }),
    [brandId, city, debouncedCategory, debouncedSearch, marketId, neighborhood, periodDays, sort, state],
  );
  const library = useQuery({
    queryKey: ["price-library", queryString],
    queryFn: () => api<PriceLibraryItem[]>(`/price-library?${queryString}`),
  });
  const brands = useQuery({ queryKey: ["brands", ""], queryFn: () => api<Brand[]>("/brands") });
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => api<Market[]>("/markets") });

  useEffect(() => {
    trackEvent("view_price_library", { source: "regional_price_library" });
  }, []);

  useEffect(() => {
    trackSafeSearch("compare", debouncedSearch);
  }, [debouncedSearch]);

  return (
    <ScreenContainer title="Preços da região" subtitle="Consulte estimativas agregadas de produtos próximos a você.">
      <section className="rounded-xl border border-line bg-white p-3 shadow-sm">
        <SearchBar placeholder="Buscar produto" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <AppInput label="Cidade" value={city} onChange={(event) => setCity(event.target.value)} />
          <AppInput label="UF" maxLength={2} value={state} onChange={(event) => setState(event.target.value.toUpperCase())} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <AppInput label="Bairro" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} />
          <AppInput label="Categoria" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Marca</span>
            <select className={selectClass} value={brandId} onChange={(event) => setBrandId(event.target.value)}>
              <option value="">Todas</option>
              {brands.data?.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Mercado</span>
            <select className={selectClass} value={marketId} onChange={(event) => setMarketId(event.target.value)}>
              <option value="">Todos</option>
              {markets.data?.map((market) => (
                <option key={market.id} value={market.id}>
                  {[market.name, market.neighborhood, market.city].filter(Boolean).join(" - ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Período</span>
            <select className={selectClass} value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}>
              <option value={30}>Últimos 30 dias</option>
              <option value={60}>Últimos 60 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={180}>Últimos 180 dias</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Ordenar</span>
            <select className={selectClass} value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
              <option value="most_recent">Mais recentes</option>
              <option value="cheapest">Mais baratos</option>
              <option value="most_records">Mais registros</option>
            </select>
          </label>
        </div>
      </section>

      <p className="mt-3 rounded-xl border border-mint/20 bg-mint/5 p-3 text-xs leading-5 text-ink/60">
        Os preços são estimativas baseadas em registros de usuários. Valores podem variar por loja, data e promoção.
      </p>

      {library.isLoading ? <LoadingState /> : null}
      {!library.isLoading && !library.data?.length ? (
        <div className="mt-4">
          <EmptyState title="Nenhum produto com dados regionais suficientes para esses filtros." />
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {library.data?.map((item) => (
          <RegionalPriceCard key={priceLibraryCardKey(item)} item={item} periodDays={periodDays} />
        ))}
      </div>
    </ScreenContainer>
  );
}

function RegionalPriceCard({ item, periodDays }: { item: PriceLibraryItem; periodDays: number }) {
  const packageLabel = formatPackageSize(item.packageSize, item.packageUnit);
  const title = [item.productName, item.brandName, packageLabel].filter(Boolean).join(" ");

  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-base font-black text-ink">{title}</h2>
          {item.categoryName ? <p className="mt-0.5 text-xs font-semibold text-ink/55">{item.categoryName}</p> : null}
        </div>
        <QualityBadges confidence={item.confidence} recordsCount={item.recordsCount} lastUpdatedAt={item.lastUpdatedAt} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <PriceMetric label="Menor preço" value={regionalPriceLabel(item.normalizedMinPrice ?? item.minPrice, item.normalizedUnit)} />
        <PriceMetric label="Média" value={regionalPriceLabel(item.normalizedAvgPrice ?? item.avgPrice, item.normalizedUnit)} />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink/65">
        Mercado mais barato: <span className="font-black text-ink">{item.cheapestMarketName ?? "-"}</span>
      </p>
      <p className="mt-1 text-xs font-semibold text-ink/50">
        {item.recordsCount} registros · {item.marketsCount} mercado(s) · últimos {item.periodDays ?? periodDays} dias · atualizado em {formatDate(item.lastUpdatedAt)}
      </p>
      <div className="mt-3">
        <ReportPriceAction recordId={item.reportableRecordId} />
      </div>
    </article>
  );
}

function QualityBadges({
  confidence,
  recordsCount,
  lastUpdatedAt,
}: {
  confidence: PriceLibraryItem["confidence"];
  recordsCount: number;
  lastUpdatedAt?: string | null;
}) {
  const badges = [
    { label: confidenceLabel(confidence), className: "bg-mint/10 text-mint" },
    ...(recordsCount < 5 ? [{ label: "Poucos dados", className: "bg-paper text-ink/65" }] : []),
    ...(isOldPrice(lastUpdatedAt) ? [{ label: "Preço antigo", className: "bg-paper text-ink/65" }] : []),
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

function PriceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper p-3">
      <p className="text-xs font-semibold text-ink/55">{label}</p>
      <p className="mt-1 text-base font-black text-ink">{value}</p>
    </div>
  );
}

function buildPriceLibraryQuery(values: {
  search: string;
  city: string;
  state: string;
  neighborhood: string;
  categoryName: string;
  brandId: string;
  marketId: string;
  periodDays: number;
  sort: SortOption;
}) {
  const params = new URLSearchParams();
  appendParam(params, "search", values.search);
  appendParam(params, "city", values.city);
  appendParam(params, "state", values.state);
  appendParam(params, "neighborhood", values.neighborhood);
  appendParam(params, "categoryName", values.categoryName);
  appendParam(params, "brandId", values.brandId);
  appendParam(params, "marketId", values.marketId);
  params.set("periodDays", String(values.periodDays));
  params.set("sort", values.sort);
  return params.toString();
}

function appendParam(params: URLSearchParams, key: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return;
  params.set(key, String(value));
}

function regionalPriceLabel(value: number, unit?: string | null) {
  return unit ? `${formatBRL(value)}/${unit}` : formatBRL(value);
}

function confidenceLabel(confidence: PriceLibraryItem["confidence"]) {
  if (confidence === "high") return "Alta confiança";
  if (confidence === "medium") return "Média confiança";
  return "Baixa confiança";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function isOldPrice(value?: string | null) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() > 30 * 24 * 60 * 60_000;
}

function priceLibraryCardKey(item: PriceLibraryItem) {
  return [item.productName, item.brandName, item.packageSize, item.packageUnit, item.categoryName].join("|");
}

const selectClass =
  "h-12 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/10";
