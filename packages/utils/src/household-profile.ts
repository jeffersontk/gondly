import type { HouseholdMember, HouseholdPlanningProfile, DietType, DietRestriction } from "@gondly/types";
const dietValues: Record<DietType, true> = { balanced: true, vegetarian: true, vegan: true, low_carb: true, gluten_free: true, lactose_free: true };
const restrictionValues: Record<DietRestriction, true> = { no_red_meat: true, no_pork: true, no_seafood: true, no_dairy: true, no_gluten: true, no_eggs: true, no_nuts: true, low_sugar: true };
const dietTypes = Object.keys(dietValues);
const dietRestrictions = Object.keys(restrictionValues);

export function defaultHouseholdMember(): HouseholdMember {
  return { ageBand: "not_informed", gender: "not_informed", portion: "medium", mealsPerWeek: { breakfast: 7, lunch: 7, dinner: 7, snack: 7 } };
}
export function validateHouseholdProfile(input: unknown): HouseholdPlanningProfile {
  const invalid = () => { throw new Error("Perfil inválido. Confira pessoas, refeições e preferências."); };
  const object = (value: unknown, keys: string[]): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
  if (!object(input, ["version", "members", "periodDays", "dietType", "restrictions"])) return invalid();
  if (input.version !== 1 || ![7, 15, 30].includes(input.periodDays) || !dietTypes.includes(input.dietType) || !Array.isArray(input.members) || input.members.length < 1 || input.members.length > 20 || !Array.isArray(input.restrictions) || input.restrictions.length > dietRestrictions.length || new Set(input.restrictions).size !== input.restrictions.length || input.restrictions.some((r: any) => !dietRestrictions.includes(r))) return invalid();
  for (const member of input.members) {
    if (!object(member, ["ageBand", "gender", "portion", "mealsPerWeek"]) || !["not_informed", "under_3", "3_5", "6_12", "13_17", "18_59", "60_plus"].includes(member.ageBand) || !["not_informed", "woman", "man", "other"].includes(member.gender) || !["small", "medium", "large"].includes(member.portion) || !object(member.mealsPerWeek, ["breakfast", "lunch", "dinner", "snack"])) return invalid();
    for (const meal of ["breakfast", "lunch", "dinner", "snack"]) if (!Number.isInteger(member.mealsPerWeek[meal]) || member.mealsPerWeek[meal] < 0 || member.mealsPerWeek[meal] > 7) return invalid();
  }
  return JSON.parse(JSON.stringify(input)) as HouseholdPlanningProfile;
}
