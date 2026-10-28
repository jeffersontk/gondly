import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("history screen and CSV use the same local calendar day, including late purchases", async () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Sao_Paulo";
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { localHistoryDate, historyPeriodBounds } = await server.ssrLoadModule("/src/pages/history/historyPeriod.ts");
    assert.equal(localHistoryDate("2026-10-28T01:30:00Z"), "2026-10-27");
    assert.deepEqual(historyPeriodBounds("2026-10-27", "2026-10-27"), { startDate: "2026-10-27T03:00:00.000Z", endDate: "2026-10-28T02:59:59.999Z" });
    assert.deepEqual(historyPeriodBounds("", ""), { startDate: "", endDate: "" });
  } finally { await server.close(); if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
