import { Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { timingSafeEqual } from "crypto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { JwtUser } from "../common/auth.types";
import { PushSubscriptionDto, RemovePushSubscriptionDto } from "./dto";
import { PushService } from "./push.service";

@ApiTags("Push")
@Controller("push")
export class PushController {
  constructor(
    private readonly pushService: PushService,
    private readonly config: ConfigService,
  ) {}

  @Get("public-key")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  publicKey() {
    return this.pushService.getPublicKey();
  }

  @Post("subscriptions")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  subscribe(@CurrentUser() user: JwtUser, @Body() dto: PushSubscriptionDto) {
    return this.pushService.subscribe(user.id, dto);
  }

  @Delete("subscriptions")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  unsubscribe(@CurrentUser() user: JwtUser, @Body() dto: RemovePushSubscriptionDto) {
    return this.pushService.unsubscribe(user.id, dto.endpoint);
  }

  // Called by an external scheduler (no user session), authenticated with the shared CRON_SECRET.
  @Post("reminders/run")
  @HttpCode(200)
  runReminders(@Headers("x-cron-secret") secret?: string) {
    const expected = this.config.get<string>("CRON_SECRET");
    if (!expected || !secret || !safeEqual(secret, expected)) {
      throw new ForbiddenException("Invalid cron secret.");
    }
    return this.pushService.runFinishReminders();
  }
}

function safeEqual(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
