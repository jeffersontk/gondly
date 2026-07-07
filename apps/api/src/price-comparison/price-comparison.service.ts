import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Unit } from "@prisma/client";
import { getNormalizedUnitLabel, roundMoney } from "@gondly/utils";
import { toNumber } from "../common/utils/money";
import { normalizeSearchName, optionalNumber, optionalText } from "../common/utils/normalize";
import { PrismaService } from "../prisma/prisma.service";
import { PriceLibraryMarketsQueryDto, PriceLibraryQueryDto, PurchaseRegionalPriceComparisonQueryDto, RegionalPriceComparisonQueryDto } from "./dto";

type ComparisonLevel = "exact" | "same_brand" | "similar_product" | "generic";
type ComparisonConfidence = "high" | "medium" | "low";

type QueryContext = {
  productId?: string;
  canonicalProductId?: string;
  productName?: string;
  normalizedProductName?: string;
  brandId?: string;
  categoryId?: string;
  unit?: Unit;
  normalizedUnit?: string | null;
  packageSize?: number;
  packageUnit?: Unit;
  city?: string;
  state?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  periodDays: number;
};

type CandidateExclusions = {
  userId?: string;
  purchaseId?: string;
  marketId?: string | null;
};

type CandidateRecord = Prisma.SharedPriceRecordGetPayload<{
  select: {
    id: true;
    purchaseId: true;
    userId: true;
    marketId: true;
    marketNameSnapshot: true;
    pricePaid: true;
    normalizedPrice: true;
    normalizedUnit: true;
    confidenceScore: true;
    purchasedAt: true;
    createdAt: true;
    market: { select: { name: true } };
  };
}>;

type PurchaseRegionalItem = Prisma.PurchaseItemGetPayload<{ include: { product: true } }>;

type LibraryRecord = Prisma.SharedPriceRecordGetPayload<{
  select: {
    id: true;
    productNameRaw: true;
    normalizedProductName: true;
    brandId: true;
    brandNameSnapshot: true;
    categoryId: true;
    categoryNameSnapshot: true;
    packageSize: true;
    packageUnit: true;
    marketId: true;
    marketNameSnapshot: true;
    pricePaid: true;
    normalizedPrice: true;
    normalizedUnit: true;
    confidenceScore: true;
    purchasedAt: true;
    createdAt: true;
    market: { select: { name: true } };
  };
}>;

type ItemComparison = {
  purchaseItemId: string;
  productName: string;
  brandName: string | null;
  userPaidPrice: number;
  normalizedUserPrice: number | null;
  normalizedUnit: string | null;
  bestRegionalPrice: number;
  avgRegionalPrice: number;
  bestMarketName: string | null;
  recordsCount: number;
  comparisonLevel: ComparisonLevel;
  confidence: ComparisonConfidence;
  lastUpdatedAt: Date | null;
  reportableRecordId: string | null;
  marketEstimates: Array<{
    marketId: string;
    marketName: string;
    estimatedItemTotal: number;
    confidence: ComparisonConfidence;
  }>;
};

@Injectable()
export class PriceComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  async regional(userId: string, query: RegionalPriceComparisonQueryDto) {
    const context = await this.buildContext(userId, query);
    const levels = this.comparisonLevels(context);

    for (const level of levels) {
      const candidates = await this.findCandidates(context, level);
      const records = this.filterOutliers(candidates, (record) => this.comparisonValue(record, context.normalizedUnit));
      if (records.length < 3) continue;

      return this.buildResponse(context, level, records);
    }

    return null;
  }

  async purchaseRegional(userId: string, purchaseId: string, query: PurchaseRegionalPriceComparisonQueryDto) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        status: "completed",
        deletedAt: null,
        OR: [{ userId }, { participants: { some: { userId } } }, { sourceList: { members: { some: { userId, status: "accepted" } } } }],
      },
      include: {
        market: true,
        items: { include: { product: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!purchase) {
      throw new NotFoundException("Purchase not found.");
    }

    const region = {
      city: optionalText(query.city) ?? purchase.market?.city ?? null,
      state: optionalText(query.state)?.toUpperCase() ?? purchase.market?.state ?? null,
      neighborhood: optionalText(query.neighborhood) ?? null,
      radiusKm: optionalNumber(query.radiusKm) ?? null,
    };
    const comparisonRegion = {
      ...region,
      latitude: purchase.market?.latitude ?? null,
      longitude: purchase.market?.longitude ?? null,
    };
    const periodDays = Math.floor(optionalNumber(query.periodDays) ?? 30);
    const validItems = purchase.items.filter((item) => Number(item.quantity) > 0 && toNumber(item.pricePaid) > 0);
    const itemComparisons: ItemComparison[] = [];

    for (const item of validItems) {
      const comparison = await this.comparePurchaseItem({
        item,
        region: comparisonRegion,
        periodDays,
        exclusions: {
          userId,
          purchaseId: purchase.id,
          marketId: purchase.marketId,
        },
      });
      if (comparison) itemComparisons.push(comparison);
    }

    const comparableItemsCount = itemComparisons.length;
    const estimatedMarkets = this.estimatedMarkets({
      itemComparisons,
      originalTotal: toNumber(purchase.finalPaidAmount ?? purchase.subtotalCalculated),
      comparableItemsCount,
    });

    return {
      purchaseId: purchase.id,
      originalMarket: purchase.market
        ? {
            marketId: purchase.market.id,
            marketName: purchase.market.name,
          }
        : null,
      originalTotal: toNumber(purchase.finalPaidAmount ?? purchase.subtotalCalculated),
      region,
      periodDays,
      comparableItemsCount,
      totalItemsCount: validItems.length,
      estimatedMarkets,
      items: itemComparisons.map(({ marketEstimates, ...item }) => item),
    };
  }

  async priceLibrary(query: PriceLibraryQueryDto) {
    const periodDays = Math.floor(optionalNumber(query.periodDays) ?? 30);
    const records = await this.prisma.sharedPriceRecord.findMany({
      where: this.priceLibraryWhere(query, periodDays),
      select: {
        id: true,
        productNameRaw: true,
        normalizedProductName: true,
        brandId: true,
        brandNameSnapshot: true,
        categoryId: true,
        categoryNameSnapshot: true,
        packageSize: true,
        packageUnit: true,
        marketId: true,
        marketNameSnapshot: true,
        pricePaid: true,
        normalizedPrice: true,
        normalizedUnit: true,
        confidenceScore: true,
        purchasedAt: true,
        createdAt: true,
        market: { select: { name: true } },
      },
      orderBy: { purchasedAt: "desc" },
      take: 2500,
    });

    const grouped = new Map<string, LibraryRecord[]>();
    for (const record of records) {
      const key = this.priceLibraryGroupKey(record);
      const current = grouped.get(key) ?? [];
      current.push(record);
      grouped.set(key, current);
    }

    const items = [...grouped.values()]
      .map((groupRecords) => this.buildPriceLibraryItem(groupRecords, periodDays))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return this.sortPriceLibraryItems(items, query.sort ?? "most_recent");
  }

  async priceLibraryMarkets(query: PriceLibraryMarketsQueryDto) {
    const periodDays = Math.floor(optionalNumber(query.periodDays) ?? 30);
    const normalizedProductName = normalizeSearchName(query.productName);
    const packageSize = optionalNumber(query.packageSize);

    const records = await this.prisma.sharedPriceRecord.findMany({
      where: {
        visibility: "shared",
        status: "valid",
        purchasedAt: { gte: new Date(Date.now() - periodDays * 24 * 60 * 60_000) },
        quantity: { gt: 0 },
        pricePaid: { gt: 0 },
        normalizedProductName,
        ...(optionalText(query.brandId) ? { brandId: query.brandId } : {}),
        ...(packageSize !== undefined ? { packageSize } : {}),
        ...(query.packageUnit ? { packageUnit: query.packageUnit } : {}),
        ...(optionalText(query.city) ? { city: { equals: optionalText(query.city), mode: "insensitive" } } : {}),
        ...(optionalText(query.state) ? { state: { equals: optionalText(query.state)?.toUpperCase(), mode: "insensitive" } } : {}),
        ...(optionalText(query.neighborhood) ? { neighborhood: { equals: optionalText(query.neighborhood), mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        marketId: true,
        marketNameSnapshot: true,
        pricePaid: true,
        normalizedPrice: true,
        normalizedUnit: true,
        confidenceScore: true,
        purchasedAt: true,
        createdAt: true,
        city: true,
        neighborhood: true,
        market: { select: { name: true, neighborhood: true, city: true } },
      },
      orderBy: { purchasedAt: "desc" },
      take: 500,
    });

    const grouped = new Map<string, typeof records>();
    for (const record of records) {
      const current = grouped.get(record.marketId) ?? [];
      current.push(record);
      grouped.set(record.marketId, current);
    }

    const groups = [...grouped.entries()].map(([marketId, marketRecords]) => {
      const rawPrices = marketRecords.map((record) => toNumber(record.pricePaid)).filter((price) => Number.isFinite(price) && price > 0);
      const displayRecord = marketRecords[0];
      const lastUpdatedAt = this.lastUpdatedAt(marketRecords);

      return {
        marketId,
        marketName: displayRecord.marketNameSnapshot ?? displayRecord.market?.name ?? "Mercado",
        neighborhood: displayRecord.market?.neighborhood ?? displayRecord.neighborhood ?? null,
        city: displayRecord.market?.city ?? displayRecord.city ?? null,
        price: roundMoney(Math.min(...rawPrices)),
        recordsCount: marketRecords.length,
        lastUpdatedAt,
        confidence: this.libraryConfidence(marketRecords.length, 1, marketRecords),
      };
    });

    return groups.sort((left, right) => left.price - right.price);
  }

  private async buildContext(userId: string, query: RegionalPriceComparisonQueryDto): Promise<QueryContext> {
    const product =
      query.productId && (!query.productName || !query.brandId || !query.packageSize || !query.packageUnit || !query.unit)
        ? await this.prisma.product.findFirst({
            where: { id: query.productId, userId, deletedAt: null },
            select: {
              id: true,
              name: true,
              brandId: true,
              categoryId: true,
              defaultUnit: true,
              packageSize: true,
              packageUnit: true,
            },
          })
        : null;
    const productName = optionalText(query.productName) ?? product?.name;
    const unit = query.unit ?? product?.defaultUnit;
    const packageSize = optionalNumber(query.packageSize) ?? product?.packageSize ?? undefined;
    const packageUnit = query.packageUnit ?? product?.packageUnit ?? undefined;

    return {
      productId: optionalText(query.productId) ?? product?.id,
      canonicalProductId: optionalText(query.canonicalProductId),
      productName,
      normalizedProductName: productName ? normalizeSearchName(productName) : undefined,
      brandId: optionalText(query.brandId) ?? product?.brandId ?? undefined,
      categoryId: optionalText(query.categoryId) ?? product?.categoryId ?? undefined,
      unit,
      normalizedUnit: unit ? getNormalizedUnitLabel(unit) : null,
      packageSize,
      packageUnit,
      city: optionalText(query.city),
      state: optionalText(query.state)?.toUpperCase(),
      neighborhood: optionalText(query.neighborhood),
      radiusKm: optionalNumber(query.radiusKm),
      periodDays: Math.floor(optionalNumber(query.periodDays) ?? 30),
    };
  }

  private comparisonLevels(context: QueryContext): ComparisonLevel[] {
    const levels: ComparisonLevel[] = [];
    if ((context.normalizedProductName || context.canonicalProductId || context.productId) && context.brandId && context.packageSize && context.packageUnit) {
      levels.push("exact");
    }
    if ((context.normalizedProductName || context.canonicalProductId || context.productId) && context.brandId) {
      levels.push("same_brand");
    }
    if (context.normalizedProductName || context.canonicalProductId || context.productId) {
      levels.push("similar_product");
    }
    levels.push("generic");
    return levels;
  }

  private findCandidates(context: QueryContext, level: ComparisonLevel, exclusions: CandidateExclusions = {}) {
    return this.prisma.sharedPriceRecord.findMany({
      where: this.whereForLevel(context, level, exclusions),
      select: {
        id: true,
        purchaseId: true,
        userId: true,
        marketId: true,
        marketNameSnapshot: true,
        pricePaid: true,
        normalizedPrice: true,
        normalizedUnit: true,
        confidenceScore: true,
        purchasedAt: true,
        createdAt: true,
        market: { select: { name: true } },
      },
      orderBy: { purchasedAt: "desc" },
      take: 500,
    });
  }

  private whereForLevel(context: QueryContext, level: ComparisonLevel, exclusions: CandidateExclusions = {}): Prisma.SharedPriceRecordWhereInput {
    const startDate = new Date(Date.now() - context.periodDays * 24 * 60 * 60_000);
    const notConditions: Prisma.SharedPriceRecordWhereInput[] = [];
    if (exclusions.userId) notConditions.push({ userId: exclusions.userId });
    if (exclusions.purchaseId) notConditions.push({ purchaseId: exclusions.purchaseId });
    if (exclusions.marketId) notConditions.push({ marketId: exclusions.marketId });
    const where: Prisma.SharedPriceRecordWhereInput = {
      visibility: "shared",
      status: "valid",
      purchasedAt: { gte: startDate },
      quantity: { gt: 0 },
      pricePaid: { gt: 0 },
      ...(notConditions.length ? { NOT: notConditions } : {}),
      ...this.locationWhere(context),
      ...this.unitWhere(context),
    };

    if (level === "exact") {
      Object.assign(where, this.productIdentityWhere(context), {
        brandId: context.brandId,
        packageSize: context.packageSize,
        packageUnit: context.packageUnit,
      });
      return where;
    }

    if (level === "same_brand") {
      Object.assign(where, this.productIdentityWhere(context), {
        brandId: context.brandId,
      });
      return where;
    }

    if (level === "similar_product") {
      Object.assign(where, this.productIdentityWhere(context));
      if (context.brandId) {
        where.OR = [{ brandId: { not: context.brandId } }, { brandId: null }];
      }
      return where;
    }

    if (context.normalizedProductName || context.canonicalProductId || context.productId) {
      Object.assign(where, this.productIdentityWhere(context));
      return where;
    }

    if (context.categoryId) {
      where.categoryId = context.categoryId;
    }

    return where;
  }

  private productIdentityWhere(context: QueryContext): Prisma.SharedPriceRecordWhereInput {
    if (context.canonicalProductId) return { canonicalProductId: context.canonicalProductId };
    if (context.normalizedProductName) return { normalizedProductName: context.normalizedProductName };
    if (context.productId) return { productId: context.productId };
    if (context.categoryId) return { categoryId: context.categoryId };
    return {};
  }

  private locationWhere(context: QueryContext): Prisma.SharedPriceRecordWhereInput {
    const radiusWhere = this.radiusWhere(context);
    return {
      ...(context.city ? { city: { equals: context.city, mode: "insensitive" } } : {}),
      ...(context.state ? { state: { equals: context.state, mode: "insensitive" } } : {}),
      ...(context.neighborhood ? { neighborhood: { equals: context.neighborhood, mode: "insensitive" } } : {}),
      ...radiusWhere,
    };
  }

  private radiusWhere(context: QueryContext): Prisma.SharedPriceRecordWhereInput {
    if (!context.radiusKm || context.latitude === undefined || context.longitude === undefined) return {};

    const latitudeDelta = context.radiusKm / 111;
    const longitudeDelta = context.radiusKm / Math.max(111 * Math.cos((context.latitude * Math.PI) / 180), 1);
    return {
      latitudeApprox: { gte: context.latitude - latitudeDelta, lte: context.latitude + latitudeDelta },
      longitudeApprox: { gte: context.longitude - longitudeDelta, lte: context.longitude + longitudeDelta },
    };
  }

  private unitWhere(context: QueryContext): Prisma.SharedPriceRecordWhereInput {
    if (context.normalizedUnit) {
      return {
        normalizedUnit: context.normalizedUnit,
        normalizedPrice: { gt: 0 },
      };
    }

    if (context.unit) {
      return { unit: context.unit };
    }

    return {};
  }

  private priceLibraryWhere(query: PriceLibraryQueryDto, periodDays: number): Prisma.SharedPriceRecordWhereInput {
    const search = optionalText(query.search);
    const normalizedSearch = search ? normalizeSearchName(search) : undefined;

    return {
      visibility: "shared",
      status: "valid",
      purchasedAt: { gte: new Date(Date.now() - periodDays * 24 * 60 * 60_000) },
      quantity: { gt: 0 },
      pricePaid: { gt: 0 },
      ...(optionalText(query.categoryId) ? { categoryId: optionalText(query.categoryId) } : {}),
      ...(optionalText(query.categoryName) ? { categoryNameSnapshot: { contains: optionalText(query.categoryName), mode: "insensitive" } } : {}),
      ...(optionalText(query.brandId) ? { brandId: optionalText(query.brandId) } : {}),
      ...(optionalText(query.marketId) ? { marketId: optionalText(query.marketId) } : {}),
      ...(optionalText(query.city) ? { city: { equals: optionalText(query.city), mode: "insensitive" } } : {}),
      ...(optionalText(query.state) ? { state: { equals: optionalText(query.state)?.toUpperCase(), mode: "insensitive" } } : {}),
      ...(optionalText(query.neighborhood) ? { neighborhood: { equals: optionalText(query.neighborhood), mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              ...(normalizedSearch ? [{ normalizedProductName: { contains: normalizedSearch, mode: "insensitive" as const } }] : []),
              { productNameRaw: { contains: search, mode: "insensitive" as const } },
              { brandNameSnapshot: { contains: search, mode: "insensitive" as const } },
              { categoryNameSnapshot: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
  }

  private priceLibraryGroupKey(record: LibraryRecord) {
    return [
      record.normalizedProductName,
      record.brandId ?? normalizeSearchName(record.brandNameSnapshot ?? ""),
      record.packageSize ?? "",
      record.packageUnit ?? "",
      record.categoryId ?? normalizeSearchName(record.categoryNameSnapshot ?? ""),
      record.normalizedUnit ?? "",
    ].join("|");
  }

  private buildPriceLibraryItem(records: LibraryRecord[], periodDays: number) {
    const filteredRecords = this.filterLibraryOutliers(records);
    if (filteredRecords.length < 3) return null;

    const rawPrices = filteredRecords.map((record) => toNumber(record.pricePaid)).filter((price) => Number.isFinite(price) && price > 0);
    if (rawPrices.length < 3) return null;

    const normalizedUnit = mostFrequent(filteredRecords.map((record) => record.normalizedUnit).filter((unit): unit is string => Boolean(unit)));
    const normalizedPrices = normalizedUnit
      ? filteredRecords
          .filter((record) => record.normalizedUnit === normalizedUnit && record.normalizedPrice !== null)
          .map((record) => toNumber(record.normalizedPrice))
          .filter((price) => Number.isFinite(price) && price > 0)
      : [];
    const marketIds = new Set(filteredRecords.map((record) => record.marketId));
    const cheapestRecord = [...filteredRecords].sort(
      (left, right) => this.priceLibraryComparisonValue(left, normalizedUnit) - this.priceLibraryComparisonValue(right, normalizedUnit),
    )[0];
    const lastUpdatedAt = filteredRecords.reduce<Date | null>((current, record) => {
      const date = record.createdAt > record.purchasedAt ? record.createdAt : record.purchasedAt;
      if (!current || date > current) return date;
      return current;
    }, null);
    const displayRecord = [...filteredRecords].sort((left, right) => right.purchasedAt.getTime() - left.purchasedAt.getTime())[0];

    return {
      productName: displayRecord.productNameRaw,
      brandName: displayRecord.brandNameSnapshot ?? null,
      packageSize: displayRecord.packageSize ?? null,
      packageUnit: displayRecord.packageUnit ?? null,
      categoryName: displayRecord.categoryNameSnapshot ?? null,
      minPrice: roundMoney(Math.min(...rawPrices)),
      avgPrice: roundMoney(average(rawPrices)),
      medianPrice: roundMoney(median(rawPrices)),
      maxPrice: roundMoney(Math.max(...rawPrices)),
      normalizedMinPrice: normalizedPrices.length ? roundMoney(Math.min(...normalizedPrices)) : null,
      normalizedAvgPrice: normalizedPrices.length ? roundMoney(average(normalizedPrices)) : null,
      normalizedUnit: normalizedPrices.length ? normalizedUnit : null,
      cheapestMarketName: cheapestRecord.marketNameSnapshot ?? cheapestRecord.market?.name ?? null,
      recordsCount: filteredRecords.length,
      marketsCount: marketIds.size,
      lastUpdatedAt,
      confidence: this.libraryConfidence(filteredRecords.length, marketIds.size, filteredRecords),
      reportableRecordId: cheapestRecord.id,
      periodDays,
    };
  }

  private sortPriceLibraryItems<T extends { normalizedMinPrice: number | null; minPrice: number; recordsCount: number; lastUpdatedAt: Date | null }>(
    items: T[],
    sort: NonNullable<PriceLibraryQueryDto["sort"]>,
  ) {
    if (sort === "cheapest") {
      return items.sort((left, right) => (left.normalizedMinPrice ?? left.minPrice) - (right.normalizedMinPrice ?? right.minPrice));
    }

    if (sort === "most_records") {
      return items.sort((left, right) => right.recordsCount - left.recordsCount || getTime(right.lastUpdatedAt) - getTime(left.lastUpdatedAt));
    }

    return items.sort((left, right) => getTime(right.lastUpdatedAt) - getTime(left.lastUpdatedAt));
  }

  private priceLibraryComparisonValue(record: LibraryRecord, normalizedUnit?: string | null) {
    if (normalizedUnit && record.normalizedUnit === normalizedUnit && record.normalizedPrice !== null) {
      return toNumber(record.normalizedPrice);
    }

    return toNumber(record.pricePaid);
  }

  private filterLibraryOutliers(records: LibraryRecord[]) {
    if (records.length < 4) return records;

    const normalizedUnit = mostFrequent(records.map((record) => record.normalizedUnit).filter((unit): unit is string => Boolean(unit)));
    const values = records.map((record) => this.priceLibraryComparisonValue(record, normalizedUnit)).sort((left, right) => left - right);
    const q1 = percentile(values, 0.25);
    const q3 = percentile(values, 0.75);
    const iqr = q3 - q1;
    if (!Number.isFinite(iqr) || iqr <= 0) return records;

    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const filtered = records.filter((record) => {
      const value = this.priceLibraryComparisonValue(record, normalizedUnit);
      return value >= lower && value <= upper;
    });

    return filtered.length >= 3 ? filtered : records;
  }

  private libraryConfidence(recordsCount: number, marketsCount: number, records: Array<{ confidenceScore?: number | null }>): ComparisonConfidence {
    const baseConfidence = (() => {
      if (recordsCount >= 10 && marketsCount >= 3) return "high";
      if (recordsCount >= 5 && marketsCount >= 2) return "medium";
      return "low";
    })();

    return this.adjustConfidence(baseConfidence, records);
  }

  private async comparePurchaseItem({
    item,
    region,
    periodDays,
    exclusions,
  }: {
    item: PurchaseRegionalItem;
    region: {
      city?: string | null;
      state?: string | null;
      neighborhood?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      radiusKm?: number | null;
    };
    periodDays: number;
    exclusions: CandidateExclusions;
  }): Promise<ItemComparison | null> {
    const context = this.contextFromPurchaseItem(item, region, periodDays);

    for (const level of this.comparisonLevels(context)) {
      const candidates = await this.findCandidates(context, level, exclusions);
      const records = this.filterOutliers(candidates, (record) => this.comparisonValue(record, context.normalizedUnit));
      if (records.length < 3) continue;

      return this.buildPurchaseItemComparison(item, context, level, records);
    }

    return null;
  }

  private contextFromPurchaseItem(
    item: PurchaseRegionalItem,
    region: {
      city?: string | null;
      state?: string | null;
      neighborhood?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      radiusKm?: number | null;
    },
    periodDays: number,
  ): QueryContext {
    return {
      productId: item.productId ?? undefined,
      productName: item.productName,
      normalizedProductName: normalizeSearchName(item.productName),
      brandId: item.brandId ?? undefined,
      categoryId: item.product?.categoryId ?? undefined,
      unit: item.unit,
      normalizedUnit: getNormalizedUnitLabel(item.unit),
      packageSize: optionalNumber(item.packageSize),
      packageUnit: item.packageUnit ?? undefined,
      city: optionalText(region.city),
      state: optionalText(region.state)?.toUpperCase(),
      neighborhood: optionalText(region.neighborhood),
      latitude: optionalNumber(region.latitude),
      longitude: optionalNumber(region.longitude),
      radiusKm: optionalNumber(region.radiusKm),
      periodDays,
    };
  }

  private buildPurchaseItemComparison(
    item: PurchaseRegionalItem,
    context: QueryContext,
    level: ComparisonLevel,
    records: CandidateRecord[],
  ): ItemComparison {
    const rawPrices = records.map((record) => toNumber(record.pricePaid)).filter((price) => Number.isFinite(price) && price > 0);
    const normalizedPrices = records
      .map((record) => (record.normalizedUnit === context.normalizedUnit ? toNumber(record.normalizedPrice) : null))
      .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0);
    const marketIds = new Set(records.map((record) => record.marketId));
    const bestRecord = [...records].sort((left, right) => this.comparisonValue(left, context.normalizedUnit) - this.comparisonValue(right, context.normalizedUnit))[0];
    const confidence = this.confidence(level, records.length, marketIds.size, records);
    const lastUpdatedAt = this.lastUpdatedAt(records);

    return {
      purchaseItemId: item.id,
      productName: item.productName,
      brandName: item.brandNameSnapshot ?? item.brand ?? null,
      userPaidPrice: toNumber(item.pricePaid),
      normalizedUserPrice: item.unitPriceNormalized === null ? null : toNumber(item.unitPriceNormalized),
      normalizedUnit: normalizedPrices.length ? context.normalizedUnit ?? null : null,
      bestRegionalPrice: normalizedPrices.length ? roundMoney(Math.min(...normalizedPrices)) : roundMoney(Math.min(...rawPrices)),
      avgRegionalPrice: normalizedPrices.length ? roundMoney(average(normalizedPrices)) : roundMoney(average(rawPrices)),
      bestMarketName: bestRecord ? bestRecord.marketNameSnapshot ?? bestRecord.market?.name ?? null : null,
      recordsCount: records.length,
      comparisonLevel: level,
      confidence,
      lastUpdatedAt,
      reportableRecordId: bestRecord?.id ?? null,
      marketEstimates: this.marketEstimatesForItem(item, context, records, confidence),
    };
  }

  private marketEstimatesForItem(
    item: PurchaseRegionalItem,
    context: QueryContext,
    records: CandidateRecord[],
    confidence: ComparisonConfidence,
  ): ItemComparison["marketEstimates"] {
    const grouped = new Map<string, CandidateRecord[]>();
    for (const record of records) {
      const current = grouped.get(record.marketId) ?? [];
      current.push(record);
      grouped.set(record.marketId, current);
    }

    return [...grouped.entries()].map(([marketId, marketRecords]) => {
      const bestRecord = [...marketRecords].sort(
        (left, right) => this.comparisonValue(left, context.normalizedUnit) - this.comparisonValue(right, context.normalizedUnit),
      )[0];

      return {
        marketId,
        marketName: bestRecord.marketNameSnapshot ?? bestRecord.market?.name ?? "Mercado",
        estimatedItemTotal: this.estimatedItemTotal(item, context, bestRecord),
        confidence,
      };
    });
  }

  private estimatedItemTotal(item: PurchaseRegionalItem, context: QueryContext, record: CandidateRecord) {
    if (context.normalizedUnit && record.normalizedUnit === context.normalizedUnit && record.normalizedPrice !== null) {
      return roundMoney(toNumber(record.normalizedPrice) * this.normalizedQuantity(item.quantity, item.unit));
    }

    return roundMoney(toNumber(record.pricePaid));
  }

  private normalizedQuantity(quantityValue: number, unit: Unit) {
    const quantity = Number(quantityValue);
    if (unit === "g" || unit === "ml") return quantity / 1000;
    return quantity;
  }

  private estimatedMarkets({
    itemComparisons,
    originalTotal,
    comparableItemsCount,
  }: {
    itemComparisons: ItemComparison[];
    originalTotal: number;
    comparableItemsCount: number;
  }) {
    if (comparableItemsCount < 2) return [];

    const requiredMatches = Math.max(2, Math.min(Math.ceil(comparableItemsCount * 0.4), 5));
    const grouped = new Map<
      string,
      {
        marketId: string;
        marketName: string;
        delta: number;
        matchedItemsCount: number;
        confidenceScore: number;
      }
    >();

    for (const item of itemComparisons) {
      for (const estimate of item.marketEstimates) {
        const current = grouped.get(estimate.marketId) ?? {
          marketId: estimate.marketId,
          marketName: estimate.marketName,
          delta: 0,
          matchedItemsCount: 0,
          confidenceScore: 0,
        };
        current.delta += estimate.estimatedItemTotal - item.userPaidPrice;
        current.matchedItemsCount += 1;
        current.confidenceScore += confidenceScore(estimate.confidence);
        grouped.set(estimate.marketId, current);
      }
    }

    return [...grouped.values()]
      .map((market) => {
        const estimatedTotal = roundMoney(originalTotal + market.delta);
        const confidence = this.marketConfidence({
          averageConfidenceScore: market.confidenceScore / market.matchedItemsCount,
          matchedItemsCount: market.matchedItemsCount,
          comparableItemsCount,
        });

        return {
          marketId: market.marketId,
          marketName: market.marketName,
          estimatedTotal,
          matchedItemsCount: market.matchedItemsCount,
          missingItemsCount: comparableItemsCount - market.matchedItemsCount,
          estimatedSavings: roundMoney(originalTotal - estimatedTotal),
          confidence,
        };
      })
      .filter((market) => (market.matchedItemsCount >= requiredMatches || market.matchedItemsCount >= 5) && market.confidence !== "low")
      .sort((left, right) => left.estimatedTotal - right.estimatedTotal)
      .slice(0, 10);
  }

  private marketConfidence({
    averageConfidenceScore,
    matchedItemsCount,
    comparableItemsCount,
  }: {
    averageConfidenceScore: number;
    matchedItemsCount: number;
    comparableItemsCount: number;
  }): ComparisonConfidence {
    const coverage = matchedItemsCount / comparableItemsCount;
    if (coverage >= 0.75 && averageConfidenceScore >= 2.5) return "high";
    if ((coverage >= 0.4 || matchedItemsCount >= 5) && averageConfidenceScore >= 2) return "medium";
    return "low";
  }

  private buildResponse(context: QueryContext, level: ComparisonLevel, records: CandidateRecord[]) {
    const rawPrices = records.map((record) => toNumber(record.pricePaid)).filter((price) => Number.isFinite(price) && price > 0);
    const normalizedPrices = records
      .map((record) => (record.normalizedUnit === context.normalizedUnit ? toNumber(record.normalizedPrice) : null))
      .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0);
    const marketIds = new Set(records.map((record) => record.marketId));
    const bestRecord = [...records].sort((left, right) => this.comparisonValue(left, context.normalizedUnit) - this.comparisonValue(right, context.normalizedUnit))[0];
    const latest = this.lastUpdatedAt(records);

    return {
      product: {
        productId: context.productId ?? null,
        canonicalProductId: context.canonicalProductId ?? null,
        productName: context.productName ?? null,
        brandId: context.brandId ?? null,
        categoryId: context.categoryId ?? null,
        unit: context.unit ?? null,
        packageSize: context.packageSize ?? null,
        packageUnit: context.packageUnit ?? null,
      },
      region: {
        city: context.city ?? null,
        state: context.state ?? null,
        neighborhood: context.neighborhood ?? null,
        radiusKm: context.radiusKm ?? null,
        periodDays: context.periodDays,
      },
      comparisonLevel: level,
      confidence: this.confidence(level, records.length, marketIds.size, records),
      recordsCount: records.length,
      marketsCount: marketIds.size,
      minPrice: roundMoney(Math.min(...rawPrices)),
      avgPrice: roundMoney(average(rawPrices)),
      medianPrice: roundMoney(median(rawPrices)),
      maxPrice: roundMoney(Math.max(...rawPrices)),
      normalizedMinPrice: normalizedPrices.length ? roundMoney(Math.min(...normalizedPrices)) : null,
      normalizedAvgPrice: normalizedPrices.length ? roundMoney(average(normalizedPrices)) : null,
      normalizedUnit: normalizedPrices.length ? context.normalizedUnit : null,
      lastUpdatedAt: latest,
      reportableRecordId: bestRecord?.id ?? null,
    };
  }

  private confidence(
    level: ComparisonLevel,
    recordsCount: number,
    marketsCount: number,
    records?: Array<{ confidenceScore?: number | null }>,
  ): ComparisonConfidence {
    const baseConfidence = (() => {
      if (level === "exact") return "high";
      if (level === "same_brand") return recordsCount >= 6 && marketsCount >= 2 ? "high" : "medium";
      if (level === "similar_product") return "medium";
      return "low";
    })();

    return this.adjustConfidence(baseConfidence, records);
  }

  private adjustConfidence(confidence: ComparisonConfidence, records: Array<{ confidenceScore?: number | null }> = []): ComparisonConfidence {
    const scores = records.map((record) => record.confidenceScore).filter((score): score is number => typeof score === "number" && Number.isFinite(score));
    if (!scores.length) return confidence;

    const averageScore = average(scores);
    if (averageScore < 0.7) return lowerConfidence(confidence);
    if (averageScore < 0.85 && confidence === "high") return "medium";
    return confidence;
  }

  private comparisonValue(record: CandidateRecord, normalizedUnit?: string | null) {
    if (normalizedUnit && record.normalizedUnit === normalizedUnit && record.normalizedPrice !== null) {
      return toNumber(record.normalizedPrice);
    }
    return toNumber(record.pricePaid);
  }

  private filterOutliers(records: CandidateRecord[], value: (record: CandidateRecord) => number) {
    const validRecords = records.filter((record) => {
      const price = value(record);
      return Number.isFinite(price) && price > 0;
    });
    if (validRecords.length < 4) return validRecords;

    const values = validRecords.map(value).sort((left, right) => left - right);
    const q1 = percentile(values, 0.25);
    const q3 = percentile(values, 0.75);
    const iqr = q3 - q1;
    if (!Number.isFinite(iqr) || iqr <= 0) return validRecords;

    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const filtered = validRecords.filter((record) => {
      const price = value(record);
      return price >= lower && price <= upper;
    });

    return filtered.length >= 3 ? filtered : validRecords;
  }

  private lastUpdatedAt(records: Array<Pick<CandidateRecord, "createdAt" | "purchasedAt">>) {
    return records.reduce<Date | null>((current, record) => {
      const date = record.createdAt > record.purchasedAt ? record.createdAt : record.purchasedAt;
      if (!current || date > current) return date;
      return current;
    }, null);
  }
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(sortedValues: number[], percentileValue: number) {
  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function confidenceScore(confidence: ComparisonConfidence) {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function lowerConfidence(confidence: ComparisonConfidence): ComparisonConfidence {
  if (confidence === "high") return "medium";
  if (confidence === "medium") return "low";
  return "low";
}

function mostFrequent(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function getTime(value?: Date | null) {
  return value?.getTime() ?? 0;
}
