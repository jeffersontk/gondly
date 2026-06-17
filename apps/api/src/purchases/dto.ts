import { PartialType } from "@nestjs/swagger";
import { Unit } from "@prisma/client";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class StartPurchaseDto {
  @IsOptional()
  @IsString()
  sourceListId?: string;

  @IsOptional()
  @IsBoolean()
  cancelActive?: boolean;
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  marketId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreatePurchaseItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  productName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsEnum(Unit)
  unit!: Unit;

  @IsNumber()
  @Min(0)
  pricePaid!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdatePurchaseItemDto extends PartialType(CreatePurchaseItemDto) {}

export class FinishPurchaseDto {
  @IsString()
  marketId!: string;

  @IsNumber()
  @Min(0)
  finalPaidAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
