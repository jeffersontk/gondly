import { useEffect, useId, useState, type FormEvent } from "react";
import type { Unit } from "@gondly/types";
import type { MarketListItem } from "../../types";
import { parsePurchaseQuantity, purchaseDecision } from "./purchaseQuantity";

type Props = {
  item: MarketListItem;
  onChangeStatus: (status: "pending" | "not_needed") => Promise<unknown>;
  onSaveQuantity: (quantity: number, unit: Unit) => Promise<unknown>;
};

const unitOptions: Record<Unit, string> = { un: "Unidades", kg: "kg", g: "g", l: "L", ml: "ml", pacote: "Pacotes", caixa: "Caixas", outro: "Outro" };

export function ListPurchaseOptions({ item, onChangeStatus, onSaveQuantity }: Props) {
  const id = useId();
  const [quantity, setQuantity] = useState(String(item.expectedQuantity ?? 1));
  const [unit, setUnit] = useState<Unit>(item.unit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decision = purchaseDecision(item.status);

  useEffect(() => {
    setQuantity(String(item.expectedQuantity ?? 1));
    setUnit(item.unit);
  }, [item.expectedQuantity, item.unit]);

  async function changeStatus(status: "pending" | "not_needed") {
    if (status === decision || saving) return;
    setSaving(true);
    setError(null);
    try { await onChangeStatus(status); }
    catch { setError("Não foi possível salvar a opção. Tente novamente."); }
    finally { setSaving(false); }
  }

  async function saveQuantity(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = parsePurchaseQuantity(quantity);
    if (parsed === null) { setError("Informe uma quantidade maior que zero, como 2 ou 0,5."); return; }
    setSaving(true);
    setError(null);
    try { await onSaveQuantity(parsed, unit); setQuantity(String(parsed)); }
    catch { setError("Não foi possível salvar a quantidade. Tente novamente."); }
    finally { setSaving(false); }
  }

  const dirty = parsePurchaseQuantity(quantity) !== (item.expectedQuantity ?? 1) || unit !== item.unit;
  return (
    <div className="mt-2" aria-busy={saving || undefined}>
      <fieldset disabled={saving} className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Comprar {item.productName}?</legend>
        {([ ["pending", "Comprar"], ["not_needed", "Não precisa comprar este mês"] ] as const).map(([value, label]) => (
          <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${decision === value ? "border-mint bg-mint/5 text-ink" : "border-line text-ink/60"}`}>
            <input type="radio" name={`purchase-${id}`} checked={decision === value} value={value} onChange={() => void changeStatus(value)} className="h-4 w-4 flex-none accent-mint" />
            {label}
          </label>
        ))}
      </fieldset>
      {decision === "pending" ? (
        <form onSubmit={saveQuantity} className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor={`${id}-quantity`} className="text-xs font-semibold text-ink/60">
              Quantidade a comprar
              <input id={`${id}-quantity`} type="text" inputMode="decimal" value={quantity} onChange={event => { setQuantity(event.target.value); setError(null); }} disabled={saving} aria-describedby={error ? `${id}-error` : undefined} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink outline-none focus:border-mint" />
            </label>
            <label htmlFor={`${id}-unit`} className="text-xs font-semibold text-ink/60">
              Unidade
              <select id={`${id}-unit`} value={unit} onChange={event => setUnit(event.target.value as Unit)} disabled={saving} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-mint">
                {Object.entries(unitOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {dirty || saving ? <button type="submit" disabled={saving} className="mt-2 min-h-11 w-full rounded-xl bg-mint px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar quantidade"}</button> : null}
        </form>
      ) : null}
      {error ? <p id={`${id}-error`} role="alert" className="mt-2 text-xs font-semibold text-tomato">{error}</p> : null}
    </div>
  );
}
