import { httpRequest } from "../../../core/network/httpClient.js";

export const XTREAM_TIMEOUT_MS = 15_000;
export const XTREAM_MAX_BODY_BYTES = 20 * 1024 * 1024;
export const XTREAM_MAX_CHANNELS = 50_000;
export const XTREAM_MAX_VOD = 100_000;
const RETRY_DELAYS_MS = [500, 1500];

// Sanitized error boundary: never carries a URL, credential or response body.
export class IptvError extends Error {
  constructor(code, status) {
    super(`iptv:${code}`);
    this.name = "IptvError";
    this.code = code;
    if (status) this.status = status;
  }
}

// --- Pure normalizers (no DOM/global access; Worker-portable) ---------------

function text(value) {
  return String(value ?? "").trim();
}

function httpUrlOrEmpty(value) {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : "";
}

export function normalizeCategories(raw) {
  if (!Array.isArray(raw)) throw new IptvError("bad_response");
  const seen = new Set();
  const categories = [];
  for (const item of raw) {
    const id = text(item?.category_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    categories.push({ id, name: text(item.category_name) || id, order: categories.length });
  }
  return categories;
}

export function normalizeChannels(raw, sourceId, { limit = XTREAM_MAX_CHANNELS } = {}) {
  if (!Array.isArray(raw)) throw new IptvError("bad_response");
  const seen = new Set();
  const channels = [];
  for (const item of raw) {
    const streamId = text(item?.stream_id);
    const type = text(item?.stream_type).toLowerCase();
    // The live action only returns live items; an absent type is accepted.
    if (!/^[\w-]+$/.test(streamId) || (type && type !== "live") || seen.has(streamId)) continue;
    seen.add(streamId);
    if (seen.size > limit) throw new IptvError("too_large");
    const number = Number(item.num);
    channels.push({
      id: `${sourceId}:${streamId}`,
      sourceId,
      streamId,
      name: text(item.name) || streamId,
      number: Number.isFinite(number) ? Math.trunc(number) : null,
      categoryId: text(item.category_id),
      logo: httpUrlOrEmpty(item.stream_icon),
      epgId: text(item.epg_channel_id),
      archive: Number(item.tv_archive) === 1
    });
  }
  return channels;
}

// --- VOD / series (slim list items; plot/cast/backdrop only come from info) ---

function posterUrl(value) {
  const url = httpUrlOrEmpty(value);
  // tmdb serves any size; w342 is ~3x smaller than the provider's w600_and_h900.
  return url.replace(/^(https?:\/\/image\.tmdb\.org\/t\/p\/)[^/]+(\/)/i, "$1w342$2");
}

function extOrDefault(value) {
  const ext = text(value).toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "mp4";
}

function numberOrNull(value) {
  const number = Number(value);
  return text(value) !== "" && Number.isFinite(number) ? number : null;
}

function normalizeMedia(raw, idKey, mapItem, limit) {
  if (!Array.isArray(raw)) throw new IptvError("bad_response");
  const seen = new Set();
  const items = [];
  for (const item of raw) {
    const id = text(item?.[idKey]);
    if (!/^[\w-]+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    if (seen.size > limit) throw new IptvError("too_large");
    items.push({ id, name: text(item.name) || id, categoryId: text(item.category_id), ...mapItem(item) });
  }
  return items;
}

export function normalizeVodStreams(raw, { limit = XTREAM_MAX_VOD } = {}) {
  return normalizeMedia(raw, "stream_id", (item) => ({
    ext: extOrDefault(item.container_extension),
    rating: numberOrNull(item.rating),
    added: Number(item.added) || 0,
    poster: posterUrl(item.stream_icon)
  }), limit);
}

export function normalizeSeries(raw, { limit = XTREAM_MAX_VOD } = {}) {
  return normalizeMedia(raw, "series_id", (item) => ({
    rating: numberOrNull(item.rating),
    poster: posterUrl(item.cover)
  }), limit);
}

const firstOf = (value) => (Array.isArray(value) ? value[0] : value);

export function normalizeVodInfo(raw) {
  const info = raw?.info;
  if (!info || typeof info !== "object") throw new IptvError("bad_response");
  return {
    name: text(info.name ?? raw.movie_data?.name),
    plot: text(info.plot ?? info.description),
    genre: text(info.genre),
    cast: text(info.cast ?? info.actors),
    director: text(info.director),
    releaseDate: text(info.releasedate ?? info.release_date),
    rating: numberOrNull(info.rating),
    durationSecs: Number(info.duration_secs) || 0,
    poster: posterUrl(info.movie_image ?? info.cover_big),
    backdrop: httpUrlOrEmpty(firstOf(info.backdrop_path)),
    ext: extOrDefault(raw.movie_data?.container_extension)
  };
}

export function normalizeSeriesInfo(raw) {
  const info = raw?.info;
  if (!info || typeof info !== "object" || !raw.episodes || typeof raw.episodes !== "object") {
    throw new IptvError("bad_response");
  }
  const names = new Map();
  for (const season of Array.isArray(raw.seasons) ? raw.seasons : []) {
    names.set(Number(season?.season_number), text(season?.name));
  }
  const bySeason = new Map();
  const seen = new Set();
  for (const [key, list] of Object.entries(raw.episodes)) {
    for (const ep of Array.isArray(list) ? list : []) {
      const id = text(ep?.id);
      if (!/^[\w-]+$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      const number = Number(ep.season ?? key);
      if (!Number.isFinite(number)) continue;
      const episodes = bySeason.get(number) || [];
      bySeason.set(number, episodes);
      episodes.push({
        id,
        number: Number(ep.episode_num) || 0,
        title: text(ep.title) || id,
        ext: extOrDefault(ep.container_extension),
        durationSecs: Number(ep.info?.duration_secs) || 0,
        plot: text(ep.info?.plot),
        image: posterUrl(ep.info?.movie_image)
      });
    }
  }
  const seasons = [...bySeason]
    .sort((a, b) => a[0] - b[0])
    .map(([number, episodes]) => ({
      number,
      name: names.get(number) || `Season ${number}`,
      episodes: episodes.sort((a, b) => a.number - b.number)
    }));
  return {
    info: {
      name: text(info.name),
      plot: text(info.plot),
      genre: text(info.genre),
      cast: text(info.cast),
      releaseDate: text(info.releaseDate ?? info.releasedate),
      rating: numberOrNull(info.rating),
      poster: posterUrl(info.cover),
      backdrop: httpUrlOrEmpty(firstOf(info.backdrop_path))
    },
    seasons
  };
}

export function normalizeAccount(raw, now = Date.now()) {
  const info = raw?.user_info;
  if (!info || typeof info !== "object") throw new IptvError("bad_response");
  if (Number(info.auth) !== 1 && info.auth !== true) throw new IptvError("auth_failed");
  const status = text(info.status);
  if (status && status.toLowerCase() !== "active") {
    throw new IptvError(status.toLowerCase() === "expired" ? "expired" : "disabled");
  }
  const expDate = Number(info.exp_date);
  if (Number.isFinite(expDate) && expDate > 0 && expDate * 1000 < now) {
    throw new IptvError("expired");
  }
  const maxConnections = Number(info.max_connections);
  const formats = Array.isArray(info.allowed_output_formats) ? info.allowed_output_formats : [];
  return {
    status: status || "Active",
    expDate: Number.isFinite(expDate) && expDate > 0 ? expDate : null,
    maxConnections: Number.isFinite(maxConnections) && maxConnections > 0 ? maxConnections : null,
    allowedFormats: formats.map((format) => text(format).toLowerCase()).filter(Boolean),
    timezone: text(raw?.server_info?.timezone)
  };
}

// In-memory only: the result must never be stored, routed or logged.
export function resolvePlaybackUrl(source, channel, allowedFormats) {
  if (!source || !channel || channel.sourceId !== source.id) {
    throw new IptvError("bad_response");
  }
  const formats = (allowedFormats ?? source.lastAccount?.allowedFormats ?? []).map((format) => text(format).toLowerCase());
  // HLS by default: webOS plays a progressive live .ts as a finite file and
  // fires "ended" after a few seconds. Use ts only when the account has no HLS.
  const ext = formats.length && !formats.includes("m3u8") && formats.includes("ts") ? "ts" : "m3u8";
  return `${source.server}/live/${encodeURIComponent(source.username)}/${encodeURIComponent(source.password)}/${encodeURIComponent(channel.streamId)}.${ext}`;
}

// In-memory only, like resolvePlaybackUrl. kind: "movie" | "episode".
export function resolveVodUrl(source, kind, id, ext) {
  const dir = kind === "movie" ? "movie" : kind === "episode" ? "series" : "";
  if (!source || !dir || !/^[\w-]+$/.test(text(id))) throw new IptvError("bad_response");
  return `${source.server}/${dir}/${encodeURIComponent(source.username)}/${encodeURIComponent(source.password)}/${encodeURIComponent(id)}.${extOrDefault(ext)}`;
}

// --- Transport ---------------------------------------------------------------

function mapFailure(error, state) {
  if (error instanceof IptvError) return error;
  if (state.timedOut) return new IptvError("timeout");
  if (state.callerSignal?.aborted || error?.name === "AbortError") return new IptvError("aborted");
  if (error?.code === "REQUEST_TIMEOUT" || error?.name === "TimeoutError") {
    return new IptvError("timeout");
  }
  const status = Number(error?.status) || 0;
  if (status === 401) return new IptvError("auth_failed", status);
  if (status === 403) return new IptvError("disabled", status);
  return new IptvError("network", status);
}

async function readLimitedText(response, state) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > XTREAM_MAX_BODY_BYTES) {
    throw new IptvError("too_large");
  }
  const reader = response.body?.getReader?.();
  if (!reader) {
    const whole = await response.text();
    if (whole.length > XTREAM_MAX_BODY_BYTES) throw new IptvError("too_large");
    return whole;
  }
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  try {
    for (;;) {
      if (state.controller.signal.aborted) throw new IptvError("aborted");
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > XTREAM_MAX_BODY_BYTES) throw new IptvError("too_large");
      out += decoder.decode(value, { stream: true });
    }
    return out + decoder.decode();
  } catch (error) {
    reader.cancel?.().catch?.(() => {});
    throw error;
  }
}

async function requestOnce(source, params, { signal, timeoutMs = XTREAM_TIMEOUT_MS } = {}) {
  const query = new URLSearchParams({
    username: source.username,
    password: source.password,
    ...params
  });
  const controller = new AbortController();
  const state = { controller, callerSignal: signal, timedOut: false };
  const onAbort = () => controller.abort();
  if (signal?.aborted) throw new IptvError("aborted");
  signal?.addEventListener?.("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await httpRequest(`${source.server}/player_api.php?${query}`, {
      includeSessionAuth: false,
      credentials: "omit",
      responseType: "response",
      timeoutMs: 0,
      signal: controller.signal
    });
    const body = await readLimitedText(response, state);
    try {
      return JSON.parse(body);
    } catch (_error) {
      throw new IptvError("bad_response");
    }
  } catch (error) {
    throw mapFailure(error, state);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

const waitMs = (ms, signal) =>
  new Promise((resolve, reject) => {
    const done = () => {
      signal?.removeEventListener?.("abort", stop);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const stop = () => {
      clearTimeout(timer);
      reject(new IptvError("aborted"));
    };
    signal?.addEventListener?.("abort", stop, { once: true });
  });

// Heavy endpoints answer 5xx (520) or stall now and then: retry those only.
async function requestJson(source, params, options = {}) {
  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestOnce(source, params, options);
    } catch (error) {
      const retryable = error.code === "timeout" || (error.code === "network" && error.status >= 500);
      if (!retryable || attempt >= delays.length) throw error;
      await waitMs(delays[attempt], options.signal);
    }
  }
}

const withCategory = (action, categoryId) => ({
  action,
  ...(categoryId != null && categoryId !== "" ? { category_id: String(categoryId) } : {})
});

export const XtreamApi = {
  async authenticate(source, options = {}) {
    return normalizeAccount(await requestJson(source, {}, options), options.now);
  },

  async getLiveCategories(source, options = {}) {
    return normalizeCategories(
      await requestJson(source, { action: "get_live_categories" }, options)
    );
  },

  async getLiveStreams(source, options = {}) {
    const { categoryId } = options;
    const params = { action: "get_live_streams" };
    if (categoryId != null && categoryId !== "") params.category_id = String(categoryId);
    return normalizeChannels(await requestJson(source, params, options), source.id);
  },

  async getVodCategories(source, options = {}) {
    return normalizeCategories(await requestJson(source, { action: "get_vod_categories" }, options));
  },

  async getVodStreams(source, options = {}) {
    return normalizeVodStreams(await requestJson(source, withCategory("get_vod_streams", options.categoryId), options));
  },

  async getSeriesCategories(source, options = {}) {
    return normalizeCategories(await requestJson(source, { action: "get_series_categories" }, options));
  },

  async getSeries(source, options = {}) {
    return normalizeSeries(await requestJson(source, withCategory("get_series", options.categoryId), options));
  },

  async getVodInfo(source, vodId, options = {}) {
    return normalizeVodInfo(await requestJson(source, { action: "get_vod_info", vod_id: String(vodId) }, options));
  },

  async getSeriesInfo(source, seriesId, options = {}) {
    return normalizeSeriesInfo(await requestJson(source, { action: "get_series_info", series_id: String(seriesId) }, options));
  },

  resolvePlaybackUrl,
  resolveVodUrl
};
