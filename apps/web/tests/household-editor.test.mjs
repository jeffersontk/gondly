import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { fileURLToPath } from "node:url";
test("household editor exposes optional demographics, relative portions and separate meal frequencies", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { HouseholdMembersEditor } = await server.ssrLoadModule("/src/pages/lists/HouseholdMembersEditor.tsx");
    const members = [{ ageBand: "not_informed", gender: "not_informed", portion: "medium", mealsPerWeek: { breakfast: 7, lunch: 3, dinner: 7, snack: 0 } }];
    const html = renderToString(createElement(HouseholdMembersEditor, { members, onChange: () => {} })).replace(/<!--[\s\S]*?-->/g, "");
    assert.ok(html.includes("Pessoa 1"));
    assert.ok(html.includes("Prefiro não informar"));
    assert.ok(html.includes("3 dias"));
    assert.ok(html.includes("Porção habitual"));
    assert.ok(!html.includes('type="date"'));
    const reference = renderToString(createElement(HouseholdMembersEditor, { members: [{ ...members[0], portionMode: "reference", biologicalSex: "male", ageYears: 35, activityLevel: "moderate" }], onChange: () => {} })).replace(/<!--[\s\S]*?-->/g, "");
    assert.ok(reference.includes("Sexo para a referência"));
    assert.ok(reference.includes("Atividade habitual"));
    assert.ok(reference.includes("1,3×"));
    assert.ok(reference.includes("tabela A2-2"));
    assert.ok(!reference.includes("Porção habitual<select"));
  } finally { await server.close(); }
});
