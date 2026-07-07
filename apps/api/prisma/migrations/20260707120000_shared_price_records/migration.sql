CREATE TYPE "SharedPriceVisibility" AS ENUM ('shared', 'private');

CREATE TYPE "ShareLocationLevel" AS ENUM ('none', 'city', 'neighborhood');

CREATE TABLE "SharedPriceRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "purchaseItemId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "marketNameSnapshot" TEXT,
  "productId" TEXT,
  "canonicalProductId" TEXT,
  "productNameRaw" TEXT NOT NULL,
  "normalizedProductName" TEXT NOT NULL,
  "brandId" TEXT,
  "brandNameSnapshot" TEXT,
  "categoryId" TEXT,
  "categoryNameSnapshot" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" "Unit" NOT NULL,
  "packageSize" DOUBLE PRECISION,
  "packageUnit" "Unit",
  "pricePaid" DECIMAL(12,2) NOT NULL,
  "normalizedPrice" DECIMAL(12,4),
  "normalizedUnit" TEXT,
  "purchasedAt" TIMESTAMP(3) NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "neighborhood" TEXT,
  "latitudeApprox" DOUBLE PRECISION,
  "longitudeApprox" DOUBLE PRECISION,
  "visibility" "SharedPriceVisibility" NOT NULL DEFAULT 'shared',
  "confidenceScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SharedPriceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPriceSharingPreference" (
  "userId" TEXT NOT NULL,
  "sharePrices" BOOLEAN NOT NULL DEFAULT false,
  "shareLocationLevel" "ShareLocationLevel" NOT NULL DEFAULT 'city',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserPriceSharingPreference_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "SharedPriceRecord_userId_purchaseItemId_key" ON "SharedPriceRecord"("userId", "purchaseItemId");
CREATE INDEX "SharedPriceRecord_purchaseId_idx" ON "SharedPriceRecord"("purchaseId");
CREATE INDEX "SharedPriceRecord_purchaseItemId_idx" ON "SharedPriceRecord"("purchaseItemId");
CREATE INDEX "SharedPriceRecord_marketId_idx" ON "SharedPriceRecord"("marketId");
CREATE INDEX "SharedPriceRecord_productId_idx" ON "SharedPriceRecord"("productId");
CREATE INDEX "SharedPriceRecord_canonicalProductId_idx" ON "SharedPriceRecord"("canonicalProductId");
CREATE INDEX "SharedPriceRecord_normalizedProductName_idx" ON "SharedPriceRecord"("normalizedProductName");
CREATE INDEX "SharedPriceRecord_visibility_purchasedAt_idx" ON "SharedPriceRecord"("visibility", "purchasedAt");
CREATE INDEX "SharedPriceRecord_city_state_neighborhood_idx" ON "SharedPriceRecord"("city", "state", "neighborhood");

ALTER TABLE "SharedPriceRecord"
  ADD CONSTRAINT "SharedPriceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SharedPriceRecord"
  ADD CONSTRAINT "SharedPriceRecord_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SharedPriceRecord"
  ADD CONSTRAINT "SharedPriceRecord_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SharedPriceRecord"
  ADD CONSTRAINT "SharedPriceRecord_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPriceSharingPreference"
  ADD CONSTRAINT "UserPriceSharingPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
