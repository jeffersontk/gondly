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

it("imported plans require review, remain private and persist bounded daily choices without lost updates", async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "http://missing").hostname), "Use a local database");
  const app = await NestFactory.create(AppModule, { logger: false }); configureApp(app); await app.listen(0, "127.0.0.1");
  const prisma = app.get(PrismaService), users: string[] = [], tokens: string[] = [];
  const origin = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const request = (who: number, path: string, method = "GET", body?: unknown) => fetch(origin + path, { method, headers: { Authorization: `Bearer ${tokens[who] ?? ""}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    for (let index = 0; index < 2; index++) { const user = await prisma.user.create({ data: { name: "Plan fixture", email: `food-plan-${randomUUID()}@example.invalid` } }); users.push(user.id); tokens.push(app.get(JwtService).sign({ sub: user.id, email: user.email, name: user.name })); }
    const original = await prisma.marketList.create({ data: { userId: users[0], name: "Lista anterior", items: { create: [{ productName: "Arroz", unit: "kg", expectedQuantity: 1 }] } } });
    const body = { name: "Plano privado", startDate: "2026-11-23", days: 7, reviewed: true, meals: [{ id: "lunch", name: "Almoço", time: "13:00", notes: "Conferir alternativas", options: [{ id: "one", title: "Primeira opção", text: "120g arroz OU 550g batata" }, { id: "two", title: "Segunda opção", text: "100g frango" }] }] };
    assert.equal((await request(9, "/recipes/plans")).status, 401);
    assert.equal((await request(0, "/recipes/plans/import", "POST", { ...body, reviewed: false })).status, 400);
    assert.equal((await request(0, "/recipes/plans/import", "POST", { ...body, reviewed: "true" })).status, 400);
    assert.equal((await request(0, "/recipes/plans/import", "POST", { ...body, startDate: "2026-02-30" })).status, 400);
    assert.equal((await request(0, "/recipes/plans/import", "POST", { ...body, meals: [body.meals[0], body.meals[0]] })).status, 400);
    const created = await request(0, "/recipes/plans/import", "POST", body); assert.equal(created.status, 201); const { id } = await created.json() as { id: string };
    assert.equal((await request(1, `/recipes/meal-plans/${id}`)).status, 404);
    assert.deepEqual(await (await request(1, "/recipes/plans")).json(), []);
    const summaries = await (await request(0, "/recipes/plans")).json() as { id: string }[]; assert.equal(summaries[0].id, id);
    const read = await request(0, `/recipes/meal-plans/${id}`); assert.equal(read.headers.get("cache-control"), "no-store");
    type PlanResult = { revision: number; importedPlan: { choices: Record<string, Record<string, string>> }; recipes: unknown[]; dailyCalorieTarget: unknown };
    const plan = await read.json() as PlanResult; assert.equal(Object.keys(plan.importedPlan.choices).length, 7); assert.equal(plan.importedPlan.choices['2026-11-23'].lunch, 'one'); assert.equal(plan.importedPlan.choices['2026-11-24'].lunch, 'two'); assert.equal(plan.recipes.length, 0); assert.equal(plan.dailyCalorieTarget, null);
    const choice = { revision: 0, date: "2026-11-23", mealId: "lunch", optionId: "one" };
    assert.equal((await request(1, `/recipes/plans/${id}/day`, "PUT", choice)).status, 404);
    assert.equal((await request(0, `/recipes/plans/${id}/day`, "PUT", { ...choice, date: "2026-11-22" })).status, 400);
    assert.equal((await request(0, `/recipes/plans/${id}/day`, "PUT", { ...choice, optionId: "missing" })).status, 400);
    assert.equal((await request(0, `/recipes/plans/${id}/day`, "PUT", choice)).status, 200);
    assert.equal((await request(0, `/recipes/plans/${id}/day`, "PUT", { ...choice, date: "2026-11-24" })).status, 409);
    const persisted = await (await request(0, `/recipes/meal-plans/${id}`)).json() as PlanResult; assert.equal(persisted.revision, 1); assert.equal(persisted.importedPlan.choices[choice.date].lunch, "one"); assert.equal(persisted.importedPlan.choices["2026-11-24"].lunch, 'two');
    assert.equal((await request(0, `/recipes/plans/${id}/day`, "PUT", { ...choice, revision: 1, optionId: "" })).status, 200);
    const groupedBody = { ...body, meals: [{ ...body.meals[0], options: [{ id: 'plate', title: 'Prato principal', text: 'Vegetais: pelo menos 150g\n1 porção de carboidrato: 120g arroz + 150g feijão\nou 550g batata\n1 porção de proteína: 100g frango\nNOME: Exemplo DATA: 23/11/2026\nou 90g atum' }] }] };
    const groupedResponse = await request(0, '/recipes/plans/import', 'POST', groupedBody); assert.equal(groupedResponse.status, 201);
    const groupedId = (await groupedResponse.json() as { id: string }).id;
    const grouped = await (await request(0, `/recipes/meal-plans/${groupedId}`)).json() as PlanResult;
    assert.equal(grouped.importedPlan.choices['2026-11-24']['lunch/plate/group-0'], 'group-0-option-1');
    assert.equal((await request(0, `/recipes/plans/${groupedId}/day`, 'PUT', { ...choice, revision: 0, groupId: 'group-1', optionId: 'group-1-option-1' })).status, 200);
    const swapped = await (await request(0, `/recipes/meal-plans/${groupedId}`)).json() as PlanResult;
    assert.equal(swapped.importedPlan.choices[choice.date]['lunch/plate/group-1'], 'group-1-option-1');
    assert.equal(swapped.importedPlan.choices[choice.date]['lunch/plate/group-0'], 'group-0-option-0');
    assert.ok(!JSON.stringify(swapped).includes('NOME:'));
    // Older stored imports are interpreted without reimporting or losing explicit choices.
    await prisma.mealPlan.update({ where: { id: groupedId }, data: { importedPlan: JSON.parse(JSON.stringify({ meals: groupedBody.meals, choices: {} })) } });
    const legacy = await (await request(0, `/recipes/meal-plans/${groupedId}`)).json() as PlanResult;
    assert.equal(legacy.importedPlan.choices[choice.date]['lunch/plate/group-1'], 'group-1-option-0');
    assert.equal(await prisma.marketList.count({ where: { userId: users[0] } }), 1);
    assert.equal((await prisma.marketList.findUnique({ where: { id: original.id }, include: { items: true } }))?.items[0].productName, "Arroz");
  } finally {
    await prisma.mealPlan.deleteMany({ where: { userId: { in: users } } });
    await prisma.marketList.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  }
});
