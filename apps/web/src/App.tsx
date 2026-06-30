import { useEffect, useState, type ReactNode } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { lazy, Suspense } from "react";
import {
  BarChart3,
  Download,
  History,
  Home,
  ListChecks,
  Settings,
  ShoppingCart,
  WifiOff,
} from "lucide-react";
import { AppButton, LoadingState } from "./components";
import { useAuth } from "./lib/auth";
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({ default: module.HomePage })),
);
const InsightsPage = lazy(() =>
  import("./pages/InsightsPage").then((module) => ({
    default: module.InsightsPage,
  })),
);
const ListsPage = lazy(() =>
  import("./pages/lists/ListsPage").then((module) => ({
    default: module.ListsPage,
  })),
);
const ListDetailPage = lazy(() =>
  import("./pages/lists/ListDetailPage").then((module) => ({
    default: module.ListDetailPage,
  })),
);
const CreateEditListPage = lazy(() =>
  import("./pages/lists/CreateEditListPage").then((module) => ({
    default: module.CreateEditListPage,
  })),
);
const SharedListPage = lazy(() =>
  import("./pages/lists/SharedListPage").then((module) => ({
    default: module.SharedListPage,
  })),
);
const StartPurchasePage = lazy(() =>
  import("./pages/purchase/StartPurchasePage").then((module) => ({
    default: module.StartPurchasePage,
  })),
);
const ActivePurchasePage = lazy(() =>
  import("./pages/purchase/ActivePurchasePage").then((module) => ({
    default: module.ActivePurchasePage,
  })),
);
const AddEditCartItemPage = lazy(() =>
  import("./pages/purchase/AddEditCartItemPage").then((module) => ({
    default: module.AddEditCartItemPage,
  })),
);
const FinishPurchasePage = lazy(() =>
  import("./pages/purchase/FinishPurchasePage").then((module) => ({
    default: module.FinishPurchasePage,
  })),
);
const PurchaseHistoryPage = lazy(() =>
  import("./pages/history/PurchaseHistoryPage").then((module) => ({
    default: module.PurchaseHistoryPage,
  })),
);
const PurchaseDetailPage = lazy(() =>
  import("./pages/history/PurchaseDetailPage").then((module) => ({
    default: module.PurchaseDetailPage,
  })),
);
const PriceComparisonPage = lazy(() =>
  import("./pages/compare/PriceComparisonPage").then((module) => ({
    default: module.PriceComparisonPage,
  })),
);
const ProductPriceDetailPage = lazy(() =>
  import("./pages/compare/ProductPriceDetailPage").then((module) => ({
    default: module.ProductPriceDetailPage,
  })),
);
const MarketsPage = lazy(() =>
  import("./pages/markets/MarketsPage").then((module) => ({
    default: module.MarketsPage,
  })),
);
const MarketDetailPage = lazy(() =>
  import("./pages/markets/MarketDetailPage").then((module) => ({
    default: module.MarketDetailPage,
  })),
);
const CreateEditMarketPage = lazy(() =>
  import("./pages/markets/CreateEditMarketPage").then((module) => ({
    default: module.CreateEditMarketPage,
  })),
);
const ProductsPage = lazy(() =>
  import("./pages/products/ProductsPage").then((module) => ({
    default: module.ProductsPage,
  })),
);
const CreateEditProductPage = lazy(() =>
  import("./pages/products/CreateEditProductPage").then((module) => ({
    default: module.CreateEditProductPage,
  })),
);
const BillingPage = lazy(() =>
  import("./pages/billing/BillingPage").then((module) => ({
    default: module.BillingPage,
  })),
);
const BillingSuccessPage = lazy(() =>
  import("./pages/billing/BillingSuccessPage").then((module) => ({
    default: module.BillingSuccessPage,
  })),
);
const BillingPendingPage = lazy(() =>
  import("./pages/billing/BillingPendingPage").then((module) => ({
    default: module.BillingPendingPage,
  })),
);
const BillingFailurePage = lazy(() =>
  import("./pages/billing/BillingFailurePage").then((module) => ({
    default: module.BillingFailurePage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/invite/:token"
          element={
            <ProtectedLayout>
              <SharedListPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/shared/:token"
          element={
            <ProtectedLayout>
              <SharedListPage />
            </ProtectedLayout>
          }
        />
        <Route element={<ProtectedLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/app/home" element={<HomePage />} />
          <Route path="/app/lists" element={<ListsPage />} />
          <Route path="/app/lists/new" element={<CreateEditListPage />} />
          <Route path="/app/lists/:id" element={<ListDetailPage />} />
          <Route path="/app/lists/:id/edit" element={<CreateEditListPage />} />
          <Route path="/app/purchase" element={<ActivePurchasePage />} />
          <Route path="/app/purchase/start" element={<StartPurchasePage />} />
          <Route
            path="/app/purchase/:purchaseId"
            element={<ActivePurchasePage />}
          />
          <Route
            path="/app/purchase/:purchaseId/item"
            element={<AddEditCartItemPage />}
          />
          <Route
            path="/app/purchase/:purchaseId/finish"
            element={<FinishPurchasePage />}
          />
          <Route path="/app/history" element={<PurchaseHistoryPage />} />
          <Route path="/app/history/:id" element={<PurchaseDetailPage />} />
          <Route path="/app/compare" element={<PriceComparisonPage />} />
          <Route
            path="/app/compare/products/:productId"
            element={<ProductPriceDetailPage />}
          />
          <Route path="/app/markets" element={<MarketsPage />} />
          <Route path="/app/markets/new" element={<CreateEditMarketPage />} />
          <Route path="/app/markets/:id" element={<MarketDetailPage />} />
          <Route
            path="/app/markets/:id/edit"
            element={<CreateEditMarketPage />}
          />
          <Route path="/app/products" element={<ProductsPage />} />
          <Route path="/app/products/new" element={<CreateEditProductPage />} />
          <Route path="/app/products/:id" element={<CreateEditProductPage />} />
          <Route
            path="/app/products/:id/edit"
            element={<CreateEditProductPage />}
          />
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
          <Route
            path="/prices/products/:productId"
            element={<ProductPriceDetailPage />}
          />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/markets/new" element={<CreateEditMarketPage />} />
          <Route path="/markets/:id" element={<MarketDetailPage />} />
          <Route path="/markets/:id/edit" element={<CreateEditMarketPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<CreateEditProductPage />} />
          <Route
            path="/products/:id/edit"
            element={<CreateEditProductPage />}
          />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/billing/pending" element={<BillingPendingPage />} />
          <Route path="/billing/failure" element={<BillingFailurePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/app/home" replace />} />
      </Routes>
    </Suspense>
  );
}

function ProtectedLayout({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
  const location = useLocation();
  const showSettingsShortcut =
    location.pathname === "/" || location.pathname === "/app/home";

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
      {showSettingsShortcut ? (
        <NavLink
          to="/app/settings"
          className="fixed right-4 top-[calc(12px+env(safe-area-inset-top))] z-40 grid h-10 w-10 place-items-center rounded-xl border border-line/80 bg-white/90 text-ink/70 shadow-sm backdrop-blur transition hover:border-mint/30 hover:text-mint"
          aria-label="Ajustes"
        >
          <Settings className="h-5 w-5" />
        </NavLink>
      ) : null}
      {!online ? (
        <div className="fixed inset-x-3 top-[calc(10px+env(safe-area-inset-top))] z-50 mx-auto flex max-w-xl items-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-semibold text-white shadow-lift">
          <WifiOff className="h-4 w-4 text-white" />
          Sem conexao. Dados recentes podem vir do cache local.
        </div>
      ) : null}
      {deferredPrompt && online ? (
        <div className="fixed inset-x-3 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3 shadow-lift">
          <span className="text-xs font-semibold text-ink/65">
            Adicionar Gondly a tela inicial
          </span>
          <AppButton
            className="h-10 px-3"
            icon={<Download className="h-4 w-4" />}
            onClick={promptInstall}
          >
            Instalar
          </AppButton>
        </div>
      ) : null}
    </>
  );
}

function BottomNav() {
  const location = useLocation();
  const items = [
    { to: "/app/home", label: "Início", icon: Home },
    { to: "/app/lists", label: "Listas", icon: ListChecks },
    { to: "/app/purchase/start", label: "Compra", icon: ShoppingCart },
    { to: "/app/history", label: "Historico", icon: History },
    { to: "/app/compare", label: "Comparar", icon: BarChart3 },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {items.map(({ to, label, icon: Icon }) => {
          const isActive = isBottomNavActive(location.pathname, to);

          return (
            <NavLink
              key={to}
              to={to}
              className={[
                "flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition duration-200",
                isActive
                  ? "bg-mint/10 text-mint"
                  : "text-[#64748B] hover:bg-paper hover:text-ink",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function isBottomNavActive(pathname: string, to: string) {
  if (to === "/app/home") return pathname === "/" || pathname === "/app/home";
  if (to === "/app/purchase/start")
    return (
      pathname.startsWith("/app/purchase") || pathname.startsWith("/purchase")
    );
  if (to === "/app/lists")
    return pathname.startsWith("/app/lists") || pathname.startsWith("/lists");
  if (to === "/app/history")
    return (
      pathname.startsWith("/app/history") || pathname.startsWith("/history")
    );
  if (to === "/app/compare")
    return (
      pathname.startsWith("/app/compare") || pathname.startsWith("/prices")
    );
  return pathname === to;
}
