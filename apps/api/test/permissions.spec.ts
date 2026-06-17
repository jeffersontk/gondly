import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { SharedRole } from "@prisma/client";
import { ListsService } from "../src/lists/lists.service";

describe("list permissions", () => {
  it("does not allow editors to manage invites", async () => {
    const prisma = {
      marketList: {
        findFirst: async () => ({
          id: "list-1",
          userId: "owner-1",
          items: [],
          members: [{ userId: "editor-1", role: SharedRole.editor, status: "accepted" }],
          invites: [],
        }),
      },
    };
    const service = new ListsService(prisma as never, {} as never, { emitToList: () => undefined } as never);

    await assert.rejects(
      () => service.invite("editor-1", "list-1", { role: SharedRole.viewer }),
      ForbiddenException,
    );
  });
});
