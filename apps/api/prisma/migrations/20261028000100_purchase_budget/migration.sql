ALTER TABLE "Purchase" ADD COLUMN "budgetAmount" DECIMAL(12,2);
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_budgetAmount_nonnegative" CHECK ("budgetAmount" IS NULL OR "budgetAmount" >= 0);
