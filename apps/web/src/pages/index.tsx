import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Archive,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit,
  FileText,
  FileUp,
  Filter,
  History,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Package,
  Plus,
  ReceiptText,
  RefreshCcw,
  ScanLine,
  Share2,
  ShoppingCart,
  Store,
  Tags,
  TrendingUp,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import type { ListItemStatus, Unit } from "@gondly/types";
import { api, isNetworkFailure } from "../lib/api";
import { useAuth } from "../lib/auth";
import { parseShoppingListFile, type ParsedShoppingList } from "../lib/listImport";
import { createRealtimeSocket } from "../lib/realtime";
import {
  createLocalItemId,
  discardQueuedPurchaseChanges,
  isLocalId,
  queuePurchaseItemUpsert,
  syncOutbox,
  useOutboxStatus,
} from "../lib/offlineQueue";
import {
  AppButton,
  AppInput,
  ConfirmDialog,
  DateRangeFilter,
  EmptyState,
  ErrorState,
  FloatingActionButton,
  ListItemRow,
  LoadingState,
  MarketCard,
  MarketListCard,
  MarketSelect,
  MemberAvatar,
  MoneyInput,
  MonetizationBadge,
  PriceCard,
  ProductCard,
  ProductSearchInput,
  PurchaseItemCard,
  QuantityInput,
  ScreenContainer,
  SearchBar,
  SectionHeader,
  StartPurchasePanel,
  SummaryCard,
  UnitSelect,
  unitLabels,
} from "../components";
import { AdSlot, useAds } from "../lib/ads";
import type {
  DashboardReport,
  InsightsReport,
  ListMember,
  Market,
  MarketList,
  MarketListItem,
  ListInvite,
  PriceComparison,
  Product,
  ProductPriceDetailsReport,
  Purchase,
  PurchaseItem,
  ShareLinkInfo,
  User,
} from "../types";

const units = ["un", "kg", "g", "l", "ml", "pacote", "caixa", "outro"] as const;

const listSchema = z.object({
  name: z.string().min(2, "Informe um nome"),
  description: z.string().optional(),
});

const marketSchema = z.object({
  name: z.string().min(2, "Informe um nome"),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

const productSchema = z.object({
  name: z.string().min(2, "Informe um produto"),
  brand: z.string().optional(),
  category: z.string().optional(),
  defaultUnit: z.enum(units),
  barcode: z.string().optional(),
});

function parseDecimalInput(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;

  const cleaned = value.trim().replace(/\s/g, "").replace(/[R$]/g, "");
  if (!cleaned) return Number.NaN;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    return Number(cleaned.replaceAll(thousandSeparator, "").replace(decimalSeparator, "."));
  }

  if (lastComma >= 0) {
    return Number(`${cleaned.slice(0, lastComma).replaceAll(",", "")}.${cleaned.slice(lastComma + 1)}`);
  }

  if (lastDot >= 0 && cleaned.indexOf(".") !== lastDot) {
    return Number(`${cleaned.slice(0, lastDot).replaceAll(".", "")}.${cleaned.slice(lastDot + 1)}`);
  }

  return Number(cleaned);
}

function decimalValue(value: unknown, fallback = 0) {
  const parsed = parseDecimalInput(value);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function optimisticCartItem(values: CartItemForm, id?: string): PurchaseItem {
  return {
    id: id ?? createLocalItemId(),
    productId: values.productId ?? null,
    productName: values.productName,
    brand: values.brand || null,
    category: values.category || null,
    quantity: values.quantity,
    unit: values.unit,
    pricePaid: values.pricePaid,
    unitPriceNormalized: null,
    normalizedUnitLabel: null,
    notes: values.notes || null,
  };
}

function patchPurchaseItemCache(purchases: Purchase[] | undefined, purchaseId: string, item: PurchaseItem, itemId?: string) {
  if (!purchases) return purchases;

  return purchases.map((purchase) => {
    if (purchase.id !== purchaseId) return purchase;

    const items = itemId ? purchase.items.map((entry) => (entry.id === itemId ? item : entry)) : [item, ...purchase.items];
    return {
      ...purchase,
      items,
      subtotalCalculated: roundMoney(items.reduce((sum, entry) => sum + Number(entry.pricePaid ?? 0), 0)),
    };
  });
}

function reconcilePurchaseCache(purchases: Purchase[] | undefined, nextPurchase: Purchase, completedLocalItemId?: string) {
  if (!purchases) return purchases;
  return purchases.map((purchase) => {
    if (purchase.id !== nextPurchase.id) return purchase;

    const pendingLocalItems = purchase.items.filter((item) => item.id.startsWith("local-") && item.id !== completedLocalItemId);
    const items = [...pendingLocalItems, ...nextPurchase.items];

    return {
      ...nextPurchase,
      items,
      subtotalCalculated: roundMoney(items.reduce((sum, entry) => sum + Number(entry.pricePaid ?? 0), 0)),
    };
  });
}

function setActivePurchaseCache(purchases: Purchase[] | undefined, nextPurchase: Purchase) {
  if (!purchases?.length) return [nextPurchase];
  return [nextPurchase, ...purchases.filter((purchase) => purchase.id !== nextPurchase.id && purchase.status === "in_progress")];
}

function removeActivePurchaseCache(purchases: Purchase[] | undefined, purchaseId?: string) {
  if (!purchases) return purchases;
  return purchases.filter((purchase) => purchase.id !== purchaseId);
}

function isQueueableWriteError(error: unknown) {
  return isNetworkFailure(error);
}

function updateListItemCache(list: MarketList | undefined, item: MarketListItem) {
  if (!list) return list;
  return { ...list, items: list.items.map((entry) => (entry.id === item.id ? item : entry)) };
}

function removeListItemCache(list: MarketList | undefined, itemId: string) {
  if (!list) return list;
  return { ...list, items: list.items.filter((entry) => entry.id !== itemId) };
}

function addListItemCache(list: MarketList | undefined, item: MarketListItem) {
  if (!list) return list;
  return { ...list, items: [item, ...list.items.filter((entry) => entry.id !== item.id)] };
}

function updateListsCache(lists: MarketList[] | undefined, nextList: MarketList) {
  if (!lists) return lists;
  return lists.map((list) => (list.id === nextList.id ? { ...list, ...nextList } : list));
}

function addListCache(lists: MarketList[] | undefined, nextList: MarketList) {
  if (!lists) return lists;
  return [nextList, ...lists.filter((list) => list.id !== nextList.id)];
}

function removeListCache(lists: MarketList[] | undefined, listId: string) {
  if (!lists) return lists;
  return lists.filter((list) => list.id !== listId);
}

function groupItemsByCategory<T extends { category?: string | null }>(items: T[]) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const category = item.category?.trim() || "Sem setor";
    const current = groups.get(category) ?? [];
    current.push(item);
    groups.set(category, current);
  }

  const orderedGroups = [...groups.entries()].map(([category, groupedItems]) => ({ category, items: groupedItems }));
  const uncategorized = orderedGroups.find((group) => group.category === "Sem setor");
  return [
    ...orderedGroups.filter((group) => group.category !== "Sem setor"),
    ...(uncategorized ? [uncategorized] : []),
  ];
}

type ListStatusFilter = "all" | ListItemStatus;

function matchesListStatus(item: MarketListItem, status: ListStatusFilter) {
  return status === "all" || item.status === status;
}

function upsertById<T extends { id: string }>(items: T[] | undefined, nextItem: T) {
  if (!items) return items;
  return [nextItem, ...items.filter((item) => item.id !== nextItem.id)];
}

function removeById<T extends { id: string }>(items: T[] | undefined, itemId: string) {
  if (!items) return items;
  return items.filter((item) => item.id !== itemId);
}

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

const decimalNumber = (message: string) => z.preprocess(parseDecimalInput, z.number().min(0, message));
const positiveDecimalNumber = (message: string) => z.preprocess(parseDecimalInput, z.number().positive(message));

const cartItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(2, "Informe um produto"),
  brand: z.string().optional(),
  category: z.string().optional(),
  quantity: positiveDecimalNumber("Quantidade deve ser maior que zero"),
  unit: z.enum(units),
  pricePaid: decimalNumber("Preco deve ser maior ou igual a zero"),
  notes: z.string().optional(),
});

const finishSchema = z.object({
  marketId: z.string().min(1, "Selecione o mercado"),
  finalPaidAmount: decimalNumber("Valor invalido"),
  notes: z.string().optional(),
});

type ListForm = z.infer<typeof listSchema>;
type MarketForm = z.infer<typeof marketSchema>;
type ProductForm = z.infer<typeof productSchema>;
type CartItemForm = z.infer<typeof cartItemSchema>;
type FinishForm = z.infer<typeof finishSchema>;

export function LoginPage() {
  const { loginWithGoogleToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const signupButtonRef = useRef<HTMLDivElement | null>(null);
  const signinButtonRef = useRef<HTMLDivElement | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const redirectAfterLogin = searchParams.get("redirect") || "/app/home";

  useEffect(() => {
    if (!clientId || (!signupButtonRef.current && !signinButtonRef.current)) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential: string }) => {
            await loginWithGoogleToken(response.credential);
            navigate(redirectAfterLogin);
        },
      });

      const renderGoogleButton = (element: HTMLElement | null, text: "signin_with" | "signup_with", width: number) => {
        if (!element) return;
        element.innerHTML = "";
        window.google?.accounts.id.renderButton(element, {
          type: "standard",
          theme: "outline",
          size: "medium",
          text,
          shape: "pill",
          logo_alignment: "left",
          width,
          locale: "pt_BR",
        });
      };

      renderGoogleButton(signinButtonRef.current, "signin_with", 198);
      renderGoogleButton(signupButtonRef.current, "signup_with", 260);
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [clientId, loginWithGoogleToken, navigate, redirectAfterLogin]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <section className="relative mx-auto flex min-h-[88svh] w-full max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/icons/icon.svg" alt="Gondly" className="h-12 w-12 rounded-[14px] shadow-soft" />
            <span className="text-xl font-black tracking-normal text-ink">Gondly</span>
          </div>
          {clientId ? (
            <div ref={signinButtonRef} className="flex min-h-10 w-[198px] items-center justify-end rounded-full bg-white shadow-soft" />
          ) : (
            <span className="rounded-full border border-tomato/20 bg-white px-3 py-2 text-xs font-black text-tomato shadow-soft">
              Login indisponível
            </span>
          )}
        </header>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.8fr)] lg:py-12">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-mint/12 px-3 py-1.5 text-xs font-black uppercase text-mint">
              Compras organizadas
            </span>
            <h1 className="mt-5 max-w-2xl text-5xl font-black leading-[1.04] tracking-normal text-ink sm:text-6xl">
              Sua lista, seu carrinho e seus preços no mesmo fluxo.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink/65 sm:text-lg">
              Organize listas de mercado, abra o carrinho rapidamente e acompanhe preços para decidir melhor antes de passar no caixa.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              {clientId ? (
                <div ref={signupButtonRef} className="flex min-h-11 w-[260px] items-center justify-center rounded-full bg-white shadow-soft" />
              ) : (
                <div className="flex min-h-11 w-full max-w-[280px] items-center justify-center rounded-full border border-tomato/20 bg-white px-4 text-sm font-semibold text-tomato shadow-soft">
                  Login Google indisponível
                </div>
              )}
              <p className="max-w-xs text-xs font-semibold text-ink/50">Crie sua conta com Google e sincronize listas, compras e histórico de preços.</p>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <LandingMetric icon={<ListChecks className="h-5 w-5" />} title="Lista pronta" description="Crie itens e transforme tudo em carrinho." tone="mint" />
              <LandingMetric icon={<TrendingUp className="h-5 w-5" />} title="Preço claro" description="Veja histórico e compare mercados." tone="sky" />
              <LandingMetric icon={<ShoppingCart className="h-5 w-5" />} title="Carrinho pronto" description="Transforme a lista em compra sem recadastrar itens." tone="tomato" />
            </div>
          </div>

          <LandingAppPreview />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-3 px-5 pb-10 sm:px-8 md:grid-cols-4 lg:px-10">
        <LandingFeature icon={<ReceiptText className="h-5 w-5" />} title="Listas que viram compra" description="Monte a lista e abra o carrinho sem recadastrar tudo." />
        <LandingFeature icon={<ShoppingCart className="h-5 w-5" />} title="Carrinho rápido" description="Abra uma compra a partir da lista e acompanhe o total." />
        <LandingFeature icon={<ScanLine className="h-5 w-5" />} title="Histórico de preços" description="Compare mercados e acompanhe variações dos produtos." />
        <LandingFeature icon={<Store className="h-5 w-5" />} title="Mercados favoritos" description="Guarde locais, tickets e produtos para decidir mais rápido." />
      </section>
    </main>
  );
}

function LandingMetric({ icon, title, description, tone }: { icon: ReactNode; title: string; description: string; tone: "mint" | "sky" | "tomato" }) {
  const tones = {
    mint: "bg-mint/12 text-mint border-mint/15",
    sky: "bg-sky/12 text-sky border-sky/15",
    tomato: "bg-tomato/12 text-tomato border-tomato/15",
  };

  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
      <div className={["grid h-10 w-10 place-items-center rounded-xl border", tones[tone]].join(" ")}>{icon}</div>
      <p className="mt-3 text-sm font-black text-ink">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-ink/55">{description}</p>
    </div>
  );
}

function LandingFeature({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-soft">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint/12 text-mint">{icon}</div>
      <h2 className="mt-4 text-sm font-black text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60">{description}</p>
    </article>
  );
}

function LandingAppPreview() {
  const items = [
    { name: "Arroz integral", meta: "2 kg", price: "R$ 18,90", done: true },
    { name: "Leite", meta: "6 un", price: "R$ 29,94", done: true },
    { name: "Banana", meta: "1,3 kg", price: "R$ 9,68", done: false },
  ];

  return (
    <div className="relative mx-auto min-h-[520px] w-full max-w-[430px]" aria-hidden="true">
      <div className="absolute left-0 top-12 hidden w-44 rounded-xl border border-line bg-white p-3 shadow-soft sm:block">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky/12 text-sky">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink/45">Melhor preço</p>
            <p className="text-sm font-black text-ink">Mercado Sul</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-16 right-0 hidden w-48 rounded-xl border border-line bg-white p-3 shadow-soft sm:block">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-tomato/12 text-tomato">
            <RefreshCcw className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink/45">Atualizado</p>
            <p className="text-sm font-black text-ink">Lista pronta</p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto w-[284px] rounded-[34px] border-[10px] border-ink bg-ink shadow-lift">
        <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-[16px] bg-ink" />
        <div className="aspect-[9/17] overflow-hidden rounded-[24px] bg-paper p-4">
          <div className="flex items-center justify-between pt-4">
            <div>
              <p className="text-xs font-semibold text-ink/45">Hoje</p>
              <p className="text-xl font-black text-ink">Compra ativa</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-white">
              <ShoppingCart className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-4 rounded-xl bg-ink p-4 text-white">
            <p className="text-xs font-semibold text-white/55">Total estimado</p>
            <p className="mt-1 text-3xl font-black">R$ 84,30</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-[68%] rounded-full bg-leaf" />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <div key={item.name} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-soft">
                <span className={["grid h-8 w-8 place-items-center rounded-xl border", item.done ? "border-mint bg-mint text-white" : "border-line bg-white text-transparent"].join(" ")}>
                  <Check className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-ink">{item.name}</span>
                  <span className="block text-xs font-semibold text-ink/45">{item.meta}</span>
                </span>
                <span className="text-xs font-black text-ink">{item.price}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-sky/12 p-3 text-sky">
              <Package className="h-4 w-4" />
              <p className="mt-2 text-lg font-black">18</p>
              <p className="text-xs font-semibold">itens</p>
            </div>
            <div className="rounded-xl bg-tomato/12 p-3 text-tomato">
              <Store className="h-4 w-4" />
              <p className="mt-2 text-lg font-black">4</p>
              <p className="text-xs font-semibold">mercados</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardReport>("/reports/dashboard") });
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const startPurchase = useMutation({
    mutationFn: () => api<Purchase>("/purchases/start", { method: "POST", body: {} }),
    onSuccess: (purchase) => {
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => setActivePurchaseCache(current, purchase));
      navigate(`/app/purchase/${purchase.id}`);
    },
  });

  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ScreenContainer title="Gondly"><ErrorState /></ScreenContainer>;

  const data = dashboard.data;

  return (
    <ScreenContainer title="Gondly" subtitle={user?.name}>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Gasto no mes" value={formatBRL(data?.totalSpentMonth ?? 0)} />
        <SummaryCard label="Compras" value={data?.monthPurchasesCount ?? 0} tone="sky" />
        <SummaryCard label="Mercado" value={data?.favoriteMarket ?? "-"} tone="leaf" />
        <SummaryCard label="Economia" value={formatBRL(data?.estimatedSavings ?? 0)} tone="tomato" />
      </div>

      <SectionHeader title="Atalhos" />
      <div className="grid grid-cols-2 gap-3">
        <Shortcut to="/app/lists/new" icon={<Plus className="h-5 w-5" />} label="Nova lista" />
        <Shortcut to="/app/history" icon={<History className="h-5 w-5" />} label="Historico" />
        <Shortcut to="/app/compare" icon={<BarChart3 className="h-5 w-5" />} label="Precos" />
        <Shortcut to="/app/markets" icon={<Package className="h-5 w-5" />} label="Mercados" />
      </div>

      <SectionHeader title="Compra" />
      {active.data?.length ? (
        <AppButton full icon={<ShoppingCart className="h-5 w-5" />} onClick={() => navigate(`/app/purchase/${active.data[0].id}`)}>
          Continuar compra
        </AppButton>
      ) : (
        <StartPurchasePanel onStart={() => startPurchase.mutate()} loading={startPurchase.isPending} />
      )}

      <SectionHeader title="Ultima compra" />
      {data?.lastPurchase ? (
        <button onClick={() => navigate(`/app/history/${data.lastPurchase?.id}`)} className="w-full rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-mint/25 hover:shadow-soft">
          <p className="text-sm font-bold text-ink">{data.lastPurchase.market?.name ?? "Mercado"}</p>
          <p className="mt-1 text-xs font-medium text-ink/60">{formatBRL(data.lastPurchase.finalPaidAmount ?? data.lastPurchase.subtotalCalculated)}</p>
        </button>
      ) : (
        <EmptyState title="Nenhuma compra registrada ainda." />
      )}

      <div className="mt-4">
        <AdSlot />
      </div>
    </ScreenContainer>
  );
}

export function ListsPage() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const filtered = data.filter((list) => list.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <ScreenContainer title="Listas">
      <SearchBar placeholder="Buscar lista" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="mt-4 space-y-3">
        {isLoading ? <LoadingState /> : null}
        {!isLoading && !filtered.length ? <EmptyState title="Você ainda não tem listas. Crie sua primeira lista de mercado." /> : null}
        {filtered.map((list, index) => (
          <div key={list.id} className="space-y-3">
            <MarketListCard list={list} onClick={() => navigate(`/app/lists/${list.id}`)} />
            {(index + 1) % 3 === 0 ? <AdSlot /> : null}
          </div>
        ))}
      </div>
      <FloatingActionButton label="Lista" onClick={() => navigate("/app/lists/new")} />
    </ScreenContainer>
  );
}

export function ListDetailPage() {
  const { id = "" } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedShoppingList | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ListStatusFilter>("all");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => new Set());
  const list = useQuery({ queryKey: ["list", id], queryFn: () => api<MarketList>(`/lists/${id}`), enabled: Boolean(id) });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => api<MarketListItem>(`/lists/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: (_item, itemId) => queryClient.setQueryData<MarketList>(["list", id], (current) => removeListItemCache(current, itemId)),
  });
  const archive = useMutation({
    mutationFn: () => api<MarketList>(`/lists/${id}/archive`, { method: "POST" }),
    onSuccess: (archived) => {
      queryClient.setQueryData(["list", id], archived);
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => updateListsCache(current, archived));
      setActionsOpen(false);
    },
  });
  const duplicate = useMutation({
    mutationFn: () => api<MarketList>(`/lists/${id}/duplicate`, { method: "POST" }),
    onSuccess: (copy) => {
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => addListCache(current, copy));
      navigate(`/app/lists/${copy.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/lists/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["list", id] });
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => removeListCache(current, id));
      navigate("/app/lists");
    },
  });
  const setItemState = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: ListItemStatus }) =>
      api<MarketListItem>(`/lists/${id}/items/${itemId}/state`, { method: "PATCH", body: { status } }),
    onSuccess: (item) => {
      queryClient.setQueryData<MarketList>(["list", id], (current) => updateListItemCache(current, item));
      void queryClient.invalidateQueries({ queryKey: ["active-purchases"] });
    },
  });
  const start = useMutation({
    mutationFn: () => api<Purchase>("/purchases/start", { method: "POST", body: { sourceListId: id } }),
    onSuccess: (purchase) => {
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => setActivePurchaseCache(current, purchase));
      navigate(`/app/purchase/${purchase.id}`);
    },
  });
  const importItems = useMutation({
    mutationFn: (preview: ParsedShoppingList) =>
      api<MarketList>(`/lists/${id}/items/import`, { method: "POST", body: { items: preview.items } }),
    onSuccess: (imported) => {
      queryClient.setQueryData(["list", id], imported);
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => updateListsCache(current, imported));
      setImportPreview(null);
      setImportError(null);
      setShowImport(false);
    },
    onError: () => {
      setImportError("Não foi possível importar os itens. Tente novamente.");
    },
  });

  async function handleImportFile(file: File) {
    setImportParsing(true);
    setImportError(null);
    setImportPreview(null);
    try {
      setImportPreview(await parseShoppingListFile(file));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    } finally {
      setImportParsing(false);
    }
  }

  const shareLink = useMutation({
    mutationFn: () => api<ListInvite>(`/lists/${id}/share-link`, { method: "POST" }),
    onSuccess: (invite) => {
      queryClient.setQueryData<MarketList>(["list", id], (current) =>
        current
          ? {
              ...current,
              invites: [invite, ...(current.invites ?? []).filter((entry) => entry.id !== invite.id)],
            }
          : current,
      );
      setShareFeedback("Link de compartilhamento pronto.");
    },
  });
  const approveMember = useMutation({
    mutationFn: (memberId: string) => api(`/lists/${id}/members/${memberId}/approve`, { method: "PUT" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["list", id] });
    },
  });
  const rejectMember = useMutation({
    mutationFn: (memberId: string) => api(`/lists/${id}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["list", id] });
    },
  });

  useEffect(() => {
    if (!id || !token) return;

    const socket = createRealtimeSocket(token);
    const refreshList = () => {
      void queryClient.invalidateQueries({ queryKey: ["list", id] });
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
    };
    const events = [
      "listItemUpdated",
      "itemAssigned",
      "itemPurchased",
      "itemSkipped",
      "listItemsImported",
      "accessRequested",
      "memberApproved",
      "memberRemoved",
    ];

    socket.on("connect", () => socket.emit("joinList", { listId: id }));
    events.forEach((event) => socket.on(event, refreshList));

    return () => {
      socket.emit("leaveList", { listId: id });
      events.forEach((event) => socket.off(event, refreshList));
      socket.disconnect();
    };
  }, [id, queryClient, token]);

  if (list.isLoading) return <LoadingState />;
  if (list.isError || !list.data) return <ScreenContainer title="Lista"><ErrorState /></ScreenContainer>;

  const neededItems = list.data.items.filter((item) => item.status === "pending");
  const atHomeItems = list.data.items.filter((item) => item.status === "at_home");
  const notNeededItems = list.data.items.filter((item) => item.status === "not_needed");
  const acceptedMembers = list.data.members?.filter((member) => member.status === "accepted") ?? [];
  const isOwner = list.data.userId === user?.id;
  const pendingMembers = list.data.members?.filter((member) => member.status === "invited") ?? [];
  const collaborators = acceptedMembers.filter((member) => member.role !== "owner");
  const sectors = [...new Set(list.data.items.map((item) => item.category?.trim() || "Sem setor"))];
  const normalizedSearch = itemSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredItems = list.data.items.filter((item) => {
    const matchesSearch =
      !normalizedSearch ||
      item.productName.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
      item.brand?.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    const matchesSector = sectorFilter === "all" || (item.category?.trim() || "Sem setor") === sectorFilter;
    return matchesSearch && matchesSector && matchesListStatus(item, statusFilter);
  });
  const groupedItems = groupItemsByCategory(filteredItems);
  const activeShareLink =
    shareLink.data ??
    list.data.invites?.find(
      (invite) => !invite.inviteEmail && invite.status === "pending" && new Date(invite.expiresAt) > new Date(),
    );
  const shareUrl = activeShareLink ? `${window.location.origin}/shared/${activeShareLink.inviteToken}` : "";

  function toggleCategory(category: string) {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <ScreenContainer title={list.data.name} subtitle={list.data.description ?? undefined}>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <AppButton icon={<ShoppingCart className="h-5 w-5" />} onClick={() => start.mutate()} loading={start.isPending} loadingLabel="Iniciando">
          Comprar
        </AppButton>
        <AppButton className="w-14 px-0" variant="secondary" icon={<Menu className="h-5 w-5" />} onClick={() => setActionsOpen(true)} aria-label="Abrir ações da lista">
          <span className="sr-only">Ações</span>
        </AppButton>
      </div>

      <ListActionsDrawer
        open={actionsOpen}
        isOwner={isOwner}
        pendingRequests={pendingMembers.length}
        archiving={archive.isPending}
        duplicating={duplicate.isPending}
        onClose={() => setActionsOpen(false)}
        onEdit={() => {
          setActionsOpen(false);
          navigate(`/app/lists/${id}/edit`);
        }}
        onArchive={() => {
          archive.mutate();
        }}
        onDuplicate={() => {
          duplicate.mutate();
        }}
        onImport={() => {
          setActionsOpen(false);
          setShowShare(false);
          setShowImport(true);
        }}
        onShare={() => {
          setActionsOpen(false);
          setShowImport(false);
          setShowShare(true);
        }}
        onDelete={() => {
          setActionsOpen(false);
          setDeleteOpen(true);
        }}
      />

      {showShare && isOwner ? (
        <div className="mt-4">
          <ListSharingPanel
            shareUrl={shareUrl}
            pendingMembers={pendingMembers}
            collaborators={collaborators}
            creatingLink={shareLink.isPending}
            approvingMemberId={approveMember.isPending ? approveMember.variables : undefined}
            rejectingMemberId={rejectMember.isPending ? rejectMember.variables : undefined}
            feedback={shareFeedback}
            onCreateLink={() => shareLink.mutate()}
            onCopy={async () => {
              await navigator.clipboard.writeText(shareUrl);
              setShareFeedback("Link copiado.");
            }}
            onShare={async () => {
              if (navigator.share) {
                await navigator.share({ title: list.data.name, text: `Solicite acesso à lista ${list.data.name}`, url: shareUrl });
              } else {
                await navigator.clipboard.writeText(shareUrl);
                setShareFeedback("Link copiado.");
              }
            }}
            onApprove={(memberId) => approveMember.mutate(memberId)}
            onReject={(memberId) => rejectMember.mutate(memberId)}
          />
        </div>
      ) : null}

      {showImport ? (
        <div className="mt-4">
          <ListImportPanel
            preview={importPreview}
            parsing={importParsing}
            importing={importItems.isPending}
            error={importError}
            onFile={handleImportFile}
            onClear={() => {
              setImportPreview(null);
              setImportError(null);
            }}
            onImport={() => {
              if (importPreview) importItems.mutate(importPreview);
            }}
          />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <PriceCard label="Não tenho" value={neededItems.length} />
        <PriceCard label="Tenho em casa" value={atHomeItems.length} />
        <PriceCard label="Não precisa" value={notNeededItems.length} />
      </div>

      <SectionHeader title="Itens" action={<AppButton variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/app/lists/${id}/edit`)}>Adicionar</AppButton>} />
      <div className="mb-5 space-y-3 rounded-2xl border border-line bg-white p-3.5 shadow-sm">
        <SearchBar placeholder="Buscar produto ou marca" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink/60"><Tags className="h-3.5 w-3.5" /> Setor</span>
            <select className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-mint" value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}>
              <option value="all">Todos</option>
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink/60"><Filter className="h-3.5 w-3.5" /> Status</span>
            <select className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-mint" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ListStatusFilter)}>
              <option value="all">Todos</option>
              <option value="pending">Não tenho em casa</option>
              <option value="at_home">Tenho em casa</option>
              <option value="not_needed">Não precisa esse mês</option>
            </select>
          </label>
        </div>
      </div>
      <div className="space-y-3">
        {!list.data.items.length ? <EmptyState title="Adicione produtos ao carrinho para começar sua compra." /> : null}
        {list.data.items.length && !filteredItems.length ? <EmptyState title="Nenhum item corresponde aos filtros selecionados." /> : null}
        {groupedItems.map((group) => (
          <section key={group.category} className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3.5 py-3 text-left text-ink shadow-sm transition hover:border-mint/25"
              onClick={() => toggleCategory(group.category)}
              aria-expanded={!collapsedCategories.has(group.category)}
              aria-controls={`list-category-${group.category.replace(/\W+/g, "-").toLowerCase()}`}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-black">
                <Tags className="h-4 w-4 flex-none text-mint" />
                <span className="truncate">{group.category}</span>
              </span>
              <span className="flex flex-none items-center gap-2">
                <span className="rounded-full bg-mint/10 px-2 py-0.5 text-xs font-bold text-mint">{group.items.length}</span>
                {collapsedCategories.has(group.category) ? <ChevronRight className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
              </span>
            </button>
            {!collapsedCategories.has(group.category) ? (
              <div id={`list-category-${group.category.replace(/\W+/g, "-").toLowerCase()}`} className="space-y-2">
                {group.items.map((item, index) => (
                  <Fragment key={item.id}>
                    <div className="rounded-2xl border border-line bg-white p-2.5 shadow-sm">
                      <div className="flex gap-2">
                        <div className="min-w-0 flex-1">
                          <ListItemRow item={item} />
                        </div>
                        <button
                          type="button"
                          className="grid h-auto w-11 place-items-center rounded-xl bg-paper text-ink transition hover:bg-line disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => removeItem.mutate(item.id)}
                          disabled={removeItem.isPending && removeItem.variables === item.id}
                          aria-busy={(removeItem.isPending && removeItem.variables === item.id) || undefined}
                        >
                          {removeItem.isPending && removeItem.variables === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="mt-2">
                        <select
                          className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-mint"
                          value={item.status}
                          onChange={(event) => setItemState.mutate({ itemId: item.id, status: event.target.value as ListItemStatus })}
                          disabled={setItemState.isPending && setItemState.variables?.itemId === item.id}
                          aria-label={`Estado de ${item.productName}`}
                        >
                          <option value="pending">Não tenho em casa</option>
                          <option value="at_home">Tenho em casa</option>
                          <option value="not_needed">Não precisa esse mês</option>
                        </select>
                      </div>
                    </div>
                    {(index + 1) % 3 === 0 ? <AdSlot /> : null}
                  </Fragment>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Excluir lista"
        description="Esta lista sera removida. Compras ja finalizadas continuam no historico."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
        confirmLoading={remove.isPending}
      />
    </ScreenContainer>
  );
}

export function CreateEditListPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["list", id], queryFn: () => api<MarketList>(`/lists/${id}`), enabled: isEdit });
  const form = useForm<ListForm>({ resolver: zodResolver(listSchema), defaultValues: { name: "", description: "" } });
  const itemForm = useForm<{ productName: string; category: string; expectedQuantity: number; unit: Unit }>({
    defaultValues: { productName: "", category: "", expectedQuantity: 1, unit: "un" },
  });
  const [creatingSector, setCreatingSector] = useState(false);
  const [itemFeedback, setItemFeedback] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null);
  const [recentlyAddedItems, setRecentlyAddedItems] = useState<MarketListItem[]>([]);
  const selectedSector = itemForm.watch("category");
  const availableSectors = useMemo(() => {
    const sectors = new Set(
      list.data?.items
        .map((item) => item.category?.trim())
        .filter((category): category is string => Boolean(category)) ?? [],
    );
    if (selectedSector.trim()) sectors.add(selectedSector.trim());
    return [...sectors].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [list.data?.items, selectedSector]);

  useEffect(() => {
    if (list.data) form.reset({ name: list.data.name, description: list.data.description ?? "" });
  }, [list.data, form]);

  const save = useMutation({
    mutationFn: (values: ListForm) =>
      isEdit ? api<MarketList>(`/lists/${id}`, { method: "PUT", body: values }) : api<MarketList>("/lists", { method: "POST", body: values }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["list", saved.id], saved);
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => (isEdit ? updateListsCache(current, saved) : addListCache(current, saved)));
      navigate(`/app/lists/${saved.id}`);
    },
  });
  const addItem = useMutation({
    mutationFn: (values: { productName: string; category: string; expectedQuantity: number; unit: Unit }) =>
      api<MarketListItem>(`/lists/${id}/items`, { method: "POST", body: values }),
    onMutate: (values) => {
      setItemFeedback({ tone: "info", message: `Adicionando ${values.productName} à lista...` });
    },
    onSuccess: (item) => {
      setRecentlyAddedItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 5));
      setItemFeedback({ tone: "success", message: `${item.productName} foi adicionado à lista.` });
      itemForm.reset({ productName: "", category: item.category ?? "", expectedQuantity: 1, unit: "un" });
      setCreatingSector(false);
      queryClient.setQueryData<MarketList>(["list", id], (current) => addListItemCache(current, item));
    },
    onError: () => {
      setItemFeedback({ tone: "error", message: "Não foi possível adicionar o item. Tente novamente." });
    },
  });

  return (
    <ScreenContainer title={isEdit ? "Editar lista" : "Nova lista"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Descrição" {...form.register("description")} />
        <AppButton type="submit" full loading={save.isPending} loadingLabel="Salvando">
          Salvar
        </AppButton>
      </form>

      {isEdit ? (
        <>
          <SectionHeader title="Adicionar item" />
          <form className="grid gap-3 rounded-xl bg-white p-4 shadow-soft" onSubmit={itemForm.handleSubmit((values) => addItem.mutate({ ...values, productName: values.productName.trim(), category: values.category.trim() }))}>
            <AppInput label="Produto" disabled={addItem.isPending} {...itemForm.register("productName", { required: true })} />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink/80">Setor</span>
              <select
                className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/10"
                value={creatingSector ? "__new__" : selectedSector}
                disabled={addItem.isPending}
                onChange={(event) => {
                  if (event.target.value === "__new__") {
                    setCreatingSector(true);
                    itemForm.setValue("category", "");
                    return;
                  }
                  setCreatingSector(false);
                  itemForm.setValue("category", event.target.value);
                }}
              >
                <option value="__new__">+ Criar novo setor</option>
                <option value="">Sem setor</option>
                {availableSectors.map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </label>
            {creatingSector ? (
              <AppInput
                label="Nome do novo setor"
                placeholder="Ex.: Bebidas"
                autoFocus
                disabled={addItem.isPending}
                {...itemForm.register("category", { required: creatingSector })}
              />
            ) : null}
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <QuantityInput label="Qtd." disabled={addItem.isPending} {...itemForm.register("expectedQuantity", { valueAsNumber: true })} />
              <UnitSelect label="Un." disabled={addItem.isPending} {...itemForm.register("unit")} />
            </div>
            <AppButton type="submit" full icon={<Plus className="h-4 w-4" />} loading={addItem.isPending} loadingLabel="Adicionando">
              Adicionar
            </AppButton>
            {itemFeedback ? <ItemFeedback tone={itemFeedback.tone} message={itemFeedback.message} /> : null}
          </form>
          {recentlyAddedItems.length ? (
            <>
              <SectionHeader title="Adicionados recentemente" />
              <div className="space-y-2">
                {recentlyAddedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-soft">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-mint/12 text-mint">
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-ink">{item.productName}</span>
                      <span className="block text-xs font-semibold text-ink/50">
                        {item.expectedQuantity ?? 1} {unitLabels[item.unit]} · {item.category || "Sem setor"}
                      </span>
                    </span>
                    <span className="rounded-full bg-mint/12 px-2 py-1 text-xs font-black text-mint">Novo</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </ScreenContainer>
  );
}

function ItemFeedback({ tone, message }: { tone: "info" | "success" | "error"; message: string }) {
  const tones = {
    info: "border-line bg-white text-ink",
    success: "border-mint/20 bg-mint/10 text-mint",
    error: "border-line bg-paper text-ink",
  };

  return (
    <div role="status" aria-live="polite" className={["rounded-xl border px-3 py-2 text-sm font-semibold", tones[tone]].join(" ")}>
      {message}
    </div>
  );
}

function ListActionsDrawer({
  open,
  isOwner,
  pendingRequests,
  archiving,
  duplicating,
  onClose,
  onEdit,
  onArchive,
  onDuplicate,
  onImport,
  onShare,
  onDelete,
}: {
  open: boolean;
  isOwner: boolean;
  pendingRequests: number;
  archiving: boolean;
  duplicating: boolean;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onImport: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="list-actions-title">
      <button type="button" className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar ações" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl border-x border-t border-line bg-white px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-lift">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        <div className="flex items-center justify-between">
          <div>
            <p id="list-actions-title" className="text-lg font-bold tracking-tight text-ink">Ações da lista</p>
            <p className="text-xs font-medium text-ink/60">Gerencie, compartilhe ou importe itens.</p>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-ink shadow-sm" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <AppButton className="h-14 justify-start" full variant="secondary" icon={<Edit className="h-5 w-5" />} onClick={onEdit}>
            Editar
          </AppButton>
          <AppButton className="h-14 justify-start" full variant="secondary" icon={<Archive className="h-5 w-5" />} loading={archiving} loadingLabel="Arquivando" onClick={onArchive}>
            Arquivar
          </AppButton>
          <AppButton className="h-14 justify-start" full variant="secondary" icon={<RefreshCcw className="h-5 w-5" />} loading={duplicating} loadingLabel="Duplicando" onClick={onDuplicate}>
            Duplicar
          </AppButton>
          <AppButton className="h-14 justify-start" full variant="secondary" icon={<FileUp className="h-5 w-5" />} onClick={onImport}>
            Importar
          </AppButton>
          {isOwner ? (
            <AppButton className="relative col-span-2 h-14 justify-start" full variant="secondary" icon={<Share2 className="h-5 w-5" />} onClick={onShare}>
              Compartilhar
              {pendingRequests ? (
                <span className="absolute right-3 rounded-full bg-tomato px-2 py-0.5 text-[11px] font-black text-white">{pendingRequests}</span>
              ) : null}
            </AppButton>
          ) : null}
          {isOwner ? (
            <AppButton className="col-span-2 h-14 justify-start" full variant="danger" icon={<Trash2 className="h-5 w-5" />} onClick={onDelete}>
              Excluir lista
            </AppButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ListSharingPanel({
  shareUrl,
  pendingMembers,
  collaborators,
  creatingLink,
  approvingMemberId,
  rejectingMemberId,
  feedback,
  onCreateLink,
  onCopy,
  onShare,
  onApprove,
  onReject,
}: {
  shareUrl: string;
  pendingMembers: ListMember[];
  collaborators: ListMember[];
  creatingLink: boolean;
  approvingMemberId?: string;
  rejectingMemberId?: string;
  feedback: string | null;
  onCreateLink: () => void;
  onCopy: () => Promise<void>;
  onShare: () => Promise<void>;
  onApprove: (memberId: string) => void;
  onReject: (memberId: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-line bg-white p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-mint/12 text-mint">
          <Share2 className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-black text-ink">Compartilhar lista</span>
          <span className="mt-1 block text-xs text-ink/55">Quem receber o link precisará solicitar acesso. Você decide quem entra.</span>
        </span>
      </div>

      {shareUrl ? (
        <>
          <div className="rounded-xl bg-paper p-3">
            <p className="break-all text-xs font-semibold text-ink/65">{shareUrl}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <AppButton type="button" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => void onCopy()}>
              Copiar link
            </AppButton>
            <AppButton type="button" icon={<Share2 className="h-4 w-4" />} onClick={() => void onShare()}>
              Enviar
            </AppButton>
          </div>
        </>
      ) : (
        <AppButton type="button" full icon={<Share2 className="h-4 w-4" />} loading={creatingLink} loadingLabel="Criando link" onClick={onCreateLink}>
          Criar link
        </AppButton>
      )}

      {feedback ? <ItemFeedback tone="success" message={feedback} /> : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-black text-ink"><UserPlus className="h-4 w-4 text-sky" /> Solicitações</p>
          <span className="rounded-full bg-sky/12 px-2 py-0.5 text-xs font-black text-sky">{pendingMembers.length}</span>
        </div>
        <div className="space-y-2">
          {!pendingMembers.length ? <p className="rounded-xl bg-paper p-3 text-xs font-semibold text-ink/50">Nenhuma solicitação pendente.</p> : null}
          {pendingMembers.map((member) => (
            <div key={member.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-3">
                <MemberAvatar user={member.user} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-ink">{member.user.name}</span>
                  <span className="block truncate text-xs text-ink/50">{member.user.email}</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <AppButton
                  type="button"
                  className="h-10 px-2 text-xs"
                  icon={<UserCheck className="h-4 w-4" />}
                  loading={approvingMemberId === member.id}
                  loadingLabel="Aceitando"
                  onClick={() => onApprove(member.id)}
                >
                  Aceitar
                </AppButton>
                <AppButton
                  type="button"
                  className="h-10 px-2 text-xs"
                  variant="danger"
                  icon={<UserX className="h-4 w-4" />}
                  loading={rejectingMemberId === member.id}
                  loadingLabel="Recusando"
                  onClick={() => onReject(member.id)}
                >
                  Recusar
                </AppButton>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-black text-ink"><Users className="h-4 w-4 text-mint" /> Pessoas com acesso</p>
        <div className="space-y-2">
          {!collaborators.length ? <p className="rounded-xl bg-paper p-3 text-xs font-semibold text-ink/50">A lista ainda não possui colaboradores.</p> : null}
          {collaborators.map((member) => (
            <div key={member.id} className="flex items-center gap-3 rounded-xl bg-paper p-3">
              <MemberAvatar user={member.user} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-ink">{member.user.name}</span>
                <span className="block truncate text-xs text-ink/50">{member.user.email}</span>
              </span>
              <span className="rounded-full bg-mint/12 px-2 py-1 text-[11px] font-black text-mint">Editor</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListImportPanel({
  preview,
  parsing,
  importing,
  error,
  onFile,
  onClear,
  onImport,
}: {
  preview: ParsedShoppingList | null;
  parsing: boolean;
  importing: boolean;
  error: string | null;
  onFile: (file: File) => Promise<void>;
  onClear: () => void;
  onImport: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void onFile(file);
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-sky/12 text-sky">
          <FileText className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-ink">Importar lista DOCX ou PDF</span>
          <span className="mt-1 block text-xs text-ink/55">Os títulos do arquivo viram setores e cada linha vira um item.</span>
        </span>
      </div>

      <input ref={inputRef} type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" className="hidden" onChange={handleFileChange} />
      <AppButton className="mt-3" type="button" full variant="secondary" icon={<FileUp className="h-4 w-4" />} loading={parsing} loadingLabel="Lendo arquivo" onClick={() => inputRef.current?.click()}>
        Selecionar arquivo
      </AppButton>

      {error ? <div className="mt-3"><ItemFeedback tone="error" message={error} /></div> : null}

      {preview ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-mint/10 p-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-ink">{preview.fileName}</span>
              <span className="block text-xs font-semibold text-ink/55">
                {preview.items.length} itens em {preview.sectors.length} setores
              </span>
            </span>
            <button type="button" className="grid h-8 w-8 flex-none place-items-center rounded-xl text-ink/45 hover:bg-white" onClick={onClear} aria-label="Remover arquivo">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {preview.sectors.map((sector) => {
              const items = preview.items.filter((item) => item.category === sector);
              return (
                <details key={sector} className="rounded-xl border border-line bg-paper px-3 py-2">
                  <summary className="cursor-pointer text-sm font-black text-ink">
                    {sector} <span className="text-xs text-ink/45">({items.length})</span>
                  </summary>
                  <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-ink/65">
                    {items.map((item) => (
                      <li key={`${sector}:${item.productName}`} className="flex justify-between gap-3">
                        <span>{item.productName}</span>
                        <span className="flex-none font-semibold">{item.expectedQuantity} {unitLabels[item.unit]}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>

          <AppButton type="button" full icon={<FileUp className="h-4 w-4" />} loading={importing} loadingLabel="Importando itens" onClick={onImport}>
            Importar {preview.items.length} itens
          </AppButton>
        </div>
      ) : null}
    </div>
  );
}

export function SharedListPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const info = useQuery({
    queryKey: ["share-link", token],
    queryFn: () => api<ShareLinkInfo>(`/lists/share-links/${token}`),
    enabled: Boolean(token),
    refetchInterval: (query) => (query.state.data?.accessStatus === "invited" ? 5_000 : false),
  });
  const request = useMutation({
    mutationFn: () => api<{ status: ShareLinkInfo["accessStatus"]; listId: string }>(`/lists/share-links/${token}/request`, { method: "POST" }),
    onSuccess: (result) => {
      queryClient.setQueryData<ShareLinkInfo>(["share-link", token], (current) =>
        current ? { ...current, accessStatus: result.status } : current,
      );
    },
  });

  useEffect(() => {
    if (info.data?.accessStatus !== "accepted" && info.data?.accessStatus !== "owner") return;

    let cancelled = false;
    const listId = info.data.listId;

    async function refreshAccessibleLists() {
      queryClient.removeQueries({ queryKey: ["lists"] });
      await queryClient
        .fetchQuery({
          queryKey: ["lists"],
          queryFn: () => api<MarketList[]>("/lists"),
          staleTime: 0,
        })
        .catch(() => undefined);

      if (!cancelled) {
        navigate(`/app/lists/${listId}`, { replace: true });
      }
    }

    void refreshAccessibleLists();
    return () => {
      cancelled = true;
    };
  }, [info.data?.accessStatus, info.data?.listId, navigate, queryClient]);

  if (info.isLoading) return <LoadingState label="Carregando convite" />;
  if (info.isError || !info.data) {
    return <ScreenContainer title="Lista compartilhada"><ErrorState /></ScreenContainer>;
  }

  const waiting = info.data.accessStatus === "invited" || request.data?.status === "invited";

  return (
    <ScreenContainer title="Lista compartilhada">
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <MemberAvatar user={info.data.owner} />
          <span>
            <span className="block text-xs font-semibold text-ink/45">Lista de {info.data.owner.name}</span>
            <span className="block text-lg font-black text-ink">{info.data.listName}</span>
          </span>
        </div>
        {info.data.description ? <p className="mt-3 text-sm text-ink/60">{info.data.description}</p> : null}

        {waiting ? (
          <div className="mt-4 rounded-xl border border-sky/20 bg-sky/10 p-4 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky" />
            <p className="mt-2 text-sm font-black text-sky">Aguardando aprovação</p>
            <p className="mt-1 text-xs text-ink/55">O dono da lista precisa aceitar sua solicitação. Esta página atualiza automaticamente.</p>
          </div>
        ) : (
          <AppButton className="mt-4" full icon={<UserPlus className="h-4 w-4" />} onClick={() => request.mutate()} loading={request.isPending} loadingLabel="Enviando solicitação">
            Solicitar acesso
          </AppButton>
        )}
        {request.isError ? <div className="mt-3"><ItemFeedback tone="error" message="Não foi possível solicitar acesso." /></div> : null}
      </div>
    </ScreenContainer>
  );
}

export function StartPurchasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const activePurchase = active.data?.[0];
  const start = useMutation({
    mutationFn: (payload: { sourceListId?: string; cancelActive?: boolean } = {}) =>
      api<Purchase>("/purchases/start", { method: "POST", body: payload }),
    onSuccess: (purchase, variables) => {
      if (variables.cancelActive && activePurchase) {
        void discardQueuedPurchaseChanges(activePurchase.id);
      }
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => setActivePurchaseCache(current, purchase));
      navigate(`/app/purchase/${purchase.id}`);
    },
  });

  return (
    <ScreenContainer title="Iniciar compra">
      {activePurchase ? (
        <div className="mb-4 rounded-xl bg-white p-4 shadow-soft">
          <p className="text-sm font-black text-ink">Compra ativa encontrada</p>
          <p className="mt-1 text-xs text-ink/55">{activePurchase.items.length} itens no carrinho</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <AppButton variant="secondary" onClick={() => navigate(`/app/purchase/${activePurchase.id}`)}>
              Continuar
            </AppButton>
            <AppButton
              variant="danger"
              onClick={() => start.mutate({ cancelActive: true })}
              loading={start.isPending && Boolean(start.variables?.cancelActive)}
              loadingLabel="Iniciando"
              disabled={start.isPending && !start.variables?.cancelActive}
            >
              Cancelar e iniciar
            </AppButton>
          </div>
        </div>
      ) : null}
      <AppButton
        full
        icon={<ShoppingCart className="h-5 w-5" />}
        onClick={() => start.mutate({})}
        loading={start.isPending && !start.variables?.sourceListId && !start.variables?.cancelActive}
        loadingLabel="Iniciando"
        disabled={start.isPending && Boolean(start.variables?.sourceListId || start.variables?.cancelActive)}
      >
        Começar do zero
      </AppButton>
      <SectionHeader title="A partir de lista" />
      <div className="space-y-3">
        {lists.data?.map((list) => (
          <MarketListCard
            key={list.id}
            list={list}
            onClick={() => start.mutate({ sourceListId: list.id })}
            loading={start.isPending && start.variables?.sourceListId === list.id}
            disabled={start.isPending && start.variables?.sourceListId !== list.id}
          />
        ))}
        {!lists.isLoading && !lists.data?.length ? <EmptyState title="Você ainda não tem listas. Crie sua primeira lista de mercado." /> : null}
      </div>
    </ScreenContainer>
  );
}

export function ActivePurchasePage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [expandedPurchaseCategories, setExpandedPurchaseCategories] = useState<Set<string>>(() => new Set());
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId");
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const purchase = useMemo(() => active.data?.find((entry) => entry.id === purchaseId) ?? active.data?.[0], [active.data, purchaseId]);
  const outbox = useOutboxStatus(purchase?.id);
  const cancel = useMutation({
    mutationFn: () => api<Purchase>(`/purchases/${purchase?.id}/cancel`, { method: "POST" }),
    onSuccess: (cancelled) => {
      void discardQueuedPurchaseChanges(cancelled.id);
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => removeActivePurchaseCache(current, cancelled.id));
    },
  });

  useEffect(() => {
    if (!purchase?.id || !token) return;

    const socket = createRealtimeSocket(token);
    const refreshPurchase = () => {
      void queryClient.invalidateQueries({ queryKey: ["active-purchases"] });
    };
    socket.on("connect", () => socket.emit("joinPurchase", { purchaseId: purchase.id }));
    socket.on("purchaseItemsSynced", refreshPurchase);

    return () => {
      socket.emit("leavePurchase", { purchaseId: purchase.id });
      socket.off("purchaseItemsSynced", refreshPurchase);
      socket.disconnect();
    };
  }, [purchase?.id, queryClient, token]);

  useEffect(() => {
    setPurchaseSearch("");
    setExpandedPurchaseCategories(new Set());
  }, [purchase?.id]);

  if (active.isLoading) return <LoadingState />;
  if (!purchase) {
    return (
      <ScreenContainer title="Compra ativa">
        <EmptyState title="Adicione produtos ao carrinho para começar sua compra." action={<AppButton onClick={() => navigate("/app/purchase/start")}>Iniciar compra</AppButton>} />
      </ScreenContainer>
    );
  }
  const normalizedPurchaseSearch = purchaseSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredPurchaseItems = purchase.items.filter(
    (item) =>
      !normalizedPurchaseSearch ||
      item.productName.toLocaleLowerCase("pt-BR").includes(normalizedPurchaseSearch) ||
      item.brand?.toLocaleLowerCase("pt-BR").includes(normalizedPurchaseSearch),
  );
  const groupedPurchaseItems = groupItemsByCategory(filteredPurchaseItems);

  function togglePurchaseCategory(category: string) {
    setExpandedPurchaseCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <ScreenContainer title="Compra ativa" subtitle={purchase.sourceList?.name ?? undefined}>
      <div className="sticky top-0 z-20 -mx-4 mb-5 bg-paper/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="rounded-2xl bg-ink p-5 text-white shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/60">Total atual</p>
          <p className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">{formatBRL(purchase.subtotalCalculated)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <AppButton
          variant="secondary"
          icon={<Check className="h-4 w-4" />}
          onClick={() => navigate(`/app/purchase/${purchase.id}/finish`)}
          disabled={outbox.pendingCount > 0}
        >
          Finalizar
        </AppButton>
        <AppButton variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => cancel.mutate()} loading={cancel.isPending} loadingLabel="Cancelando">
          Cancelar
        </AppButton>
      </div>

      {outbox.pendingCount > 0 ? (
        <div className="mt-3 rounded-xl border border-line bg-white p-3 text-sm font-semibold text-ink shadow-sm">
          {outbox.isSyncing ? "Sincronizando alterações do carrinho..." : `${outbox.pendingCount} alteração(ões) aguardando sinal.`}
          <button type="button" className="ml-2 font-black underline" onClick={() => void outbox.syncNow()}>
            Sincronizar
          </button>
        </div>
      ) : null}

      <SectionHeader title="Carrinho" />
      <div className="mb-5 rounded-2xl border border-line bg-white p-3.5 shadow-sm">
        <SearchBar
          placeholder="Buscar produto ou marca"
          value={purchaseSearch}
          onChange={(event) => setPurchaseSearch(event.target.value)}
        />
      </div>
      <div className="space-y-3">
        {!purchase.items.length ? <EmptyState title="Adicione produtos ao carrinho para começar sua compra." /> : null}
        {purchase.items.length && !filteredPurchaseItems.length ? <EmptyState title="Nenhum produto encontrado." /> : null}
        {groupedPurchaseItems.map((group) => {
          const expanded = Boolean(normalizedPurchaseSearch) || expandedPurchaseCategories.has(group.category);
          const categoryId = `purchase-category-${group.category.replace(/\W+/g, "-").toLowerCase()}`;

          return (
            <section key={group.category} className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3.5 py-3 text-left text-ink shadow-sm transition hover:border-mint/25"
                onClick={() => togglePurchaseCategory(group.category)}
                aria-expanded={expanded}
                aria-controls={categoryId}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-black">
                  <Tags className="h-4 w-4 flex-none text-mint" />
                  <span className="truncate">{group.category}</span>
                </span>
                <span className="flex flex-none items-center gap-2">
                  <span className="rounded-full bg-mint/10 px-2 py-0.5 text-xs font-bold text-mint">{group.items.length}</span>
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
                </span>
              </button>
              {expanded ? (
                <div id={categoryId} className="space-y-2">
                  {group.items.map((item) => (
                    <PurchaseItemCard key={item.id} item={item} action={<CartItemActions purchaseId={purchase.id} item={item} />} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      <FloatingActionButton label="Produto" onClick={() => navigate(`/app/purchase/${purchase.id}/item`)} />
    </ScreenContainer>
  );
}

function CartItemActions({ purchaseId, item }: { purchaseId: string; item: PurchaseItem }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="grid h-10 w-10 place-items-center rounded-xl bg-paper text-ink transition hover:bg-line hover:text-mint"
      onClick={() => navigate(`/app/purchase/${purchaseId}/item?itemId=${item.id}`)}
      aria-label="Editar item da compra"
    >
      <ShoppingCart className="h-4 w-4" />
    </button>
  );
}

export function AddEditCartItemPage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId") ?? "";
  const itemId = params.get("itemId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [productName, setProductName] = useState("");
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const purchase = active.data?.find((entry) => entry.id === purchaseId);
  const editingItem = purchase?.items.find((item) => item.id === itemId);
  const form = useForm<CartItemForm>({
    resolver: zodResolver(cartItemSchema),
    defaultValues: { productName: "", quantity: 1, unit: "un", pricePaid: 0 },
  });
  useEffect(() => {
    if (!editingItem) return;
    setProductName(editingItem.productName);
    form.reset({
      productId: editingItem.productId ?? undefined,
      productName: editingItem.productName,
      brand: editingItem.brand ?? "",
      category: editingItem.category ?? "",
      quantity: editingItem.quantity,
      unit: editingItem.unit,
      pricePaid: editingItem.pricePaid,
      notes: editingItem.notes ?? "",
    });
  }, [editingItem, form]);
  const save = useMutation({
    mutationFn: (values: CartItemForm) => {
      if (isLocalId(itemId)) throw new Error("Item pendente de sincronização.");
      return itemId
        ? api<Purchase>(`/purchases/${purchaseId}/items/${itemId}`, { method: "PUT", body: values })
        : api<Purchase>(`/purchases/${purchaseId}/items`, { method: "POST", body: values });
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: ["active-purchases"] });
      const previousActivePurchases = queryClient.getQueryData<Purchase[]>(["active-purchases"]);
      const item = optimisticCartItem(values, itemId ?? undefined);

      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => patchPurchaseItemCache(current, purchaseId, item, itemId ?? undefined));
      navigate(`/app/purchase/${purchaseId}`);
      return { previousActivePurchases, optimisticItemId: item.id.startsWith("local-") ? item.id : undefined };
    },
    onSuccess: (saved, _values, context) => {
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => reconcilePurchaseCache(current, saved, context?.optimisticItemId));
    },
    onError: async (error, values, context) => {
      if (isQueueableWriteError(error) || isLocalId(itemId)) {
        await queuePurchaseItemUpsert({
          purchaseId,
          itemId,
          localItemId: context?.optimisticItemId,
          body: values,
        });
        void syncOutbox();
        return;
      }

      if (context?.previousActivePurchases) {
        queryClient.setQueryData(["active-purchases"], context.previousActivePurchases);
      }
    },
  });

  return (
    <ScreenContainer title="Adicionar ao carrinho">
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate({ ...values, productName: productName.trim() }))}>
        <ProductSearchInput
          value={productName}
          onChange={(value) => {
            setProductName(value);
            form.setValue("productName", value);
          }}
          onSelect={(product) => {
            form.setValue("productId", product.id);
            form.setValue("brand", product.brand ?? "");
            form.setValue("category", product.category ?? "");
            form.setValue("unit", product.defaultUnit);
          }}
        />
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <QuantityInput label="Quantidade" error={form.formState.errors.quantity?.message} {...form.register("quantity")} />
          <UnitSelect label="Unidade" {...form.register("unit")} />
        </div>
        <MoneyInput label="Preço pago" error={form.formState.errors.pricePaid?.message} {...form.register("pricePaid")} />
        <AppInput label="Marca" {...form.register("brand")} />
        <AppInput label="Categoria" {...form.register("category")} />
        <AppInput label="Observações" {...form.register("notes")} />
        <label className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-semibold text-ink/65 shadow-soft">
          <input type="checkbox" defaultChecked={!form.watch("productId")} />
          Salvar produto na minha base
        </label>
        <AppButton
          type="submit"
          full
          icon={<ShoppingCart className="h-4 w-4" />}
          loading={save.isPending}
          loadingLabel={itemId ? "Atualizando carrinho" : "Adicionando ao carrinho"}
        >
          {itemId ? "Atualizar carrinho" : "Adicionar ao carrinho"}
        </AppButton>
      </form>
    </ScreenContainer>
  );
}

export function FinishPurchasePage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const purchase = active.data?.find((entry) => entry.id === purchaseId) ?? active.data?.[0];
  const outbox = useOutboxStatus(purchase?.id);
  const form = useForm<FinishForm>({
    resolver: zodResolver(finishSchema),
    defaultValues: { marketId: "", finalPaidAmount: 0, notes: "" },
  });
  const marketForm = useForm<MarketForm>({ resolver: zodResolver(marketSchema), defaultValues: { name: "", address: "", city: "", notes: "" } });
  const finish = useMutation({
    mutationFn: (values: FinishForm) => api<Purchase>(`/purchases/${purchase?.id}/finish`, { method: "POST", body: values }),
    onSuccess: (saved) => {
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => removeActivePurchaseCache(current, saved.id));
      queryClient.setQueryData(["purchase", saved.id], saved);
      queryClient.setQueryData<Purchase[]>(["purchases"], (current) => (current ? [saved, ...current.filter((purchase) => purchase.id !== saved.id)] : current));
      navigate(`/app/history/${saved.id}`);
    },
  });
  const createMarket = useMutation({
    mutationFn: (values: MarketForm) => api<Market>("/markets", { method: "POST", body: values }),
    onSuccess: (market) => {
      queryClient.setQueryData<Market[]>(["markets"], (current) => (current ? [market, ...current.filter((entry) => entry.id !== market.id)] : current));
      form.setValue("marketId", market.id, { shouldValidate: true });
      marketForm.reset({ name: "", address: "", city: "", notes: "" });
      setShowCreateMarket(false);
    },
  });

  useEffect(() => {
    if (purchase) form.setValue("finalPaidAmount", purchase.subtotalCalculated, { shouldDirty: false });
  }, [form, purchase?.id, purchase?.subtotalCalculated]);

  if (!purchase) return <LoadingState />;
  const finalPaidAmount = decimalValue(form.watch("finalPaidAmount"));
  const difference = purchase.subtotalCalculated - finalPaidAmount;

  return (
    <ScreenContainer title="Finalizar">
      <div className="mb-4 rounded-xl bg-ink p-4 text-white shadow-soft">
        <p className="text-xs text-white/60">Subtotal calculado</p>
        <p className="text-3xl font-black">{formatBRL(purchase.subtotalCalculated)}</p>
      </div>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => finish.mutate(values))}>
        {outbox.pendingCount > 0 ? (
          <ItemFeedback
            tone="info"
            message={
              outbox.isSyncing
                ? "Sincronizando itens do carrinho antes de finalizar."
                : "Finalize depois que os itens pendentes forem enviados. O app tenta sincronizar automaticamente quando o sinal voltar."
            }
          />
        ) : null}
        <MarketSelect
          value={form.watch("marketId")}
          onChange={(value) => form.setValue("marketId", value, { shouldValidate: true })}
          onCreate={() => setShowCreateMarket(true)}
        />
        {showCreateMarket ? (
          <div className="grid gap-3 rounded-xl bg-white p-4 shadow-soft">
            <p className="text-sm font-black text-ink">Cadastrar mercado</p>
            <AppInput label="Nome" error={marketForm.formState.errors.name?.message} {...marketForm.register("name")} />
            <AppInput label="Endereço" {...marketForm.register("address")} />
            <AppInput label="Cidade" {...marketForm.register("city")} />
            <div className="grid grid-cols-2 gap-2">
              <AppButton type="button" variant="secondary" onClick={() => setShowCreateMarket(false)} disabled={createMarket.isPending}>
                Cancelar
              </AppButton>
              <AppButton
                type="button"
                onClick={marketForm.handleSubmit((values) => createMarket.mutate(values))}
                loading={createMarket.isPending}
                loadingLabel="Cadastrando"
              >
                Cadastrar
              </AppButton>
            </div>
          </div>
        ) : null}
        <MoneyInput label="Valor pago no caixa" error={form.formState.errors.finalPaidAmount?.message} {...form.register("finalPaidAmount")} />
        <AppInput label="Observações" {...form.register("notes")} />
        <div className="rounded-xl bg-white p-3 shadow-soft">
          <p className="text-xs font-semibold text-ink/50">Desconto/diferenca</p>
          <p className={difference >= 0 ? "text-lg font-black text-mint" : "text-lg font-black text-tomato"}>{formatBRL(difference)}</p>
          {difference < 0 ? <p className="mt-1 text-xs text-tomato">Diferenca positiva, talvez algum item nao tenha sido lancado.</p> : null}
        </div>
        <AppButton type="submit" full loading={finish.isPending} loadingLabel="Salvando" disabled={outbox.pendingCount > 0}>
          Salvar compra
        </AppButton>
      </form>
    </ScreenContainer>
  );
}

export function PurchaseHistoryPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["purchases"], queryFn: () => api<Purchase[]>("/purchases") });
  const completed = data
    .filter((purchase) => purchase.status === "completed")
    .filter((purchase) => {
      const term = q.toLowerCase();
      if (!term) return true;
      return purchase.market?.name.toLowerCase().includes(term) || purchase.items.some((item) => item.productName.toLowerCase().includes(term));
    });

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

export function PurchaseDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const purchase = useQuery({ queryKey: ["purchase", id], queryFn: () => api<Purchase>(`/purchases/${id}`), enabled: Boolean(id) });
  const duplicate = useMutation({
    mutationFn: () => api<MarketList>(`/purchases/${id}/duplicate-as-list`, { method: "POST" }),
    onSuccess: (list) => navigate(`/app/lists/${list.id}`),
  });

  if (purchase.isLoading) return <LoadingState />;
  if (!purchase.data) return <ScreenContainer title="Compra"><ErrorState /></ScreenContainer>;

  return (
    <ScreenContainer title={purchase.data.market?.name ?? "Compra"} subtitle={new Date(purchase.data.startedAt).toLocaleDateString("pt-BR")}>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total" value={formatBRL(purchase.data.finalPaidAmount ?? purchase.data.subtotalCalculated)} />
        <SummaryCard label="Desconto" value={formatBRL(purchase.data.discountAmount ?? 0)} tone="tomato" />
      </div>
      <SectionHeader
        title="Itens"
        action={
          <AppButton variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => duplicate.mutate()} loading={duplicate.isPending} loadingLabel="Criando lista">
            Virar lista
          </AppButton>
        }
      />
      <div className="space-y-3">
        {purchase.data.items.map((item) => (
          <PurchaseItemCard key={item.id} item={item} />
        ))}
      </div>
    </ScreenContainer>
  );
}

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

export function ProductPriceDetailPage() {
  const { productId = "" } = useParams();
  const details = useQuery({
    queryKey: ["product-price-details", productId],
    queryFn: () => api<ProductPriceDetailsReport>(`/reports/products/${productId}/price-details`),
    enabled: Boolean(productId),
  });

  return (
    <ScreenContainer title="Preço do produto">
      <SummaryCard label="Melhor mercado" value={details.data?.best ? `${details.data.best.marketName} · ${formatBRL(details.data.best.averagePrice)}` : "-"} />
      <SectionHeader title="Mercados" />
      <div className="space-y-2">
        {details.data?.markets.map((entry) => (
          <PriceCard key={entry.marketName} label={entry.marketName} value={formatBRL(entry.averagePrice)} />
        ))}
      </div>
      <SectionHeader title="Histórico" />
      <pre className="overflow-auto rounded-xl bg-white p-3 text-xs text-ink/60">{JSON.stringify(details.data?.history ?? [], null, 2)}</pre>
    </ScreenContainer>
  );
}

export function MarketsPage() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["markets"], queryFn: () => api<Market[]>("/markets") });

  return (
    <ScreenContainer title="Mercados">
      {isLoading ? <LoadingState /> : null}
      {!isLoading && !data.length ? <EmptyState title="Cadastre seus mercados para comparar preços." /> : null}
      <div className="space-y-3">
        {data.map((market) => (
          <MarketCard key={market.id} market={market} onClick={() => navigate(`/app/markets/${market.id}`)} />
        ))}
      </div>
      <FloatingActionButton label="Mercado" onClick={() => navigate("/app/markets/new")} />
    </ScreenContainer>
  );
}

export function MarketDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const summary = useQuery({ queryKey: ["market-summary", id], queryFn: () => api<{ market: Market; purchaseCount: number; totalSpent: number; averageTicket: number; topProduct: string | null }>(`/markets/${id}/summary`) });
  const remove = useMutation({
    mutationFn: () => api(`/markets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["market-summary", id] });
      queryClient.setQueryData<Market[]>(["markets"], (current) => removeById(current, id));
      navigate("/app/markets");
    },
  });

  if (summary.isLoading) return <LoadingState />;
  if (!summary.data) return <ScreenContainer title="Mercado"><ErrorState /></ScreenContainer>;

  return (
    <ScreenContainer title={summary.data.market.name} subtitle={summary.data.market.city ?? undefined}>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total" value={formatBRL(summary.data.totalSpent)} />
        <SummaryCard label="Compras" value={summary.data.purchaseCount} tone="sky" />
        <SummaryCard label="Ticket" value={formatBRL(summary.data.averageTicket)} tone="leaf" />
        <SummaryCard label="Produto" value={summary.data.topProduct ?? "-"} tone="tomato" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <AppButton full variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/app/markets/${id}/edit`)}>
          Editar
        </AppButton>
        <AppButton full variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
          Excluir
        </AppButton>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir mercado"
        description="O mercado sera removido da sua lista. Compras antigas continuam no historico."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
        confirmLoading={remove.isPending}
      />
    </ScreenContainer>
  );
}

export function CreateEditMarketPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const market = useQuery({ queryKey: ["market", id], queryFn: () => api<Market>(`/markets/${id}`), enabled: isEdit });
  const form = useForm<MarketForm>({ resolver: zodResolver(marketSchema), defaultValues: { name: "", address: "", city: "", notes: "" } });

  useEffect(() => {
    if (market.data) form.reset({ name: market.data.name, address: market.data.address ?? "", city: market.data.city ?? "", notes: market.data.notes ?? "" });
  }, [market.data, form]);

  const save = useMutation({
    mutationFn: (values: MarketForm) => (isEdit ? api<Market>(`/markets/${id}`, { method: "PUT", body: values }) : api<Market>("/markets", { method: "POST", body: values })),
    onSuccess: (saved) => {
      queryClient.setQueryData<Market[]>(["markets"], (current) => upsertById(current, saved));
      queryClient.setQueryData<{ market: Market; purchaseCount: number; totalSpent: number; averageTicket: number; topProduct: string | null }>(["market-summary", saved.id], (current) =>
        current ? { ...current, market: saved } : { market: saved, purchaseCount: 0, totalSpent: 0, averageTicket: 0, topProduct: null },
      );
      navigate(`/app/markets/${saved.id}`);
    },
  });

  return (
    <ScreenContainer title={isEdit ? "Editar mercado" : "Novo mercado"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Endereço" {...form.register("address")} />
        <AppInput label="Cidade" {...form.register("city")} />
        <AppInput label="Observações" {...form.register("notes")} />
        <AppButton full type="submit" loading={save.isPending} loadingLabel="Salvando">
          Salvar
        </AppButton>
      </form>
    </ScreenContainer>
  );
}

export function ProductsPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["products", debouncedQ], queryFn: () => api<Product[]>(`/products?q=${encodeURIComponent(debouncedQ)}`) });

  return (
    <ScreenContainer title="Produtos">
      <SearchBar placeholder="Buscar produto" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="mt-4 space-y-3">
        {isLoading ? <LoadingState /> : null}
        {!isLoading && !data.length ? <EmptyState title="Cadastre produtos para reutilizar no carrinho." /> : null}
        {data.map((product) => (
          <ProductCard key={product.id} product={product} onClick={() => navigate(`/app/products/${product.id}/edit`)} />
        ))}
      </div>
      <FloatingActionButton label="Produto" onClick={() => navigate("/app/products/new")} />
    </ScreenContainer>
  );
}

export function CreateEditProductPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const product = useQuery({ queryKey: ["product", id], queryFn: () => api<Product>(`/products/${id}`), enabled: isEdit });
  const form = useForm<ProductForm>({ resolver: zodResolver(productSchema), defaultValues: { name: "", brand: "", category: "", defaultUnit: "un", barcode: "" } });

  useEffect(() => {
    if (product.data) {
      form.reset({
        name: product.data.name,
        brand: product.data.brand ?? "",
        category: product.data.category ?? "",
        defaultUnit: product.data.defaultUnit,
        barcode: product.data.barcode ?? "",
      });
    }
  }, [product.data, form]);

  const save = useMutation({
    mutationFn: (values: ProductForm) => (isEdit ? api<Product>(`/products/${id}`, { method: "PUT", body: values }) : api<Product>("/products", { method: "POST", body: values })),
    onSuccess: (saved) => {
      queryClient.setQueryData(["product", saved.id], saved);
      queryClient.setQueryData<Product[]>(["products", ""], (current) => upsertById(current, saved));
      navigate("/app/products");
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["product", id] });
      queryClient.setQueryData<Product[]>(["products", ""], (current) => removeById(current, id ?? ""));
      navigate("/app/products");
    },
  });

  return (
    <ScreenContainer title={isEdit ? "Editar produto" : "Novo produto"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Marca" {...form.register("brand")} />
        <AppInput label="Categoria" {...form.register("category")} />
        <UnitSelect label="Unidade padrão" {...form.register("defaultUnit")} />
        <AppInput label="Código de barras" {...form.register("barcode")} />
        <AppButton full type="submit" loading={save.isPending} loadingLabel="Salvando">
          Salvar
        </AppButton>
      </form>
      {isEdit ? (
        <AppButton className="mt-3" full variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
          Excluir produto
        </AppButton>
      ) : null}
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir produto"
        description="O produto sera removido da sua base. Historico de compras permanece preservado."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
        confirmLoading={remove.isPending}
      />
    </ScreenContainer>
  );
}

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

export function BillingPage() {
  const { status, hasNoAds } = useAds();
  const navigate = useNavigate();
  const offer = status?.availableOffers[0];
  const checkout = useMutation({
    mutationFn: () => api<{ checkoutUrl: string; purchaseId: string }>("/billing/remove-ads/checkout", { method: "POST" }),
    onSuccess: (response) => {
      window.location.href = response.checkoutUrl;
    },
  });

  return (
    <ScreenContainer title="Remover anuncios">
      <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-soft">
        <span className="text-sm font-semibold text-ink/65">Status</span>
        <MonetizationBadge hasNoAds={hasNoAds} />
      </div>

      {hasNoAds ? (
        <div className="rounded-xl bg-white p-4 shadow-soft">
          <p className="text-lg font-black text-ink">Sem anuncios ativo</p>
          <p className="mt-2 text-sm text-ink/60">Voce nao vera mais anuncios no Gondly.</p>
          <AppButton className="mt-4" full onClick={() => navigate("/app/home")}>
            Voltar para o app
          </AppButton>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-soft">
            <p className="text-lg font-black text-ink">{offer?.title ?? "Gondly Sem Anuncios"}</p>
            <p className="mt-2 text-sm text-ink/60">Use o Gondly com uma experiencia mais limpa. Pague uma vez e nao veja mais anuncios.</p>
            <p className="mt-4 text-2xl font-black text-mint">{formatBRL(offer?.price ?? 19.9)}</p>
            <p className="mt-2 text-xs text-ink/50">Este pagamento remove apenas os anuncios. Recursos futuros poderao ser vendidos separadamente.</p>
            <AppButton className="mt-4" full onClick={() => checkout.mutate()} loading={checkout.isPending} loadingLabel="Abrindo checkout">
              {`Remover anuncios por ${formatBRL(offer?.price ?? 19.9)}`}
            </AppButton>
          </div>
          <div className="rounded-xl border border-dashed border-line bg-white/70 p-3 text-xs font-semibold text-ink/50">
            O app continua gratuito com anuncios.
          </div>
        </div>
      )}
    </ScreenContainer>
  );
}

export function BillingSuccessPage() {
  return <BillingReturnPage title="Pagamento recebido!" description="Estamos atualizando seu acesso." successLabel="Anuncios removidos com sucesso." />;
}

export function BillingPendingPage() {
  return <BillingReturnPage title="Pagamento pendente." description="Assim que o pagamento for confirmado, os anuncios serao removidos automaticamente." />;
}

export function BillingFailurePage() {
  const navigate = useNavigate();
  return (
    <ScreenContainer title="Pagamento nao concluido">
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <p className="text-sm text-ink/60">Voce pode tentar novamente quando quiser.</p>
        <AppButton className="mt-4" full onClick={() => navigate("/app/billing")}>
          Tentar novamente
        </AppButton>
      </div>
    </ScreenContainer>
  );
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { hasNoAds } = useAds();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <ScreenContainer title="Ajustes">
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <MemberAvatar user={(user as User) ?? { name: "U" }} />
          <div>
            <p className="text-sm font-black text-ink">{user?.name}</p>
            <p className="text-xs text-ink/55">{user?.email}</p>
          </div>
        </div>

        {!hasNoAds ? (
          <AppButton className="mt-4" full variant="secondary" onClick={() => navigate("/app/billing")}>
            Remover anuncios
          </AppButton>
        ) : null}

        <div className="mt-4 grid gap-2">
          <AppButton variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout} loading={loggingOut} loadingLabel="Saindo">
            Sair
          </AppButton>
        </div>
      </div>
    </ScreenContainer>
  );
}

function BillingReturnPage({ title, description, successLabel }: { title: string; description: string; successLabel?: string }) {
  const navigate = useNavigate();
  const { hasNoAds, refreshBillingStatus } = useAds();
  const { refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshBillingStatus();
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <ScreenContainer title={title}>
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <p className="text-sm text-ink/60">{hasNoAds && successLabel ? successLabel : description}</p>
        <div className="mt-4 grid gap-2">
          <AppButton full onClick={refresh} loading={refreshing} loadingLabel="Atualizando">
            Atualizar status
          </AppButton>
          <AppButton full variant="secondary" onClick={() => navigate("/app/home")}>
            Voltar para o app
          </AppButton>
        </div>
      </div>
    </ScreenContainer>
  );
}

function Shortcut({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex h-24 flex-col justify-between rounded-2xl border border-line bg-white p-4 text-ink shadow-sm transition duration-200 hover:border-mint/25 hover:shadow-soft active:scale-[0.99]">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint/10 text-mint">{icon}</span>
      <span className="text-sm font-bold">{label}</span>
    </Link>
  );
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (
            element: HTMLElement | null,
            options: {
              type?: "standard" | "icon";
              theme?: string;
              size?: string;
              shape?: string;
              text?: string;
              logo_alignment?: string;
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}
