const test = require("node:test");
const assert = require("node:assert/strict");
const utils = require("../dist/index.js");
const member = changes => ({ ...utils.defaultHouseholdMember(), biologicalSex: "male", ageYears: 35, activityLevel: "sedentary", portionMode: "reference", ...changes });
test("adult reference follows verified sex, age and activity rows", () => {
  assert.equal(utils.householdPortion(member()).referenceKcal, 2400);
  assert.equal(utils.householdPortion(member({ biologicalSex: "female" })).referenceKcal, 1800);
  assert.equal(utils.householdPortion(member({ ageYears: 60, activityLevel: "active" })).referenceKcal, 2600);
  assert.equal(utils.householdPortion(member({ ageYears: 61, activityLevel: "moderate" })).referenceKcal, 2400);
  assert.equal(utils.householdPortion(member({ ageYears: 76, activityLevel: "active" })).referenceKcal, 2400);
  assert.equal(utils.householdPortion(member({ ageYears: 18, activityLevel: "active" })).referenceKcal, 3200);
  assert.equal(utils.householdPortion(member({ biologicalSex: "female", ageYears: 26, activityLevel: "active" })).referenceKcal, 2400);
  assert.equal(utils.householdPortion(member({ biologicalSex: "female", ageYears: 35, activityLevel: "active" })).referenceKcal, 2200);
  assert.equal(utils.householdPortion(member({ biologicalSex: "female", ageYears: 61, activityLevel: "active" })).referenceKcal, 2000);
});
test("manual portion overrides reference and gender never supplies biological sex", () => {
  assert.equal(utils.householdPortion(member({ portionMode: "manual", portion: "small" })).multiplier, 0.75);
  assert.equal(utils.householdPortion(utils.defaultHouseholdMember()).multiplier, 1);
  assert.equal(utils.householdPortion(member({ biologicalSex: "not_informed", gender: "man" })).multiplier, null);
  assert.equal(utils.householdPortion(member({ ageYears: 17 })).multiplier, null);
  assert.equal(utils.householdPortion(member({ activityLevel: "not_informed" })).multiplier, null);
});
test("generator uses adult reference only when explicitly chosen and rejects incomplete references", () => {
  const base = { dietType: "balanced", familySize: 1, periodDays: 7 };
  const rice = person => utils.generateDietSuggestion({ ...base, householdMembers: [person] }).items.find(item => /arroz/i.test(item.productName)).suggestedQuantity;
  assert.ok(rice(member()) > rice(member({ biologicalSex: "female" })));
  assert.equal(rice(member({ portionMode: "manual", portion: "small" })), rice(member({ biologicalSex: "female", ageYears: 80, portionMode: "manual", portion: "small" })));
  assert.throws(() => rice(member({ biologicalSex: "not_informed" })));
  const profile = { version: 1, members: [member()], periodDays: 7, dietType: "balanced", restrictions: [] };
  assert.equal(utils.validateHouseholdProfile(profile).members[0].ageYears, 35);
  for (const ageYears of [NaN, -1, 121, 35.5, "35"]) assert.throws(() => utils.validateHouseholdProfile({ ...profile, members: [member({ ageYears })] }));
  assert.throws(() => utils.validateHouseholdProfile({ ...profile, members: [member({ ageBand: "60_plus", ageYears: 35 })] }));
});
