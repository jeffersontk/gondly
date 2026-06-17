import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { JwtUser } from "../common/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { BillingService } from "./billing.service";

@ApiTags("Billing")
@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("status")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: JwtUser) {
    return this.billingService.getBillingStatus(user.id);
  }

  @Post("remove-ads/checkout")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeAdsCheckout(@CurrentUser() user: JwtUser) {
    return this.billingService.createRemoveAdsCheckout(user.id);
  }

  @Post("webhook/mercado-pago")
  mercadoPagoWebhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.billingService.handleMercadoPagoWebhook(body as never, headers, query);
  }

  @Get("purchases")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  purchases(@CurrentUser() user: JwtUser) {
    return this.billingService.purchases(user.id);
  }

  @Get("purchases/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  purchase(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.billingService.purchase(user.id, id);
  }
}
