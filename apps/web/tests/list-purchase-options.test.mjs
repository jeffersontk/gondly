import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("purchase options offer two radios, preserve legacy decisions and accept fractional weight", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { ListPurchaseOptions } = await server.ssrLoadModule("/src/pages/lists/ListPurchaseOptions.tsx");
    const { parsePurchaseQuantity, purchaseDecision } = await server.ssrLoadModule("/src/pages/lists/purchaseQuantity.ts");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const item = { id: "item-1", productName: "Arroz", expectedQuantity: 1.5, unit: "kg", status: "pending" };
    const render = status => renderToStaticMarkup(createElement(ListPurchaseOptions, { item: { ...item, status }, onChangeStatus: async () => {}, onSaveQuantity: async () => {} }));
    const html = render("pending");
    assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
    assert.match(html, /Comprar/);
    assert.match(html, /Não precisa comprar este mês/);
    assert.doesNotMatch(html, /Tenho em casa|Não tenho em casa/);
    assert.match(html, /Quantidade a comprar/);
    assert.match(html, /value="1.5"/);
    assert.match(html, /value="kg" selected/);
    for (const status of ["at_home", "not_needed"]) {
      assert.doesNotMatch(render(status), /Quantidade a comprar/);
      assert.match(render(status), /checked="" value="not_needed"/);
    }
    assert.equal(purchaseDecision("at_home"), "not_needed");
    assert.equal(parsePurchaseQuantity("0,75"), 0.75);
    assert.equal(parsePurchaseQuantity("2"), 2);
    for (const value of ["", "0", "-1", "abc", "Infinity", "1,2,3"]) assert.equal(parsePurchaseQuantity(value), null);
  } finally { await server.close(); }
});
