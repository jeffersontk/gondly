ALTER TABLE "Purchase" ADD COLUMN "stepCount" INTEGER;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_stepCount_nonnegative" CHECK ("stepCount" IS NULL OR "stepCount" >= 0);

