import test from "node:test";
import assert from "node:assert/strict";
import { buildCalorieMenu } from "../src/recipes/calorie-planning";
test("calorie planning uses declared per-serving energy and reports real deviation", () => {
  const recipe = { id: "r", title: "Receita fixture", caloriesPerServing: 300, nutritionSource: "Rótulo de teste", tags: [{ slug: "meal-lunch", kind: "meal" }] };
  const plan = buildCalorieMenu([recipe], 1600, 2, "2026-12-31", [{ meal: "lunch", calories: 1600 }]);
  assert.equal(plan[0].totalCalories, 1200);
  assert.equal(plan[0].difference, -400);
  assert.equal(plan[1].date, "2027-01-01");
  assert.throws(() => buildCalorieMenu([{ ...recipe, caloriesPerServing: null }], 1600, 1, "2026-11-11", [{ meal: "lunch", calories: 1600 }]));
  assert.throws(() => buildCalorieMenu([recipe], 1600, 1, "2026-11-11", [{ meal: "lunch", calories: 800 }]));
});
