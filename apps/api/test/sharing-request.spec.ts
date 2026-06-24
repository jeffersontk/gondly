import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListsService } from "../src/lists/lists.service";

describe("shared list access requests", () => {
  it("keeps link recipients pending until the owner approves them", async () => {
    let memberStatus = "none";
    const emittedEvents: string[] = [];
    const prisma = {
      listInvite: {
        findUnique: async () => ({
          id: "invite-1",
          listId: "list-1",
          inviteEmail: null,
          inviteToken: "share-token",
          role: "editor",
          status: "pending",
          expiresAt: new Date(Date.now() + 60_000),
          list: {
            id: "list-1",
            userId: "owner-1",
            name: "Compra do mês",
            description: null,
            deletedAt: null,
            user: { id: "owner-1", name: "Dono", photoUrl: null },
          },
        }),
      },
      listMember: {
        upsert: async () => {
          memberStatus = "invited";
          return {
            id: "member-1",
            listId: "list-1",
            userId: "guest-1",
            role: "editor",
            status: memberStatus,
            user: { id: "guest-1", name: "Visitante", email: "guest@example.com", photoUrl: null },
          };
        },
        findFirst: async () => ({ id: "member-1", listId: "list-1", userId: "guest-1", role: "editor", status: memberStatus }),
        update: async () => {
          memberStatus = "accepted";
          return {
            id: "member-1",
            listId: "list-1",
            userId: "guest-1",
            role: "editor",
            status: memberStatus,
            user: { id: "guest-1", name: "Visitante", email: "guest@example.com", photoUrl: null },
          };
        },
      },
      marketList: {
        findFirst: async () => ({
          id: "list-1",
          userId: "owner-1",
          items: [],
          members: [],
          invites: [],
        }),
      },
    };
    const realtime = {
      emitToList: (_listId: string, event: string) => emittedEvents.push(event),
    };
    const service = new ListsService(prisma as never, {} as never, realtime as never);

    const request = await service.requestAccess("guest-1", "share-token");
    assert.equal(request.status, "invited");
    assert.equal(memberStatus, "invited");

    const approved = await service.approveMember("owner-1", "list-1", "member-1");
    assert.equal(approved.status, "accepted");
    assert.equal(memberStatus, "accepted");
    assert.deepEqual(emittedEvents, ["accessRequested", "memberApproved"]);
  });
});
