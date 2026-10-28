import "reflect-metadata";
import assert from "node:assert/strict";
import { it } from "node:test";
import webpush from "web-push";
import { PushService } from "../src/push/push.service";
import { ListsService } from "../src/lists/lists.service";

it("pushes new chat messages only to the owner and accepted members other than the sender", async context => {
  const sent: Array<{ endpoint: string; data: any }> = [];
  context.mock.method(webpush, "sendNotification", async (subscription: { endpoint: string }, payload: string) => { sent.push({ endpoint: subscription.endpoint, data: JSON.parse(payload) }); });
  const keys = webpush.generateVAPIDKeys();
  const service = new PushService({
    marketList: { findFirst: async ({ where, select }: any) => {
      assert.equal(where.deletedAt, null);
      assert.equal(select.members.where.status, "accepted");
      return { userId: "owner", name: "Lista do mês", members: [{ userId: "sender" }, { userId: "guest" }] };
    } },
    pushSubscription: {
      findMany: async ({ where }: any) => ["owner", "sender", "guest", "removed"].filter(id => where.userId.in.includes(id)).map(id => ({ id, endpoint: `https://push/${id}`, p256dh: "p", auth: "a" })),
      update: async () => undefined,
    },
  } as never, { get: (name: string) => ({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey } as any)[name] } as never);
  service.onModuleInit(); service.onModuleDestroy();
  await service.notifyListMessage("list-1", "sender", "Maria", "message-1");
  assert.deepEqual(sent.map(value => value.endpoint), ["https://push/owner", "https://push/guest"]);
  assert.equal(sent[0].data.type, "chat");
  assert.equal(sent[0].data.url, "/app/lists/list-1?chat=1");
  assert.equal(sent[0].data.messageId, "message-1");
});

it("triggers chat push after saving and never fails sending a message because push is unavailable", async () => {
  let notified = 0;
  const service = new ListsService({
    marketList: { findFirst: async () => ({ id: "list-1" }) },
    listMessage: { create: async () => ({ id: "message-1", user: { name: "Maria" } }) },
  } as never, {} as never, { emitToList() {} } as never, {
    notifyListMessage: async () => { notified++; throw new Error("push unavailable"); },
  } as never);
  assert.equal((await service.addMessage("sender", "list-1", "Leite")).id, "message-1");
  assert.equal(notified, 1);
});
