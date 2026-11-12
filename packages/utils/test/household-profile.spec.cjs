const test = require("node:test");
const assert = require("node:assert/strict");
const { defaultHouseholdMember, validateHouseholdProfile, generateDietSuggestion } = require("../dist/index.js");
const profile = () => ({ version: 1, members: [defaultHouseholdMember()], periodDays: 7, dietType: "balanced", restrictions: [] });
test("household profiles validate frequencies and reject ownership fields and invalid ages", () => {
  assert.equal(validateHouseholdProfile(profile()).members.length, 1);
  const days = profile(); days.members[0].mealsPerWeek.lunch = 8;
  assert.throws(() => validateHouseholdProfile(days));
  assert.throws(() => validateHouseholdProfile({ ...profile(), userId: "someone" }));
  const age = profile(); age.members[0].ageBand = "made_up";
  assert.throws(() => validateHouseholdProfile(age));
});
test("user-chosen portions and actual meals scale quantities, never gender or age", () => {
  const base = { dietType: "balanced", familySize: 1, periodDays: 7 };
  const person = defaultHouseholdMember();
  const rice = p => generateDietSuggestion({ ...base, householdMembers: [p] }).items.find(item => /arroz/i.test(item.productName)).suggestedQuantity;
  assert.equal(rice(person), rice({ ...person, gender: "woman", ageBand: "60_plus" }));
  assert.ok(rice({ ...person, mealsPerWeek: { breakfast: 0, lunch: 3, dinner: 0, snack: 0 } }) < rice(person));
  assert.ok(rice({ ...person, portion: "small" }) < rice({ ...person, portion: "large" }));
  assert.equal(generateDietSuggestion({ ...base, householdMembers: [{ ...person, mealsPerWeek: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 } }] }).items.length, 0);
});
