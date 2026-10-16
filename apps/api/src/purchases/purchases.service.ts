import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { normalizePrice, roundMoney } from "@gondly/utils";
import { ListsService } from "../lists/lists.service";
import { type NumericLike, toNumber } from "../common/utils/money";
import { normalizeSearchName } from "../common/utils/normalize";
import { PrismaService } from "../prisma/prisma.service";
import { purchaseAccessWhere } from "./purchase-access";
import { ItemSnapshotResolver } from "../products/item-snapshot.resolver";
import { RealtimeService } from "../realtime/realtime.service";
import { CreatePurchaseItemDto, FinishPurchaseDto, StartPurchaseDto, UpdatePurchaseDto, UpdatePurchaseItemDto } from "./dto";

type SharedPriceLocationLevel = "none" | "city" | "neighborhood";
type SharedPriceItem = Prisma.PurchaseItemGetPayload<{ include: { product: true } }>;

@Injectable()
export class PurchasesService {
  private readonly snapshots: ItemSnapshotResolver;

  constructor(
    private readonly prisma: PrismaService,
    private readonly listsService: ListsService,
    private readonly realtime: RealtimeService,
  ) {
    this.snapshots = new ItemSnapshotResolver(prisma);
  }

  async start(userId: string, dto: StartPurchaseDto) {
    const activePurchase = await this.prisma.purchase.findFirst({
      where: { userId, status: "in_progress", deletedAt: null },
      include: { items: { orderBy: { createdAt: "desc" } }, market: true, participants: true, sourceList: true },
      orderBy: { startedAt: "desc" },
    });

    const sourceList = dto.sourceListId ? await this.listsService.get(userId, dto.sourceListId) : null;

    if (sourceList) {
      // A shared list has a single in-progress purchase: members join it instead of starting a parallel one.
      const listPurchase = await this.prisma.purchase.findFirst({
        where: { sourceListId: sourceList.id, status: "in_progress", deletedAt: null },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });

      if (listPurchase) {
        if (activePurchase && dto.cancelActive && activePurchase.id !== listPurchase.id) {
          await this.prisma.purchase.update({ where: { id: activePurchase.id }, data: { status: "cancelled" } });
        }
        return this.joinPurchase(userId, listPurchase.id);
      }
    }

    if (activePurchase && !dto.cancelActive) {
      return activePurchase;
    }

    const purchaseItems =
      sourceList?.items
        .filter((item) => item.status === "pending")
        .map((item) => {
          const quantity = item.expectedQuantity && item.expectedQuantity > 0 ? item.expectedQuantity : 1;
          const normalized = normalizePrice(quantity, item.unit, 0);
          return {
            sourceListItemId: item.id,
            productId: item.productId,
            productName: item.productName,
            brand: item.brand,
            brandId: item.brandId,
            brandNameSnapshot: item.brandNameSnapshot,
            category: item.category,
            packageSize: item.packageSize,
            packageUnit: item.packageUnit,
            quantity,
            unit: item.unit,
            pricePaid: 0,
            unitPriceNormalized: normalized.unitPriceNormalized,
            normalizedUnitLabel: normalized.normalizedUnitLabel,
            addedByUserId: userId,
          };
        }) ?? [];

    if (activePurchase && dto.cancelActive) {
      await this.prisma.purchase.update({
        where: { id: activePurchase.id },
        data: { status: "cancelled" },
      });
    }

    try {
      return await this.prisma.purchase.create({
        data: {
          userId,
          sourceListId: sourceList?.id,
          participants: { create: { userId } },
          ...(purchaseItems.length ? { items: { createMany: { data: purchaseItems } } } : {}),
        },
        include: { items: true, market: true, participants: true, sourceList: true },
      });
    } catch (error) {
      if (activePurchase && dto.cancelActive) {
        await this.prisma.purchase
          .update({
            where: { id: activePurchase.id },
            data: { status: "in_progress" },
          })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  active(userId: string) {
    return this.prisma.purchase.findMany({
      where: {
        deletedAt: null,
        status: "in_progress",
        ...purchaseAccessWhere(userId),
      },
      include: { items: { orderBy: { createdAt: "desc" } }, market: true, participants: true, sourceList: true },
      orderBy: { startedAt: "desc" },
    });
  }

  list(userId: string) {
    return this.prisma.purchase.findMany({
      where: {
        deletedAt: null,
        ...purchaseAccessWhere(userId),
      },
      include: { items: true, market: true, sourceList: true },
      orderBy: { startedAt: "desc" },
    });
  }

  async get(userId: string, id: string) {
    return this.assertPurchaseAccess(userId, id);
  }

  async update(userId: string, id: string, dto: UpdatePurchaseDto) {
    const purchase = await this.assertPurchaseEditable(userId, id);
    if (dto.marketId) {
      await this.assertMarketAccessible(userId, dto.marketId, this.collaboratorIds(purchase));
    }

    return this.prisma.purchase.update({
      where: { id: purchase.id },
      data: dto,
      include: { items: true, market: true },
    });
  }

  async addItem(userId: string, purchaseId: string, dto: CreatePurchaseItemDto) {
    const purchase = await this.assertPurchaseEditable(userId, purchaseId);
    const snapshot = await this.snapshots.resolve(userId, dto, this.collaboratorIds(purchase));
    const normalized = normalizePrice(dto.quantity, dto.unit, dto.pricePaid);

    const item = await this.prisma.purchaseItem.create({
      data: {
        purchaseId: purchase.id,
        ...snapshot,
        quantity: dto.quantity,
        unit: dto.unit,
        pricePaid: dto.pricePaid,
        unitPriceNormalized: normalized.unitPriceNormalized,
        normalizedUnitLabel: normalized.normalizedUnitLabel,
        addedByUserId: userId,
        updatedByUserId: userId,
        notes: dto.notes,
      },
    });

    const updatedPurchase = await this.recalculateSubtotal(purchase.id);
    this.realtime.emitToPurchase(purchase.id, "purchaseItemCreated", {
      purchaseId: purchase.id,
      item,
      subtotalCalculated: toNumber(updatedPurchase.subtotalCalculated),
      purchaseUpdatedAt: updatedPurchase.updatedAt,
      byUserId: userId,
    });
    this.emitListPurchaseItemChanged(purchase, "created", { item, byUserId: userId });
    this.emitPurchaseTotal(updatedPurchase, userId);
    return updatedPurchase;
  }

  async updateItem(userId: string, purchaseId: string, itemId: string, dto: UpdatePurchaseItemDto) {
    const purchase = await this.assertPurchaseEditable(userId, purchaseId);
    const item = await this.assertItemInPurchase(purchase.id, itemId);
    const nextQuantity = dto.quantity ?? item.quantity;
    const nextUnit = dto.unit ?? item.unit;
    const nextPricePaid = dto.pricePaid ?? toNumber(item.pricePaid);
    const normalized = normalizePrice(nextQuantity, nextUnit, nextPricePaid);
    const hasIdentityUpdate = ["productId", "productName", "brandId", "brand", "brandNameSnapshot", "category", "packageSize", "packageUnit"].some((key) =>
      Object.prototype.hasOwnProperty.call(dto, key),
    );
    const snapshot = hasIdentityUpdate
      ? await this.snapshots.resolve(userId, {
          productId: dto.productId ?? item.productId ?? undefined,
          productName: dto.productName ?? item.productName,
          brandId: dto.brandId,
          brand: dto.brand,
          brandNameSnapshot: dto.brandNameSnapshot,
          category: dto.category ?? item.category ?? undefined,
          unit: nextUnit,
          packageSize: dto.packageSize ?? item.packageSize ?? undefined,
          packageUnit: dto.packageUnit ?? item.packageUnit ?? undefined,
        }, this.collaboratorIds(purchase))
      : {
          productId: item.productId,
          productName: item.productName,
          brand: item.brand,
          brandId: item.brandId,
          brandNameSnapshot: item.brandNameSnapshot,
          category: item.category,
          packageSize: item.packageSize,
          packageUnit: item.packageUnit,
        };

    const updatedItem = await this.prisma.purchaseItem.update({
      where: { id: itemId },
      data: {
        ...dto,
        ...snapshot,
        quantity: nextQuantity,
        unit: nextUnit,
        pricePaid: nextPricePaid,
        unitPriceNormalized: normalized.unitPriceNormalized,
        normalizedUnitLabel: normalized.normalizedUnitLabel,
        updatedByUserId: userId,
      },
    });

    const updatedPurchase = await this.recalculateSubtotal(purchase.id);
    this.realtime.emitToPurchase(purchase.id, "purchaseItemUpdated", {
      purchaseId: purchase.id,
      item: updatedItem,
      subtotalCalculated: toNumber(updatedPurchase.subtotalCalculated),
      purchaseUpdatedAt: updatedPurchase.updatedAt,
      byUserId: userId,
    });
    this.emitListPurchaseItemChanged(purchase, "updated", { item: updatedItem, byUserId: userId });
    this.emitPurchaseTotal(updatedPurchase, userId);
    return updatedPurchase;
  }

  async removeItem(userId: string, purchaseId: string, itemId: string) {
    const purchase = await this.assertPurchaseEditable(userId, purchaseId);
    const item = await this.assertItemInPurchase(purchase.id, itemId);
    if (item.sourceListItemId) {
      throw new BadRequestException("Items from the source list cannot be deleted during an active purchase.");
    }
    await this.prisma.purchaseItem.delete({ where: { id: itemId } });
    const updatedPurchase = await this.recalculateSubtotal(purchase.id);
    this.realtime.emitToPurchase(purchase.id, "purchaseItemDeleted", {
      purchaseId: purchase.id,
      itemId,
      subtotalCalculated: toNumber(updatedPurchase.subtotalCalculated),
      purchaseUpdatedAt: updatedPurchase.updatedAt,
      byUserId: userId,
    });
    this.emitListPurchaseItemChanged(purchase, "deleted", { itemId, byUserId: userId });
    this.emitPurchaseTotal(updatedPurchase, userId);
    return updatedPurchase;
  }

  async finish(userId: string, id: string, dto: FinishPurchaseDto) {
    const purchase = await this.assertPurchaseEditable(userId, id);
    const market = await this.assertMarketAccessible(userId, dto.marketId, this.collaboratorIds(purchase));
    const shouldSharePrices = dto.sharePrices === true;

    const finished = await this.prisma.$transaction(async (tx) => {
      const items = await tx.purchaseItem.findMany({ where: { purchaseId: purchase.id }, include: { product: true } });
      if (!items.length) {
        throw new BadRequestException("Cannot finish a purchase without items.");
      }

      const subtotal = roundMoney(items.reduce((sum, item) => sum + toNumber(item.pricePaid), 0));
      const discountAmount = roundMoney(subtotal - dto.finalPaidAmount);
      const completedAt = new Date();
      const priceSharingPreference =
        dto.sharePrices === undefined ? null : await this.upsertPriceSharingPreferenceForFinish(tx, userId, dto.sharePrices);

      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          marketId: dto.marketId,
          status: "completed",
          completedAt,
          subtotalCalculated: subtotal,
          finalPaidAmount: dto.finalPaidAmount,
          discountAmount,
          notes: dto.notes,
        },
        include: { items: true, market: true, sourceList: true },
      });

      if (shouldSharePrices) {
        const records = await this.buildSharedPriceRecords({
          tx,
          userId,
          purchaseId: purchase.id,
          market,
          items,
          purchasedAt: completedAt,
          shareLocationLevel: priceSharingPreference?.shareLocationLevel ?? "city",
        });

        if (records.length) {
          await tx.sharedPriceRecord.createMany({ data: records, skipDuplicates: true });
        }
      }

      return updatedPurchase;
    });
    this.realtime.emitToPurchase(id, "purchaseTotalUpdated", {
      purchaseId: id,
      status: finished.status,
      subtotalCalculated: toNumber(finished.subtotalCalculated),
      purchase: finished,
      byUserId: userId,
    });
    return finished;
  }

  async cancel(userId: string, id: string) {
    const purchase = await this.assertPurchaseEditable(userId, id);
    const cancelled = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: "cancelled" },
      include: { items: true, market: true },
    });
    this.realtime.emitToPurchase(purchase.id, "purchaseTotalUpdated", {
      purchaseId: purchase.id,
      status: cancelled.status,
      subtotalCalculated: toNumber(cancelled.subtotalCalculated),
      purchase: cancelled,
      byUserId: userId,
    });
    return cancelled;
  }

  async remove(userId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id, userId, deletedAt: null } });
    if (!purchase) {
      throw new NotFoundException("Purchase not found.");
    }
    if (purchase.status === "in_progress") {
      throw new BadRequestException("Cannot remove an active purchase. Cancel it first.");
    }

    await this.prisma.purchase.update({ where: { id: purchase.id }, data: { deletedAt: new Date() } });
    return { id: purchase.id };
  }

  async clearHistory(userId: string) {
    const result = await this.prisma.purchase.updateMany({
      where: { userId, deletedAt: null, status: { in: ["completed", "cancelled"] } },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  async duplicateAsList(userId: string, id: string) {
    const purchase = await this.assertPurchaseAccess(userId, id);

    return this.prisma.$transaction(async (tx) => {
      const list = await tx.marketList.create({
        data: {
          userId,
          name: `Compra ${new Date(purchase.startedAt).toLocaleDateString("pt-BR")}`,
          description: purchase.market ? `Criada a partir da compra em ${purchase.market.name}` : "Criada a partir de uma compra",
        },
      });

      await tx.listMember.create({
        data: { listId: list.id, userId, role: "owner", status: "accepted", acceptedAt: new Date() },
      });

      await tx.marketListItem.createMany({
        data: purchase.items.map((item) => ({
          listId: list.id,
          productId: item.productId,
          productName: item.productName,
          brand: item.brand,
          brandId: item.brandId,
          brandNameSnapshot: item.brandNameSnapshot,
          category: item.category,
          packageSize: item.packageSize,
          packageUnit: item.packageUnit,
          expectedQuantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
        })),
      });

      return tx.marketList.findUnique({ where: { id: list.id }, include: { items: true } });
    });
  }

  private async assertPurchaseAccess(userId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id,
        deletedAt: null,
        ...purchaseAccessWhere(userId),
      },
      include: {
        items: { orderBy: { createdAt: "desc" } },
        market: true,
        sourceList: { include: { members: true } },
        participants: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException("Purchase not found.");
    }

    return purchase;
  }

  private async assertPurchaseEditable(userId: string, id: string) {
    const purchase = await this.assertPurchaseAccess(userId, id);

    if (purchase.status !== "in_progress") {
      throw new BadRequestException("Only active purchases can be edited.");
    }

    if (!this.canEditPurchase(userId, purchase)) {
      throw new ForbiddenException("You cannot edit this purchase.");
    }

    if (!purchase.participants.some((participant) => participant.userId === userId)) {
      await this.upsertParticipant(purchase.id, userId);
    }

    return purchase;
  }

  private async joinPurchase(userId: string, purchaseId: string) {
    const purchase = await this.assertPurchaseAccess(userId, purchaseId);
    if (!this.canEditPurchase(userId, purchase) || purchase.participants.some((participant) => participant.userId === userId)) {
      return purchase;
    }

    await this.upsertParticipant(purchase.id, userId);
    return this.assertPurchaseAccess(userId, purchaseId);
  }

  private upsertParticipant(purchaseId: string, userId: string) {
    return this.prisma.purchaseParticipant.upsert({
      where: { purchaseId_userId: { purchaseId, userId } },
      update: { lastSeenAt: new Date() },
      create: { purchaseId, userId },
    });
  }

  private canEditPurchase(
    userId: string,
    purchase: {
      userId: string;
      participants: { userId: string }[];
      sourceList?: { userId: string; members: { userId: string; status: string; role: string }[] } | null;
    },
  ) {
    if (purchase.userId === userId) return true;

    // For list purchases, the current list membership is the source of truth, so removed or demoted members lose edit access.
    if (purchase.sourceList) {
      if (purchase.sourceList.userId === userId) return true;
      const member = purchase.sourceList.members.find((entry) => entry.userId === userId && entry.status === "accepted");
      return Boolean(member && (member.role === "owner" || member.role === "editor"));
    }

    return purchase.participants.some((participant) => participant.userId === userId);
  }

  // Users whose products and markets can be referenced inside a shared purchase.
  private collaboratorIds(purchase: {
    userId: string;
    participants: { userId: string }[];
    sourceList?: { userId: string; members: { userId: string; status: string }[] } | null;
  }) {
    const ids = new Set([purchase.userId, ...purchase.participants.map((participant) => participant.userId)]);
    if (purchase.sourceList) {
      ids.add(purchase.sourceList.userId);
      purchase.sourceList.members.filter((member) => member.status === "accepted").forEach((member) => ids.add(member.userId));
    }
    return [...ids];
  }

  private async assertItemInPurchase(purchaseId: string, itemId: string) {
    const item = await this.prisma.purchaseItem.findFirst({ where: { id: itemId, purchaseId } });
    if (!item) {
      throw new NotFoundException("Purchase item not found.");
    }
    return item;
  }

  private async assertMarketAccessible(userId: string, marketId: string, ownerIds: string[] = [userId]) {
    const market = await this.prisma.market.findFirst({
      where: { id: marketId, deletedAt: null, OR: [{ createdByUserId: { in: ownerIds } }, { createdByUserId: null }] },
    });
    if (!market) {
      throw new NotFoundException("Market not found.");
    }
    return market;
  }

  private normalizeProductName(value: string) {
    return normalizeSearchName(value);
  }

  private async upsertPriceSharingPreferenceForFinish(
    tx: Prisma.TransactionClient,
    userId: string,
    sharePrices: boolean,
  ) {
    const preference = await tx.userPriceSharingPreference.upsert({
      where: { userId },
      create: { userId, sharePrices, shareLocationLevel: "city" },
      update: { sharePrices },
    });

    if (!sharePrices) {
      await tx.sharedPriceRecord.updateMany({
        where: { userId, visibility: "shared" },
        data: { visibility: "private" },
      });
    }

    return preference;
  }

  private async buildSharedPriceRecords({
    tx,
    userId,
    purchaseId,
    market,
    items,
    purchasedAt,
    shareLocationLevel,
  }: {
    tx: Prisma.TransactionClient;
    userId: string;
    purchaseId: string;
    market: {
      id: string;
      name: string;
      city?: string | null;
      state?: string | null;
      neighborhood?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    };
    items: SharedPriceItem[];
    purchasedAt: Date;
    shareLocationLevel: SharedPriceLocationLevel;
  }): Promise<Prisma.SharedPriceRecordCreateManyInput[]> {
    const location = this.sharedLocationSnapshot(market, shareLocationLevel);
    const records: Prisma.SharedPriceRecordCreateManyInput[] = [];

    for (const item of items) {
      const quantity = Number(item.quantity);
      const pricePaid = toNumber(item.pricePaid);
      if (!Number.isFinite(quantity) || quantity <= 0 || pricePaid <= 0) continue;

      const normalized = normalizePrice(quantity, item.unit, pricePaid);
      if (!normalized.isValid) continue;

      const record: Prisma.SharedPriceRecordCreateManyInput = {
        userId,
        purchaseId,
        purchaseItemId: item.id,
        marketId: market.id,
        marketNameSnapshot: market.name,
        productId: item.productId ?? null,
        canonicalProductId: null,
        productNameRaw: item.productName,
        normalizedProductName: this.normalizeProductName(item.productName),
        brandId: item.brandId ?? null,
        brandNameSnapshot: item.brandNameSnapshot ?? item.brand ?? null,
        categoryId: item.product?.categoryId ?? null,
        categoryNameSnapshot: item.category ?? item.product?.category ?? null,
        quantity,
        unit: item.unit,
        packageSize: item.packageSize ?? null,
        packageUnit: item.packageUnit ?? null,
        pricePaid,
        normalizedPrice: normalized.unitPriceNormalized,
        normalizedUnit: normalized.normalizedUnitLabel,
        purchasedAt,
        ...location,
        visibility: "shared",
        status: "valid",
        qualityReason: null,
        confidenceScore: null,
      };
      const quality = await this.evaluateSharedPriceQuality(tx, record);
      records.push({ ...record, ...quality });
    }

    return records;
  }

  private async evaluateSharedPriceQuality(tx: Prisma.TransactionClient, record: Prisma.SharedPriceRecordCreateManyInput) {
    const reasons: string[] = [];
    let status: Prisma.SharedPriceRecordCreateManyInput["status"] = "valid";
    let confidenceScore = 1;
    const hasBrand = Boolean(record.brandId || record.brandNameSnapshot);
    const hasCategory = Boolean(record.categoryId || record.categoryNameSnapshot);

    if (!hasBrand) {
      reasons.push("missing_brand");
      confidenceScore = Math.min(confidenceScore, 0.75);
    }

    if (!hasCategory) {
      reasons.push("missing_category");
      confidenceScore = Math.min(confidenceScore, 0.75);
    }

    if (!record.normalizedUnit || record.normalizedPrice === null || record.normalizedPrice === undefined) {
      status = "suspected";
      reasons.unshift("incompatible_unit");
      confidenceScore = Math.min(confidenceScore, 0.5);
      return {
        status,
        qualityReason: reasons.join(","),
        confidenceScore,
      };
    }

    const value = toNumber(record.normalizedPrice);
    if (!Number.isFinite(value) || value <= 0) {
      return { status: "ignored" as const, qualityReason: "invalid_normalized_price", confidenceScore: 0 };
    }

    const purchasedAt = new Date(record.purchasedAt);
    const startDate = new Date(purchasedAt.getTime() - 90 * 24 * 60 * 60_000);
    const existingRecords = await tx.sharedPriceRecord.findMany({
      where: {
        visibility: "shared",
        status: "valid",
        normalizedProductName: record.normalizedProductName,
        normalizedUnit: record.normalizedUnit,
        purchasedAt: { gte: startDate },
        quantity: { gt: 0 },
        pricePaid: { gt: 0 },
        normalizedPrice: { gt: 0 },
        ...(record.city ? { city: { equals: record.city, mode: "insensitive" } } : {}),
        ...(record.state ? { state: { equals: record.state, mode: "insensitive" } } : {}),
      },
      select: { normalizedPrice: true },
      orderBy: { purchasedAt: "desc" },
      take: 50,
    });
    const medianPrice = median(existingRecords.map((existing) => toNumber(existing.normalizedPrice)).filter((price) => Number.isFinite(price) && price > 0));

    if (medianPrice !== null) {
      if (value < medianPrice * 0.35) {
        status = "suspected";
        reasons.unshift("price_too_low");
        confidenceScore = Math.min(confidenceScore, 0.4);
      } else if (value > medianPrice * 3) {
        status = "suspected";
        reasons.unshift("price_too_high");
        confidenceScore = Math.min(confidenceScore, 0.4);
      }
    }

    return {
      status,
      qualityReason: reasons.length ? reasons.join(",") : null,
      confidenceScore,
    };
  }

  private sharedLocationSnapshot(
    market: {
      city?: string | null;
      state?: string | null;
      neighborhood?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
    shareLocationLevel: SharedPriceLocationLevel,
  ) {
    if (shareLocationLevel === "none") {
      return {
        city: null,
        state: null,
        neighborhood: null,
        latitudeApprox: null,
        longitudeApprox: null,
      };
    }

    return {
      city: market.city ?? null,
      state: market.state ?? null,
      neighborhood: shareLocationLevel === "neighborhood" ? market.neighborhood ?? null : null,
      latitudeApprox: this.approximateCoordinate(market.latitude),
      longitudeApprox: this.approximateCoordinate(market.longitude),
    };
  }

  private approximateCoordinate(value?: number | null) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }

  private async recalculateSubtotal(purchaseId: string) {
    const items = await this.prisma.purchaseItem.findMany({ where: { purchaseId } });
    const subtotal = roundMoney(items.reduce((sum, item) => sum + toNumber(item.pricePaid), 0));

    return this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { subtotalCalculated: subtotal },
      include: { items: { orderBy: { createdAt: "desc" } }, market: true, participants: true, sourceList: true },
    });
  }

  private emitPurchaseTotal(purchase: { id: string; subtotalCalculated: NumericLike; updatedAt?: Date | string }, userId: string) {
    this.realtime.emitToPurchase(purchase.id, "purchaseTotalUpdated", {
      purchaseId: purchase.id,
      subtotalCalculated: toNumber(purchase.subtotalCalculated),
      purchaseUpdatedAt: purchase.updatedAt,
      byUserId: userId,
    });
  }

  private emitListPurchaseItemChanged(
    purchase: { id: string; sourceListId?: string | null },
    action: "created" | "updated" | "deleted",
    payload: { item?: unknown; itemId?: string; byUserId: string },
  ) {
    if (!purchase.sourceListId) return;

    this.realtime.emitToList(purchase.sourceListId, "purchaseItemChanged", {
      listId: purchase.sourceListId,
      purchaseId: purchase.id,
      action,
      ...payload,
    });
  }
}

function median(values: number[]) {
  if (values.length < 3) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}
