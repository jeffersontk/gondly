import { roundMoney } from "@gondly/utils";
import { toNumber, type NumericLike } from "../common/utils/money";
import { normalizeSearchName } from "../common/utils/normalize";

type BudgetItem = {
  id: string; productId?: string | null; productName: string; brandId?: string | null; brand?: string | null;
  brandNameSnapshot?: string | null; packageSize?: number | null; packageUnit?: string | null;
  quantity: number; unit: string; pricePaid: NumericLike;
};
type HistoricalItem = BudgetItem & { purchase: { completedAt: Date | null; market?: { name: string } | null } };

export function calculatePurchaseBudget(purchase: {
  status: string; budgetAmount?: NumericLike; subtotalCalculated: NumericLike; finalPaidAmount?: NumericLike; items: BudgetItem[];
}, history: HistoricalItem[]) {
  const budgetAmount = purchase.budgetAmount == null ? null : toNumber(purchase.budgetAmount);
  const confirmedAmount = toNumber(purchase.status === "completed" && purchase.finalPaidAmount != null ? purchase.finalPaidAmount : purchase.subtotalCalculated);
  const remaining = purchase.status === "in_progress" ? purchase.items.filter(item => toNumber(item.pricePaid) <= 0) : [];
  const newest = [...history].filter(item => item.quantity > 0 && toNumber(item.pricePaid) > 0 && item.purchase.completedAt)
    .sort((a, b) => b.purchase.completedAt!.getTime() - a.purchase.completedAt!.getTime());
  const references = remaining.map(item => {
    const previous = newest.find(candidate => compatible(item, candidate));
    return {
      itemId: item.id, productName: item.productName, quantity: item.quantity, unit: item.unit,
      estimate: previous ? roundMoney(toNumber(previous.pricePaid) / previous.quantity * item.quantity) : null,
      referenceAt: previous?.purchase.completedAt?.toISOString() ?? null,
      marketName: previous?.purchase.market?.name ?? null,
      source: previous ? "purchase_history" as const : null,
    };
  });
  const unknownItemsCount = references.filter(item => item.estimate === null).length;
  const estimatedRemaining = roundMoney(references.reduce((total, item) => total + (item.estimate ?? 0), 0));
  const estimatedTotal = roundMoney(confirmedAmount + estimatedRemaining);
  return {
    budgetAmount, confirmedAmount, estimatedRemaining, estimatedTotal, unknownItemsCount,
    knownItemsCount: references.length - unknownItemsCount, remainingItemsCount: references.length,
    remainingAfterConfirmed: budgetAmount === null ? null : roundMoney(budgetAmount - confirmedAmount),
    estimatedBalance: budgetAmount === null || unknownItemsCount ? null : roundMoney(budgetAmount - estimatedTotal),
    exceeded: budgetAmount !== null && estimatedTotal > budgetAmount,
    references,
  };
}

function compatible(item: BudgetItem, previous: BudgetItem) {
  const sameProduct = item.productId ? item.productId === previous.productId : normalizeSearchName(item.productName) === normalizeSearchName(previous.productName);
  const brand = (value: BudgetItem) => value.brandId ?? normalizeSearchName(value.brandNameSnapshot ?? value.brand ?? "");
  return sameProduct && brand(item) === brand(previous) && item.unit === previous.unit
    && (item.packageSize ?? null) === (previous.packageSize ?? null) && (item.packageUnit ?? null) === (previous.packageUnit ?? null);
}
