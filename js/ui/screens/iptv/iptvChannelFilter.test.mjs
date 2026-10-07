import test from "node:test";
import assert from "node:assert/strict";
import {
  VIEW_ALL,
  VIEW_FAVORITES,
  buildCategoryEntries,
  buildSearchIndex,
  createResultCache,
  pickFavorites,
  searchChannels
} from "./iptvChannelFilter.js";

const channels = [
  { id: "s:1", name: "TRT 1 HD", number: 1 },
  { id: "s:2", name: "Show TV", number: 12 },
  { id: "s:3", name: "BBC One", number: 120 }
];

test("search matches name case-insensitively and number prefixes", () => {
  const index = buildSearchIndex(channels);
  assert.deepEqual(searchChannels(index, " trt ").map((c) => c.id), ["s:1"]);
  assert.deepEqual(searchChannels(index, "12").map((c) => c.id), ["s:2", "s:3"]);
  assert.equal(searchChannels(index, ""), channels, "empty query returns the same array (no copy)");
  assert.deepEqual(searchChannels(index, "zzz"), []);
});

test("favorites projection keeps provider order", () => {
  assert.deepEqual(pickFavorites(channels, ["s:3", "s:1"]).map((c) => c.id), ["s:1", "s:3"]);
});

test("category entries put All and Favorites first; All is absent in per-category mode", () => {
  const categories = [{ id: "9", name: "News" }];
  const full = buildCategoryEntries({ categories, mode: "full" });
  assert.deepEqual(full.map((e) => e.key), [VIEW_ALL, VIEW_FAVORITES, "cat:9"]);
  const partial = buildCategoryEntries({ categories, mode: "byCategory" });
  assert.deepEqual(partial.map((e) => e.key), [VIEW_FAVORITES, "cat:9"]);
});

test("result cache keys by view, normalized query and version", () => {
  const cache = createResultCache(2);
  const list = [];
  cache.set("all", "Trt", 0, list);
  assert.equal(cache.get("all", " trt", 0), list);
  assert.equal(cache.get("all", "trt", 1), undefined);
  cache.set("a", "", 0, 1);
  cache.set("b", "", 0, 2);
  assert.equal(cache.get("all", "trt", 0), undefined, "bounded cache evicts oldest");
});
