import { Module } from "@nestjs/common";
import { ListsModule } from "../lists/lists.module";
import { SharingController } from "./sharing.controller";
import { SharingService } from "./sharing.service";

@Module({
  imports: [ListsModule],
  controllers: [SharingController],
  providers: [SharingService],
})
export class SharingModule {}
