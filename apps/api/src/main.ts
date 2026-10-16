import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureApp(app);

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
