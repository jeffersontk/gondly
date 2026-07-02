import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { trackEvent } from "./analytics";
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
  const noAdsTrackedRef = useRef(false);
  const query = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => api<BillingStatus>("/billing/status"),
    enabled: Boolean(user && !user.monetization),
    staleTime: 30 * 60_000,
  });

  const status = normalizeUserStatus(query.data) ?? normalizeUserStatus(user?.monetization) ?? defaultStatus;

  async function refreshBillingStatus() {
    await query.refetch();
  }

  useEffect(() => {
    if (!user || !status.hasNoAds || noAdsTrackedRef.current) return;
    noAdsTrackedRef.current = true;
    trackEvent("no_ads_active", { source: "billing_status" });
  }, [status.hasNoAds, user]);

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

function normalizeUserStatus(status: Partial<BillingStatus> | undefined): BillingStatus | undefined {
  if (!status) return undefined;
  const entitlements = status.entitlements ?? [];
  const hasNoAds = Boolean(status.hasNoAds || entitlements.includes("no_ads"));

  return {
    adsEnabled: hasNoAds ? false : (status.adsEnabled ?? true),
    hasNoAds,
    entitlements,
    availableOffers: status.availableOffers ?? [],
  };
}
