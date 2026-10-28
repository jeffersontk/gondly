import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

test("chat push reaches the system outside the app, honors profile sound and avoids the active live chat", async () => {
  const handlers = {}, notifications = [];
  let preference, clients = [];
  vm.runInNewContext(await readFile(new URL("../public/push-events.js", import.meta.url), "utf8"), {
    URL, Response, Map,
    self: {
      location: { origin: "https://gondly.com.br" },
      addEventListener(type, callback) { handlers[type] = callback; },
      registration: { showNotification: async (title, options) => notifications.push({ title, options }) },
      clients: { matchAll: async () => clients, openWindow: async () => {} },
    },
    caches: { open: async () => ({ put: async (_, value) => { preference = value; }, match: async () => preference?.clone() }) },
  });
  const trigger = async (type, event) => { let pending; handlers[type]({ ...event, waitUntil: value => { pending = value; } }); await pending; };
  const data = { type: "chat", listId: "list-1", title: "Nova mensagem", body: "Maria enviou uma mensagem", tag: "chat-list-1", url: "/app/lists/list-1?chat=1" };
  await trigger("push", { data: { json: () => data } });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].options.silent, false);
  await trigger("message", { data: { type: "chat-sound-preference", enabled: false } });
  await trigger("push", { data: { json: () => data } });
  assert.equal(notifications[1].options.silent, true);
  clients = [{ id: "current", visibilityState: "visible" }];
  await trigger("message", { source: { id: "current" }, data: { type: "chat-view", listId: "list-1", connected: true } });
  await trigger("push", { data: { json: () => data } });
  assert.equal(notifications.length, 2, "active live chat already handles its in-app alert");
  clients[0].visibilityState = "hidden";
  await trigger("push", { data: { json: () => data } });
  assert.equal(notifications.length, 3, "a hidden app must receive the system notification");
});
