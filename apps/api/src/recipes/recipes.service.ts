import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { purchaseAccessWhere } from "../purchases/purchase-access";
import { calculateRecipePlan, knownBaseAmount, normalizeRecipeIngredient } from "./recipe-calculation";
import { CaloriePlanDto, ConfirmPurchaseIngredientDto, CreateRecipeDto, RecipePlanDto } from "./dto";
import { buildCalorieMenu } from "./calorie-planning";

const recipeInclude = { tags: true, ingredients: { include: { ingredient: true }, orderBy: { position: "asc" as const } }, steps: { orderBy: { position: "asc" as const } } };
const accessible = (userId: string): Prisma.RecipeWhereInput => ({ OR: [{ authorId: userId, status: { not: "archived" } }, { status: "published", visibility: "public" }] });
const accessibleIngredient = (userId: string): Prisma.IngredientWhereInput => ({ OR: [{ recipeIngredients: { some: { recipe: accessible(userId) } } }, { pantryItems: { some: { userId } } }] });
const slugify = (name: string) => normalizeRecipeIngredient(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || randomUUID();
@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}
  async publication(userId: string, id: string, publish: boolean) {
    const recipe = await this.prisma.recipe.findFirst({ where: { id, authorId: userId, origin: "user_created" } });
    if (!recipe) throw new NotFoundException("Receita própria não encontrada.");
    return this.prisma.recipe.update({ where: { id: recipe.id }, data: { visibility: publish ? "public" : "private", status: publish ? "published" : "draft", publishedAt: publish ? recipe.publishedAt ?? new Date() : null }, select: { id: true, slug: true, visibility: true, status: true } });
  }
  ingredients(userId: string, q = "") {
    return this.prisma.ingredient.findMany({ where: { AND: [accessibleIngredient(userId), { name: { contains: q.slice(0, 120), mode: "insensitive" } }] }, select: { id: true, name: true, baseUnit: true }, take: 200, orderBy: { name: "asc" } });
  }
  async create(userId: string, dto: CreateRecipeDto) {
    if (dto.caloriesPerServing != null && !dto.nutritionSource?.trim()) throw new BadRequestException("Informe a origem das calorias por porção.");
    if (dto.caloriesPerServing == null && dto.nutritionSource) throw new BadRequestException("Informe as calorias por porção junto da origem.");
    if (dto.title.trim().length < 2 || dto.ingredients.some(item => item.name.trim().length < 2) || dto.steps.some(step => step.trim().length < 2)) throw new BadRequestException("Preencha nomes e etapas com pelo menos dois caracteres.");
    return this.prisma.$transaction(async tx => {
      const lines = [];
      for (const item of dto.ingredients) {
        const alias = await tx.ingredientAlias.findUnique({ where: { normalizedName: normalizeRecipeIngredient(item.name) }, include: { ingredient: true } });
        const ingredient = alias?.ingredient ?? await tx.ingredient.upsert({ where: { slug: slugify(item.name) }, update: {}, create: { slug: slugify(item.name), name: item.name.trim(), baseUnit: item.unit } });
        if (ingredient.baseUnit !== item.unit) throw new BadRequestException(`Use ${ingredient.baseUnit} para ${ingredient.name}.`);
        await tx.ingredientAlias.upsert({ where: { normalizedName: normalizeRecipeIngredient(item.name) }, update: {}, create: { normalizedName: normalizeRecipeIngredient(item.name), ingredientId: ingredient.id } });
        lines.push({ ingredientId: ingredient.id, position: lines.length + 1, quantity: item.quantity, baseQuantity: item.quantity, unit: item.unit });
      }
      return tx.recipe.create({ data: { status: dto.publish === true ? "published" : "draft", visibility: dto.publish === true ? "public" : "private", publishedAt: dto.publish === true ? new Date() : null, authorId: userId, title: dto.title.trim(), slug: `${slugify(dto.title).slice(0, 70)}-${randomUUID()}`, description: dto.description.trim(), servings: dto.servings, prepMinutes: dto.prepMinutes, cookMinutes: dto.cookMinutes, caloriesPerServing: dto.caloriesPerServing, nutritionSource: dto.caloriesPerServing != null ? dto.nutritionSource!.trim() : null, tags: { connectOrCreate: (dto.mealTypes ?? []).map(meal => ({ where: { slug: `meal-${meal}` }, create: { slug: `meal-${meal}`, kind: "meal", name: meal } })) }, origin: "user_created", ingredients: { create: lines }, steps: { create: dto.steps.map((instruction, index) => ({ instruction: instruction.trim(), position: index + 1 })) } }, select: { id: true, title: true } });
    });
  }
  async list(userId: string, q = "") {
    const [recipes, stock] = await Promise.all([
      this.prisma.recipe.findMany({ where: { AND: [accessible(userId), { title: { contains: q.slice(0, 120), mode: "insensitive" } }] }, include: recipeInclude, orderBy: { updatedAt: "desc" }, take: 100 }),
      this.prisma.pantryItem.findMany({ where: { userId } }),
    ]);
    const pantry = new Map(stock.map(item => [item.ingredientId, Number(item.quantity)]));
    return recipes.map(recipe => {
      const plan = calculateRecipePlan(recipe.ingredients, Number(recipe.servings), Number(recipe.servings), pantry);
      return { id: recipe.id, title: recipe.title, description: recipe.description, servings: Number(recipe.servings), minutes: recipe.prepMinutes + recipe.cookMinutes, own: recipe.authorId === userId, caloriesPerServing: recipe.caloriesPerServing == null ? null : Number(recipe.caloriesPerServing), nutritionSource: recipe.nutritionSource, mealTypes: recipe.tags.filter(tag => tag.kind === "meal").map(tag => tag.slug.replace(/^meal-/, "")), requiredIngredients: plan.length, availableIngredients: plan.filter(item => item.available > 0).length, coveredIngredients: plan.filter(item => item.covered).length, missingIngredients: plan.filter(item => item.missing === null || item.missing > 0).length };
    }).sort((a, b) => b.coveredIngredients / (b.requiredIngredients || 1) - a.coveredIngredients / (a.requiredIngredients || 1) || b.availableIngredients - a.availableIngredients);
  }
  private async recipe(userId: string, id: string) {
    const recipe = await this.prisma.recipe.findFirst({ where: { AND: [{ id }, accessible(userId)] }, include: recipeInclude });
    if (!recipe) throw new NotFoundException("Receita não encontrada.");
    return recipe;
  }
  async detail(userId: string, id: string) {
    const recipe = await this.recipe(userId, id);
    return { id: recipe.id, slug: recipe.slug, visibility: recipe.visibility, status: recipe.status, title: recipe.title, description: recipe.description, servings: Number(recipe.servings), prepMinutes: recipe.prepMinutes, cookMinutes: recipe.cookMinutes, own: recipe.authorId === userId, origin: recipe.origin, sourceUrl: recipe.sourceUrl, attribution: recipe.attribution, reviewedBy: recipe.reviewedBy, caloriesPerServing: recipe.caloriesPerServing == null ? null : Number(recipe.caloriesPerServing), nutritionSource: recipe.nutritionSource, ingredients: recipe.ingredients.map(item => ({ name: item.ingredient.name, quantity: item.quantity === null ? null : Number(item.quantity), unit: item.unit, optional: item.optional, note: item.note })), steps: recipe.steps.map(step => step.instruction) };
  }
  async preview(userId: string, id: string, dto: RecipePlanDto) {
    const recipe = await this.recipe(userId, id);
    const stock = dto.usePantry === false ? [] : await this.prisma.pantryItem.findMany({ where: { userId } });
    return { title: recipe.title, servings: dto.servings, ingredients: calculateRecipePlan(recipe.ingredients, Number(recipe.servings), dto.servings, new Map(stock.map(item => [item.ingredientId, Number(item.quantity)]))) };
  }
  async createList(userId: string, id: string, dto: RecipePlanDto) {
    const preview = await this.preview(userId, id, dto);
    if (preview.ingredients.some(item => item.unknown)) throw new BadRequestException("A receita tem quantidades sem conversão conhecida. Confirme as quantidades antes de gerar a lista.");
    const missing = preview.ingredients.filter(item => item.missing! > 0);
    if (!missing.length) throw new BadRequestException("A despensa cobre os ingredientes. Desmarque o uso da despensa para criar uma lista completa.");
    if (missing.some(item => item.missing! > 1000000)) throw new BadRequestException("Quantidade muito alta. Confira as porções da receita.");
    return this.prisma.$transaction(async tx => {
      const list = await tx.marketList.create({ data: { userId, name: (dto.name?.trim() || `Ingredientes: ${preview.title}`).slice(0, 120), description: `Receita: ${preview.title}. ${dto.servings} porções. Confira o estoque e as quantidades antes de comprar.`.slice(0, 500), members: { create: { userId, role: "owner", status: "accepted", acceptedAt: new Date() } }, items: { create: missing.map(item => ({ ingredientId: item.ingredientId, productName: item.name, unit: item.unit as "g" | "ml" | "un", expectedQuantity: item.missing!, notes: "Quantidade calculada pela receita. Confira embalagem e marca no mercado." })) } }, include: { items: true, members: { include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } } } } });
      return list;
    });
  }
  async caloriePreview(userId: string, dto: CaloriePlanDto) {
    const recipes = await this.prisma.recipe.findMany({ where: { AND: [accessible(userId), { id: { in: dto.recipeIds } }] }, include: recipeInclude });
    if (recipes.length !== dto.recipeIds.length || recipes.some(recipe => recipe.caloriesPerServing === null || !recipe.nutritionSource?.trim())) throw new BadRequestException("Selecione somente receitas acessíveis com calorias por porção e origem informadas.");
    let days;
    try { days = buildCalorieMenu(recipes, dto.targetCalories, dto.days, dto.startDate, dto.meals); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Não foi possível montar o cardápio."); }
    const lines = days.flatMap(day => day.meals.flatMap(meal => {
      const recipe = recipes.find(item => item.id === meal.recipeId)!;
      return calculateRecipePlan(recipe.ingredients, Number(recipe.servings), meal.servings, new Map()).map(item => ({ ingredientId: item.ingredientId, ingredient: { name: item.name, baseUnit: item.unit }, quantity: item.required, baseQuantity: item.required, unit: item.unit, optional: false }));
    }));
    const pantry = dto.usePantry === false ? [] : await this.prisma.pantryItem.findMany({ where: { userId } });
    const ingredients = calculateRecipePlan(lines, 1, 1, new Map(pantry.map(item => [item.ingredientId, Number(item.quantity)])));
    return { targetCalories: dto.targetCalories, days, ingredients, hasDifference: days.some(day => Math.abs(day.difference) > 0.01) };
  }
  async saveCaloriePlan(userId: string, dto: CaloriePlanDto) {
    const plan = await this.caloriePreview(userId, dto);
    if (plan.hasDifference && dto.acceptDifference !== true) throw new BadRequestException("Revise e aceite a diferença entre o total calculado e sua meta antes de salvar.");
    if (plan.ingredients.some(item => item.unknown || item.missing! > 1000000)) throw new BadRequestException("Há ingredientes sem quantidade conhecida ou quantidades muito altas. Revise as receitas.");
    return this.prisma.$transaction(async tx => {
      const name = `Cardápio ${dto.targetCalories} kcal · ${dto.days} dia(s)`;
      const list = await tx.marketList.create({ data: { userId, name, description: "Ingredientes consolidados do cardápio. A meta de calorias é informada pelo usuário; confira receitas, quantidades e estoque antes de comprar.", members: { create: { userId, role: "owner", status: "accepted", acceptedAt: new Date() } }, items: { create: plan.ingredients.filter(item => item.missing! > 0).map(item => ({ ingredientId: item.ingredientId, productName: item.name, unit: item.unit as "g" | "ml" | "un", expectedQuantity: item.missing!, notes: "Quantidade consolidada de todas as refeições do cardápio." })) } }, include: { items: true } });
      const saved = await tx.mealPlan.create({ data: { userId, name, dailyCalorieTarget: dto.targetCalories, shoppingListId: list.id, startDate: new Date(`${plan.days[0].date}T00:00:00Z`), endDate: new Date(`${plan.days[plan.days.length - 1].date}T00:00:00Z`), recipes: { create: plan.days.flatMap(day => day.meals.map(meal => ({ recipeId: meal.recipeId, date: new Date(`${day.date}T00:00:00Z`), meal: meal.meal as "breakfast" | "lunch" | "dinner" | "snack", servings: meal.servings, plannedCalories: meal.calories, titleSnapshot: meal.title }))) } } });
      return { id: saved.id, shoppingListId: list.id };
    });
  }
  savedCaloriePlans(userId: string) {
    return this.prisma.mealPlan.findMany({ where: { userId, dailyCalorieTarget: { not: null } }, select: { id: true, name: true, startDate: true, endDate: true, dailyCalorieTarget: true, shoppingListId: true }, orderBy: { createdAt: "desc" }, take: 30 });
  }
  async savedCaloriePlan(userId: string, id: string) {
    const plan = await this.prisma.mealPlan.findFirst({ where: { id, userId }, include: { recipes: { orderBy: [{ date: "asc" }, { meal: "asc" }], select: { recipeId: true, date: true, meal: true, servings: true, plannedCalories: true, titleSnapshot: true } } } });
    if (!plan) throw new NotFoundException("Cardápio não encontrado.");
    return plan;
  }
  pantry(userId: string) {
    return this.prisma.pantryItem.findMany({ where: { userId }, include: { ingredient: { select: { name: true, baseUnit: true } } }, orderBy: { updatedAt: "desc" } });
  }
  async setPantry(userId: string, ingredientId: string, quantity: number) {
    if (!await this.prisma.ingredient.findFirst({ where: { AND: [{ id: ingredientId }, accessibleIngredient(userId)] } })) throw new NotFoundException("Ingrediente não encontrado.");
    return this.prisma.$transaction(async tx => {
      const row = await tx.pantryItem.upsert({ where: { userId_ingredientId: { userId, ingredientId } }, create: { userId, ingredientId }, update: {} });
      const [locked] = await tx.$queryRaw<Array<{ quantity: Prisma.Decimal }>>`SELECT quantity FROM "PantryItem" WHERE id = ${row.id} FOR UPDATE`;
      const delta = quantity - Number(locked.quantity);
      if (delta !== 0) await tx.pantryMovement.create({ data: { userId, pantryItemId: row.id, kind: "adjustment", quantityDelta: delta, note: "Estoque confirmado pelo usuário." } });
      return tx.pantryItem.update({ where: { id: row.id }, data: { quantity, confirmedAt: new Date() } });
    });
  }
  async recentPurchases(userId: string) {
    const rows = await this.prisma.purchaseItem.findMany({ where: { pricePaid: { gt: 0 }, quantity: { gt: 0 }, purchase: { AND: [purchaseAccessWhere(userId), { status: "completed", deletedAt: null, completedAt: { gte: new Date(Date.now() - 60 * 86400000) } }] } }, select: { id: true, productName: true, ingredientId: true, quantity: true, unit: true, packageSize: true, packageUnit: true, purchase: { select: { completedAt: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
    const aliases = await this.prisma.ingredientAlias.findMany({ where: { normalizedName: { in: rows.map(item => normalizeRecipeIngredient(item.productName)) } }, include: { ingredient: true } });
    const matched = new Map(aliases.map(alias => [alias.normalizedName, alias.ingredient]));
    const confirmed = await this.prisma.pantryMovement.findMany({ where: { userId, sourcePurchaseItemId: { in: rows.map(item => item.id) } }, select: { sourcePurchaseItemId: true } });
    return rows.map(item => { const candidate = matched.get(normalizeRecipeIngredient(item.productName)); return { ...item, suggestedIngredientId: item.ingredientId ?? candidate?.id ?? null, confirmed: confirmed.some(entry => entry.sourcePurchaseItemId === item.id) }; });
  }
  async confirmPurchase(userId: string, sourceId: string, dto: ConfirmPurchaseIngredientDto) {
    if (dto.quantity <= 0) throw new BadRequestException("Informe a quantidade que ainda tem, maior que zero.");
    const source = await this.prisma.purchaseItem.findFirst({ where: { id: sourceId, quantity: { gt: 0 }, pricePaid: { gt: 0 }, purchase: { AND: [purchaseAccessWhere(userId), { status: "completed", deletedAt: null }] } } });
    if (!source) throw new NotFoundException("Compra finalizada não encontrada.");
    const ingredient = await this.prisma.ingredient.findFirst({ where: { AND: [{ id: dto.ingredientId }, accessibleIngredient(userId)] } });
    if (!ingredient) throw new NotFoundException("Ingrediente não encontrado.");
    const bought = knownBaseAmount(source.quantity, source.unit, ingredient.baseUnit, source.packageSize, source.packageUnit);
    if (bought === null || dto.quantity > bought) throw new BadRequestException("Não há conversão conhecida ou a quantidade restante excede a comprada. Confirme esse estoque manualmente.");
    try {
      return await this.prisma.$transaction(async tx => {
        const previous = await tx.pantryMovement.findUnique({ where: { userId_sourcePurchaseItemId: { userId, sourcePurchaseItemId: sourceId } } });
        if (previous) return { alreadyConfirmed: true };
        const row = await tx.pantryItem.upsert({ where: { userId_ingredientId: { userId, ingredientId: ingredient.id } }, create: { userId, ingredientId: ingredient.id }, update: {} });
        await tx.$queryRaw`SELECT id FROM "PantryItem" WHERE id = ${row.id} FOR UPDATE`;
        await tx.pantryMovement.create({ data: { userId, pantryItemId: row.id, kind: "entry", quantityDelta: dto.quantity, sourcePurchaseItemId: sourceId } });
        await tx.pantryItem.update({ where: { id: row.id }, data: { quantity: { increment: dto.quantity }, confirmedAt: new Date() } });
        return { alreadyConfirmed: false };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && await this.prisma.pantryMovement.findUnique({ where: { userId_sourcePurchaseItemId: { userId, sourcePurchaseItemId: sourceId } } })) return { alreadyConfirmed: true };
      throw error;
    }
  }
}
