-- CreateTable
CREATE TABLE "ListMessage" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListMessage_listId_createdAt_idx" ON "ListMessage"("listId", "createdAt");

-- AddForeignKey
ALTER TABLE "ListMessage" ADD CONSTRAINT "ListMessage_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MarketList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListMessage" ADD CONSTRAINT "ListMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
