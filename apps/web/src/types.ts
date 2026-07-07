import type {
  EntitlementKey,
  ListItemStatus,
  MarketListStatus,
  OneTimePurchaseType,
  PaymentProvider,
  PaymentStatus,
  PurchaseStatus,
  RegionalComparisonConfidence,
  RegionalComparisonLevel,
  ShareLocationLevel,
  SharedRole,
  Unit,
} from "@gondly/types";

export type User = {
  id: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  monetization?: MonetizationStatus;
};

export type MonetizationStatus = {
  adsEnabled: boolean;
  hasNoAds: boolean;
  entitlements: EntitlementKey[];
  availableOffers?: BillingOffer[];
};

export type BillingOffer = {
  type: OneTimePurchaseType;
  title: string;
  description: string;
  price: number;
  currency: string;
};

export type BillingStatus = {
  adsEnabled: boolean;
  hasNoAds: boolean;
  entitlements: EntitlementKey[];
  availableOffers: BillingOffer[];
};

export type PriceSharingPreference = {
  sharePrices: boolean;
  shareLocationLevel: ShareLocationLevel;
  createdAt?: string;
  updatedAt?: string;
};

export type OneTimePurchase = {
  id: string;
  type: OneTimePurchaseType;
  provider: PaymentProvider;
  providerPreferenceId?: string | null;
  providerPaymentId?: string | null;
  providerExternalReference?: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  checkoutUrl?: string | null;
  paidAt?: string | null;
  rejectedAt?: string | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Market = {
  id: string;
  name: string;
  normalizedName?: string;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  createdByUserId?: string | null;
  verifiedStatus?: "unverified" | "user_created" | "verified";
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Brand = {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  normalizedName?: string;
  brand?: string | null;
  brandId?: string | null;
  brandRef?: Brand | null;
  category?: string | null;
  categoryId?: string | null;
  defaultUnit: Unit;
  barcode?: string | null;
  packageSize?: number | null;
  packageUnit?: Unit | null;
};

export type ProductBarcodeLookup = {
  product: Product;
  brand?: Brand | { id?: string | null; name: string } | null;
  category?: string | null;
  packageSize?: number | null;
  packageUnit?: Unit | null;
  unit: Unit;
  lastKnownPrice?: {
    pricePaid: number;
    normalizedPrice?: number | null;
    normalizedUnit?: string | null;
    market?: { id: string; name: string } | null;
    purchasedAt?: string | null;
  } | null;
};

export type MarketListItem = {
  id: string;
  productId?: string | null;
  productName: string;
  brand?: string | null;
  brandId?: string | null;
  brandNameSnapshot?: string | null;
  category?: string | null;
  packageSize?: number | null;
  packageUnit?: Unit | null;
  expectedQuantity?: number | null;
  unit: Unit;
  checked: boolean;
  important: boolean;
  status: ListItemStatus;
  assignedToUserId?: string | null;
  purchasedByUserId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ListMember = {
  id: string;
  role: SharedRole;
  status: string;
  user: User;
};

export type MarketList = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  status: MarketListStatus;
  items: MarketListItem[];
  members?: ListMember[];
  invites?: ListInvite[];
  updatedAt: string;
};

export type ListInvite = {
  id: string;
  inviteEmail?: string | null;
  inviteToken: string;
  role: SharedRole;
  status: string;
  expiresAt: string;
};

export type ShareLinkInfo = {
  listId: string;
  listName: string;
  description?: string | null;
  owner: Pick<User, "id" | "name" | "photoUrl">;
  expiresAt: string;
  accessStatus: "none" | "invited" | "accepted" | "removed" | "owner";
};

export type PurchaseItem = {
  id: string;
  sourceListItemId?: string | null;
  productId?: string | null;
  productName: string;
  brand?: string | null;
  brandId?: string | null;
  brandNameSnapshot?: string | null;
  category?: string | null;
  packageSize?: number | null;
  packageUnit?: Unit | null;
  quantity: number;
  unit: Unit;
  pricePaid: number;
  unitPriceNormalized?: number | null;
  normalizedUnitLabel?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Purchase = {
  id: string;
  marketId?: string | null;
  sourceListId?: string | null;
  status: PurchaseStatus;
  startedAt: string;
  completedAt?: string | null;
  subtotalCalculated: number;
  finalPaidAmount?: number | null;
  discountAmount?: number | null;
  notes?: string | null;
  updatedAt?: string;
  items: PurchaseItem[];
  market?: Market | null;
  sourceList?: MarketList | null;
  participants?: Array<{ id: string; userId: string; lastSeenAt: string }>;
};

export type DashboardReport = {
  lastPurchase: Purchase | null;
  totalSpentMonth: number;
  monthPurchasesCount: number;
  favoriteMarket: string | null;
  mostPurchasedProduct: string | null;
  estimatedSavings: number;
};

export type PriceComparison = {
  productName: string;
  category?: string | null;
  brandName?: string | null;
  packageSize?: number | null;
  packageUnit?: Unit | null;
  minPrice: number | null;
  maxPrice: number | null;
  averagePrice: number | null;
  lastPrice: number | null;
  lastMarket: string | null;
  lastPurchasedAt?: string | null;
  purchasesCount?: number;
};

export type InsightsReport = {
  monthly: Array<{ month: string; total: number }>;
  markets: Array<{ marketName: string; total: number }>;
  products: Array<{ productName: string; quantity: number }>;
  variation: Array<{ productName: string; variation: number }>;
  purchasesCount?: number;
  lastPurchase?: { marketName: string | null; completedAt: string | null } | null;
};

export type ProductPriceDetailsReport = {
  history: unknown[];
  markets: Array<{ marketId: string; marketName: string; averagePrice: number }>;
  best: { marketId: string; marketName: string; averagePrice: number } | null;
};

export type RegionalPriceComparison = {
  product: {
    productId?: string | null;
    canonicalProductId?: string | null;
    productName?: string | null;
    brandId?: string | null;
    categoryId?: string | null;
    unit?: Unit | null;
    packageSize?: number | null;
    packageUnit?: Unit | null;
  };
  region: {
    city?: string | null;
    state?: string | null;
    neighborhood?: string | null;
    radiusKm?: number | null;
    periodDays: number;
  };
  comparisonLevel: RegionalComparisonLevel;
  confidence: RegionalComparisonConfidence;
  recordsCount: number;
  marketsCount: number;
  minPrice: number;
  avgPrice: number;
  medianPrice: number;
  maxPrice: number;
  normalizedMinPrice?: number | null;
  normalizedAvgPrice?: number | null;
  normalizedUnit?: string | null;
  lastUpdatedAt?: string | null;
  reportableRecordId?: string | null;
};

export type PurchaseRegionalPriceComparison = {
  purchaseId: string;
  originalMarket: { marketId: string; marketName: string } | null;
  originalTotal: number;
  region: {
    city?: string | null;
    state?: string | null;
    neighborhood?: string | null;
    radiusKm?: number | null;
  };
  periodDays: number;
  comparableItemsCount: number;
  totalItemsCount: number;
  estimatedMarkets: Array<{
    marketId: string;
    marketName: string;
    estimatedTotal: number;
    matchedItemsCount: number;
    missingItemsCount: number;
    estimatedSavings: number;
    confidence: RegionalComparisonConfidence;
  }>;
  items: Array<{
    purchaseItemId: string;
    productName: string;
    brandName?: string | null;
    userPaidPrice: number;
    normalizedUserPrice?: number | null;
    normalizedUnit?: string | null;
    bestRegionalPrice: number;
    avgRegionalPrice: number;
    bestMarketName?: string | null;
    recordsCount: number;
    comparisonLevel: RegionalComparisonLevel;
    confidence: RegionalComparisonConfidence;
    lastUpdatedAt?: string | null;
    reportableRecordId?: string | null;
  }>;
};

export type PriceLibraryItem = {
  productName: string;
  brandName?: string | null;
  packageSize?: number | null;
  packageUnit?: Unit | null;
  categoryName?: string | null;
  minPrice: number;
  avgPrice: number;
  medianPrice: number;
  maxPrice?: number;
  normalizedMinPrice?: number | null;
  normalizedAvgPrice?: number | null;
  normalizedUnit?: string | null;
  cheapestMarketName?: string | null;
  recordsCount: number;
  marketsCount: number;
  lastUpdatedAt?: string | null;
  confidence: RegionalComparisonConfidence;
  reportableRecordId?: string | null;
  periodDays?: number;
};

export type ReverseGeocodeResult = {
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  country: string | null;
};

export type PriceLibraryMarket = {
  marketId: string;
  marketName: string;
  neighborhood?: string | null;
  city?: string | null;
  price: number;
  recordsCount: number;
  lastUpdatedAt?: string | null;
  confidence: RegionalComparisonConfidence;
};
