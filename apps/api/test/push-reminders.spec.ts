import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import webpush from "web-push";
import { PushController } from "../src/push/push.controller";
import { PushService } from "../src/push/push.service";

const vapid = webpush.generateVAPIDKeys();
const originalSend = webpush.sendNotification;
// 15:00 UTC = 12:00 in São Paulo, outside quiet hours.
const NOON = new Date("2026-10-15T15:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOON.getTime() - minutes * 60_000);

function config(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

function setup(purchases: Array<Record<string, unknown>>, subscriptions: Array<Record<string, unknown>>) {
  const reserved: Array<{ id: string; stage: number }> = [];
  const deleted: string[] = [];
  const prisma = {
    purchase: {
      findMany: async () => purchases,
      updateMany: async ({ where, data }: { where: { id: string }; data: { finishRemindersSent: number } }) => {
        reserved.push({ id: where.id, stage: data.finishRemindersSent });
        return { count: 1 };
      },
    },
    pushSubscription: {
      findMany: async ({ where }: { where: { userId: { in: string[] } } }) => subscriptions.filter((entry) => where.userId.in.includes(entry.userId as string)),
      update: async () => undefined,
      delete: async ({ where }: { where: { id: string } }) => {
        deleted.push(where.id);
      },
    },
  };
  const service = new PushService(prisma as never, config({ VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey }) as never);
  service.onModuleInit();
  service.onModuleDestroy();
  return { service, reserved, deleted };
}

function openPurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: "purchase-1",
    userId: "owner-1",
    lastCartActivityAt: minutesAgo(65),
    finishRemindersSent: 0,
    subtotalCalculated: 42.5,
    sourceList: { name: "Compra do mês" },
    participants: [{ userId: "owner-1" }, { userId: "guest-1" }],
    items: [{ id: "item-1" }, { id: "item-2" }],
    ...overrides,
  };
}

describe("finish-purchase push reminders", () => {
  afterEach(() => {
    webpush.sendNotification = originalSend;
  });

  it("sends the 1h reminder to every participant and drops revoked subscriptions", async () => {
    const payloads: Array<{ endpoint: string; body: { title: string; url: string } }> = [];
    webpush.sendNotification = (async (subscription: { endpoint: string }, body: string) => {
      if (subscription.endpoint === "https://push/revoked") throw Object.assign(new Error("gone"), { statusCode: 410 });
      payloads.push({ endpoint: subscription.endpoint, body: JSON.parse(body) });
    }) as unknown as typeof webpush.sendNotification;
    const { service, reserved, deleted } = setup([openPurchase()], [
      { id: "sub-owner", userId: "owner-1", endpoint: "https://push/owner", p256dh: "p", auth: "a" },
      { id: "sub-guest", userId: "guest-1", endpoint: "https://push/guest", p256dh: "p", auth: "a" },
      { id: "sub-old", userId: "guest-1", endpoint: "https://push/revoked", p256dh: "p", auth: "a" },
    ]);

    const result = await service.runFinishReminders(NOON);

    assert.deepEqual(reserved, [{ id: "purchase-1", stage: 1 }]);
    assert.deepEqual(payloads.map((entry) => entry.endpoint).sort(), ["https://push/guest", "https://push/owner"]);
    assert.equal(payloads[0].body.url, "/app/purchase/purchase-1/finish");
    assert.deepEqual(deleted, ["sub-old"]);
    assert.deepEqual(result, { checked: 1, reminded: 1, sent: 2 });
  });

  it("jumps to the 2h reminder when the 1h one was missed", async () => {
    webpush.sendNotification = (async () => undefined) as unknown as typeof webpush.sendNotification;
    const { service, reserved } = setup([openPurchase({ lastCartActivityAt: minutesAgo(130) })], []);

    await service.runFinishReminders(NOON);

    assert.deepEqual(reserved, [{ id: "purchase-1", stage: 2 }]);
  });

  it("silently closes the reminders of a purchase abandoned for more than 12h", async () => {
    let sends = 0;
    webpush.sendNotification = (async () => {
      sends += 1;
    }) as unknown as typeof webpush.sendNotification;
    const { service, reserved } = setup([openPurchase({ lastCartActivityAt: minutesAgo(13 * 60) })], [
      { id: "sub-owner", userId: "owner-1", endpoint: "https://push/owner", p256dh: "p", auth: "a" },
    ]);

    await service.runFinishReminders(NOON);

    assert.deepEqual(reserved, [{ id: "purchase-1", stage: 2 }]);
    assert.equal(sends, 0);
  });

  it("does not send during quiet hours", async () => {
    const { service, reserved } = setup([openPurchase()], []);
    // 03:00 UTC = 00:00 in São Paulo.
    const result = await service.runFinishReminders(new Date("2026-10-15T03:00:00.000Z"));

    assert.deepEqual(reserved, []);
    assert.deepEqual(result, { checked: 0, reminded: 0, sent: 0 });
  });

  it("rejects scheduler calls without the right secret", () => {
    const controller = new PushController({ runFinishReminders: async () => ({}) } as never, config({ CRON_SECRET: "s3cret" }) as never);

    assert.throws(() => controller.runReminders("wrong"), ForbiddenException);
    assert.throws(() => controller.runReminders(undefined), ForbiddenException);
    assert.doesNotThrow(() => controller.runReminders("s3cret"));
  });
});
