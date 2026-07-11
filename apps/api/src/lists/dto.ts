import { PartialType } from "@nestjs/swagger";
import { ListItemStatus, SharedRole, Unit } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

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
  brandId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brandNameSnapshot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packageSize?: number;

  @IsOptional()
  @IsEnum(Unit)
  packageUnit?: Unit;

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

  @IsOptional()
  @IsBoolean()
  important?: boolean;
}

export class UpdateListItemDto extends PartialType(CreateListItemDto) {}

export class ImportListItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateListItemDto)
  items!: CreateListItemDto[];
}

export class SetListItemStateDto {
  @IsEnum(ListItemStatus)
  status!: ListItemStatus;
}

export class SetListItemImportantDto {
  @IsBoolean()
  important!: boolean;
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

export class CreateListMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}
