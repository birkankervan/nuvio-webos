import { BoundedCache } from "../../../core/util/boundedCache.js";

// Pure list derivation for the IPTV screen: search index, query filter,
// favorites projection, category entries and a small result cache. Nothing
// here touches the DOM, so it is cheap to test and safe off the key path.

export const VIEW_ALL = "all";
export const VIEW_FAVORITES = "fav";
export const categoryViewKey = (categoryId) => `cat:${categoryId}`;

export function normalizeQuery(query) {
  return String(query ?? "").trim().toLowerCase();
}

// Built once per channel list (not per key press).
export function buildSearchIndex(channels) {
  return {
    channels,
    names: channels.map((channel) => String(channel.name).toLowerCase()),
    numbers: channels.map((channel) => (channel.number == null ? "" : String(channel.number)))
  };
}

export function searchChannels(index, query) {
  const q = normalizeQuery(query);
  if (!q) return index.channels;
  const numeric = /^\d+$/.test(q);
  const result = [];
  for (let i = 0; i < index.names.length; i += 1) {
    if (index.names[i].includes(q) || (numeric && index.numbers[i].startsWith(q))) {
      result.push(index.channels[i]);
    }
  }
  return result;
}

export function pickFavorites(channels, favoriteIds) {
  const set = favoriteIds instanceof Set ? favoriteIds : new Set(favoriteIds);
  return channels.filter((channel) => set.has(channel.id));
}

// "All" (full catalogs only) and "Favorites" come first, then provider order.
export function buildCategoryEntries({ categories = [], mode = "full", labels = {} } = {}) {
  const entries = [];
  if (mode === "full") entries.push({ key: VIEW_ALL, name: labels.all || "All" });
  entries.push({ key: VIEW_FAVORITES, name: labels.favorites || "Favorites" });
  for (const category of categories) {
    entries.push({ key: categoryViewKey(category.id), name: category.name, categoryId: category.id });
  }
  return entries;
}

export function createResultCache(limit = 24) {
  const cache = new BoundedCache(limit);
  return {
    get: (viewKey, query, version = 0) => cache.get(`${viewKey}|${normalizeQuery(query)}|${version}`),
    set: (viewKey, query, version, value) => cache.set(`${viewKey}|${normalizeQuery(query)}|${version}`, value),
    clear: () => cache.clear()
  };
}
