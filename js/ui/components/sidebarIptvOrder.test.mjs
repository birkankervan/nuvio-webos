import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { sidebarItems } = await import("./sidebarNavigationHelpers-01-root-sidebar-items.js");

test("IPTV sits directly above Library in both Discover placements", () => {
  assert.deepEqual(sidebarItems({ discoverLocation: "in_search" }).map((item) => item.route),
    ["home", "search", "iptv", "library", "settings"]);
  assert.deepEqual(sidebarItems({ discoverLocation: "in_sidebar" }).map((item) => item.route),
    ["home", "search", "discover", "iptv", "library", "settings"]);
});
