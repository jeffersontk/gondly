import { Module } from "@nestjs/common";
import { ListsModule } from "../lists/lists.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { PurchasesController } from "./purchases.controller";
import { PurchasesService } from "./purchases.service";

@Module({
  imports: [ListsModule, RealtimeModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
