CREATE TABLE "ListReplenishment" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "listId" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT true, "intervalDays" INTEGER NOT NULL DEFAULT 7,
 "nextReminderAt" TIMESTAMP(3) NOT NULL, "quietStart" INTEGER NOT NULL DEFAULT 23,
 "quietEnd" INTEGER NOT NULL DEFAULT 7, "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
 "dismissedKeys" TEXT[] DEFAULT ARRAY[]::TEXT[], "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ListReplenishment_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ListReplenishment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ListReplenishment_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MarketList"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ListReplenishment_userId_listId_key" ON "ListReplenishment"("userId", "listId");
CREATE INDEX "ListReplenishment_enabled_nextReminderAt_idx" ON "ListReplenishment"("enabled", "nextReminderAt");