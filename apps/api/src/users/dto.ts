import { ShareLocationLevel } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";

export class UpdatePriceSharingPreferenceDto {
  @IsOptional()
  @IsBoolean()
  sharePrices?: boolean;

  @IsOptional()
  @IsEnum(ShareLocationLevel)
  shareLocationLevel?: ShareLocationLevel;
}
