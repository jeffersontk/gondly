import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { buildAllowedOrigins, isAllowedOrigin } from "./common/cors-origins";

// Shared by main.ts and the e2e tests, so tests run the API with the same middleware and validation as production.
export function configureApp(app: INestApplication) {
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
}
