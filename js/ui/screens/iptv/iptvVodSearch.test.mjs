import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchIndex, searchChannels } from "./iptvChannelFilter.js";

test("24k VOD fixture: index build and search stay interactive", () => {
  const words = ["Matrix", "Inception", "Avatar", "Godfather", "Alien", "Titanic", "Gladiator", "Fargo"];
  const items = Array.from({ length: 24000 }, (_, i) => ({
    id: String(i),
    name: `${words[i % words.length]} ${i} (${1980 + (i % 45)})`,
    categoryId: String(i % 61)
  }));
  let t0 = performance.now();
  const index = buildSearchIndex(items);
  const buildMs = performance.now() - t0;
  t0 = performance.now();
  const hits = searchChannels(index, "gladi");
  const searchMs = performance.now() - t0;
  assert.equal(hits.length, 3000);
  assert.equal(searchChannels(index, "").length, 24000);
  // Mac numbers are ~10x faster than the TV; bounds leave generous headroom.
  assert.ok(buildMs < 150, `build ${buildMs}ms`);
  assert.ok(searchMs < 50, `search ${searchMs}ms`);
  console.log(`index ${buildMs.toFixed(1)}ms search ${searchMs.toFixed(1)}ms`);
});
