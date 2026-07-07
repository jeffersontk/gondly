import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SharedPriceRecordsService } from "../src/shared-price-records/shared-price-records.service";

function createService(reportsCount: number) {
  let upsertArg: unknown;
  let updateArg: unknown;
  const tx = {
    sharedPriceReport: {
      upsert: async (args: unknown) => {
        upsertArg = args;
      },
      count: async () => reportsCount,
    },
    sharedPriceRecord: {
      update: async (args: { data: { status: string; qualityReason: string; confidenceScore: number } }) => {
        updateArg = args;
        return {
          id: "record-1",
          status: args.data.status,
          qualityReason: args.data.qualityReason,
        };
      },
    },
  };
  const prisma = {
    sharedPriceRecord: {
      findFirst: async () => ({ id: "record-1" }),
    },
    $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx),
  };

  return {
    service: new SharedPriceRecordsService(prisma as never),
    getUpsertArg: () => upsertArg,
    getUpdateArg: () => updateArg,
  };
}

describe("SharedPriceRecordsService.report", () => {
  it("marks a reported shared price record as suspected without exposing reporter data", async () => {
    const { service, getUpsertArg, getUpdateArg } = createService(1);

    const result = await service.report("user-1", "record-1", {
      reason: "wrong_price",
      comment: "Valor fora do normal",
    });

    assert.deepEqual(result, {
      id: "record-1",
      status: "suspected",
      qualityReason: "reported_wrong_price",
      reportsCount: 1,
    });
    assert.equal("reporterUserId" in result, false);
    assert.deepEqual((getUpsertArg() as { create: unknown }).create, {
      sharedPriceRecordId: "record-1",
      reporterUserId: "user-1",
      reason: "wrong_price",
      comment: "Valor fora do normal",
    });
    assert.equal((getUpdateArg() as { data: { confidenceScore: number } }).data.confidenceScore, 0.25);
  });

  it("escalates a frequently reported record to user_reported", async () => {
    const { service, getUpdateArg } = createService(3);

    const result = await service.report("user-2", "record-1", {
      reason: "wrong_unit",
    });

    assert.equal(result.status, "user_reported");
    assert.equal(result.qualityReason, "multiple_reports");
    assert.equal((getUpdateArg() as { data: { confidenceScore: number } }).data.confidenceScore, 0);
  });
});
