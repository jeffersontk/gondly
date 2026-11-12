import type { DietPlanItem, DietPlanSuggestion, DietRestriction, DietType, Unit, HouseholdMember, HouseholdMeal } from "@gondly/types";
import { validateHouseholdProfile } from "./household-profile";

export type DietDefinition = {
  id: DietType;
  title: string;
  description: string;
  defaultPeriodDays: number;
};

export type RestrictionDefinition = {
  id: DietRestriction;
  label: string;
  description: string;
  matchingTag: string;
};

export const DIET_DEFINITIONS: DietDefinition[] = [
  {
    id: "balanced",
    title: "Equilibrada & Variada",
    description: "Planejamento variado com todos os grupos alimentares essenciais: hortifrúti, grãos, laticínios e proteínas magras.",
    defaultPeriodDays: 7,
  },
  {
    id: "vegetarian",
    title: "Vegetariana",
    description: "Foco em proteínas vegetais, ovos, laticínios, leguminosas, sementes e variedade de hortaliças frescas.",
    defaultPeriodDays: 7,
  },
  {
    id: "vegan",
    title: "Vegana (100% Vegetal)",
    description: "Alimentação exclusivamente à base de plantas: leguminosas, cereais integrais, tofu, bebidas vegetais e sementes.",
    defaultPeriodDays: 7,
  },
  {
    id: "low_carb",
    title: "Low Carb",
    description: "Prioriza proteínas, ovos, azeite, castanhas e vegetais de baixo amido, reduzindo açúcares e farinhas refinadas.",
    defaultPeriodDays: 7,
  },
  {
    id: "gluten_free",
    title: "Sem Glúten",
    description: "Ingredientes naturalmente sem trigo, centeio ou cevada: arroz, milho, tubérculos, hortifrúti e proteínas frescas.",
    defaultPeriodDays: 7,
  },
  {
    id: "lactose_free",
    title: "Sem Lactose",
    description: "Alternativas vegetais e itens sem lactose, priorizando refeições equilibradas e frescas para o dia a dia.",
    defaultPeriodDays: 7,
  },
];

export const RESTRICTION_DEFINITIONS: RestrictionDefinition[] = [
  { id: "no_red_meat", label: "Evitar carne vermelha", description: "Remove cortes bovinos e carnes vermelhas", matchingTag: "red_meat" },
  { id: "no_pork", label: "Evitar carne de porco", description: "Remove cortes suínos, bacon e derivados", matchingTag: "pork" },
  { id: "no_seafood", label: "Evitar peixes e frutos do mar", description: "Remove pescados e frutos do mar", matchingTag: "seafood" },
  { id: "no_dairy", label: "Sem leite e laticínios", description: "Remove queijos, leite de vaca e iogurtes tradicionais", matchingTag: "dairy" },
  { id: "no_gluten", label: "Sem glúten", description: "Remove trigo, pães tradicionais e massas com glúten", matchingTag: "gluten" },
  { id: "no_eggs", label: "Sem ovos", description: "Remove ovos de galinha e derivados diretos", matchingTag: "eggs" },
  { id: "no_nuts", label: "Sem castanhas e nozes", description: "Remove oleaginosas (amendoim, castanhas, nozes)", matchingTag: "nuts" },
  { id: "low_sugar", label: "Evitar açúcar refinado", description: "Remove açúcar branco refinado e doces adicionados", matchingTag: "sugar" },
];

type TemplateItem = {
  productName: string;
  category: string;
  unit: Unit;
  packageSize?: number;
  packageUnit?: Unit;
  baseWeeklyPerPerson: number;
  tags: string[];
  notes?: string;
};

// Base catalog of items calibrated for 1 person / 7 days
const BALANCED_ITEMS: TemplateItem[] = [
  { productName: "Banana prata", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Maçã gala ou fuji", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.8, tags: [] },
  { productName: "Tomate", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.7, tags: [] },
  { productName: "Cebola", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Batata inglesa", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Alface crespa", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 1, tags: [] },
  { productName: "Cenoura", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Ovos brancos/vermelhos (dúzia)", category: "Laticínios & Ovos", unit: "un", baseWeeklyPerPerson: 1, tags: ["eggs"] },
  { productName: "Leite integral/desnatado", category: "Laticínios & Ovos", unit: "l", baseWeeklyPerPerson: 1.5, tags: ["dairy"] },
  { productName: "Queijo mussarela/prato fatiado", category: "Laticínios & Ovos", unit: "kg", baseWeeklyPerPerson: 0.25, tags: ["dairy"] },
  { productName: "Iogurte natural", category: "Laticínios & Ovos", unit: "un", baseWeeklyPerPerson: 2, tags: ["dairy"] },
  { productName: "Arroz agulhinha/integral", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Feijão carioca/preto", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Macarrão sêmola", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: ["gluten"] },
  { productName: "Peito de frango / filé", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Carne moída (patinho)", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 0.7, tags: ["red_meat"] },
  { productName: "Filé de tilápia/pescado", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 0.5, tags: ["seafood"] },
  { productName: "Azeite de oliva extravirgem", category: "Despensa & Temperos", unit: "un", baseWeeklyPerPerson: 0.25, tags: [] },
  { productName: "Café moído", category: "Padaria & Café", unit: "pacote", baseWeeklyPerPerson: 0.25, tags: [] },
  { productName: "Pão de forma integral", category: "Padaria & Café", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: ["gluten"] },
];

const VEGETARIAN_ITEMS: TemplateItem[] = [
  { productName: "Banana prata", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Maçã ou pera", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Tomate", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.8, tags: [] },
  { productName: "Cebola e alho", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.6, tags: [] },
  { productName: "Brócolis ou couve-flor", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 1, tags: [] },
  { productName: "Couve ou espinafre", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 1, tags: [] },
  { productName: "Abobrinha italiana", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.7, tags: [] },
  { productName: "Ovos caipiras (dúzia)", category: "Laticínios & Ovos", unit: "un", baseWeeklyPerPerson: 1.5, tags: ["eggs"] },
  { productName: "Queijo minas ou ricota", category: "Laticínios & Ovos", unit: "kg", baseWeeklyPerPerson: 0.35, tags: ["dairy"] },
  { productName: "Iogurte natural integral", category: "Laticínios & Ovos", unit: "un", baseWeeklyPerPerson: 3, tags: ["dairy"] },
  { productName: "Leite integral ou desnatado", category: "Laticínios & Ovos", unit: "l", baseWeeklyPerPerson: 1.5, tags: ["dairy"] },
  { productName: "Arroz integral", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Feijão preto / carioca", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 0.7, tags: [] },
  { productName: "Lentilha seca", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Grão-de-bico", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Aveia em flocos", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Tofu fresco", category: "Açougue & Proteínas", unit: "un", baseWeeklyPerPerson: 1, tags: [] },
  { productName: "Castanhas do Pará / caju", category: "Mercearia & Grãos", unit: "g", baseWeeklyPerPerson: 150, tags: ["nuts"] },
  { productName: "Azeite de oliva extravirgem", category: "Despensa & Temperos", unit: "un", baseWeeklyPerPerson: 0.25, tags: [] },
  { productName: "Pão de fermentação natural", category: "Padaria & Café", unit: "un", baseWeeklyPerPerson: 0.5, tags: ["gluten"] },
];

const VEGAN_ITEMS: TemplateItem[] = [
  { productName: "Banana prata", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.5, tags: [] },
  { productName: "Mamão papaya ou formosa", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 1, tags: [] },
  { productName: "Tomate e cebola", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Espinafre ou couve folha", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 2, tags: [] },
  { productName: "Cenoura e beterraba", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Abacate", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.8, tags: [] },
  { productName: "Batata doce", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Bebida vegetal (aveia/amêndoa/soja)", category: "Laticínios & Ovos", unit: "l", baseWeeklyPerPerson: 2.0, tags: [] },
  { productName: "Tofu firme", category: "Açougue & Proteínas", unit: "un", baseWeeklyPerPerson: 1.5, tags: [] },
  { productName: "Grão-de-bico", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Lentilha", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 0.8, tags: [] },
  { productName: "Feijão carioca/vermelho", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 0.8, tags: [] },
  { productName: "Arroz integral", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Quinoa em grãos", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Sementes de chia / linhaça", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Pasta de amendoim integral", category: "Despensa & Temperos", unit: "un", baseWeeklyPerPerson: 0.25, tags: ["nuts"] },
  { productName: "Azeite de oliva extravirgem", category: "Despensa & Temperos", unit: "un", baseWeeklyPerPerson: 0.25, tags: [] },
  { productName: "Pão 100% integral sem leite/ovos", category: "Padaria & Café", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: ["gluten"] },
];

const LOW_CARB_ITEMS: TemplateItem[] = [
  { productName: "Ovos (dúzia)", category: "Laticínios & Ovos", unit: "un", baseWeeklyPerPerson: 2, tags: ["eggs"] },
  { productName: "Peito de frango / filé de coxa", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 1.5, tags: [] },
  { productName: "Carne moída ou bife (alcatra/patinho)", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 1.0, tags: ["red_meat"] },
  { productName: "Filé de salmão ou tilápia", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 0.8, tags: ["seafood"] },
  { productName: "Queijo parmesão ou padrão fatiado", category: "Laticínios & Ovos", unit: "kg", baseWeeklyPerPerson: 0.3, tags: ["dairy"] },
  { productName: "Manteiga de primeira qualidade", category: "Laticínios & Ovos", unit: "un", baseWeeklyPerPerson: 0.25, tags: ["dairy"] },
  { productName: "Abobrinha e berinjela", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Brócolis ninja", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 1.5, tags: [] },
  { productName: "Couve-flor", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 1, tags: [] },
  { productName: "Alface e rúcula", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 2, tags: [] },
  { productName: "Tomate cereja", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Abacate", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Castanhas de caju e nozes", category: "Mercearia & Grãos", unit: "g", baseWeeklyPerPerson: 200, tags: ["nuts"] },
  { productName: "Azeite de oliva extravirgem", category: "Despensa & Temperos", unit: "un", baseWeeklyPerPerson: 0.35, tags: [] },
  { productName: "Café especial moído", category: "Padaria & Café", unit: "pacote", baseWeeklyPerPerson: 0.25, tags: [] },
];

const GLUTEN_FREE_ITEMS: TemplateItem[] = [
  { productName: "Banana prata", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Maçã fuji", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.8, tags: [] },
  { productName: "Tomate e cebola", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Batata inglesa / doce", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.5, tags: [] },
  { productName: "Mandioca / macaxeira", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 0.8, tags: [] },
  { productName: "Hortaliças e folhas verdes", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 2, tags: [] },
  { productName: "Ovos (dúzia)", category: "Laticínios & Ovos", unit: "un", baseWeeklyPerPerson: 1.2, tags: ["eggs"] },
  { productName: "Leite ou bebida vegetal", category: "Laticínios & Ovos", unit: "l", baseWeeklyPerPerson: 1.5, tags: ["dairy"] },
  { productName: "Filé de frango", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Carne bovina magra", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 0.8, tags: ["red_meat"] },
  { productName: "Arroz agulhinha", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Feijão carioca", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 0.6, tags: [] },
  { productName: "Goma de tapioca fresca", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 1, tags: [] },
  { productName: "Flocão de milho (cuscuz)", category: "Mercearia & Grãos", unit: "pacote", baseWeeklyPerPerson: 0.8, tags: [] },
  { productName: "Pão de forma sem glúten", category: "Padaria & Café", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: [] },
  { productName: "Azeite de oliva", category: "Despensa & Temperos", unit: "un", baseWeeklyPerPerson: 0.25, tags: [] },
];

const LACTOSE_FREE_ITEMS: TemplateItem[] = [
  { productName: "Banana prata", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Mamão e frutas da estação", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Tomate, cebola e alho", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Batata e cenoura", category: "Hortifrúti", unit: "kg", baseWeeklyPerPerson: 1.5, tags: [] },
  { productName: "Folhas verdes variadas", category: "Hortifrúti", unit: "un", baseWeeklyPerPerson: 2, tags: [] },
  { productName: "Ovos (dúzia)", category: "Laticínios & Ovos", unit: "un", baseWeeklyPerPerson: 1.2, tags: ["eggs"] },
  { productName: "Leite sem lactose / vegetal", category: "Laticínios & Ovos", unit: "l", baseWeeklyPerPerson: 1.5, tags: [] },
  { productName: "Queijo mussarela zero lactose", category: "Laticínios & Ovos", unit: "kg", baseWeeklyPerPerson: 0.25, tags: [] },
  { productName: "Iogurte zero lactose", category: "Laticínios & Ovos", unit: "un", baseWeeklyPerPerson: 2, tags: [] },
  { productName: "Peito de frango", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 1.2, tags: [] },
  { productName: "Carne moída de patinho", category: "Açougue & Proteínas", unit: "kg", baseWeeklyPerPerson: 0.8, tags: ["red_meat"] },
  { productName: "Arroz integral ou branco", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 1.0, tags: [] },
  { productName: "Feijão carioca ou preto", category: "Mercearia & Grãos", unit: "kg", baseWeeklyPerPerson: 0.6, tags: [] },
  { productName: "Azeite de oliva extravirgem", category: "Despensa & Temperos", unit: "un", baseWeeklyPerPerson: 0.25, tags: [] },
  { productName: "Pão de forma integral", category: "Padaria & Café", unit: "pacote", baseWeeklyPerPerson: 0.5, tags: ["gluten"] },
];

const DIET_CATALOG_MAP: Record<DietType, TemplateItem[]> = {
  balanced: BALANCED_ITEMS,
  vegetarian: VEGETARIAN_ITEMS,
  vegan: VEGAN_ITEMS,
  low_carb: LOW_CARB_ITEMS,
  gluten_free: GLUTEN_FREE_ITEMS,
  lactose_free: LACTOSE_FREE_ITEMS,
};

export type GenerateDietSuggestionOptions = {
  dietType: DietType;
  familySize: number;
  periodDays: number;
  restrictions?: DietRestriction[];
  mealsAtHome?: Array<"breakfast" | "lunch" | "dinner" | "snack">;
  householdMembers?: HouseholdMember[];
};

export function calculateDietQuantity(baseWeekly: number, familySize: number, periodDays: number, unit: Unit): number {
  const safeFamilySize = Math.max(1, Math.min(30, Math.round(familySize)));
  const safePeriodDays = Math.max(1, Math.min(90, Math.round(periodDays)));
  const scale = safeFamilySize * (safePeriodDays / 7);
  const raw = baseWeekly * scale;

  if (unit === "un" || unit === "pacote" || unit === "caixa") {
    // Round to practical discrete count
    return Math.max(1, Math.round(raw));
  }

  if (unit === "kg" || unit === "l") {
    // Round to 1 decimal place (e.g. 1.5 kg, 2.2 l)
    return Math.max(0.1, Math.round(raw * 10) / 10);
  }

  if (unit === "g" || unit === "ml") {
    // Round to multiples of 50
    return Math.max(50, Math.round(raw / 50) * 50);
  }

  return Math.max(1, Math.round(raw * 10) / 10);
}

export function generateDietSuggestion(options: GenerateDietSuggestionOptions): DietPlanSuggestion {
  const { dietType, familySize, periodDays, restrictions = [] } = options;
  const household = options.householdMembers ? validateHouseholdProfile({ version: 1, members: options.householdMembers, periodDays, dietType, restrictions }).members : undefined;
  const allMeals = ["breakfast", "lunch", "dinner", "snack"] as const;
  const meals = [...new Set(options.mealsAtHome ?? allMeals)];
  if (!meals.length || meals.some(meal => !allMeals.includes(meal))) throw new Error("Selecione pelo menos uma refeição em casa.");
  const dietDef = DIET_DEFINITIONS.find((d) => d.id === dietType) ?? DIET_DEFINITIONS[0];
  const catalog = DIET_CATALOG_MAP[dietType] ?? DIET_CATALOG_MAP.balanced;

  // Build active tag exclusion set from user's restrictions
  const activeExclusionTags = new Set<string>();
  for (const restriction of restrictions) {
    const def = RESTRICTION_DEFINITIONS.find((r) => r.id === restriction);
    if (def) activeExclusionTags.add(def.matchingTag);
  }

  const items: DietPlanItem[] = [];

  for (const template of catalog) {
    // Filter out item if it matches any active user restriction
    const isExcluded = template.tags.some((tag) => activeExclusionTags.has(tag));
    if (isExcluded) continue;

    // Practical template groups, not individual nutritional requirements.
    const breakfastFood = /Padaria|Café|Laticínios/i.test(template.category) || /aveia|granola|tapioca|cuscuz|flocão/i.test(template.productName);
    const sharedFood = /Hortifrúti|Temperos/i.test(template.category) || /ovos/i.test(template.productName);
    const relevant: HouseholdMeal[] = sharedFood ? [...allMeals] : breakfastFood ? ["breakfast", "snack"] : ["lunch", "dinner"];
    const mealScale = relevant.filter(meal => meals.includes(meal as typeof meals[number])).length / relevant.length;
    const householdScale = household?.reduce((sum, member) => {
      if (member.ageBand === "under_3") return sum;
      const frequency = relevant.reduce((days, meal) => days + (meals.includes(meal) ? member.mealsPerWeek[meal] : 0), 0) / (7 * relevant.length);
      return sum + frequency * ({ small: 0.75, medium: 1, large: 1.25 })[member.portion];
    }, 0);
    if (mealScale === 0 || householdScale === 0) continue;
    const suggestedQuantity = calculateDietQuantity(template.baseWeeklyPerPerson * (householdScale ?? mealScale), household ? 1 : familySize, periodDays, template.unit);

    items.push({
      productName: template.productName,
      category: template.category,
      unit: template.unit,
      packageSize: template.packageSize ?? null,
      packageUnit: template.packageUnit ?? null,
      suggestedQuantity,
      baseWeeklyPerPerson: template.baseWeeklyPerPerson,
      notes: template.notes,
      alreadyAtHome: false,
    });
  }

  const premises = `Quantidades iniciais de um modelo de compras para ${familySize} ${
    familySize === 1 ? "pessoa" : "pessoas"
  } por ${periodDays} dias no perfil '${dietDef.title}'. Refeições em casa: ${meals.map(meal => ({ breakfast: "café da manhã", lunch: "almoço", dinner: "jantar", snack: "lanches" })[meal]).join(", ")}. Quantidades de um modelo de compras, ajustadas por grupos de refeições; revise conforme o consumo real da sua casa. Esta sugestão atua como planejamento prático de compras e despensa doméstica, sem constituir prescrição médica ou nutricional individualizada.`;

  return {
    dietType,
    dietName: dietDef.title,
    familySize,
    periodDays,
    restrictions,
    items,
    premises,
  };
}

