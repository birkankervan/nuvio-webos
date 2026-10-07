import test from "node:test";
import assert from "node:assert/strict";
import { ZONE, createFocus, moveFocus, resolveFocusIndex } from "./iptvNavigation.js";

const ctx = { headerCount: 6, categoryCount: 5, channelCount: 10, columns: 4 };
const at = (zone, patch = {}) => createFocus({ zone, ...patch });

test("grid moves by logical index and crosses zones at the edges", () => {
  assert.equal(moveFocus(at(ZONE.GRID, { channel: 5 }), "right", ctx).focus.channel, 6);
  assert.equal(moveFocus(at(ZONE.GRID, { channel: 7 }), "right", ctx).focus.channel, 7, "row end stays");
  assert.equal(moveFocus(at(ZONE.GRID, { channel: 5 }), "down", ctx).focus.channel, 9);
  assert.equal(moveFocus(at(ZONE.GRID, { channel: 5 }), "up", ctx).focus.channel, 1);
  assert.equal(moveFocus(at(ZONE.GRID, { channel: 2 }), "up", ctx).focus.zone, ZONE.HEADER);
  assert.equal(moveFocus(at(ZONE.GRID, { channel: 4 }), "left", ctx).focus.zone, ZONE.CATEGORIES);
  assert.equal(moveFocus(at(ZONE.GRID, { channel: 4 }), "left", { ...ctx, categoryCount: 0 }).focus.zone, ZONE.SIDEBAR);
});

test("down from a full row onto a partial last row lands on the last item", () => {
  assert.equal(moveFocus(at(ZONE.GRID, { channel: 7 }), "down", ctx).focus.channel, 9);
  assert.equal(moveFocus(at(ZONE.GRID, { channel: 9 }), "down", ctx).focus.channel, 9);
});

test("categories hand off to the grid with a selection request", () => {
  const result = moveFocus(at(ZONE.CATEGORIES, { category: 2 }), "right", ctx);
  assert.equal(result.focus.zone, ZONE.GRID);
  assert.equal(result.selectCategory, true);
  assert.equal(moveFocus(at(ZONE.CATEGORIES, { category: 0 }), "up", ctx).focus.zone, ZONE.HEADER);
  assert.equal(moveFocus(at(ZONE.CATEGORIES, { category: 0 }), "left", ctx).focus.zone, ZONE.SIDEBAR);
});

test("header walks left/right then down; empty channel list falls back", () => {
  assert.equal(moveFocus(at(ZONE.HEADER, { header: 0 }), "left", ctx).focus.zone, ZONE.SIDEBAR);
  assert.equal(moveFocus(at(ZONE.HEADER, { header: 5 }), "right", ctx).focus.header, 5);
  assert.equal(moveFocus(at(ZONE.HEADER), "down", ctx).focus.zone, ZONE.CATEGORIES);
  const none = { ...ctx, categoryCount: 0, channelCount: 0 };
  assert.equal(moveFocus(at(ZONE.HEADER), "down", none).focus.zone, ZONE.HEADER);
});

test("resolveFocusIndex keeps identity across list changes and is nearest on removal", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(resolveFocusIndex(list, "b", 1), 1, "fast path, no scan");
  assert.equal(resolveFocusIndex(list, "c", 0), 2, "reordered: found by identity");
  assert.equal(resolveFocusIndex(list, "gone", 2), 2, "removed: stays near");
  assert.equal(resolveFocusIndex(list, "gone", 99), 2, "clamped");
  assert.equal(resolveFocusIndex([], "a", 3), 0);
});
