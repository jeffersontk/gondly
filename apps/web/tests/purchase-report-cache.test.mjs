import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("purchase changes refresh active summary/history and returning home reloads persisted reports", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: false, retry: false } } });
  const subscriptions = [];
  try {
    const { invalidatePurchaseReports, configurePurchaseReportQueries } = await server.ssrLoadModule("/src/lib/purchaseReportCache.ts");
    let total = 22.95;
    client.setQueryData(["dashboard"], total);
    client.setQueryData(["purchases"], ["own"]);
    client.setQueryData(["market-summary", "guanabara"], 0);
    for (const [key, queryFn] of [["dashboard", async () => total], ["purchases", async () => total === 22.95 ? ["own"] : ["own", "shared"]]]) {
      const observer = new QueryObserver(client, { queryKey: [key], queryFn });
      subscriptions.push(observer.subscribe(() => {}));
    }
    const marketObserver = new QueryObserver(client, { queryKey: ["market-summary", "guanabara"], queryFn: async () => total === 22.95 ? 0 : 1060.81 });
    subscriptions.push(marketObserver.subscribe(() => {}));
    total = 1083.76;
    await invalidatePurchaseReports(client);
    assert.equal(client.getQueryData(["dashboard"]), 1083.76);
    assert.deepEqual(client.getQueryData(["purchases"]), ["own", "shared"]);
    assert.equal(client.getQueryData(["market-summary", "guanabara"]), 1060.81);
    subscriptions.splice(0).forEach(unsubscribe => unsubscribe());

    configurePurchaseReportQueries(client);
    for (const [queryKey, previous, next] of [[ ["dashboard"], 22.95, 1083.76 ], [ ["market-summary", "guanabara"], 0, 1060.81 ]]) {
      client.setQueryData(queryKey, previous);
      const returning = new QueryObserver(client, { queryKey, queryFn: async () => next });
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Returning to ${queryKey[0]} did not refresh the persisted report`)), 5000);
        const unsubscribe = returning.subscribe(result => {
          if (result.data === next && !result.isFetching) { clearTimeout(timeout); resolve(); }
        });
        subscriptions.push(() => { clearTimeout(timeout); unsubscribe(); });
      });
      assert.equal(client.getQueryData(queryKey), next);
    }
  } finally { subscriptions.forEach(unsubscribe => unsubscribe()); client.clear(); await server.close(); }
});
