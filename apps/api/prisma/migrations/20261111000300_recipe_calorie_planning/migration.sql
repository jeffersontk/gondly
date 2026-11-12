-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "caloriesPerServing" DECIMAL(10,2),
ADD COLUMN     "nutritionSource" TEXT;

-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN     "dailyCalorieTarget" DECIMAL(10,2),
ADD COLUMN     "shoppingListId" TEXT;

-- AlterTable
ALTER TABLE "MealPlanRecipe" ADD COLUMN     "plannedCalories" DECIMAL(10,2),
ADD COLUMN     "titleSnapshot" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MealPlan_shoppingListId_key" ON "MealPlan"("shoppingListId");

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "MarketList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
