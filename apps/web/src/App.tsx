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
  CheckCircle2,
  Download,
  History,
  Home,
  ListChecks,
  Settings,
  ShoppingCart,
  Smartphone,
  WifiOff,
  X,
} from "lucide-react";
import { AppButton, LoadingState } from "./components";
import { trackEvent, usePageTracking } from "./lib/analytics";
import { useAuth } from "./lib/auth";
import { promptPwaInstall, usePwaInstall } from "./lib/pwaInstall";

const INSTALL_MODAL_SESSION_KEY = "gondly.installModalDismissed";

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
const RegionalPriceLibraryPage = lazy(() =>
  import("./pages/compare/RegionalPriceLibraryPage").then((module) => ({
    default: module.RegionalPriceLibraryPage,
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
const TutorialPage = lazy(() =>
  import("./pages/TutorialPage").then((module) => ({
    default: module.TutorialPage,
  })),
);
const PrivacyPage = lazy(() =>
  import("./pages/PublicInfoPages").then((module) => ({
    default: module.PrivacyPage,
  })),
);
const TermsPage = lazy(() =>
  import("./pages/PublicInfoPages").then((module) => ({
    default: module.TermsPage,
  })),
);
const ContactPage = lazy(() =>
  import("./pages/PublicInfoPages").then((module) => ({
    default: module.ContactPage,
  })),
);

export function App() {
  usePageTracking();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route index element={<PublicLandingRoute />} />
        <Route path="/login" element={<PublicLandingRoute />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/contact" element={<ContactPage />} />
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
          <Route path="/app/compare/region" element={<RegionalPriceLibraryPage />} />
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
          <Route path="/app/tutorial" element={<TutorialPage />} />

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
          <Route path="/prices/region" element={<RegionalPriceLibraryPage />} />
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
          <Route path="/tutorial" element={<TutorialPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/app/home" replace />} />
      </Routes>
    </Suspense>
  );
}

function RouteLoadingFallback() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 pt-6">
      <div className="h-8 w-28 rounded-full bg-white shadow-sm" />
      <div className="mt-8 h-6 w-40 rounded-full bg-white shadow-sm" />
      <div className="mt-3 h-4 w-56 rounded-full bg-white shadow-sm" />
      <div className="mt-6 h-32 rounded-2xl bg-white shadow-sm" />
    </main>
  );
}

function PublicLandingRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState />;
  if (user) return <Navigate to="/app/home" replace />;

  return <LoginPage />;
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
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [installModalDismissed, setInstallModalDismissed] = useState(() => sessionStorage.getItem(INSTALL_MODAL_SESSION_KEY) === "true");
  const pwaInstall = usePwaInstall();
  const location = useLocation();
  const showSettingsShortcut = location.pathname === "/app/home";
  const canShowInstallModal = Boolean(pwaInstall.deferredPrompt) && online && !pwaInstall.installed;

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleAppInstalled = () => {
      trackEvent("app_installed", { source: "browser" });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!canShowInstallModal) {
      setInstallModalOpen(false);
      return;
    }

    if (!installModalDismissed) {
      setInstallModalOpen(true);
      trackEvent("view_install_pwa_modal", { source: "auto_prompt" });
    }
  }, [canShowInstallModal, installModalDismissed]);

  async function promptInstall() {
    trackEvent("click_install_pwa", { source: "install_modal" });
    await promptPwaInstall();
    dismissInstallModal();
  }

  function dismissInstallModal() {
    sessionStorage.setItem(INSTALL_MODAL_SESSION_KEY, "true");
    setInstallModalDismissed(true);
    setInstallModalOpen(false);
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
      {installModalOpen && canShowInstallModal ? <InstallAppModal onInstall={promptInstall} onClose={dismissInstallModal} /> : null}
    </>
  );
}

function InstallAppModal({ onInstall, onClose }: { onInstall: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="install-app-title">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-mint text-white shadow-soft">
            <Smartphone className="h-6 w-6" />
          </span>
          <button
            type="button"
            className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-paper text-ink/60 transition hover:bg-line hover:text-ink"
            onClick={onClose}
            aria-label="Fechar instalacao"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 id="install-app-title" className="mt-4 text-xl font-black tracking-[-0.03em] text-ink">
          Instale o Gondly no seu dispositivo
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Abra o Gondly como app, com acesso rapido pela tela inicial e melhor experiencia durante as compras.
        </p>

        <div className="mt-4 space-y-2 rounded-xl bg-paper p-3">
          {["Acesso direto sem abrir o navegador", "Tela mais limpa para usar no mercado", "Dados recentes continuam disponiveis offline"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm font-semibold text-ink/70">
              <CheckCircle2 className="h-4 w-4 flex-none text-mint" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-2">
          <AppButton full icon={<Download className="h-4 w-4" />} onClick={onInstall}>
            Instalar agora
          </AppButton>
          <AppButton full variant="secondary" onClick={onClose}>
            Agora nao
          </AppButton>
        </div>
      </div>
    </div>
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
  if (to === "/app/home") return pathname === "/app/home";
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
