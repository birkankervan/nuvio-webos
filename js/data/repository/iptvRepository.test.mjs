import test from "node:test";
import assert from "node:assert/strict";

const data = new Map();
globalThis.localStorage = {
  getItem: (key) => (data.has(key) ? data.get(key) : null),
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: (key) => data.delete(key)
};
const { createIptvRepository, getMaxConnections } = await import("./iptvRepository.js");
const { IptvSourcesStore } = await import("../local/iptvSourcesStore.js");
const { IptvError } = await import("../remote/api/xtreamApi.js");

const credentials = { name: "A", server: "http://h.tv", username: "u", password: "p" };
const account = { status: "Active", expDate: null, maxConnections: 1, allowedFormats: ["ts"], timezone: "" };

function setup(overrides = {}) {
  data.clear();
  const log = { streams: [], categories: 0, signals: [] };
  const api = {
    authenticate: async () => account,
    getLiveCategories: async (_s, { signal } = {}) => {
      log.categories += 1;
      log.signals.push(signal);
      return [{ id: "1", name: "News", order: 0 }];
    },
    getLiveStreams: async (source, { categoryId } = {}) => {
      log.streams.push(categoryId ?? null);
      return [{ id: `${source.id}:1`, sourceId: source.id, streamId: "1", categoryId: "1", name: "A" }];
    },
    resolvePlaybackUrl: () => "mem://x",
    getVodCategories: async () => [{ id: "1", name: "V", order: 0 }],
    getVodStreams: async (_s, { categoryId } = {}) => {
      log.vod = (log.vod || 0) + 1;
      return [{ id: "1", categoryId: categoryId ?? "1" }];
    },
    getVodInfo: async (_s, id) => {
      log.info = (log.info || 0) + 1;
      return { name: `m${id}` };
    },
    getSeriesCategories: async () => [],
    getSeries: async () => [{ id: "2" }],
    getSeriesInfo: async () => ({ info: {}, seasons: [] }),
    resolveVodUrl: (source, kind, id, ext) => `mem://${source.id}/${kind}/${id}.${ext}`,
    ...overrides
  };
  return { repo: createIptvRepository({ store: IptvSourcesStore, api }), api, log };
}
const gate = () => {
  let release;
  const promise = new Promise((resolve) => (release = resolve));
  return { promise, release };
};

test("addSource authenticates first; failure leaves the store unchanged", async () => {
  const { repo } = setup({ authenticate: async () => { throw new IptvError("auth_failed"); } });
  await assert.rejects(repo.addSource(credentials, { profileId: "1" }), { code: "auth_failed" });
  assert.equal(repo.listSources("1").length, 0);
  await assert.rejects(repo.addSource({ ...credentials, server: "nope" }, { profileId: "1" }), { code: "bad_response" });
});

test("addSource success stores account; updateSource keeps id", async () => {
  const { repo } = setup();
  const source = await repo.addSource(credentials, { profileId: "1" });
  assert.deepEqual(source.lastAccount, account);
  assert.equal(getMaxConnections(source), 1);
  const updated = await repo.updateSource({ ...source, name: "B" }, { profileId: "1" });
  assert.equal(updated.id, source.id);
  assert.equal(repo.listSources("1").length, 1);
});

test("refresh builds catalog; getChannels filters by category", async () => {
  const { repo } = setup();
  const source = await repo.addSource(credentials, { profileId: "1" });
  const catalog = await repo.refreshCatalog(source.id, { profileId: "1" });
  assert.equal(catalog.mode, "full");
  assert.equal((await repo.getChannels(source.id, "1", { profileId: "1" })).length, 1);
  assert.deepEqual(await repo.getChannels(source.id, "9", { profileId: "1" }), []);
  assert.equal(repo.getCatalog(source.id, { profileId: "2" }), null);
});

test("failed refresh keeps the previous catalog", async () => {
  let fail = false;
  const { repo, api } = setup();
  const original = api.getLiveStreams;
  api.getLiveStreams = async (...args) => {
    if (fail) throw new IptvError("network");
    return original(...args);
  };
  const source = await repo.addSource(credentials, { profileId: "1" });
  const first = await repo.refreshCatalog(source.id, { profileId: "1" });
  fail = true;
  await assert.rejects(repo.refreshCatalog(source.id, { profileId: "1" }), { code: "network" });
  assert.equal(repo.getCatalog(source.id, { profileId: "1" }), first);
  await assert.rejects(repo.refreshCatalog("missing", { profileId: "1" }), { code: "not_found" });
});

test("concurrent unsignalled refreshes share one request; signalled run alone", async () => {
  const hold = gate();
  const { repo, log } = setup({
    getLiveCategories: async function () {
      log.categories += 1;
      await hold.promise;
      return [];
    }
  });
  const source = await repo.addSource(credentials, { profileId: "1" });
  const a = repo.refreshCatalog(source.id, { profileId: "1" });
  const b = repo.refreshCatalog(source.id, { profileId: "1" });
  const controller = new AbortController();
  const c = repo.refreshCatalog(source.id, { profileId: "1", signal: controller.signal });
  hold.release();
  await Promise.all([a, b, c]);
  assert.equal(log.categories, 2, "a+b shared, signalled c separate");
  assert.equal(a, b);
  // in-flight entry cleared after settle
  await repo.refreshCatalog(source.id, { profileId: "1" });
  assert.equal(log.categories, 3);
});

test("aborting a signalled refresh does not cancel the shared one", async () => {
  const hold = gate();
  const { repo } = setup({
    getLiveCategories: async (_s, { signal } = {}) => {
      await hold.promise;
      if (signal?.aborted) throw new IptvError("aborted");
      return [];
    }
  });
  const source = await repo.addSource(credentials, { profileId: "1" });
  const shared = repo.refreshCatalog(source.id, { profileId: "1" });
  const controller = new AbortController();
  const own = repo.refreshCatalog(source.id, { profileId: "1", signal: controller.signal });
  controller.abort();
  hold.release();
  await assert.rejects(own, { code: "aborted" });
  assert.equal((await shared).mode, "full");
});

test("stale commit blocked after invalidate, removal and profile clear", async () => {
  for (const kill of [(repo) => repo.invalidate(), (repo, id) => repo.removeSource(id, "1"), (repo) => repo.clearProfile("1")]) {
    const hold = gate();
    const { repo } = setup({
      getLiveCategories: async () => {
        await hold.promise;
        return [];
      }
    });
    const source = await repo.addSource(credentials, { profileId: "1" });
    const pending = repo.refreshCatalog(source.id, { profileId: "1" });
    kill(repo, source.id);
    hold.release();
    await assert.rejects(pending, { code: "aborted" });
    assert.equal(repo.getCatalog(source.id, { profileId: "1" }), null);
  }
});

test("removeSource drops cache, favorites and last channel", async () => {
  const { repo } = setup();
  const source = await repo.addSource(credentials, { profileId: "1" });
  await repo.refreshCatalog(source.id, { profileId: "1" });
  IptvSourcesStore.setFavorite(`${source.id}:1`, true, "1");
  IptvSourcesStore.setLastChannel(`${source.id}:1`, "1");
  repo.removeSource(source.id, "1");
  assert.equal(repo.getCatalog(source.id, { profileId: "1" }), null);
  assert.deepEqual(IptvSourcesStore.getFavorites("1"), []);
  assert.equal(IptvSourcesStore.getLastChannel("1"), null);
});

test("too_large falls back to lazy per-category loading", async () => {
  const { repo, log, api } = setup();
  const original = api.getLiveStreams;
  api.getLiveStreams = async (source, options = {}) => {
    if (options.categoryId == null) throw new IptvError("too_large");
    return original(source, options);
  };
  const source = await repo.addSource(credentials, { profileId: "1" });
  const catalog = await repo.refreshCatalog(source.id, { profileId: "1" });
  assert.equal(catalog.mode, "byCategory");
  assert.equal(catalog.channels, null);
  await assert.rejects(repo.getChannels(source.id, null, { profileId: "1" }), { code: "too_large" });
  const [a, b] = await Promise.all([
    repo.getChannels(source.id, "1", { profileId: "1" }),
    repo.getChannels(source.id, "1", { profileId: "1" })
  ]);
  assert.equal(a, b);
  await repo.getChannels(source.id, "1", { profileId: "1" });
  assert.deepEqual(log.streams.filter((id) => id === "1"), ["1"], "loaded once, then cached");
});

test("VOD/series: cached, deduped, invalidated; URL resolved in memory", async () => {
  const { repo, log } = setup();
  const source = await repo.addSource(credentials, { profileId: "1" });
  const o = { profileId: "1" };
  const [a, b] = await Promise.all([repo.getVodStreams(source.id, "3", o), repo.getVodStreams(source.id, "3", o)]);
  assert.equal(a, b);
  assert.equal(await repo.getVodStreams(source.id, "3", o), a);
  assert.equal(log.vod, 1);
  await repo.getVodStreams(source.id, null, o);
  await repo.getVodStreams(source.id, null, o);
  assert.equal(log.vod, 2);
  assert.equal((await repo.getVodInfo(source.id, "5", o)).name, "m5");
  // Cache hit must still be a promise (detail view chains .catch on it).
  assert.equal((await repo.getVodInfo(source.id, "5", o).catch(() => null)).name, "m5");
  assert.equal(log.info, 1);
  assert.equal((await repo.getVodCategories(source.id, o))[0].id, "1");
  assert.equal((await repo.getSeries(source.id, null, o))[0].id, "2");
  assert.deepEqual((await repo.getSeriesInfo(source.id, "9", o)).seasons, []);
  assert.equal(repo.resolveVodPlaybackUrl(source.id, "movie", "7", "mkv", "1"), `mem://${source.id}/movie/7.mkv`);
  assert.throws(() => repo.resolveVodPlaybackUrl("nope", "movie", "7", "mkv", "1"), { code: "not_found" });
  repo.invalidate();
  await repo.getVodStreams(source.id, "3", o);
  assert.equal(log.vod, 3);
});

test("VOD: removal invalidates and in-flight stale result is discarded", async () => {
  const g = gate();
  const { repo, log } = setup({ getVodStreams: async () => (await g.promise, [{ id: "1" }]) });
  const source = await repo.addSource(credentials, { profileId: "1" });
  const pending = repo.getVodStreams(source.id, "3", { profileId: "1" });
  repo.removeSource(source.id, "1");
  g.release();
  await assert.rejects(pending, { code: "aborted" });
  await assert.rejects(repo.getVodStreams(source.id, "3", { profileId: "1" }), { code: "not_found" });
  assert.equal(log.vod, undefined);
});

test("adult content hidden by default across live, VOD and series; showAdult exposes it", async () => {
  const cats = [{ id: "1", name: "News" }, { id: "9", name: "XXX" }];
  const items = [
    { id: "a", categoryId: "1", name: "BBC" },
    { id: "b", categoryId: "9", name: "Channel B" },
    { id: "c", categoryId: "1", name: "XXX: Tagged" }
  ];
  const { repo } = setup({
    getLiveCategories: async () => cats,
    getLiveStreams: async (_s, { categoryId } = {}) => (categoryId ? items.filter((i) => i.categoryId === categoryId) : items),
    getVodCategories: async () => cats,
    getVodStreams: async (_s, { categoryId } = {}) => (categoryId ? items.filter((i) => i.categoryId === categoryId) : items),
    getSeriesCategories: async () => cats,
    getSeries: async () => items
  });
  const source = await repo.addSource(credentials, { profileId: "1" });
  const o = { profileId: "1" };
  const names = (list) => list.map((i) => i.name || i.id);

  let catalog = await repo.refreshCatalog(source.id, o);
  assert.deepEqual(catalog.categories.map((c) => c.id), ["1"]);
  assert.deepEqual(names(await repo.getChannels(source.id, null, o)), ["BBC"]);
  assert.deepEqual(names(await repo.getChannels(source.id, "1", o)), ["BBC"]);
  assert.deepEqual(await repo.getChannels(source.id, "9", o), []);
  for (const [cat, list] of [["getVodCategories", "getVodStreams"], ["getSeriesCategories", "getSeries"]]) {
    assert.deepEqual((await repo[cat](source.id, o)).map((c) => c.id), ["1"]);
    assert.deepEqual(names(await repo[list](source.id, null, o)), ["BBC"]);
    assert.deepEqual(await repo[list](source.id, "9", o), []);
  }

  // Toggle on: no stale cache anywhere.
  await repo.updateSource({ id: source.id, ...credentials, showAdult: true }, o);
  assert.equal(repo.getSource(source.id, "1").showAdult, true);
  catalog = await repo.refreshCatalog(source.id, o);
  assert.equal(catalog.categories.length, 2);
  assert.equal((await repo.getChannels(source.id, null, o)).length, 3);
  assert.equal((await repo.getVodCategories(source.id, o)).length, 2);
  assert.equal((await repo.getVodStreams(source.id, null, o)).length, 3);

  // And back off.
  await repo.updateSource({ id: source.id, ...credentials, showAdult: false }, o);
  assert.deepEqual(names(await repo.getVodStreams(source.id, null, o)), ["BBC"]);
  catalog = await repo.refreshCatalog(source.id, o);
  assert.deepEqual(names(await repo.getChannels(source.id, null, o)), ["BBC"]);
});

test("store: showAdult defaults to false and normalizes to boolean", () => {
  data.clear();
  const base = { server: "http://h.tv", username: "u", password: "p" };
  assert.equal(IptvSourcesStore.upsert({ ...base }, "2").showAdult, false);
  assert.equal(IptvSourcesStore.upsert({ ...base, showAdult: "yes" }, "2").showAdult, false);
  assert.equal(IptvSourcesStore.upsert({ ...base, showAdult: true }, "2").showAdult, true);
});

test("live: orphan adult separator rows are hidden, similar titles stay", async () => {
  const items = [
    { id: "a", categoryId: "1", name: "Sex Education" },
    { id: "b", categoryId: "1", name: "▃ ▅ ▆ █ ADULTS CHANNELS █ ▆ ▅ ▃" }
  ];
  const { repo } = setup({ getLiveStreams: async () => items });
  const source = await repo.addSource(credentials, { profileId: "1" });
  await repo.refreshCatalog(source.id, { profileId: "1" });
  assert.deepEqual((await repo.getChannels(source.id, null, { profileId: "1" })).map((i) => i.id), ["a"]);
});
