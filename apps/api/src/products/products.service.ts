import { Injectable, NotFoundException } from "@nestjs/common";
import { roundMoney } from "@gondly/utils";
import { PrismaService } from "../prisma/prisma.service";
import { toNumber, toOptionalNumber } from "../common/utils/money";
import { CreateProductDto, UpdateProductDto } from "./dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, q?: string) {
    return this.prisma.product.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  create(userId: string, dto: CreateProductDto) {
    return this.prisma.product.create({ data: { ...dto, userId } });
  }

  search(userId: string, q: string) {
    return this.prisma.product.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
  }

  async get(userId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, userId, deletedAt: null } });
    if (!product) {
      throw new NotFoundException("Product not found.");
    }
    return product;
  }

  async update(userId: string, id: string, dto: UpdateProductDto) {
    await this.get(userId, id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    return this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async summary(userId: string, id: string) {
    const product = await this.get(userId, id);
    const items = await this.prisma.purchaseItem.findMany({
      where: {
        productId: id,
        purchase: { userId, status: "completed", deletedAt: null },
      },
      include: { purchase: { include: { market: true } } },
      orderBy: { createdAt: "desc" },
    });

    const normalizedPrices = items
      .map((item) => item.unitPriceNormalized)
      .filter((value) => value !== null)
      .map((value) => toNumber(value));
    const min = normalizedPrices.length ? Math.min(...normalizedPrices) : null;
    const max = normalizedPrices.length ? Math.max(...normalizedPrices) : null;
    const average = normalizedPrices.length
      ? roundMoney(normalizedPrices.reduce((sum, value) => sum + value, 0) / normalizedPrices.length)
      : null;

    return {
      product,
      purchasesCount: items.length,
      lastPrice: toOptionalNumber(items[0]?.pricePaid),
      minPrice: min,
      maxPrice: max,
      averagePrice: average,
      lastMarket: items[0]?.purchase.market ?? null,
      history: items,
    };
  }
}
