import test from "node:test";
import assert from "node:assert/strict";
import { demoItems, demoTotal } from "../src/editorial/demo.mjs";
test("public demonstration calculates fractional quantities and rejects invalid values", () => {
  assert.equal(demoTotal(demoItems), 57);
  assert.equal(demoTotal([{ ...demoItems[0], quantity: 1.2, price: 8 }]), 9.6);
  assert.equal(demoTotal([{ ...demoItems[0], quantity: NaN }]), null);
  assert.equal(demoTotal([{ ...demoItems[0], price: -1 }]), null);
});
