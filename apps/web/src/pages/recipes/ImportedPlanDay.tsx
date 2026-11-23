import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buildFoodPreparation, foodChoiceKey, type ImportedFoodPlan } from "@gondly/utils";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { SavedPlan } from "./SavedCaloriePlan";
import { FoodPreparationCard } from "./FoodPreparationCard";
export type ImportedSavedPlan = SavedPlan & { importedPlan?: ImportedFoodPlan | null; revision: number; startDate?: string };

export function ImportedPlanDay({ plan, date, inPeriod }: { plan: ImportedSavedPlan; date: string; inPeriod: boolean }) {
  const client = useQueryClient();
  const { user } = useAuth();
  const choose = useMutation({ mutationFn: (selection: { mealId: string; optionId: string; groupId?: string }) => api<{ revision: number; importedPlan: ImportedFoodPlan }>(`/recipes/plans/${plan.id}/day`, { method: "PUT", body: { ...selection, date, revision: plan.revision } }), onSuccess: result => { client.setQueryData<ImportedSavedPlan>(["recipe-meal-plan", user?.id, plan.id], current => current ? { ...current, ...result } : current); }, onError: () => { void client.invalidateQueries({ queryKey: ["recipe-meal-plan", user?.id, plan.id] }); } });
  if (!inPeriod) return <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted">Esta data está fora do período do plano. Escolha um dia marcado no calendário.</p>;
  return <div className="space-y-3">
    <p className="rounded-xl bg-mint/5 p-3 text-sm text-mint">Seu dia já está organizado. Alternamos as opções do plano mantendo as quantidades. Use “Trocar” somente se quiser outra alternativa.</p>
    {plan.importedPlan?.meals.map(meal => {
      const choices = plan.importedPlan?.choices[date] ?? {};
      const selected = meal.options.find(option => option.id === choices[meal.id]) ?? meal.options[0];
      if (!selected) return null;
      const dayIndex = plan.startDate ? Math.max(0, Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${plan.startDate.slice(0, 10)}T00:00:00Z`)) / 86400000)) : 0;
      const recipe = buildFoodPreparation(meal, choices, dayIndex);
      return <section id={`plan-meal-${meal.id}`} key={meal.id} className="scroll-mt-5 rounded-2xl border border-line bg-white p-4 shadow-sm">
        <h3 className="font-black">{meal.time ? `${meal.time} · ` : ""}{meal.name}</h3>
        {(meal.options.length > 1 || selected.groups?.some(group => group.options.length > 1)) ? <details className="mt-3 border-t border-line pt-3"><summary className="cursor-pointer py-1 text-sm font-bold text-mint">Trocar opções desta refeição</summary>
          {meal.options.length > 1 ? <label className="mt-3 block text-xs font-bold">Preparação<select value={selected.id} disabled={choose.isPending} onChange={event => choose.mutate({ mealId: meal.id, optionId: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-line bg-white px-3 text-sm">{meal.options.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label> : null}
          {selected.groups?.map(group => <label key={group.id} className="mt-3 block text-xs font-bold">{group.name}<select value={choices[foodChoiceKey(meal.id, selected.id, group.id)] ?? group.options[0]?.id} disabled={choose.isPending} onChange={event => choose.mutate({ mealId: meal.id, groupId: group.id, optionId: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-line bg-white px-3 text-sm">{group.options.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label>)}
        </details> : null}
        {recipe ? <FoodPreparationCard recipe={recipe} /> : <>
        <h4 className="mt-3 text-sm font-bold text-mint">{selected.title}</h4>
        {selected.text ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.text}</p> : null}
        {selected.groups?.map(group => {
          const alternative = group.options.find(option => option.id === choices[foodChoiceKey(meal.id, selected.id, group.id)]) ?? group.options[0];
          return alternative ? <div key={group.id} className="mt-3 rounded-xl border border-mint/15 bg-mint/5 p-3"><h5 className="text-xs font-bold uppercase tracking-wide text-mint">{group.name}</h5><p className="mt-1 text-sm leading-6">{alternative.text.replace(/\s+/g, " ")}</p></div> : null;
        })}
        </>}
        {meal.notes && !/^escolher\s+1\s*(?:op[cç][aã]o)?\s*:?$/i.test(meal.notes.trim()) ? <p className="mt-3 whitespace-pre-wrap border-t border-line pt-3 text-xs leading-5 text-muted">{meal.notes}</p> : null}

      </section>;
    })}
    {choose.isPending ? <p role="status" className="text-sm">Salvando troca...</p> : null}
    {choose.isError ? <p role="alert" className="text-sm text-red-700">{choose.error.message}</p> : null}
  </div>;
}
