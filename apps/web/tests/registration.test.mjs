import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
const source = await readFile(
  new URL("../src/lib/register-sw.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source.replace("import.meta.env.PROD", "true"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function setup(readyState) {
  let registrations = 0;
  const handlers = {};
  const context = vm.createContext({
    exports: {},
    document: { readyState },
    navigator: {
      serviceWorker: {
        addEventListener() {},
        register() {
          registrations++;
          return Promise.resolve({ update: () => Promise.resolve() });
        },
      },
    },
    window: {
      addEventListener: (name, fn) => (handlers[name] = fn),
      location: { reload() {} },
    },
  });
  vm.runInContext(js, context);
  context.exports.registerServiceWorker();
  return { count: () => registrations, handlers };
}
test("worker registers even when the dynamic app loads after window load", () => {
  assert.equal(setup("complete").count(), 1);
});
test("worker registers once load fires if document is still loading", () => {
  const result = setup("loading");
  assert.equal(result.count(), 0);
  result.handlers.load();
  assert.equal(result.count(), 1);
});
test("production worker cache is tied to build assets", async () => {
  const sw = await readFile(new URL("../dist/sw.js", import.meta.url), "utf8");
  assert.match(sw, /gondly-cache-v5-[a-f0-9]{12}/);
});
