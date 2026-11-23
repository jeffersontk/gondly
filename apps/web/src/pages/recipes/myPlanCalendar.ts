export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftMonth(date: string, amount: number) {
  const [year, month] = date.split("-").map(Number);
  return localDateKey(new Date(year, month - 1 + amount, 1, 12));
}
export function monthCells(date: string): (string | null)[] {
  const [year, month] = date.split("-").map(Number);
  const offset = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7;
  const days = new Date(year, month, 0, 12).getDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= days ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
  });
}
const order = ["breakfast", "lunch", "snack", "dinner"];
export function mealsForDate<T extends { date: string; meal: string }>(meals: T[], date: string): T[] {
  return meals.filter(meal => meal.date.slice(0, 10) === date).sort((a, b) => order.indexOf(a.meal) - order.indexOf(b.meal));
}
