import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
function worker({ offline = false } = {}) {
  const writes = [];
  const matches = [];
  const handlers = {};
  const context = vm.createContext({
    URL,
    Response,
    console,
    self: {
      location: { origin: "https://gondly.com.br" },
      addEventListener: (type, fn) => (handlers[type] = fn),
      skipWaiting() {},
      clients: { claim() {} },
    },
    caches: {
      open: async () => ({
        put: async (key) => writes.push(key),
        addAll: async () => {},
      }),
      match: async (key) => {
        matches.push(key);
        return undefined;
      },
    },
    fetch: async () => {
      if (offline) throw Error("offline");
      return new Response("<h1>page</h1>", {
        headers: { "content-type": "text/html" },
      });
    },
  });
  vm.runInContext(source, context);
  const navigate = async (path) => {
    let response;
    handlers.fetch({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://gondly.com.br" + path,
        headers: new Headers(),
      },
      respondWith: (p) => (response = p),
    });
    return await response;
  };
  return { navigate, writes, matches };
}
test("editorial cache uses the requested URL, never replaces home", async () => {
  const w = worker();
  await w.navigate("/guias/lista-de-compras");
  assert.deepEqual(w.writes, ["https://gondly.com.br/guias/lista-de-compras"]);
});
test("private HTML never enters navigation cache", async () => {
  const w = worker();
  await w.navigate("/app/home");
  assert.equal(w.writes.length, 0);
});
test("offline article does not fall back to home or another article", async () => {
  const w = worker({ offline: true });
  const r = await w.navigate("/blog/inexistente");
  assert.equal(r.status, 503);
  assert.ok(!w.matches.includes("/"));
});
