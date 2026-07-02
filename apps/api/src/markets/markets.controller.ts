import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { JwtUser } from "../common/auth.types";
import { CreateMarketDto, UpdateMarketDto } from "./dto";
import { MarketsService } from "./markets.service";

@ApiTags("Markets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("markets")
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.marketsService.list(user.id);
  }

  @Get("nearby")
  nearby(@CurrentUser() user: JwtUser, @Query("latitude") latitude?: string, @Query("longitude") longitude?: string) {
    return this.marketsService.nearby(user.id, latitude, longitude);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateMarketDto) {
    return this.marketsService.create(user.id, dto);
  }

  @Get(":id")
  get(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.marketsService.get(user.id, id);
  }

  @Put(":id")
  update(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: UpdateMarketDto) {
    return this.marketsService.update(user.id, id, dto);
  }

  @Patch(":id")
  patch(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: UpdateMarketDto) {
    return this.marketsService.update(user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.marketsService.remove(user.id, id);
  }

  @Get(":id/summary")
  summary(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.marketsService.summary(user.id, id);
  }
}
