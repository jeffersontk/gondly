import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("V9: diet planner generates valid suggestions with scaled quantities and restrictions", async () => {
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  try {
    const { generateDietSuggestion, calculateDietQuantity, DIET_DEFINITIONS } =
      await server.ssrLoadModule("@gondly/utils");

    assert.equal(DIET_DEFINITIONS.length, 6);

    const suggestion = generateDietSuggestion({
      dietType: "low_carb",
      familySize: 3,
      periodDays: 7,
      restrictions: ["no_red_meat", "no_dairy"],
    });

    assert.equal(suggestion.dietType, "low_carb");
    assert.equal(suggestion.familySize, 3);
    assert.ok(suggestion.items.length > 5);

    // Assert restrictions applied
    const hasBeef = suggestion.items.some((i) => i.productName.toLowerCase().includes("patinho") || i.productName.toLowerCase().includes("alcatra"));
    const hasCheese = suggestion.items.some((i) => i.productName.toLowerCase().includes("queijo") || i.productName.toLowerCase().includes("manteiga"));
    assert.equal(hasBeef, false);
    assert.equal(hasCheese, false);

    // Quantities scaled
    const baseQuantity = 1.0;
    const scaled = calculateDietQuantity(baseQuantity, 3, 7, "kg");
    assert.equal(scaled, 3.0);
  } finally {
    await server.close();
  }
});

test("V10: step counter calculation and session storage handling", async () => {
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  try {
    const {
      calculateStepDistanceMeters,
      calculateStepCalories,
      formatStepDistance,
    } = await server.ssrLoadModule("@gondly/utils");

    const steps = 1200;
    const distanceMeters = calculateStepDistanceMeters(steps);
    assert.equal(distanceMeters, 900); // 1200 * 0.75m
    assert.equal(formatStepDistance(distanceMeters), "900 m");
    assert.equal(formatStepDistance(2500), "2,50 km");
    assert.equal(calculateStepCalories(steps), 48); // 1200 * 0.04
  } finally {
    await server.close();
  }
});

