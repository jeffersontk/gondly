-- Keep only the most recent subscription per user before enforcing the one-current-subscription model.
DELETE FROM "Subscription" old
USING "Subscription" newer
WHERE old."userId" = newer."userId"
  AND (
    old."createdAt" < newer."createdAt"
    OR (old."createdAt" = newer."createdAt" AND old."id" < newer."id")
  );

ALTER TABLE "Purchase"
  ALTER COLUMN "subtotalCalculated" TYPE DECIMAL(12,2) USING "subtotalCalculated"::DECIMAL(12,2),
  ALTER COLUMN "finalPaidAmount" TYPE DECIMAL(12,2) USING "finalPaidAmount"::DECIMAL(12,2),
  ALTER COLUMN "discountAmount" TYPE DECIMAL(12,2) USING "discountAmount"::DECIMAL(12,2);

ALTER TABLE "PurchaseItem"
  ALTER COLUMN "pricePaid" TYPE DECIMAL(12,2) USING "pricePaid"::DECIMAL(12,2),
  ALTER COLUMN "unitPriceNormalized" TYPE DECIMAL(12,4) USING "unitPriceNormalized"::DECIMAL(12,4);

CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
