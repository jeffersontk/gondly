const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateDietSuggestion,
  calculateDietQuantity,
  calculateStepDistanceMeters,
  calculateStepCalories,
  formatStepDistance,
  isStepPeak,
  DIET_DEFINITIONS,
  RESTRICTION_DEFINITIONS,
} = require("../dist/index.js");

describe("V9 - diet planner", () => {
  it("provides definitions for all 6 diet profiles and 8 restrictions", () => {
    assert.equal(DIET_DEFINITIONS.length, 6);
    assert.equal(RESTRICTION_DEFINITIONS.length, 8);
  });

  it("scales quantity proportionally to family size and period", () => {
    // 1 person for 7 days
    const qty1Person = calculateDietQuantity(1.0, 1, 7, "kg");
    assert.equal(qty1Person, 1.0);

    // 4 people for 7 days
    const qty4People = calculateDietQuantity(1.0, 4, 7, "kg");
    assert.equal(qty4People, 4.0);

    // 2 people for 14 days (period 14 days = 2 weeks)
    const qty2PeopleFortnight = calculateDietQuantity(1.0, 2, 14, "kg");
    assert.equal(qty2PeopleFortnight, 4.0);
  });

  it("generates a balanced diet suggestion with clear premises", () => {
    const plan = generateDietSuggestion({
      dietType: "balanced",
      familySize: 3,
      periodDays: 7,
    });

    assert.equal(plan.dietType, "balanced");
    assert.equal(plan.familySize, 3);
    assert.equal(plan.periodDays, 7);
    assert.ok(plan.items.length > 10);
    assert.ok(plan.premises.includes("3 pessoas"));
    assert.ok(plan.premises.includes("7 dias"));
    assert.ok(plan.premises.includes("sem constituir prescrição médica"));
  });

  it("filters out red meat when restriction no_red_meat is enabled", () => {
    const planWithoutRestriction = generateDietSuggestion({
      dietType: "balanced",
      familySize: 2,
      periodDays: 7,
      restrictions: [],
    });
    const hasBeefOriginal = planWithoutRestriction.items.some((i) => i.productName.toLowerCase().includes("patinho"));
    assert.equal(hasBeefOriginal, true);

    const planWithRestriction = generateDietSuggestion({
      dietType: "balanced",
      familySize: 2,
      periodDays: 7,
      restrictions: ["no_red_meat"],
    });
    const hasBeefFiltered = planWithRestriction.items.some((i) => i.productName.toLowerCase().includes("patinho"));
    assert.equal(hasBeefFiltered, false);
  });

  it("filters out dairy and gluten when restrictions are selected", () => {
    const plan = generateDietSuggestion({
      dietType: "balanced",
      familySize: 1,
      periodDays: 7,
      restrictions: ["no_dairy", "no_gluten"],
    });

    const hasMilk = plan.items.some((i) => i.productName.toLowerCase().includes("leite") || i.productName.toLowerCase().includes("queijo"));
    const hasPasta = plan.items.some((i) => i.productName.toLowerCase().includes("macarrão") || i.productName.toLowerCase().includes("pão"));
    assert.equal(hasMilk, false);
    assert.equal(hasPasta, false);
  });

  it("generates vegan diet with plant-based alternatives and no animal products", () => {
    const plan = generateDietSuggestion({
      dietType: "vegan",
      familySize: 2,
      periodDays: 7,
    });

    const hasTofu = plan.items.some((i) => i.productName.toLowerCase().includes("tofu"));
    const hasLentil = plan.items.some((i) => i.productName.toLowerCase().includes("lentilha") || i.productName.toLowerCase().includes("grão-de-bico"));
    assert.equal(hasTofu, true);
    assert.equal(hasLentil, true);
  });
});

describe("V10 - step counter calculations", () => {
  it("calculates distance and formatted labels", () => {
    assert.equal(calculateStepDistanceMeters(0), 0);
    assert.equal(calculateStepDistanceMeters(1000, 0.75), 750);
    assert.equal(formatStepDistance(450), "450 m");
    assert.equal(formatStepDistance(1500), "1,50 km");
  });

  it("calculates estimated calories", () => {
    assert.equal(calculateStepCalories(0), 0);
    assert.equal(calculateStepCalories(1000, 0.04), 40);
  });

  it("detects acceleration peak crossing threshold", () => {
    const gravity = 9.80665;
    const thresholdG = 1.15;
    const thresholdMps2 = thresholdG * gravity;

    // Below threshold -> False
    assert.equal(isStepPeak(10.0, 9.8, thresholdG, gravity), false);

    // Crosses threshold upwards -> True
    assert.equal(isStepPeak(thresholdMps2 + 0.5, thresholdMps2 - 0.2, thresholdG, gravity), true);

    // Stays above threshold -> False (not a new peak cross)
    assert.equal(isStepPeak(thresholdMps2 + 1.0, thresholdMps2 + 0.5, thresholdG, gravity), false);
  });
});

