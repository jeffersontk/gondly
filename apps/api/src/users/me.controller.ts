import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { JwtUser } from "../common/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdatePriceSharingPreferenceDto } from "./dto";
import { UsersService } from "./users.service";

@ApiTags("Me")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("me")
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get("price-sharing-preference")
  priceSharingPreference(@CurrentUser() user: JwtUser) {
    return this.usersService.priceSharingPreference(user.id);
  }

  @Patch("price-sharing-preference")
  updatePriceSharingPreference(@CurrentUser() user: JwtUser, @Body() dto: UpdatePriceSharingPreferenceDto) {
    return this.usersService.updatePriceSharingPreference(user.id, dto);
  }
}
