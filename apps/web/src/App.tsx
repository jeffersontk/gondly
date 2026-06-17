import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { BarChart3, Download, History, Home, ListChecks, Settings, ShoppingCart, WifiOff } from "lucide-react";
import { AppButton, LoadingState } from "./components";
import { useAuth } from "./lib/auth";
import {
  ActivePurchasePage,
  AddEditCartItemPage,
  BillingPage,
  BillingFailurePage,
  BillingPendingPage,
  BillingSuccessPage,
  CreateEditListPage,
  CreateEditMarketPage,
  CreateEditProductPage,
  FinishPurchasePage,
  HomePage,
  InsightsPage,
  ListDetailPage,
  ListsPage,
  LoginPage,
  MarketDetailPage,
  MarketsPage,
  PriceComparisonPage,
  ProductPriceDetailPage,
  ProductsPage,
  PurchaseDetailPage,
  PurchaseHistoryPage,
  SettingsPage,
  SharedListPage,
  StartPurchasePage,
} from "./pages";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<ProtectedLayout><SharedListPage /></ProtectedLayout>} />
      <Route path="/shared/:token" element={<ProtectedLayout><SharedListPage /></ProtectedLayout>} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/app/home" element={<HomePage />} />
        <Route path="/app/lists" element={<ListsPage />} />
        <Route path="/app/lists/new" element={<CreateEditListPage />} />
        <Route path="/app/lists/:id" element={<ListDetailPage />} />
        <Route path="/app/lists/:id/edit" element={<CreateEditListPage />} />
        <Route path="/app/purchase" element={<ActivePurchasePage />} />
        <Route path="/app/purchase/start" element={<StartPurchasePage />} />
        <Route path="/app/purchase/:purchaseId" element={<ActivePurchasePage />} />
        <Route path="/app/purchase/:purchaseId/item" element={<AddEditCartItemPage />} />
        <Route path="/app/purchase/:purchaseId/finish" element={<FinishPurchasePage />} />
        <Route path="/app/history" element={<PurchaseHistoryPage />} />
        <Route path="/app/history/:id" element={<PurchaseDetailPage />} />
        <Route path="/app/compare" element={<PriceComparisonPage />} />
        <Route path="/app/compare/products/:productId" element={<ProductPriceDetailPage />} />
        <Route path="/app/markets" element={<MarketsPage />} />
        <Route path="/app/markets/new" element={<CreateEditMarketPage />} />
        <Route path="/app/markets/:id" element={<MarketDetailPage />} />
        <Route path="/app/markets/:id/edit" element={<CreateEditMarketPage />} />
        <Route path="/app/products" element={<ProductsPage />} />
        <Route path="/app/products/new" element={<CreateEditProductPage />} />
        <Route path="/app/products/:id" element={<CreateEditProductPage />} />
        <Route path="/app/products/:id/edit" element={<CreateEditProductPage />} />
        <Route path="/app/insights" element={<InsightsPage />} />
        <Route path="/app/billing" element={<BillingPage />} />
        <Route path="/app/billing/success" element={<BillingSuccessPage />} />
        <Route path="/app/billing/pending" element={<BillingPendingPage />} />
        <Route path="/app/billing/failure" element={<BillingFailurePage />} />
        <Route path="/app/settings" element={<SettingsPage />} />

        <Route path="/lists" element={<ListsPage />} />
        <Route path="/lists/new" element={<CreateEditListPage />} />
        <Route path="/lists/:id" element={<ListDetailPage />} />
        <Route path="/lists/:id/edit" element={<CreateEditListPage />} />
        <Route path="/purchase/start" element={<StartPurchasePage />} />
        <Route path="/purchase/active" element={<ActivePurchasePage />} />
        <Route path="/purchase/item" element={<AddEditCartItemPage />} />
        <Route path="/purchase/finish" element={<FinishPurchasePage />} />
        <Route path="/history" element={<PurchaseHistoryPage />} />
        <Route path="/history/:id" element={<PurchaseDetailPage />} />
        <Route path="/prices" element={<PriceComparisonPage />} />
        <Route path="/prices/products/:productId" element={<ProductPriceDetailPage />} />
        <Route path="/markets" element={<MarketsPage />} />
        <Route path="/markets/new" element={<CreateEditMarketPage />} />
        <Route path="/markets/:id" element={<MarketDetailPage />} />
        <Route path="/markets/:id/edit" element={<CreateEditMarketPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/new" element={<CreateEditProductPage />} />
        <Route path="/products/:id/edit" element={<CreateEditProductPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/billing/pending" element={<BillingPendingPage />} />
        <Route path="/billing/failure" element={<BillingFailurePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/app/home" replace />} />
    </Routes>
  );
}

function ProtectedLayout({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <AppChrome />
      {children ?? <Outlet />}
      <BottomNav />
    </>
  );
}

function AppChrome() {
  const [online, setOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  async function promptInstall() {
    const prompt = deferredPrompt as Event & { prompt?: () => Promise<void> };
    await prompt.prompt?.();
    setDeferredPrompt(null);
  }

  return (
    <>
      <NavLink
        to="/app/settings"
        className="fixed right-3 top-[calc(10px+env(safe-area-inset-top))] z-40 grid h-10 w-10 place-items-center rounded-[8px] bg-white/95 text-ink shadow-soft"
        aria-label="Ajustes"
      >
        <Settings className="h-5 w-5" />
      </NavLink>
      {!online ? (
        <div className="fixed inset-x-3 top-[calc(10px+env(safe-area-inset-top))] z-50 mx-auto flex max-w-xl items-center gap-2 rounded-[8px] bg-ink px-3 py-2 text-xs font-semibold text-white shadow-soft">
          <WifiOff className="h-4 w-4 text-tomato" />
          Sem conexao. Dados recentes podem vir do cache local.
        </div>
      ) : null}
      {deferredPrompt && online ? (
        <div className="fixed inset-x-3 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[8px] bg-white p-3 shadow-soft">
          <span className="text-xs font-semibold text-ink/65">Adicionar Gondly a tela inicial</span>
          <AppButton className="h-10 px-3" icon={<Download className="h-4 w-4" />} onClick={promptInstall}>
            Instalar
          </AppButton>
        </div>
      ) : null}
    </>
  );
}

function BottomNav() {
  const items = [
    { to: "/app/home", label: "Home", icon: Home },
    { to: "/app/lists", label: "Listas", icon: ListChecks },
    { to: "/app/purchase/start", label: "Compra", icon: ShoppingCart },
    { to: "/app/history", label: "Historico", icon: History },
    { to: "/app/compare", label: "Comparar", icon: BarChart3 },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "flex h-16 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-bold transition",
                isActive ? "bg-mint/12 text-mint" : "text-ink/50 hover:bg-ink/5",
              ].join(" ")
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
