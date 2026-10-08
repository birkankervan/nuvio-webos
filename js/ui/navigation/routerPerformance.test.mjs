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

test("same-route replace (IPTV zap) keeps the history predecessor", async () => {
  const writes = [];
  window.history = {
    state: { route: "player", previousRoute: "iptv" },
    pushState: (s) => writes.push(["push", s]),
    replaceState: (s) => writes.push(["replace", s])
  };
  const router = {
    ...createRouterMethods02(), current: "player", currentParams: {}, stack: [], historyInitialized: true,
    routes: { player: { cleanup() {}, mount: async () => {} } },
    beginRouteReturnBackGuard() {}, captureCurrentRouteState() {},
    resolveNavigationContext() { return {}; }, completeRouteReturnBackGuard() {},
    persistWebOsResumeRoute() {}
  };
  await router.navigate("player", { a: 1 }, { replaceHistory: true });
  assert.equal(writes[0][0], "replace");
  assert.equal(writes[0][1].previousRoute, "iptv");
  delete window.history;
});

test("a keydown Back right after a popstate-consumed Back is a copy", async () => {
  const { createRouterMethods01 } = await import("./routerMethods-01-get-route-state-key.js");
  const router = { ...createRouterMethods01() };
  assert.equal(router.isPopstateBackCopy(), false);
  router.lastPopstateBackConsumedAt = Date.now();
  assert.equal(router.isPopstateBackCopy(), true);
  router.lastPopstateBackConsumedAt = Date.now() - 1000;
  assert.equal(router.isPopstateBackCopy(), false);
});
