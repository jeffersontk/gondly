import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "../src/billing/billing.service";

function createBillingService(hasNoAds = false) {
  let entitlementActive = hasNoAds;
  let upsertCalls = 0;

  const prisma = {
    userEntitlement: {
      findFirst: async () => (entitlementActive ? { id: "entitlement-1" } : null),
      findMany: async () => (entitlementActive ? [{ key: "no_ads", createdAt: new Date() }] : []),
      upsert: async () => {
        upsertCalls += 1;
        entitlementActive = true;
        return { id: "entitlement-1", userId: "user-1", key: "no_ads", active: true };
      },
      updateMany: async () => {
        entitlementActive = false;
        return { count: 1 };
      },
    },
    appConfig: {
      findUnique: async () => null,
    },
  };

  const config = {
    get: (key: string) => {
      if (key === "REMOVE_ADS_PRICE") return "19.90";
      if (key === "REMOVE_ADS_CURRENCY") return "BRL";
      return undefined;
    },
  };

  return {
    service: new BillingService(prisma as never, config as never),
    calls: () => ({ upsertCalls }),
  };
}

describe("monetization", () => {
  it("shows ads and exposes remove-ads offer before purchase", async () => {
    const { service } = createBillingService(false);

    const status = await service.getBillingStatus("user-1");

    assert.equal(status.adsEnabled, true);
    assert.equal(status.hasNoAds, false);
    assert.equal(status.availableOffers[0].type, "remove_ads");
    assert.equal(status.availableOffers[0].price, 19.9);
  });

  it("hides ads after no_ads entitlement and grant is idempotent", async () => {
    const { service, calls } = createBillingService(false);

    await service.grantNoAds("user-1", "one_time_purchase");
    await service.grantNoAds("user-1", "one_time_purchase");
    const status = await service.getBillingStatus("user-1");

    assert.equal(status.adsEnabled, false);
    assert.equal(status.hasNoAds, true);
    assert.deepEqual(status.entitlements, ["no_ads"]);
    assert.equal(calls().upsertCalls, 2);
  });

  it("keeps shared lists available in the free MVP", async () => {
    const { service } = createBillingService(false);

    assert.equal(await service.canCreateSharedList("user-1"), true);
    assert.equal(await service.canUseRealtimeCollaboration("user-1"), true);
  });
});
