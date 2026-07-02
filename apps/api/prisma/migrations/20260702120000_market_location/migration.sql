CREATE TYPE "MarketVerifiedStatus" AS ENUM ('unverified', 'user_created', 'verified');

ALTER TABLE "Market"
  ADD COLUMN "normalizedName" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'BR',
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "placeId" TEXT,
  ADD COLUMN "verifiedStatus" "MarketVerifiedStatus" NOT NULL DEFAULT 'user_created';

UPDATE "Market"
SET "normalizedName" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))
WHERE "normalizedName" IS NULL;

ALTER TABLE "Market"
  ALTER COLUMN "normalizedName" SET NOT NULL;

ALTER TABLE "Market" DROP CONSTRAINT IF EXISTS "Market_userId_fkey";
ALTER TABLE "Market" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Market"
  ADD CONSTRAINT "Market_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Market_normalizedName_idx" ON "Market"("normalizedName");
CREATE INDEX "Market_city_neighborhood_idx" ON "Market"("city", "neighborhood");
CREATE INDEX "Market_latitude_longitude_idx" ON "Market"("latitude", "longitude");
