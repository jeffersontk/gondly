import { buildFoodPreparation, foodChoiceKey, type ImportedFoodPlan } from "@gondly/utils";
import type { SavedPlan } from "./SavedCaloriePlan";
import { localDateKey } from "./myPlanCalendar";

export type CalendarPlanSummary = { id: string; name: string; startDate: string; endDate: string };
export type HighlightPlan = SavedPlan & { startDate: string; endDate: string; importedPlan?: ImportedFoodPlan | null };
export type MealHighlight = { name: string; title: string; summary: string; time: string; upcoming: boolean; href: string };
const normalize = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const defaults: Record<string, { name: string; minutes: number }> = { breakfast: { name: "Café da manhã", minutes: 420 }, lunch: { name: "Almoço", minutes: 720 }, snack: { name: "Lanche", minutes: 960 }, dinner: { name: "Jantar", minutes: 1140 } };
export function activePlanForDate<T extends { startDate: string; endDate: string }>(plans: T[], date: string): T | undefined {
  return plans.find(plan => plan.startDate.slice(0, 10) <= date && plan.endDate.slice(0, 10) >= date);
}
function mealMinutes(name: string, time: string): number | null {
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const key = normalize(name);
  if (/cafe|desjejum/.test(key)) return defaults.breakfast.minutes;
  if (/almoco/.test(key)) return defaults.lunch.minutes;
  if (/jantar/.test(key)) return defaults.dinner.minutes;
  if (/ceia/.test(key)) return 1260;
  if (/lanche/.test(key)) return /manha/.test(key) ? 600 : defaults.snack.minutes;
  return null;
}
export function highlightForPlan(plan: HighlightPlan, now: Date): MealHighlight | null {
  const date = localDateKey(now);
  if (date < plan.startDate.slice(0, 10) || date > plan.endDate.slice(0, 10)) return null;
  const candidates: { name: string; title: string; summary: string; minutes: number; key: string }[] = [];
  if (plan.importedPlan) {
    const choices = plan.importedPlan.choices[date] ?? {};
    const dayIndex = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${plan.startDate.slice(0, 10)}T00:00:00Z`)) / 86400000);
    for (const meal of plan.importedPlan.meals) {
      const minutes = mealMinutes(meal.name, meal.time);
      const selected = meal.options.find(option => option.id === choices[meal.id]);
      if (minutes === null || !selected) continue;
      const recipe = buildFoodPreparation(meal, choices, dayIndex);
      const summary = recipe ? recipe.ingredients.filter(item => item.kind !== "seasoning").map(item => `${item.name}: ${item.portion}`).join(" · ") : [selected.text, ...selected.groups?.map(group => group.options.find(option => option.id === choices[foodChoiceKey(meal.id, selected.id, group.id)])?.text) ?? []].filter(Boolean).join(" · ");
      candidates.push({ name: meal.name, title: recipe?.title ?? selected.title, summary: summary.replace(/\s+/g, " ").slice(0, 240), minutes, key: meal.id });
    }
  } else {
    for (const meal of plan.recipes.filter(item => item.date.slice(0, 10) === date)) {
      const slot = defaults[meal.meal]; if (!slot) continue;
      candidates.push({ name: slot.name, title: meal.titleSnapshot ?? "Receita do plano", summary: `${meal.servings} porções${meal.plannedCalories !== null ? ` · ${meal.plannedCalories} kcal registradas` : ""}`, minutes: slot.minutes, key: `${meal.meal}-${meal.recipeId}` });
    }
  }
  candidates.sort((a, b) => a.minutes - b.minutes);
  if (!candidates.length) return null;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const chosen = [...candidates].reverse().find(meal => meal.minutes <= currentMinutes) ?? candidates[0];
  const params = new URLSearchParams({ plan: plan.id, date, meal: chosen.key });
  return { name: chosen.name, title: chosen.title, summary: chosen.summary, time: `${String(Math.floor(chosen.minutes / 60)).padStart(2, "0")}:${String(chosen.minutes % 60).padStart(2, "0")}`, upcoming: currentMinutes < chosen.minutes, href: `/app/my-plan?${params}` };
}
