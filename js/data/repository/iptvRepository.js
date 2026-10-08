import { BoundedCache } from "../../core/util/boundedCache.js";
import { IptvSourcesStore, normalizeIptvServer } from "../local/iptvSourcesStore.js";
import { IptvError, XtreamApi } from "../remote/api/xtreamApi.js";
import { registerSessionTeardownHandler } from "../../core/auth/sessionLifecycle.js";
import { isAdultCategoryName, isAdultItemName } from "./iptvAdultFilter.js";

const MAX_CACHED_CATALOGS = 8;
const MAX_CACHED_CATEGORIES = 32;
const MAX_CACHED_FULL_LISTS = 2; // 7 MB-class lists: memory only, never persisted.
const MAX_CACHED_INFO = 32;

// Single-connection contract (IPTV-04 player integration): when
// getMaxConnections(source) === 1, the previous native session and its fetch
// must be fully closed BEFORE a new playback URL is opened; switching channels
// otherwise fails at the provider. Never open the next stream first.
export function getMaxConnections(source) {
  return source?.lastAccount?.maxConnections || 1;
}

function groupByCategory(channels) {
  const map = new Map();
  for (const channel of channels) {
    const list = map.get(channel.categoryId);
    if (list) list.push(channel);
    else map.set(channel.categoryId, [channel]);
  }
  return map;
}

// Adult content is hidden unless the source opts in (source.showAdult === true).
const hidesAdult = (source) => source?.showAdult !== true;
const adultIdSet = (categories) => new Set(categories.filter((c) => isAdultCategoryName(c.name)).map((c) => String(c.id)));
const keepItems = (items, hiddenIds) =>
  items.filter((item) => !hiddenIds.has(String(item.categoryId)) && !isAdultItemName(item.name));
// Live only: decorated separator rows ("█ ADULTS CHANNELS █", name starts with a symbol)
// are category labels, so test them as such; plain titles like "Sex Education" stay.
const keepLive = (items, hiddenIds) =>
  keepItems(items, hiddenIds).filter((item) => /^[\p{L}\p{N}]/u.test(item.name) || !isAdultCategoryName(item.name));

export function createIptvRepository({ store = IptvSourcesStore, api = XtreamApi } = {}) {
  const catalogs = new BoundedCache(MAX_CACHED_CATALOGS);
  const vod = new BoundedCache(MAX_CACHED_CATEGORIES + MAX_CACHED_INFO); // categories, per-category lists, info
  const fullLists = new BoundedCache(MAX_CACHED_FULL_LISTS);
  const inFlight = new Map();
  let generation = 0;

  const keyOf = (profileId, sourceId) => `${profileId ?? ""}|${sourceId}`;

  function invalidate() {
    generation += 1;
    catalogs.clear();
    vod.clear();
    fullLists.clear();
    inFlight.clear();
  }

  // ponytail: any removal drops all cached catalogs; they are cheap to rebuild.
  store.onRemoval?.(invalidate);

  function requireSource(sourceId, profileId) {
    const source = store.get(sourceId, profileId);
    if (!source) throw new IptvError("not_found");
    return source;
  }

  // Unsignalled callers share one request; a caller-owned signal must not
  // cancel work other consumers wait on, so signalled calls run alone.
  function shared(key, signal, run) {
    if (!signal && inFlight.has(key)) return inFlight.get(key);
    const request = run();
    if (signal) return request;
    inFlight.set(key, request);
    const clear = () => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    };
    request.then(clear, clear);
    return request;
  }

  function assertFresh(token) {
    if (token !== generation) throw new IptvError("aborted");
  }

  async function saveSource(input, { signal, profileId } = {}) {
    const server = normalizeIptvServer(input?.server);
    const username = String(input?.username ?? "").trim();
    const password = String(input?.password ?? "");
    if (!server || !username || !password) throw new IptvError("bad_response");
    const candidate = { server, username, password };
    const token = generation;
    const account = await api.authenticate(candidate, { signal });
    assertFresh(token);
    // Auth succeeded: only now touch the store. A failure above leaves it unchanged.
    const source = store.upsert(
      { ...input, ...candidate, kind: "xtream", lastAccount: account },
      profileId
    );
    catalogs.delete(keyOf(profileId, source.id));
    return source;
  }

  function refreshCatalog(sourceId, { signal, profileId } = {}) {
    const key = keyOf(profileId, sourceId);
    return shared(key, signal, async () => {
      const source = requireSource(sourceId, profileId);
      const token = generation;
      let categories = await api.getLiveCategories(source, { signal });
      let channels = null;
      try {
        channels = await api.getLiveStreams(source, { signal });
      } catch (error) {
        if (error?.code !== "too_large") throw error;
      }
      assertFresh(token);
      // Filtered at build time; a source update (toggle) drops the catalog, so it is never stale.
      const hideAdult = hidesAdult(source);
      const hiddenIds = hideAdult ? adultIdSet(categories) : new Set();
      if (hideAdult) {
        categories = categories.filter((c) => !hiddenIds.has(String(c.id)));
        if (channels) channels = keepLive(channels, hiddenIds);
      }
      const catalog = {
        sourceId,
        mode: channels ? "full" : "byCategory",
        categories,
        hiddenIds,
        hideAdult,
        channels,
        channelsByCategory: channels ? groupByCategory(channels) : new BoundedCache(MAX_CACHED_CATEGORIES),
        fetchedAt: Date.now()
      };
      catalogs.set(key, catalog); // atomic swap; any earlier throw kept the old catalog.
      return catalog;
    });
  }

  function getCatalog(sourceId, { profileId } = {}) {
    return catalogs.get(keyOf(profileId, sourceId)) || null;
  }

  // categoryId omitted returns every channel (full mode only).
  async function getChannels(sourceId, categoryId, { signal, profileId } = {}) {
    const key = keyOf(profileId, sourceId);
    const catalog = catalogs.get(key);
    if (!catalog) throw new IptvError("not_found");
    if (catalog.mode === "full") {
      return categoryId == null ? catalog.channels : catalog.channelsByCategory.get(String(categoryId)) || [];
    }
    if (categoryId == null) throw new IptvError("too_large");
    if (catalog.hiddenIds.has(String(categoryId))) return [];
    const cached = catalog.channelsByCategory.get(String(categoryId));
    if (cached) return cached;
    return shared(`${key}|${categoryId}`, signal, async () => {
      const source = requireSource(sourceId, profileId);
      const token = generation;
      let channels = await api.getLiveStreams(source, { categoryId, signal });
      assertFresh(token);
      if (catalog.hideAdult) channels = keepLive(channels, catalog.hiddenIds);
      catalog.channelsByCategory.set(String(categoryId), channels);
      return channels;
    });
  }

  // Cache-or-load for VOD/series data; stale results (invalidate mid-flight) are not stored.
  function cached(cache, key, { signal }, load) {
    const hit = cache.get(key);
    if (hit) return Promise.resolve(hit); // always a promise: callers chain .catch
    return shared(key, signal, async () => {
      const token = generation;
      const value = await load();
      assertFresh(token);
      cache.set(key, value);
      return value;
    });
  }

  // kind: "vod" | "series"; categoryId null loads the full list (memory only).
  // Raw lists stay cached; adult filtering is applied on read (memoized per raw array)
  // so toggling showAdult needs no cache invalidation.
  function vodAccessors(kind, listName, listApi) {
    const rawCats = (sourceId, opts) => {
      const key = `${keyOf(opts.profileId, sourceId)}|${kind}|cats`;
      return cached(vod, key, opts, () => api[kind === "vod" ? "getVodCategories" : "getSeriesCategories"](requireSource(sourceId, opts.profileId), { signal: opts.signal }));
    };
    const memo = new WeakMap();
    const filtered = (raw, build) => {
      let value = memo.get(raw);
      if (!value) memo.set(raw, (value = build()));
      return value;
    };
    return {
      async categories(sourceId, opts = {}) {
        const raw = await rawCats(sourceId, opts);
        if (!hidesAdult(requireSource(sourceId, opts.profileId))) return raw;
        return filtered(raw, () => raw.filter((c) => !isAdultCategoryName(c.name)));
      },
      async list(sourceId, categoryId, opts = {}) {
        const all = categoryId == null;
        const key = `${keyOf(opts.profileId, sourceId)}|${kind}|${all ? "all" : categoryId}`;
        const hide = hidesAdult(requireSource(sourceId, opts.profileId));
        const hiddenIds = hide ? adultIdSet(await rawCats(sourceId, opts)) : null;
        if (hiddenIds && !all && hiddenIds.has(String(categoryId))) return [];
        const raw = await cached(all ? fullLists : vod, key, opts, () => api[listName](requireSource(sourceId, opts.profileId), { categoryId: all ? undefined : categoryId, signal: opts.signal }));
        return hide ? filtered(raw, () => keepItems(raw, hiddenIds)) : raw;
      },
      info(sourceId, id, opts = {}) {
        const key = `${keyOf(opts.profileId, sourceId)}|${kind}|info|${id}`;
        return cached(vod, key, opts, () => api[listApi](requireSource(sourceId, opts.profileId), id, { signal: opts.signal }));
      }
    };
  }
  const movies = vodAccessors("vod", "getVodStreams", "getVodInfo");
  const shows = vodAccessors("series", "getSeries", "getSeriesInfo");

  return {
    listSources: (profileId) => store.list(profileId),
    getSource: (sourceId, profileId) => store.get(sourceId, profileId),
    addSource: saveSource,
    updateSource: saveSource,
    removeSource: (sourceId, profileId) => store.remove(sourceId, profileId),
    clearProfile: (profileId) => store.clearProfile(profileId),
    refreshCatalog,
    getCatalog,
    getChannels,
    resolvePlaybackUrl: (source, channel, allowedFormats) =>
      api.resolvePlaybackUrl(source, channel, allowedFormats),
    /** Route params carry ids only; the URL with credentials exists in memory only. */
    resolveChannelPlaybackUrl(sourceId, channelId, profileId) {
      const source = store.get(sourceId, profileId);
      const prefix = `${sourceId}:`;
      if (!source || !String(channelId || "").startsWith(prefix)) throw new IptvError("not_found");
      return api.resolvePlaybackUrl(source, { sourceId: source.id, streamId: String(channelId).slice(prefix.length) });
    },
    getVodCategories: movies.categories,
    getVodStreams: movies.list,
    getVodInfo: movies.info,
    getSeriesCategories: shows.categories,
    getSeries: shows.list,
    getSeriesInfo: shows.info,
    /** kind: "movie" | "episode". In-memory URL only; never log it. */
    resolveVodPlaybackUrl(sourceId, kind, id, ext, profileId) {
      return api.resolveVodUrl(requireSource(sourceId, profileId), kind, id, ext);
    },
    // Profile switch / logout: stale in-flight results are discarded, cache dropped.
    invalidate
  };
}

export const IptvRepository = createIptvRepository();

// Logout drops in-memory catalogs and stale in-flight work; registered only once
// this module is loaded, so Home startup pays nothing for IPTV.
registerSessionTeardownHandler(() => IptvRepository.invalidate());
