type Candidate = { id: string; title: string; caloriesPerServing: unknown; nutritionSource: string | null; tags: { slug: string; kind: string }[] };
type Goal = { meal: string; calories: number };
export function buildCalorieMenu(recipes: Candidate[], target: number, days: number, startDate: string, goals: Goal[]) {
  if (!goals.length || new Set(goals.map(goal => goal.meal)).size !== goals.length || goals.some(goal => !Number.isInteger(goal.calories) || goal.calories <= 0) || goals.reduce((sum, goal) => sum + goal.calories, 0) !== target) throw new Error("A soma das metas de cada refeição deve ser igual à meta diária.");
  const used = new Map<string, number>();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(`${startDate}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + index);
    const meals = goals.map(goal => {
      const options = recipes.filter(recipe => Number(recipe.caloriesPerServing) > 0 && recipe.nutritionSource?.trim() && recipe.tags.some(tag => tag.kind === "meal" && tag.slug === `meal-${goal.meal}`)).map(recipe => {
        const servings = Math.max(0.25, Math.min(4, Math.round(goal.calories / Number(recipe.caloriesPerServing) * 4) / 4));
        const calories = Math.round(servings * Number(recipe.caloriesPerServing) * 100) / 100;
        return { recipeId: recipe.id, title: recipe.title, meal: goal.meal, servings, calories, targetCalories: goal.calories, nutritionSource: recipe.nutritionSource! };
      }).sort((a, b) => Math.abs(a.calories - goal.calories) - Math.abs(b.calories - goal.calories) || (used.get(a.recipeId) ?? 0) - (used.get(b.recipeId) ?? 0) || a.recipeId.localeCompare(b.recipeId));
      if (!options.length) throw new Error(`Selecione uma receita com calorias e classificação para a refeição: ${goal.meal}.`);
      const selected = options[0]; used.set(selected.recipeId, (used.get(selected.recipeId) ?? 0) + 1);
      return selected;
    });
    const totalCalories = Math.round(meals.reduce((sum, meal) => sum + meal.calories, 0) * 100) / 100;
    return { date: date.toISOString().slice(0, 10), meals, totalCalories, difference: Math.round((totalCalories - target) * 100) / 100 };
  });
}
