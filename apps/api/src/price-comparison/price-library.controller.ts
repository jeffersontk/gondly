import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PriceLibraryMarketsQueryDto, PriceLibraryQueryDto } from "./dto";
import { PriceComparisonService } from "./price-comparison.service";

@ApiTags("Price library")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("price-library")
export class PriceLibraryController {
  constructor(private readonly priceComparisonService: PriceComparisonService) {}

  @Get()
  list(@Query() query: PriceLibraryQueryDto) {
    return this.priceComparisonService.priceLibrary(query);
  }

  @Get("markets")
  markets(@Query() query: PriceLibraryMarketsQueryDto) {
    return this.priceComparisonService.priceLibraryMarkets(query);
  }
}
