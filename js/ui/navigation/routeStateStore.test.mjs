import { test } from "node:test";
import assert from "node:assert/strict";
import { RouteStateStore, MAX_ROUTE_STATE_ENTRIES } from "./routeStateStore.js";

test("route snapshots are bounded and recently used entries survive eviction", () => {
  RouteStateStore.clearAll();
  for (let i = 0; i < MAX_ROUTE_STATE_ENTRIES; i++) RouteStateStore.set(`detail:${i}`, { i });
  assert.deepEqual(RouteStateStore.get("detail:0"), { i: 0 });
  RouteStateStore.set("detail:new", { i: "new" });
  assert.equal(RouteStateStore.get("detail:1"), null);
  assert.deepEqual(RouteStateStore.get("detail:0"), { i: 0 });
  RouteStateStore.set("detail:0", { i: "updated" });
  RouteStateStore.set("detail:another", {});
  assert.deepEqual(RouteStateStore.get("detail:0"), { i: "updated" });
  RouteStateStore.clearByPrefix("detail:");
  assert.equal(RouteStateStore.get("detail:0"), null);
  RouteStateStore.set("home", {});
  RouteStateStore.set("home", null);
  assert.equal(RouteStateStore.get("home"), null);
});
