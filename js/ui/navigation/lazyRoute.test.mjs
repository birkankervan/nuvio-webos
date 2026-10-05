import { test } from "node:test";
import assert from "node:assert/strict";
import { createLazyRoute } from "./lazyRoute.js";

test("lazy route imports once, including overlapping requests", async () => {
  let imports = 0;
  let resolve;
  const screen = { mount() {} };
  const route = createLazyRoute(() => {
    imports++;
    return new Promise((done) => { resolve = done; });
  }, "Screen");
  const first = route.load();
  const second = route.load();
  assert.equal(imports, 1);
  assert.equal(first, second);
  resolve({ Screen: screen });
  assert.equal(await first, screen);
  assert.equal(await route.load(), screen);
  assert.equal(imports, 1);
});

test("failed imports and invalid exports can be retried", async () => {
  let attempt = 0;
  const screen = { mount() {} };
  const route = createLazyRoute(async () => {
    attempt++;
    if (attempt === 1) throw new Error("offline");
    if (attempt === 2) return {};
    return { Screen: screen };
  }, "Screen");
  await assert.rejects(route.load(), /offline/);
  await assert.rejects(route.load(), /Invalid screen/);
  assert.equal(await route.load(), screen);
});
