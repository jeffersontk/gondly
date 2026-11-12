import { Link } from "react-router-dom";
import { quantityLabel } from "./types";
export type SavedPlan = { id: string; name: string; shoppingListId: string | null; dailyCalorieTarget: string | null; recipes: { recipeId: string; date: string; meal: string; servings: string; plannedCalories: string | null; titleSnapshot: string | null }[] };
const names: Record<string, string> = { breakfast: "Café da manhã", lunch: "Almoço", dinner: "Jantar", snack: "Lanches" };
export function SavedCaloriePlan({ plan }: { plan: SavedPlan }) {
  const dates = [...new Set(plan.recipes.map(meal => meal.date.slice(0, 10)))];
  return <div className="space-y-3 rounded-xl border border-line bg-white p-4"><h3 className="font-black">{plan.name}</h3><p className="text-xs text-muted">Valores registrados na criação. Confira eventuais alterações na receita antes de preparar.</p>
    {dates.map(date => {
      const meals = plan.recipes.filter(meal => meal.date.slice(0, 10) === date);
      const known = meals.every(meal => meal.plannedCalories !== null);
      const total = meals.reduce((sum, meal) => sum + Number(meal.plannedCalories), 0);
      return <section className="space-y-2 border-t border-line pt-3" key={date}><h4 className="font-bold">{date} · {known ? `${quantityLabel(total)} kcal` : "Total não disponível"}</h4>{known && plan.dailyCalorieTarget !== null ? <p className="text-xs text-muted">Meta: {plan.dailyCalorieTarget} kcal · Diferença: {quantityLabel(total - Number(plan.dailyCalorieTarget))} kcal</p> : null}{meals.map((meal, index) => <div key={index} className="text-sm"><p>{names[meal.meal]}</p><Link className="font-bold text-mint" to={`/app/recipes/${meal.recipeId}`}>{meal.titleSnapshot ?? "Receita"}</Link><p>{quantityLabel(Number(meal.servings))} porções · {meal.plannedCalories ?? "não informado"} kcal</p></div>)}</section>;
    })}
    {plan.shoppingListId ? <Link className="block py-3 font-bold text-mint" to={`/app/lists/${plan.shoppingListId}`}>Abrir lista de compras →</Link> : null}
    <Link className="block py-3 font-bold text-mint" to="/app/compare">Consultar comparação de preços →</Link>
    <p className="text-xs text-muted">A comparação depende dos registros disponíveis. Ingredientes sem histórico não têm cotação automática.</p>
  </div>;
}
