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

const local = /@(?:localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL ?? "");

it("V4/V5/V6: shared budget, private CSV access and reviewed recurring list on real local Postgres", { skip: !local }, async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const prisma = app.get(PrismaService);
  const ids: string[] = [];
  const tokens: string[] = [];
  const run = randomUUID();
  const request = (index: number, path: string, method = "GET", body?: unknown) => fetch(base + path, {
    method, headers: { Authorization: `Bearer ${tokens[index]}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    for (const name of ["owner", "editor", "viewer", "outsider"]) {
      const user = await prisma.user.create({ data: { name: `Planning test ${name}`, email: `planning-${name}-${run}@example.test` } });
      ids.push(user.id);
      tokens.push(app.get(JwtService).sign({ sub: user.id, email: user.email, name: user.name }));
    }
    const shared = await prisma.marketList.create({ data: { userId: ids[0], name: "Planning test shared", members: { createMany: { data: [{ userId: ids[1], role: "editor", status: "accepted" }, { userId: ids[2], role: "viewer", status: "accepted" }] } } } });
    const item = { productName: "Planning test rice", brand: "A", unit: "kg" as const, quantity: 1, pricePaid: 10 };
    const completedAt = new Date();
    const history = await prisma.purchase.create({ data: { userId: ids[0], sourceListId: shared.id, status: "completed", completedAt, subtotalCalculated: 10, finalPaidAmount: 9, discountAmount: 1, items: { create: item } } });
    const privateHistory = await prisma.purchase.create({ data: { userId: ids[0], status: "completed", completedAt, subtotalCalculated: 1, finalPaidAmount: 1, items: { create: { ...item, pricePaid: 1 } } } });
    const active = await prisma.purchase.create({ data: { userId: ids[0], sourceListId: shared.id, status: "in_progress", participants: { create: { userId: ids[0] } }, items: { create: { ...item, quantity: 2.5, pricePaid: 0 } } } });
    assert.equal((await request(0, `/purchases/${active.id}/budget`, "PUT", { budgetAmount: 50 })).status, 200);
    assert.equal((await request(2, `/purchases/${active.id}/budget`, "PUT", { budgetAmount: 100 })).status, 403);
    assert.equal((await request(1, `/purchases/${active.id}/budget`, "PUT", { budgetAmount: 60 })).status, 200);
    const budget = await (await request(2, `/purchases/${active.id}/budget`)).json() as { budgetAmount: number; estimatedRemaining: number; canEdit: boolean };
    assert.equal(budget.budgetAmount, 60);
    assert.equal(budget.estimatedRemaining, 25, "must use shared history, never the owner's private cheaper purchase");
    assert.equal(budget.canEdit, false);
    const csvResponse = await request(2, "/reports/history.csv");
    assert.equal(csvResponse.status, 200);
    assert.match(csvResponse.headers.get("content-type")!, /text\/csv/);
    const csv = await csvResponse.text();
    assert.ok(csv.includes(history.id));
    assert.ok(!csv.includes(privateHistory.id));
    assert.ok(csv.includes("quantity_unit"));
    assert.equal((await fetch(base + "/reports/history.csv")).status, 401);
    await prisma.listMember.updateMany({ where: { listId: shared.id, userId: ids[2] }, data: { status: "removed" } });
    assert.equal((await request(2, `/purchases/${active.id}/budget`)).status, 404);
    assert.ok(!(await (await request(2, "/reports/history.csv")).text()).includes(history.id), "revocation must remove access from a member who was never a participant");

    const nextList = await prisma.marketList.create({ data: { userId: ids[0], name: "Planning test next" } });
    const path = `/lists/${nextList.id}/replenishment`;
    const suggestions = await (await request(0, path + "/suggestions")).json() as { key: string }[];
    assert.equal(suggestions.length, 1);
    const selected = { key: suggestions[0].key };
    assert.equal((await request(0, path + "/accept", "POST", selected)).status, 201);
    await request(0, path + "/accept", "POST", selected);
    assert.equal(await prisma.marketListItem.count({ where: { listId: nextList.id } }), 1);
    assert.equal(await prisma.purchase.count({ where: { sourceListId: nextList.id } }), 0, "review must not start a purchase");
    const schedule = { enabled: true, intervalDays: 7, nextReminderAt: new Date(Date.now() + 7 * 86400_000).toISOString(), quietStart: 23, quietEnd: 7, timeZone: "America/Sao_Paulo" };
    assert.equal((await request(0, path, "PUT", schedule)).status, 200);
    assert.equal((await request(3, path)).status, 404);
    assert.equal((await request(0, path, "DELETE")).status, 200);
    assert.equal((await (await request(0, path)).json() as { enabled: boolean }).enabled, false);
  } finally {
    // Only disposable fixtures created in this local-only test are removed.
    try { if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } }); }
    finally { await app.close(); }
  }
});
