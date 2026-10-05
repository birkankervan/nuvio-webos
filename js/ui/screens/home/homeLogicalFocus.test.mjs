import { test } from "node:test";
import assert from "node:assert/strict";
import { moveHomeLogicalFocus, resolveHomeLogicalFocus } from "./homeLogicalFocus.js";

const item = id => ({ itemId: String(id), itemType: "movie" });
const row = (rowKey, count, kind = "catalog") => ({ rowKey, kind, items: Array.from({ length: count }, (_, index) => item(index)) });

test("logical focus survives reorder and removal, reaches distant items and does not mutate data", () => {
  const catalog = row("movies", 250);
  const state = resolveHomeLogicalFocus([catalog], { rowKey: "movies", itemIndex: 200 });
  assert.equal(state.itemIdentity.itemId, "200");
  const moved = moveHomeLogicalFocus([catalog], state, "right");
  assert.equal(moved.itemIndex, 201);
  assert.equal(state.itemIndex, 200);
  const reordered = { ...catalog, items: [...catalog.items].reverse() };
  const restored = resolveHomeLogicalFocus([reordered], state);
  assert.equal(restored.itemIndex, 49);
  assert.equal(restored.itemIdentity.itemId, "200");
  const removed = { ...catalog, items: catalog.items.slice(0, 3) };
  const clamped = resolveHomeLogicalFocus([removed], state);
  assert.equal(clamped.itemIndex, 2);
  assert.equal(clamped.itemIdentity.itemId, "2");
  assert.equal(catalog.items.length, 250);
});

test("vertical movement skips empty rows, restores per-row indices, clamps and returns boundaries", () => {
  const rows = [row("first", 10), row("empty", 0), row("short", 2), row("last", 5)];
  let focus = resolveHomeLogicalFocus(rows, { rowKey: "first", itemIndex: 8,
    preferredItemIndexByRowKey: { short: 200, gone: 300 } });
  assert.equal(Object.hasOwn(focus.preferredItemIndexByRowKey, "gone"), false);
  focus = moveHomeLogicalFocus(rows, focus, "down");
  assert.equal(focus.rowKey, "short");
  assert.equal(focus.itemIndex, 1);
  focus = moveHomeLogicalFocus(rows, focus, "down");
  assert.equal(focus.rowKey, "last");
  assert.equal(focus.itemIndex, 0);
  assert.equal(moveHomeLogicalFocus(rows, focus, "left").boundary, "left");
  assert.equal(moveHomeLogicalFocus(rows, focus, "down").boundary, "bottom");
  focus = moveHomeLogicalFocus(rows, moveHomeLogicalFocus(rows, focus, "up"), "up");
  assert.equal(focus.rowKey, "first");
  assert.equal(focus.itemIndex, 8);
  assert.equal(moveHomeLogicalFocus(rows, focus, "up").boundary, "top");
  focus = resolveHomeLogicalFocus(rows, { rowKey: "short", itemIndex: 1 });
  assert.equal(moveHomeLogicalFocus(rows, focus, "right").boundary, "right");
  assert.equal(resolveHomeLogicalFocus([], focus), null);
  assert.equal(resolveHomeLogicalFocus([], null), null);
  assert.equal(resolveHomeLogicalFocus(rows, null).rowKey, "first");
  assert.equal(resolveHomeLogicalFocus(rows, undefined).itemIndex, 0);
  assert.equal(moveHomeLogicalFocus(rows, null, "right").itemIndex, 1);
  assert.equal(resolveHomeLogicalFocus([row("empty", 0)], focus), null);
  assert.equal(resolveHomeLogicalFocus(rows, { rowKey: "empty" }).rowKey, "short");
  assert.equal(resolveHomeLogicalFocus(rows, { rowKey: "deleted", rowIndex: 3 }).rowKey, "last");
});

test("episode identity distinguishes CW entries, see-all is navigable, and classic hero rotates", () => {
  const cw = { rowKey: "continue_watching", kind: "continue", items: [
    { itemId: "series", itemType: "series", videoId: "series:1:1", season: "1", episode: "1" },
    { itemId: "series", itemType: "series", videoId: "series:1:2", season: "1", episode: "2" }
  ] };
  const focus = resolveHomeLogicalFocus([cw], { rowKey: cw.rowKey, itemIndex: 0, itemIdentity: cw.items[1] });
  assert.equal(focus.itemIndex, 1);
  assert.equal(resolveHomeLogicalFocus([{ ...cw, items: [...cw.items].reverse() }], focus).itemIndex, 0);
  const catalog = row("movies", 2);
  catalog.items.push({ itemId: "__see_all__:movies", itemType: "action" });
  assert.equal(moveHomeLogicalFocus([catalog], { rowKey: "movies", itemIndex: 1 }, "right").itemIdentity.itemType, "action");
  const hero = { rowKey: "__hero__", kind: "hero", items: [{ itemId: "__hero__", itemType: "action" }] };
  const rotation = moveHomeLogicalFocus([hero, catalog], {}, "left");
  assert.equal(rotation.action, "rotateHero");
  assert.equal(rotation.delta, -1);
  assert.equal(rotation.boundary, null);
  assert.equal(moveHomeLogicalFocus([hero, catalog], {}, "down").rowKey, "movies");
});
