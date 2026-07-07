import { Injectable, NotFoundException } from "@nestjs/common";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdatePriceSharingPreferenceDto } from "./dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        photoUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const monetization = await this.billingService.getBillingStatus(userId);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      monetization,
    };
  }

  async priceSharingPreference(userId: string) {
    const preference = await this.prisma.userPriceSharingPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return this.priceSharingPreferenceDto(preference);
  }

  async updatePriceSharingPreference(userId: string, dto: UpdatePriceSharingPreferenceDto) {
    const preference = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.userPriceSharingPreference.upsert({
        where: { userId },
        create: {
          userId,
          sharePrices: dto.sharePrices ?? false,
          shareLocationLevel: dto.shareLocationLevel ?? "city",
        },
        update: {
          ...(dto.sharePrices !== undefined ? { sharePrices: dto.sharePrices } : {}),
          ...(dto.shareLocationLevel !== undefined ? { shareLocationLevel: dto.shareLocationLevel } : {}),
        },
      });

      if (dto.sharePrices === false) {
        await tx.sharedPriceRecord.updateMany({
          where: { userId, visibility: "shared" },
          data: { visibility: "private" },
        });
      }

      return saved;
    });

    return this.priceSharingPreferenceDto(preference);
  }

  private priceSharingPreferenceDto(preference: {
    sharePrices: boolean;
    shareLocationLevel: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      sharePrices: preference.sharePrices,
      shareLocationLevel: preference.shareLocationLevel,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
  }
}
