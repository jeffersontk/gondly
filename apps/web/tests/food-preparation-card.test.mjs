import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { fileURLToPath } from 'node:url';
import utils from '../../../packages/utils/dist/index.js';

test('daily preparation shows the selected ingredients and steps as a Gondly suggestion', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { FoodPreparationCard } = await server.ssrLoadModule('/src/pages/recipes/FoodPreparationCard.tsx');
    const meal = utils.structureFoodMeal({ id: 'lunch', name: 'Almoço', time: '13:00', notes: '', options: [{ id: 'plate', title: 'Prato', text: 'VEGETAIS (pelo menos 150g: pepino, brócolis. Folhas à vontade)\nTemperar com 1 fio de azeite, limão, sal, mostarda ou vinagre.\n1 porção de carboidrato: arroz branco (120g) + feijão (150g) OU batata inglesa (550g)\n1 porção de proteína: frango grelhado (100g) OU tilápia grelhada (170g)' }] });
    const plan = utils.arrangeFoodPlan({ meals: [meal], choices: {} }, '2026-11-23', '2026-11-24');
    const first = utils.buildFoodPreparation(plan.meals[0], plan.choices['2026-11-23'], 0);
    const html = renderToString(createElement(FoodPreparationCard, { recipe: first }));
    assert.match(html, /Arroz branco e feijão com frango grelhado e salada de pepino/);
    assert.match(html, /120g/); assert.match(html, /100g/); assert.match(html, /150g no total/);
    assert.match(html, /Como preparar/); assert.match(html, /pelo Gondly/);
    assert.ok(!html.includes('550g'));
    const second = utils.buildFoodPreparation(plan.meals[0], plan.choices['2026-11-24'], 1);
    const nextHtml = renderToString(createElement(FoodPreparationCard, { recipe: second }));
    assert.match(nextHtml, /Batata inglesa com tilápia grelhada/);
    assert.match(nextHtml, /550g/); assert.ok(!nextHtml.includes('120g'));
  } finally { await server.close(); }
});
