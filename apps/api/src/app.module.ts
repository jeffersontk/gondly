import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { BrandsModule } from "./brands/brands.module";
import { GeocodingModule } from "./geocoding/geocoding.module";
import { ListsModule } from "./lists/lists.module";
import { MarketsModule } from "./markets/markets.module";
import { PriceComparisonModule } from "./price-comparison/price-comparison.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { PurchasesModule } from "./purchases/purchases.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { ReportsModule } from "./reports/reports.module";
import { SharingModule } from "./sharing/sharing.module";
import { SharedPriceRecordsModule } from "./shared-price-records/shared-price-records.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") ?? "dev-secret",
        signOptions: { expiresIn: (config.get<string>("JWT_EXPIRES_IN") ?? "30d") as never },
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    MarketsModule,
    GeocodingModule,
    PriceComparisonModule,
    BrandsModule,
    ProductsModule,
    ListsModule,
    SharingModule,
    SharedPriceRecordsModule,
    PurchasesModule,
    ReportsModule,
    BillingModule,
    RealtimeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
