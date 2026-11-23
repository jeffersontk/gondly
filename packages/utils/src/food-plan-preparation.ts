import { cleanFoodText, foodChoiceKey, type FoodMeal } from "./imported-food-plan";

export type FoodPreparation = {
  title: string;
  ingredients: { name: string; portion: string; source: string; kind: "carbohydrate" | "protein" | "vegetable" | "seasoning" }[];
  steps: string[];
  notice: string;
};
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/-/g, " ");
const foods = [
  { match: /\barroz\b/, name: "Arroz branco", step: "Cozinhe o arroz separadamente e reserve a porção indicada para servir." },
  { match: /\bfeijao\b/, name: "Feijão", step: "Cozinhe o feijão até ficar macio e reserve a porção indicada para servir." },
  { match: /\bmacarrao\b/, name: "Macarrão", step: "Cozinhe o macarrão em água, escorra e separe a porção indicada, sem acrescentar molhos ou outros ingredientes." },
  { match: /\bmandioquinha\b/, name: "Mandioquinha", step: "Cozinhe a mandioquinha em água até ficar macia e separe a porção prevista no plano." },
  { match: /\bbatata inglesa\b/, name: "Batata inglesa", step: "Cozinhe a batata em água até ficar macia. Sirva a porção prevista, sem acrescentar manteiga ou leite." },
  { match: /\babobora\b/, name: "Abóbora cabotiá", step: "Cozinhe a abóbora no vapor ou em água até ficar macia e separe a porção indicada." },
  { match: /\bmandioca\b/, name: "Mandioca", step: "Descasque a mandioca, cozinhe completamente em água, descarte a água e sirva a porção indicada." },
  { match: /\bfrango\b/, name: "Frango", step: "Grelhe o frango em frigideira antiaderente até cozinhar completamente. Separe a porção indicada no plano." },
  { match: /\bmignon suino\b/, name: "Filé mignon suíno", step: "Grelhe o filé suíno até cozinhar completamente e separe a porção indicada no plano." },
  { match: /\bpatinho\b/, name: "Patinho", step: "Grelhe o patinho até cozinhar completamente e separe a porção indicada no plano." },
  { match: /\btilapia\b/, name: "Tilápia", step: "Grelhe a tilápia em frigideira antiaderente até cozinhar completamente e separe a porção indicada." },
  { match: /\batum\b/, name: "Atum", step: "Escorra o líquido de cobertura do atum em conserva e separe a porção indicada no plano." },
  { match: /\bsardinha\b/, name: "Sardinha", step: "Escorra o líquido de cobertura da sardinha em conserva e separe a porção indicada no plano." },
];
const vegetables = [
  { match: /\bpepino\b/, name: "Pepino", raw: true }, { match: /\btomate\b/, name: "Tomate", raw: true },
  { match: /\babobrinha\b/, name: "Abobrinha", raw: false }, { match: /\bbrocolis\b/, name: "Brócolis", raw: false },
  { match: /\bcenoura\b/, name: "Cenoura", raw: false }, { match: /\bbeterraba\b/, name: "Beterraba", raw: false },
  { match: /\bchuchu\b/, name: "Chuchu", raw: false }, { match: /\bcouve\s+flor\b/, name: "Couve-flor", raw: false },
];
const measureWords = new Set("de da do col colher colheres sopa sobremesa cheia cheias cheios cheio concha conchas media medias medio medios grande grandes pequeno pequenos escumadeira escumadeiras file files lata latas un unidade unidades g kg meia meio metade em conserva".split(" "));
function supportedFoodDescription(source: string, foodName: string) {
  const allowed = new Set([...measureWords, ...normalize(foodName).split(" ")]);
  if (foodName === "Arroz branco") { allowed.add("integral"); allowed.add("cozido"); }
  if (["Frango", "Filé mignon suíno", "Patinho", "Tilápia"].includes(foodName)) { allowed.add("grelhado"); allowed.add("grelhada"); }
  return (normalize(source).match(/[a-z]+/g) ?? []).every(word => allowed.has(word));
}
function supportedCommonDescription(text: string) {
  const normalized = normalize(text);
  const allowed = new Set("vegetais pelo menos g dar preferencia para mais densos folhas a vontade temperar com fio de azeite limao sal mostarda ou vinagre".split(" "));
  for (const vegetable of vegetables) for (const word of normalize(vegetable.name).split(" ")) allowed.add(word);
  if (!(normalized.match(/[a-z]+/g) ?? []).every(word => allowed.has(word))) return false;
  const remainder = normalized.replace(/pelo menos\s*\d+(?:[.,]\d+)?\s*g\b/, "").replace(/\b1\s+fio de azeite\b/, "");
  return !/[\d½¼¾]/.test(remainder);
}

/** A culinary suggestion, never a nutritional calculation or raw-to-cooked conversion. */
export function buildFoodPreparation(meal: FoodMeal, choices: Record<string, string>, dayIndex: number): FoodPreparation | null {
  const selected = meal.options.find(option => option.id === choices[meal.id]);
  if (!selected?.groups?.length) return null;
  const ingredients: FoodPreparation["ingredients"] = [], steps: string[] = [];
  for (const group of selected.groups) {
    const kind = normalize(group.name).includes("carboidrato") ? "carbohydrate" : normalize(group.name).includes("proteina") ? "protein" : null;
    if (!kind) return null;
    const alternative = group.options.find(option => option.id === choices[foodChoiceKey(meal.id, selected.id, group.id)]);
    if (!alternative) return null;
    for (const part of cleanFoodText(alternative.text).split(/\s*\+\s*/)) {
      const source = part.replace(/\s+/g, " ").trim();
      if (/\b(?:com|e|molho|rechead[oa]|empanad[oa])\b|,(?!\d)/i.test(normalize(source))) return null;
      const candidates = foods.filter(food => food.match.test(normalize(source)));
      // An unrecognized or ambiguous component must stay visible as the original plan.
      if (candidates.length !== 1) return null;
      const food = candidates[0];
      if (!supportedFoodDescription(source, food.name)) return null;
      if (["Atum", "Sardinha"].includes(food.name) && !/lata|conserva/i.test(source)) return null;
      const grams = source.match(/(?:\(\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
      const name = food.name === "Arroz branco" && !/\bbranco\b/.test(normalize(source)) ? /\bintegral\b/.test(normalize(source)) ? "Arroz integral" : "Arroz" : food.name;
      ingredients.push({ name, portion: grams ? `${grams[1]}${grams[2].toLowerCase()}` : source, source, kind });
      steps.push(food.step);
    }
  }
  if (!ingredients.length) return null;
  const base = [cleanFoodText(selected.text), cleanFoodText(meal.notes)].filter(Boolean).join("\n"), baseKey = normalize(base);
  if (!supportedCommonDescription(base)) return null;
  const availableVegetables = vegetables.filter(vegetable => vegetable.match.test(baseKey));
  const minimum = baseKey.match(/pelo menos\s*(\d+(?:[.,]\d+)?)\s*g\b/);
  const index = Number.isFinite(dayIndex) ? Math.max(0, Math.trunc(dayIndex)) : 0;
  const vegetable = availableVegetables.length && minimum ? availableVegetables[index % availableVegetables.length] : null;
  if (vegetable && minimum) {
    ingredients.push({ name: vegetable.name, portion: `${minimum[1]}g no total`, source: base, kind: "vegetable" });
    steps.push(vegetable.raw ? `Higienize e corte ${vegetable.name.toLowerCase()} para a salada. Separe ${minimum[1]}g de vegetais no total.` : `Higienize e cozinhe ${vegetable.name.toLowerCase()} no vapor até ficar macio. Separe ${minimum[1]}g de vegetais no total.`);
  } else if (/\bvegetais\b/.test(baseKey)) {
    // Do not discard a required side when its varieties or total amount are ambiguous.
    return null;
  }
  if (/folhas\s+a vontade/.test(baseKey)) ingredients.push({ name: "Folhas", portion: "À vontade, conforme o plano", source: "Folhas à vontade", kind: "vegetable" });
  if (/\bazeite\b/.test(baseKey)) ingredients.push({ name: "Azeite", portion: /1\s+fio de azeite/.test(baseKey) ? "1 fio" : "Quantidade não especificada no plano", source: /1\s+fio de azeite/.test(baseKey) ? "1 fio de azeite" : "Azeite", kind: "seasoning" });
  for (const [word, name] of [["limao", "Limão"], ["sal", "Sal"]]) if (new RegExp(`\\b${word}\\b`).test(baseKey)) ingredients.push({ name, portion: "Quantidade não especificada no plano", source: name, kind: "seasoning" });
  const dressings = [["mostarda", "Mostarda"], ["vinagre", "Vinagre"]].filter(([word]) => new RegExp(`\\b${word}\\b`).test(baseKey));
  if (dressings.length) {
    // Only treat them as interchangeable when the source explicitly says OU.
    if (dressings.length > 1 && !/mostarda\s+ou\s+vinagre|vinagre\s+ou\s+mostarda/.test(baseKey)) return null;
    const dressing = dressings[index % dressings.length][1];
    ingredients.push({ name: dressing, portion: "Quantidade não especificada no plano", source: dressings.length > 1 ? "Mostarda ou vinagre" : dressing, kind: "seasoning" });
  }
  if (ingredients.some(item => item.kind === "seasoning")) steps.push("Tempere usando somente os temperos listados. O fio de azeite é o previsto no plano, não uma quantidade adicional para cada componente.");
  steps.push("Monte o prato com as porções indicadas. Mantenha o critério de pesagem do seu plano; estas quantidades não foram convertidas em pesos crus para compra.");
  const carbohydrates = ingredients.filter(item => item.kind === "carbohydrate").map(item => item.name.toLowerCase());
  const proteins = ingredients.filter(item => item.kind === "protein").map(item => item.name.toLowerCase());
  const cookedProteins: Record<string, string> = { frango: "frango grelhado", "filé mignon suíno": "filé mignon suíno grelhado", patinho: "patinho grelhado", "tilápia": "tilápia grelhada", atum: "atum", sardinha: "sardinha" };
  const proteinTitle = proteins.map(name => cookedProteins[name] ?? name).join(" e ");
  const mainTitle = [carbohydrates.join(" e "), proteinTitle].filter(Boolean).join(" com ");
  const title = mainTitle + (vegetable ? ` e ${vegetable.raw ? "salada de " : ""}${vegetable.name.toLowerCase()}${vegetable.raw ? "" : " no vapor"}` : "");
  return { title: title.charAt(0).toUpperCase() + title.slice(1), ingredients, steps, notice: "Modo de preparo sugerido pelo Gondly a partir das opções do plano. As porções vieram do documento; a preparação não foi prescrita ou validada pelo nutricionista." };
}
