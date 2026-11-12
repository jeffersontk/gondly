import { Body, Controller, Get, Header, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import type { JwtUser } from "../common/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CaloriePlanDto, ConfirmPurchaseIngredientDto, CreateRecipeDto, PantryQuantityDto, RecipePlanDto } from "./dto";
import { RecipesService } from "./recipes.service";
@Controller("recipes")
@UseGuards(JwtAuthGuard)
export class RecipesController {
  constructor(private readonly service: RecipesService) {}
  @Get() @Header("Cache-Control", "no-store") list(@CurrentUser() user: JwtUser, @Query("q") q?: string) { return this.service.list(user.id, typeof q === "string" ? q : ""); }
  @Post() create(@CurrentUser() user: JwtUser, @Body() body: CreateRecipeDto) { return this.service.create(user.id, body); }
  @Post("meal-plan/preview") caloriePreview(@CurrentUser() user: JwtUser, @Body() body: CaloriePlanDto) { return this.service.caloriePreview(user.id, body); }
  @Post("meal-plan") saveCaloriePlan(@CurrentUser() user: JwtUser, @Body() body: CaloriePlanDto) { return this.service.saveCaloriePlan(user.id, body); }
  @Get("meal-plans") @Header("Cache-Control", "no-store") savedPlans(@CurrentUser() user: JwtUser) { return this.service.savedCaloriePlans(user.id); }
  @Get("meal-plans/:id") @Header("Cache-Control", "no-store") savedPlan(@CurrentUser() user: JwtUser, @Param("id") id: string) { return this.service.savedCaloriePlan(user.id, id); }
  @Get("ingredients") @Header("Cache-Control", "no-store") ingredients(@CurrentUser() user: JwtUser, @Query("q") q?: string) { return this.service.ingredients(user.id, typeof q === "string" ? q : ""); }
  @Get("pantry") @Header("Cache-Control", "no-store") pantry(@CurrentUser() user: JwtUser) { return this.service.pantry(user.id); }
  @Put("pantry/:id") setPantry(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() body: PantryQuantityDto) { return this.service.setPantry(user.id, id, body.quantity); }
  @Get("purchases/recent") @Header("Cache-Control", "no-store") purchases(@CurrentUser() user: JwtUser) { return this.service.recentPurchases(user.id); }
  @Post("purchases/:id/confirm") confirm(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() body: ConfirmPurchaseIngredientDto) { return this.service.confirmPurchase(user.id, id, body); }
  @Get(":id") @Header("Cache-Control", "no-store") detail(@CurrentUser() user: JwtUser, @Param("id") id: string) { return this.service.detail(user.id, id); }
  @Post(":id/preview") preview(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() body: RecipePlanDto) { return this.service.preview(user.id, id, body); }
  @Post(":id/list") listFromRecipe(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() body: RecipePlanDto) { return this.service.createList(user.id, id, body); }
}
