import type { FoodPreparation } from "@gondly/utils";

export function FoodPreparationCard({ recipe }: { recipe: FoodPreparation }) {
  return <div className="mt-3 space-y-3">
    <span className="inline-block rounded-full bg-mint/10 px-3 py-1 text-xs font-bold text-mint">Receita sugerida para este dia</span>
    <h4 className="text-base font-black leading-6">{recipe.title}</h4>
    <ul className="divide-y divide-line rounded-xl border border-line bg-paper px-3">{recipe.ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm"><span className="font-semibold">{ingredient.name}</span><span className="text-xs text-muted">{ingredient.portion}</span></li>)}</ul>
    <details className="rounded-xl border border-mint/20 bg-mint/5 p-3"><summary className="cursor-pointer text-sm font-bold text-mint">Como preparar</summary><ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6">{recipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol><p className="mt-3 border-t border-mint/15 pt-3 text-xs leading-5 text-muted">{recipe.notice}</p></details>
    <details className="text-xs text-muted"><summary className="cursor-pointer py-1">Conferir porções e medidas originais</summary><ul className="mt-2 space-y-2">{recipe.ingredients.map((ingredient, index) => <li key={index}><strong>{ingredient.name}:</strong> {ingredient.source}</li>)}</ul></details>
  </div>;
}
