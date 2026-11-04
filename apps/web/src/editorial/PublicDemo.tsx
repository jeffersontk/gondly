import { useState } from "react";
import { demoItems, demoTotal } from "./demo.mjs";
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const initialItems = () => demoItems.map(item => ({ ...item, quantity: String(item.quantity), price: String(item.price) }));
const parse = (value: string) => value.trim() ? Number(value.replace(",", ".")) : NaN;
export function PublicDemo() {
  const [items, setItems] = useState(initialItems);
  const [budget, setBudget] = useState("150");
  const total = demoTotal(items.map(item => ({ ...item, quantity: parse(item.quantity), price: parse(item.price) })));
  const limit = budget.trim() ? Number(budget.replace(",", ".")) : NaN;
  function update(index: number, field: "quantity" | "price", value: string) {
    setItems(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }
  return <article className="ed-reading">
    <span className="ed-kicker">EXPERIMENTE SEM CADASTRO</span>
    <h1>Monte uma compra de exemplo</h1>
    <p className="ed-lead">Altere as quantidades e os preços para acompanhar o total. Os produtos e valores são ilustrativos, não são ofertas.</p>
    <div className="ed-prose"><h2>Como usar</h2><p>Quantidade é o número de embalagens ou o peso indicado na unidade de cada item. O preço é por essa mesma unidade: para o tomate, informe o preço por kg. Use zero na quantidade para retirar um produto da conta. Este exemplo não simula sincronização nem consulta preços de mercados.</p></div>
    <div className="ed-demo">
      {items.map((item, index) => <fieldset key={item.name} className="ed-demo-item">
        <legend>{item.name} · {item.unit}</legend>
        <label>Quantidade<input type="text" inputMode="decimal" value={item.quantity} onChange={event => update(index, "quantity", event.target.value)} /></label>
        <label>Preço por {item.unit} (R$)<input type="text" inputMode="decimal" value={item.price} onChange={event => update(index, "price", event.target.value)} /></label>
      </fieldset>)}
      <label className="ed-demo-budget">Orçamento opcional (R$)<input type="text" inputMode="decimal" value={budget} onChange={event => setBudget(event.target.value)} /></label>
      <div role="status" aria-live="polite" className="ed-demo-result">
        {total === null ? "Preencha quantidades e preços com números iguais ou maiores que zero." : <><strong>Total: {money(total)}</strong>{Number.isFinite(limit) && limit >= 0 ? <p>{total > limit ? `Acima do orçamento: ${money(total - limit)}` : `Saldo neste exemplo: ${money(limit - total)}`}</p> : budget ? <p>Informe um orçamento válido ou deixe em branco.</p> : null}</>}
      </div>
      <button type="button" className="ed-button" onClick={() => { setItems(initialItems()); setBudget("150"); }}>Restaurar exemplo</button>
    </div>
    <div className="ed-prose"><h2>Da demonstração para a sua lista</h2><p>Os R$ 57,00 iniciais resultam de 12 + 16 + 7 + 10 + 12. O saldo de R$ 93,00 só considera os produtos exibidos. Não inclui outros itens da sua casa. No aplicativo, itens sem referência de preço ficam identificados como desconhecidos na projeção.</p><p>Esta demonstração funciona somente nesta página. Ao recarregar, ela volta aos dados iniciais. Para salvar listas, compartilhar a compra e consultar seu histórico, entre na sua conta do Gondly.</p><a href="/blog/planejar-lista-com-orcamento">Leia o exemplo completo de planejamento com orçamento</a></div>
  </article>;
}
