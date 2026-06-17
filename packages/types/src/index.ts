export const units = ["un", "kg", "g", "l", "ml", "pacote", "caixa", "outro"] as const;
export type Unit = (typeof units)[number];

export const marketListStatuses = ["active", "archived"] as const;
export type MarketListStatus = (typeof marketListStatuses)[number];

export const purchaseStatuses = ["in_progress", "completed", "cancelled"] as const;
export type PurchaseStatus = (typeof purchaseStatuses)[number];

export const sharedRoles = ["owner", "editor", "viewer"] as const;
export type SharedRole = (typeof sharedRoles)[number];

export const memberStatuses = ["invited", "accepted", "removed"] as const;
export type MemberStatus = (typeof memberStatuses)[number];

export const listItemStatuses = ["pending", "assigned", "in_cart", "purchased", "skipped"] as const;
export type ListItemStatus = (typeof listItemStatuses)[number];

export const entitlementKeys = ["no_ads"] as const;
export type EntitlementKey = (typeof entitlementKeys)[number];

export const entitlementSources = ["one_time_purchase", "manual", "promo"] as const;
export type EntitlementSource = (typeof entitlementSources)[number];

export const oneTimePurchaseTypes = ["remove_ads"] as const;
export type OneTimePurchaseType = (typeof oneTimePurchaseTypes)[number];

export const paymentProviders = ["mercado_pago", "manual"] as const;
export type PaymentProvider = (typeof paymentProviders)[number];

export const paymentStatuses = ["pending", "approved", "rejected", "cancelled", "refunded", "expired"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  photoUrl?: string | null;
};

export type MonetizationStatus = {
  adsEnabled: boolean;
  hasNoAds: boolean;
  entitlements: EntitlementKey[];
};

export type MoneySummary = {
  subtotalCalculated: number;
  finalPaidAmount?: number | null;
  discountAmount?: number | null;
};
