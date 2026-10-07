import { Router } from "../../navigation/routerState.js";
import { IptvRepository } from "../../../data/repository/iptvRepository.js";
import { IptvSourcesStore } from "../../../data/local/iptvSourcesStore.js";
import {
  VIEW_ALL,
  VIEW_FAVORITES,
  buildCategoryEntries,
  buildSearchIndex,
  pickFavorites,
  searchChannels
} from "./iptvChannelFilter.js";
import { ZONE, resolveFocusIndex } from "./iptvNavigation.js";
import { iptvErrorMessage } from "./iptvFormLogic.js";
import { t } from "./iptvText.js";

const CATALOG_STALE_MS = 24 * 60 * 60 * 1000;
const DELETE_CONFIRM_MS = 4000;

// Data side of the channel screen: catalog loading, views (category / all /
// favorites), search, favorites, source actions and playback hand-off.
// Mixed into IptvScreen; `this` is the screen.
export const iptvDataMethods = {
  abortLoad() {
    this.loadController?.abort();
    this.loadController = null;
  },

  async loadCatalog({ force = false, restore = null } = {}) {
    this.abortLoad();
    const run = (this.loadRun = (this.loadRun || 0) + 1);
    const controller = (this.loadController = new AbortController());
    const sourceId = this.source.id;
    const cached = IptvRepository.getCatalog(sourceId);
    if (cached && !force) {
      await this.applyCatalog(cached, restore);
      // Cache older than a day refreshes quietly; the visible list stays usable.
      if (Date.now() - cached.fetchedAt > CATALOG_STALE_MS) void this.loadCatalog({ force: true });
      return;
    }
    if (!this.catalog) this.setStatus("loading");
    else this.setNotice(t("iptv_refreshing", "Refreshing channels..."));
    try {
      const catalog = await IptvRepository.refreshCatalog(sourceId, { signal: controller.signal });
      if (run !== this.loadRun) return;
      this.setNotice("");
      await this.applyCatalog(catalog, restore);
    } catch (error) {
      if (run !== this.loadRun || error?.code === "aborted") return;
      // A failed refresh keeps the previous list (repository swaps atomically).
      if (this.catalog) this.setNotice(this.messageFor(error));
      else this.setStatus("error", error);
    }
  },

  messageFor(error) {
    const { key, fallback } = iptvErrorMessage(error);
    return t(key, fallback);
  },

  async applyCatalog(catalog, restore = null) {
    this.catalog = catalog;
    this.resultCache.clear();
    this.bases = new Map();
    this.searchIndexes = new WeakMap();
    this.favoritesBase = null;
    this.entries = buildCategoryEntries({
      categories: catalog.categories,
      mode: catalog.mode,
      labels: { all: t("iptv_category_all", "All"), favorites: t("iptv_category_favorites", "Favorites") }
    });
    const wanted = restore?.viewKey;
    const viewKey = this.entries.some((entry) => entry.key === wanted)
      ? wanted
      : this.entries.find((entry) => entry.key !== VIEW_FAVORITES)?.key || VIEW_FAVORITES;
    this.viewKey = viewKey;
    this.syncCategoryFocusToView();
    this.catList.setItems(this.entries, {
      reveal: this.focus.category,
      scroll: restore?.categoryScroll || 0
    });
    await this.selectView(viewKey, {
      focusId: restore?.channelId || IptvSourcesStore.getLastChannel(),
      focusIndex: restore?.focus?.channel || 0,
      scroll: restore?.channelScroll || 0
    });
    if (!restore) this.focus.zone = this.channels.length || this.statusAction ? ZONE.GRID : ZONE.HEADER;
    this.applyFocus();
  },

  syncCategoryFocusToView() {
    const index = this.entries.findIndex((entry) => entry.key === this.viewKey);
    this.focus.category = Math.max(0, index);
  },

  indexFor(list) {
    let index = this.searchIndexes.get(list);
    if (!index) this.searchIndexes.set(list, (index = buildSearchIndex(list)));
    return index;
  },

  // Unfiltered list for a view; null while a category still has to be fetched.
  async baseFor(viewKey, signal) {
    if (viewKey === VIEW_FAVORITES) return this.favoritesList();
    if (this.bases.has(viewKey)) return this.bases.get(viewKey);
    const categoryId = viewKey === VIEW_ALL ? null : this.entries.find((entry) => entry.key === viewKey)?.categoryId;
    const list = await IptvRepository.getChannels(this.source.id, categoryId, { signal });
    this.bases.set(viewKey, list);
    this.favVersion += 1; // per-category favorites grow with every loaded category
    return list;
  },

  // Full catalogs derive favorites from every channel; per-category catalogs
  // only know the categories opened so far (ponytail: add a favorites->channel
  // map to the store when per-category mode needs complete favorites).
  favoritesList() {
    if (this.favoritesBase?.version === this.favVersion) return this.favoritesBase.list;
    const source = this.catalog?.mode === "full" ? this.catalog.channels : Array.from(this.bases.values()).flat();
    this.favoritesBase = { version: this.favVersion, list: pickFavorites(source, this.favorites) };
    return this.favoritesBase.list;
  },

  visibleChannels(viewKey, base) {
    const version = viewKey === VIEW_FAVORITES ? this.favVersion : 0;
    let list = this.resultCache.get(viewKey, this.query, version);
    if (!list) {
      list = searchChannels(this.indexFor(base), this.query);
      this.resultCache.set(viewKey, this.query, version, list);
    }
    return list;
  },

  async selectView(viewKey, { focusId = "", focusIndex = 0, scroll = 0 } = {}) {
    const run = (this.viewRun = (this.viewRun || 0) + 1);
    this.viewController?.abort();
    const controller = (this.viewController = new AbortController());
    if (!this.bases.has(viewKey) && viewKey !== VIEW_FAVORITES) this.setStatus("loading");
    try {
      const base = await this.baseFor(viewKey, controller.signal);
      if (run !== this.viewRun) return;
      this.viewKey = viewKey;
      this.syncCategoryFocusToView();
      this.catList.refresh();
      this.setChannels(this.visibleChannels(viewKey, base), { focusId, focusIndex, scroll });
    } catch (error) {
      if (run !== this.viewRun || error?.code === "aborted") return;
      this.channels = [];
      this.chanList.setItems([]);
      this.setStatus("error", error, () => this.selectView(viewKey, { focusId, focusIndex }));
    }
  },

  setChannels(list, { focusId = "", focusIndex = 0, scroll = 0 } = {}) {
    this.channels = list;
    const index = resolveFocusIndex(list, focusId, focusIndex);
    this.focus.channel = index;
    const active = this.focus.zone === ZONE.GRID && list.length > 0;
    this.chanList.setItems(list, { focus: active ? index : -1, reveal: index, scroll });
    if (list.length) this.setStatus("ready");
    else if (this.query.trim()) this.setStatus("no_results");
    else this.setStatus(this.viewKey === VIEW_FAVORITES ? "no_favorites" : "empty");
  },

  currentChannelId() {
    return this.channels[this.focus.channel]?.id || "";
  },

  onSearchInput(value) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      if (value === this.query || !this.catalog) return;
      this.query = value;
      const base = this.bases.get(this.viewKey) || (this.viewKey === VIEW_FAVORITES ? this.favoritesList() : null);
      if (!base) return;
      this.setChannels(this.visibleChannels(this.viewKey, base), {
        focusId: this.currentChannelId(),
        focusIndex: this.focus.channel
      });
    }, 250);
  },

  toggleFavorite(channel) {
    if (!channel) return;
    const next = !this.favorites.has(channel.id);
    const stored = IptvSourcesStore.setFavorite(channel.id, next);
    this.favorites = new Set(stored);
    this.favVersion += 1;
    if (this.viewKey === VIEW_FAVORITES) {
      // The removed channel's slot now holds its neighbour: focus stays near.
      this.setChannels(this.visibleChannels(VIEW_FAVORITES, this.favoritesList()), {
        focusId: next ? channel.id : "",
        focusIndex: this.focus.channel
      });
    } else {
      this.chanList.refresh();
    }
  },

  // Player contract (IPTV-04): only safe identifiers travel through the route.
  // playIptv: { sourceId, channelId }; the player resolves the stream URL from
  // the active profile's store. URL, username and password are never route
  // params, history state or snapshots.
  playChannel(channel) {
    if (!channel) return;
    IptvSourcesStore.setLastChannel(channel.id);
    Router.navigate("player", {
      itemType: "channel",
      itemId: channel.id,
      playIptv: { sourceId: channel.sourceId, channelId: channel.id },
      title: channel.name,
      playerTitle: channel.name,
      resumePosition: 0
    });
  },

  switchSource() {
    const sources = IptvRepository.listSources();
    if (sources.length < 2) return;
    const at = sources.findIndex((source) => source.id === this.source.id);
    this.enterChannels(sources[(at + 1) % sources.length]);
  },

  armDelete() {
    clearTimeout(this.deleteTimer);
    this.deleteArmed = true;
    this.updateHeaderLabels();
    this.deleteTimer = setTimeout(() => {
      this.deleteArmed = false;
      this.updateHeaderLabels();
    }, DELETE_CONFIRM_MS);
  },

  deleteSource() {
    if (!this.deleteArmed) return this.armDelete();
    clearTimeout(this.deleteTimer);
    this.deleteArmed = false;
    IptvRepository.removeSource(this.source.id);
    const remaining = IptvRepository.listSources();
    if (remaining.length) this.enterChannels(remaining[0]);
    else this.showForm({});
  }
};
