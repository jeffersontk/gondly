export const normalizeIngredientName = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const fail = message => { throw new Error(message); };
const text = (value, max = 500) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const slug = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;
const quantity = value => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 999999999 && Math.abs(value * 1000 - Math.round(value * 1000)) < 0.0001;
const allowedKeys = (object, keys) => {
  if (!object || typeof object !== "object" || Array.isArray(object) || Object.keys(object).some(key => !keys.includes(key))) fail("Campos desconhecidos no catálogo.");
};
export function validateRecipeCatalog(data) {
  allowedKeys(data, ["ingredients", "recipes"]);
  if (!Array.isArray(data.ingredients) || !data.ingredients.length || data.ingredients.length > 1000 || !Array.isArray(data.recipes) || !data.recipes.length || data.recipes.length > 200) fail("Informe de 1 a 1000 ingredientes e de 1 a 200 receitas.");
  const ingredients = new Map();
  const aliases = new Map();
  for (const item of data.ingredients) {
    allowedKeys(item, ["slug", "name", "category", "baseUnit", "aliases"]);
    if (!slug(item.slug) || !text(item.name, 120) || !["g", "ml", "un"].includes(item.baseUnit) || ingredients.has(item.slug) || (item.category !== undefined && !text(item.category, 80))) fail("Ingrediente inválido ou duplicado.");
    if (item.aliases !== undefined && (!Array.isArray(item.aliases) || item.aliases.length > 50 || item.aliases.some(alias => !text(alias, 120)))) fail("Aliases inválidos.");
    ingredients.set(item.slug, item);
    for (const name of [item.name, ...(item.aliases ?? [])]) {
      const normalized = normalizeIngredientName(name);
      if (aliases.has(normalized) && aliases.get(normalized) !== item.slug) fail("Alias ambíguo entre ingredientes.");
      aliases.set(normalized, item.slug);
    }
  }
  const seen = new Set();
  for (const recipe of data.recipes) {
    allowedKeys(recipe, ["slug", "title", "description", "servings", "prepMinutes", "cookMinutes", "status", "visibility", "origin", "sourceUrl", "attribution", "reviewedBy", "reviewedAt", "publishedAt", "ingredients", "steps", "tags", "caloriesPerServing", "nutritionSource"]);
    if (!slug(recipe.slug) || seen.has(recipe.slug) || !text(recipe.title, 160) || !text(recipe.description, 5000) || !quantity(recipe.servings)) fail("Receita inválida ou duplicada.");
    seen.add(recipe.slug);
    if (recipe.caloriesPerServing !== undefined && (!quantity(recipe.caloriesPerServing) || recipe.caloriesPerServing > 10000 || Math.abs(recipe.caloriesPerServing * 100 - Math.round(recipe.caloriesPerServing * 100)) > 0.0001 || !text(recipe.nutritionSource, 1000))) fail("Calorias por porção exigem valor positivo e origem declarada.");
    if (recipe.caloriesPerServing === undefined && recipe.nutritionSource !== undefined) fail("Informe calorias por porção junto da origem.");
    if (![recipe.prepMinutes, recipe.cookMinutes ?? 0].every(value => Number.isInteger(value) && value >= 0 && value <= 10080)) fail("Tempo de preparo inválido.");
    if (!["draft", "published"].includes(recipe.status ?? "draft") || !["private", "public"].includes(recipe.visibility ?? "private") || !["original", "imported", "ai_assisted"].includes(recipe.origin ?? "original")) fail("Estado ou origem inválida.");
    if (recipe.sourceUrl !== undefined && (!text(recipe.sourceUrl, 2048) || !/^https:\/\//.test(recipe.sourceUrl))) fail("Fonte deve usar HTTPS.");
    if ((recipe.origin === "imported") && (!recipe.sourceUrl || !text(recipe.attribution, 500))) fail("Receitas importadas precisam de fonte e atribuição.");
    if (recipe.attribution !== undefined && !text(recipe.attribution, 500)) fail("Atribuição inválida.");
    if (recipe.status === "published") {
      if (!text(recipe.reviewedBy, 120) || !validDate(recipe.reviewedAt) || !validDate(recipe.publishedAt) || recipe.visibility !== "public") fail("Publicação exige revisão, datas e visibilidade pública.");
    } else if (recipe.visibility === "public") fail("Rascunhos não podem ser públicos.");
    if (!Array.isArray(recipe.steps) || !recipe.steps.length || recipe.steps.length > 100 || recipe.steps.some(step => !text(step, 5000))) fail("Etapas inválidas.");
    if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length || recipe.ingredients.length > 100) fail("Ingredientes da receita inválidos.");
    for (const item of recipe.ingredients) {
      allowedKeys(item, ["ingredient", "quantity", "unit", "optional", "note"]);
      if (!ingredients.has(item.ingredient) || (item.quantity !== null && !quantity(item.quantity)) || !["un", "kg", "g", "l", "ml", "pacote", "caixa", "outro"].includes(item.unit) || (item.optional !== undefined && typeof item.optional !== "boolean") || (item.note !== undefined && !text(item.note, 500))) fail("Quantidade, unidade ou referência de ingrediente inválida.");
      if (item.quantity === null && !text(item.note, 500)) fail("Quantidade desconhecida exige uma observação.");
      baseQuantity(item, ingredients.get(item.ingredient).baseUnit);
    }
    if (recipe.tags !== undefined && (!Array.isArray(recipe.tags) || recipe.tags.length > 30)) fail("Tags inválidas.");
    for (const tag of recipe.tags ?? []) {
      allowedKeys(tag, ["slug", "name", "kind"]);
      if (!slug(tag.slug) || !text(tag.name, 80) || !["diet", "allergen", "meal"].includes(tag.kind)) fail("Tag inválida.");
    }
  }
  return data;
}
const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
export function baseQuantity(item, baseUnit) {
  if (item.quantity === null) return null;
  if (item.unit === baseUnit) return item.quantity;
  if (item.unit === "kg" && baseUnit === "g" || item.unit === "l" && baseUnit === "ml") {
    const amount = Math.round(item.quantity * 1000 * 1000) / 1000;
    if (amount > 999999999.999) fail("Quantidade convertida excede a capacidade do banco.");
    return amount;
  }
  // No density, package size or piece-weight guessing.
  return null;
}

export async function importRecipeCatalog(prisma, data) {
  validateRecipeCatalog(data);
  return prisma.$transaction(async tx => {
    const ingredients = new Map();
    for (const item of data.ingredients) {
      const existing = await tx.ingredient.findUnique({ where: { slug: item.slug } });
      if (existing && existing.baseUnit !== item.baseUnit) fail("Não altere a unidade-base de um ingrediente existente.");
      const saved = await tx.ingredient.upsert({ where: { slug: item.slug }, create: { slug: item.slug, name: item.name.trim(), category: item.category, baseUnit: item.baseUnit }, update: { name: item.name.trim(), category: item.category } });
      ingredients.set(item.slug, saved);
      for (const name of [item.name, ...(item.aliases ?? [])]) {
        const normalizedName = normalizeIngredientName(name);
        const alias = await tx.ingredientAlias.findUnique({ where: { normalizedName } });
        if (alias && alias.ingredientId !== saved.id) fail("Alias já pertence a outro ingrediente.");
        await tx.ingredientAlias.upsert({ where: { normalizedName }, create: { normalizedName, ingredientId: saved.id }, update: {} });
      }
    }
    for (const recipe of data.recipes) {
      const existing = await tx.recipe.findUnique({ where: { slug: recipe.slug } });
      if (existing?.authorId || existing?.origin === "user_created") fail("Importação administrativa não substitui receitas de usuários.");
      const tags = [];
      for (const tag of recipe.tags ?? []) {
        const previous = await tx.recipeTag.findUnique({ where: { slug: tag.slug } });
        if (previous && previous.kind !== tag.kind) fail("Tag já existe com outro tipo.");
        tags.push(await tx.recipeTag.upsert({ where: { slug: tag.slug }, create: tag, update: { name: tag.name } }));
      }
      const record = { title: recipe.title.trim(), description: recipe.description.trim(), servings: recipe.servings, prepMinutes: recipe.prepMinutes, cookMinutes: recipe.cookMinutes ?? 0, caloriesPerServing: recipe.caloriesPerServing ?? null, nutritionSource: recipe.nutritionSource ?? null, status: recipe.status ?? "draft", visibility: recipe.visibility ?? "private", origin: recipe.origin ?? "original", sourceUrl: recipe.sourceUrl ?? null, attribution: recipe.attribution ?? null, reviewedBy: recipe.status === "published" ? recipe.reviewedBy : null, reviewedAt: recipe.status === "published" ? new Date(recipe.reviewedAt) : null, publishedAt: recipe.status === "published" ? new Date(recipe.publishedAt) : null };
      const saved = await tx.recipe.upsert({ where: { slug: recipe.slug }, create: { slug: recipe.slug, ...record }, update: record });
      await tx.recipeIngredient.deleteMany({ where: { recipeId: saved.id } });
      await tx.recipeStep.deleteMany({ where: { recipeId: saved.id } });
      await tx.recipe.update({ where: { id: saved.id }, data: {
        tags: { set: tags.map(tag => ({ id: tag.id })) },
        steps: { create: recipe.steps.map((instruction, index) => ({ position: index + 1, instruction })) },
        ingredients: { create: recipe.ingredients.map((item, index) => ({ ingredientId: ingredients.get(item.ingredient).id, position: index + 1, quantity: item.quantity, unit: item.unit, optional: item.optional ?? false, note: item.note, baseQuantity: baseQuantity(item, ingredients.get(item.ingredient).baseUnit) })) },
      } });
    }
    return { ingredients: ingredients.size, recipes: data.recipes.length };
  }, { maxWait: 10000, timeout: 60000 });
}
