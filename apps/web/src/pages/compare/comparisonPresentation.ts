import { roundMoney } from "@gondly/utils";

type ComparisonProduct = { productName: string; brandName?: string | null; category?: string | null; categoryName?: string | null };
export const COMPARISON_PAGE_SIZE = 12;

function categoryOf(item: ComparisonProduct) {
  return (item.categoryName ?? item.category)?.trim() || "Sem categoria";
}

export function comparisonCategories(items: ComparisonProduct[]) {
  return [...new Set(items.map(categoryOf))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function filterComparisonProducts<T extends ComparisonProduct>(items: T[], filters: { category?: string; search?: string; brandName?: string }) {
  const term = filters.search?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const brand = filters.brandName?.trim().toLocaleLowerCase("pt-BR");
  return items.filter(item => {
    if (filters.category && categoryOf(item) !== filters.category) return false;
    if (brand && item.brandName?.trim().toLocaleLowerCase("pt-BR") !== brand) return false;
    return !term || [item.productName, item.brandName ?? "", categoryOf(item)].some(value => value.toLocaleLowerCase("pt-BR").includes(term));
  });
}

export function priceRangeVariation(min: number | null | undefined, max: number | null | undefined) {
  if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return null;
  const difference = roundMoney(max - min);
  return { difference, percentage: min > 0 ? roundMoney(difference / min * 100) : difference === 0 ? 0 : null };
}
