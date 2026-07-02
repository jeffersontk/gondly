import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { roundMoney } from "@gondly/utils";
import { PrismaService } from "../prisma/prisma.service";
import { toNumber } from "../common/utils/money";
import { CreateMarketDto, UpdateMarketDto } from "./dto";

@Injectable()
export class MarketsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.market.findMany({
      where: { deletedAt: null, OR: [{ createdByUserId: userId }, { createdByUserId: null }] },
      orderBy: [{ name: "asc" }, { city: "asc" }],
    });
  }

  create(userId: string, dto: CreateMarketDto) {
    return this.prisma.market.create({
      data: {
        ...marketLocationData(dto, { defaultCountry: true }),
        name: dto.name.trim(),
        normalizedName: normalizeMarketName(dto.name),
        createdByUserId: userId,
        verifiedStatus: "user_created",
      },
    });
  }

  async get(userId: string, id: string) {
    const market = await this.prisma.market.findFirst({
      where: { id, deletedAt: null, OR: [{ createdByUserId: userId }, { createdByUserId: null }] },
    });

    if (!market) {
      throw new NotFoundException("Market not found.");
    }

    return market;
  }

  async update(userId: string, id: string, dto: UpdateMarketDto) {
    await this.getOwned(userId, id);
    const data: Prisma.MarketUpdateInput = {
      ...marketLocationData(dto),
    };
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      data.normalizedName = normalizeMarketName(dto.name);
    }

    return this.prisma.market.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    return this.prisma.market.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async nearby(userId: string, latitudeValue?: string, longitudeValue?: string) {
    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException("Latitude and longitude are required.");
    }

    const markets = await this.prisma.market.findMany({
      where: {
        deletedAt: null,
        latitude: { not: null },
        longitude: { not: null },
        OR: [{ createdByUserId: userId }, { createdByUserId: null }],
      },
      take: 100,
    });

    return markets
      .map((market) => ({
        ...market,
        distanceKm: roundMoney(distanceInKm(latitude, longitude, market.latitude!, market.longitude!)),
      }))
      .filter((market) => market.distanceKm <= 50)
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, 20);
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

  private async getOwned(userId: string, id: string) {
    const market = await this.prisma.market.findFirst({
      where: { id, createdByUserId: userId, deletedAt: null },
    });

    if (!market) {
      throw new NotFoundException("Market not found.");
    }

    return market;
  }
}

export function normalizeMarketName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function marketLocationData(dto: Partial<CreateMarketDto>, options: { defaultCountry?: boolean } = {}) {
  return {
    address: optionalText(dto.address),
    neighborhood: optionalText(dto.neighborhood),
    city: optionalText(dto.city),
    state: optionalText(dto.state)?.toUpperCase(),
    country: optionalText(dto.country)?.toUpperCase() ?? (options.defaultCountry ? "BR" : undefined),
    postalCode: optionalText(dto.postalCode),
    latitude: dto.latitude,
    longitude: dto.longitude,
    placeId: optionalText(dto.placeId),
    notes: optionalText(dto.notes),
  };
}

function optionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function distanceInKm(latitude: number, longitude: number, otherLatitude: number, otherLongitude: number) {
  const earthRadiusKm = 6371;
  const dLat = degreesToRadians(otherLatitude - latitude);
  const dLon = degreesToRadians(otherLongitude - longitude);
  const lat1 = degreesToRadians(latitude);
  const lat2 = degreesToRadians(otherLatitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
