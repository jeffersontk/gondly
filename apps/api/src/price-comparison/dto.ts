import { Unit } from "@prisma/client";
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from "class-validator";

class CoordinateRadiusQueryDto {
  @ValidateIf(value => value.latitude !== undefined || value.longitude !== undefined || value.radiusKm !== undefined)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ValidateIf(value => value.latitude !== undefined || value.longitude !== undefined || value.radiusKm !== undefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ValidateIf(value => value.latitude !== undefined || value.longitude !== undefined || value.radiusKm !== undefined)
  @IsNumber()
  @Min(0.1)
  @Max(500)
  radiusKm?: number;
}

export class RegionalPriceComparisonQueryDto extends CoordinateRadiusQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  canonicalProductId?: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(Unit)
  unit?: Unit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packageSize?: number;

  @IsOptional()
  @IsEnum(Unit)
  packageUnit?: Unit;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  periodDays?: number;
}

export class PurchaseRegionalPriceComparisonQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(500)
  radiusKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  periodDays?: number;
}

export class PriceLibraryQueryDto extends CoordinateRadiusQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  marketId?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  periodDays?: number;

  @IsOptional()
  @IsIn(["cheapest", "most_recent", "most_records"])
  sort?: "cheapest" | "most_recent" | "most_records";
}

export class PriceLibraryMarketsQueryDto extends CoordinateRadiusQueryDto {
  @IsString()
  productName!: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packageSize?: number;

  @IsOptional()
  @IsEnum(Unit)
  packageUnit?: Unit;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  periodDays?: number;
}
