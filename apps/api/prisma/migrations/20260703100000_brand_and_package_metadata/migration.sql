CREATE TABLE "Brand" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_normalizedName_key" ON "Brand"("normalizedName");
CREATE INDEX "Brand_name_idx" ON "Brand"("name");

ALTER TABLE "Product"
  ADD COLUMN "normalizedName" TEXT,
  ADD COLUMN "brandId" TEXT,
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "packageSize" DOUBLE PRECISION,
  ADD COLUMN "packageUnit" "Unit";

ALTER TABLE "MarketListItem"
  ADD COLUMN "brandId" TEXT,
  ADD COLUMN "brandNameSnapshot" TEXT,
  ADD COLUMN "packageSize" DOUBLE PRECISION,
  ADD COLUMN "packageUnit" "Unit";

ALTER TABLE "PurchaseItem"
  ADD COLUMN "brandId" TEXT,
  ADD COLUMN "brandNameSnapshot" TEXT,
  ADD COLUMN "packageSize" DOUBLE PRECISION,
  ADD COLUMN "packageUnit" "Unit";

UPDATE "Product"
SET "normalizedName" = translate(
  lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')),
  'áàâãäåéèêëíìîïóòôõöúùûüçñ',
  'aaaaaaeeeeiiiiooooouuuucn'
)
WHERE "normalizedName" IS NULL;

WITH brand_values AS (
  SELECT btrim("brand") AS "name",
    translate(lower(regexp_replace(btrim("brand"), '\s+', ' ', 'g')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn') AS "normalizedName"
  FROM "Product"
  WHERE nullif(btrim("brand"), '') IS NOT NULL
  UNION
  SELECT btrim("brand") AS "name",
    translate(lower(regexp_replace(btrim("brand"), '\s+', ' ', 'g')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn') AS "normalizedName"
  FROM "MarketListItem"
  WHERE nullif(btrim("brand"), '') IS NOT NULL
  UNION
  SELECT btrim("brand") AS "name",
    translate(lower(regexp_replace(btrim("brand"), '\s+', ' ', 'g')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn') AS "normalizedName"
  FROM "PurchaseItem"
  WHERE nullif(btrim("brand"), '') IS NOT NULL
),
deduped_brands AS (
  SELECT "normalizedName", min("name") AS "name"
  FROM brand_values
  WHERE "normalizedName" <> ''
  GROUP BY "normalizedName"
)
INSERT INTO "Brand" ("id", "name", "normalizedName", "createdAt", "updatedAt")
SELECT 'brand_' || md5("normalizedName"), "name", "normalizedName", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM deduped_brands
ON CONFLICT ("normalizedName") DO NOTHING;

UPDATE "Product" AS p
SET "brandId" = b."id"
FROM "Brand" AS b
WHERE nullif(btrim(p."brand"), '') IS NOT NULL
  AND translate(lower(regexp_replace(btrim(p."brand"), '\s+', ' ', 'g')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn') = b."normalizedName";

UPDATE "MarketListItem"
SET "brandNameSnapshot" = "brand"
WHERE "brandNameSnapshot" IS NULL
  AND nullif(btrim("brand"), '') IS NOT NULL;

UPDATE "MarketListItem" AS i
SET "brandId" = b."id"
FROM "Brand" AS b
WHERE nullif(btrim(i."brandNameSnapshot"), '') IS NOT NULL
  AND translate(lower(regexp_replace(btrim(i."brandNameSnapshot"), '\s+', ' ', 'g')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn') = b."normalizedName";

UPDATE "PurchaseItem"
SET "brandNameSnapshot" = "brand"
WHERE "brandNameSnapshot" IS NULL
  AND nullif(btrim("brand"), '') IS NOT NULL;

UPDATE "PurchaseItem" AS i
SET "brandId" = b."id"
FROM "Brand" AS b
WHERE nullif(btrim(i."brandNameSnapshot"), '') IS NOT NULL
  AND translate(lower(regexp_replace(btrim(i."brandNameSnapshot"), '\s+', ' ', 'g')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn') = b."normalizedName";

ALTER TABLE "Product"
  ALTER COLUMN "normalizedName" SET NOT NULL;

CREATE INDEX "Product_userId_normalizedName_idx" ON "Product"("userId", "normalizedName");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "MarketListItem_brandId_idx" ON "MarketListItem"("brandId");
CREATE INDEX "PurchaseItem_brandId_idx" ON "PurchaseItem"("brandId");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketListItem"
  ADD CONSTRAINT "MarketListItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseItem"
  ADD CONSTRAINT "PurchaseItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
