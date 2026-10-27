import { useId } from "react";
import { ArrowUpDown, Tags } from "lucide-react";
import { formatBRL } from "@gondly/utils";
import { priceRangeVariation } from "./comparisonPresentation";

export function ComparisonCategoryFilter({ categories, selected, onChange }: { categories: string[]; selected: string; onChange: (category: string) => void }) {
  const id = useId();
  const options = selected && !categories.includes(selected) ? [...categories, selected] : categories;
  return <div className="mt-3 rounded-xl border border-line bg-white p-3 shadow-sm">
    <label htmlFor={id} className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink/65"><Tags className="h-4 w-4 text-mint" /> Categoria</label>
    <div className="flex items-center gap-2">
      <select id={id} value={selected} onChange={event => onChange(event.target.value)} className={`h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-mint ${selected ? "border-mint/40" : "border-line"}`}>
        <option value="">Todas as categorias</option>
        {options.map(category => <option key={category} value={category}>{category}</option>)}
      </select>
      {selected ? <button type="button" onClick={() => onChange("")} className="min-h-11 px-2 text-xs font-black text-mint" aria-label="Limpar filtro de categoria">Limpar</button> : null}
    </div>
  </div>;
}

export function ComparisonResultsCount({ count, visible }: { count: number; visible: number }) {
  if (!count) return null;
  return <div className="space-y-2 py-1">
    <p role="status" className="text-xs font-semibold text-ink/60">Exibindo {Math.min(count, visible)} de {count} {count === 1 ? "produto" : "produtos"}</p>
  </div>;
}

export function PriceVariationBadge({ min, max, purchasesCount }: { min: number | null; max: number | null; purchasesCount?: number }) {
  const variation = priceRangeVariation(min, max);
  if (!variation) return <p className="mt-2 text-xs font-semibold text-ink/55">Sem preços comparáveis</p>;
  if (variation.difference === 0) return <p className="mt-2 rounded-lg bg-paper px-2.5 py-2 text-xs font-semibold text-ink/60">{purchasesCount === 1 ? "Um preço registrado" : "Sem variação no período"}</p>;
  return <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
    <p className="flex flex-wrap items-center gap-1.5 text-sm font-black text-amber-900"><ArrowUpDown className="h-4 w-4 flex-none" /> Variação de {formatBRL(variation.difference)}{variation.percentage != null ? <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs">{variation.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span> : null}</p>
    <p className="mt-1 text-[11px] font-semibold leading-4 text-amber-800">Diferença entre o menor e o maior preço no período.</p>
  </div>;
}
