import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { JwtUser } from "../common/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ReportSharedPriceRecordDto } from "./dto";
import { SharedPriceRecordsService } from "./shared-price-records.service";

@ApiTags("Shared price records")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("shared-price-records")
export class SharedPriceRecordsController {
  constructor(private readonly sharedPriceRecordsService: SharedPriceRecordsService) {}

  @Post(":id/report")
  report(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: ReportSharedPriceRecordDto) {
    return this.sharedPriceRecordsService.report(user.id, id, dto);
  }
}
