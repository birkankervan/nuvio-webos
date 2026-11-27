// Pure logic of the IPTV detail view (movie / series). No DOM, no storage:
// callers pass progress lookups so everything here is unit-testable.

export const DZONE = Object.freeze({
  BUTTONS: "buttons",
  SEASONS: "seasons",
  EPISODES: "episodes"
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000) || 0);
  const h = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(total % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Provider names are English ("Season 3"); localize those, keep custom names.
export function seasonLabel(season, format) {
  const name = String(season?.name || "").trim();
  return !name || /^season\s*\d+$/i.test(name) ? format(season?.number) : name;
}

// Movie buttons: resume + restart when progress exists, else a single play.
export function movieActions(progress) {
  return progress?.posMs > 0
    ? [
        { action: "resume", posMs: progress.posMs },
        { action: "restart", posMs: 0 }
      ]
    : [{ action: "play", posMs: 0 }];
}

export const progressRatio = (progress) =>
  progress?.durMs > 0 ? clamp(progress.posMs / progress.durMs, 0, 1) : 0;

// Default series focus: the episode with the latest progress (same season
// first episode with progress); else season 0 / episode 0.
// getProgress(episode) -> {posMs, updatedAt} | null
export function pickDefaultEpisode(seasons, getProgress) {
  let best = null;
  seasons.forEach((season, s) => {
    season.episodes.forEach((episode, e) => {
      const progress = getProgress(episode);
      if (!progress) return;
      const at = Number(progress.updatedAt) || 0;
      if (!best || at > best.at) best = { at, season: s, episode: e };
    });
  });
  if (!best) return { season: 0, episode: 0 };
  // Several episodes of that season may have progress: take the first.
  const first = seasons[best.season].episodes.findIndex((episode) => getProgress(episode));
  return { season: best.season, episode: Math.max(0, first) };
}

export function releaseYear(value) {
  return String(value || "").match(/\b(19|20)\d{2}\b/)?.[0] || "";
}

// Provider dates are ISO "2024-11-11" (or just a year); show them localized.
// Anything else is returned unchanged.
export function formatReleaseDate(value, locale = "tr-TR") {
  const text = String(value || "").trim();
  const full = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (full) {
    const [, y, m, d] = full.map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }
  return /^\d{4}$/.test(text) ? text : value;
}

// Route state: ids only, resolved back against fresh data on restore.
export function captureDetailState(detail) {
  if (!detail) return null;
  const season = detail.seasons?.[detail.focus.season];
  return {
    kind: detail.kind,
    item: detail.item,
    season: season ? season.number : 0,
    episodeId: season?.episodes[detail.focus.episode]?.id || ""
  };
}

export function resolveDetailFocus(seasons, saved) {
  let s = seasons.findIndex((season) => season.number === saved?.season);
  if (s < 0) return { season: 0, episode: 0 };
  const e = seasons[s].episodes.findIndex((episode) => episode.id === saved.episodeId);
  return { season: s, episode: Math.max(0, e) };
}

// ctx: { buttonCount, seasonCount, episodeCount }. -> { focus, seasonChanged }
export function moveDetailFocus(focus, direction, ctx) {
  const { buttonCount = 0, seasonCount = 0, episodeCount = 0 } = ctx;
  const to = (patch, seasonChanged = false) => ({ focus: { ...focus, ...patch }, seasonChanged });
  switch (focus.zone) {
    case DZONE.BUTTONS:
      if (direction === "left") return to({ button: clamp(focus.button - 1, 0, buttonCount - 1) });
      if (direction === "right") return to({ button: clamp(focus.button + 1, 0, buttonCount - 1) });
      if (direction === "down" && seasonCount) return to({ zone: DZONE.SEASONS });
      break;
    case DZONE.SEASONS: {
      const delta = direction === "left" ? -1 : direction === "right" ? 1 : 0;
      if (delta) {
        const season = clamp(focus.season + delta, 0, seasonCount - 1);
        return season === focus.season ? to({}) : to({ season, episode: 0 }, true);
      }
      if (direction === "up" && buttonCount) return to({ zone: DZONE.BUTTONS });
      if (direction === "down" && episodeCount) return to({ zone: DZONE.EPISODES });
      break;
    }
    case DZONE.EPISODES:
      if (direction === "down")
        return to({ episode: clamp(focus.episode + 1, 0, episodeCount - 1) });
      if (direction === "up") {
        if (focus.episode > 0) return to({ episode: focus.episode - 1 });
        if (seasonCount) return to({ zone: DZONE.SEASONS });
      }
      break;
    default:
  }
  return to({});
}

// Plot font step by character count (no layout measuring): long plots shrink
// instead of being clipped.
export function plotSizeClass(text) {
  const n = String(text || "").length;
  return n > 1700 ? "plot-xs" : n > 1100 ? "plot-sm" : n > 700 ? "plot-md" : "plot-lg";
}

// ---- Right-panel helpers (macOS parity) -------------------------------------

const pad2 = (n) => String(Math.max(0, Math.trunc(Number(n) || 0))).padStart(2, "0");

// "<Series> · S01E02 · <Episode title>"; the title part is dropped when empty or
// when it only repeats the series name.
export function episodePlayerTitle(seriesName, seasonNumber, episodeNumber, episodeTitle) {
  const series = String(seriesName || "").trim();
  const title = String(episodeTitle || "").trim();
  const parts = [series, `S${pad2(seasonNumber)}E${pad2(episodeNumber)}`];
  if (title && title.toLowerCase() !== series.toLowerCase()) parts.push(title);
  return parts.filter(Boolean).join(" · ");
}

// "45m" under an hour, "1:05" from an hour up; "" when unknown.
export function formatEpisodeDuration(secs) {
  const total = Math.round(Number(secs) / 60);
  if (!(total > 0)) return "";
  return total < 60 ? `${total}m` : `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}

// Episode after (seasonIndex, episodeIndex), crossing into the next season.
// null at the very end.
export function pickNextEpisode(seasons, seasonIndex, episodeIndex) {
  const season = seasons[seasonIndex];
  if (!season) return null;
  if (episodeIndex + 1 < season.episodes.length)
    return { season: seasonIndex, episode: episodeIndex + 1 };
  for (let s = seasonIndex + 1; s < seasons.length; s += 1)
    if (seasons[s].episodes.length) return { season: s, episode: 0 };
  return null;
}

// Back from a finished episode the selection moves on (no autoplay).
// isWatched(episode) -> boolean.
export function advancePastWatched(seasons, at, isWatched) {
  const episode = seasons[at.season]?.episodes[at.episode];
  if (!episode || !isWatched(episode)) return at;
  return pickNextEpisode(seasons, at.season, at.episode) || at;
}

// HH:mm (24h, local time) for EPG ranges.
export function formatClockTime(ms) {
  const date = new Date(ms);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
