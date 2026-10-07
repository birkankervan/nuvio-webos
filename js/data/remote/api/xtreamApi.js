import { httpRequest } from "../../../core/network/httpClient.js";

export const XTREAM_TIMEOUT_MS = 15_000;
export const XTREAM_MAX_BODY_BYTES = 20 * 1024 * 1024;
export const XTREAM_MAX_CHANNELS = 50_000;

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

async function requestJson(source, params, { signal, timeoutMs = XTREAM_TIMEOUT_MS } = {}) {
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

  resolvePlaybackUrl
};
