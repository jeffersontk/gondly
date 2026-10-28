import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ListsController } from "./lists.controller";
import { ListsService } from "./lists.service";
import { PushModule } from "../push/push.module";

@Module({
  imports: [BillingModule, RealtimeModule, PushModule],
  controllers: [ListsController],
  providers: [ListsService],
  exports: [ListsService],
})
export class ListsModule {}
