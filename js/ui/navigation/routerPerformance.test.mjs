import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = {};
const { createRouterMethods02 } = await import("./routerMethods-02-complete-route-return-back-guard.js");

test("a late lazy screen cannot replace a newer navigation or clean up twice", async () => {
  let finishFirst;
  const mounts = [];
  let cleanups = 0;
  const router = {
    ...createRouterMethods02(), current: "home", currentParams: {}, stack: [],
    routes: {
      home: { cleanup() { cleanups++; } },
      first: { load: () => new Promise(resolve => { finishFirst = resolve; }) },
      second: { load: async () => ({ mount: async () => { mounts.push("second"); } }) }
    },
    beginRouteReturnBackGuard() {}, captureCurrentRouteState() {},
    resolveNavigationContext() { return {}; }, completeRouteReturnBackGuard() {},
    persistWebOsResumeRoute() {}
  };
  const first = router.navigate("first");
  await router.navigate("second");
  finishFirst({ mount: async () => { mounts.push("first"); } });
  await first;
  assert.equal(router.current, "second");
  assert.deepEqual(mounts, ["second"]);
  assert.equal(cleanups, 1);
  assert.equal(router.stack.length, 1);
});
