import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toNumber } from "../common/utils/money";
import { roundMoney } from "../common/utils/normalize-price";
import { CreateMarketDto, UpdateMarketDto } from "./dto";

@Injectable()
export class MarketsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.market.findMany({
      where: { userId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  create(userId: string, dto: CreateMarketDto) {
    return this.prisma.market.create({
      data: { ...dto, userId },
    });
  }

  async get(userId: string, id: string) {
    const market = await this.prisma.market.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!market) {
      throw new NotFoundException("Market not found.");
    }

    return market;
  }

  async update(userId: string, id: string, dto: UpdateMarketDto) {
    await this.get(userId, id);
    return this.prisma.market.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    return this.prisma.market.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async summary(userId: string, id: string) {
    const market = await this.get(userId, id);
    const purchases = await this.prisma.purchase.findMany({
      where: { userId, marketId: id, status: "completed", deletedAt: null },
      include: { items: true },
      orderBy: { completedAt: "desc" },
    });

    const totalSpent = purchases.reduce(
      (sum, purchase) => sum + toNumber(purchase.finalPaidAmount ?? purchase.subtotalCalculated),
      0,
    );
    const productCounts = new Map<string, number>();

    for (const purchase of purchases) {
      for (const item of purchase.items) {
        productCounts.set(item.productName, (productCounts.get(item.productName) ?? 0) + item.quantity);
      }
    }

    const topProduct = [...productCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      market,
      purchaseCount: purchases.length,
      totalSpent: roundMoney(totalSpent),
      averageTicket: purchases.length ? roundMoney(totalSpent / purchases.length) : 0,
      lastPurchase: purchases[0] ?? null,
      topProduct,
    };
  }
}
