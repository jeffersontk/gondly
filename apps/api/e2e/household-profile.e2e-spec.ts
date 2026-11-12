import "reflect-metadata";
import assert from "node:assert/strict";
import { it } from "node:test";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { defaultHouseholdMember } from "@gondly/utils";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/prisma/prisma.service";
it("private household profile saves, restores, validates and deletes only the signed-in user's data", async () => {
  const db = new URL(process.env.DATABASE_URL ?? "http://missing");
  assert.ok(["localhost", "127.0.0.1"].includes(db.hostname));
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  const prisma = app.get(PrismaService);
  const users: string[] = [];
  const tokens: string[] = [];
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/users/me/planning-profile`;
  const request = (index: number, method = "GET", body?: unknown) => fetch(base, { method, headers: { Authorization: `Bearer ${tokens[index]}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    for (let i = 0; i < 2; i++) {
      const user = await prisma.user.create({ data: { name: "Household fixture", email: `household-${randomUUID()}@example.invalid` } });
      users.push(user.id); tokens.push(app.get(JwtService).sign({ sub: user.id, email: user.email, name: user.name }));
    }
    assert.equal((await fetch(base)).status, 401);
    const profile = { version: 1, members: [defaultHouseholdMember()], periodDays: 7, dietType: "balanced", restrictions: [] };
    assert.equal((await request(0, "PUT", { ...profile, userId: users[1] })).status, 400);
    assert.equal((await request(0, "PUT", profile)).status, 200);
    const own = await request(0);
    assert.equal(own.headers.get("cache-control"), "no-store");
    assert.deepEqual(await own.json(), profile);
    const other = await request(1);
    assert.ok(["", "null"].includes(await other.text()));
    assert.equal((await request(0, "PUT", { ...profile, members: [{ ...profile.members[0], mealsPerWeek: { breakfast: 99 } }] })).status, 400);
    assert.equal((await request(0, "DELETE")).status, 200);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).planningProfile, null);
  } finally { await prisma.user.deleteMany({ where: { id: { in: users } } }); await app.close(); }
});
