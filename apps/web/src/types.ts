import type {
  EntitlementKey,
  ListItemStatus,
  MarketListStatus,
  OneTimePurchaseType,
  PaymentProvider,
  PaymentStatus,
  PurchaseStatus,
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
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  defaultUnit: Unit;
  barcode?: string | null;
};

export type MarketListItem = {
  id: string;
  productId?: string | null;
  productName: string;
  brand?: string | null;
  category?: string | null;
  expectedQuantity?: number | null;
  unit: Unit;
  checked: boolean;
  status: ListItemStatus;
  assignedToUserId?: string | null;
  purchasedByUserId?: string | null;
  notes?: string | null;
};

export type ListMember = {
  id: string;
  role: SharedRole;
  status: string;
  user: User;
};

export type MarketList = {
  id: string;
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

export type PurchaseItem = {
  id: string;
  productId?: string | null;
  productName: string;
  brand?: string | null;
  category?: string | null;
  quantity: number;
  unit: Unit;
  pricePaid: number;
  unitPriceNormalized?: number | null;
  normalizedUnitLabel?: string | null;
  notes?: string | null;
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
  minPrice: number | null;
  maxPrice: number | null;
  averagePrice: number | null;
  lastPrice: number | null;
  lastMarket: string | null;
};
