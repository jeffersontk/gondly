import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { JwtUser } from "../common/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PurchaseRegionalPriceComparisonQueryDto, RegionalPriceComparisonQueryDto } from "./dto";
import { PriceComparisonService } from "./price-comparison.service";

@ApiTags("Price comparison")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("price-comparison")
export class PriceComparisonController {
  constructor(private readonly priceComparisonService: PriceComparisonService) {}

  @Get("regional")
  regional(@CurrentUser() user: JwtUser, @Query() query: RegionalPriceComparisonQueryDto) {
    return this.priceComparisonService.regional(user.id, query);
  }

  @Get("purchase/:purchaseId/regional")
  purchaseRegional(@CurrentUser() user: JwtUser, @Param("purchaseId") purchaseId: string, @Query() query: PurchaseRegionalPriceComparisonQueryDto) {
    return this.priceComparisonService.purchaseRegional(user.id, purchaseId, query);
  }
}
