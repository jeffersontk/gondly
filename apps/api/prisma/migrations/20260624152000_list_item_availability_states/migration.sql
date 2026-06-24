-- Replace workflow-oriented list statuses with the three availability states used by the product.
ALTER TABLE "MarketListItem" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "ListItemStatus_new" AS ENUM ('pending', 'at_home', 'not_needed');

ALTER TABLE "MarketListItem"
  ALTER COLUMN "status" TYPE "ListItemStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'skipped' THEN 'at_home'
      ELSE 'pending'
    END
  )::"ListItemStatus_new";

DROP TYPE "ListItemStatus";
ALTER TYPE "ListItemStatus_new" RENAME TO "ListItemStatus";
ALTER TABLE "MarketListItem" ALTER COLUMN "status" SET DEFAULT 'pending';

-- Keep a stable link between a list item and its copy inside a purchase.
ALTER TABLE "PurchaseItem" ADD COLUMN "sourceListItemId" TEXT;

UPDATE "PurchaseItem" purchase_item
SET "sourceListItemId" = (
  SELECT list_item."id"
  FROM "Purchase" purchase
  JOIN "MarketListItem" list_item ON list_item."listId" = purchase."sourceListId"
  WHERE purchase."id" = purchase_item."purchaseId"
    AND (
      (purchase_item."productId" IS NOT NULL AND list_item."productId" = purchase_item."productId")
      OR (
        purchase_item."productId" IS NULL
        AND lower(list_item."productName") = lower(purchase_item."productName")
      )
    )
  ORDER BY list_item."createdAt" ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "Purchase" purchase
  WHERE purchase."id" = purchase_item."purchaseId"
    AND purchase."sourceListId" IS NOT NULL
);

DELETE FROM "PurchaseItem" purchase_item
USING "MarketListItem" list_item
WHERE purchase_item."sourceListItemId" = list_item."id"
  AND list_item."status" <> 'pending';

CREATE INDEX "PurchaseItem_sourceListItemId_idx" ON "PurchaseItem"("sourceListItemId");

ALTER TABLE "PurchaseItem"
  ADD CONSTRAINT "PurchaseItem_sourceListItemId_fkey"
  FOREIGN KEY ("sourceListItemId") REFERENCES "MarketListItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
