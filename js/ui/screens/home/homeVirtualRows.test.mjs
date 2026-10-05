import test from "node:test";
import assert from "node:assert/strict";
import { buildModernHomeVirtualRows as buildRows } from "./homeVirtualRows.js";
import { resolveHomeLogicalFocus } from "./homeLogicalFocus.js";
import { calculateHomeVirtualWindow } from "./homeVirtualWindow.js";

test("full 20x100 data model keeps logical focus outside render limits without DOM", () => {
  const sources = Array.from({ length: 20 }, (_, row) => ({ addonId: "addon", type: "movie", catalogId: `catalog${row}`,
    result: { status: "success", data: { items: Array.from({ length: 100 }, (_, index) => ({ id: `movie${index}` })) } } }));
  const rows = buildRows({ rows: sources, rowItemLimit: 15, continueWatchingRenderLimit: 1 });
  assert.equal(rows.reduce((sum, row) => sum + row.items.length, 0), 2000);
  assert.equal(rows[19].rowKey, "addon_movie_catalog19");
  assert.equal(rows[19].items[99].source, sources[19].result.data.items[99]);
  const focus = resolveHomeLogicalFocus(rows, { rowKey: rows[19].rowKey, itemIndex: 99 });
  const window = calculateHomeVirtualWindow({ count: rows[19].items.length, stride: 100,
    viewportExtent: 300, focusedIndex: focus.itemIndex });
  assert.equal(focus.itemIdentity.itemId, "movie99");
  assert.equal(window.renderedCount, 4);
  assert.equal(JSON.stringify(rows).includes('"dataset"'), false);
  assert.equal(JSON.stringify(rows).includes('"node"'), false);
  sources[0].result.data.items.push(...Array.from({ length: 200 }, (_, i) => ({ id: `extra${i}` })));
  const expanded = buildRows({ rows: sources });
  const distant = resolveHomeLogicalFocus(expanded, { rowKey: expanded[0].rowKey, itemIndex: 200 });
  assert.equal(distant.itemIndex, 200);
  assert.equal(calculateHomeVirtualWindow({ count: expanded[0].items.length, stride: 100,
    viewportExtent: 300, focusedIndex: distant.itemIndex }).renderedCount, 4);
});

test("CW episodes, split/upcoming global source indexes and stable collection actions", () => {
  const episodes = [1, 2].map(episode => ({ contentId: "same-series", contentType: "series", title: "Same title",
    videoId: `same-series:1:${episode}`, season: 1, episode }));
  const future = { ...episodes[1], videoId: "same-series:1:3", episode: 3, isNextUp: true, hasAired: false };
  const collection = { rowKind: "collection", homeCatalogKey: "collection:one", collectionId: "one",
    result: { status: "success", data: { items: [{ id: "folder1", title: "Folder" }] } } };
  const rows = buildRows({ continueWatchingItems: episodes, upcomingItems: [future], rows: [collection], continueWatchingCardStyle: "wide" });
  assert.deepEqual(rows.map(row => row.rowKey), ["continue_watching", "upcoming_section", "collection:one"]);
  assert.equal(rows[0].cardStyle, "wide");
  assert.equal(rows[1].items[0].sourceIndex, 2);
  assert.equal(rows[1].items[0].itemIndex, 0);
  assert.equal(rows[1].items[0].action, "resumeProgress");
  const identity = { itemId: "same-series", itemType: "series", videoId: "same-series:1:2", season: "1", episode: "2" };
  assert.equal(resolveHomeLogicalFocus(rows, { rowKey: "continue_watching", itemIndex: 0, itemIdentity: identity }).itemIndex, 1);
  assert.equal(rows[2].items[0].itemId, "collection:one:folder1");
  assert.equal(rows[2].items[0].action, "openCollectionFolder");
  assert.equal(rows[2].items[0].folderId, "folder1");
  assert.equal(rows[2].items.some(item => item.action === "openCatalogSeeAll"), false);
});

test("catalog placeholders remain outside navigation, CW loading has guarded action", () => {
  const loadingItems = Array.from({ length: 3 }, (_, i) => ({ id: `placeholder${i}`, isLoading: true }));
  const sources = [{ addonId: "a", type: "movie", catalogId: "loading", loadingItems, result: { status: "loading" } },
    { addonId: "a", type: "movie", catalogId: "ok", result: { status: "success", data: { items: [{ id: "ok" }] } } }];
  const rows = buildRows({ rows: sources });
  assert.equal(rows[0].items.length, 0);
  assert.equal(rows[0].loadingItems.length, 3);
  assert.equal(rows[0].loadingItems[2].itemIndex, 2);
  assert.equal(rows[0].loadingItems[2].action, null);
  assert.equal(resolveHomeLogicalFocus(rows, { rowKey: rows[0].rowKey }).rowKey, rows[1].rowKey);
  const cw = buildRows({ continueWatchingLoading: true, continueWatchingLoadingCount: 2 });
  assert.deepEqual(cw[0].items.map(item => item.itemId), ["__cw_loading__:continue_watching:0", "__cw_loading__:continue_watching:1"]);
  assert.ok(cw[0].items.every(item => item.source === null && item.action === "continueWatchingLoading" && item.isLoading));
  assert.equal(buildRows({ continueWatchingLoading: true, continueWatchingLoadingCount: Infinity })[0].items.length, 3);
});

test("source indexes survive absent/loading entries and homeCatalogKey wins", () => {
  const shared = { id: "same" };
  const row = { homeCatalogKey: "stable", addonId: "ignored", catalogId: "ignored",
    result: { data: { items: [shared, null, { id: "loading", isLoading: true }, shared] } } };
  const result = buildRows({ rows: [null, row] });
  assert.equal(result[0].rowKey, "stable");
  assert.equal(result[0].sourceRowIndex, 1);
  assert.deepEqual(result[0].items.map(item => item.itemIndex), [0, 3]);
  assert.equal(result[0].loadingItems[0].itemIndex, 2);
  assert.deepEqual(buildRows(), []);
});

test("invalid identities/folders cannot open routes; tv and channel metadata survive", () => {
  const model = buildRows({ rows: [
    { addonId: "a", type: "tv", catalogId: "channels", result: { data: { items: [
      { id: " ", type: "tv" }, { id: {}, type: "channel" },
      { id: "live", type: "tv" }, { id: "channel1", apiType: "channel" },
      { id: 123, type: "tv" }, { id: "folder", type: "collection_folder", title: "Missing collection" }
    ] } } },
    { rowKind: "collection", homeCatalogKey: "collection:bad", collectionId: "c", result: { data: { items: [
      { id: "f1", title: "" }, { title: "Missing folder" }, { id: {}, title: "Malformed id" },
      { folderId: "valid", rawTitle: "Valid hidden folder", hideTitle: true }
    ] } } }
  ], continueWatchingItems: [{ contentId: "" }, null, { contentId: {}, id: false }, { contentId: "valid" }] });
  assert.equal(model[0].items.length, 1);
  assert.equal(model[0].items[0].itemIndex, 3);
  assert.equal(model[0].items[0].action, "resumeProgress");
  assert.deepEqual(model[1].items.map(item => [item.itemId, item.itemType, item.itemIndex]),
    [["live", "tv", 2], ["channel1", "channel", 3], ["123", "tv", 4]]);
  assert.ok(model[1].items.every(item => item.action === "openDetail"));
  assert.deepEqual(model[2].items.map(item => [item.itemId, item.action, item.itemIndex]),
    [["collection:c:valid", "openCollectionFolder", 3]]);
  assert.equal(model[2].loadingItems.length, 0);
});
