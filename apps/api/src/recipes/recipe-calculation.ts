export function normalizeRecipeIngredient(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}
export function knownBaseAmount(quantity: number, unit: string, baseUnit: string, packageSize?: number | null, packageUnit?: string | null): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (["un", "pacote", "caixa"].includes(unit) && packageSize && packageUnit) return knownBaseAmount(quantity * packageSize, packageUnit, baseUnit);
  if (unit === baseUnit) return quantity;
  if (unit === "kg" && baseUnit === "g" || unit === "l" && baseUnit === "ml") return Math.round(quantity * 1000000) / 1000;
  return null;
}
type Line = { ingredientId: string; quantity: unknown; baseQuantity: unknown; unit: string; optional: boolean; ingredient: { name: string; baseUnit: string } };
export function calculateRecipePlan(lines: Line[], originalServings: number, targetServings: number, pantry: Map<string, number>) {
  if (!Number.isFinite(originalServings) || originalServings <= 0 || !Number.isFinite(targetServings) || targetServings <= 0) throw new Error("Invalid servings");
  const grouped = new Map<string, { ingredientId: string; name: string; unit: string; required: number; unknown: boolean }>();
  for (const line of lines.filter(item => !item.optional)) {
    const current = grouped.get(line.ingredientId) ?? { ingredientId: line.ingredientId, name: line.ingredient.name, unit: line.ingredient.baseUnit, required: 0, unknown: false };
    const base = line.baseQuantity == null ? (line.quantity == null ? null : knownBaseAmount(Number(line.quantity), line.unit, line.ingredient.baseUnit)) : Number(line.baseQuantity);
    if (base == null || !Number.isFinite(base) || base <= 0) current.unknown = true;
    else current.required += base * targetServings / originalServings;
    grouped.set(line.ingredientId, current);
  }
  return [...grouped.values()].map(item => {
    const required = item.required > 0 ? Math.max(0.001, Math.ceil((item.required - 1e-9) * 1000) / 1000) : 0;
    const available = Math.max(0, pantry.get(item.ingredientId) ?? 0);
    return { ...item, required: item.unknown ? null : required, available, missing: item.unknown ? null : Math.max(0, Math.round((required - available) * 1000) / 1000), covered: !item.unknown && available >= required };
  });
}
