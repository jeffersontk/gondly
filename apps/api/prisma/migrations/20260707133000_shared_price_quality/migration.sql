CREATE TYPE "SharedPriceStatus" AS ENUM ('valid', 'suspected', 'ignored', 'user_reported');

CREATE TYPE "SharedPriceReportReason" AS ENUM ('wrong_price', 'wrong_product', 'wrong_market', 'wrong_brand', 'wrong_unit', 'other');

ALTER TABLE "SharedPriceRecord"
  ADD COLUMN "status" "SharedPriceStatus" NOT NULL DEFAULT 'valid',
  ADD COLUMN "qualityReason" TEXT;

CREATE TABLE "SharedPriceReport" (
  "id" TEXT NOT NULL,
  "sharedPriceRecordId" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "reason" "SharedPriceReportReason" NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SharedPriceReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SharedPriceReport_sharedPriceRecordId_reporterUserId_key" ON "SharedPriceReport"("sharedPriceRecordId", "reporterUserId");
CREATE INDEX "SharedPriceReport_sharedPriceRecordId_idx" ON "SharedPriceReport"("sharedPriceRecordId");
CREATE INDEX "SharedPriceReport_reporterUserId_idx" ON "SharedPriceReport"("reporterUserId");
CREATE INDEX "SharedPriceReport_reason_idx" ON "SharedPriceReport"("reason");
CREATE INDEX "SharedPriceRecord_status_visibility_purchasedAt_idx" ON "SharedPriceRecord"("status", "visibility", "purchasedAt");

ALTER TABLE "SharedPriceReport"
  ADD CONSTRAINT "SharedPriceReport_sharedPriceRecordId_fkey" FOREIGN KEY ("sharedPriceRecordId") REFERENCES "SharedPriceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SharedPriceReport"
  ADD CONSTRAINT "SharedPriceReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
