import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PriceLibraryController } from "./price-library.controller";
import { PriceComparisonController } from "./price-comparison.controller";
import { PriceComparisonService } from "./price-comparison.service";

@Module({
  imports: [PrismaModule],
  controllers: [PriceComparisonController, PriceLibraryController],
  providers: [PriceComparisonService],
})
export class PriceComparisonModule {}
