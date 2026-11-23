import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

test('meal import retains quantities and OU alternatives, supports page continuations and does not fabricate meals', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { parseFoodPlanText } = await server.ssrLoadModule('/src/pages/recipes/foodPlanImport.ts');
    const parsed = parseFoodPlanText('Paciente: exemplo\n09:00 CAFÉ DA MANHÃ\nEscolher 1 opção\nOpção 1: Pão com ovo\n50g de pão + 1 ovo\nOpção 2: Tapioca\n50g de tapioca + 35g de queijo\n13:00 ALMOÇO\n120g arroz + 150g feijão OU 550g batata\n100g frango\fOU 90g atum\n17:00 LANCHE\n134g fruta + 38g aveia\n22:00 JANTAR\n280g macarrão\nOpção 2: Hambúrguer\n50g pão + 80g carne\nORIENTAÇÕES GERAIS\nTexto fora das refeições');
    assert.equal(parsed.length, 4);
    assert.equal(parsed[0].time, '09:00');
    assert.equal(parsed[0].options.length, 2);
    assert.match(parsed[0].options[1].text, /35g/);
    assert.match(parsed[1].options[0].text, /550g batata/);
    assert.match(parsed[1].options[0].text, /OU 90g atum/);
    assert.equal(parsed[3].options.length, 2);
    assert.match(parsed[3].options[0].text, /280g/);
    assert.ok(!JSON.stringify(parsed).includes('Paciente:'));
    assert.ok(!JSON.stringify(parsed).includes('Texto fora'));
    assert.equal(parseFoodPlanText('ALMOÇO\nArroz e feijão').length, 1);
    const inline = parseFoodPlanText('09:00 CAFÉ DA MANHÃ\nOpção 1: Pão com ovo: 2 fatias de pão (50g) + 1 ovo (50g) + 15g requeijão\nOpção 2: Tapioca: 50g tapioca + 35g queijo\n+ 1 porção de fruta com chia');
    assert.equal(inline[0].options[0].title, 'Pão com ovo');
    assert.match(inline[0].options[0].text, /15g requeijão/);
    assert.match(inline[0].notes, /Conferir a quais opções se aplica/);
    assert.ok(!inline[0].options[1].text.includes('chia'));
    assert.throws(() => parseFoodPlanText(''), /texto/i);
    assert.throws(() => parseFoodPlanText('documento sem refeições identificáveis'), /refei/i);
  } finally { await server.close(); }
});
