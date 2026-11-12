import test from "node:test";
import assert from "node:assert/strict";
import { calculateRecipePlan, knownBaseAmount } from "../src/recipes/recipe-calculation";
test("recipe planning sums duplicate ingredients before subtracting pantry and scales servings", () => {
  const line = { ingredientId: "tomato", quantity: 100, baseQuantity: 100, unit: "g", optional: false, ingredient: { name: "Tomate", baseUnit: "g" } };
  const plan = calculateRecipePlan([line, line], 2, 4, new Map([["tomato", 150]]));
  assert.equal(plan[0].required, 400); assert.equal(plan[0].missing, 250);
  assert.equal(knownBaseAmount(2, "un", "g", 0.5, "kg"), 1000);
  assert.equal(knownBaseAmount(2, "pacote", "g"), null);
  assert.equal(knownBaseAmount(1, "un", "un", 12, "un"), 12);
});
test("unknown quantities remain explicit and optional ingredients never block planning", () => {
  const line = { ingredientId: "salt", quantity: null, baseQuantity: null, unit: "outro", optional: false, ingredient: { name: "Sal", baseUnit: "g" } };
  assert.equal(calculateRecipePlan([line], 1, 1, new Map())[0].missing, null);
  assert.deepEqual(calculateRecipePlan([{ ...line, optional: true }], 1, 1, new Map()), []);
});
