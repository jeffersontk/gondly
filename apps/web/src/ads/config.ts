export type AdSlotName =
  | "home_inline"
  | "lists_inline"
  | "history_inline"
  | "compare_inline"
  | "landing_inline";

type AdProviderName = "adsense" | "house";

function envString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function envProvider(value: unknown, fallback: AdProviderName): AdProviderName {
  return value === "adsense" || value === "house" ? value : fallback;
}

export const adsConfig = {
  enabled: import.meta.env.VITE_ENABLE_ADS === "true",
  provider: envProvider(import.meta.env.VITE_AD_PROVIDER, "adsense"),
  fallbackProvider: envProvider(import.meta.env.VITE_AD_FALLBACK_PROVIDER, "house"),
  adsenseClientId: envString(import.meta.env.VITE_ADSENSE_CLIENT_ID),
  slots: {
    home_inline: envString(import.meta.env.VITE_ADSENSE_HOME_SLOT),
    lists_inline: envString(import.meta.env.VITE_ADSENSE_LISTS_SLOT),
    history_inline: envString(import.meta.env.VITE_ADSENSE_HISTORY_SLOT),
    compare_inline: envString(import.meta.env.VITE_ADSENSE_COMPARE_SLOT),
    landing_inline: envString(import.meta.env.VITE_ADSENSE_LANDING_SLOT),
  } satisfies Record<AdSlotName, string | undefined>,
};

export function getAdSenseSlotId(slot: AdSlotName) {
  return adsConfig.slots[slot];
}
