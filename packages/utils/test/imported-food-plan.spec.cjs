const { test } = require('node:test');
const assert = require('node:assert/strict');
const { structureFoodMeal, arrangeFoodPlan, foodChoiceKey } = require('../dist/index.js');

const lunch = { id: 'lunch', name: 'Almoço', time: '13:00', notes: '', options: [{ id: 'plate', title: 'Montagem prevista no plano', text: 'VEGETAIS: pelo menos 150g de legumes. Folhas à vontade.\nTemperar com azeite, limão, sal, mostarda ou vinagre.\n1 porção de carboidrato: arroz (120g) + feijão (150g)\nou arroz (210g)\nou batata inglesa (550g)\n1 porção de proteína: frango grelhado (100g)\nou tilápia (170g)\nNOME: Pessoa de teste DATA: 18/11/2026\nou atum (90g)' }] };
test('structures one carbohydrate plus one protein, preserving composite options and original quantities', () => {
  const parsed = structureFoodMeal(lunch);
  const option = parsed.options[0];
  assert.equal(option.groups.length, 2);
  assert.equal(option.groups[0].options.length, 3);
  assert.equal(option.groups[1].options.length, 3);
  assert.match(option.groups[0].options[0].text, /120g.*150g/);
  assert.match(option.text, /150g de legumes/);
  assert.match(option.text, /mostarda ou vinagre/);
  assert.ok(!option.text.includes('550g'));
  assert.ok(!JSON.stringify(parsed).includes('Pessoa de teste'));
  assert.deepEqual(structureFoodMeal(parsed), parsed);
});
test('automatically fills all dates, rotates approved choices and preserves user replacements', () => {
  const breakfast = { id: 'breakfast', name: 'Café', time: '09:00', notes: '', options: [{ id: 'bread', title: 'Pão', text: '50g pão' }, { id: 'tapioca', title: 'Tapioca', text: '50g tapioca' }] };
  const start = '2026-12-30', end = '2027-01-02';
  const content = arrangeFoodPlan({ meals: [breakfast, lunch], choices: { '2026-12-31': { breakfast: 'bread' } } }, start, end);
  assert.equal(Object.keys(content.choices).length, 4);
  assert.equal(content.choices['2026-12-31'].breakfast, 'bread');
  assert.equal(content.choices['2027-01-02'].breakfast, 'tapioca');
  const group = content.meals[1].options[0].groups[0];
  assert.notEqual(content.choices[start][foodChoiceKey('lunch', 'plate', group.id)], content.choices['2026-12-31'][foodChoiceKey('lunch', 'plate', group.id)]);
  assert.deepEqual(arrangeFoodPlan(content, start, end), content);
});
test('common accompaniments after alternatives remain common on every day', () => {
  const meal = structureFoodMeal({ ...lunch, options: [{ id: 'plate', title: 'Prato', text: '1 porção de proteína: 100g frango OU 90g peixe\nSalada à vontade\nTemperar com limão.' }] });
  assert.match(meal.options[0].text, /Salada à vontade/);
  assert.match(meal.options[0].text, /Temperar com limão/);
  assert.ok(meal.options[0].groups[0].options.every(option => !option.text.includes('Salada')));
  const ambiguous = structureFoodMeal({ ...lunch, options: [{ id: 'plate', title: 'Prato', text: '1 porção de proteína: 100g frango com ou sem pele' }] });
  assert.equal(ambiguous.options[0].groups, undefined);
  assert.match(ambiguous.options[0].text, /com ou sem pele/);
  const unknownTail = structureFoodMeal({ ...lunch, options: [{ id: 'plate', title: 'Prato', text: '1 porção de proteína: 100g frango OU 90g peixe\nLegumes cozidos: 150g' }] });
  assert.equal(unknownTail.options[0].groups, undefined);
  assert.match(unknownTail.options[0].text, /Legumes cozidos: 150g/);
});
