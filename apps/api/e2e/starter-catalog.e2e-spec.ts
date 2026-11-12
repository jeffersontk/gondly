import "reflect-metadata";
import assert from "node:assert/strict";
import { it } from "node:test";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/prisma/prisma.service";

it("seeded starter catalog is visible to a new user, exposes provenance and generates complete shopping lists", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "http://missing");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && ["15432", "55432"].includes(url.port), "Explicit local database only");
  const app = await NestFactory.create(AppModule, { logger: false }); configureApp(app); await app.listen(0, "127.0.0.1");
  const prisma = app.get(PrismaService);
  const origin = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  let userId: string | undefined;
  try {
    const user = await prisma.user.create({ data: { name: "Catalog fixture", email: `starter-${randomUUID()}@example.invalid` } }); userId = user.id;
    const token = app.get(JwtService).sign({ sub: user.id, email: user.email, name: user.name });
    const request = (path: string, body?: unknown) => fetch(origin + path, { method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const existing = await prisma.marketList.create({ data: { userId, name: "Lista preservada fixture" } });
    const seeds = await prisma.recipe.findMany({ where: { slug: { startsWith: "gondly-base-" } }, include: { ingredients: true } });
    assert.equal(seeds.length, 45, "Import starter.json locally before this integration check");
    const listing = await (await request("/recipes")).json() as { id: string; own: boolean; caloriesPerServing: number | null }[];
    assert.ok(seeds.every(seed => listing.some(recipe => recipe.id === seed.id && !recipe.own && recipe.caloriesPerServing === null)));
    for (const seed of seeds) {
      const detail = await (await request(`/recipes/${seed.id}`)).json() as { sourceUrl: string; attribution: string; origin: string };
      assert.equal(detail.sourceUrl, seed.sourceUrl); assert.ok(detail.attribution); assert.equal(detail.origin, "ai_assisted");
      const preview = await request(`/recipes/${seed.id}/preview`, { servings: Number(seed.servings), usePantry: false });
      assert.equal(preview.status, 201);
      const result = await preview.json() as { ingredients: { unknown: boolean; required: number; missing: number }[] };
      assert.ok(result.ingredients.length >= 2);
      assert.ok(result.ingredients.every(item => !item.unknown && item.required > 0 && item.required === item.missing), seed.slug);
    }
    const pf = seeds.find(recipe => recipe.slug === "gondly-base-11")!;
    const create = await request(`/recipes/${pf.id}/list`, { servings: 4, usePantry: false });
    assert.equal(create.status, 201);
    const list = await create.json() as { id: string; items: { ingredientId: string; expectedQuantity: string }[] };
    const rice = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "arroz-branco-cru" } });
    assert.equal(Number(list.items.find(item => item.ingredientId === rice.id)?.expectedQuantity), 160);
    assert.ok(await prisma.marketList.findUnique({ where: { id: existing.id } }));
    assert.equal((await request("/recipes/meal-plan/preview", { targetCalories: 1600, days: 1, startDate: "2026-11-12", recipeIds: [pf.id], meals: [{ meal: "lunch", calories: 1600 }] })).status, 400);
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await app.close();
  }
});
