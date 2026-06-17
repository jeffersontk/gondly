import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Unit } from "@prisma/client";
import { ListsService } from "../lists/lists.service";
import { type NumericLike, toNumber } from "../common/utils/money";
import { normalizePrice, roundMoney } from "../common/utils/normalize-price";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { CreatePurchaseItemDto, FinishPurchaseDto, StartPurchaseDto, UpdatePurchaseDto, UpdatePurchaseItemDto } from "./dto";

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listsService: ListsService,
    private readonly realtime: RealtimeService,
  ) {}

  async start(userId: string, dto: StartPurchaseDto) {
    const activePurchase = await this.prisma.purchase.findFirst({
      where: { userId, status: "in_progress", deletedAt: null },
      include: { items: { orderBy: { createdAt: "desc" } }, market: true, participants: true, sourceList: true },
      orderBy: { startedAt: "desc" },
    });

    if (activePurchase && !dto.cancelActive) {
      return activePurchase;
    }

    const sourceList = dto.sourceListId ? await this.listsService.get(userId, dto.sourceListId) : null;

    return this.prisma.$transaction(async (tx) => {
      if (activePurchase && dto.cancelActive) {
        await tx.purchase.update({ where: { id: activePurchase.id }, data: { status: "cancelled" } });
      }

      const purchase = await tx.purchase.create({
        data: {
          userId,
          sourceListId: sourceList?.id,
          participants: { create: { userId } },
        },
      });

      if (sourceList) {
        await tx.purchaseItem.createMany({
          data: sourceList.items
            .filter((item) => item.status !== "skipped")
            .map((item) => {
              const quantity = item.expectedQuantity && item.expectedQuantity > 0 ? item.expectedQuantity : 1;
              const normalized = normalizePrice(quantity, item.unit, 0);
              return {
                purchaseId: purchase.id,
                productId: item.productId,
                productName: item.productName,
                brand: item.brand,
                category: item.category,
                quantity,
                unit: item.unit,
                pricePaid: 0,
                unitPriceNormalized: normalized.unitPriceNormalized,
                normalizedUnitLabel: normalized.normalizedUnitLabel,
                addedByUserId: userId,
              };
            }),
        });
      }

      return tx.purchase.findUnique({
        where: { id: purchase.id },
        include: { items: true, market: true, participants: true, sourceList: true },
      });
    });
  }

  active(userId: string) {
    return this.prisma.purchase.findMany({
      where: {
        deletedAt: null,
        status: "in_progress",
        OR: [{ userId }, { participants: { some: { userId } } }, { sourceList: { members: { some: { userId, status: "accepted" } } } }],
      },
      include: { items: { orderBy: { createdAt: "desc" } }, market: true, participants: true, sourceList: true },
      orderBy: { startedAt: "desc" },
    });
  }

  list(userId: string) {
    return this.prisma.purchase.findMany({
      where: {
        deletedAt: null,
        OR: [{ userId }, { participants: { some: { userId } } }, { sourceList: { members: { some: { userId, status: "accepted" } } } }],
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
      await this.assertMarketBelongsToUser(userId, dto.marketId);
    }

    return this.prisma.purchase.update({
      where: { id: purchase.id },
      data: dto,
      include: { items: true, market: true },
    });
  }

  async addItem(userId: string, purchaseId: string, dto: CreatePurchaseItemDto) {
    const purchase = await this.assertPurchaseEditable(userId, purchaseId);
    const productId = await this.resolveProductId(userId, dto);
    const normalized = normalizePrice(dto.quantity, dto.unit, dto.pricePaid);

    const item = await this.prisma.purchaseItem.create({
      data: {
        purchaseId: purchase.id,
        productId,
        productName: dto.productName,
        brand: dto.brand,
        category: dto.category,
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
    this.realtime.emitToPurchase(purchase.id, "purchaseItemCreated", { purchaseId: purchase.id, item, byUserId: userId });
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

    const updatedItem = await this.prisma.purchaseItem.update({
      where: { id: itemId },
      data: {
        ...dto,
        quantity: nextQuantity,
        unit: nextUnit,
        pricePaid: nextPricePaid,
        unitPriceNormalized: normalized.unitPriceNormalized,
        normalizedUnitLabel: normalized.normalizedUnitLabel,
        updatedByUserId: userId,
      },
    });

    const updatedPurchase = await this.recalculateSubtotal(purchase.id);
    this.realtime.emitToPurchase(purchase.id, "purchaseItemUpdated", { purchaseId: purchase.id, item: updatedItem, byUserId: userId });
    this.emitPurchaseTotal(updatedPurchase, userId);
    return updatedPurchase;
  }

  async removeItem(userId: string, purchaseId: string, itemId: string) {
    const purchase = await this.assertPurchaseEditable(userId, purchaseId);
    await this.assertItemInPurchase(purchase.id, itemId);
    await this.prisma.purchaseItem.delete({ where: { id: itemId } });
    const updatedPurchase = await this.recalculateSubtotal(purchase.id);
    this.realtime.emitToPurchase(purchase.id, "purchaseItemDeleted", { purchaseId: purchase.id, itemId, byUserId: userId });
    this.emitPurchaseTotal(updatedPurchase, userId);
    return updatedPurchase;
  }

  async finish(userId: string, id: string, dto: FinishPurchaseDto) {
    const purchase = await this.assertPurchaseEditable(userId, id);
    await this.assertMarketBelongsToUser(userId, dto.marketId);

    const finished = await this.prisma.$transaction(async (tx) => {
      const items = await tx.purchaseItem.findMany({ where: { purchaseId: purchase.id } });
      if (!items.length) {
        throw new BadRequestException("Cannot finish a purchase without items.");
      }

      const subtotal = roundMoney(items.reduce((sum, item) => sum + toNumber(item.pricePaid), 0));
      const discountAmount = roundMoney(subtotal - dto.finalPaidAmount);

      return tx.purchase.update({
        where: { id: purchase.id },
        data: {
          marketId: dto.marketId,
          status: "completed",
          completedAt: new Date(),
          subtotalCalculated: subtotal,
          finalPaidAmount: dto.finalPaidAmount,
          discountAmount,
          notes: dto.notes,
        },
        include: { items: true, market: true, sourceList: true },
      });
    });
    this.realtime.emitToPurchase(id, "purchaseTotalUpdated", { purchaseId: id, status: "completed", byUserId: userId });
    return finished;
  }

  async cancel(userId: string, id: string) {
    const purchase = await this.assertPurchaseEditable(userId, id);
    const cancelled = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: "cancelled" },
      include: { items: true, market: true },
    });
    this.realtime.emitToPurchase(purchase.id, "purchaseTotalUpdated", { purchaseId: purchase.id, status: "cancelled", byUserId: userId });
    return cancelled;
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
          category: item.category,
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
        OR: [{ userId }, { participants: { some: { userId } } }, { sourceList: { members: { some: { userId, status: "accepted" } } } }],
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

    if (purchase.userId === userId || purchase.participants.some((participant) => participant.userId === userId)) {
      return purchase;
    }

    const member = purchase.sourceList?.members.find((entry) => entry.userId === userId && entry.status === "accepted");
    if (!member || (member.role !== "owner" && member.role !== "editor")) {
      throw new ForbiddenException("You cannot edit this purchase.");
    }

    await this.prisma.purchaseParticipant.upsert({
      where: { purchaseId_userId: { purchaseId: purchase.id, userId } },
      update: { lastSeenAt: new Date() },
      create: { purchaseId: purchase.id, userId },
    });

    return purchase;
  }

  private async assertItemInPurchase(purchaseId: string, itemId: string) {
    const item = await this.prisma.purchaseItem.findFirst({ where: { id: itemId, purchaseId } });
    if (!item) {
      throw new NotFoundException("Purchase item not found.");
    }
    return item;
  }

  private async assertMarketBelongsToUser(userId: string, marketId: string) {
    const market = await this.prisma.market.findFirst({ where: { id: marketId, userId, deletedAt: null } });
    if (!market) {
      throw new NotFoundException("Market not found.");
    }
    return market;
  }

  private async findOrCreateProduct(userId: string, dto: { productName: string; brand?: string; category?: string; unit?: Unit }) {
    const existing = await this.prisma.product.findFirst({
      where: { userId, deletedAt: null, name: { equals: dto.productName, mode: "insensitive" } },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.product.create({
      data: {
        userId,
        name: dto.productName,
        brand: dto.brand,
        category: dto.category,
        defaultUnit: dto.unit ?? "un",
      },
    });
  }

  private async resolveProductId(userId: string, dto: { productId?: string; productName: string; brand?: string; category?: string; unit?: Unit }) {
    if (!dto.productId) {
      return (await this.findOrCreateProduct(userId, dto)).id;
    }

    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, userId, deletedAt: null } });
    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    return product.id;
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

  private emitPurchaseTotal(purchase: { id: string; subtotalCalculated: NumericLike }, userId: string) {
    this.realtime.emitToPurchase(purchase.id, "purchaseTotalUpdated", {
      purchaseId: purchase.id,
      subtotalCalculated: toNumber(purchase.subtotalCalculated),
      byUserId: userId,
    });
  }
}
