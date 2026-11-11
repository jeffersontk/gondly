-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('draft', 'pending_review', 'published', 'archived');

-- CreateEnum
CREATE TYPE "RecipeOrigin" AS ENUM ('original', 'imported', 'ai_assisted', 'user_created');

-- CreateEnum
CREATE TYPE "RecipeVisibility" AS ENUM ('private', 'unlisted', 'public');

-- CreateEnum
CREATE TYPE "RecipeReviewStatus" AS ENUM ('pending', 'published', 'hidden');

-- CreateEnum
CREATE TYPE "RecipeTagKind" AS ENUM ('diet', 'allergen', 'meal');

-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "PantryMovementKind" AS ENUM ('entry', 'consumption', 'adjustment');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ingredientId" TEXT;

-- AlterTable
ALTER TABLE "MarketListItem" ADD COLUMN     "ingredientId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "ingredientId" TEXT;

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "baseUnit" "Unit" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientAlias" (
    "id" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,

    CONSTRAINT "IngredientAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "visibility" "RecipeVisibility" NOT NULL DEFAULT 'private',
    "shareToken" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "servings" DECIMAL(12,3) NOT NULL,
    "prepMinutes" INTEGER NOT NULL,
    "cookMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "RecipeStatus" NOT NULL DEFAULT 'draft',
    "origin" "RecipeOrigin" NOT NULL DEFAULT 'original',
    "sourceUrl" TEXT,
    "attribution" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeReview" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "RecipeReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "quantity" DECIMAL(12,3),
    "unit" "Unit" NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "baseQuantity" DECIMAL(12,3),

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RecipeTagKind" NOT NULL,

    CONSTRAINT "RecipeTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryMovement" (
    "id" TEXT NOT NULL,
    "pantryItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PantryMovementKind" NOT NULL,
    "quantityDelta" DECIMAL(12,3) NOT NULL,
    "sourcePurchaseItemId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PantryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanRecipe" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal" "MealSlot" NOT NULL,
    "servings" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "MealPlanRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RecipeToRecipeTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RecipeToRecipeTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_slug_key" ON "Ingredient"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientAlias_normalizedName_key" ON "IngredientAlias"("normalizedName");

-- CreateIndex
CREATE INDEX "IngredientAlias_ingredientId_idx" ON "IngredientAlias"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_shareToken_key" ON "Recipe"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "Recipe_status_publishedAt_idx" ON "Recipe"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Recipe_authorId_status_idx" ON "Recipe"("authorId", "status");

-- CreateIndex
CREATE INDEX "Recipe_visibility_status_idx" ON "Recipe"("visibility", "status");

-- CreateIndex
CREATE INDEX "RecipeReview_recipeId_status_createdAt_idx" ON "RecipeReview"("recipeId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeReview_recipeId_userId_key" ON "RecipeReview"("recipeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStep_recipeId_position_key" ON "RecipeStep"("recipeId", "position");

-- CreateIndex
CREATE INDEX "RecipeIngredient_ingredientId_idx" ON "RecipeIngredient"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_position_key" ON "RecipeIngredient"("recipeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeTag_slug_key" ON "RecipeTag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PantryItem_userId_ingredientId_key" ON "PantryItem"("userId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "PantryItem_id_userId_key" ON "PantryItem"("id", "userId");

-- CreateIndex
CREATE INDEX "PantryMovement_pantryItemId_createdAt_idx" ON "PantryMovement"("pantryItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PantryMovement_userId_sourcePurchaseItemId_key" ON "PantryMovement"("userId", "sourcePurchaseItemId");

-- CreateIndex
CREATE INDEX "MealPlan_userId_startDate_idx" ON "MealPlan"("userId", "startDate");

-- CreateIndex
CREATE INDEX "MealPlanRecipe_recipeId_idx" ON "MealPlanRecipe"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanRecipe_mealPlanId_date_meal_recipeId_key" ON "MealPlanRecipe"("mealPlanId", "date", "meal", "recipeId");

-- CreateIndex
CREATE INDEX "_RecipeToRecipeTag_B_index" ON "_RecipeToRecipeTag"("B");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListItem" ADD CONSTRAINT "MarketListItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeReview" ADD CONSTRAINT "RecipeReview_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeReview" ADD CONSTRAINT "RecipeReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryMovement" ADD CONSTRAINT "PantryMovement_pantryItemId_userId_fkey" FOREIGN KEY ("pantryItemId", "userId") REFERENCES "PantryItem"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryMovement" ADD CONSTRAINT "PantryMovement_sourcePurchaseItemId_fkey" FOREIGN KEY ("sourcePurchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanRecipe" ADD CONSTRAINT "MealPlanRecipe_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanRecipe" ADD CONSTRAINT "MealPlanRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeToRecipeTag" ADD CONSTRAINT "_RecipeToRecipeTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeToRecipeTag" ADD CONSTRAINT "_RecipeToRecipeTag_B_fkey" FOREIGN KEY ("B") REFERENCES "RecipeTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guard quantities and editorial visibility at the storage boundary.
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_baseUnit_check" CHECK ("baseUnit" IN ('g', 'ml', 'un'));
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_amounts_check" CHECK ("servings" > 0 AND "prepMinutes" >= 0 AND "cookMinutes" >= 0);
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_publication_check" CHECK (
  ("visibility" = 'private' OR "status" = 'published') AND
  ("status" <> 'published' OR ("publishedAt" IS NOT NULL AND "reviewedAt" IS NOT NULL AND length(trim("reviewedBy")) > 0 AND "reviewedBy" IS NOT NULL)) AND
  ("visibility" <> 'unlisted' OR "shareToken" IS NOT NULL)
);
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_position_check" CHECK ("position" > 0 AND length(trim("instruction")) > 0);
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_amount_check" CHECK (
  "position" > 0 AND ("quantity" IS NULL OR "quantity" > 0) AND ("baseQuantity" IS NULL OR "baseQuantity" > 0) AND
  ("quantity" IS NOT NULL OR ("baseQuantity" IS NULL AND "note" IS NOT NULL AND length(trim("note")) > 0))
);
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_quantity_check" CHECK ("quantity" >= 0);
ALTER TABLE "PantryMovement" ADD CONSTRAINT "PantryMovement_delta_check" CHECK (
  ("kind" = 'entry' AND "quantityDelta" > 0) OR
  ("kind" = 'consumption' AND "quantityDelta" < 0) OR
  ("kind" = 'adjustment' AND "quantityDelta" <> 0)
);
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_dates_check" CHECK ("endDate" >= "startDate");
ALTER TABLE "MealPlanRecipe" ADD CONSTRAINT "MealPlanRecipe_servings_check" CHECK ("servings" > 0);
ALTER TABLE "RecipeReview" ADD CONSTRAINT "RecipeReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5 AND ("comment" IS NULL OR length("comment") <= 2000));

CREATE INDEX "Product_ingredientId_idx" ON "Product"("ingredientId");
CREATE INDEX "MarketListItem_ingredientId_idx" ON "MarketListItem"("ingredientId");
CREATE INDEX "PurchaseItem_ingredientId_idx" ON "PurchaseItem"("ingredientId");
