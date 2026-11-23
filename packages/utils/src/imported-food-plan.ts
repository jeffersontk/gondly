export type FoodGroupOption = { id: string; title: string; text: string };
export type FoodGroup = { id: string; name: string; options: FoodGroupOption[] };
export type FoodOption = FoodGroupOption & { groups?: FoodGroup[] };
export type FoodMeal = { id: string; name: string; time: string; notes: string; options: FoodOption[] };
export type ImportedFoodPlan = { meals: FoodMeal[]; choices: Record<string, Record<string, string>> };

export function cleanFoodText(text: string) {
  return text.split(/\r?\n/).filter(line => !/^\s*(?:nome|paciente|nutricionista|data|crn|p[aá]gina)\s*[:\d]/i.test(line) && !/^\s*escolher\s+1\s*(?:op[cç][aã]o)?\s*:?\s*$/i.test(line) && !/@|https?:\/\//i.test(line)).join("\n").trim();
}
export function structureFoodMeal(meal: FoodMeal): FoodMeal {
  return { ...meal, notes: cleanFoodText(meal.notes), options: meal.options.map(option => {
    if (option.groups?.length) return { ...option, text: cleanFoodText(option.text), groups: option.groups.map(group => ({ ...group, options: group.options.map(item => ({ ...item, text: cleanFoodText(item.text) })) })) };
    const text = cleanFoodText(option.text);
    const markers = [...text.matchAll(/(?:1\s+)?por[cç][aã]o\s+de\s+(carboidrato|prote[ií]na)\s*:/gi)];
    if (!markers.length) return { ...option, text };
    const common = [text.slice(0, markers[0].index).trim()].filter(Boolean);
    let ambiguousContinuation = false;
    const groups = markers.map((marker, index) => {
      const lines = text.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? text.length).trim().split("\n");
      const tail = lines.findIndex((line, position) => position > 0 && /^\s*(?:salada|vegetais|folhas|temperar|tempero|acompanhamento|observa[cç][aã]o|sobremesa)\b/i.test(line));
      if (tail >= 0) common.push(lines.slice(tail).join("\n"));
      const content = (tail >= 0 ? lines.slice(0, tail) : lines).join("\n");
      const optionLines = content.split("\n");
      for (let line = 1; line < optionLines.length; line++) {
        const previous = optionLines[line - 1].trim(), next = optionLines[line].trim();
        const completePortion = /\d\s*(?:g|kg|ml|l|un|ovos?|latas?)\b/i.test(previous) && !/(?:\bde|\bcom|\be|\+|:)\s*$/i.test(previous);
        if (completePortion && next && !/^(?:ou\b|\(?[\d½¼¾]|[+)])/i.test(next)) ambiguousContinuation = true;
      }
      const alternatives = content.split(/\s+ou\s+/i).map(item => item.trim()).filter(Boolean);
      const protein = /^prote/i.test(marker[1]);
      return { id: `group-${index}`, name: protein ? "Proteína" : "Carboidrato", options: alternatives.map((value, position) => ({ id: `group-${index}-option-${position}`, title: value.replace(/\s+/g, " ").slice(0, 120), text: value })) };
    });
    // Preserve unrecognized structures as text rather than silently dropping them.
    if (ambiguousContinuation || groups.some(group => !group.options.length || group.options.length > 20 || (group.options.length > 1 && group.options.some(item => !/[\d½¼¾]/.test(item.text))))) return { ...option, text };
    return { ...option, title: option.title === "Montagem prevista no plano" ? "Prato principal" : option.title, text: common.join("\n"), groups };
  }) };
}

export function foodChoiceKey(mealId: string, optionId: string, groupId: string) { return `${mealId}/${optionId}/${groupId}`; }

export function arrangeFoodPlan(plan: ImportedFoodPlan, start: string, end: string): ImportedFoodPlan {
  const meals = plan.meals.map(structureFoodMeal);
  const choices = Object.fromEntries(Object.entries(plan.choices).map(([date, values]) => [date, { ...values }]));
  const first = Date.parse(`${start.slice(0, 10)}T00:00:00Z`), last = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  for (let day = 0, instant = first; instant <= last && day < 31; day++, instant += 86400000) {
    const date = new Date(instant).toISOString().slice(0, 10);
    const selected = choices[date] ??= {};
    for (const meal of meals) {
      if (!meal.options.length) continue;
      const option = meal.options.find(item => item.id === selected[meal.id]) ?? meal.options[day % meal.options.length];
      selected[meal.id] = option.id;
      for (const group of option.groups ?? []) {
        const key = foodChoiceKey(meal.id, option.id, group.id);
        if (!group.options.some(item => item.id === selected[key]) && group.options.length) selected[key] = group.options[day % group.options.length].id;
      }
    }
  }
  return { meals, choices };
}
