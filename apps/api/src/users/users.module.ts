import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { MeController } from "./me.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { HouseholdProfileController } from "./household-profile.controller";

@Module({
  imports: [BillingModule],
  controllers: [UsersController, MeController, HouseholdProfileController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
