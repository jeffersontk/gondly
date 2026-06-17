import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class AuthGoogleDto {
  @ApiProperty({ description: "Google ID token returned by Google Identity Services." })
  @IsString()
  @MinLength(3)
  idToken!: string;
}

export class GoogleLoginDto extends AuthGoogleDto {}
