import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "../lib/analytics";
import { useAds } from "../lib/ads";
import { AdPlaceholder } from "./AdPlaceholder";
import { AdSenseAd } from "./AdSenseAd";
import { HouseAd } from "./HouseAd";
import { isAllowedAdRoute, isBlockedAdRoute } from "./blockedRoutes";
import { adsConfig, getAdSenseSlotId, type AdSlotName } from "./config";

type AdSlotProps = {
  slot: AdSlotName;
  className?: string;
  disabled?: boolean;
};

export function AdSlot({ slot, className, disabled }: AdSlotProps) {
  const location = useLocation();
  const { adsEnabled, hasNoAds, isLoading } = useAds();
  const blockedByRoute =
    isBlockedAdRoute(location.pathname) ||
    !isAllowedAdRoute(location.pathname, slot);
  const hidden =
    disabled ||
    isLoading ||
    !adsConfig.enabled ||
    !adsEnabled ||
    hasNoAds ||
    blockedByRoute;
  const adsenseSlotId = getAdSenseSlotId(slot);
  const canRenderAdsense =
    import.meta.env.PROD &&
    adsConfig.provider === "adsense" &&
    Boolean(adsConfig.adsenseClientId && adsenseSlotId);
  const shouldRenderHouse =
    import.meta.env.PROD &&
    !canRenderAdsense &&
    adsConfig.fallbackProvider === "house";

  useEffect(() => {
    if (hidden) return;

    trackEvent("ad_slot_view", {
      slot,
      provider: import.meta.env.PROD
        ? canRenderAdsense
          ? "adsense"
          : "house"
        : "placeholder",
      route: location.pathname,
    });
  }, [canRenderAdsense, hidden, location.pathname, slot]);

  if (hidden) return null;

  if (!import.meta.env.PROD) {
    return <AdPlaceholder className={className} />;
  }

  if (canRenderAdsense) {
    return (
      <AdSenseAd
        clientId={adsConfig.adsenseClientId!}
        slotId={adsenseSlotId!}
        className={className}
      />
    );
  }

  if (shouldRenderHouse) {
    return <HouseAd slot={slot} className={className} />;
  }

  return null;
}
