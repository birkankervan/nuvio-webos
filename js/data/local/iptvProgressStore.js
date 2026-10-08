import { createProfileScopedStore } from "./profileScopedStore.js";

// Local-only VOD resume positions per profile. Never synced, never sent to
// Trakt/Simkl/cloud/Continue Watching. Keys: `${sourceId}:movie:${id}` / `${sourceId}:ep:${id}`.
const KEY = "iptvProgress";
const MAX_ENTRIES = 500;
const MIN_POS_MS = 10000;
const COMPLETED_RATIO = 0.9;
const SILENT = { silentSync: true };

export function iptvProgressKey({ sourceId, kind, streamId } = {}) {
  return `${sourceId}:${kind === "episode" ? "ep" : "movie"}:${streamId}`;
}

function normalizeState(value) {
  const entries = {};
  Object.entries(value?.entries || {}).forEach(([key, entry]) => {
    const posMs = Number(entry?.posMs);
    const durMs = Number(entry?.durMs);
    if (key && posMs >= MIN_POS_MS && durMs > 0) {
      entries[key] = { posMs, durMs, updatedAt: Number(entry.updatedAt) || 0, title: String(entry.title || "") };
    }
  });
  const keys = Object.keys(entries);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => entries[a].updatedAt - entries[b].updatedAt)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((key) => delete entries[key]);
  }
  return { entries };
}

const store = createProfileScopedStore({ key: KEY, normalize: normalizeState, seedFromPrimary: false });

function write(profileId, mutate) {
  const state = store.getForProfile(profileId);
  mutate(state.entries);
  store.replaceForProfile(profileId, state, SILENT);
}

export const IptvProgressStore = {
  get(key, profileId) {
    return store.getForProfile(profileId).entries[key] || null;
  },

  save(key, { posMs, durMs, title } = {}, profileId) {
    const pos = Number(posMs);
    const dur = Number(durMs);
    if (!key || !(dur > 0) || !(pos >= MIN_POS_MS)) {
      return;
    }
    write(profileId, (entries) => {
      if (pos / dur >= COMPLETED_RATIO) {
        delete entries[key];
      } else {
        entries[key] = { posMs: Math.trunc(pos), durMs: Math.trunc(dur), updatedAt: Date.now(), title: String(title || "") };
      }
    });
  },

  remove(key, profileId) {
    write(profileId, (entries) => delete entries[key]);
  },

  removeSource(sourceId, profileId) {
    const prefix = `${sourceId}:`;
    write(profileId, (entries) => {
      Object.keys(entries).forEach((key) => key.startsWith(prefix) && delete entries[key]);
    });
  },

  clearProfile(profileId) {
    store.clearProfile(profileId, SILENT);
  }
};
