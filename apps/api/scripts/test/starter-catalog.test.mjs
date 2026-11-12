import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateRecipeCatalog, baseQuantity } from "../recipe-catalog.mjs";

test("starter catalog covers the 45 researched preparations with usable ingredients and truthful publication metadata", async () => {
  const catalog = JSON.parse(await readFile(new URL("../../prisma/recipes/starter.json", import.meta.url), "utf8"));
  const research = JSON.parse(await readFile(new URL("../../../../docs/research/2026-11-11-recipe-shortlist.json", import.meta.url), "utf8"));
  validateRecipeCatalog(catalog);
  assert.equal(catalog.recipes.length, 45);
  assert.equal(new Set(catalog.recipes.map(recipe => recipe.slug)).size, 45);
  const ingredients = new Map(catalog.ingredients.map(ingredient => [ingredient.slug, ingredient]));
  for (const reference of research.recipes) {
    const recipe = catalog.recipes.find(item => item.sourceUrl === reference.sourceUrl);
    assert.ok(recipe, reference.id);
    assert.equal(recipe.visibility, "public");
    assert.equal(recipe.status, "published");
    assert.equal(recipe.origin, "ai_assisted");
    assert.match(recipe.reviewedBy, /Codex/);
    assert.match(recipe.description, /não testada em cozinha/i);
    assert.ok(recipe.steps.length >= 3);
    assert.ok(recipe.ingredients.filter(item => !item.optional).length >= 2);
    assert.equal(recipe.caloriesPerServing, undefined, "Adapted formulations cannot inherit source calories");
    assert.equal(recipe.nutritionSource, undefined);
    for (const line of recipe.ingredients) assert.notEqual(baseQuantity(line, ingredients.get(line.ingredient).baseUnit), null, recipe.slug);
    if (reference.group === "accompaniment" || reference.role === "component") assert.ok(!recipe.tags.some(tag => tag.kind === "meal"), "Components are not standalone calorie-plan meals");
  }
  for (const id of ["base-11", "base-12", "base-14"]) {
    const recipe = catalog.recipes.find(item => item.slug === `gondly-${id}`);
    assert.ok(recipe.ingredients.some(item => item.ingredient === "arroz-branco-cru"));
    assert.ok(recipe.ingredients.some(item => item.ingredient === "feijao-carioca-cru"));
  }
  const stuffed = catalog.recipes.find(item => item.slug === "gondly-base-14");
  assert.ok(stuffed.ingredients.some(item => item.ingredient === "carne-bovina-moida-crua"), "The researched stuffed zucchini contains meat");
});
