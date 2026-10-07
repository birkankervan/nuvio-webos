import { BoundedCache } from "../../core/util/boundedCache.js";
import { IptvSourcesStore, normalizeIptvServer } from "../local/iptvSourcesStore.js";
import { IptvError, XtreamApi } from "../remote/api/xtreamApi.js";
import { registerSessionTeardownHandler } from "../../core/auth/sessionLifecycle.js";

const MAX_CACHED_CATALOGS = 8;
const MAX_CACHED_CATEGORIES = 32;

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

export function createIptvRepository({ store = IptvSourcesStore, api = XtreamApi } = {}) {
  const catalogs = new BoundedCache(MAX_CACHED_CATALOGS);
  const inFlight = new Map();
  let generation = 0;

  const keyOf = (profileId, sourceId) => `${profileId ?? ""}|${sourceId}`;

  function invalidate() {
    generation += 1;
    catalogs.clear();
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
      const categories = await api.getLiveCategories(source, { signal });
      let channels = null;
      try {
        channels = await api.getLiveStreams(source, { signal });
      } catch (error) {
        if (error?.code !== "too_large") throw error;
      }
      assertFresh(token);
      const catalog = {
        sourceId,
        mode: channels ? "full" : "byCategory",
        categories,
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
    const cached = catalog.channelsByCategory.get(String(categoryId));
    if (cached) return cached;
    return shared(`${key}|${categoryId}`, signal, async () => {
      const source = requireSource(sourceId, profileId);
      const token = generation;
      const channels = await api.getLiveStreams(source, { categoryId, signal });
      assertFresh(token);
      catalog.channelsByCategory.set(String(categoryId), channels);
      return channels;
    });
  }

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
    // Profile switch / logout: stale in-flight results are discarded, cache dropped.
    invalidate
  };
}

export const IptvRepository = createIptvRepository();

// Logout drops in-memory catalogs and stale in-flight work; registered only once
// this module is loaded, so Home startup pays nothing for IPTV.
registerSessionTeardownHandler(() => IptvRepository.invalidate());
