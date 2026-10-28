import { Injectable } from "@nestjs/common";
import { Prisma, Unit } from "@prisma/client";
import { roundMoney } from "@gondly/utils";
import { startOfMonth } from "../common/utils/date";
import { toNumber } from "../common/utils/money";
import { PrismaService } from "../prisma/prisma.service";
import { purchaseAccessWhere } from "../purchases/purchase-access";
import { ReportFiltersDto } from "./dto";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportHistory(userId: string, filters: ReportFiltersDto = {}) {
    const { pricePaid: _pricePaid, ...scope } = this.purchaseItemWhere(userId, undefined, filters);
    const where: Prisma.PurchaseItemWhereInput = {
      ...scope,
      ...(filters.q ? { OR: [{ productName: { contains: filters.q, mode: "insensitive" } }, { purchase: { market: { name: { contains: filters.q, mode: "insensitive" } } } }] } : {}),
    };
    const items = await this.prisma.purchaseItem.findMany({ where, include: { purchase: { include: { market: true } } }, orderBy: { purchase: { completedAt: "desc" } } });
    const cell = (value: unknown) => {
      let text = String(value ?? "");
      if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows: unknown[][] = [["purchase_id", "completed_at_utc", "market", "product", "category", "brand", "quantity", "quantity_unit", "package_size", "package_unit", "paid_brl", "normalized_price_brl", "comparison_unit", "source", "purchase_final_paid_brl_repeated_per_item", "purchase_discount_brl_repeated_per_item"]];
    for (const item of items) rows.push([
      item.purchaseId, item.purchase.completedAt?.toISOString() ?? "", item.purchase.market?.name,
      item.productName, item.category, item.brandNameSnapshot ?? item.brand, item.quantity, item.unit, item.packageSize, item.packageUnit,
      toNumber(item.pricePaid).toFixed(2), item.unitPriceNormalized === null ? "" : toNumber(item.unitPriceNormalized).toFixed(4), item.normalizedUnitLabel, "personal",
      item.purchase.finalPaidAmount == null ? "" : toNumber(item.purchase.finalPaidAmount).toFixed(2),
      item.purchase.discountAmount == null ? "" : toNumber(item.purchase.discountAmount).toFixed(2),
    ]);
    return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
  }

  async dashboard(userId: string, filters: ReportFiltersDto = {}) {
    const monthStart = startOfMonth();
    const monthFilters = { ...filters, startDate: filters.startDate ?? monthStart.toISOString(), period: filters.period ?? "all" };
    const [lastPurchase, monthPurchases, allItems] = await Promise.all([
      this.prisma.purchase.findFirst({
        where: this.purchaseWhere(userId, filters),
        include: { market: true, items: true },
        orderBy: { completedAt: "desc" },
      }),
      this.prisma.purchase.findMany({
        where: this.purchaseWhere(userId, monthFilters),
        include: { market: true, items: true },
      }),
      this.purchaseItems(userId, undefined, filters),
    ]);

    const totalSpentMonth = roundMoney(
      monthPurchases.reduce((sum, purchase) => sum + toNumber(purchase.finalPaidAmount ?? purchase.subtotalCalculated), 0),
    );
    const marketTotals = new Map<string, { market: string; count: number }>();
    const productTotals = new Map<string, number>();

    for (const purchase of monthPurchases) {
      if (purchase.market) {
        const current = marketTotals.get(purchase.market.id) ?? { market: purchase.market.name, count: 0 };
        current.count += 1;
        marketTotals.set(purchase.market.id, current);
      }
    }

    for (const item of allItems) {
      productTotals.set(item.productName, (productTotals.get(item.productName) ?? 0) + item.quantity);
    }

    const favoriteMarket = [...marketTotals.values()].sort((a, b) => b.count - a.count)[0]?.market ?? null;
    const mostPurchasedProduct = [...productTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const estimatedSavings = roundMoney(
      monthPurchases.reduce((sum, purchase) => sum + Math.max(toNumber(purchase.discountAmount), 0), 0),
    );

    return {
      lastPurchase,
      totalSpentMonth,
      monthPurchasesCount: monthPurchases.length,
      favoriteMarket,
      mostPurchasedProduct,
      estimatedSavings,
    };
  }

  async monthlySpending(userId: string, filters: ReportFiltersDto = {}) {
    const purchases = await this.prisma.purchase.findMany({
      where: this.purchaseWhere(userId, filters),
      orderBy: { completedAt: "asc" },
    });

    const totals = new Map<string, number>();
    for (const purchase of purchases) {
      const date = purchase.completedAt ?? purchase.updatedAt;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      totals.set(key, (totals.get(key) ?? 0) + toNumber(purchase.finalPaidAmount ?? purchase.subtotalCalculated));
    }

    return [...totals.entries()].map(([month, total]) => ({ month, total: roundMoney(total) }));
  }

  async marketsRanking(userId: string, filters: ReportFiltersDto = {}) {
    const purchases = await this.prisma.purchase.findMany({
      where: { ...this.purchaseWhere(userId, filters), marketId: filters.marketId ?? { not: null } },
      include: { market: true },
    });

    const grouped = new Map<string, { marketId: string; marketName: string; total: number; purchases: number }>();
    for (const purchase of purchases) {
      if (!purchase.market) continue;
      const entry = grouped.get(purchase.market.id) ?? {
        marketId: purchase.market.id,
        marketName: purchase.market.name,
        total: 0,
        purchases: 0,
      };
      entry.total += toNumber(purchase.finalPaidAmount ?? purchase.subtotalCalculated);
      entry.purchases += 1;
      grouped.set(purchase.market.id, entry);
    }

    return [...grouped.values()]
      .map((entry) => ({ ...entry, total: roundMoney(entry.total), averageTicket: roundMoney(entry.total / entry.purchases) }))
      .sort((a, b) => b.total - a.total);
  }

  async mostPurchasedProducts(userId: string, filters: ReportFiltersDto = {}) {
    const items = await this.purchaseItems(userId, undefined, filters);
    const grouped = new Map<string, { productName: string; quantity: number; totalSpent: number }>();

    for (const item of items) {
      const entry = grouped.get(item.productName) ?? { productName: item.productName, quantity: 0, totalSpent: 0 };
      entry.quantity += item.quantity;
      entry.totalSpent += toNumber(item.pricePaid);
      grouped.set(item.productName, entry);
    }

    return [...grouped.values()]
      .map((entry) => ({ ...entry, totalSpent: roundMoney(entry.totalSpent) }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);
  }

  async highestPriceVariation(userId: string, filters: ReportFiltersDto = {}) {
    const grouped = await this.groupNormalizedPrices(userId, undefined, filters);
    return grouped
      .map((entry) => ({
        ...entry,
        variation: entry.maxPrice !== null && entry.minPrice !== null ? roundMoney(entry.maxPrice - entry.minPrice) : 0,
      }))
      .sort((a, b) => b.variation - a.variation)
      .slice(0, 20);
  }

  async insights(userId: string, filters: ReportFiltersDto = {}) {
    const [monthly, markets, products, variation, purchasesCount, lastPurchase] = await Promise.all([
      this.monthlySpending(userId, filters),
      this.marketsRanking(userId, filters),
      this.mostPurchasedProducts(userId, filters),
      this.highestPriceVariation(userId, filters),
      this.prisma.purchase.count({ where: this.purchaseWhere(userId, filters) }),
      this.prisma.purchase.findFirst({
        where: this.purchaseWhere(userId, filters),
        include: { market: true },
        orderBy: { completedAt: "desc" },
      }),
    ]);

    return {
      monthly,
      markets,
      products,
      variation,
      purchasesCount,
      lastPurchase: lastPurchase ? { marketName: lastPurchase.market?.name ?? null, completedAt: lastPurchase.completedAt } : null,
    };
  }

  async mostExpensiveProducts(userId: string, filters: ReportFiltersDto = {}) {
    const grouped = await this.groupNormalizedPrices(userId, undefined, filters);
    return grouped.sort((a, b) => (b.averagePrice ?? 0) - (a.averagePrice ?? 0)).slice(0, 20);
  }

  async productsPriceComparison(userId: string, q?: string, filters: ReportFiltersDto = {}) {
    const grouped = await this.groupNormalizedPrices(userId, q, filters);
    return grouped.sort((a, b) => (a.minPrice ?? Number.MAX_SAFE_INTEGER) - (b.minPrice ?? Number.MAX_SAFE_INTEGER));
  }

  async productPriceHistory(userId: string, productId: string, filters: ReportFiltersDto = {}) {
    return this.prisma.purchaseItem.findMany({
      where: this.purchaseItemWhere(userId, undefined, { ...filters, productId }),
      include: { purchase: { include: { market: true } } },
      orderBy: { purchase: { completedAt: "asc" } },
    });
  }

  async productPriceDetails(userId: string, productId: string, filters: ReportFiltersDto = {}) {
    const [history, markets] = await Promise.all([
      this.productPriceHistory(userId, productId, filters),
      this.productMarketsComparison(userId, productId, filters),
    ]);
    const best = new Set(markets.map(entry => entry.comparisonKey)).size <= 1 ? [...markets].sort((a, b) => a.averagePrice - b.averagePrice)[0] ?? null : null;

    return { history, markets, best };
  }

  async productMarketsComparison(userId: string, productId: string, filters: ReportFiltersDto = {}) {
    const items = await this.prisma.purchaseItem.findMany({
      where: {
        ...this.purchaseItemWhere(userId, undefined, { ...filters, productId }),
        unitPriceNormalized: { not: null },
        purchase: { ...this.purchaseWhere(userId, filters), marketId: filters.marketId ?? { not: null } },
      },
      include: { purchase: { include: { market: true } } },
      orderBy: { purchase: { completedAt: "asc" } },
    });

    const grouped = new Map<string, { marketId: string; marketName: string; prices: number[]; lastPrice: number; comparisonKey: string; normalizedUnit: string | null; brandName: string | null; packageSize: number | null; packageUnit: Unit | null; lastPurchasedAt: Date }>();
    for (const item of items) {
      if (!item.purchase.market || item.unitPriceNormalized === null) continue;
      const normalizedPrice = toNumber(item.unitPriceNormalized);
      const comparisonKey = JSON.stringify([item.normalizedUnitLabel, item.brandNameSnapshot ?? item.brand, item.packageSize, item.packageUnit]);
      const key = item.purchase.market.id + comparisonKey;
      const entry = grouped.get(key) ?? {
        marketId: item.purchase.market.id,
        marketName: item.purchase.market.name,
        prices: [],
        lastPrice: normalizedPrice,
        comparisonKey,
        normalizedUnit: item.normalizedUnitLabel,
        brandName: item.brandNameSnapshot ?? item.brand,
        packageSize: item.packageSize,
        packageUnit: item.packageUnit,
        lastPurchasedAt: item.purchase.completedAt ?? item.createdAt,
      };
      entry.prices.push(normalizedPrice);
      entry.lastPrice = normalizedPrice;
      entry.lastPurchasedAt = item.purchase.completedAt ?? item.createdAt;
      grouped.set(key, entry);
    }

    return [...grouped.values()].map((entry) => ({
      marketId: entry.marketId,
      marketName: entry.marketName,
      minPrice: roundMoney(Math.min(...entry.prices)),
      maxPrice: roundMoney(Math.max(...entry.prices)),
      averagePrice: roundMoney(entry.prices.reduce((sum, value) => sum + value, 0) / entry.prices.length),
      lastPrice: entry.lastPrice,
      comparisonKey: entry.comparisonKey,
      normalizedUnit: entry.normalizedUnit,
      brandName: entry.brandName,
      packageSize: entry.packageSize,
      packageUnit: entry.packageUnit,
      lastPurchasedAt: entry.lastPurchasedAt,
      samplesCount: entry.prices.length,
      source: "personal",
    }));
  }

  async productBestMarket(userId: string, productId: string, filters: ReportFiltersDto = {}) {
    const markets = await this.productMarketsComparison(userId, productId, filters);
    if (new Set(markets.map(entry => entry.comparisonKey)).size > 1) return null;
    return markets.sort((a, b) => a.averagePrice - b.averagePrice)[0] ?? null;
  }

  private purchaseItems(userId: string, q?: string, filters: ReportFiltersDto = {}) {
    return this.prisma.purchaseItem.findMany({
      where: this.purchaseItemWhere(userId, q, filters),
      include: { purchase: { include: { market: true } } },
      orderBy: { purchase: { completedAt: "desc" } },
    });
  }

  private async groupNormalizedPrices(userId: string, q?: string, filters: ReportFiltersDto = {}) {
    const items = await this.purchaseItems(userId, q, filters);
    const grouped = new Map<
      string,
      {
        productName: string;
        productId: string | null;
        normalizedUnit: string | null;
        prices: number[];
        lastPrice: number | null;
        lastMarket: string | null;
        lastPurchasedAt: Date | null;
        category: string | null;
        brandName: string | null;
        packageSize: number | null;
        packageUnit: Unit | null;
        purchaseIds: Set<string>;
      }
    >();

    for (const item of items) {
      const key = JSON.stringify([item.productId ?? item.productName, item.brandNameSnapshot ?? item.brand ?? null, item.packageSize, item.packageUnit, item.normalizedUnitLabel]);
      const entry = grouped.get(key) ?? {
        productName: item.productName,
        productId: item.productId,
        normalizedUnit: item.normalizedUnitLabel,
        prices: [],
        lastPrice: null,
        lastMarket: null,
        lastPurchasedAt: null,
        category: null,
        brandName: null,
        packageSize: null,
        packageUnit: null,
        purchaseIds: new Set<string>(),
      };

      entry.purchaseIds.add(item.purchaseId);

      if (!entry.lastPurchasedAt) {
        entry.lastPurchasedAt = item.purchase.completedAt ?? item.createdAt;
        entry.lastMarket = item.purchase.market?.name ?? null;
        entry.category = item.category ?? null;
        entry.brandName = item.brandNameSnapshot ?? item.brand ?? null;
        entry.packageSize = item.packageSize ?? null;
        entry.packageUnit = item.packageUnit ?? null;
      }

      if (item.unitPriceNormalized !== null) {
        const normalizedPrice = toNumber(item.unitPriceNormalized);
        entry.prices.push(normalizedPrice);
        if (entry.lastPrice === null) {
          entry.lastPrice = normalizedPrice;
        }
      }

      grouped.set(key, entry);
    }

    return [...grouped.values()].map((entry) => ({
      productName: entry.productName,
      productId: entry.productId,
      normalizedUnit: entry.normalizedUnit,
      source: "personal",
      samplesCount: entry.prices.length,
      category: entry.category,
      brandName: entry.brandName,
      packageSize: entry.packageSize,
      packageUnit: entry.packageUnit,
      minPrice: entry.prices.length ? roundMoney(Math.min(...entry.prices)) : null,
      maxPrice: entry.prices.length ? roundMoney(Math.max(...entry.prices)) : null,
      averagePrice: entry.prices.length ? roundMoney(entry.prices.reduce((sum, value) => sum + value, 0) / entry.prices.length) : null,
      lastPrice: entry.lastPrice,
      lastMarket: entry.lastMarket,
      lastPurchasedAt: entry.lastPurchasedAt,
      purchasesCount: entry.purchaseIds.size,
    }));
  }

  private purchaseItemWhere(userId: string, q?: string, filters: ReportFiltersDto = {}): Prisma.PurchaseItemWhereInput {
    return {
      pricePaid: { gt: 0 },
      ...(filters.category ? { category: filters.category } : {}),
      ...(q ? { productName: { contains: q, mode: "insensitive" } } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
      purchase: this.purchaseWhere(userId, filters),
    };
  }

  private purchaseWhere(userId: string, filters: ReportFiltersDto = {}): Prisma.PurchaseWhereInput {
    const completedAt = this.dateFilter(filters);
    return {
      ...purchaseAccessWhere(userId),
      status: "completed",
      deletedAt: null,
      ...(filters.marketId ? { marketId: filters.marketId } : {}),
      ...((filters.productId || filters.category) ? { items: { some: { ...(filters.productId ? { productId: filters.productId } : {}), ...(filters.category ? { category: filters.category } : {}) } } } : {}),
      ...(completedAt ? { completedAt } : {}),
    };
  }

  private dateFilter(filters: ReportFiltersDto): Prisma.DateTimeNullableFilter | undefined {
    const start = filters.startDate ? new Date(filters.startDate) : this.periodStart(filters.period);
    const end = filters.endDate ? new Date(filters.endDate) : undefined;
    if (end && /^\d{4}-\d{2}-\d{2}$/.test(filters.endDate!)) end.setUTCHours(23, 59, 59, 999);

    if (!start && !end) {
      return undefined;
    }

    return {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    };
  }

  private periodStart(period?: ReportFiltersDto["period"]) {
    if (!period || period === "all") {
      return undefined;
    }

    const date = new Date();
    if (period === "30d") date.setDate(date.getDate() - 30);
    if (period === "90d") date.setDate(date.getDate() - 90);
    if (period === "6m") date.setMonth(date.getMonth() - 6);
    if (period === "1y") date.setFullYear(date.getFullYear() - 1);
    return date;
  }
}
