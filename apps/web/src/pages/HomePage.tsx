import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BarChart3, BookOpen, ChevronRight, CircleDollarSign, History, Loader2, Package, Plus, ShoppingCart, Sparkles, Store, TrendingUp } from "lucide-react";
import { AppButton, EmptyState, ErrorState, LoadingState, ScreenContainer } from "../components";
import { AdSlot } from "../ads/AdSlot";
import { trackEvent } from "../lib/analytics";
import { api } from "../lib/api";
import { OPEN_TUTORIAL_ON_NEXT_HOME_KEY, useAuth } from "../lib/auth";
import type { DashboardReport, MarketList, Purchase } from "../types";
import { formatBRL, addListCache, setActivePurchaseCache } from "./shared";
import { PurchaseTitleDialog } from "./purchase/PurchaseTitleDialog";
import { GondlyTutorialGuide } from "./TutorialPage";

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [purchaseTitleDialogOpen, setPurchaseTitleDialogOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardReport>("/reports/dashboard") });
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const startPurchase = useMutation({
    mutationFn: async ({ title }: { title: string }) => {
      const list = await api<MarketList>("/lists", { method: "POST", body: { name: title } });
      const purchase = await api<Purchase>("/purchases/start", { method: "POST", body: { sourceListId: list.id } });
      return { list, purchase };
    },
    onSuccess: ({ list, purchase }) => {
      setPurchaseTitleDialogOpen(false);
      queryClient.setQueryData<MarketList>(["list", list.id], list);
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => addListCache(current, list));
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => setActivePurchaseCache(current, purchase));
      trackEvent("create_list", { list_id: list.id, source: "home_start_purchase", items_count: list.items.length });
      trackEvent("start_purchase", {
        purchase_id: purchase.id,
        source: "home",
        has_source_list: true,
        items_count: purchase.items.length,
        cart_items_count: purchase.items.filter((item) => Number(item.pricePaid ?? 0) > 0).length,
      });
      navigate(`/app/purchase/${purchase.id}`);
    },
  });

  useEffect(() => {
    if (!user?.id || sessionStorage.getItem(OPEN_TUTORIAL_ON_NEXT_HOME_KEY) !== "true") return;

    sessionStorage.removeItem(OPEN_TUTORIAL_ON_NEXT_HOME_KEY);
    setTutorialOpen(true);
    trackEvent("open_tutorial", { source: "first_login" });
  }, [user?.id]);

  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ScreenContainer title="Gondly"><ErrorState /></ScreenContainer>;

  const data = dashboard.data;
  const activePurchase = active.data?.[0];
  const activePurchaseTitle = activePurchase?.sourceList?.name ?? "Compra sem lista";
  const activeCartItems = activePurchase?.items.filter((item) => Number(item.pricePaid ?? 0) > 0).length ?? 0;
  const activeCartItemsLabel = `${activeCartItems} ${activeCartItems === 1 ? "item" : "itens"} no carrinho`;
  const firstName = user?.name?.trim().split(/\s+/)[0] || "bem-vindo";
  const hasLists = Boolean(lists.data?.length);
  const lastPurchaseDate = formatShortDate(data?.lastPurchase?.completedAt ?? data?.lastPurchase?.startedAt);
  const lastPurchaseAmount = data?.lastPurchase ? data.lastPurchase.finalPaidAmount ?? data.lastPurchase.subtotalCalculated : 0;

  return (
    <ScreenContainer>
      <header className="mb-5 pr-12">
        <p className="text-3xl font-black tracking-[-0.055em] text-ink">Gondly</p>
        <div className="mt-7">
          <h1 className="text-3xl font-black tracking-[-0.045em] text-ink">Olá, {firstName}</h1>
          <p className="mt-1 text-base font-medium text-ink/60">Organize, compare e economize.</p>
          <button
            type="button"
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-black text-ink shadow-sm transition hover:border-mint/30 hover:text-mint"
            onClick={() => {
              trackEvent("open_tutorial", { source: "home" });
              setTutorialOpen(true);
            }}
          >
            <BookOpen className="h-4 w-4" />
            Ver guia
          </button>
        </div>
      </header>

      <section className="rounded-[28px] bg-mint p-5 text-white shadow-[0_18px_44px_rgba(79,70,229,0.28)]">
        {active.isLoading ? (
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-white/70">Compra</p>
              <p className="text-xl font-black tracking-[-0.03em]">Verificando compra ativa...</p>
            </div>
          </div>
        ) : activePurchase ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/12 text-white">
                <ShoppingCart className="h-6 w-6" />
              </span>
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10 text-white">
                <Package className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-white/70">Compra em andamento</p>
              <h2 className="mt-1 truncate text-2xl font-black tracking-[-0.04em]">{activePurchaseTitle}</h2>
              <p className="mt-2 text-base font-semibold text-white/80">
                {formatBRL(activePurchase.subtotalCalculated)} · {activeCartItemsLabel}
              </p>
            </div>
            <button
              type="button"
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-mint shadow-soft transition active:scale-[0.99]"
              onClick={() => {
                trackEvent("continue_purchase", {
                  purchase_id: activePurchase.id,
                  source: "home",
                  items_count: activePurchase.items.length,
                  cart_items_count: activeCartItems,
                });
                navigate(`/app/purchase/${activePurchase.id}`);
              }}
            >
              Continuar compra
              <ArrowRight className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/12 text-white">
                <ShoppingCart className="h-6 w-6" />
              </span>
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10 text-white">
                <Plus className="h-5 w-5" />
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.04em]">Nova compra</h2>
            <p className="mt-2 text-sm leading-6 text-white/78">Registre os preços enquanto compra e compare depois.</p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-mint shadow-soft transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => setPurchaseTitleDialogOpen(true)}
                disabled={startPurchase.isPending}
              >
                {startPurchase.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                Iniciar compra
              </button>
              {hasLists ? (
                <button
                  type="button"
                  className="h-12 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-black text-white transition active:scale-[0.99]"
                  onClick={() => {
                    trackEvent("continue_purchase", { source: "home_existing_list" });
                    navigate("/app/purchase/start");
                  }}
                >
                  Usar lista existente
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className="mt-4 rounded-[24px] border border-line bg-white p-4 shadow-sm">
        <h2 className="text-base font-black tracking-[-0.02em] text-ink">Resumo do mês</h2>
        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-line">
          <HomeMetric icon={<CircleDollarSign className="h-5 w-5" />} label="Gasto no mês" value={formatBRL(data?.totalSpentMonth ?? 0)} />
          <HomeMetric icon={<Package className="h-5 w-5" />} label="Compras" value={data?.monthPurchasesCount ?? 0} />
          <HomeMetric icon={<Store className="h-5 w-5" />} label="Mercado" value={data?.favoriteMarket ?? "-"} />
          <HomeMetric icon={<TrendingUp className="h-5 w-5" />} label="Economia" value={formatBRL(data?.estimatedSavings ?? 0)} />
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-black tracking-[-0.02em] text-ink">Atalhos</h2>
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <HomeShortcut
            to="/app/lists/new"
            icon={<Plus className="h-5 w-5" />}
            label="Nova lista"
            onClick={() => trackEvent("click_create_list_shortcut", { source: "home" })}
          />
          <HomeShortcut
            to="/app/compare"
            icon={<BarChart3 className="h-5 w-5" />}
            label="Comparar preços"
            onClick={() => trackEvent("click_compare_shortcut", { source: "home" })}
          />
          <HomeShortcut to="/app/markets" icon={<Store className="h-5 w-5" />} label="Mercados" />
          <HomeShortcut to="/app/history" icon={<History className="h-5 w-5" />} label="Histórico" />
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-black tracking-[-0.02em] text-ink">Última compra</h2>
        {data?.lastPurchase ? (
          <button
            type="button"
            onClick={() => navigate(`/app/history/${data.lastPurchase?.id}`)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-mint/25 hover:shadow-soft active:scale-[0.99]"
          >
            <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-mint/10 text-mint">
              <Store className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-black tracking-[-0.03em] text-ink">{data.lastPurchase.market?.name ?? "Mercado"}</span>
              <span className="mt-0.5 block text-sm font-semibold text-ink/55">
                {formatBRL(lastPurchaseAmount)}{lastPurchaseDate ? ` · ${lastPurchaseDate}` : ""}
              </span>
            </span>
            <span className="inline-flex flex-none items-center gap-1 text-sm font-black text-mint">
              Ver detalhes
              <ChevronRight className="h-5 w-5" />
            </span>
          </button>
        ) : (
          <div className="rounded-2xl border border-line bg-white p-4 text-sm font-semibold text-ink/55 shadow-sm">
            Nenhuma compra registrada ainda.
          </div>
        )}
      </section>

      <section className="mt-5 rounded-[24px] border border-mint/20 bg-mint/5 p-4 shadow-sm">
        <div className="flex gap-3">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-mint text-white shadow-soft">
            <Sparkles className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black tracking-[-0.02em] text-mint">Comparação inteligente</h2>
            <p className="mt-1 text-sm leading-6 text-ink/60">
              Quando você repetir itens, o Gondly mostra qual mercado saiu mais barato com base nas suas compras anteriores.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-mint/20 bg-white text-sm font-black text-mint shadow-sm transition active:scale-[0.99]"
          onClick={() => {
            trackEvent("click_compare_shortcut", { source: "home_comparison_card" });
            navigate("/app/compare");
          }}
        >
          Comparar preços
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      <AdSlot slot="home_inline" className="mt-5" />
      <PurchaseTitleDialog
        open={purchaseTitleDialogOpen}
        loading={startPurchase.isPending}
        onClose={() => {
          if (!startPurchase.isPending) setPurchaseTitleDialogOpen(false);
        }}
        onConfirm={(title) => startPurchase.mutate({ title })}
      />
      <GondlyTutorialGuide open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </ScreenContainer>
  );
}

function HomeMetric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-r border-line p-3.5 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-2xl bg-mint/10 text-mint">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-ink/55">{label}</span>
          <span className="mt-0.5 block truncate text-base font-black tracking-[-0.03em] text-ink">{value}</span>
        </span>
      </div>
    </div>
  );
}

function HomeShortcut({ to, icon, label, onClick }: { to: string; icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex min-h-20 items-center gap-3 border-b border-r border-line p-4 text-ink transition hover:bg-paper active:bg-paper even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-mint/10 text-mint">{icon}</span>
      <span className="min-w-0 truncate text-sm font-black tracking-[-0.015em]">{label}</span>
    </Link>
  );
}

function formatShortDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}
