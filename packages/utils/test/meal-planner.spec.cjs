const test = require("node:test");
const assert = require("node:assert/strict");
const { generateDietSuggestion } = require("../dist/index.js");
const base = { dietType: "balanced", familySize: 2, periodDays: 7 };
test("breakfast-only plans exclude main-meal staples and retain breakfast products", () => {
  const plan = generateDietSuggestion({ ...base, mealsAtHome: ["breakfast"] });
  assert.ok(plan.items.length > 0);
  assert.ok(!plan.items.some(item => /arroz|feijão|frango/i.test(item.productName)));
  assert.ok(plan.items.some(item => /pão|leite|aveia/i.test(item.productName)));
});
test("one main meal scales compatible staples without changing legacy full-day plans", () => {
  const full = generateDietSuggestion(base);
  const all = generateDietSuggestion({ ...base, mealsAtHome: ["breakfast", "lunch", "dinner", "snack"] });
  assert.deepEqual(all.items, full.items);
  const lunch = generateDietSuggestion({ ...base, mealsAtHome: ["lunch"] });
  const rice = items => items.find(item => /arroz/i.test(item.productName)).suggestedQuantity;
  assert.ok(rice(lunch.items) < rice(full.items));
  assert.throws(() => generateDietSuggestion({ ...base, mealsAtHome: [] }));
});
