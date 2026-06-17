import { PartialType } from "@nestjs/swagger";
import { Unit } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsEnum(Unit)
  defaultUnit!: Unit;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  barcode?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
