CREATE INDEX "Product_userId_barcode_idx" ON "Product"("userId", "barcode");

CREATE UNIQUE INDEX "Product_userId_barcode_active_key"
  ON "Product"("userId", "barcode")
  WHERE "barcode" IS NOT NULL AND "deletedAt" IS NULL;
