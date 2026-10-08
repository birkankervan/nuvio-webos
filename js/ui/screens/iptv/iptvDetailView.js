import { Router } from "../../navigation/routerState.js";
import { IptvRepository } from "../../../data/repository/iptvRepository.js";
import { IptvProgressStore, iptvProgressKey } from "../../../data/local/iptvProgressStore.js";
import { createVirtualList } from "./iptvVirtualList.js";
import { createPosterCardNode, bindPosterCard } from "./iptvPosterCards.js";
import {
  DZONE,
  captureDetailState,
  formatClock,
  formatReleaseDate,
  movieActions,
  moveDetailFocus,
  plotSizeClass,
  pickDefaultEpisode,
  progressRatio,
  releaseYear,
  resolveDetailFocus,
  seasonLabel
} from "./iptvDetail.js";
import { escapeHtml, t } from "./iptvText.js";
import { I18n } from "../../../i18n/index.js";

const EPISODE_ROW_HEIGHT = 168;
const MIN_THUMB_PX = 8;
const OK = 13;
const KEYS = { 37: "left", 38: "up", 39: "right", 40: "down" };

const minutes = (secs) => (secs > 0 ? t("iptv_min_short", `${Math.round(secs / 60)} dk`, { n: Math.round(secs / 60) }) : "");
const seasonName = (season) => seasonLabel(season, (n) => t("iptv_season_n", `Sezon ${n}`, { n }));

function createEpisodeNode() {
  const node = document.createElement("div");
  node.className = "iptv-ep";
  node.innerHTML =
    '<div class="iptv-ep-box"><div class="iptv-ep-thumb"><span class="iptv-ep-initial"></span><img class="iptv-ep-img" alt="" decoding="async"></div>' +
    '<div class="iptv-ep-text"><div class="iptv-ep-title"></div><div class="iptv-ep-meta"></div><div class="iptv-ep-plot"></div></div>' +
    '<div class="iptv-ep-bar"><div class="iptv-ep-fill"></div></div></div>';
  const img = node.querySelector("img");
  img.onload = () => {
    if (img.getAttribute("src") === img._src && img.naturalWidth >= MIN_THUMB_PX) node.classList.add("has-thumb");
  };
  img.onerror = () => node.classList.remove("has-thumb");
  node._parts = {
    initial: node.querySelector(".iptv-ep-initial"),
    img,
    title: node.querySelector(".iptv-ep-title"),
    meta: node.querySelector(".iptv-ep-meta"),
    plot: node.querySelector(".iptv-ep-plot"),
    bar: node.querySelector(".iptv-ep-bar"),
    fill: node.querySelector(".iptv-ep-fill")
  };
  return node;
}

function bindEpisode(node, episode, progress) {
  const { initial, img, title, meta, plot, bar, fill } = node._parts;
  initial.textContent = episode.number;
  title.textContent = `${t("iptv_episode_short", `B${episode.number}`, { n: episode.number })} · ${episode.title}`;
  meta.textContent = minutes(episode.durationSecs);
  plot.textContent = episode.plot || "";
  const ratio = progressRatio(progress);
  bar.hidden = !ratio;
  fill.style.width = `${Math.round(ratio * 100)}%`;
  if (img._src !== episode.image) {
    img._src = episode.image;
    node.classList.remove("has-thumb");
    img.removeAttribute("src");
    if (episode.image) img.src = episode.image;
  }
}

// Movie / series detail inside the IPTV screen. State lives in `this.detail`
// (logical focus only); the DOM overlay mirrors it. Mixed into IptvScreen.
export const iptvDetailMethods = {
  progressOf(kind, id) {
    const detail = this.detail;
    if (!detail.progress.has(id)) {
      detail.progress.set(id, IptvProgressStore.get(iptvProgressKey({ sourceId: this.source.id, kind, streamId: id })));
    }
    return detail.progress.get(id);
  },

  // saved: captureDetailState() result when returning from the player.
  async openDetail(kind, item, saved = null) {
    if (!item) return;
    this.closeDetail();
    const series = kind === "series";
    const controller = new AbortController();
    const detail = (this.detail = {
      kind,
      item,
      info: null,
      seasons: [],
      progress: new Map(),
      controller,
      focus: { zone: series ? DZONE.EPISODES : DZONE.BUTTONS, button: 0, season: 0, episode: 0 }
    });
    const node = (detail.node = document.createElement("div"));
    node.className = "iptv-detail";
    this.container.querySelector(".iptv-main")?.appendChild(node);
    this.renderDetail();
    try {
      if (series) {
        const data = await IptvRepository.getSeriesInfo(this.source.id, item.id, { signal: controller.signal });
        if (this.detail !== detail) return;
        detail.info = data.info;
        detail.seasons = (data.seasons || []).filter((season) => season.episodes?.length);
        if (!detail.seasons.length) throw Object.assign(new Error("empty"), { code: "not_found" });
        const at = saved
          ? resolveDetailFocus(detail.seasons, saved)
          : pickDefaultEpisode(detail.seasons, (episode) => this.progressOf("episode", episode.id));
        detail.focus = { ...detail.focus, ...at };
      } else {
        // A failed info call still leaves Play usable with the list data.
        detail.info = await IptvRepository.getVodInfo(this.source.id, item.id, { signal: controller.signal }).catch(() => null);
        if (this.detail !== detail) return;
      }
    } catch (error) {
      if (this.detail !== detail || error?.code === "aborted") return;
      detail.error = this.messageFor(error);
    }
    detail.ready = true;
    this.renderDetail();
  },

  closeDetail() {
    const detail = this.detail;
    if (!detail) return false;
    this.detail = null;
    detail.controller.abort();
    detail.epList?.destroy();
    detail.node.remove();
    return true;
  },

  captureDetailState() {
    return captureDetailState(this.detail);
  },

  detailActions() {
    const { detail } = this;
    if (detail.kind !== "movie" || !detail.ready) return [];
    const progress = this.progressOf("movie", detail.item.id);
    return movieActions(progress).map((entry) => ({
      ...entry,
      label:
        entry.action === "resume"
          ? t("iptv_detail_resume", `Devam et (${formatClock(entry.posMs)})`, { time: formatClock(entry.posMs) })
          : entry.action === "restart"
            ? t("iptv_detail_restart", "Baştan oynat")
            : t("iptv_detail_play", "Oynat")
    }));
  },

  renderDetail() {
    const { detail } = this;
    const { node, item, info, kind } = detail;
    detail.epList?.destroy();
    detail.epList = null;
    const meta = { ...item, ...info };
    const facts = [
      releaseYear(meta.releaseDate),
      meta.rating > 0 ? `★ ${Number(meta.rating).toFixed(1)}` : "",
      kind === "movie" ? minutes(meta.durationSecs) : "",
      meta.genre
    ].filter(Boolean);
    const crew = [
      meta.director && t("iptv_detail_director", `Yönetmen: ${meta.director}`, { v: meta.director }),
      meta.cast && t("iptv_detail_cast", `Oyuncular: ${meta.cast}`, { v: meta.cast })
    ].filter(Boolean);
    const rows =
      kind === "movie"
        ? [
            [t("iptv_detail_label_director", "Yönetmen"), meta.director],
            [t("iptv_detail_label_cast", "Oyuncular"), meta.cast, "is-cast"],
            [t("iptv_detail_label_genre", "Tür"), meta.genre],
            [t("iptv_detail_label_duration", "Süre"), minutes(meta.durationSecs)],
            [t("iptv_detail_label_release", "Çıkış tarihi"), formatReleaseDate(meta.releaseDate, I18n.getLocale() || "tr-TR")]
          ].filter((row) => row[1])
        : [];
    const actions = this.detailActions();
    const progress = kind === "movie" ? this.progressOf("movie", item.id) : null;
    detail.actions = actions;
    node.className = `iptv-detail is-${kind}`;
    node.innerHTML = `
      <img class="iptv-detail-backdrop" alt="" hidden>
      <div class="iptv-detail-shade"></div>
      <div class="iptv-detail-head">
        <div class="iptv-detail-info">
          <h2 class="iptv-detail-title">${escapeHtml(meta.name || item.name)}</h2>
          <div class="iptv-detail-facts">${escapeHtml(facts.join(" · "))}</div>
          <p class="iptv-detail-plot ${plotSizeClass(meta.plot)}">${escapeHtml(meta.plot || "")}</p>
          <div class="iptv-detail-crew">${escapeHtml(kind === "movie" ? "" : crew.join("   "))}</div>
          <div class="iptv-detail-actions">${actions
            .map((a, i) => {
              const ratio = a.action === "resume" ? progressRatio(progress) : 0;
              const bar = ratio ? `<span class="iptv-btn-bar"><span style="width:${Math.round(ratio * 100)}%"></span></span>` : "";
              return `<button type="button" class="iptv-btn iptv-btn-hero${i === 0 ? " iptv-btn-primary" : ""}" data-detail-action="${a.action}" data-i="${i}">${i === 0 ? '<span class="iptv-btn-icon">&#9654;</span>' : ""}${escapeHtml(a.label)}${bar}</button>`;
            })
            .join("")}</div>
        </div>
        <div class="iptv-detail-side">
          <div class="iptv-detail-poster-slot"></div>
          <dl class="iptv-detail-facts-list">${rows
            .map(([label, value, cls]) => `<div class="iptv-detail-row ${cls || ""}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
            .join("")}</dl>
        </div>
      </div>
      ${kind === "series" ? '<div class="iptv-detail-seasons"></div><div class="iptv-detail-episodes"></div>' : ""}
      <div class="iptv-detail-status" ${detail.ready && !detail.error ? "hidden" : ""}></div>`;
    const backdrop = node.querySelector(".iptv-detail-backdrop");
    // Apple TV style: backdrop hero; the poster is only shown when there is none.
    if (kind === "movie") this.mountDetailPoster(meta);
    if (meta.backdrop) {
      node.classList.add("has-backdrop");
      backdrop.onload = () => (backdrop.hidden = false);
      backdrop.onerror = () => {
        backdrop.remove();
        node.classList.remove("has-backdrop");
        this.mountDetailPoster(meta);
      };
      backdrop.src = meta.backdrop;
    } else this.mountDetailPoster(meta);
    const status = node.querySelector(".iptv-detail-status");
    if (detail.error) status.textContent = detail.error;
    else if (!detail.ready) status.textContent = t("iptv_loading_vod", "Yükleniyor...");
    if (kind === "series" && detail.ready && !detail.error) this.renderSeasons();
    this.applyDetailFocus();
  },

  mountDetailPoster(meta) {
    const { node, item } = this.detail;
    const slot = node.querySelector(".iptv-detail-poster-slot");
    if (!slot || slot.firstChild || !(meta.poster || item.poster)) return;
    const poster = createPosterCardNode();
    bindPosterCard(poster, { ...meta, id: item.id, poster: meta.poster || item.poster });
    delete poster.dataset.iptvCard;
    poster.classList.add("iptv-detail-poster");
    slot.appendChild(poster);
  },

  renderSeasons() {
    const { detail } = this;
    const bar = detail.node.querySelector(".iptv-detail-seasons");
    bar.innerHTML = detail.seasons
      .map((season, i) => `<button type="button" class="iptv-chip" data-season="${i}">${escapeHtml(seasonName(season))}</button>`)
      .join("");
    detail.epList = createVirtualList({
      viewport: detail.node.querySelector(".iptv-detail-episodes"),
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
  },

  showSeason() {
    const { detail } = this;
    const { zone, season, episode } = detail.focus;
    const episodes = detail.seasons[season].episodes;
    detail.epList.setItems(episodes, { focus: zone === DZONE.EPISODES ? episode : -1, reveal: episode });
  },

  applyDetailFocus() {
    const { detail } = this;
    if (!detail) return;
    const { zone, button, season, episode } = detail.focus;
    detail.node.querySelectorAll("[data-detail-action]").forEach((node, i) => node.classList.toggle("focused", zone === DZONE.BUTTONS && i === button));
    detail.node.querySelectorAll(".iptv-chip").forEach((node, i) => {
      node.classList.toggle("is-selected", i === season);
      node.classList.toggle("focused", zone === DZONE.SEASONS && i === season);
      if (zone === DZONE.SEASONS && i === season) node.parentNode.scrollLeft = node.offsetLeft - 48;
    });
    detail.epList?.setFocus(zone === DZONE.EPISODES ? episode : -1);
    // Blur the search field / header node so keys reach the detail.
    this.setManualFocus?.(null);
  },

  onDetailKey(event) {
    const { detail } = this;
    const code = Number(event?.keyCode || 0);
    const direction = KEYS[code];
    if (direction) {
      event.preventDefault?.();
      const season = detail.seasons[detail.focus.season];
      const result = moveDetailFocus(detail.focus, direction, {
        buttonCount: detail.actions?.length || 0,
        seasonCount: detail.seasons.length,
        episodeCount: season?.episodes.length || 0
      });
      detail.focus = result.focus;
      if (result.seasonChanged) this.showSeason();
      this.applyDetailFocus();
    } else if (code === OK) {
      event.preventDefault?.();
      if (!event.repeat) this.activateDetail();
    }
  },

  activateDetail() {
    const { detail } = this;
    if (!detail.ready) return;
    const { zone, button, season, episode } = detail.focus;
    if (zone === DZONE.BUTTONS) return this.playDetailMovie(detail.actions[button]);
    if (zone === DZONE.EPISODES) return this.playEpisode(detail.seasons[season].episodes[episode], detail.seasons[season]);
  },

  playDetailMovie(action) {
    const { item } = this.detail;
    const sourceId = this.source.id;
    Router.navigate("player", {
      itemType: "iptvvod",
      itemId: iptvProgressKey({ sourceId, kind: "movie", streamId: item.id }),
      playIptv: { sourceId, kind: "movie", streamId: item.id, ext: item.ext || this.detail.info?.ext, title: item.name },
      title: item.name,
      playerTitle: item.name,
      resumePositionMs: action?.posMs || 0
    });
  },

  playEpisode(episode, season) {
    if (!episode) return;
    const { item } = this.detail;
    const sourceId = this.source.id;
    const title = `${item.name} · ${seasonName(season)} B${episode.number}`;
    Router.navigate("player", {
      itemType: "iptvvod",
      itemId: iptvProgressKey({ sourceId, kind: "episode", streamId: episode.id }),
      playIptv: { sourceId, kind: "episode", streamId: episode.id, ext: episode.ext, title, seriesId: item.id, season: season.number, episode: episode.number },
      title,
      playerTitle: title,
      resumePositionMs: this.progressOf("episode", episode.id)?.posMs || 0
    });
  },

  // Magic Remote: returns true when the click was handled by the detail view.
  onDetailPointer(target, activate) {
    const { detail } = this;
    if (!target.closest?.(".iptv-detail")) return false;
    const button = target.closest?.("[data-detail-action]");
    const chip = target.closest?.("[data-season]");
    const row = target.closest?.("[data-iptv-episode]");
    if (button) detail.focus = { ...detail.focus, zone: DZONE.BUTTONS, button: Number(button.dataset.i) };
    else if (chip) {
      const season = Number(chip.dataset.season);
      const changed = season !== detail.focus.season;
      detail.focus = { ...detail.focus, zone: DZONE.SEASONS, season, episode: changed ? 0 : detail.focus.episode };
      if (changed) this.showSeason();
    } else if (row) detail.focus = { ...detail.focus, zone: DZONE.EPISODES, episode: Number(row.dataset.index) };
    else return true;
    this.applyDetailFocus();
    if (activate && !chip) this.activateDetail();
    return true;
  }
};

