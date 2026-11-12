import type { HouseholdMember } from "@gondly/types";

export const ADULT_PORTION_REFERENCE = {
  title: "Dietary Guidelines for Americans 2020–2025, tabela A2-2, pp. 140–141",
  url: "https://odphp.health.gov/sites/default/files/2026-02/dietary_guidelines_for_americans-2020-2025.pdf",
  baselineKcal: 2000,
};
// Upper age bound, then sedentary/moderately active/active for males and females.
// Historical population energy estimates; not validated ingredient weights.
const adultRows: Array<[number, number[], number[]]> = [
  [18, [2400, 2800, 3200], [1800, 2000, 2400]],
  [20, [2600, 2800, 3000], [2000, 2200, 2400]],
  [25, [2400, 2800, 3000], [2000, 2200, 2400]],
  [30, [2400, 2600, 3000], [1800, 2000, 2400]],
  [35, [2400, 2600, 3000], [1800, 2000, 2200]],
  [40, [2400, 2600, 2800], [1800, 2000, 2200]],
  [45, [2200, 2600, 2800], [1800, 2000, 2200]],
  [50, [2200, 2400, 2800], [1800, 2000, 2200]],
  [55, [2200, 2400, 2800], [1600, 1800, 2200]],
  [60, [2200, 2400, 2600], [1600, 1800, 2200]],
  [65, [2000, 2400, 2600], [1600, 1800, 2000]],
  [70, [2000, 2200, 2600], [1600, 1800, 2000]],
  [75, [2000, 2200, 2600], [1600, 1800, 2000]],
  [120, [2000, 2200, 2400], [1600, 1800, 2000]],
];
export function ageBandForYears(age: number): HouseholdMember["ageBand"] {
  return age < 3 ? "under_3" : age <= 5 ? "3_5" : age <= 12 ? "6_12" : age <= 17 ? "13_17" : age <= 59 ? "18_59" : "60_plus";
}
export function householdPortion(member: HouseholdMember): { multiplier: number | null; referenceKcal: number | null; reason: string } {
  if (member.portionMode !== "reference") return { multiplier: ({ small: 0.75, medium: 1, large: 1.25 })[member.portion], referenceKcal: null, reason: "Porção manual informada por você." };
  const age = member.ageYears;
  const sex = member.biologicalSex;
  const activity = ["sedentary", "moderate", "active"].indexOf(member.activityLevel ?? "");
  if (!Number.isInteger(age) || age === undefined || age < 18 || age > 120) return { multiplier: null, referenceKcal: null, reason: "A referência geral exige idade inteira de 18 anos ou mais. Use porção manual fora desse escopo." };
  if (sex !== "male" && sex !== "female" || activity < 0) return { multiplier: null, referenceKcal: null, reason: "Informe sexo de referência e atividade, ou escolha porção manual." };
  const row = adultRows.find(([upperAge]) => age <= upperAge)!;
  const kcal = row[sex === "male" ? 1 : 2][activity];
  return { multiplier: kcal / ADULT_PORTION_REFERENCE.baselineKcal, referenceKcal: kcal, reason: "Referência energética populacional; proporção usada apenas como aproximação de compras." };
}
