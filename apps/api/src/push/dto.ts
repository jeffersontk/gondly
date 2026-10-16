import { IsOptional, IsString, MaxLength } from "class-validator";

export class PushSubscriptionDto {
  @IsString()
  @MaxLength(2048)
  endpoint!: string;

  @IsString()
  @MaxLength(256)
  p256dh!: string;

  @IsString()
  @MaxLength(256)
  auth!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

export class RemovePushSubscriptionDto {
  @IsString()
  @MaxLength(2048)
  endpoint!: string;
}
