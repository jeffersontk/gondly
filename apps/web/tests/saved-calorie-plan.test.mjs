import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { fileURLToPath } from "node:url";
test("saved meal plans show actual snapshot totals, target difference and links without treating missing energy as zero", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { SavedCaloriePlan } = await server.ssrLoadModule("/src/pages/recipes/SavedCaloriePlan.tsx");
    const meals = ["breakfast", "lunch", "dinner", "snack"].map(meal => ({ recipeId: "fixture", date: "2026-11-11T00:00:00Z", meal, servings: "1", plannedCalories: "400", titleSnapshot: "Receita de teste" }));
    const plan = { id: "plan", name: "Cardápio de teste", shoppingListId: "list", dailyCalorieTarget: "1600", recipes: meals };
    const render = data => renderToString(createElement(MemoryRouter, {}, createElement(SavedCaloriePlan, { plan: data }))).replace(/<!--[\s\S]*?-->/g, "");
    const html = render(plan);
    assert.ok(html.includes("1.600 kcal"));
    assert.ok(html.includes("Diferença: 0 kcal"));
    assert.ok(html.includes("/app/lists/list"));
    assert.ok(html.includes("/app/recipes/fixture"));
    assert.ok(render({ ...plan, recipes: [{ ...meals[0], plannedCalories: null }] }).includes("Total não disponível"));
  } finally { await server.close(); }
});
