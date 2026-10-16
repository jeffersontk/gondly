import { NotFoundException } from "@nestjs/common";
import { Prisma, Unit } from "@prisma/client";
import { normalizeSearchName, optionalNumber, optionalText } from "../common/utils/normalize";
import { PrismaService } from "../prisma/prisma.service";

export type BrandInput = {
  brandId?: string;
  brand?: string;
  brandNameSnapshot?: string;
};

export type ItemProductInput = BrandInput & {
  productId?: string;
  productName: string;
  category?: string;
  unit?: Unit;
  packageSize?: number;
  packageUnit?: Unit;
};

export type ProductSnapshot = {
  id: string;
  name: string;
  brandId: string | null;
  brand: string | null;
  category: string | null;
  packageSize: number | null;
  packageUnit: Unit | null;
};

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

// Resolves the product/brand snapshot stored on list and purchase items. Shared by lists and purchases so both
// follow the same rules (e.g. which collaborators' products an item may reference).
export class ItemSnapshotResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param ownerIds users whose products may be referenced by productId (the collaborators of a shared list).
   *                 New products are always created for `userId`.
   */
  async resolve(userId: string, dto: ItemProductInput, ownerIds: string[] = [userId]) {
    if (!dto.productId) {
      const product = await this.findOrCreateProduct(userId, dto);
      return this.snapshotFromProduct(dto, product);
    }

    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, userId: { in: ownerIds }, deletedAt: null } });
    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    return this.snapshotFromProduct(dto, product);
  }

  async resolveBrandFields(dto: BrandInput, client: PrismaClientLike = this.prisma) {
    const brandId = optionalText(dto.brandId);
    if (brandId) {
      const brand = await client.brand.findUnique({ where: { id: brandId } });
      if (!brand) throw new NotFoundException("Brand not found.");
      return { brandId: brand.id, brandNameSnapshot: brand.name };
    }

    const brandName = optionalText(dto.brandNameSnapshot) ?? optionalText(dto.brand);
    if (!brandName) return { brandId: null, brandNameSnapshot: null };

    const normalizedName = normalizeSearchName(brandName);
    const brand = await client.brand.upsert({
      where: { normalizedName },
      create: { name: brandName, normalizedName },
      update: {},
    });
    return { brandId: brand.id, brandNameSnapshot: brand.name };
  }

  private async findOrCreateProduct(userId: string, dto: ItemProductInput) {
    const normalizedName = normalizeSearchName(dto.productName);
    const brand = await this.resolveBrandFields(dto);
    const packageSize = optionalNumber(dto.packageSize) ?? null;
    const packageUnit = dto.packageUnit ?? null;
    const existing = await this.prisma.product.findFirst({
      where: {
        userId,
        deletedAt: null,
        normalizedName,
        brandId: brand.brandId ?? null,
        packageSize,
        packageUnit,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.product.create({
      data: {
        userId,
        name: dto.productName,
        normalizedName,
        brand: brand.brandNameSnapshot,
        brandId: brand.brandId,
        category: optionalText(dto.category),
        defaultUnit: dto.unit ?? "un",
        packageSize,
        packageUnit,
      },
    });
  }

  private async snapshotFromProduct(dto: ItemProductInput, product: ProductSnapshot) {
    const explicitBrand = await this.resolveBrandFields(dto);
    const brandId = explicitBrand.brandId ?? product.brandId ?? null;
    const brandNameSnapshot = explicitBrand.brandNameSnapshot ?? product.brand ?? null;
    const packageSize = optionalNumber(dto.packageSize) ?? product.packageSize ?? null;
    const packageUnit = dto.packageUnit ?? product.packageUnit ?? null;

    return {
      productId: product.id,
      productName: dto.productName,
      brand: brandNameSnapshot,
      brandId,
      brandNameSnapshot,
      category: optionalText(dto.category) ?? product.category ?? null,
      packageSize,
      packageUnit,
    };
  }
}
