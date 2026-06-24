import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ListItemStatus, SharedRole, Unit } from "@prisma/client";
import { randomUUID } from "crypto";
import { BillingService } from "../billing/billing.service";
import { addDays } from "../common/utils/date";
import { normalizePrice } from "../common/utils/normalize-price";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { CreateInviteDto, CreateListDto, CreateListItemDto, ImportListItemsDto, UpdateListDto, UpdateListItemDto } from "./dto";

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly realtime: RealtimeService,
  ) {}

  list(userId: string) {
    return this.prisma.marketList.findMany({
      where: {
        deletedAt: null,
        OR: [{ userId }, { members: { some: { userId, status: "accepted" } } }],
      },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        members: { include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async create(userId: string, dto: CreateListDto) {
    return this.prisma.$transaction(async (tx) => {
      const list = await tx.marketList.create({
        data: { ...dto, userId },
      });

      await tx.listMember.create({
        data: {
          listId: list.id,
          userId,
          role: "owner",
          status: "accepted",
          acceptedAt: new Date(),
        },
      });

      return list;
    });
  }

  async get(userId: string, id: string) {
    return this.assertCanAccess(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateListDto) {
    await this.assertCanEdit(userId, id);
    return this.prisma.marketList.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    return this.prisma.marketList.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async archive(userId: string, id: string) {
    await this.assertCanEdit(userId, id);
    return this.prisma.marketList.update({ where: { id }, data: { status: "archived" } });
  }

  async duplicate(userId: string, id: string) {
    const list = await this.assertCanAccess(userId, id);
    return this.prisma.$transaction(async (tx) => {
      const copy = await tx.marketList.create({
        data: {
          userId,
          name: `${list.name} (copia)`,
          description: list.description,
        },
      });

      await tx.listMember.create({
        data: { listId: copy.id, userId, role: "owner", status: "accepted", acceptedAt: new Date() },
      });

      await tx.marketListItem.createMany({
        data: list.items.map((item) => ({
          listId: copy.id,
          productId: item.productId,
          productName: item.productName,
          brand: item.brand,
          category: item.category,
          expectedQuantity: item.expectedQuantity,
          unit: item.unit,
          notes: item.notes,
        })),
      });

      return tx.marketList.findUnique({ where: { id: copy.id }, include: { items: true, members: true } });
    });
  }

  async addItem(userId: string, listId: string, dto: CreateListItemDto) {
    await this.assertCanEdit(userId, listId);
    const productId = await this.resolveProductId(userId, dto);

    const item = await this.prisma.marketListItem.create({
      data: {
        listId,
        productId,
        productName: dto.productName,
        brand: dto.brand,
        category: dto.category,
        expectedQuantity: dto.expectedQuantity,
        unit: dto.unit,
        notes: dto.notes,
      },
    });

    this.realtime.emitToList(listId, "listItemUpdated", { listId, item, action: "created", byUserId: userId });
    return item;
  }

  async importItems(userId: string, listId: string, dto: ImportListItemsDto) {
    await this.assertCanEdit(userId, listId);

    const list = await this.prisma.$transaction(async (tx) => {
      const uniqueItems = new Map<string, CreateListItemDto>();
      for (const item of dto.items) {
        const key = this.normalizeProductName(item.productName);
        if (!uniqueItems.has(key)) uniqueItems.set(key, item);
      }

      const names = [...uniqueItems.values()].map((item) => item.productName);
      const existingProducts = await tx.product.findMany({
        where: {
          userId,
          deletedAt: null,
          name: { in: names, mode: "insensitive" },
        },
      });
      const productsByName = new Map(existingProducts.map((product) => [this.normalizeProductName(product.name), product]));
      const missingProducts = [...uniqueItems.entries()]
        .filter(([key]) => !productsByName.has(key))
        .map(([, item]) => ({
          userId,
          name: item.productName,
          brand: item.brand,
          category: item.category,
          defaultUnit: item.unit,
        }));

      if (missingProducts.length) {
        await tx.product.createMany({ data: missingProducts });
      }

      const products = missingProducts.length
        ? await tx.product.findMany({
            where: {
              userId,
              deletedAt: null,
              name: { in: names, mode: "insensitive" },
            },
          })
        : existingProducts;
      const productIdsByName = new Map(products.map((product) => [this.normalizeProductName(product.name), product.id]));

      await tx.marketListItem.createMany({
        data: dto.items.map((item) => ({
          listId,
          productId: productIdsByName.get(this.normalizeProductName(item.productName)),
          productName: item.productName,
          brand: item.brand,
          category: item.category,
          expectedQuantity: item.expectedQuantity,
          unit: item.unit,
          notes: item.notes,
        })),
      });

      return tx.marketList.findUnique({
        where: { id: listId },
        include: {
          items: { orderBy: { createdAt: "asc" } },
          members: { include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } } },
          invites: { where: { status: "pending" } },
        },
      });
    });

    this.realtime.emitToList(listId, "listItemsImported", {
      listId,
      count: dto.items.length,
      byUserId: userId,
    });
    return list;
  }

  async updateItem(userId: string, listId: string, itemId: string, dto: UpdateListItemDto) {
    await this.assertCanEdit(userId, listId);
    await this.assertItemInList(listId, itemId);

    const item = await this.prisma.marketListItem.update({
      where: { id: itemId },
      data: dto,
    });

    this.realtime.emitToList(listId, "listItemUpdated", { listId, item, action: "updated", byUserId: userId });
    return item;
  }

  async removeItem(userId: string, listId: string, itemId: string) {
    await this.assertCanEdit(userId, listId);
    await this.assertItemInList(listId, itemId);
    const item = await this.prisma.marketListItem.delete({ where: { id: itemId } });
    this.realtime.emitToList(listId, "listItemUpdated", { listId, itemId, action: "deleted", byUserId: userId });
    return item;
  }

  async setItemState(userId: string, listId: string, itemId: string, status: ListItemStatus) {
    await this.assertCanEdit(userId, listId);
    await this.assertItemInList(listId, itemId);

    const updated = await this.prisma.marketListItem.update({
      where: { id: itemId },
      data: {
        status,
        checked: false,
        assignedToUserId: null,
        assignedAt: null,
        purchasedByUserId: null,
        purchasedAt: null,
      },
    });

    await this.syncItemWithActivePurchases(userId, listId, updated);
    this.realtime.emitToList(listId, "listItemUpdated", { listId, item: updated, action: "state_changed", byUserId: userId });
    return updated;
  }

  async members(userId: string, listId: string) {
    await this.assertCanAccess(userId, listId);
    return this.prisma.listMember.findMany({
      where: { listId, status: { not: "removed" } },
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async invite(userId: string, listId: string, dto: CreateInviteDto) {
    await this.assertOwner(userId, listId);

    if (dto.role === SharedRole.owner) {
      throw new BadRequestException("Owner role cannot be invited.");
    }

    await this.assertFreeShareLimit(userId, listId);

    return this.prisma.listInvite.create({
      data: {
        listId,
        invitedByUserId: userId,
        inviteEmail: dto.inviteEmail?.toLowerCase(),
        role: dto.role ?? SharedRole.editor,
        inviteToken: randomUUID(),
        expiresAt: addDays(new Date(), 7),
      },
    });
  }

  async createShareLink(userId: string, listId: string) {
    await this.assertOwner(userId, listId);

    const existing = await this.prisma.listInvite.findFirst({
      where: {
        listId,
        inviteEmail: null,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;

    await this.assertFreeShareLimit(userId, listId);
    return this.prisma.listInvite.create({
      data: {
        listId,
        invitedByUserId: userId,
        role: SharedRole.editor,
        inviteToken: randomUUID(),
        expiresAt: addDays(new Date(), 30),
      },
    });
  }

  async shareLink(userId: string, token: string) {
    const invite = await this.validShareLink(token);
    const member = await this.prisma.listMember.findUnique({
      where: { listId_userId: { listId: invite.listId, userId } },
    });

    return {
      listId: invite.listId,
      listName: invite.list.name,
      description: invite.list.description,
      owner: invite.list.user,
      expiresAt: invite.expiresAt,
      accessStatus: invite.list.userId === userId ? "owner" : member?.status ?? "none",
    };
  }

  async requestAccess(userId: string, token: string) {
    const invite = await this.validShareLink(token);
    if (invite.list.userId === userId) {
      return { status: "owner", listId: invite.listId };
    }

    const member = await this.prisma.listMember.upsert({
      where: { listId_userId: { listId: invite.listId, userId } },
      update: {
        role: invite.role,
        status: "invited",
        invitedAt: new Date(),
        acceptedAt: null,
        removedAt: null,
      },
      create: {
        listId: invite.listId,
        userId,
        role: invite.role,
        status: "invited",
      },
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
    });

    this.realtime.emitToList(invite.listId, "accessRequested", { listId: invite.listId, member });
    return { status: member.status, listId: invite.listId };
  }

  async approveMember(userId: string, listId: string, memberId: string) {
    await this.assertOwner(userId, listId);
    const member = await this.prisma.listMember.findFirst({ where: { id: memberId, listId, status: "invited" } });
    if (!member) {
      throw new NotFoundException("Access request not found.");
    }

    const approved = await this.prisma.listMember.update({
      where: { id: memberId },
      data: { status: "accepted", acceptedAt: new Date(), removedAt: null },
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
    });
    this.realtime.emitToList(listId, "memberApproved", { listId, member: approved });
    return approved;
  }

  async acceptInvite(userId: string, userEmail: string, token: string) {
    const invite = await this.prisma.listInvite.findUnique({
      where: { inviteToken: token },
      include: { list: true },
    });

    if (!invite || invite.status !== "pending" || invite.expiresAt < new Date() || invite.list.deletedAt) {
      throw new NotFoundException("Invite not found or expired.");
    }

    if (invite.inviteEmail && invite.inviteEmail.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException("This invite belongs to another email.");
    }

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.listMember.upsert({
        where: { listId_userId: { listId: invite.listId, userId } },
        update: {
          role: invite.role,
          status: "accepted",
          acceptedAt: new Date(),
          removedAt: null,
        },
        create: {
          listId: invite.listId,
          userId,
          role: invite.role,
          status: "accepted",
          acceptedAt: new Date(),
        },
      });

      await tx.listInvite.update({ where: { id: invite.id }, data: { status: "accepted" } });

      return member;
    });
  }

  async removeMember(userId: string, listId: string, memberId: string) {
    await this.assertOwner(userId, listId);
    const member = await this.prisma.listMember.findFirst({ where: { id: memberId, listId } });

    if (!member) {
      throw new NotFoundException("Member not found.");
    }

    if (member.role === "owner") {
      throw new BadRequestException("Owner cannot be removed from the list.");
    }

    const removed = await this.prisma.listMember.update({
      where: { id: memberId },
      data: { status: "removed", removedAt: new Date() },
    });
    this.realtime.emitToList(listId, "memberRemoved", { listId, memberId });
    return removed;
  }

  async updateMemberRole(userId: string, listId: string, memberId: string, role: SharedRole) {
    await this.assertOwner(userId, listId);

    if (role === SharedRole.owner) {
      throw new BadRequestException("Owner role cannot be assigned here.");
    }

    const member = await this.prisma.listMember.findFirst({ where: { id: memberId, listId } });
    if (!member || member.status === "removed") {
      throw new NotFoundException("Member not found.");
    }

    return this.prisma.listMember.update({ where: { id: memberId }, data: { role } });
  }

  private async assertCanAccess(userId: string, listId: string) {
    const list = await this.prisma.marketList.findFirst({
      where: {
        id: listId,
        deletedAt: null,
        OR: [{ userId }, { members: { some: { userId, status: "accepted" } } }],
      },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        members: { include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } } },
        invites: { where: { status: "pending" } },
      },
    });

    if (!list) {
      throw new NotFoundException("List not found.");
    }

    return list;
  }

  private async assertCanEdit(userId: string, listId: string) {
    const list = await this.assertCanAccess(userId, listId);

    if (list.userId === userId) {
      return list;
    }

    const member = list.members.find((entry) => entry.userId === userId && entry.status === "accepted");
    if (!member || (member.role !== "owner" && member.role !== "editor")) {
      throw new ForbiddenException("You cannot edit this list.");
    }

    return list;
  }

  private async assertOwner(userId: string, listId: string) {
    const list = await this.assertCanAccess(userId, listId);
    if (list.userId !== userId) {
      throw new ForbiddenException("Only the owner can perform this action.");
    }
    return list;
  }

  private async validShareLink(token: string) {
    const invite = await this.prisma.listInvite.findUnique({
      where: { inviteToken: token },
      include: {
        list: {
          include: {
            user: { select: { id: true, name: true, photoUrl: true } },
          },
        },
      },
    });

    if (
      !invite ||
      invite.inviteEmail ||
      invite.status !== "pending" ||
      invite.expiresAt < new Date() ||
      invite.list.deletedAt
    ) {
      throw new NotFoundException("Share link not found or expired.");
    }
    return invite;
  }

  private async assertItemInList(listId: string, itemId: string) {
    const item = await this.prisma.marketListItem.findFirst({ where: { id: itemId, listId } });
    if (!item) {
      throw new NotFoundException("List item not found.");
    }
    return item;
  }

  private async syncItemWithActivePurchases(
    userId: string,
    listId: string,
    item: {
      id: string;
      productId: string | null;
      productName: string;
      brand: string | null;
      category: string | null;
      expectedQuantity: number | null;
      unit: Unit;
      status: ListItemStatus;
    },
  ) {
    const purchases = await this.prisma.purchase.findMany({
      where: { sourceListId: listId, status: "in_progress", deletedAt: null },
      select: {
        id: true,
        items: {
          select: {
            id: true,
            sourceListItemId: true,
            productId: true,
            productName: true,
          },
        },
      },
    });

    for (const purchase of purchases) {
      const matchingItems = purchase.items.filter(
        (purchaseItem) =>
          purchaseItem.sourceListItemId === item.id ||
          (!purchaseItem.sourceListItemId &&
            (item.productId
              ? purchaseItem.productId === item.productId
              : purchaseItem.productName.localeCompare(item.productName, "pt-BR", { sensitivity: "base" }) === 0)),
      );

      if (item.status === "pending") {
        const existing = matchingItems[0];
        if (existing) {
          if (!existing.sourceListItemId) {
            await this.prisma.purchaseItem.update({
              where: { id: existing.id },
              data: { sourceListItemId: item.id },
            });
          }
        } else {
          const quantity = item.expectedQuantity && item.expectedQuantity > 0 ? item.expectedQuantity : 1;
          const normalized = normalizePrice(quantity, item.unit, 0);
          await this.prisma.purchaseItem.create({
            data: {
              purchaseId: purchase.id,
              sourceListItemId: item.id,
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
            },
          });
        }
      } else if (matchingItems.length) {
        await this.prisma.purchaseItem.deleteMany({
          where: { id: { in: matchingItems.map((purchaseItem) => purchaseItem.id) } },
        });
      }

      const subtotal = await this.prisma.purchaseItem.aggregate({
        where: { purchaseId: purchase.id },
        _sum: { pricePaid: true },
      });
      await this.prisma.purchase.update({
        where: { id: purchase.id },
        data: { subtotalCalculated: subtotal._sum.pricePaid ?? 0 },
      });
      this.realtime.emitToPurchase(purchase.id, "purchaseItemsSynced", {
        purchaseId: purchase.id,
        sourceListItemId: item.id,
        status: item.status,
        byUserId: userId,
      });
    }
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

  private normalizeProductName(value: string) {
    return value.trim().toLocaleLowerCase("pt-BR");
  }

  private async assertFreeShareLimit(userId: string, listId: string) {
    const targetAlreadyShared = await this.prisma.marketList.findFirst({
      where: {
        id: listId,
        OR: [
          { members: { some: { role: { not: "owner" }, status: { not: "removed" } } } },
          { invites: { some: { status: "pending" } } },
        ],
      },
    });

    if (targetAlreadyShared) {
      return;
    }

    if (!(await this.billingService.canCreateSharedList(userId))) {
      throw new ForbiddenException("Nao foi possivel criar este convite.");
    }
  }
}
