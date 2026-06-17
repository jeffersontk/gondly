import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { JwtUser } from "../common/auth.types";
import { CreateProductDto, UpdateProductDto } from "./dto";
import { ProductsService } from "./products.service";

@ApiTags("Products")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query("q") q?: string) {
    return this.productsService.list(user.id, q);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.id, dto);
  }

  @Get("search")
  search(@CurrentUser() user: JwtUser, @Query("q") q = "") {
    return this.productsService.search(user.id, q);
  }

  @Get(":id")
  get(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.productsService.get(user.id, id);
  }

  @Put(":id")
  update(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.productsService.remove(user.id, id);
  }

  @Get(":id/summary")
  summary(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.productsService.summary(user.id, id);
  }
}
