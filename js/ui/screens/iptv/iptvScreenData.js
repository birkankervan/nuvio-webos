import { Router } from "../../navigation/routerState.js";
import { IptvRepository } from "../../../data/repository/iptvRepository.js";
import { IptvSourcesStore } from "../../../data/local/iptvSourcesStore.js";
import {
  VIEW_ALL,
  VIEW_FAVORITES,
  buildCategoryEntries,
  buildSearchIndex,
  categoryViewKey,
  pickFavorites,
  searchChannels
} from "./iptvChannelFilter.js";
import { TAB_LIVE, TAB_MOVIES, TAB_SERIES, ZONE, resolveFocusIndex } from "./iptvNavigation.js";
import { iptvErrorMessage } from "./iptvFormLogic.js";
import { t } from "./iptvText.js";

const CATALOG_STALE_MS = 24 * 60 * 60 * 1000;
const DELETE_CONFIRM_MS = 4000;

// Route-state safe snapshot of a list item (no URLs, no credentials).
const pickListItem = ({ id, name, poster, ext, rating }) => ({ id, name, poster, ext, rating });

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
    await this.showEntries(viewKey, restore, IptvSourcesStore.getLastChannel());
  },

  // Category rail + first list; shared by the live catalog and the VOD tabs.
  async showEntries(viewKey, restore, lastId = "") {
    this.syncCategoryFocusToView();
    this.catList.setItems(this.entries, {
      reveal: this.focus.category,
      scroll: restore?.categoryScroll || 0
    });
    await this.selectView(viewKey, {
      focusId: restore?.channelId || lastId,
      focusIndex: restore?.focus?.channel || 0,
      scroll: restore?.channelScroll || 0
    });
    // A tab switch keeps the focus on the tab buttons.
    if (!restore && !this.keepZone) this.focus.zone = this.channels.length || this.statusAction ? ZONE.GRID : ZONE.HEADER;
    this.keepZone = false;
    this.applyFocus();
  },

  // Movies / Series: categories first, items per category (never the full list at mount).
  async loadVodTab({ restore = null } = {}) {
    this.abortLoad();
    const run = (this.loadRun = (this.loadRun || 0) + 1);
    const controller = (this.loadController = new AbortController());
    const movies = this.tab === TAB_MOVIES;
    const retry = () => this.loadVodTab({ restore });
    this.setStatus("loading");
    try {
      const fetchCategories = movies ? IptvRepository.getVodCategories : IptvRepository.getSeriesCategories;
      const categories = await fetchCategories(this.source.id, { signal: controller.signal });
      if (run !== this.loadRun) return;
      this.entries = [
        { key: VIEW_ALL, name: t("iptv_category_all", "All") },
        ...categories.map((category) => ({ key: categoryViewKey(category.id), name: category.name, categoryId: category.id }))
      ];
      const wanted = restore?.viewKey;
      const viewKey = this.entries.some((entry) => entry.key === wanted) ? wanted : (this.entries[1] || this.entries[0]).key;
      this.viewKey = viewKey;
      await this.showEntries(viewKey, restore);
    } catch (error) {
      if (run !== this.loadRun || error?.code === "aborted") return;
      this.setStatus("error", error, retry);
    }
  },

  openVodItem(item) {
    return this.openDetail("movie", item && pickListItem(item));
  },

  openSeriesItem(item) {
    return this.openDetail("series", item && pickListItem(item));
  },

  openItem(item) {
    return this.tab === TAB_MOVIES ? this.openVodItem(item) : this.openSeriesItem(item);
  },

  setTab(tab) {
    if (tab === this.tab) return;
    this.teardownLists();
    this.tab = tab;
    this.query = "";
    this.searchInput.value = "";
    this.entries = [];
    this.channels = [];
    this.viewKey = "";
    this.bases = new Map();
    this.resultCache.clear();
    this.keepZone = true;
    this.setNotice("");
    this.createLists();
    this.updateTabLabels();
    if (tab === TAB_LIVE) void this.loadCatalog();
    else void this.loadVodTab();
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
    const fetchList = {
      [TAB_LIVE]: IptvRepository.getChannels,
      [TAB_MOVIES]: IptvRepository.getVodStreams,
      [TAB_SERIES]: IptvRepository.getSeries
    }[this.tab];
    const list = await fetchList(this.source.id, categoryId, { signal });
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
    // VOD search is global: a query reads the full list, whatever category is selected.
    const dataKey = this.tab !== TAB_LIVE && this.query.trim() ? VIEW_ALL : viewKey;
    if (!this.bases.has(dataKey) && dataKey !== VIEW_FAVORITES) this.setStatus("loading");
    try {
      const base = await this.baseFor(dataKey, controller.signal);
      if (run !== this.viewRun) return;
      this.viewKey = viewKey;
      this.syncCategoryFocusToView();
      this.catList.refresh();
      this.setChannels(this.visibleChannels(dataKey, base), { focusId, focusIndex, scroll });
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
      if (value === this.query || (this.tab === TAB_LIVE && !this.catalog)) return;
      this.query = value;
      if (this.tab !== TAB_LIVE) {
        if (this.entries.length) void this.selectView(this.viewKey, { focusIndex: 0 });
        return;
      }
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
      // CH+/CH- zap list: whole source in the All view, else the channel's own category.
      iptvCategoryId: this.viewKey === VIEW_ALL ? null : channel.categoryId,
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
