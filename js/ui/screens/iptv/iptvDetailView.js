import { Router } from "../../navigation/routerState.js";
import { IptvRepository } from "../../../data/repository/iptvRepository.js";
import {
  IptvProgressStore,
  iptvProgressKey,
  iptvResumePositionMs
} from "../../../data/local/iptvProgressStore.js";
import { allowDpadRepeat } from "../../navigation/dpadRepeatThrottle.js";
import { createVirtualList } from "./iptvVirtualList.js";
import {
  DZONE,
  advancePastWatched,
  episodePlayerTitle,
  formatClock,
  formatClockTime,
  formatEpisodeDuration,
  formatReleaseDate,
  moveDetailFocus,
  pickDefaultEpisode,
  progressRatio,
  releaseYear,
  resolveDetailFocus
} from "./iptvDetail.js";
import { isSeparatorName } from "./iptvCards.js";
import { TAB_LIVE, TAB_MOVIES, TAB_SERIES, ZONE } from "./iptvNavigation.js";
import { createIptvPreview } from "./iptvPreview.js";
import { zapDirection } from "./iptvZap.js";
import { loadStreamingLibs } from "../../../runtime/loadStreamingLibs.js";
import { escapeHtml, t } from "./iptvText.js";

const PANEL_DEBOUNCE_MS = 300; // detail/EPG fetch after the selection settles
const EPISODE_ROW_HEIGHT = 84;
const MIN_IMAGE_PX = 8; // providers send 1x1 placeholders
const OK = 13;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ratingText = (rating) => (rating > 0 ? `★ ${Number(rating).toFixed(1)}` : "");
const pick = (item, info, key) => info?.[key] || item?.[key] || "";

const durationText = (secs) => {
  const min = Math.round(Number(secs) / 60);
  if (!(min > 0)) return "";
  return min < 60 ? `${min}dk` : `${Math.floor(min / 60)}s ${min % 60}dk`;
};

// "2024 · ★ 7.8 · 1s 52dk · Dram, Gerilim"; parts without data drop out.
function factsLine(item, info, duration) {
  return [
    releaseYear(info?.releaseDate),
    ratingText(info?.rating > 0 ? info.rating : item.rating),
    duration,
    info?.genre
  ]
    .filter(Boolean)
    .join(" · ");
}

// label: value rows (secondary colour); a row only exists when its value does.
function fillFacts(host, rows) {
  host.replaceChildren(
    ...rows
      .filter(([, value]) => value)
      .map(([label, value, cls]) => {
        const row = document.createElement("div");
        if (cls) row.className = cls;
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = value;
        row.append(dt, dd);
        return row;
      })
  );
}

const factLabels = () => ({
  director: t("iptv_fact_director", "Yönetmen"),
  cast: t("iptv_fact_cast", "Oyuncular"),
  country: t("iptv_fact_country", "Ülke"),
  age: t("iptv_fact_age", "Yaş sınırı"),
  released: t("iptv_fact_released", "Çıkış tarihi")
});

// Shows an image only when it loads as a real picture (not a 1x1 placeholder).
function loadInto(holder, img, url) {
  holder.classList.remove("has-img");
  img.onload = () => {
    if (img.naturalWidth >= MIN_IMAGE_PX) holder.classList.add("has-img");
  };
  img.onerror = () => holder.classList.remove("has-img");
  if (url) img.src = url;
  else img.removeAttribute("src");
}

function createEpisodeNode() {
  const node = document.createElement("div");
  node.className = "iptv-ep";
  node.setAttribute("role", "button");
  node.innerHTML =
    '<div class="iptv-ep-box"><span class="iptv-ep-number"></span>' +
    '<div class="iptv-ep-thumb"><img class="iptv-ep-img" alt="" decoding="async"></div>' +
    '<div class="iptv-ep-text"><div class="iptv-ep-title"></div>' +
    '<div class="iptv-ep-bar"><div class="iptv-ep-fill"></div></div></div>' +
    '<span class="iptv-ep-check">✓</span><span class="iptv-ep-dur"></span></div>';
  node._parts = {
    number: node.querySelector(".iptv-ep-number"),
    thumb: node.querySelector(".iptv-ep-thumb"),
    img: node.querySelector("img"),
    title: node.querySelector(".iptv-ep-title"),
    bar: node.querySelector(".iptv-ep-bar"),
    fill: node.querySelector(".iptv-ep-fill"),
    dur: node.querySelector(".iptv-ep-dur")
  };
  return node;
}

function bindEpisode(node, episode, progress) {
  const { number, thumb, img, title, bar, fill, dur } = node._parts;
  number.textContent = episode.number || "";
  title.textContent = episode.title;
  dur.textContent = formatEpisodeDuration(episode.durationSecs);
  const ratio = progress?.watched ? 0 : progressRatio(progress);
  bar.hidden = !ratio;
  fill.style.width = `${Math.round(ratio * 100)}%`;
  node.classList.toggle("is-watched", Boolean(progress?.watched));
  if (img._src !== episode.image) {
    img._src = episode.image;
    loadInto(thumb, img, episode.image);
  }
}

// Right-hand panel of the IPTV screen: live preview + EPG, movie details or
// series seasons/episodes for the selected item. Selection = focus in the item
// list; panel content follows it with a debounce and an AbortController, so
// stale results are dropped. Mixed into IptvScreen; `this` is the screen.
export const iptvDetailMethods = {
  // ---- Selection -> panel ------------------------------------------------------
  selectedItem() {
    const item = this.channels?.[this.focus.channel];
    return item && !isSeparatorName(item.name) ? item : null;
  },

  syncPanelSelection() {
    if (this.mode !== "channels" || !this.panelNode) return;
    const live = this.tab === TAB_LIVE;
    // Live: the panel shows the channel opened with OK, never the focused row.
    let autoplay = false;
    if (live && this.restoreActiveId && this.channels.length) {
      const restored = this.channels.find((c) => c.id === this.restoreActiveId);
      this.restoreActiveId = "";
      if (restored) this.activeLive = autoplay = restored;
    }
    const item = live ? this.activeLive : this.selectedItem();
    this.chanList?.setSelected(
      !item ? -1 : live ? this.channels.findIndex((c) => c.id === item.id) : this.focus.channel
    );
    const id = item?.id || "";
    if (id === this.panelItemId && this.tab === this.panelTab) return;
    this.panelItemId = id;
    this.panelTab = this.tab;
    this.loadPanel(item);
    if (autoplay) void this.startPreview(item);
  },

  progressOf(kind, id) {
    const key = iptvProgressKey({ sourceId: this.source.id, kind, streamId: id });
    this.progressCache ||= new Map();
    if (!this.progressCache.has(key)) this.progressCache.set(key, IptvProgressStore.get(key));
    return this.progressCache.get(key);
  },

  categoryNameOf(item) {
    const entries = this.entries || [];
    const own = item.categoryId != null && entries.find((e) => e.categoryId === item.categoryId);
    if (own) return own.name;
    const current = entries.find((entry) => entry.key === this.viewKey);
    return current?.categoryId != null ? current.name : "";
  },

  // Number of focusable panel targets (0: Right does not enter the panel).
  panelFocusable() {
    const panel = this.panel;
    if (!panel || !(this.tab === TAB_LIVE ? this.activeLive : this.selectedItem())) return 0;
    if (panel.kind === TAB_SERIES) return panel.seasons?.length ? 1 : 0;
    return 1;
  },

  cancelPanelWork() {
    clearTimeout(this.panelTimer);
    this.panelTimer = null;
    this.panel?.controller?.abort();
    if (this.panel) this.panel.controller = null;
  },

  // Stops everything the panel started; also used by tab switches and cleanup.
  teardownPanel() {
    this.cancelPanelWork();
    this.stopPreview();
    this.panel?.preview?.destroy();
    this.panel?.epList?.destroy();
    this.panel = null;
    this.panelItemId = null;
    this.panelTab = null;
    this.panelNode?.replaceChildren();
  },

  ensurePanelShell(kind) {
    if (this.panel?.kind === kind) return;
    const selectedId = this.panelItemId;
    this.teardownPanel();
    this.panelItemId = selectedId;
    this.panelTab = this.tab;
    const node = this.panelNode;
    node.className = `iptv-panel is-${kind}`;
    const panel = (this.panel = { kind, item: null, controller: null });
    if (kind === TAB_LIVE) {
      node.innerHTML = `
        <div class="iptv-panel-body iptv-live">
          <div class="iptv-live-video"></div>
          <div class="iptv-live-info">
            <div class="iptv-live-logo"><span class="iptv-live-initial"></span><img alt="" decoding="async"></div>
            <div class="iptv-live-meta"><div class="iptv-live-name"></div><div class="iptv-live-cat"></div></div>
            <button type="button" class="iptv-btn iptv-btn-primary iptv-btn-panel" data-panel-action="fullscreen">${escapeHtml(t("iptv_fullscreen", "Tam ekran"))}</button>
          </div>
          <div class="iptv-epg"></div>
        </div>
        <div class="iptv-panel-empty"></div>`;
      panel.preview = createIptvPreview(node.querySelector(".iptv-live-video"));
    } else {
      node.innerHTML = '<div class="iptv-panel-body"></div><div class="iptv-panel-empty"></div>';
    }
    panel.body = node.querySelector(".iptv-panel-body");
    panel.empty = node.querySelector(".iptv-panel-empty");
  },

  setPanelEmpty(text) {
    const { panel } = this;
    this.panelNode.classList.toggle("is-empty", Boolean(text));
    panel.empty.textContent = text || "";
  },

  loadPanel(item) {
    this.cancelPanelWork();
    this.ensurePanelShell(this.tab);
    this.panel.item = item;
    this.panelFocus = { zone: DZONE.BUTTONS, button: 0, season: 0, episode: 0 };
    if (this.tab === TAB_LIVE) this.loadLivePanel(item);
    else if (this.tab === TAB_MOVIES) this.loadMoviePanel(item);
    else this.loadSeriesPanel(item);
  },

  // ---- Live ----------------------------------------------------------------------
  loadLivePanel(item) {
    const { panel } = this;
    panel.body.querySelector(".iptv-epg").replaceChildren();
    this.setPanelEmpty(item ? "" : t("iptv_select_channel", "Select a channel"));
    if (!item) {
      this.stopPreview();
      return;
    }
    const logo = panel.body.querySelector(".iptv-live-logo");
    panel.body.querySelector(".iptv-live-name").textContent = item.name;
    panel.body.querySelector(".iptv-live-cat").textContent = this.categoryNameOf(item);
    panel.body.querySelector(".iptv-live-initial").textContent =
      String(item.name || "")
        .match(/[\p{L}\p{N}]/u)?.[0]
        ?.toUpperCase() || "#";
    loadInto(logo, logo.querySelector("img"), item.logo);
    this.panelTimer = setTimeout(() => this.loadEpg(item), PANEL_DEBOUNCE_MS);
  },

  async loadEpg(item) {
    this.panelTimer = null;
    if (typeof IptvRepository.getShortEpg !== "function") return;
    const controller = (this.panel.controller = new AbortController());
    try {
      const list = await IptvRepository.getShortEpg(item.sourceId, item.id, {
        signal: controller.signal
      });
      if (controller.signal.aborted || this.panelItemId !== item.id) return;
      this.renderEpg(list);
    } catch (_) {
      // EPG is a nicety: a failure leaves the block empty.
    }
  },

  renderEpg(list) {
    const host = this.panel?.body.querySelector(".iptv-epg");
    if (!host) return;
    const now = Date.now();
    const rows = (Array.isArray(list) ? list : []).filter((e) => e.endMs > now).slice(0, 2);
    host.replaceChildren(
      ...rows.map((entry) => {
        const row = document.createElement("div");
        row.className = "iptv-epg-row";
        const label = entry.startMs <= now ? t("iptv_epg_now", "Now") : t("iptv_epg_next", "Next");
        const head = document.createElement("div");
        head.className = "iptv-epg-head";
        head.textContent = `${label}  ${formatClockTime(entry.startMs)} - ${formatClockTime(entry.endMs)}`;
        const title = document.createElement("div");
        title.className = "iptv-epg-title";
        title.textContent = entry.title;
        const desc = document.createElement("div");
        desc.className = "iptv-epg-desc";
        desc.textContent = entry.description || "";
        row.append(head, title, desc);
        return row;
      })
    );
  },

  // OK on a live row: a new channel becomes the panel's active one and previews
  // (the old stream plays until the new one opens); the active row goes fullscreen.
  activateLive(item) {
    if (!item) return;
    if (this.activeLive?.id === item.id) return this.playChannel(item);
    this.activeLive = item;
    this.syncPanelSelection();
    void this.startPreview(item);
  },

  async startPreview(item) {
    const preview = this.panel?.preview;
    if (!preview) return;
    const run = (this.previewRun = (this.previewRun || 0) + 1);
    this.previewItemId = item.id;
    try {
      // The URL carries credentials: it lives in this scope only.
      const url = await IptvRepository.resolveChannelPlaybackUrl(item.sourceId, item.id);
      // hls.js is lazy-loaded by the player; the preview needs it too.
      await loadStreamingLibs({ hls: true, dash: false });
      if (run !== this.previewRun || this.panelItemId !== item.id) return;
      preview.play(url);
    } catch (_) {
      if (run === this.previewRun) this.stopPreview();
    }
  },

  // Releases the provider connection synchronously (before the player opens).
  stopPreview() {
    this.previewRun = (this.previewRun || 0) + 1;
    this.panel?.preview?.stop();
    this.previewItemId = null;
  },

  // ---- Movie ---------------------------------------------------------------------
  loadMoviePanel(item) {
    this.panel.info = null;
    this.setPanelEmpty(item ? "" : t("iptv_select_movie", "Select a movie"));
    this.renderMovie();
    if (!item) return;
    this.panelTimer = setTimeout(async () => {
      this.panelTimer = null;
      const controller = (this.panel.controller = new AbortController());
      try {
        const info = await IptvRepository.getVodInfo(this.source.id, item.id, {
          signal: controller.signal
        });
        if (controller.signal.aborted || this.panelItemId !== item.id) return;
        this.panel.info = info;
        this.renderMovie();
      } catch (_) {
        // Details are optional: Play keeps working from the list data.
      }
    }, PANEL_DEBOUNCE_MS);
  },

  renderMovie() {
    const { panel } = this;
    const { item } = panel;
    if (!item) {
      panel.body.replaceChildren();
      return;
    }
    const { info } = panel;
    const resume = iptvResumePositionMs(this.progressOf("movie", item.id));
    const label = resume
      ? t("iptv_detail_resume", `Devam et (${formatClock(resume)})`, { time: formatClock(resume) })
      : t("iptv_detail_play", "Oynat");
    panel.body.innerHTML = `
      <div class="iptv-movie-head">
        <div class="iptv-movie-poster"><span class="iptv-movie-initial"></span><img alt="" decoding="async"></div>
        <div class="iptv-movie-info">
          <h2 class="iptv-movie-title"></h2>
          <div class="iptv-panel-sub"></div>
          <div class="iptv-panel-rating"></div>
          <button type="button" class="iptv-btn iptv-btn-primary iptv-btn-panel" data-panel-action="play">${escapeHtml(label)}</button>
        </div>
      </div>
      <dl class="iptv-facts"></dl>
      <p class="iptv-panel-plot"></p>`;
    const poster = panel.body.querySelector(".iptv-movie-poster");
    panel.body.querySelector(".iptv-movie-title").textContent = pick(item, info, "name");
    panel.body.querySelector(".iptv-panel-sub").textContent = this.categoryNameOf(item);
    panel.body.querySelector(".iptv-panel-rating").textContent = factsLine(
      item,
      info,
      durationText(info?.durationSecs)
    );
    const labels = factLabels();
    fillFacts(panel.body.querySelector(".iptv-facts"), [
      [labels.director, info?.director],
      [labels.cast, info?.cast, "is-long"],
      [labels.country, info?.country],
      [labels.age, info?.age],
      [labels.released, formatReleaseDate(info?.releaseDate)]
    ]);
    panel.body.querySelector(".iptv-panel-plot").textContent = info?.plot || "";
    panel.body.querySelector(".iptv-movie-initial").textContent =
      String(item.name || "")
        .match(/[\p{L}\p{N}]/u)?.[0]
        ?.toUpperCase() || "#";
    loadInto(poster, poster.querySelector("img"), pick(item, info, "poster"));
    this.applyPanelFocus();
  },

  playMovie(item) {
    if (!item) return;
    this.stopPreview();
    const sourceId = this.source.id;
    const key = iptvProgressKey({ sourceId, kind: "movie", streamId: item.id });
    Router.navigate("player", {
      itemType: "iptvvod",
      itemId: key,
      playIptv: {
        sourceId,
        kind: "movie",
        streamId: item.id,
        ext: item.ext || this.panel?.info?.ext,
        title: item.name
      },
      title: item.name,
      playerTitle: item.name,
      resumePositionMs: iptvResumePositionMs(IptvProgressStore.get(key))
    });
  },

  // ---- Series ----------------------------------------------------------------------
  loadSeriesPanel(item) {
    const { panel } = this;
    panel.epList?.destroy();
    panel.epList = null;
    panel.seasons = [];
    panel.info = null;
    panel.ready = false;
    this.setPanelEmpty(item ? "" : t("iptv_select_series", "Select a series"));
    if (!item) {
      panel.body.replaceChildren();
      return;
    }
    panel.body.innerHTML = `
      <div class="iptv-series-head">
        <div class="iptv-series-cover"><span class="iptv-movie-initial"></span><img alt="" decoding="async"></div>
        <div class="iptv-series-info">
          <h2 class="iptv-series-title"></h2>
          <div class="iptv-panel-rating"></div>
          <p class="iptv-panel-plot"></p>
        </div>
      </div>
      <dl class="iptv-facts"></dl>
      <div class="iptv-series-seasons"></div>
      <div class="iptv-series-episodes"></div>
      <div class="iptv-panel-status"></div>`;
    panel.body.querySelector(".iptv-movie-initial").textContent =
      String(item.name || "")
        .match(/[\p{L}\p{N}]/u)?.[0]
        ?.toUpperCase() || "#";
    this.fillSeriesHead();
    const restoring = this.restorePanel?.seriesId === item.id;
    const fetch = () => this.fetchSeries(item);
    if (restoring) fetch();
    else this.panelTimer = setTimeout(fetch, PANEL_DEBOUNCE_MS);
  },

  fillSeriesHead() {
    const { panel } = this;
    const { item, info } = panel;
    const body = panel.body;
    body.querySelector(".iptv-series-title").textContent = pick(item, info, "name");
    body.querySelector(".iptv-panel-rating").textContent = factsLine(
      item,
      info,
      info?.runTime > 0 ? `${info.runTime} dk` : ""
    );
    const labels = factLabels();
    fillFacts(body.querySelector(".iptv-facts"), [
      [labels.cast, info?.cast, "is-long"],
      [labels.country, info?.country],
      [labels.age, info?.age]
    ]);
    body.querySelector(".iptv-panel-plot").textContent = info?.plot || "";
    const cover = body.querySelector(".iptv-series-cover");
    loadInto(cover, cover.querySelector("img"), pick(item, info, "poster"));
  },

  async fetchSeries(item) {
    this.panelTimer = null;
    const { panel } = this;
    const controller = (panel.controller = new AbortController());
    const status = panel.body.querySelector(".iptv-panel-status");
    try {
      const data = await IptvRepository.getSeriesInfo(this.source.id, item.id, {
        signal: controller.signal
      });
      if (controller.signal.aborted || this.panel !== panel) return;
      panel.info = data.info;
      panel.seasons = (data.seasons || []).filter((season) => season.episodes?.length);
      if (!panel.seasons.length) throw Object.assign(new Error("empty"), { code: "empty" });
    } catch (error) {
      if (controller.signal.aborted || this.panel !== panel) return;
      status.textContent =
        error?.code === "empty" ? t("iptv_no_episodes", "No episodes") : this.messageFor(error);
      return;
    }
    this.fillSeriesHead();
    const { seasons } = panel;
    const watched = (episode) => Boolean(this.progressOf("episode", episode.id)?.watched);
    const saved = this.restorePanel?.seriesId === item.id ? this.restorePanel : null;
    const memo = this.seasonMemo?.get(item.id);
    let at;
    if (saved) at = advancePastWatched(seasons, resolveDetailFocus(seasons, saved), watched);
    else if (memo) at = resolveDetailFocus(seasons, memo);
    else
      at = advancePastWatched(
        seasons,
        pickDefaultEpisode(seasons, (episode) => this.progressOf("episode", episode.id)),
        watched
      );
    this.restorePanel = null;
    this.panelFocus = { zone: DZONE.EPISODES, button: 0, ...at };
    panel.ready = true;
    status.textContent = "";
    this.renderSeasonChips();
    panel.epList = createVirtualList({
      viewport: panel.body.querySelector(".iptv-series-episodes"),
      columns: 1,
      rowHeight: EPISODE_ROW_HEIGHT,
      createNode: createEpisodeNode,
      bindNode: (row, episode, index) => {
        row.dataset.index = String(index);
        row.dataset.iptvEpisode = "1";
        bindEpisode(row, episode, this.progressOf("episode", episode.id));
      }
    });
    this.showSeason();
    // Back from the player inside the panel: keep the remote where it was.
    if (saved?.zone === "panel" && this.focus.zone === ZONE.GRID) {
      this.focus.zone = ZONE.PANEL;
      this.applyFocus();
    } else this.applyPanelFocus();
  },

  renderSeasonChips() {
    const bar = this.panel.body.querySelector(".iptv-series-seasons");
    bar.innerHTML = this.panel.seasons
      .map(
        (season, i) =>
          `<button type="button" class="iptv-chip" data-season="${i}">S${escapeHtml(season.number)}</button>`
      )
      .join("");
  },

  showSeason() {
    const { panel, panelFocus } = this;
    const episodes = panel.seasons[panelFocus.season].episodes;
    const active = this.focus.zone === ZONE.PANEL && panelFocus.zone === DZONE.EPISODES;
    panel.epList.setItems(episodes, {
      focus: active ? panelFocus.episode : -1,
      reveal: panelFocus.episode
    });
    panel.epList.setSelected(panelFocus.episode);
    this.rememberSeries();
    this.applyPanelFocus();
  },

  rememberSeries() {
    const { panel, panelFocus } = this;
    if (panel?.kind !== TAB_SERIES || !panel.ready) return;
    this.seasonMemo ||= new Map();
    const season = panel.seasons[panelFocus.season];
    this.seasonMemo.set(panel.item.id, {
      season: season.number,
      episodeId: season.episodes[panelFocus.episode]?.id || ""
    });
  },

  playEpisode(episode, season) {
    const series = this.panel?.item;
    if (!episode || !series) return;
    this.stopPreview();
    const sourceId = this.source.id;
    const title = episodePlayerTitle(series.name, season.number, episode.number, episode.title);
    Router.navigate("player", {
      itemType: "iptvvod",
      itemId: iptvProgressKey({ sourceId, kind: "episode", streamId: episode.id }),
      playIptv: {
        sourceId,
        kind: "episode",
        streamId: episode.id,
        ext: episode.ext,
        title,
        seriesId: series.id,
        season: season.number,
        episode: episode.number
      },
      title,
      playerTitle: title,
      resumePositionMs: iptvResumePositionMs(this.progressOf("episode", episode.id))
    });
  },

  // Route state: ids only, resolved against fresh data on restore.
  capturePanelState() {
    const { panel, panelFocus } = this;
    if (panel?.kind !== TAB_SERIES || !panel.ready) return null;
    const season = panel.seasons[panelFocus.season];
    return {
      seriesId: panel.item.id,
      season: season.number,
      episodeId: season.episodes[panelFocus.episode]?.id || "",
      zone: this.focus.zone === ZONE.PANEL ? "panel" : "items"
    };
  },

  // ---- Focus + keys ------------------------------------------------------------------
  enterPanel() {
    const { panel } = this;
    const episodes = panel?.kind === TAB_SERIES && panel.epList;
    this.panelFocus.zone = !episodes ? DZONE.BUTTONS : DZONE.EPISODES;
    if (episodes) this.showSeason();
  },

  applyPanelFocus() {
    const { panel, panelFocus } = this;
    if (!panel) return;
    const active = this.focus.zone === ZONE.PANEL;
    this.panelNode.querySelectorAll("[data-panel-action]").forEach((node) => {
      node.classList.toggle("focused", active && panelFocus.zone === DZONE.BUTTONS);
    });
    this.panelNode.querySelectorAll(".iptv-chip").forEach((node, i) => {
      node.classList.toggle("is-selected", i === panelFocus.season);
      const focused = active && panelFocus.zone === DZONE.SEASONS && i === panelFocus.season;
      node.classList.toggle("focused", focused);
      if (focused) node.parentNode.scrollLeft = Math.max(0, node.offsetLeft - 48);
    });
    panel.epList?.setFocus(active && panelFocus.zone === DZONE.EPISODES ? panelFocus.episode : -1);
  },

  onPanelKey(event, code, direction) {
    const { panel, panelFocus } = this;
    const series = panel?.kind === TAB_SERIES;
    const zap = zapDirection(code);
    if (zap) {
      // CH+/CH- (and PageUp/PageDown): next/previous season.
      event.preventDefault?.();
      if (series && panel.ready) this.stepSeason(zap);
      return;
    }
    if (direction) {
      if (!allowDpadRepeat(this, event, { horizontalMs: 80, verticalMs: 80 })) return;
      event.preventDefault?.();
      if (direction === "left" && (panelFocus.zone !== DZONE.SEASONS || panelFocus.season === 0)) {
        this.focus.zone = ZONE.GRID;
        this.applyFocus();
        return;
      }
      const season = panel?.seasons?.[panelFocus.season];
      const result = moveDetailFocus(panelFocus, direction, {
        buttonCount: series ? 0 : 1,
        seasonCount: series ? panel.seasons.length : 0,
        episodeCount: season?.episodes.length || 0
      });
      this.panelFocus = result.focus;
      if (result.seasonChanged) this.showSeason();
      else {
        this.rememberSeries();
        this.applyPanelFocus();
      }
      return;
    }
    if (code === OK) {
      event.preventDefault?.();
      if (!event.repeat) this.activatePanel();
    }
  },

  stepSeason(delta) {
    const { panel, panelFocus } = this;
    const season = clamp(panelFocus.season + delta, 0, panel.seasons.length - 1);
    if (season === panelFocus.season) return;
    this.panelFocus = { ...panelFocus, season, episode: 0 };
    this.showSeason();
  },

  activatePanel() {
    const { panel, panelFocus } = this;
    if (!panel) return;
    if (panel.kind === TAB_LIVE) return this.playChannel(this.activeLive);
    if (panel.kind === TAB_MOVIES) return this.playMovie(this.selectedItem());
    if (panelFocus.zone !== DZONE.EPISODES || !panel.ready) return;
    const season = panel.seasons[panelFocus.season];
    this.playEpisode(season.episodes[panelFocus.episode], season);
  },

  // Magic Remote: true when the target belongs to the panel (and was handled).
  onPanelPointer(target, activate) {
    const { panel } = this;
    if (!panel || !target.closest?.(".iptv-panel")) return false;
    const button = target.closest?.("[data-panel-action]");
    const chip = target.closest?.("[data-season]");
    const row = target.closest?.("[data-iptv-episode]");
    if (button) this.panelFocus = { ...this.panelFocus, zone: DZONE.BUTTONS };
    else if (chip) {
      const season = Number(chip.dataset.season);
      const changed = season !== this.panelFocus.season;
      this.panelFocus = {
        ...this.panelFocus,
        zone: DZONE.SEASONS,
        season,
        episode: changed ? 0 : this.panelFocus.episode
      };
      if (changed) this.showSeason();
    } else if (row)
      this.panelFocus = {
        ...this.panelFocus,
        zone: DZONE.EPISODES,
        episode: Number(row.dataset.index)
      };
    else return true;
    this.focus.zone = ZONE.PANEL;
    this.applyFocus();
    if (activate && !chip) this.activatePanel();
    return true;
  }
};
