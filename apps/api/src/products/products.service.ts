import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { roundMoney } from "@gondly/utils";
import { Unit } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { toNumber, toOptionalNumber } from "../common/utils/money";
import { normalizeSearchName, optionalNumber, optionalText } from "../common/utils/normalize";
import { CreateProductDto, UpdateProductDto } from "./dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, q?: string) {
    const search = optionalText(q);
    const barcode = this.normalizeBarcode(search);
    return this.prisma.product.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { brand: { contains: search, mode: "insensitive" } },
                { brandRef: { name: { contains: search, mode: "insensitive" } } },
                ...(barcode ? [{ barcode: { contains: barcode, mode: "insensitive" as const } }] : []),
              ],
            }
          : {}),
      },
      include: this.productInclude(),
      orderBy: { name: "asc" },
    });
  }

  async create(userId: string, dto: CreateProductDto) {
    const data = await this.toProductData(dto);
    const existing = data.barcode ? await this.findByBarcode(userId, data.barcode) : null;
    if (existing) return existing;

    return this.prisma.product.create({
      data: {
        ...data,
        userId,
        name: data.name ?? dto.name.trim(),
        normalizedName: data.normalizedName ?? normalizeSearchName(dto.name),
        defaultUnit: data.defaultUnit ?? dto.defaultUnit,
      },
      include: this.productInclude(),
    });
  }

  search(userId: string, q: string) {
    const search = optionalText(q) ?? "";
    const barcode = this.normalizeBarcode(search);
    return this.prisma.product.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
          { brandRef: { name: { contains: search, mode: "insensitive" } } },
          ...(barcode ? [{ barcode: { contains: barcode, mode: "insensitive" as const } }] : []),
        ],
      },
      include: this.productInclude(),
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
  }

  async get(userId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, userId, deletedAt: null }, include: this.productInclude() });
    if (!product) {
      throw new NotFoundException("Product not found.");
    }
    return product;
  }

  async update(userId: string, id: string, dto: UpdateProductDto) {
    await this.get(userId, id);
    const data = await this.toProductData(dto, true);
    if (data.barcode) {
      const duplicate = await this.prisma.product.findFirst({
        where: { userId, barcode: data.barcode, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException("Barcode already registered for another product.");
      }
    }
    return this.prisma.product.update({ where: { id }, data, include: this.productInclude() });
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

  async findBarcode(userId: string, barcodeInput: string) {
    const barcode = this.normalizeBarcode(barcodeInput);
    if (!barcode) {
      throw new BadRequestException("Invalid barcode.");
    }

    const product = await this.findByBarcode(userId, barcode);
    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    const lastKnownPrice = await this.lastKnownPrice(userId, product.id);

    return {
      product,
      brand: product.brandRef ?? (product.brand ? { id: product.brandId, name: product.brand } : null),
      category: product.category ?? null,
      packageSize: product.packageSize ?? null,
      packageUnit: product.packageUnit ?? null,
      unit: product.defaultUnit,
      lastKnownPrice,
    };
  }

  private productInclude() {
    return { brandRef: true };
  }

  private async toProductData(dto: UpdateProductDto, partial = false) {
    const data: {
      name?: string;
      normalizedName?: string;
      brand?: string | null;
      brandId?: string | null;
      category?: string | null;
      categoryId?: string | null;
      defaultUnit?: Unit;
      barcode?: string | null;
      packageSize?: number | null;
      packageUnit?: Unit | null;
    } = {};

    if (!partial || Object.prototype.hasOwnProperty.call(dto, "name")) {
      const name = optionalText(dto.name);
      if (name) {
        data.name = name;
        data.normalizedName = normalizeSearchName(name);
      }
    }

    if (!partial || Object.prototype.hasOwnProperty.call(dto, "brandId") || Object.prototype.hasOwnProperty.call(dto, "brand")) {
      const brand = await this.resolveBrand(dto);
      data.brandId = brand?.id ?? null;
      data.brand = brand?.name ?? null;
    }

    if (!partial || Object.prototype.hasOwnProperty.call(dto, "category")) {
      data.category = optionalText(dto.category) ?? null;
    }

    if (!partial || Object.prototype.hasOwnProperty.call(dto, "categoryId")) {
      data.categoryId = optionalText(dto.categoryId) ?? null;
    }

    if (!partial || Object.prototype.hasOwnProperty.call(dto, "defaultUnit")) {
      if (dto.defaultUnit) data.defaultUnit = dto.defaultUnit;
    }

    if (!partial || Object.prototype.hasOwnProperty.call(dto, "barcode")) {
      data.barcode = this.normalizeBarcode(dto.barcode);
    }

    if (!partial || Object.prototype.hasOwnProperty.call(dto, "packageSize")) {
      data.packageSize = optionalNumber(dto.packageSize) ?? null;
    }

    if (!partial || Object.prototype.hasOwnProperty.call(dto, "packageUnit")) {
      data.packageUnit = dto.packageUnit ?? null;
    }

    return data;
  }

  private async resolveBrand(dto: { brandId?: string; brand?: string }) {
    const brandId = optionalText(dto.brandId);
    if (brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) throw new NotFoundException("Brand not found.");
      return brand;
    }

    const brandName = optionalText(dto.brand);
    if (!brandName) return null;

    const normalizedName = normalizeSearchName(brandName);
    return this.prisma.brand.upsert({
      where: { normalizedName },
      create: { name: brandName, normalizedName },
      update: {},
    });
  }

  private findByBarcode(userId: string, barcode: string) {
    return this.prisma.product.findFirst({
      where: { userId, barcode, deletedAt: null },
      include: this.productInclude(),
    });
  }

  private async lastKnownPrice(userId: string, productId: string) {
    const item = await this.prisma.purchaseItem.findFirst({
      where: {
        productId,
        purchase: { userId, status: "completed", deletedAt: null },
      },
      include: { purchase: { include: { market: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (!item) return null;

    return {
      pricePaid: toNumber(item.pricePaid),
      normalizedPrice: toOptionalNumber(item.unitPriceNormalized),
      normalizedUnit: item.normalizedUnitLabel ?? null,
      market: item.purchase.market
        ? {
            id: item.purchase.market.id,
            name: item.purchase.market.name,
          }
        : null,
      purchasedAt: item.purchase.completedAt ?? item.createdAt,
    };
  }

  private normalizeBarcode(value?: string | null) {
    const text = optionalText(value);
    if (!text) return null;
    const normalized = text.replace(/[\s-]+/g, "").toUpperCase();
    return normalized || null;
  }
}
