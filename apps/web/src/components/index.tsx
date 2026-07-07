import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, forwardRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Baby,
  Beef,
  Check,
  ChevronRight,
  CircleDollarSign,
  Cookie,
  CupSoda,
  Croissant,
  type LucideIcon,
  Loader2,
  Milk,
  PackagePlus,
  PawPrint,
  Plus,
  Search,
  ShoppingBasket,
  Snowflake,
  SprayCan,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { Unit } from "@gondly/types";
import { calculateNormalizedPrice, formatBRL as formatSharedBRL, formatPricePerUnitLabel, roundMoney } from "@gondly/utils";
import { api } from "../lib/api";
import type { Brand, Market, MarketList, MarketListItem, Product, PurchaseItem, User } from "../types";

function cls(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const controlClass =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink shadow-sm outline-none transition duration-200 placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint/10 disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted";

export const unitLabels: Record<Unit, string> = {
  un: "Un",
  kg: "Kg",
  g: "g",
  l: "L",
  ml: "ml",
  pacote: "Pacote",
  caixa: "Caixa",
  outro: "Outro",
};

const packageUnitLabels: Record<Unit, string> = {
  un: "un",
  kg: "kg",
  g: "g",
  l: "L",
  ml: "ml",
  pacote: "pacote",
  caixa: "caixa",
  outro: "un",
};

export function formatPackageSize(packageSize?: number | null, packageUnit?: Unit | null) {
  const numericSize = Number(packageSize ?? 0);
  if (!Number.isFinite(numericSize) || numericSize <= 0 || !packageUnit) return "";

  const sizeLabel = Number.isInteger(numericSize)
    ? String(numericSize)
    : numericSize.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return `${sizeLabel}${packageUnitLabels[packageUnit]}`;
}

function productBrandName(product: Product) {
  return product.brandRef?.name ?? product.brand ?? "";
}

function itemBrandName(item: Pick<MarketListItem | PurchaseItem, "brand" | "brandNameSnapshot">) {
  return item.brandNameSnapshot ?? item.brand ?? "";
}

function productIdentityLine(product: Product) {
  return [productBrandName(product), formatPackageSize(product.packageSize, product.packageUnit)].filter(Boolean).join(" · ");
}

function itemIdentityLine(item: Pick<MarketListItem | PurchaseItem, "brand" | "brandNameSnapshot" | "packageSize" | "packageUnit">) {
  return [itemBrandName(item), formatPackageSize(item.packageSize, item.packageUnit)].filter(Boolean).join(" · ");
}

type CategoryVisual = { icon: LucideIcon; label: string; badgeClass: string; iconClass: string };

const categoryVisuals: Array<{ match: RegExp; visual: CategoryVisual }> = [
  { match: /latic|frio|leite|queijo|iogurte/, visual: { icon: Milk, label: "Laticínios", badgeClass: "bg-sky-50 text-sky-700", iconClass: "bg-sky-100 text-sky-600" } },
  { match: /bebida|refrigerante|suco|cerveja|agua|café|cafe/, visual: { icon: CupSoda, label: "Bebidas", badgeClass: "bg-rose-50 text-rose-700", iconClass: "bg-rose-100 text-rose-600" } },
  { match: /higien|limpeza|perfum/, visual: { icon: SprayCan, label: "Higiene", badgeClass: "bg-cyan-50 text-cyan-700", iconClass: "bg-cyan-100 text-cyan-600" } },
  { match: /prote|carne|acougue|frango|peixe/, visual: { icon: Beef, label: "Proteínas", badgeClass: "bg-orange-50 text-orange-700", iconClass: "bg-orange-100 text-orange-600" } },
  { match: /doce|sobremesa|chocolate|bala/, visual: { icon: Cookie, label: "Doces", badgeClass: "bg-amber-50 text-amber-700", iconClass: "bg-amber-100 text-amber-600" } },
  { match: /padaria|pao|paes/, visual: { icon: Croissant, label: "Padaria", badgeClass: "bg-yellow-50 text-yellow-700", iconClass: "bg-yellow-100 text-yellow-600" } },
  { match: /congelad/, visual: { icon: Snowflake, label: "Congelados", badgeClass: "bg-blue-50 text-blue-700", iconClass: "bg-blue-100 text-blue-600" } },
  { match: /hortifruti|sacolao|fruta|legume|verdura/, visual: { icon: Sparkles, label: "Hortifruti", badgeClass: "bg-emerald-50 text-emerald-700", iconClass: "bg-emerald-100 text-emerald-600" } },
  { match: /bebe|infantil/, visual: { icon: Baby, label: "Bebês", badgeClass: "bg-pink-50 text-pink-700", iconClass: "bg-pink-100 text-pink-600" } },
  { match: /pet|animal/, visual: { icon: PawPrint, label: "Pet", badgeClass: "bg-violet-50 text-violet-700", iconClass: "bg-violet-100 text-violet-600" } },
  { match: /descart/, visual: { icon: Trash2, label: "Descartáveis", badgeClass: "bg-slate-100 text-slate-700", iconClass: "bg-slate-200 text-slate-600" } },
  { match: /mercearia|condiment|grao|arroz|feijao/, visual: { icon: ShoppingBasket, label: "Mercearia", badgeClass: "bg-mint/10 text-mint", iconClass: "bg-mint/10 text-mint" } },
];

const fallbackCategoryVisual: CategoryVisual = { icon: Tag, label: "Outros", badgeClass: "bg-paper text-ink/60", iconClass: "bg-paper text-ink/50" };

export function categoryVisual(category?: string | null): CategoryVisual {
  const normalized = (category ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (!normalized) return fallbackCategoryVisual;

  const found = categoryVisuals.find((entry) => entry.match.test(normalized));
  return found ? { ...found.visual, label: category!.trim() || found.visual.label } : { ...fallbackCategoryVisual, label: category!.trim() };
}

export function CategoryIcon({ category, className }: { category?: string | null; className?: string }) {
  const visual = categoryVisual(category);
  const Icon = visual.icon;
  return (
    <div className={cls("grid h-12 w-12 flex-none place-items-center rounded-2xl", visual.iconClass, className)}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

export function CategoryBadge({ category }: { category?: string | null }) {
  const visual = categoryVisual(category);
  return <span className={cls("inline-block rounded-full px-2.5 py-1 text-[11px] font-black", visual.badgeClass)}>{visual.label}</span>;
}

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: ReactNode;
  full?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

export function AppButton({ variant = "primary", icon, full, loading, loadingLabel, disabled, className, children, ...props }: AppButtonProps) {
  const variants = {
    primary: "bg-mint text-white shadow-soft hover:bg-mint/90 active:bg-mint",
    secondary: "border border-line bg-white text-ink shadow-sm hover:border-mint/30 hover:bg-paper",
    ghost: "bg-transparent text-ink hover:bg-white",
    danger: "bg-ink text-white shadow-soft hover:bg-ink/90",
  };

  return (
    <button
      className={cls(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold tracking-[-0.01em] transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variants[variant],
        full && "w-full",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {loading ? loadingLabel ?? children : children}
    </button>
  );
}

type AppInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
  { label, error, hint, className, ...props },
  ref,
) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span> : null}
      <input ref={ref} className={cls(controlClass, error && "border-tomato focus:border-tomato focus:ring-tomato/15", className)} {...props} />
      {error ? <span className="mt-1 block text-xs font-medium text-tomato">{error}</span> : null}
      {hint && !error ? <span className="mt-1.5 block text-xs text-ink/60">{hint}</span> : null}
    </label>
  );
});

export const MoneyInput = forwardRef<HTMLInputElement, AppInputProps>(function MoneyInput(props, ref) {
  return <AppInput ref={ref} inputMode="decimal" min="0" step="0.01" placeholder="0,00" {...props} />;
});

export const QuantityInput = forwardRef<HTMLInputElement, AppInputProps>(function QuantityInput(props, ref) {
  return <AppInput ref={ref} inputMode="decimal" min="0.0001" step="0.001" placeholder="1" {...props} />;
});

type UnitSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label?: string;
  error?: string;
};

export const UnitSelect = forwardRef<HTMLSelectElement, UnitSelectProps>(function UnitSelect({ label, error, className, ...props }, ref) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span> : null}
      <select ref={ref} className={cls(controlClass, className)} {...props}>
        {Object.entries(unitLabels).map(([value, labelText]) => (
          <option key={value} value={value}>
            {labelText}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs font-medium text-tomato">{error}</span> : null}
    </label>
  );
});

export function SearchBar({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cls("relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
      <input className={cls(controlClass, "pl-11")} type="search" {...props} />
    </div>
  );
}

export function ProductSearchInput({
  value,
  onChange,
  onSelect,
  label = "Produto",
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: Product) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), 350);
    return () => window.clearTimeout(timeout);
  }, [value]);

  const { data = [] } = useQuery({
    queryKey: ["products-search", debouncedValue],
    queryFn: () => api<Product[]>(`/products/search?q=${encodeURIComponent(debouncedValue)}`),
    enabled: debouncedValue.trim().length >= 2,
  });

  return (
    <div className="relative">
      <AppInput
        label={label}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Digite o produto"
      />
      {open && data.length ? (
        <div className="absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-line bg-white p-1 shadow-lift">
          {data.map((product) => (
            <button
              key={product.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition hover:bg-paper"
              onClick={() => {
                onSelect(product);
                onChange(product.name);
                setOpen(false);
              }}
            >
              <span>
                <span className="block font-semibold text-ink">{product.name}</span>
                <span className="block text-xs text-ink/55">
                  {[productIdentityLine(product), product.category].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink/40" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BrandSelect({
  brandId,
  brandName,
  disabled,
  onChange,
  label = "Marca",
}: {
  brandId?: string;
  brandName?: string;
  disabled?: boolean;
  onChange: (brand: { id?: string; name: string }) => void;
  label?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const search = brandName ?? "";
  const trimmedSearch = search.trim();
  const { data = [] } = useQuery({
    queryKey: ["brands", trimmedSearch],
    queryFn: () => api<Brand[]>(`/brands?q=${encodeURIComponent(trimmedSearch)}`),
    enabled: open && trimmedSearch.length >= 2,
  });
  const exactMatch = data.some((brand) => brand.name.localeCompare(trimmedSearch, "pt-BR", { sensitivity: "base" }) === 0);
  const create = useMutation({
    mutationFn: (name: string) => api<Brand>("/brands", { method: "POST", body: { name } }),
    onSuccess: (brand) => {
      queryClient.setQueryData<Brand[]>(["brands", trimmedSearch], (current) =>
        current ? [brand, ...current.filter((entry) => entry.id !== brand.id)] : [brand],
      );
      onChange({ id: brand.id, name: brand.name });
      setOpen(false);
    },
  });

  return (
    <div className="relative">
      <AppInput
        label={label}
        value={search}
        disabled={disabled || create.isPending}
        placeholder="Ex.: Tio Joao"
        onChange={(event) => {
          onChange({ id: undefined, name: event.target.value });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <input type="hidden" value={brandId ?? ""} readOnly />
      {open && trimmedSearch.length >= 2 ? (
        <div className="absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-line bg-white p-1 shadow-lift">
          {data.map((brand) => (
            <button
              key={brand.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition hover:bg-paper"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange({ id: brand.id, name: brand.name });
                setOpen(false);
              }}
            >
              <span className="font-semibold text-ink">{brand.name}</span>
              <ChevronRight className="h-4 w-4 text-ink/40" />
            </button>
          ))}
          {!exactMatch ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-bold text-mint transition hover:bg-mint/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={create.isPending}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => create.mutate(trimmedSearch)}
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar "{trimmedSearch}"
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MarketSelect({
  value,
  onChange,
  onCreate,
  label = "Mercado",
}: {
  value: string;
  onChange: (value: string) => void;
  onCreate?: () => void;
  label?: string;
}) {
  const { data = [] } = useQuery({ queryKey: ["markets"], queryFn: () => api<Market[]>("/markets") });

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      <select
        className={controlClass}
        value={value}
        onChange={(event) => {
          if (event.target.value === "__create_market__") {
            onCreate?.();
            return;
          }
          onChange(event.target.value);
        }}
      >
        <option value="">Selecione</option>
        {onCreate ? <option value="__create_market__">+ Cadastrar mercado</option> : null}
        {data.map((market) => (
          <option key={market.id} value={market.id}>
            {[market.name, market.neighborhood, market.city].filter(Boolean).join(" - ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white p-6 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-mint">
        <PackagePlus className="h-6 w-6" />
      </div>
      <p className="max-w-xs text-sm font-semibold leading-6 text-ink/70">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-ink/60">
      <Loader2 className="h-5 w-5 animate-spin text-mint" />
      {label}
    </div>
  );
}

export function ErrorState({ message = "Nao foi possivel carregar os dados." }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 text-sm font-semibold text-ink shadow-soft">
      <AlertTriangle className="h-5 w-5" />
      {message}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLoading,
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLoading?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lift">
        <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">{description}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <AppButton variant="secondary" onClick={onCancel} disabled={confirmLoading}>
            Cancelar
          </AppButton>
          <AppButton variant="danger" onClick={onConfirm} loading={confirmLoading} loadingLabel="Confirmando">
            Confirmar
          </AppButton>
        </div>
      </div>
    </div>
  );
}

type ScreenContainerProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  showBack?: boolean;
  backTo?: string | false;
  headerAction?: ReactNode;
};

export function ScreenContainer({ title, subtitle, children, showBack, backTo, headerAction }: ScreenContainerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldShowBack = backTo !== false && (showBack ?? shouldShowScreenBack(location.pathname));

  function handleBack() {
    if (typeof backTo === "string") {
      navigate(backTo, { replace: true });
      return;
    }

    const historyState = window.history.state as { idx?: number } | null;
    if (typeof historyState?.idx === "number" && historyState.idx > 0) {
      navigate(-1);
      return;
    }

    navigate(getScreenBackFallback(location.pathname), { replace: true });
  }

  return (
    <main className="safe-bottom mx-auto min-h-screen w-full max-w-xl px-4 pb-6 pt-6 sm:px-6">
      {title ? (
        <header className="mb-5 flex items-start gap-3">
          {shouldShowBack ? (
            <button
              type="button"
              onClick={handleBack}
              className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-line/80 bg-white/90 text-ink/75 shadow-sm transition hover:border-mint/30 hover:text-mint"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-extrabold tracking-[-0.035em] text-ink">{title}</h1>
            {subtitle ? <p className="mt-1 break-words text-sm leading-5 text-ink/60">{subtitle}</p> : null}
          </div>
          {headerAction ? <div className="flex-none">{headerAction}</div> : null}
        </header>
      ) : null}
      {children}
    </main>
  );
}

function shouldShowScreenBack(pathname: string) {
  return !new Set(["/", "/app/home", "/app/lists", "/app/purchase/start", "/app/history", "/app/compare", "/lists", "/purchase/start", "/history", "/prices"]).has(pathname);
}

function getScreenBackFallback(pathname: string) {
  if (pathname === "/app/settings" || pathname === "/settings") return "/app/home";
  if (pathname === "/app/billing" || pathname === "/billing") return "/app/settings";
  if (pathname.startsWith("/app/billing/") || pathname.startsWith("/billing/")) return "/app/billing";
  if (pathname === "/app/lists/new" || pathname === "/lists/new") return "/app/lists";
  if (/^\/app\/lists\/[^/]+\/edit$/.test(pathname)) return pathname.replace(/\/edit$/, "");
  if (/^\/lists\/[^/]+\/edit$/.test(pathname)) return `/app${pathname.replace(/\/edit$/, "")}`;
  if (/^\/app\/lists\/[^/]+$/.test(pathname) || /^\/lists\/[^/]+$/.test(pathname)) return "/app/lists";
  if (pathname === "/app/purchase" || pathname === "/purchase/active") return "/app/purchase/start";
  if (/^\/app\/purchase\/[^/]+\/item$/.test(pathname)) return pathname.replace(/\/item$/, "");
  if (/^\/app\/purchase\/[^/]+\/finish$/.test(pathname)) return pathname.replace(/\/finish$/, "");
  if (/^\/app\/purchase\/[^/]+$/.test(pathname) || pathname === "/purchase/item" || pathname === "/purchase/finish") return "/app/purchase/start";
  if (/^\/app\/history\/[^/]+$/.test(pathname) || /^\/history\/[^/]+$/.test(pathname)) return "/app/history";
  if (pathname === "/app/compare/region" || pathname === "/prices/region") return "/app/compare";
  if (/^\/app\/compare\/products\/[^/]+$/.test(pathname) || /^\/prices\/products\/[^/]+$/.test(pathname)) return "/app/compare";
  if (pathname === "/app/markets/new" || pathname === "/markets/new") return "/app/markets";
  if (/^\/app\/markets\/[^/]+\/edit$/.test(pathname)) return pathname.replace(/\/edit$/, "");
  if (/^\/markets\/[^/]+\/edit$/.test(pathname)) return `/app${pathname.replace(/\/edit$/, "")}`;
  if (/^\/app\/markets\/[^/]+$/.test(pathname) || /^\/markets\/[^/]+$/.test(pathname)) return "/app/markets";
  if (pathname === "/app/markets" || pathname === "/markets") return "/app/home";
  if (pathname === "/app/products/new" || pathname === "/products/new") return "/app/products";
  if (/^\/app\/products\/[^/]+(?:\/edit)?$/.test(pathname) || /^\/products\/[^/]+\/edit$/.test(pathname)) return "/app/products";
  if (pathname === "/app/products" || pathname === "/products" || pathname === "/app/insights" || pathname === "/insights") return "/app/home";
  return "/app/home";
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold tracking-[-0.02em] text-ink">{title}</h2>
      {action}
    </div>
  );
}

export function SummaryCard({ label, value, tone = "mint" }: { label: string; value: ReactNode; tone?: "mint" | "sky" | "tomato" | "leaf" }) {
  const tones = {
    mint: "bg-mint/12 text-mint",
    sky: "bg-sky/12 text-sky",
    tomato: "bg-tomato/12 text-tomato",
    leaf: "bg-leaf/12 text-leaf",
  };
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className={cls("mb-4 grid h-10 w-10 place-items-center rounded-xl", tones[tone])}>
        <CircleDollarSign className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">{label}</p>
      <p className="mt-1 text-xl font-extrabold tracking-tight text-ink">{value}</p>
    </div>
  );
}

export function PriceCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3.5 shadow-sm">
      <p className="text-xs font-medium text-ink/60">{label}</p>
      <p className="mt-1 text-lg font-extrabold tracking-tight text-ink">{value}</p>
    </div>
  );
}

export function PurchaseItemCard({ item, action }: { item: PurchaseItem; action?: ReactNode }) {
  const isPending = item.id.startsWith("local-");
  const pricePaid = Number(item.pricePaid ?? 0);
  const hasPrice = pricePaid > 0;
  const identity = itemIdentityLine(item);
  const normalizedPrice = item.unitPriceNormalized != null ? Number(item.unitPriceNormalized) : null;
  const calculatedNormalized = hasPrice ? calculateNormalizedPrice(item.quantity, item.unit, pricePaid) : null;
  const priceDescription =
    hasPrice && normalizedPrice != null && Number.isFinite(normalizedPrice) && item.normalizedUnitLabel
      ? `${formatPricePerUnitLabel(normalizedPrice, item.normalizedUnitLabel)} · Total ${formatBRL(pricePaid)}`
      : hasPrice && calculatedNormalized?.unitPriceNormalized != null && calculatedNormalized.normalizedUnitLabel
        ? `${formatPricePerUnitLabel(calculatedNormalized.unitPriceNormalized, calculatedNormalized.normalizedUnitLabel)} · Total ${formatBRL(pricePaid)}`
      : hasPrice
        ? `${formatBRL(item.quantity > 0 ? roundMoney(pricePaid / item.quantity) : pricePaid)} / ${unitLabels[item.unit]} · Total ${formatBRL(pricePaid)}`
        : "Último preço: --";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-sm transition hover:border-mint/25 hover:shadow-soft">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-black text-ink">{item.productName}</p>
          {isPending ? <span className="rounded-full bg-mint/10 px-2 py-0.5 text-[11px] font-bold text-mint">Pendente</span> : null}
        </div>
        {identity ? <p className="mt-0.5 truncate text-xs font-semibold text-ink/55">{identity}</p> : null}
        <p className="mt-0.5 text-xs text-ink/60">
          {item.quantity} {unitLabels[item.unit]} · {priceDescription}
        </p>
      </div>
      {action}
    </div>
  );
}

export function MarketListCard({ list, onClick, loading, disabled }: { list: MarketList; onClick?: () => void; loading?: boolean; disabled?: boolean }) {
  const needed = list.items.filter((item) => item.status === "pending").length;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className="w-full rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition duration-200 hover:border-mint/25 hover:shadow-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-ink">{list.name}</p>
          <p className="mt-1 text-xs text-ink/60">
            {needed} para comprar · {list.status === "archived" ? "Arquivada" : "Ativa"}
          </p>
        </div>
        {loading ? <Loader2 className="h-5 w-5 flex-none animate-spin text-mint" /> : <ChevronRight className="h-5 w-5 flex-none text-ink/35" />}
      </div>
    </button>
  );
}

export function ProductCard({ product, onClick }: { product: Product; onClick?: () => void }) {
  const identity = productIdentityLine(product);
  const fallback = [product.category, unitLabels[product.defaultUnit]].filter(Boolean).join(" · ");

  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-mint/25 hover:shadow-soft">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-ink">{product.name}</p>
        <p className="text-xs text-ink/55">{identity || fallback}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-ink/35" />
    </button>
  );
}

export function MarketCard({ market, onClick }: { market: Market; onClick?: () => void }) {
  const location = [market.neighborhood, market.city, market.state].filter(Boolean).join(" · ");

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-mint/25 hover:shadow-soft">
      <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-mint/10 text-mint">
        <Store className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{market.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink/60">{location || market.address || "Sem localização"}</p>
      </div>
    </button>
  );
}

export function FloatingActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-[calc(112px+env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-14 items-center gap-2 rounded-2xl bg-mint px-5 text-sm font-bold text-white shadow-[0_18px_42px_rgba(79,70,229,0.34)] transition hover:bg-mint/90 active:scale-[0.98]"
    >
      <Plus className="h-5 w-5" />
      {label}
    </button>
  );
}

export function DateRangeFilter() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <AppInput type="date" label="Inicio" />
      <AppInput type="date" label="Fim" />
    </div>
  );
}

export function MemberAvatar({ user }: { user: Pick<User, "name" | "photoUrl"> }) {
  if (user.photoUrl) {
    return <img className="h-8 w-8 rounded-full object-cover" src={user.photoUrl} alt={user.name} />;
  }
  return <div className="grid h-8 w-8 place-items-center rounded-full bg-mint text-xs font-black text-white">{user.name.slice(0, 1)}</div>;
}

export function OnlineParticipantsBar({ participants = [] }: { participants?: Array<{ user?: User; userId?: string; name?: string }> }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-soft">
      <Users className="h-4 w-4 text-mint" />
      <p className="text-xs font-semibold text-ink/60">{participants.length || 1} participante(s) online</p>
    </div>
  );
}

export function MonetizationBadge({ hasNoAds }: { hasNoAds?: boolean }) {
  return (
    <span className="rounded-full bg-mint/12 px-2 py-1 text-xs font-black uppercase text-mint">
      {hasNoAds ? "Sem anuncios" : "Com anuncios"}
    </span>
  );
}

export function PaywallModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-soft">
        <button type="button" onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl bg-ink/5">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function AdPlaceholder({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <div className="rounded-xl border border-dashed border-line bg-white/70 p-3 text-center text-xs font-semibold text-ink/45">
      Espaco para anuncio
    </div>
  );
}

export function FeatureGate({
  children,
  fallback = null,
}: {
  feature: string;
  plan?: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <>{children ?? fallback}</>;
}

export function Toast({ message, tone = "info" }: { message: string; tone?: "info" | "success" | "error" }) {
  const tones = {
    info: "bg-ink text-white",
    success: "bg-mint text-white",
    error: "bg-tomato text-white",
  };

  return <div className={cls("rounded-xl px-3 py-2 text-sm font-semibold shadow-soft", tones[tone])}>{message}</div>;
}

const listItemStatusLabels = {
  pending: "Não tenho em casa",
  at_home: "Tenho em casa",
  not_needed: "Não precisa esse mês",
} satisfies Record<MarketListItem["status"], string>;

function listItemMarkerClass(item: MarketListItem) {
  if (item.status === "at_home") return "border-muted bg-muted text-white";
  if (item.status === "not_needed") return "border-muted bg-paper text-muted";
  return "border-line bg-white text-transparent";
}

export function ListItemRow({ item }: { item: MarketListItem }) {
  const isReduced = item.status !== "pending";
  const identity = itemIdentityLine(item);

  return (
    <div
      className="flex w-full items-center gap-3 rounded-xl bg-white p-2 text-left transition"
    >
      <div
        className={cls(
          "grid h-8 w-8 flex-none place-items-center rounded-xl border",
          listItemMarkerClass(item),
        )}
      >
        {item.status === "not_needed" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {item.important ? <Star className="h-3.5 w-3.5 flex-none fill-amber-400 text-amber-400" /> : null}
          <p className={cls("truncate text-sm font-bold", isReduced ? "text-muted" : "text-ink", item.status === "not_needed" && "line-through")}>
            {item.productName}
          </p>
        </div>
        {identity ? <p className={cls("mt-0.5 truncate text-xs font-semibold", isReduced ? "text-muted" : "text-ink/55")}>{identity}</p> : null}
        <p className={cls("mt-0.5 text-xs", isReduced ? "text-muted" : "text-ink/60")}>
          {item.expectedQuantity ?? 1} {unitLabels[item.unit]} · {listItemStatusLabels[item.status]}
        </p>
      </div>
    </div>
  );
}

export function StartPurchasePanel({ onStart, loading }: { onStart: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={loading}
      aria-busy={loading || undefined}
      className="flex w-full items-center gap-3 rounded-2xl bg-mint p-4 text-left text-white shadow-soft transition duration-200 hover:bg-mint/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-leaf" /> : <ShoppingBasket className="h-6 w-6 text-leaf" />}
      <span className="min-w-0">
        <span className="block text-sm font-black">{loading ? "Iniciando compra" : "Iniciar compra"}</span>
        <span className="block text-xs text-white/65">Carrinho rapido com total em tempo real</span>
      </span>
    </button>
  );
}

function formatBRL(value: number) {
  return formatSharedBRL(value);
}
