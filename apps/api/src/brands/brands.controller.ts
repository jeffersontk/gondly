import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { BrandsService } from "./brands.service";
import { CreateBrandDto } from "./dto";

@ApiTags("Brands")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("brands")
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  list(@Query("q") q?: string) {
    return this.brandsService.list(q);
  }

  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto);
  }
}
