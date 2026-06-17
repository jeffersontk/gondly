import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ListsController } from "./lists.controller";
import { ListsService } from "./lists.service";

@Module({
  imports: [BillingModule, RealtimeModule],
  controllers: [ListsController],
  providers: [ListsService],
  exports: [ListsService],
})
export class ListsModule {}
