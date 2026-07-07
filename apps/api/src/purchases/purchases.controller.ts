import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { JwtUser } from "../common/auth.types";
import {
  CreatePurchaseItemDto,
  FinishPurchaseDto,
  StartPurchaseDto,
  UpdatePurchaseDto,
  UpdatePurchaseItemDto,
} from "./dto";
import { PurchasesService } from "./purchases.service";

@ApiTags("Purchases")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("purchases")
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post("start")
  start(@CurrentUser() user: JwtUser, @Body() dto: StartPurchaseDto) {
    return this.purchasesService.start(user.id, dto);
  }

  @Get("active")
  active(@CurrentUser() user: JwtUser) {
    return this.purchasesService.active(user.id);
  }

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.purchasesService.list(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.purchasesService.get(user.id, id);
  }

  @Delete("history")
  clearHistory(@CurrentUser() user: JwtUser) {
    return this.purchasesService.clearHistory(user.id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.purchasesService.remove(user.id, id);
  }

  @Put(":id")
  update(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: UpdatePurchaseDto) {
    return this.purchasesService.update(user.id, id, dto);
  }

  @Post(":id/items")
  addItem(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: CreatePurchaseItemDto) {
    return this.purchasesService.addItem(user.id, id, dto);
  }

  @Put(":id/items/:itemId")
  updateItem(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdatePurchaseItemDto,
  ) {
    return this.purchasesService.updateItem(user.id, id, itemId, dto);
  }

  @Delete(":id/items/:itemId")
  removeItem(@CurrentUser() user: JwtUser, @Param("id") id: string, @Param("itemId") itemId: string) {
    return this.purchasesService.removeItem(user.id, id, itemId);
  }

  @Post(":id/finish")
  finish(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: FinishPurchaseDto) {
    return this.purchasesService.finish(user.id, id, dto);
  }

  @Post(":id/cancel")
  cancel(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.purchasesService.cancel(user.id, id);
  }

  @Post(":id/duplicate-as-list")
  duplicateAsList(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.purchasesService.duplicateAsList(user.id, id);
  }
}
