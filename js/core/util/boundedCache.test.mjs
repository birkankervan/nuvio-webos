import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.__NUVIO_ENV__ = { TMDB_API_KEY: "test-only" };
const { metaRepository } = await import("../../data/repository/metaRepository.js");
const { addonRepository } = await import("../../data/repository/addonRepository.js");
const { MetaApi } = await import("../../data/remote/api/metaApi.js");
const { TmdbService } = await import("../tmdb/tmdbService.js");
const { Platform } = await import("../../platform/index.js");
const { entityHeaderCache, entityRailCache, entityBrowseCache, moreLikeThisCache } =
  await import("../tmdb/tmdbMetadataServiceHelpers-01-tmdb-base-url.js");

test("metadata caches stay bounded, retain hot results, and keep shared pending lookups", async () => {
  const originalGetMeta = MetaApi.getMeta;
  const originalAddons = addonRepository.getInstalledAddons;
  const originalFetch = globalThis.fetch;
  const originalIsWebOs = Platform.isWebOS;
  let metaRequests = 0;
  let tmdbRequests = 0;
  let finishMeta;
  let finishTmdb;
  const caches = [entityHeaderCache, entityRailCache, entityBrowseCache, moreLikeThisCache];
  try {
    metaRepository.clearCache();
    TmdbService.clearCache();
    addonRepository.getInstalledAddons = async () => [];
    MetaApi.getMeta = async url => {
      metaRequests++;
      if (url.includes("pending.json")) await new Promise(resolve => { finishMeta = resolve; });
      const id = decodeURIComponent(url.split("/").pop().replace(/\.json$/, ""));
      return { meta: { id, type: "movie", name: id } };
    };
    const getMeta = id => metaRepository.getMeta("https://cache-test.invalid", "movie", id);
    for (let id = 0; id < 120; id++) await getMeta(`item-${id}`);
    assert.equal(metaRepository.getCachedMeta("movie", "item-0").id, "item-0",
      "suffix lookup should promote recently used metadata before eviction");
    await getMeta("item-120");
    assert.equal(metaRepository.metaCache.size, 120);
    assert.equal(metaRepository.getCachedMeta("movie", "item-1"), null);
    const beforeHotMeta = metaRequests;
    await getMeta("item-0");
    assert.equal(metaRequests, beforeHotMeta, "recent metadata should be reused");
    await getMeta("item-1");
    assert.equal(metaRequests, beforeHotMeta + 1, "eviction is a safe cache miss");
    const pendingMeta = [getMeta("pending"), getMeta("pending")];
    while (!finishMeta) await Promise.resolve();
    const beforeMetaResolve = metaRequests;
    assert.equal(metaRepository.inFlightMeta.size, 1);
    finishMeta();
    const metaResults = await Promise.all(pendingMeta);
    assert.equal(metaRequests, beforeMetaResolve, "same metadata request is shared");
    assert.equal(metaResults[0].data, metaResults[1].data);
    assert.equal(metaRepository.inFlightMeta.size, 0);

    Platform.isWebOS = () => false;
    globalThis.fetch = async url => {
      tmdbRequests++;
      const id = Number(String(url).match(/\/(?:movie|tv)\/(\d+)\/external_ids/)?.[1]);
      assert.ok(id);
      if (id === 999) await new Promise(resolve => { finishTmdb = resolve; });
      return { ok: true, json: async () => ({ imdb_id: `tt${100000 + id}` }) };
    };
    for (let id = 1; id <= 120; id++) await TmdbService.tmdbToImdb(String(id));
    await TmdbService.tmdbToImdb("1");
    await TmdbService.tmdbToImdb("121");
    const beforeHotTmdb = tmdbRequests;
    assert.equal(await TmdbService.tmdbToImdb("1"), "tt100001");
    assert.equal(tmdbRequests, beforeHotTmdb);
    assert.equal(await TmdbService.tmdbToImdb("2"), "tt100002");
    assert.equal(tmdbRequests, beforeHotTmdb + 1);
    assert.equal(await TmdbService.ensureTmdbId("tt100002"), "2", "reverse conversion result is reused");
    const pendingTmdb = [TmdbService.tmdbToImdb("999"), TmdbService.tmdbToImdb("999")];
    while (!finishTmdb) await Promise.resolve();
    const beforeTmdbResolve = tmdbRequests;
    finishTmdb();
    assert.deepEqual(await Promise.all(pendingTmdb), ["tt100999", "tt100999"]);
    assert.equal(tmdbRequests, beforeTmdbResolve);

    for (const cache of caches) {
      cache.clear();
      for (let id = 0; id < cache.maxEntries; id++) cache.set(id, { id });
      const hot = cache.get(0);
      cache.set(cache.maxEntries, { id: cache.maxEntries });
      assert.equal(cache.size, cache.maxEntries);
      assert.equal(cache.get(0), hot);
      assert.equal(cache.has(1), false);
      assert.equal([...cache.entries()].length, cache.maxEntries, "normal iteration remains finite");
    }
  } finally {
    MetaApi.getMeta = originalGetMeta;
    addonRepository.getInstalledAddons = originalAddons;
    globalThis.fetch = originalFetch;
    Platform.isWebOS = originalIsWebOs;
    metaRepository.clearCache();
    TmdbService.clearCache();
    caches.forEach(cache => cache.clear());
  }
});
