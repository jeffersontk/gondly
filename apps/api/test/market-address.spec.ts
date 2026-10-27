import assert from "node:assert/strict";
import { it } from "node:test";
import { MarketsService } from "../src/markets/markets.service";

it("saves, reloads and clears a market address while partial updates preserve it", async () => {
  let record: Record<string, unknown> = { id: "market-1", createdByUserId: "owner", name: "Guanabara", address: "Rua antiga, 1", city: "Rio de Janeiro" };
  const service = new MarketsService({ market: {
    findFirst: async () => record,
    update: async ({ data }: { data: Record<string, unknown> }) => {
      for (const [key, value] of Object.entries(data)) if (value !== undefined) record[key] = value;
      return record;
    },
  } } as never);
  await service.update("owner", "market-1", { address: "  Rua nova, 123  " });
  assert.equal((await service.get("owner", "market-1")).address, "Rua nova, 123");
  await service.update("owner", "market-1", { name: "Guanabara atualizado" });
  assert.equal(record.address, "Rua nova, 123");
  await service.update("owner", "market-1", { address: "" });
  assert.equal(record.address, null, "clearing an optional field must remove the old value");
  assert.equal(record.city, "Rio de Janeiro");
});
