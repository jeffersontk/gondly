import { RealtimeModule } from "../realtime/realtime.module";
import { Module } from "@nestjs/common";
import { ReplenishmentService } from "./replenishment.service";
import { ReplenishmentController } from "./replenishment.controller";
@Module({ imports: [RealtimeModule], controllers: [ReplenishmentController], providers: [ReplenishmentService] })
export class ReplenishmentModule {
}
