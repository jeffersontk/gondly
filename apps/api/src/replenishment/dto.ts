import { IsBoolean, IsDateString, IsInt, IsString, Max, MaxLength, Min } from "class-validator";
export class ReplenishmentDto {
    @IsBoolean()
    enabled!: boolean;
    @IsInt()
    @Min(1)
    @Max(365)
    intervalDays!: number;
    @IsDateString()
    nextReminderAt!: string;
    @IsInt()
    @Min(0)
    @Max(23)
    quietStart!: number;
    @IsInt()
    @Min(0)
    @Max(23)
    quietEnd!: number;
    @IsString()
    @MaxLength(80)
    timeZone!: string;
}
export class DismissSuggestionDto {
    @IsString()
    @MaxLength(1000)
    key!: string;
}
