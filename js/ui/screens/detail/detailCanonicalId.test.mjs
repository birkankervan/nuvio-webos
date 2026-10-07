import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { createMetaDetailsScreenMethods03 } = await import("./metaDetailsScreenMethods-03-load-detail.js");
const internals = await import("./metaDetailsScreenContext.js");
const { TmdbService, TmdbMetadataService, TmdbSettingsStore } = internals;

function withStubs(stubs, fn) {
  const saved = [];
  for (const [obj, key, value] of stubs) {
    saved.push([obj, key, obj[key]]);
    obj[key] = value;
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [obj, key, value] of saved) obj[key] = value;
  });
}

test("canonical detail id uses external_ids only and never full enrichment", async () => {
  const ctx = createMetaDetailsScreenMethods03();
  let enrichmentCalls = 0;
  let seenSignal = null;
  await withStubs([
    [TmdbSettingsStore, "get", () => ({ enabled: true, language: "en" })],
    [TmdbService, "ensureTmdbId", async () => "603"],
    [TmdbService, "tmdbToImdb", async (id, type, options) => { seenSignal = options?.signal; return "tt0133093"; }],
    [TmdbMetadataService, "fetchEnrichment", async () => { enrichmentCalls++; return null; }]
  ], async () => {
    assert.equal(await ctx.resolveCanonicalDetailItemId("tmdb:603", "movie"), "tt0133093");
    assert.equal(enrichmentCalls, 0);
    assert.ok(seenSignal, "lookup is abortable");
    assert.equal(ctx._canonicalIdAbort, null);
  });
});

test("non-standard types fall back to movie like full enrichment", async () => {
  const ctx = createMetaDetailsScreenMethods03();
  const types = [];
  await withStubs([
    [TmdbSettingsStore, "get", () => ({ enabled: true })],
    [TmdbService, "ensureTmdbId", async () => "603"],
    [TmdbService, "tmdbToImdb", async (id, type) => { types.push(type); return "tt1"; }]
  ], async () => {
    for (const type of ["anime", "", "series", "Show", "movie"]) {
      await ctx.resolveCanonicalDetailItemId("tmdb:603", type);
    }
    assert.deepEqual(types, ["movie", "movie", "tv", "tv", "movie"]);
  });
});

test("disabled TMDB keeps the raw id without any lookup", async () => {
  const ctx = createMetaDetailsScreenMethods03();
  let lookups = 0;
  await withStubs([
    [TmdbSettingsStore, "get", () => ({ enabled: false })],
    [TmdbService, "ensureTmdbId", async () => { lookups++; return "603"; }],
    [TmdbService, "tmdbToImdb", async () => { lookups++; return "tt1"; }]
  ], async () => {
    assert.equal(await ctx.resolveCanonicalDetailItemId("tmdb:603", "movie"), "tmdb:603");
    assert.equal(await ctx.resolveCanonicalDetailItemId("tt42", "movie"), "tt42");
    assert.equal(lookups, 0);
  });
});

test("cleanup abort falls back to the raw id", async () => {
  const ctx = createMetaDetailsScreenMethods03();
  await withStubs([
    [TmdbSettingsStore, "get", () => ({ enabled: true })],
    [TmdbService, "ensureTmdbId", async () => "603"],
    [TmdbService, "tmdbToImdb", (id, type, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })]
  ], async () => {
    const pending = ctx.resolveCanonicalDetailItemId("tmdb:603", "movie");
    await new Promise(resolve => setImmediate(resolve));
    ctx.cancelCanonicalDetailIdRequest();
    assert.equal(await pending, "tmdb:603");
  });
});
