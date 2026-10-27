import { Module } from "@nestjs/common";
import { MarketsController } from "./markets.controller";
import { MarketsService } from "./markets.service";
import { MarketDiscoveryService } from "./market-discovery.service";

@Module({
  controllers: [MarketsController],
  providers: [MarketsService, MarketDiscoveryService],
  exports: [MarketsService],
})
export class MarketsModule {}
