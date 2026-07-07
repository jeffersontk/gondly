import { BadRequestException, Injectable } from "@nestjs/common";
import { normalizeSearchName, optionalText } from "../common/utils/normalize";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBrandDto } from "./dto";

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  list(q?: string) {
    const normalizedQuery = q ? normalizeSearchName(q) : "";
    return this.prisma.brand.findMany({
      where: normalizedQuery ? { normalizedName: { contains: normalizedQuery } } : {},
      orderBy: { name: "asc" },
      take: 20,
    });
  }

  create(dto: CreateBrandDto) {
    const name = optionalText(dto.name);
    if (!name) {
      throw new BadRequestException("Brand name is required.");
    }

    const normalizedName = normalizeSearchName(name);
    return this.prisma.brand.upsert({
      where: { normalizedName },
      create: { name, normalizedName },
      update: {},
    });
  }
}
