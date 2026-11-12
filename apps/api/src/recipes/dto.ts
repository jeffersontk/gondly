import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { MealSlot } from "@prisma/client";
export class RecipeIngredientDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsIn(["g", "ml", "un"]) unit!: "g" | "ml" | "un";
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(1000000) quantity!: number;
}
export class CreateRecipeDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(10000) caloriesPerServing?: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(1000) nutritionSource?: string;
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(4) @IsIn(["breakfast", "lunch", "dinner", "snack"], { each: true }) mealTypes?: MealSlot[];
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsInt() @Min(1) @Max(100) servings!: number;
  @IsInt() @Min(0) @Max(1440) prepMinutes!: number;
  @IsInt() @Min(0) @Max(1440) cookMinutes!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => RecipeIngredientDto) ingredients!: RecipeIngredientDto[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) @MinLength(2, { each: true }) @MaxLength(3000, { each: true }) steps!: string[];
}
export class RecipePlanDto {
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(100) servings!: number;
  @IsOptional() @IsBoolean() usePantry?: boolean;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
}
export class PantryQuantityDto {
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(1000000) quantity!: number;
}
export class ConfirmPurchaseIngredientDto extends PantryQuantityDto {
  @IsString() @MinLength(1) @MaxLength(100) ingredientId!: string;
}
export class MealEnergyDto {
  @IsIn(["breakfast", "lunch", "dinner", "snack"]) meal!: MealSlot;
  @IsInt() @Min(1) @Max(10000) calories!: number;
}
export class CaloriePlanDto {
  @IsInt() @Min(1) @Max(10000) targetCalories!: number;
  @IsInt() @Min(1) @Max(14) days!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) startDate!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => MealEnergyDto) meals!: MealEnergyDto[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ArrayUnique() @IsString({ each: true }) @MaxLength(100, { each: true }) recipeIds!: string[];
  @IsOptional() @IsBoolean() usePantry?: boolean;
  @IsOptional() @IsBoolean() acceptDifference?: boolean;
}
