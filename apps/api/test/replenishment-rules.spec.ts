import assert from "node:assert/strict";
import { test } from "node:test";
import { isQuietHour, nextOccurrence, suggestionKey } from "../src/replenishment/rules";
test("quiet hours cross midnight and use configured timezone", () => {
 assert.equal(isQuietHour(new Date("2026-10-28T03:00:00Z"),23,7,"America/Sao_Paulo"), true);
 assert.equal(isQuietHour(new Date("2026-10-28T15:00:00Z"),23,7,"America/Sao_Paulo"), false);
});
test("overdue schedules advance beyond now without catchup flood", () => {
 assert.equal(nextOccurrence(new Date("2026-10-01T12:00:00Z"),7,new Date("2026-10-28T14:00:00Z")).toISOString(),"2026-10-29T12:00:00.000Z");
});
test("suggestion identity preserves unit while ignoring case", () => {
 assert.equal(suggestionKey({productName:"Arroz",unit:"un"}),suggestionKey({productName:" ARROZ ",unit:"un"}));
 assert.notEqual(suggestionKey({productName:"Arroz",unit:"kg"}),suggestionKey({productName:"Arroz",unit:"un"}));
});
