import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { buildAllowedOrigins, isAllowedOrigin } from "./common/cors-origins";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origins = buildAllowedOrigins(
    config.get<string>("FRONTEND_URL"),
    config.get<string>("WEB_ORIGIN"),
    config.get<string>("CORS_ORIGINS"),
  );

  app.use(helmet());

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      callback(null, isAllowedOrigin(origin, origins));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Gondly API")
    .setDescription("API for grocery lists, purchases, price history and collaborative shopping.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = Number(config.get<string>("PORT") ?? config.get<string>("API_PORT") ?? 3333);
  await app.listen(port, "0.0.0.0");
}

bootstrap();
