import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateRecipeCatalog, baseQuantity } from "../recipe-catalog.mjs";
const fixture = JSON.parse(await readFile(new URL("../../prisma/recipes/example.json", import.meta.url), "utf8"));
test("catalog validates a private draft and normalizes only known unit conversions", () => {
  assert.equal(validateRecipeCatalog(structuredClone(fixture)).recipes.length, 1);
  assert.equal(baseQuantity({ quantity: 0.25, unit: "kg" }, "g"), 250);
  assert.equal(baseQuantity({ quantity: 1.5, unit: "l" }, "ml"), 1500);
  assert.equal(baseQuantity({ quantity: 2, unit: "pacote" }, "g"), null);
  assert.equal(baseQuantity({ quantity: 1, unit: "un" }, "g"), null);
});
test("catalog rejects ambiguous aliases, private publication and client-controlled ownership", () => {
  const alias = structuredClone(fixture); alias.ingredients[1].aliases.push("OVÓS");
  assert.throws(() => validateRecipeCatalog(alias), /ambíguo/);
  const publish = structuredClone(fixture); publish.recipes[0].status = "published";
  assert.throws(() => validateRecipeCatalog(publish), /Publicação/);
  const author = structuredClone(fixture); author.recipes[0].authorId = "someone";
  assert.throws(() => validateRecipeCatalog(author), /desconhecidos/);
});
test("catalog rejects missing ingredients, negative quantities and implicit quantities", () => {
  const missing = structuredClone(fixture); missing.recipes[0].ingredients[0].ingredient = "unknown";
  assert.throws(() => validateRecipeCatalog(missing));
  for (const value of [-1, 0, NaN, Infinity, 0.00001, undefined]) {
    const data = structuredClone(fixture); data.recipes[0].ingredients[0].quantity = value;
    assert.throws(() => validateRecipeCatalog(data));
  }
  const qualitative = structuredClone(fixture); qualitative.recipes[0].ingredients[0].quantity = null;
  assert.throws(() => validateRecipeCatalog(qualitative), /observação/);
  qualitative.recipes[0].ingredients[0].note = "A gosto: quantidade deve ser confirmada.";
  assert.doesNotThrow(() => validateRecipeCatalog(qualitative));
});
