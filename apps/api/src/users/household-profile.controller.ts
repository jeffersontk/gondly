import { BadRequestException, Body, Controller, Delete, Get, Header, NotFoundException, Put, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { validateHouseholdProfile } from "@gondly/utils";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { JwtUser } from "../common/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller("users/me/planning-profile")
export class HouseholdProfileController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  async get(@CurrentUser() user: JwtUser) {
    const record = await this.prisma.user.findUnique({ where: { id: user.id }, select: { planningProfile: true } });
    if (!record) throw new NotFoundException();
    return record.planningProfile;
  }
  @Put()
  async save(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    let profile;
    try { profile = validateHouseholdProfile(body); } catch { throw new BadRequestException("Confira os dados do perfil da casa."); }
    await this.prisma.user.update({ where: { id: user.id }, data: { planningProfile: JSON.parse(JSON.stringify(profile)) } });
    return profile;
  }
  @Delete()
  async remove(@CurrentUser() user: JwtUser) {
    await this.prisma.user.update({ where: { id: user.id }, data: { planningProfile: Prisma.DbNull } });
    return { removed: true };
  }
}
