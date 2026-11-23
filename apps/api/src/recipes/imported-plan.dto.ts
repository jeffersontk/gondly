import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
export class ImportedGroupOptionDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,80}$/) id!: string;
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsString() @MinLength(1) @MaxLength(10000) text!: string;
}
export class ImportedGroupDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,80}$/) id!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ImportedGroupOptionDto) options!: ImportedGroupOptionDto[];
}
export class ImportedOptionDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,80}$/) id!: string;
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsString() @MaxLength(10000) text!: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => ImportedGroupDto) groups?: ImportedGroupDto[];
}
export class ImportedMealDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,80}$/) id!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/) time!: string;
  @IsString() @MaxLength(5000) notes!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(15) @ValidateNested({ each: true }) @Type(() => ImportedOptionDto) options!: ImportedOptionDto[];
}
export class ImportFoodPlanDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) startDate!: string;
  @IsInt() @Min(1) @Max(31) days!: number;
  @Transform(({ obj }) => obj.reviewed) @IsBoolean() reviewed!: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => ImportedMealDto) meals!: ImportedMealDto[];
}
export class FoodPlanChoiceDto {
  @IsInt() @Min(0) revision!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date!: string;
  @IsString() @MaxLength(80) mealId!: string;
  @IsString() @MaxLength(80) optionId!: string;
  @IsOptional() @IsString() @MaxLength(80) groupId?: string;
}
