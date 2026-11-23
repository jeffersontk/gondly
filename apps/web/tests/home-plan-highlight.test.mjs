import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

test('home highlights valid plans and uses the local date and prescribed meal times', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const home = await server.transformRequest('/src/pages/HomePage.tsx');
    assert.match(home.code, /import.*HomeMealPlanCard.*HomeMealPlanCard\.tsx/);
    assert.ok(!home.code.includes('/HomePlanHighlight.ts'));
    const card = await server.transformRequest('/src/pages/recipes/HomeMealPlanCard.tsx');
    assert.match(card.code, /export function HomeMealPlanCard/);
    const { activePlanForDate, highlightForPlan } = await server.ssrLoadModule('/src/pages/recipes/meal-highlight.ts');
    const summaries = [{ id: 'future', startDate: '2026-12-01', endDate: '2026-12-07' }, { id: 'active', startDate: '2026-11-23', endDate: '2026-11-29' }, { id: 'expired', startDate: '2026-11-01', endDate: '2026-11-10' }];
    assert.equal(activePlanForDate(summaries, '2026-11-23').id, 'active');
    assert.equal(activePlanForDate(summaries, '2026-11-30'), undefined);
    const meal = (id, name, time, title) => ({ id, name, time, notes: '', options: [{ id: 'option', title, text: title }] });
    const plan = { id: 'active', name: 'Meu plano', startDate: '2026-11-23T00:00:00Z', endDate: '2026-11-29T00:00:00Z', recipes: [], importedPlan: { meals: [meal('breakfast', 'Café da manhã', '09:00', 'Pão com ovo'), meal('lunch', 'Almoço', '13:00', 'Arroz e frango'), meal('snack', 'Lanche', '17:00', 'Fruta'), meal('dinner', 'Jantar', '22:00', 'Macarrão')], choices: { '2026-11-23': { breakfast: 'option', lunch: 'option', snack: 'option', dinner: 'option' } } } };
    const morning = highlightForPlan(plan, new Date(2026, 10, 23, 8, 30));
    assert.equal(morning.name, 'Café da manhã'); assert.equal(morning.upcoming, true);
    assert.equal(morning.title, 'Pão com ovo');
    assert.match(morning.href, /plan=active/); assert.match(morning.href, /date=2026-11-23/); assert.match(morning.href, /meal=breakfast/);
    assert.equal(highlightForPlan(plan, new Date(2026, 10, 23, 14)).name, 'Almoço');
    assert.equal(highlightForPlan(plan, new Date(2026, 10, 23, 17)).name, 'Lanche');
    assert.equal(highlightForPlan(plan, new Date(2026, 10, 23, 23)).name, 'Jantar');
    assert.equal(highlightForPlan(plan, new Date(2026, 10, 30, 8)), null);
    const generated = { ...plan, importedPlan: null, recipes: [{ recipeId: 'r1', date: '2026-11-23T00:00:00Z', meal: 'breakfast', servings: '1', plannedCalories: '400', titleSnapshot: 'Omelete' }, { recipeId: 'r2', date: '2026-11-23T00:00:00Z', meal: 'lunch', servings: '1', plannedCalories: '600', titleSnapshot: 'Frango e arroz' }] };
    assert.equal(highlightForPlan(generated, new Date(2026, 10, 23, 9)).title, 'Omelete');
    assert.equal(highlightForPlan(generated, new Date(2026, 10, 23, 12)).title, 'Frango e arroz');
  } finally { await server.close(); }
});
