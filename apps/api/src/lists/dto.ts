import { PartialType } from "@nestjs/swagger";
import { SharedRole, Unit } from "@prisma/client";
import { IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateListDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateListDto extends PartialType(CreateListDto) {}

export class CreateListItemDto {
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedQuantity?: number;

  @IsEnum(Unit)
  unit!: Unit;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateListItemDto extends PartialType(CreateListItemDto) {}

export class CheckListItemDto {
  @IsOptional()
  @IsBoolean()
  checked?: boolean;
}

export class CreateInviteDto {
  @IsOptional()
  @IsEmail()
  inviteEmail?: string;

  @IsOptional()
  @IsEnum(SharedRole)
  role!: SharedRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(SharedRole)
  role!: SharedRole;
}
