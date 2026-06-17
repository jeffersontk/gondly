import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ListItemStatus, SharedRole, Unit } from "@prisma/client";
import { randomUUID } from "crypto";
import { BillingService } from "../billing/billing.service";
import { addDays } from "../common/utils/date";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { CreateInviteDto, CreateListDto, CreateListItemDto, UpdateListDto, UpdateListItemDto } from "./dto";

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

  async checkItem(userId: string, listId: string, itemId: string, checked?: boolean) {
    await this.assertCanEdit(userId, listId);
    const item = await this.assertItemInList(listId, itemId);
    const nextChecked = typeof checked === "boolean" ? checked : !item.checked;

    const updated = await this.prisma.marketListItem.update({
      where: { id: itemId },
      data: {
        checked: nextChecked,
        status: nextChecked ? "purchased" : "pending",
        purchasedByUserId: nextChecked ? userId : null,
        purchasedAt: nextChecked ? new Date() : null,
      },
    });

    this.realtime.emitToList(listId, "listItemUpdated", { listId, item: updated, action: "checked", byUserId: userId });
    if (nextChecked) {
      this.realtime.emitToList(listId, "itemPurchased", { listId, item: updated, byUserId: userId });
    }
    return updated;
  }

  async assignItem(userId: string, listId: string, itemId: string) {
    await this.assertCanEdit(userId, listId);
    await this.assertItemInList(listId, itemId);

    const item = await this.prisma.marketListItem.update({
      where: { id: itemId },
      data: {
        status: "assigned",
        assignedToUserId: userId,
        assignedAt: new Date(),
      },
      include: { assignedToUser: { select: { id: true, name: true, photoUrl: true } } },
    });

    this.realtime.emitToList(listId, "listItemUpdated", { listId, item, action: "assigned", byUserId: userId });
    this.realtime.emitToList(listId, "itemAssigned", { listId, item, byUserId: userId });
    return item;
  }

  async unassignItem(userId: string, listId: string, itemId: string) {
    await this.assertCanEdit(userId, listId);
    await this.assertItemInList(listId, itemId);

    const item = await this.prisma.marketListItem.update({
      where: { id: itemId },
      data: {
        status: "pending",
        assignedToUserId: null,
        assignedAt: null,
      },
    });

    this.realtime.emitToList(listId, "listItemUpdated", { listId, item, action: "unassigned", byUserId: userId });
    return item;
  }

  async purchaseItem(userId: string, listId: string, itemId: string) {
    await this.assertCanEdit(userId, listId);
    await this.assertItemInList(listId, itemId);

    const item = await this.prisma.marketListItem.update({
      where: { id: itemId },
      data: {
        status: "purchased",
        checked: true,
        purchasedByUserId: userId,
        purchasedAt: new Date(),
      },
      include: { purchasedByUser: { select: { id: true, name: true, photoUrl: true } } },
    });

    this.realtime.emitToList(listId, "listItemUpdated", { listId, item, action: "purchased", byUserId: userId });
    this.realtime.emitToList(listId, "itemPurchased", { listId, item, byUserId: userId });
    return item;
  }

  async skipItem(userId: string, listId: string, itemId: string) {
    await this.assertCanEdit(userId, listId);
    await this.assertItemInList(listId, itemId);

    const item = await this.prisma.marketListItem.update({
      where: { id: itemId },
      data: { status: "skipped", checked: false },
    });

    this.realtime.emitToList(listId, "listItemUpdated", { listId, item, action: "skipped", byUserId: userId });
    this.realtime.emitToList(listId, "itemSkipped", { listId, item, byUserId: userId });
    return item;
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

    return this.prisma.listMember.update({
      where: { id: memberId },
      data: { status: "removed", removedAt: new Date() },
    });
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

  private async assertItemInList(listId: string, itemId: string) {
    const item = await this.prisma.marketListItem.findFirst({ where: { id: itemId, listId } });
    if (!item) {
      throw new NotFoundException("List item not found.");
    }
    return item;
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
