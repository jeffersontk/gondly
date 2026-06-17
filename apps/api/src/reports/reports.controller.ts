import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { JwtUser } from "../common/auth.types";
import { ReportFiltersDto } from "./dto";
import { ReportsService } from "./reports.service";

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: JwtUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.dashboard(user.id, filters);
  }

  @Get("monthly-spending")
  monthlySpending(@CurrentUser() user: JwtUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.monthlySpending(user.id, filters);
  }

  @Get("markets-ranking")
  marketsRanking(@CurrentUser() user: JwtUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.marketsRanking(user.id, filters);
  }

  @Get("most-purchased-products")
  mostPurchasedProducts(@CurrentUser() user: JwtUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.mostPurchasedProducts(user.id, filters);
  }

  @Get("highest-price-variation")
  highestPriceVariation(@CurrentUser() user: JwtUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.highestPriceVariation(user.id, filters);
  }

  @Get("most-expensive-products")
  mostExpensiveProducts(@CurrentUser() user: JwtUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.mostExpensiveProducts(user.id, filters);
  }

  @Get("products-price-comparison")
  productsPriceComparison(@CurrentUser() user: JwtUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.productsPriceComparison(user.id, filters.q, filters);
  }

  @Get("products/:productId/price-history")
  priceHistory(@CurrentUser() user: JwtUser, @Param("productId") productId: string, @Query() filters: ReportFiltersDto) {
    return this.reportsService.productPriceHistory(user.id, productId, filters);
  }

  @Get("products/:productId/markets-comparison")
  marketsComparison(@CurrentUser() user: JwtUser, @Param("productId") productId: string, @Query() filters: ReportFiltersDto) {
    return this.reportsService.productMarketsComparison(user.id, productId, filters);
  }

  @Get("products/:productId/best-market")
  bestMarket(@CurrentUser() user: JwtUser, @Param("productId") productId: string, @Query() filters: ReportFiltersDto) {
    return this.reportsService.productBestMarket(user.id, productId, filters);
  }
}
