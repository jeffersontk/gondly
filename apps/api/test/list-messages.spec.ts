import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { ListsService } from "../src/lists/lists.service";

describe("shared list messages", () => {
  it("recovers the latest 50 messages in chronological order in long conversations", async () => {
    const history = Array.from({ length: 60 }, (_, index) => ({ id: `message-${index + 1}`, createdAt: new Date(index * 1000) }));
    const service = new ListsService({
      marketList: { findFirst: async () => ({ id: "list-1" }) },
      listMessage: { findMany: async ({ orderBy, take }: { orderBy: { createdAt: string }; take: number }) =>
        [...history].sort((a, b) => (orderBy.createdAt === "desc" ? -1 : 1) * (a.createdAt.getTime() - b.createdAt.getTime())).slice(0, take) },
    } as never, {} as never, {} as never);
    const recovered = await service.listMessages("guest-1", "list-1");
    assert.equal(recovered.length, 50);
    assert.equal(recovered[0].id, "message-11");
    assert.equal(recovered[49].id, "message-60");
  });

  it("lets an accepted member send and read messages, and emits the realtime event", async () => {
    const createdMessages: Array<{ id: string; listId: string; userId: string; body: string; createdAt: Date }> = [];
    const emittedEvents: string[] = [];
    const prisma = {
      marketList: {
        findFirst: async ({ where }: { where: { id: string } }) =>
          where.id === "list-1" ? { id: "list-1" } : null,
      },
      listMessage: {
        findMany: async () =>
          createdMessages.map((message) => ({ ...message, user: { id: message.userId, name: "Visitante", photoUrl: null } })),
        create: async ({ data }: { data: { listId: string; userId: string; body: string } }) => {
          const message = { id: `message-${createdMessages.length + 1}`, ...data, createdAt: new Date() };
          createdMessages.push(message);
          return { ...message, user: { id: message.userId, name: "Visitante", photoUrl: null } };
        },
      },
    };
    const realtime = {
      emitToList: (_listId: string, event: string) => emittedEvents.push(event),
    };
    const service = new ListsService(prisma as never, {} as never, realtime as never);

    const created = await service.addMessage("guest-1", "list-1", "Oi, faltou leite na lista!");
    assert.equal(created.body, "Oi, faltou leite na lista!");
    assert.deepEqual(emittedEvents, ["listMessageCreated"]);

    const messages = await service.listMessages("guest-1", "list-1");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].body, "Oi, faltou leite na lista!");
  });

  it("rejects reading or sending messages for a list the user cannot access", async () => {
    const prisma = {
      marketList: { findFirst: async () => null },
      listMessage: { findMany: async () => [], create: async () => ({}) },
    };
    const realtime = { emitToList: () => undefined };
    const service = new ListsService(prisma as never, {} as never, realtime as never);

    await assert.rejects(() => service.listMessages("intruder-1", "list-1"), NotFoundException);
    await assert.rejects(() => service.addMessage("intruder-1", "list-1", "oi"), NotFoundException);
  });
});
