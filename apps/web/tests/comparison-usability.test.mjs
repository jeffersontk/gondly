import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("comparison filters combine category, brand and search, and range highlights use comparable prices", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { filterComparisonProducts, comparisonCategories, priceRangeVariation } = await server.ssrLoadModule("/src/pages/compare/comparisonPresentation.ts");
    const items = [
      { productName: "Arroz", category: " Mercearia ", brandName: "Marca A" },
      { productName: "Feijão", category: "Mercearia", brandName: "Marca B" },
      { productName: "Cotonete", category: "Higiene pessoal", brandName: "Marca A" },
      { productName: "Outro", category: null },
    ];
    assert.deepEqual(comparisonCategories(items), ["Higiene pessoal", "Mercearia", "Sem categoria"]);
    assert.deepEqual(filterComparisonProducts(items, { category: "Mercearia", search: "arroz", brandName: "Marca A" }).map(x => x.productName), ["Arroz"]);
    assert.equal(filterComparisonProducts(items, { category: "Higiene pessoal", search: "feijão" }).length, 0);
    assert.deepEqual(filterComparisonProducts(items, { category: "Sem categoria" }).map(x => x.productName), ["Outro"]);
    assert.equal(filterComparisonProducts(items, {}).length, 4);
    assert.deepEqual(comparisonCategories([{ productName: "Leite", categoryName: "Laticínios" }]), ["Laticínios"]);
    assert.deepEqual(priceRangeVariation(10, 12), { difference: 2, percentage: 20 });
    assert.deepEqual(priceRangeVariation(1.79, 1.79), { difference: 0, percentage: 0 });
    assert.equal(priceRangeVariation(null, 12), null);
    assert.equal(priceRangeVariation(12, 10), null);
    assert.deepEqual(priceRangeVariation(0, 10), { difference: 10, percentage: null });
    assert.equal(priceRangeVariation(1.79, 1.79000001).difference, 0);

    const { ComparisonCategoryFilter, ComparisonResultsCount, PriceVariationBadge } = await server.ssrLoadModule("/src/pages/compare/ComparisonControls.tsx");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const category = renderToStaticMarkup(createElement(ComparisonCategoryFilter, { categories: comparisonCategories(items), selected: "Mercearia", onChange() {} }));
    assert.match(category, /Todas as categorias/);
    assert.match(category, /value="Mercearia" selected/);
    assert.match(category, /Limpar filtro de categoria/);
    assert.match(renderToStaticMarkup(createElement(ComparisonResultsCount, { count: 40, visible: 12 })), /Exibindo 12 de 40 produtos/);
    const variation = renderToStaticMarkup(createElement(PriceVariationBadge, { min: 10, max: 12, purchasesCount: 2 }));
    assert.match(variation, /2,00/);
    assert.match(variation, /20%/);
    assert.match(variation, /Diferença entre o menor e o maior preço/);
    assert.match(renderToStaticMarkup(createElement(PriceVariationBadge, { min: 10, max: 10, purchasesCount: 1 })), /Um preço registrado/);
    assert.match(renderToStaticMarkup(createElement(PriceVariationBadge, { min: 10, max: 10, purchasesCount: 2 })), /Sem variação no período/);
  } finally { await server.close(); }
});
