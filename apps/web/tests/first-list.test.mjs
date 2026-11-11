import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
test("first-list invitation offers both generation and dismissal without requiring storage", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { FirstListWelcome } = await server.ssrLoadModule("/src/pages/lists/FirstListWelcome.tsx");
    const html = renderToString(createElement(MemoryRouter, {}, createElement(FirstListWelcome, { userId: "new-user" })));
    assert.ok(html.includes("Gerar minha lista"));
    assert.ok(html.includes("Fazer depois"));
    assert.ok(html.includes("/app/lists/diet-plan?source=welcome"));
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    try {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: key => key === "gondly.firstList.dismissed.new-user" ? "true" : null } });
      const render = userId => renderToString(createElement(MemoryRouter, {}, createElement(FirstListWelcome, { userId })));
      assert.ok(!render("new-user").includes("Gerar minha lista"));
      assert.ok(render("another-user").includes("Gerar minha lista"));
    } finally {
      if (previous) Object.defineProperty(globalThis, "localStorage", previous);
      else delete globalThis.localStorage;
    }
  } finally { await server.close(); }
});
