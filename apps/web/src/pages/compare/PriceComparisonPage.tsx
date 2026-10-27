import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  HelpCircle,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { AppButton, AppInput, CategoryBadge, CategoryIcon, EmptyState, LoadingState, ScreenContainer, formatPackageSize } from "../../components";
import { ReportPriceAction } from "../../components/ReportPriceAction";
import { AdSlot } from "../../ads/AdSlot";
import { trackEvent, trackSafeSearch } from "../../lib/analytics";
import { api } from "../../lib/api";
import type {
  Brand,
  InsightsReport,
  Market,
  PriceComparison,
  PriceLibraryItem,
  PriceLibraryMarket,
  Purchase,
  PurchaseRegionalPriceComparison,
  ReverseGeocodeResult,
} from "../../types";
import { formatBRL, useDebouncedValue } from "../shared";
import { COMPARISON_PAGE_SIZE, comparisonCategories, filterComparisonProducts, priceRangeVariation } from "./comparisonPresentation";
import { ComparisonCategoryFilter, ComparisonResultsCount, PriceVariationBadge } from "./ComparisonControls";

import { comparisonRegionParams, locateComparisonRegion, type ComparisonLocation, type LocatedComparisonRegion } from "./comparisonLocation";
import { reverseGeocodeForComparison } from "./browserGeocoding";

type TabKey = "mine" | "region" | "basket";
type CardData = { kind: "mine"; item: PriceComparison } | { kind: "region"; item: PriceLibraryItem };
type FilterSection = "brand" | "period" | "market" | "region";

const periodOptions = [7, 30, 60, 90];
const tabAnalyticsMode: Record<TabKey, string> = { mine: "meus_precos", region: "regiao", basket: "cesta" };

export function PriceComparisonPage() {
  const [tab, setTab] = useState<TabKey>("region");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [brandId, setBrandId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [category, setCategory] = useState("");
  const [visibleCount, setVisibleCount] = useState(COMPARISON_PAGE_SIZE);
  const [periodDays, setPeriodDays] = useState(30);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);
  const [location, setLocation] = useState<ComparisonLocation | null>(null);
  const regionParams = comparisonRegionParams({ city, state, neighborhood }, location, radiusKm);
  const [filterSection, setFilterSection] = useState<FilterSection | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailData, setDetailData] = useState<CardData | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");

  const brands = useQuery({ queryKey: ["brands", ""], queryFn: () => api<Brand[]>("/brands") });
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => api<Market[]>("/markets") });
  const selectedBrandName = brands.data?.find((brand) => brand.id === brandId)?.name;
  const selectedMarketName = markets.data?.find((market) => market.id === marketId)?.name;

  const startDate = useMemo(() => new Date(Date.now() - periodDays * 24 * 60 * 60_000).toISOString(), [periodDays]);

  const regionQuery = useQuery({
    queryKey: ["price-library", debouncedSearch, brandId, marketId, regionParams, periodDays],
    queryFn: () =>
      api<PriceLibraryItem[]>(
        `/price-library?${buildParams({
          search: debouncedSearch,
          brandId,
          marketId,
          ...regionParams,
          periodDays: String(periodDays),
          sort: "most_recent",
        })}`,
      ),
    enabled: tab === "region",
  });

  const mineQuery = useQuery({
    queryKey: ["price-comparison-mine", marketId, startDate],
    queryFn: () => api<PriceComparison[]>(`/reports/products-price-comparison?${buildParams({ marketId, startDate })}`),
    enabled: tab === "mine",
  });

  const insightsQuery = useQuery({
    queryKey: ["price-comparison-insights", marketId, startDate],
    queryFn: () => api<InsightsReport>(`/reports/insights?${buildParams({ marketId, startDate })}`),
    enabled: tab === "mine",
  });

  const purchasesQuery = useQuery({
    queryKey: ["purchases"],
    queryFn: () => api<Purchase[]>("/purchases"),
    enabled: tab === "basket",
  });

  const basketComparisonQuery = useQuery({
    queryKey: ["purchase-regional-comparison", selectedPurchaseId],
    queryFn: () => api<PurchaseRegionalPriceComparison>(`/price-comparison/purchase/${selectedPurchaseId}/regional`),
    enabled: tab === "basket" && Boolean(selectedPurchaseId),
  });

  const mineItems = useMemo(() => filterComparisonProducts(mineQuery.data ?? [], { category, search: debouncedSearch, brandName: selectedBrandName }), [mineQuery.data, category, debouncedSearch, selectedBrandName]);
  const regionItems = useMemo(() => filterComparisonProducts(regionQuery.data ?? [], { category }), [regionQuery.data, category]);
  const categories = useMemo(() => comparisonCategories(tab === "mine" ? mineQuery.data ?? [] : regionQuery.data ?? []), [tab, mineQuery.data, regionQuery.data]);

  useEffect(() => {
    setVisibleCount(COMPARISON_PAGE_SIZE);
  }, [tab, category, debouncedSearch, brandId, marketId, periodDays, city, state, neighborhood, location, radiusKm]);

  const regionSummary = useMemo(() => regionSummaryFromItems(regionItems), [regionItems]);
  const bestRegionKey = regionSummary ? priceLibraryCardKey(regionSummary.best) : null;

  useEffect(() => {
    trackEvent("view_price_comparison", { mode: tabAnalyticsMode[tab] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFirstTabEffect = useRef(true);
  useEffect(() => {
    if (isFirstTabEffect.current) {
      isFirstTabEffect.current = false;
      return;
    }
    trackEvent("change_price_comparison_mode", { mode: tabAnalyticsMode[tab] });
  }, [tab]);

  useEffect(() => {
    trackSafeSearch("compare", debouncedSearch);
  }, [debouncedSearch]);

  function openDetail(data: CardData) {
    setDetailData(data);
    trackEvent("open_price_comparison_detail", {
      comparison_level: data.kind === "region" ? "regiao" : "meus_precos",
      category: cardCategory(data),
    });
  }

  function openMarkets(item: PriceLibraryItem) {
    setDetailData({ kind: "region", item });
    trackEvent("open_market_price_list", { category: item.categoryName ?? undefined });
  }

  return (
    <ScreenContainer
      title="Comparar preços"
      subtitle="Seu histórico e os preços da sua região"
      headerAction={
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="Ajuda sobre preços da região"
          className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-ink/60 shadow-sm transition hover:border-mint/30 hover:text-mint"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      }
    >
      <Tabs value={tab} onChange={setTab} />

      {tab !== "basket" ? (
        <>
          <div className="mt-3 relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produto, marca ou categoria"
              className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-11 text-base text-ink shadow-sm outline-none transition duration-200 placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint/10"
            />
            <button
              type="button"
              onClick={() => setFilterSection("region")}
              aria-label="Abrir filtros"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink/50 transition hover:bg-paper hover:text-mint"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          <ComparisonCategoryFilter categories={categories} selected={category} onChange={setCategory} />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <FilterChip
              icon={Tag}
              label={selectedBrandName ?? "Marca"}
              active={Boolean(brandId)}
              onClick={() => setFilterSection("brand")}
            />
            <FilterChip
              icon={Calendar}
              label={periodDays === 30 ? "Período" : `${periodDays} dias`}
              active={periodDays !== 30}
              onClick={() => setFilterSection("period")}
            />
            <FilterChip
              icon={Store}
              label={selectedMarketName ?? "Mercado"}
              active={Boolean(marketId)}
              onClick={() => setFilterSection("market")}
            />
            <FilterChip
              icon={MapPin}
              label={location ? `Perto de mim · ${radiusKm} km` : city ? `Região: ${[city, state].filter(Boolean).join(" · ")}` : "Definir região"}
              active={Boolean(location || city || state || neighborhood)}
              tone="mint"
              onClick={() => setFilterSection("region")}
            />
          </div>
        </>
      ) : null}

      {tab === "region" || tab === "basket" ? (
        <p className="mt-3 rounded-xl border border-mint/20 bg-mint/5 p-3 text-xs leading-5 text-ink/60">
          Estimativa baseada em registros anônimos. Preços podem variar por loja, data e promoção.
        </p>
      ) : null}

      {tab === "region" ? (
        <div className="mt-4">
          <p className="mb-3 text-xs text-ink/60">{location ? `Busca em aproximadamente ${radiusKm} km da sua localização. Registros sem coordenadas ficam fora desse filtro.` : city || state || neighborhood ? "Busca pela região preenchida, sem filtro por distância." : "Mostrando todas as regiões. Use Definir região para buscar perto de você."}</p>
          <RegionSummaryCard summary={regionSummary} loading={regionQuery.isLoading} onRefresh={() => regionQuery.refetch()} />
        </div>
      ) : null}

      {tab === "region" ? (
        <div className="mt-4 space-y-3">
          {regionQuery.isLoading ? <LoadingState /> : null}
          {!regionQuery.isLoading && !regionItems.length ? (
            <EmptyState
              title={
                debouncedSearch.trim() || category
                  ? "Nenhum produto encontrado para a categoria e os filtros selecionados."
                  : "Ainda não há dados suficientes na sua região. Continue registrando compras para ajudar a comunidade."
              }
            />
          ) : null}
          <ComparisonResultsCount count={regionItems.length} visible={visibleCount} />
          {regionItems.slice(0, visibleCount).map((item) => (
            <ProductCard
              key={priceLibraryCardKey(item)}
              data={{ kind: "region", item }}
              highlight={bestRegionKey === priceLibraryCardKey(item)}
              onDetails={() => openDetail({ kind: "region", item })}
              onMarkets={() => openMarkets(item)}
            />
          ))}
          {visibleCount < regionItems.length ? <AppButton full variant="secondary" onClick={() => setVisibleCount(count => count + COMPARISON_PAGE_SIZE)}>Mostrar mais {Math.min(COMPARISON_PAGE_SIZE, regionItems.length - visibleCount)} produtos</AppButton> : null}
        </div>
      ) : null}

      {tab === "mine" ? (
        <>
          <div className="mt-4">
            <MyPricesSummary report={insightsQuery.data} loading={insightsQuery.isLoading} />
            {category || selectedBrandName || debouncedSearch.trim() ? <p className="mt-2 text-xs leading-5 text-ink/55">Resumo geral do período e mercado selecionados. Categoria, marca e busca filtram a lista de produtos abaixo.</p> : null}
          </div>
          <div className="mt-4 space-y-3">
            {mineQuery.isLoading ? <LoadingState /> : null}
            {!mineQuery.isLoading && !mineItems.length ? (
              <EmptyState
                title={
                  debouncedSearch.trim() || category || selectedBrandName
                    ? "Nenhum produto encontrado para a categoria e os filtros selecionados."
                    : "Você ainda não tem preços suficientes. Finalize compras para criar seu histórico."
                }
              />
            ) : null}
            <ComparisonResultsCount count={mineItems.length} visible={visibleCount} />
            {mineItems.slice(0, visibleCount).map((item) => (
              <ProductCard key={item.productName} data={{ kind: "mine", item }} onDetails={() => openDetail({ kind: "mine", item })} />
            ))}
            {visibleCount < mineItems.length ? <AppButton full variant="secondary" onClick={() => setVisibleCount(count => count + COMPARISON_PAGE_SIZE)}>Mostrar mais {Math.min(COMPARISON_PAGE_SIZE, mineItems.length - visibleCount)} produtos</AppButton> : null}
          </div>
        </>
      ) : null}

      {tab === "basket" ? (
        <BasketTab
          purchases={purchasesQuery.data ?? []}
          loadingPurchases={purchasesQuery.isLoading}
          selectedPurchaseId={selectedPurchaseId}
          onSelectPurchase={setSelectedPurchaseId}
          comparison={basketComparisonQuery.data}
          loadingComparison={basketComparisonQuery.isFetching}
        />
      ) : null}

      <div className="mt-4">
        <AdSlot slot="compare_inline" hasContent={tab === "region" ? regionItems.length > 0 : tab === "mine" ? mineItems.length > 0 : false} disabled={tab === "region" ? regionQuery.isLoading || regionQuery.isError : tab === "mine" ? mineQuery.isLoading || mineQuery.isError || insightsQuery.isLoading || insightsQuery.isError : true} />
      </div>

      {helpOpen ? <HelpModal onClose={() => setHelpOpen(false)} /> : null}

      {filterSection ? (
        <FiltersSheet
          section={filterSection}
          onClose={() => setFilterSection(null)}
          brands={brands.data ?? []}
          markets={markets.data ?? []}
          brandId={brandId}
          onBrandId={setBrandId}
          marketId={marketId}
          onMarketId={setMarketId}
          periodDays={periodDays}
          onPeriodDays={setPeriodDays}
          city={city}
          onCity={value => { setCity(value); setLocation(null); }}
          state={state}
          onState={value => { setState(value); setLocation(null); }}
          neighborhood={neighborhood}
          onNeighborhood={value => { setNeighborhood(value); setLocation(null); }}
          location={location}
          onLocation={({ location: value, region }) => { setLocation(value); setCity(region.city); setState(region.state); setNeighborhood(region.neighborhood); }}
          radiusKm={radiusKm}
          onRadiusKm={setRadiusKm}
        />
      ) : null}

      {detailData ? (
        <ProductDetailSheet data={detailData} periodDays={periodDays} regionParams={regionParams} onClose={() => setDetailData(null)} />
      ) : null}
    </ScreenContainer>
  );
}

function Tabs({ value, onChange }: { value: TabKey; onChange: (value: TabKey) => void }) {
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "mine", label: "Meus preços" },
    { key: "region", label: "Região" },
    { key: "basket", label: "Cesta" },
  ];

  return (
    <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-line bg-white p-1 shadow-sm">
      {tabs.map((entry) => {
        const active = entry.key === value;
        return (
          <button
            key={entry.key}
            type="button"
            onClick={() => onChange(entry.key)}
            className={[
              "h-10 rounded-lg text-sm font-bold transition",
              active ? "bg-mint/10 text-mint" : "text-[#64748B] hover:bg-paper",
            ].join(" ")}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({
  icon: Icon,
  label,
  active,
  tone = "default",
  onClick,
}: {
  icon: typeof Tag;
  label: string;
  active?: boolean;
  tone?: "default" | "mint";
  onClick: () => void;
}) {
  const activeTone = tone === "mint" ? "border-mint/40 text-mint bg-mint/5" : "border-mint/30 text-mint bg-mint/5";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-none items-center gap-1.5 rounded-full border bg-white px-3 py-2 text-xs font-bold shadow-sm transition",
        active ? activeTone : "border-line text-ink/70 hover:border-mint/25",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-mint/10 text-mint">
            <HelpCircle className="h-5 w-5" />
          </span>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-paper text-ink/60 hover:bg-line" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-4 text-lg font-bold tracking-tight text-ink">Como funcionam os preços da região</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Os preços regionais são estimativas baseadas em registros anônimos de usuários. Valores podem variar por loja, data e promoção.
        </p>
        <AppButton full className="mt-5" onClick={onClose}>
          Entendi
        </AppButton>
      </div>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-line bg-white p-5 shadow-lift sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-paper text-ink/60 hover:bg-line" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function FiltersSheet({
  section,
  onClose,
  brands,
  markets,
  brandId,
  onBrandId,
  marketId,
  onMarketId,
  periodDays,
  onPeriodDays,
  city,
  onCity,
  state,
  onState,
  neighborhood,
  onNeighborhood,
  radiusKm,
  onRadiusKm,
  location,
  onLocation,
}: {
  section: FilterSection;
  onClose: () => void;
  brands: Brand[];
  markets: Market[];
  brandId: string;
  onBrandId: (value: string) => void;
  marketId: string;
  onMarketId: (value: string) => void;
  periodDays: number;
  onPeriodDays: (value: number) => void;
  city: string;
  onCity: (value: string) => void;
  state: string;
  onState: (value: string) => void;
  neighborhood: string;
  onNeighborhood: (value: string) => void;
  location: ComparisonLocation | null;
  onLocation: (value: LocatedComparisonRegion) => void;
  radiusKm: number;
  onRadiusKm: (value: number) => void;
}) {
  const titles: Record<FilterSection, string> = {
    brand: "Marca",
    period: "Período",
    market: "Mercado",
    region: "Região",
  };

  return (
    <Sheet title={titles[section]} onClose={onClose}>
      {section === "brand" ? (
        <div className="space-y-1">
          <FilterOption label="Todas" selected={!brandId} onClick={() => onBrandId("")} />
          {brands.map((brand) => (
            <FilterOption key={brand.id} label={brand.name} selected={brandId === brand.id} onClick={() => onBrandId(brand.id)} />
          ))}
        </div>
      ) : null}

      {section === "period" ? (
        <div className="grid grid-cols-2 gap-2">
          {periodOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onPeriodDays(option)}
              className={[
                "h-12 rounded-xl border text-sm font-bold transition",
                periodDays === option ? "border-mint bg-mint/10 text-mint" : "border-line text-ink/70 hover:border-mint/25",
              ].join(" ")}
            >
              {option} dias
            </button>
          ))}
        </div>
      ) : null}

      {section === "market" ? (
        <div className="space-y-1">
          <FilterOption label="Todos" selected={!marketId} onClick={() => onMarketId("")} />
          {markets.map((market) => (
            <FilterOption
              key={market.id}
              label={[market.name, market.neighborhood, market.city].filter(Boolean).join(" · ")}
              selected={marketId === market.id}
              onClick={() => onMarketId(market.id)}
            />
          ))}
        </div>
      ) : null}

      {section === "region" ? (
        <div className="space-y-3">
          <UseMyLocationButton onResolve={onLocation} />
          {location ? <p className="text-xs text-ink/60">Localização obtida · precisão estimada de {Math.round(location.accuracy)} m. A busca usa coordenadas aproximadas dos mercados.</p> : <p className="text-xs text-ink/60">Sem GPS, a busca usa cidade e bairro, sem filtro por distância.</p>}
          <div className="grid grid-cols-2 gap-2">
            <AppInput label="Cidade" value={city} onChange={(event) => onCity(event.target.value)} placeholder="Ex.: Barra Mansa" />
            <AppInput label="UF" maxLength={2} value={state} onChange={(event) => onState(event.target.value.toUpperCase())} placeholder="RJ" />
          </div>
          <AppInput label="Bairro" value={neighborhood} onChange={(event) => onNeighborhood(event.target.value)} placeholder="Opcional" />
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-ink">Raio</span>
            <div className="grid grid-cols-3 gap-2">
              {[2, 5, 10].map((km) => (
                <button
                  key={km}
                  type="button"
                  disabled={!location}
                  onClick={() => onRadiusKm(km)}
                  className={[
                    "h-11 rounded-xl border text-sm font-bold transition disabled:opacity-40",
                    radiusKm === km ? "border-mint bg-mint/10 text-mint" : "border-line text-ink/70 hover:border-mint/25",
                  ].join(" ")}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>
          {!city && !location ? <p className="text-xs font-semibold text-ink/50">Defina sua região para comparar preços próximos de você.</p> : null}
        </div>
      ) : null}

      <AppButton full className="mt-5" onClick={onClose}>
        Aplicar
      </AppButton>
    </Sheet>
  );
}

function UseMyLocationButton({ onResolve }: { onResolve: (result: LocatedComparisonRegion) => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "region-unavailable">("idle");

  async function handleClick() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const result = await locateComparisonRegion(navigator.geolocation, location =>
        reverseGeocodeForComparison(location, ({ latitude, longitude }) =>
          api<ReverseGeocodeResult>(`/geocoding/reverse?${new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) })}`),
        ),
      );
      onResolve(result);
      trackEvent("use_my_location", { context: "compare_region_filter" });
      setStatus(result.regionResolved ? "idle" : "region-unavailable");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/5 px-3 py-3 text-sm font-bold text-mint transition hover:bg-mint/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LocateFixed className="h-4 w-4" />
        {status === "loading" ? "Localizando..." : "Usar minha localização"}
      </button>
      <p className="mt-1.5 text-xs text-ink/55">Ao usar, suas coordenadas serão consultadas em um serviço de endereços. Se o Google estiver indisponível, usamos a <a href="https://www.bigdatacloud.com/privacy-policy" target="_blank" rel="noreferrer" className="underline">BigDataCloud</a>, que recebe sua posição e IP. Você pode preencher a região manualmente.</p>
      {status === "error" ? (
        <p className="mt-1.5 text-xs font-semibold text-tomato">Não foi possível obter sua localização. Preencha manualmente ou tente novamente.</p>
      ) : null}
      {status === "region-unavailable" ? (
        <p role="status" className="mt-1.5 text-xs font-semibold text-ink/60">Sua posição foi obtida e o raio está ativo, mas o serviço de endereços não conseguiu preencher cidade, UF e bairro. Tente novamente ou preencha manualmente; ao editar os campos, a busca passa a usar a região informada.</p>
      ) : null}
    </div>
  );
}

function FilterOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition",
        selected ? "bg-mint/10 text-mint" : "text-ink hover:bg-paper",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

type RegionSummary = { best: PriceLibraryItem; topMarket: string | null; totalRecords: number; latest: string | null };

function regionSummaryFromItems(items: PriceLibraryItem[]): RegionSummary | null {
  if (!items.length) return null;

  const best = [...items].sort((left, right) => (left.normalizedMinPrice ?? left.minPrice) - (right.normalizedMinPrice ?? right.minPrice))[0];
  const marketCounts = new Map<string, number>();
  for (const item of items) {
    if (item.cheapestMarketName) marketCounts.set(item.cheapestMarketName, (marketCounts.get(item.cheapestMarketName) ?? 0) + 1);
  }
  const topMarket = [...marketCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const totalRecords = items.reduce((sum, item) => sum + item.recordsCount, 0);
  const latest = items.reduce<string | null>((current, item) => {
    if (!item.lastUpdatedAt) return current;
    if (!current || item.lastUpdatedAt > current) return item.lastUpdatedAt;
    return current;
  }, null);

  return { best, topMarket, totalRecords, latest };
}

function RegionSummaryCard({ summary, loading, onRefresh }: { summary: RegionSummary | null; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-ink">Resumo da região</h2>
        <button type="button" onClick={onRefresh} className="flex items-center gap-1.5 text-xs font-bold text-ink/50 transition hover:text-mint">
          {relativeDayLabel(summary?.latest) === "hoje" ? "Atualizado hoje" : "Atualizar"}
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? <LoadingState /> : null}

      {!loading && !summary ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-ink/60">
          Ainda não há dados suficientes na sua região. Continue registrando compras para melhorar a comparação.
        </p>
      ) : null}

      {!loading && summary ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat icon={Sparkles} label="Melhor oportunidade" value={summary.best.productName} secondary={formatBRL(summary.best.minPrice)} />
          <MiniStat icon={Store} label="Mercado com menor média" value={summary.topMarket ?? "-"} />
          <MiniStat icon={TrendingUp} label="Registros na região" value={String(summary.totalRecords)} />
          <MiniStat icon={Clock} label="Atualizado" value={relativeDayLabel(summary.latest)} />
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, secondary }: { icon: typeof Tag; label: string; value: string; secondary?: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-mint/10 text-mint">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-semibold text-ink/55">{label}</p>
      <p className="mt-0.5 truncate text-sm font-black text-ink">{value}</p>
      {secondary ? <p className="text-sm font-black text-mint">{secondary}</p> : null}
    </div>
  );
}

function MyPricesSummary({ report, loading }: { report?: InsightsReport; loading: boolean }) {
  if (loading) return <LoadingState />;
  if (!report || !report.products.length) return null;

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <h2 className="text-base font-bold tracking-tight text-ink">Seu histórico</h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat icon={Sparkles} label="Produto mais comprado" value={report.products[0]?.productName ?? "-"} />
        <MiniStat icon={Store} label="Mercado mais frequente" value={report.markets[0]?.marketName ?? "-"} />
        <MiniStat
          icon={TrendingUp}
          label="Maior variação de preço"
          value={report.variation[0]?.productName ?? "-"}
          secondary={report.variation[0] ? formatBRL(report.variation[0].variation) : undefined}
        />
        <MiniStat icon={Clock} label="Compras analisadas" value={String(report.purchasesCount ?? 0)} />
      </div>
    </div>
  );
}

function cardCategory(data: CardData) {
  return data.kind === "region" ? data.item.categoryName : data.item.category;
}

function cardTitle(data: CardData) {
  const packageLabel = formatPackageSize(data.item.packageSize, data.item.packageUnit);
  return [data.item.productName, data.item.brandName, packageLabel].filter(Boolean).join(" ");
}

function cardIdentity(data: CardData) {
  const packageLabel = formatPackageSize(data.item.packageSize, data.item.packageUnit);
  return [data.item.brandName, packageLabel].filter(Boolean).join(" · ");
}

function cardPrices(data: CardData) {
  if (data.kind === "region") {
    return { min: data.item.minPrice, avg: data.item.avgPrice, max: data.item.maxPrice ?? data.item.avgPrice };
  }
  return { min: data.item.minPrice, avg: data.item.averagePrice, max: data.item.maxPrice };
}

function ProductCard({ data, highlight, onDetails, onMarkets }: { data: CardData; highlight?: boolean; onDetails: () => void; onMarkets?: () => void }) {
  const prices = cardPrices(data);
  const category = cardCategory(data);
  const hasVariation = data.kind === "mine" && (priceRangeVariation(prices.min, prices.max)?.difference ?? 0) > 0;

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${hasVariation ? "border-amber-300 bg-amber-50/30" : "border-line bg-white"}`}>
      {highlight ? (
        <span className="mb-3 inline-block rounded-full bg-mint/10 px-2.5 py-1 text-[11px] font-black text-mint">Mais barato da região</span>
      ) : null}
      <div className="flex items-start gap-3">
        <div className="hidden flex-none text-center sm:block">
          <CategoryIcon category={category} />
          <div className="mt-1.5">
            <CategoryBadge category={category} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 sm:hidden"><CategoryBadge category={category} /></div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words text-base font-black text-ink">{cardTitle(data)}</h3>
              {cardIdentity(data) ? <p className="mt-0.5 truncate text-xs font-semibold text-ink/55">{cardIdentity(data)}</p> : null}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <PriceColumn label="Menor" value={prices.min != null ? formatBRL(prices.min) : "--"} tone={data.kind === "mine" ? hasVariation ? "low" : "neutral" : undefined} />
            <PriceColumn label="Média" value={prices.avg != null ? formatBRL(prices.avg) : "--"} tone={data.kind === "mine" ? "neutral" : undefined} />
            <PriceColumn label="Maior" value={prices.max != null ? formatBRL(prices.max) : "--"} tone={data.kind === "mine" ? hasVariation ? "high" : "neutral" : undefined} />
          </div>
          {data.kind === "mine" ? <PriceVariationBadge min={prices.min} max={prices.max} purchasesCount={data.item.purchasesCount} /> : null}

          <div className="mt-3 flex gap-2">
            <AppButton variant="secondary" className="h-9 flex-1 px-3 text-xs" onClick={onDetails}>
              Detalhes
            </AppButton>
            {data.kind === "region" && onMarkets ? (
              <AppButton className="h-9 flex-1 px-3 text-xs" onClick={onMarkets}>
                Mercados
              </AppButton>
            ) : null}
          </div>

          <div className="mt-3 border-t border-line pt-3">
            {data.kind === "region" ? <RegionCardFooter item={data.item} /> : <MineCardFooter item={data.item} />}
          </div>
        </div>
      </div>
    </article>
  );
}

function PriceColumn({ label, value, tone }: { label: string; value: string; tone?: "low" | "high" | "neutral" }) {
  const colors = tone === "low" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "high" ? "border border-rose-200 bg-rose-50 text-rose-800" : "bg-paper text-ink";
  return (
    <div className={`rounded-lg p-2 text-center ${colors}`}>
      <p className="text-[11px] font-semibold opacity-75">{label}</p>
      <p className={`mt-0.5 text-sm font-black ${tone ? "" : "text-mint"}`}>{value}</p>
    </div>
  );
}

function RegionCardFooter({ item }: { item: PriceLibraryItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold text-ink/55">
      <span className="flex items-center gap-1">
        <Store className="h-3.5 w-3.5" /> Mais barato: {item.cheapestMarketName ?? "-"}
      </span>
      <span className="flex items-center gap-1">
        <Users className="h-3.5 w-3.5" /> {item.recordsCount} contribuições
      </span>
      <span className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" /> Última atualização: {relativeDayLabel(item.lastUpdatedAt)}
      </span>
      <span className="flex items-center gap-1 text-mint">
        <ShieldCheck className="h-3.5 w-3.5" /> {confidenceLabel(item.confidence)}
      </span>
    </div>
  );
}

function MineCardFooter({ item }: { item: PriceComparison }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold text-ink/55">
      <span className="flex items-center gap-1">
        <Store className="h-3.5 w-3.5" /> Último mercado: {item.lastMarket ?? "-"}
      </span>
      <span className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" /> Última compra: {relativeDayLabel(item.lastPurchasedAt)}
      </span>
      <span className="flex items-center gap-1">
        <Users className="h-3.5 w-3.5" /> {item.purchasesCount ?? 0} compra(s) registrada(s)
      </span>
    </div>
  );
}

function ProductDetailSheet({
  data,
  periodDays,
  regionParams,
  onClose,
}: {
  data: CardData;
  periodDays: number;
  regionParams: Record<string, string>;
  onClose: () => void;
}) {
  const marketsQuery = useQuery({
    queryKey: ["price-library-markets", data.item.productName, data.item.brandName, data.item.packageSize, data.item.packageUnit, regionParams, periodDays],
    queryFn: () =>
      api<PriceLibraryMarket[]>(
        `/price-library/markets?${buildParams({
          productName: data.item.productName,
          packageSize: data.item.packageSize != null ? String(data.item.packageSize) : undefined,
          packageUnit: data.item.packageUnit ?? undefined,
          ...regionParams,
          periodDays: String(periodDays),
        })}`,
      ),
    enabled: data.kind === "region",
  });

  const prices = cardPrices(data);
  const normalizedLine =
    data.kind === "region" && data.item.normalizedUnit
      ? regionalPriceLabel(data.item.normalizedAvgPrice ?? data.item.avgPrice, data.item.normalizedUnit)
      : null;

  return (
    <Sheet title={data.item.productName} onClose={onClose}>
      <p className="text-sm font-semibold text-ink/55">{[cardIdentity(data), cardCategory(data)].filter(Boolean).join(" · ") || "Sem categoria"}</p>

      <h3 className="mt-4 text-sm font-bold text-ink">Resumo de preços</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {data.kind === "mine" && data.item.lastPrice != null ? <DetailStat label="Você pagou" value={formatBRL(data.item.lastPrice)} /> : null}
        <DetailStat label={data.kind === "region" ? "Menor preço regional" : "Menor preço"} value={prices.min != null ? formatBRL(prices.min) : "--"} />
        <DetailStat label={data.kind === "region" ? "Média regional" : "Média"} value={prices.avg != null ? formatBRL(prices.avg) : "--"} />
        <DetailStat label={data.kind === "region" ? "Maior preço regional" : "Maior preço"} value={prices.max != null ? formatBRL(prices.max) : "--"} />
        {normalizedLine ? <DetailStat label="Preço normalizado" value={normalizedLine} /> : null}
      </div>
      {data.kind === "mine" ? <PriceVariationBadge min={prices.min} max={prices.max} purchasesCount={data.item.purchasesCount} /> : null}

      {data.kind === "region" ? (
        <>
          <h3 className="mt-5 text-sm font-bold text-ink">Mercados encontrados</h3>
          {marketsQuery.isLoading ? <LoadingState /> : null}
          {!marketsQuery.isLoading && !marketsQuery.data?.length ? (
            <p className="mt-2 text-sm font-semibold text-ink/55">Dados insuficientes para detalhar este produto.</p>
          ) : null}
          <div className="mt-2 space-y-2">
            {marketsQuery.data?.map((market) => (
              <div key={market.marketId} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-ink">{market.marketName}</p>
                  <p className="text-sm font-black text-mint">{formatBRL(market.price)}</p>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-ink/55">{[market.neighborhood, market.city].filter(Boolean).join(" · ") || "Localização não informada"}</p>
                <p className="mt-1 text-[11px] font-semibold text-ink/45">
                  Atualizado {relativeDayLabel(market.lastUpdatedAt)} · {market.recordsCount} registro(s)
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <ReportPriceAction recordId={data.item.reportableRecordId} />
          </div>
        </>
      ) : null}
    </Sheet>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper p-3">
      <p className="text-xs font-semibold text-ink/55">{label}</p>
      <p className="mt-1 text-base font-black text-ink">{value}</p>
    </div>
  );
}

function BasketTab({
  purchases,
  loadingPurchases,
  selectedPurchaseId,
  onSelectPurchase,
  comparison,
  loadingComparison,
}: {
  purchases: Purchase[];
  loadingPurchases: boolean;
  selectedPurchaseId: string;
  onSelectPurchase: (value: string) => void;
  comparison?: PurchaseRegionalPriceComparison;
  loadingComparison: boolean;
}) {
  const navigate = useNavigate();
  const completed = purchases.filter((purchase) => purchase.status === "completed");

  if (loadingPurchases) return <LoadingState />;

  if (!completed.length) {
    return (
      <div className="mt-4">
        <EmptyState
          title="Compare uma compra inteira"
          action={
            <div className="text-center">
              <p className="mb-3 max-w-xs text-sm font-semibold leading-6 text-ink/60">
                Em breve, você poderá escolher uma lista ou compra e ver em qual mercado ela tende a sair mais barata.
              </p>
              <AppButton icon={<ShoppingBasket className="h-4 w-4" />} onClick={() => navigate("/app/lists")}>
                Escolher lista
              </AppButton>
              <p className="mt-2 text-xs font-semibold text-ink/40">Funcionalidade em desenvolvimento</p>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mt-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Escolher compra</span>
        <select
          value={selectedPurchaseId}
          onChange={(event) => onSelectPurchase(event.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/10"
        >
          <option value="">Selecione uma compra finalizada</option>
          {completed.map((purchase) => (
            <option key={purchase.id} value={purchase.id}>
              {[purchase.market?.name ?? "Mercado", formatDate(purchase.completedAt ?? purchase.startedAt), formatBRL(purchase.finalPaidAmount ?? purchase.subtotalCalculated)].join(
                " · ",
              )}
            </option>
          ))}
        </select>
      </label>

      {!selectedPurchaseId ? <p className="mt-3 text-sm font-semibold text-ink/55">Escolha uma compra para ver a estimativa por mercado.</p> : null}

      {selectedPurchaseId && loadingComparison ? <LoadingState /> : null}

      {selectedPurchaseId && !loadingComparison && comparison && !comparison.estimatedMarkets.length ? (
        <div className="mt-4">
          <EmptyState title="Dados insuficientes para comparar esta compra." />
        </div>
      ) : null}

      {comparison && comparison.estimatedMarkets.length ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-line bg-white p-3 text-sm font-semibold text-ink/60">
            Total pago: <span className="font-black text-ink">{formatBRL(comparison.originalTotal)}</span>
            {comparison.originalMarket ? ` em ${comparison.originalMarket.marketName}` : ""}
          </div>
          {comparison.estimatedMarkets.map((market) => (
            <div key={market.marketId} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-ink">{market.marketName}</p>
                <p className="text-base font-black text-mint">{formatBRL(market.estimatedTotal)}</p>
              </div>
              <p className={["mt-1 text-xs font-bold", market.estimatedSavings > 0 ? "text-emerald-600" : "text-ink/55"].join(" ")}>
                {market.estimatedSavings > 0 ? `Economia estimada de ${formatBRL(market.estimatedSavings)}` : "Sem economia estimada"}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-ink/45">
                {market.matchedItemsCount} item(ns) comparado(s) · {confidenceLabel(market.confidence)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildParams(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

function priceLibraryCardKey(item: PriceLibraryItem) {
  return [item.productName, item.brandName, item.packageSize, item.packageUnit, item.categoryName].join("|");
}

function regionalPriceLabel(value: number, unit?: string | null) {
  return unit ? `${formatBRL(value)}/${unit}` : formatBRL(value);
}

function confidenceLabel(confidence: PriceLibraryItem["confidence"]) {
  if (confidence === "high") return "Alta confiança";
  if (confidence === "medium") return "Média confiança";
  return "Baixa confiança";
}

function relativeDayLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;
  return date.toLocaleDateString("pt-BR");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}
