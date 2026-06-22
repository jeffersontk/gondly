import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { startOfMonth } from "../common/utils/date";
import { toNumber } from "../common/utils/money";
import { roundMoney } from "../common/utils/normalize-price";
import { PrismaService } from "../prisma/prisma.service";
import { ReportFiltersDto } from "./dto";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const [monthly, markets, products, variation] = await Promise.all([
      this.monthlySpending(userId, filters),
      this.marketsRanking(userId, filters),
      this.mostPurchasedProducts(userId, filters),
      this.highestPriceVariation(userId, filters),
    ]);

    return { monthly, markets, products, variation };
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
      orderBy: { createdAt: "asc" },
    });
  }

  async productPriceDetails(userId: string, productId: string, filters: ReportFiltersDto = {}) {
    const [history, markets] = await Promise.all([
      this.productPriceHistory(userId, productId, filters),
      this.productMarketsComparison(userId, productId, filters),
    ]);
    const best = [...markets].sort((a, b) => a.averagePrice - b.averagePrice)[0] ?? null;

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
    });

    const grouped = new Map<string, { marketId: string; marketName: string; prices: number[]; lastPrice: number }>();
    for (const item of items) {
      if (!item.purchase.market || item.unitPriceNormalized === null) continue;
      const normalizedPrice = toNumber(item.unitPriceNormalized);
      const entry = grouped.get(item.purchase.market.id) ?? {
        marketId: item.purchase.market.id,
        marketName: item.purchase.market.name,
        prices: [],
        lastPrice: normalizedPrice,
      };
      entry.prices.push(normalizedPrice);
      entry.lastPrice = normalizedPrice;
      grouped.set(item.purchase.market.id, entry);
    }

    return [...grouped.values()].map((entry) => ({
      marketId: entry.marketId,
      marketName: entry.marketName,
      minPrice: roundMoney(Math.min(...entry.prices)),
      maxPrice: roundMoney(Math.max(...entry.prices)),
      averagePrice: roundMoney(entry.prices.reduce((sum, value) => sum + value, 0) / entry.prices.length),
      lastPrice: entry.lastPrice,
    }));
  }

  async productBestMarket(userId: string, productId: string, filters: ReportFiltersDto = {}) {
    const markets = await this.productMarketsComparison(userId, productId, filters);
    return markets.sort((a, b) => a.averagePrice - b.averagePrice)[0] ?? null;
  }

  private purchaseItems(userId: string, q?: string, filters: ReportFiltersDto = {}) {
    return this.prisma.purchaseItem.findMany({
      where: this.purchaseItemWhere(userId, q, filters),
      include: { purchase: { include: { market: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  private async groupNormalizedPrices(userId: string, q?: string, filters: ReportFiltersDto = {}) {
    const items = await this.purchaseItems(userId, q, filters);
    const grouped = new Map<string, { productName: string; prices: number[]; lastPrice: number | null; lastMarket: string | null }>();

    for (const item of items) {
      if (item.unitPriceNormalized === null) continue;
      const normalizedPrice = toNumber(item.unitPriceNormalized);
      const entry = grouped.get(item.productName) ?? {
        productName: item.productName,
        prices: [],
        lastPrice: null,
        lastMarket: null,
      };
      entry.prices.push(normalizedPrice);
      if (entry.lastPrice === null) {
        entry.lastPrice = normalizedPrice;
        entry.lastMarket = item.purchase.market?.name ?? null;
      }
      grouped.set(item.productName, entry);
    }

    return [...grouped.values()].map((entry) => ({
      productName: entry.productName,
      minPrice: entry.prices.length ? roundMoney(Math.min(...entry.prices)) : null,
      maxPrice: entry.prices.length ? roundMoney(Math.max(...entry.prices)) : null,
      averagePrice: entry.prices.length ? roundMoney(entry.prices.reduce((sum, value) => sum + value, 0) / entry.prices.length) : null,
      lastPrice: entry.lastPrice,
      lastMarket: entry.lastMarket,
    }));
  }

  private purchaseItemWhere(userId: string, q?: string, filters: ReportFiltersDto = {}): Prisma.PurchaseItemWhereInput {
    return {
      ...(q ? { productName: { contains: q, mode: "insensitive" } } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
      purchase: this.purchaseWhere(userId, filters),
    };
  }

  private purchaseWhere(userId: string, filters: ReportFiltersDto = {}): Prisma.PurchaseWhereInput {
    const completedAt = this.dateFilter(filters);
    return {
      userId,
      status: "completed",
      deletedAt: null,
      ...(filters.marketId ? { marketId: filters.marketId } : {}),
      ...(filters.productId ? { items: { some: { productId: filters.productId } } } : {}),
      ...(completedAt ? { completedAt } : {}),
    };
  }

  private dateFilter(filters: ReportFiltersDto): Prisma.DateTimeNullableFilter | undefined {
    const start = filters.startDate ? new Date(filters.startDate) : this.periodStart(filters.period);
    const end = filters.endDate ? new Date(filters.endDate) : undefined;

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
