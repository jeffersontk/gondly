import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppButton, ScreenContainer } from "../../components";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { RecipePreview, RecipeSummary } from "./types";
import { quantityLabel } from "./types";
import { SavedCaloriePlan, type SavedPlan } from "./SavedCaloriePlan";
type Meal = { recipeId: string; title: string; meal: string; servings: number; calories: number; targetCalories: number; nutritionSource: string };
type CalorieResult = { targetCalories: number; days: { date: string; totalCalories: number; difference: number; meals: Meal[] }[]; ingredients: RecipePreview["ingredients"]; hasDifference: boolean };
type SavedSummary = { id: string; name: string; shoppingListId: string | null };
const names: Record<string, string> = { breakfast: "Café da manhã", lunch: "Almoço", dinner: "Jantar", snack: "Lanches" };
function localDate() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function CaloriePlanPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("1");
  const [startDate, setStartDate] = useState(localDate);
  const [goals, setGoals] = useState<Record<string, number>>({ breakfast: 0, lunch: 0, dinner: 0, snack: 0 });
  const [recipeIds, setRecipeIds] = useState<string[]>([]);
  const [usePantry, setUsePantry] = useState(true);
  const [acceptDifference, setAcceptDifference] = useState(false);
  const [viewSavedId, setViewSavedId] = useState("");
  const recipes = useQuery({ queryKey: ["recipes", user?.id, "calorie-options"], queryFn: () => api<RecipeSummary[]>("/recipes", { cacheFallback: false }), refetchOnMount: true });
  const saved = useQuery({ queryKey: ["recipe-meal-plans", user?.id], queryFn: () => api<SavedSummary[]>("/recipes/meal-plans", { cacheFallback: false }), refetchOnMount: true });
  const savedPlan = useQuery({ queryKey: ["recipe-meal-plan", user?.id, viewSavedId], queryFn: () => api<SavedPlan>(`/recipes/meal-plans/${viewSavedId}`, { cacheFallback: false }), enabled: !!viewSavedId, refetchOnMount: true });
  const body = { targetCalories: Number(target), days: Number(days), startDate, meals: Object.entries(goals).filter(([, calories]) => calories > 0).map(([meal, calories]) => ({ meal, calories })), recipeIds, usePantry };
  const preview = useMutation({ mutationFn: (request: typeof body) => api<CalorieResult>("/recipes/meal-plan/preview", { method: "POST", body: request }), onSuccess: () => { setAcceptDifference(false); create.reset(); } });
  const current = preview.data && JSON.stringify(preview.variables) === JSON.stringify(body) ? preview.data : null;
  const create = useMutation({ mutationFn: () => api<{ id: string; shoppingListId: string }>("/recipes/meal-plan", { method: "POST", body: { ...body, acceptDifference } }), onSuccess: result => { setViewSavedId(result.id); void client.invalidateQueries({ queryKey: ["recipe-meal-plans"] }); void client.invalidateQueries({ queryKey: ["lists"] }); } });
  const total = Object.values(goals).reduce((sum, value) => sum + value, 0);
  const valid = Number.isInteger(Number(target)) && Number(target) > 0 && Number(target) <= 10000 && total === Number(target) && recipeIds.length > 0 && !!startDate && body.meals.every(meal => Number.isInteger(meal.calories));
  const eligible = recipes.data?.filter(recipe => recipe.caloriesPerServing !== null && recipe.nutritionSource && recipe.mealTypes.length) ?? [];
  const field = "mt-1 min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-base";
  return <ScreenContainer title="Cardápio por meta diária" subtitle="Sua meta, receitas escolhidas e lista consolidada">
    <Link className="mb-4 block text-sm font-bold text-mint" to="/app/recipes">← Receitas e despensa</Link>
    <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Use uma meta que você já definiu para uma pessoa. O sistema não determina sua necessidade calórica nem garante adequação nutricional. Os cálculos usam valores declarados nas receitas, sem inferir calorias ausentes. Confira restrições, ingredientes e porções antes de seguir o cardápio.</p>
    <fieldset disabled={preview.isPending || create.isPending} className="space-y-4">
      <label className="block text-sm">Meta de kcal por dia<input className={field} type="number" min="1" max="10000" step="1" placeholder="Ex.: 1600" value={target} onChange={event => {
        const value = Number(event.target.value); setTarget(event.target.value);
        if (Number.isInteger(value) && value > 0 && value <= 10000) { const breakfast = Math.round(value * 0.2), lunch = Math.round(value * 0.35), dinner = Math.round(value * 0.35); setGoals({ breakfast, lunch, dinner, snack: Math.max(0, value - breakfast - lunch - dinner) }); }
      }} /></label>
      <div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-sm">Data inicial<input className={field} type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label className="min-w-0 text-sm">Período<select className={field} value={days} onChange={event => setDays(event.target.value)}>{[1, 3, 7, 14].map(value => <option key={value} value={value}>{value} dia(s)</option>)}</select></label></div>
      <h2 className="font-black">Distribua a meta entre as refeições</h2>
      <p className="text-xs text-muted">A distribuição inicial é editável, não uma recomendação nutricional. Use zero para excluir uma refeição e redistribua as kcal nas outras.</p>
      <div className="grid grid-cols-2 gap-3">{Object.entries(names).map(([meal, name]) => <label className="min-w-0 text-sm" key={meal}>{name} (kcal)<input className={field} type="number" min="0" max="10000" step="1" value={goals[meal]} onChange={event => setGoals(current => ({ ...current, [meal]: Number(event.target.value) }))} /></label>)}</div>
      <p className="text-sm">Distribuído: {total} kcal / Meta: {target || "não informada"}</p>
      {target && total !== Number(target) ? <p role="alert" className="text-sm text-tomato">A soma das refeições deve ser igual à meta diária.</p> : null}
      <h2 className="font-black">Escolha as receitas permitidas</h2>
      <p className="text-xs text-muted">Cada refeição precisa de uma receita classificada para ela, com kcal por porção e origem do valor. Serão usadas porções entre 0,25 e 4, em passos de 0,25. O total real pode diferir da meta.</p>
      {recipes.isLoading ? <p>Carregando receitas...</p> : recipes.isError ? <p role="alert">Não foi possível carregar receitas. <button className="underline" onClick={() => void recipes.refetch()}>Tentar novamente</button></p> : null}
      {!eligible.length && recipes.isSuccess ? <p className="rounded-xl border border-line p-3 text-sm">Nenhuma receita com informação calórica e refeição disponível. <Link className="font-bold text-mint" to="/app/recipes/new">Cadastre uma receita com esses dados</Link> para começar. Não geramos calorias fictícias.</p> : null}
      {eligible.map(recipe => <label key={recipe.id} className="flex items-start gap-3 rounded-xl border border-line bg-white p-3"><input className="mt-1 h-4 w-4" type="checkbox" checked={recipeIds.includes(recipe.id)} disabled={!recipeIds.includes(recipe.id) && recipeIds.length >= 30} onChange={() => setRecipeIds(current => current.includes(recipe.id) ? current.filter(id => id !== recipe.id) : [...current, recipe.id])} /><span className="text-sm"><strong>{recipe.title}</strong><span className="block">{recipe.caloriesPerServing} kcal/porção · {recipe.mealTypes.map(meal => names[meal] ?? meal).join(", ")}</span><Link className="block py-2 font-bold text-mint" target="_blank" to={`/app/recipes/${recipe.id}`}>Conferir ingredientes e preparo ↗</Link></span></label>)}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={usePantry} onChange={event => setUsePantry(event.target.checked)} />Descontar despensa confirmada da lista</label>
      <AppButton full disabled={!valid} loading={preview.isPending} onClick={() => preview.mutate(body)}>Sugerir refeições e calcular ingredientes</AppButton>
    </fieldset>
    {preview.isError ? <p role="alert" className="mt-3 text-sm text-tomato">{preview.error.message}</p> : null}
    {current ? <section className="mt-5 space-y-4"><h2 className="text-lg font-black">Revise o cardápio</h2>{current.days.map(day => <div key={day.date} className="space-y-3 rounded-xl border border-line bg-white p-4"><h3 className="font-black">{day.date} · {quantityLabel(day.totalCalories)} kcal</h3><p className="text-xs text-muted">Diferença da meta: {quantityLabel(day.difference)} kcal</p>{day.meals.map(meal => <div key={meal.meal} className="border-t border-line pt-2 text-sm"><strong>{names[meal.meal]}</strong><Link className="block font-bold text-mint" target="_blank" to={`/app/recipes/${meal.recipeId}`}>{meal.title} ↗</Link><p>{quantityLabel(meal.servings)} porções · {quantityLabel(meal.calories)} kcal (meta da refeição: {meal.targetCalories})</p><p className="text-xs text-muted">Origem declarada: {meal.nutritionSource}</p></div>)}</div>)}
      <h2 className="font-black">Lista consolidada para todos os dias</h2><p className="text-xs text-muted">O estoque é descontado uma única vez do total necessário. Não há baixa automática ao salvar.</p>{current.ingredients.map(item => <p className="rounded-xl border border-line bg-white p-3 text-sm" key={item.ingredientId}><strong>{item.name}</strong> · Total necessário {item.required === null ? "a confirmar" : quantityLabel(item.required)} {item.unit} · Comprar {item.missing === null ? "a confirmar" : quantityLabel(item.missing)} {item.unit}</p>)}
      {current.hasDifference ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acceptDifference} onChange={event => setAcceptDifference(event.target.checked)} />Revisei e aceito a diferença mostrada entre o total do cardápio e a minha meta.</label> : null}
      <AppButton full loading={create.isPending} disabled={create.isSuccess || current.ingredients.some(item => item.unknown) || current.hasDifference && !acceptDifference} onClick={() => create.mutate()}>Salvar cardápio e criar nova lista</AppButton>
      {create.isError ? <p role="alert" className="text-sm text-tomato">{create.error.message}</p> : null}
      {create.isSuccess ? <p role="status" className="text-sm font-bold text-mint">Cardápio salvo. <Link to={`/app/lists/${create.data.shoppingListId}`}>Abrir nova lista de compras →</Link></p> : null}
    </section> : null}
    <section className="mt-6 space-y-3"><h2 className="font-black">Meus cardápios salvos</h2>{saved.isError ? <p role="alert">Não foi possível carregar os cardápios. <button className="underline" onClick={() => void saved.refetch()}>Tentar novamente</button></p> : null}{saved.data?.map(plan => <button type="button" className="block min-h-12 w-full rounded-xl border border-line bg-white px-3 text-left text-sm" key={plan.id} onClick={() => setViewSavedId(plan.id)}>{plan.name} →</button>)}
      {savedPlan.isFetching ? <p>Carregando cardápio...</p> : null}
      {savedPlan.isError ? <p role="alert">Cardápio indisponível.</p> : null}
      {savedPlan.data && !savedPlan.isFetching ? <SavedCaloriePlan plan={savedPlan.data} /> : null}
    </section>
  </ScreenContainer>;
}
