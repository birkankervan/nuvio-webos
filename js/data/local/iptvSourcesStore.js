import { createProfileScopedStore } from "./profileScopedStore.js";
import { IptvProgressStore } from "./iptvProgressStore.js";

// Local-only IPTV state per profile. Credentials live here in plain local
// storage (accepted risk, plan D1); never sync, log or put them in routes.
const KEY = "iptvSources";
const SOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_SOURCES = 20;
const MAX_FAVORITES = 5000;
const SILENT = { silentSync: true };

export class IptvStoreError extends Error {
  constructor(code) {
    super(code);
    this.name = "IptvStoreError";
    this.code = code;
  }
}

export function normalizeIptvServer(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch (_error) {
    return "";
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password) {
    return "";
  }
  const path = url.pathname
    .replace(/\/+$/, "")
    .replace(/\/player_api\.php$/i, "")
    .replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

function toText(value) {
  return String(value ?? "").trim();
}

function normalizeAccount(value) {
  const account = value && typeof value === "object" ? value : null;
  if (!account) {
    return null;
  }
  const expDate = Number(account.expDate);
  const maxConnections = Number(account.maxConnections);
  return {
    status: toText(account.status),
    expDate: Number.isFinite(expDate) && expDate > 0 ? expDate : null,
    maxConnections: Number.isFinite(maxConnections) && maxConnections > 0 ? maxConnections : null,
    allowedFormats: Array.isArray(account.allowedFormats)
      ? account.allowedFormats.map((format) => toText(format).toLowerCase()).filter(Boolean)
      : [],
    timezone: toText(account.timezone)
  };
}

function normalizeSource(value) {
  const source = value && typeof value === "object" ? value : {};
  const id = toText(source.id);
  const server = normalizeIptvServer(source.server);
  const username = toText(source.username);
  const password = String(source.password ?? "");
  if (!SOURCE_ID_PATTERN.test(id) || !server || !username || !password) {
    return null;
  }
  const createdAt = Number(source.createdAt) || Date.now();
  return {
    id,
    kind: "xtream",
    name: toText(source.name) || new URL(server).hostname,
    server,
    username,
    password,
    createdAt,
    updatedAt: Number(source.updatedAt) || createdAt,
    lastAccount: normalizeAccount(source.lastAccount),
    showAdult: source.showAdult === true
  };
}

function ids(list) {
  return Array.isArray(list)
    ? Array.from(new Set(list.map(toText).filter(Boolean))).slice(0, MAX_FAVORITES)
    : [];
}

function normalizeState(value) {
  const state = value && typeof value === "object" ? value : {};
  const seen = new Set();
  const sources = (Array.isArray(state.sources) ? state.sources : [])
    .map(normalizeSource)
    .filter((source) => source && !seen.has(source.id) && seen.add(source.id))
    .slice(0, MAX_SOURCES);
  const owned = (channelId) => sources.some((source) => channelId.startsWith(`${source.id}:`));
  return {
    sources,
    favorites: ids(state.favorites).filter(owned),
    lastChannel: owned(toText(state.lastChannel)) ? toText(state.lastChannel) : ""
  };
}

function createSourceId() {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `s${random.slice(0, 20)}`;
}

const store = createProfileScopedStore({
  key: KEY,
  normalize: normalizeState,
  seedFromPrimary: false
});

const removalListeners = new Set();
function notifyRemoval(profileId, sourceId) {
  removalListeners.forEach((listener) => {
    try {
      listener({ profileId, sourceId });
    } catch (_error) {
      // Cache cleanup must never break a store write.
    }
  });
}

function read(profileId) {
  return store.getForProfile(profileId);
}

function write(profileId, state) {
  return store.replaceForProfile(profileId, state, SILENT);
}

export const IptvSourcesStore = {
  list(profileId) {
    return read(profileId).sources;
  },

  get(sourceId, profileId) {
    return read(profileId).sources.find((source) => source.id === toText(sourceId)) || null;
  },

  upsert(input, profileId) {
    const state = read(profileId);
    const id = toText(input?.id) || createSourceId();
    const existing = state.sources.find((source) => source.id === id);
    const next = normalizeSource({
      ...existing,
      ...input,
      id,
      createdAt: existing?.createdAt,
      updatedAt: Date.now()
    });
    if (!next) {
      throw new IptvStoreError("invalid_source");
    }
    if (!existing && state.sources.length >= MAX_SOURCES) {
      throw new IptvStoreError("too_many_sources");
    }
    state.sources = existing
      ? state.sources.map((source) => (source.id === id ? next : source))
      : [...state.sources, next];
    write(profileId, state);
    return next;
  },

  remove(sourceId, profileId) {
    const id = toText(sourceId);
    const state = read(profileId);
    if (!state.sources.some((source) => source.id === id)) {
      return false;
    }
    state.sources = state.sources.filter((source) => source.id !== id);
    write(profileId, state); // normalize drops this source's favorites and last channel.
    IptvProgressStore.removeSource(id, profileId);
    notifyRemoval(profileId, id);
    return true;
  },

  clearProfile(profileId) {
    store.clearProfile(profileId, SILENT);
    IptvProgressStore.clearProfile(profileId);
    notifyRemoval(profileId, null);
  },

  getFavorites(profileId) {
    return read(profileId).favorites;
  },

  setFavorite(channelId, isFavorite, profileId) {
    const id = toText(channelId);
    const state = read(profileId);
    const rest = state.favorites.filter((favorite) => favorite !== id);
    state.favorites = isFavorite ? [...rest, id] : rest;
    return write(profileId, state).favorites;
  },

  getLastChannel(profileId) {
    return read(profileId).lastChannel || null;
  },

  setLastChannel(channelId, profileId) {
    const state = read(profileId);
    state.lastChannel = toText(channelId);
    return write(profileId, state).lastChannel || null;
  },

  // Repository cache cleanup hook: called after remove() and clearProfile().
  onRemoval(listener) {
    removalListeners.add(listener);
    return () => removalListeners.delete(listener);
  }
};
