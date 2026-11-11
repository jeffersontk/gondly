import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { importRecipeCatalog } from "../scripts/recipe-catalog.mjs";

test("recipe schema: transactional import, ownership, ratings and confirmed pantry on local Postgres", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "http://missing");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && ["15432", "55432"].includes(url.port), "Define an explicit local development database; never production.");
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const data = JSON.parse(await readFile(new URL("../prisma/recipes/example.json", import.meta.url), "utf8"));
  const slugMap = new Map(data.ingredients.map(item => [item.slug, `${item.slug}-${suffix}`]));
  for (const item of data.ingredients) { item.slug = slugMap.get(item.slug); item.name += ` ${suffix}`; item.aliases = []; }
  data.recipes[0].slug += `-${suffix}`;
  data.recipes[0].tags = [];
  for (const item of data.recipes[0].ingredients) item.ingredient = slugMap.get(item.ingredient);
  let user1, user2, recipe;
  try {
    await importRecipeCatalog(prisma, data);
    recipe = await prisma.recipe.findUniqueOrThrow({ where: { slug: data.recipes[0].slug } });
    assert.equal(recipe.status, "draft");
    assert.equal(recipe.visibility, "private");
    await importRecipeCatalog(prisma, data);
    assert.equal(await prisma.recipeIngredient.count({ where: { recipeId: recipe.id } }), 2);
    assert.equal(await prisma.recipeStep.count({ where: { recipeId: recipe.id } }), 1);
    const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { slug: data.ingredients[0].slug } });
    const unitChange = structuredClone(data); unitChange.ingredients[0].baseUnit = "g";
    await assert.rejects(importRecipeCatalog(prisma, unitChange), /unidade-base/);
    const collision = structuredClone(data);
    collision.ingredients[0].name = "modified but rolled back";
    collision.ingredients[1].aliases = [data.ingredients[0].name];
    await assert.rejects(importRecipeCatalog(prisma, collision), /Alias/);
    assert.equal((await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredient.id } })).name, data.ingredients[0].name);
    user1 = await prisma.user.create({ data: { name: "Recipe test owner", email: `recipe-owner-${suffix}@example.invalid` } });
    user2 = await prisma.user.create({ data: { name: "Recipe test reader", email: `recipe-reader-${suffix}@example.invalid` } });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { authorId: user1.id, origin: "user_created" } });
    await assert.rejects(importRecipeCatalog(prisma, data), /usuários/);
    await assert.rejects(prisma.recipe.update({ where: { id: recipe.id }, data: { visibility: "public" } }));
    await assert.rejects(prisma.recipeReview.create({ data: { recipeId: recipe.id, userId: user2.id, rating: 6 } }));
    const review = await prisma.recipeReview.create({ data: { recipeId: recipe.id, userId: user2.id, rating: 4 } });
    assert.equal(review.status, "pending");
    await assert.rejects(prisma.recipeReview.create({ data: { recipeId: recipe.id, userId: user2.id, rating: 5 } }));
    await assert.rejects(prisma.pantryItem.create({ data: { userId: user1.id, ingredientId: ingredient.id, quantity: -1 } }));
    const pantry = await prisma.pantryItem.create({ data: { userId: user1.id, ingredientId: ingredient.id, quantity: 2 } });
    await assert.rejects(prisma.pantryMovement.create({ data: { pantryItemId: pantry.id, userId: user2.id, kind: "entry", quantityDelta: 1 } }));
    const purchase = await prisma.purchase.create({ data: { userId: user1.id, status: "completed", items: { create: { productName: "Fixture eggs", quantity: 2, unit: "un", pricePaid: 10, ingredientId: ingredient.id } } }, include: { items: true } });
    assert.equal(await prisma.pantryMovement.count({ where: { pantryItemId: pantry.id } }), 0, "Purchases never become confirmed stock automatically.");
    const entry = { pantryItemId: pantry.id, userId: user1.id, kind: "entry", quantityDelta: 2, sourcePurchaseItemId: purchase.items[0].id };
    await prisma.pantryMovement.create({ data: entry });
    await assert.rejects(prisma.pantryMovement.create({ data: entry }));
    await assert.rejects(prisma.pantryMovement.create({ data: { pantryItemId: pantry.id, userId: user1.id, kind: "consumption", quantityDelta: 1 } }));
  } finally {
    if (recipe) await prisma.recipe.deleteMany({ where: { id: recipe.id } });
    await prisma.user.deleteMany({ where: { id: { in: [user1?.id, user2?.id].filter(Boolean) } } });
    await prisma.ingredient.deleteMany({ where: { slug: { in: data.ingredients.map(item => item.slug) } } });
    await prisma.$disconnect();
  }
});
