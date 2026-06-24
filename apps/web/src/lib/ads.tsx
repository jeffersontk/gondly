import { createContext, ReactNode, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./auth";
import type { BillingStatus } from "../types";

type AdsContextValue = {
  adsEnabled: boolean;
  hasNoAds: boolean;
  isLoading: boolean;
  status?: BillingStatus;
  refreshBillingStatus: () => Promise<void>;
};

const AdsContext = createContext<AdsContextValue | null>(null);

const defaultStatus: BillingStatus = {
  adsEnabled: true,
  hasNoAds: false,
  entitlements: [],
  availableOffers: [],
};

export function AdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => api<BillingStatus>("/billing/status"),
    enabled: Boolean(user && !user.monetization),
    staleTime: 30 * 60_000,
  });

  const status = query.data ?? normalizeUserStatus(user?.monetization) ?? defaultStatus;

  async function refreshBillingStatus() {
    await query.refetch();
  }

  return (
    <AdsContext.Provider
      value={{
        adsEnabled: status.adsEnabled,
        hasNoAds: status.hasNoAds,
        isLoading: query.isLoading,
        status,
        refreshBillingStatus,
      }}
    >
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  const context = useContext(AdsContext);
  if (!context) {
    throw new Error("useAds must be used within AdProvider.");
  }
  return context;
}

export function AdSlot({ className }: { className?: string }) {
  const { adsEnabled, isLoading } = useAds();
  const location = useLocation();
  const adsEnabledByEnv = import.meta.env.VITE_ENABLE_ADS !== "false";

  if (isLoading || !adsEnabled || !adsEnabledByEnv || isForbiddenAdRoute(location.pathname)) {
    return null;
  }

  const adsenseClientId = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
  if (import.meta.env.PROD && adsenseClientId) {
    return <AdSenseSlot clientId={adsenseClientId} className={className} />;
  }

  if (import.meta.env.DEV || import.meta.env.MODE === "staging") {
    return <AdPlaceholder className={className} />;
  }

  return null;
}

export function AdPlaceholder({ className }: { className?: string }) {
  return (
    <div className={["rounded-xl border border-dashed border-line bg-white/70 p-3 text-center text-xs font-semibold text-ink/45", className].filter(Boolean).join(" ")}>
      Espaco para anuncio
    </div>
  );
}

export function AdSenseSlot({ clientId, className }: { clientId: string; className?: string }) {
  useEffect(() => {
    if (document.querySelector(`script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`)) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    document.head.appendChild(script);
  }, [clientId]);

  useEffect(() => {
    try {
      ((window as never as { adsbygoogle?: unknown[] }).adsbygoogle = (window as never as { adsbygoogle?: unknown[] }).adsbygoogle || []).push({});
    } catch {
      // AdSense may be blocked by the browser; the app should continue normally.
    }
  }, []);

  return (
    <ins
      className={["adsbygoogle block min-h-20 rounded-xl bg-white/70", className].filter(Boolean).join(" ")}
      data-ad-client={clientId}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

function normalizeUserStatus(status: Partial<BillingStatus> | undefined): BillingStatus | undefined {
  if (!status) return undefined;
  return {
    adsEnabled: status.adsEnabled ?? true,
    hasNoAds: status.hasNoAds ?? false,
    entitlements: status.entitlements ?? [],
    availableOffers: status.availableOffers ?? [],
  };
}

function isForbiddenAdRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/app/billing") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/app/purchase") ||
    pathname.startsWith("/purchase") ||
    pathname.includes("/item") ||
    pathname.includes("/finish")
  );
}
