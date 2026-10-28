import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class ReportFiltersDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  marketId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(["30d", "90d", "6m", "1y", "all"])
  period?: "30d" | "90d" | "6m" | "1y" | "all";
}
