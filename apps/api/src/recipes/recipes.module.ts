import { Module } from "@nestjs/common";
import { RecipesController } from "./recipes.controller";
import { RecipesService } from "./recipes.service";
import { PublicRecipesController } from "./public-recipes.controller";
@Module({ controllers: [RecipesController, PublicRecipesController], providers: [RecipesService] })
export class RecipesModule {}
