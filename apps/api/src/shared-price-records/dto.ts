import { SharedPriceReportReason } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class ReportSharedPriceRecordDto {
  @IsEnum(SharedPriceReportReason)
  reason!: SharedPriceReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
