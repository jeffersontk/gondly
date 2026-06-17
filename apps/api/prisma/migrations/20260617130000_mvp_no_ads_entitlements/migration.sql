-- CreateEnum
CREATE TYPE "EntitlementKey" AS ENUM ('no_ads');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('one_time_purchase', 'manual', 'promo');

-- CreateEnum
CREATE TYPE "OneTimePurchaseType" AS ENUM ('remove_ads');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('mercado_pago', 'manual');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'expired');

-- CreateTable
CREATE TABLE "UserEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" "EntitlementKey" NOT NULL,
    "source" "EntitlementSource" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "OneTimePurchaseType" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerPreferenceId" TEXT,
    "providerPaymentId" TEXT,
    "providerExternalReference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneTimePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEntitlement_userId_key_key" ON "UserEntitlement"("userId", "key");

-- CreateIndex
CREATE INDEX "UserEntitlement_userId_active_idx" ON "UserEntitlement"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "OneTimePurchase_providerExternalReference_key" ON "OneTimePurchase"("providerExternalReference");

-- CreateIndex
CREATE INDEX "OneTimePurchase_userId_status_idx" ON "OneTimePurchase"("userId", "status");

-- CreateIndex
CREATE INDEX "OneTimePurchase_providerPaymentId_idx" ON "OneTimePurchase"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "AppConfig_key_key" ON "AppConfig"("key");

-- AddForeignKey
ALTER TABLE "UserEntitlement" ADD CONSTRAINT "UserEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneTimePurchase" ADD CONSTRAINT "OneTimePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- InitialConfig
INSERT INTO "AppConfig" ("id", "key", "value", "createdAt", "updatedAt")
VALUES
  ('appconfig_' || md5(random()::text || clock_timestamp()::text), 'REMOVE_ADS_PRICE', '19.90', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('appconfig_' || md5(random()::text || clock_timestamp()::text), 'REMOVE_ADS_CURRENCY', 'BRL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
