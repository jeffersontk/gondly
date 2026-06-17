import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  PackagePlus,
  Plus,
  Search,
  ShoppingBasket,
  Store,
  Users,
  X,
} from "lucide-react";
import type { Unit } from "@gondly/types";
import { api } from "../lib/api";
import type { Market, MarketList, MarketListItem, Product, PurchaseItem, User } from "../types";

function cls(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const controlClass =
  "h-12 w-full rounded-[8px] border border-ink/10 bg-white px-3 text-base text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15";

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

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: ReactNode;
  full?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

export function AppButton({ variant = "primary", icon, full, loading, loadingLabel, disabled, className, children, ...props }: AppButtonProps) {
  const variants = {
    primary: "bg-mint text-white shadow-soft hover:bg-mint/90",
    secondary: "bg-white text-ink border border-ink/10 hover:border-mint/40",
    ghost: "bg-transparent text-ink hover:bg-ink/5",
    danger: "bg-tomato text-white hover:bg-tomato/90",
  };

  return (
    <button
      className={cls(
        "inline-flex h-12 items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
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
      {label ? <span className="mb-1 block text-sm font-semibold text-ink/80">{label}</span> : null}
      <input ref={ref} className={cls(controlClass, error && "border-tomato focus:border-tomato focus:ring-tomato/15", className)} {...props} />
      {error ? <span className="mt-1 block text-xs font-medium text-tomato">{error}</span> : null}
      {hint && !error ? <span className="mt-1 block text-xs text-ink/50">{hint}</span> : null}
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
      {label ? <span className="mb-1 block text-sm font-semibold text-ink/80">{label}</span> : null}
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
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink/40" />
      <input className={cls(controlClass, "pl-10")} type="search" {...props} />
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
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-[8px] border border-ink/10 bg-white shadow-soft">
          {data.map((product) => (
            <button
              key={product.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-3 text-left text-sm hover:bg-mint/10"
              onClick={() => {
                onSelect(product);
                onChange(product.name);
                setOpen(false);
              }}
            >
              <span>
                <span className="block font-semibold text-ink">{product.name}</span>
                <span className="block text-xs text-ink/55">{[product.brand, product.category].filter(Boolean).join(" · ")}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink/40" />
            </button>
          ))}
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
      <span className="mb-1 block text-sm font-semibold text-ink/80">{label}</span>
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
            {market.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-[8px] border border-dashed border-ink/15 bg-white/70 p-5 text-center">
      <PackagePlus className="mb-3 h-9 w-9 text-mint" />
      <p className="text-sm font-semibold text-ink/70">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-ink/60">
      <Loader2 className="h-5 w-5 animate-spin text-mint" />
      {label}
    </div>
  );
}

export function ErrorState({ message = "Nao foi possivel carregar os dados." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-tomato/20 bg-tomato/10 p-3 text-sm font-semibold text-tomato">
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4">
      <div className="w-full max-w-sm rounded-[8px] bg-white p-4 shadow-soft">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-ink/65">{description}</p>
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
};

export function ScreenContainer({ title, subtitle, children, showBack, backTo }: ScreenContainerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldShowBack = backTo !== false && (showBack ?? shouldShowScreenBack(location.pathname));

  function handleBack() {
    const historyState = window.history.state as { idx?: number } | null;
    if (typeof historyState?.idx === "number" && historyState.idx > 0) {
      navigate(-1);
      return;
    }

    navigate(typeof backTo === "string" ? backTo : getScreenBackFallback(location.pathname), { replace: true });
  }

  return (
    <main className="safe-bottom mx-auto min-h-screen w-full max-w-xl px-4 pt-5">
      {title ? (
        <header className="mb-4 flex items-start gap-3">
          {shouldShowBack ? (
            <button
              type="button"
              onClick={handleBack}
              className="grid h-10 w-10 flex-none place-items-center rounded-[8px] bg-white text-ink shadow-soft transition hover:bg-ink/5"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-black tracking-normal text-ink">{title}</h1>
            {subtitle ? <p className="mt-1 break-words text-sm text-ink/60">{subtitle}</p> : null}
          </div>
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
    <div className="mb-3 mt-5 flex items-center justify-between gap-3">
      <h2 className="text-base font-black text-ink">{title}</h2>
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
    <div className="rounded-[8px] bg-white p-4 shadow-soft">
      <div className={cls("mb-3 grid h-9 w-9 place-items-center rounded-[8px]", tones[tone])}>
        <CircleDollarSign className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase text-ink/45">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value}</p>
    </div>
  );
}

export function PriceCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-ink/10 bg-white p-3">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 text-lg font-black text-ink">{value}</p>
    </div>
  );
}

export function PurchaseItemCard({ item, action }: { item: PurchaseItem; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] bg-white p-3 shadow-soft">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-ink">{item.productName}</p>
        <p className="text-xs text-ink/55">
          {item.quantity} {unitLabels[item.unit]} · {formatBRL(item.pricePaid)}
        </p>
      </div>
      {action}
    </div>
  );
}

export function MarketListCard({ list, onClick, loading, disabled }: { list: MarketList; onClick?: () => void; loading?: boolean; disabled?: boolean }) {
  const completed = list.items.filter((item) => item.checked || item.status === "purchased" || item.status === "skipped").length;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className="w-full rounded-[8px] bg-white p-4 text-left shadow-soft transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-ink">{list.name}</p>
          <p className="mt-1 text-xs text-ink/55">
            {completed}/{list.items.length} itens · {list.status === "archived" ? "Arquivada" : "Ativa"}
          </p>
        </div>
        {loading ? <Loader2 className="h-5 w-5 flex-none animate-spin text-mint" /> : <ChevronRight className="h-5 w-5 flex-none text-ink/35" />}
      </div>
    </button>
  );
}

export function ProductCard({ product, onClick }: { product: Product; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-[8px] bg-white p-4 text-left shadow-soft">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-ink">{product.name}</p>
        <p className="text-xs text-ink/55">{[product.brand, product.category, unitLabels[product.defaultUnit]].filter(Boolean).join(" · ")}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-ink/35" />
    </button>
  );
}

export function MarketCard({ market, onClick }: { market: Market; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[8px] bg-white p-4 text-left shadow-soft">
      <div className="grid h-10 w-10 flex-none place-items-center rounded-[8px] bg-sky/12 text-sky">
        <Store className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-ink">{market.name}</p>
        <p className="truncate text-xs text-ink/55">{[market.address, market.city].filter(Boolean).join(" · ") || "Sem endereco"}</p>
      </div>
    </button>
  );
}

export function FloatingActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-[92px] right-4 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-tomato px-5 text-sm font-black text-white shadow-soft"
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
    <div className="flex items-center gap-2 rounded-[8px] bg-white px-3 py-2 shadow-soft">
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
      <div className="w-full max-w-sm rounded-[8px] bg-white p-5 shadow-soft">
        <button type="button" onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-[8px] bg-ink/5">
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
    <div className="rounded-[8px] border border-dashed border-ink/15 bg-white/70 p-3 text-center text-xs font-semibold text-ink/45">
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

  return <div className={cls("rounded-[8px] px-3 py-2 text-sm font-semibold shadow-soft", tones[tone])}>{message}</div>;
}

const listItemStatusLabels = {
  pending: "Pendente",
  assigned: "Pegando",
  in_cart: "No carrinho",
  purchased: "Comprado",
  skipped: "Tenho em casa",
} satisfies Record<MarketListItem["status"], string>;

function listItemMarkerClass(item: MarketListItem) {
  if (item.checked || item.status === "purchased") return "border-mint bg-mint text-white";
  if (item.status === "skipped") return "border-leaf bg-leaf text-white";
  if (item.status === "assigned" || item.status === "in_cart") return "border-sky bg-sky text-white";
  return "border-ink/15 bg-white text-transparent";
}

export function ListItemRow({ item, onToggle, loading }: { item: MarketListItem; onToggle?: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      aria-busy={loading || undefined}
      className="flex w-full items-center gap-3 rounded-[8px] bg-white p-3 text-left shadow-soft transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div
        className={cls(
          "grid h-8 w-8 flex-none place-items-center rounded-[8px] border",
          listItemMarkerClass(item),
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-ink">{item.productName}</p>
        <p className="text-xs text-ink/55">
          {item.expectedQuantity ?? 1} {unitLabels[item.unit]} · {listItemStatusLabels[item.status]}
        </p>
      </div>
    </button>
  );
}

export function StartPurchasePanel({ onStart, loading }: { onStart: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={loading}
      aria-busy={loading || undefined}
      className="flex w-full items-center gap-3 rounded-[8px] bg-ink p-4 text-left text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-60"
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
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
