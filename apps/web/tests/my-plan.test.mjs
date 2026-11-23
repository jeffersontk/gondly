import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

test('calendar preserves civil dates, leap months and meal order', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { monthCells, shiftMonth, mealsForDate } = await server.ssrLoadModule('/src/pages/recipes/myPlanCalendar.ts');
    const cells = monthCells('2024-02-15');
    assert.equal(cells.filter(Boolean).length, 29);
    assert.equal(cells[3], '2024-02-01');
    assert.equal(cells.length % 7, 0);
    assert.equal(shiftMonth('2026-12-31', 1), '2027-01-01');
    const meals = [{ date: '2026-11-23T00:00:00.000Z', meal: 'dinner' }, { date: '2026-11-23T00:00:00.000Z', meal: 'breakfast' }, { date: '2026-11-24T00:00:00.000Z', meal: 'lunch' }];
    assert.deepEqual(mealsForDate(meals, '2026-11-23').map(item => item.meal), ['breakfast', 'dinner']);
    assert.equal(mealsForDate(meals, '2026-11-25').length, 0);
  } finally { await server.close(); }
});
