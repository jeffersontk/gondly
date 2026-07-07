import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SharedPriceRecordsController } from "./shared-price-records.controller";
import { SharedPriceRecordsService } from "./shared-price-records.service";

@Module({
  imports: [PrismaModule],
  controllers: [SharedPriceRecordsController],
  providers: [SharedPriceRecordsService],
})
export class SharedPriceRecordsModule {}
