import { IsIn, IsOptional, IsString } from "class-validator";

export class ReportFiltersDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

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
