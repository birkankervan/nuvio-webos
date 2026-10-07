import { I18n } from "../../../i18n/index.js";

// i18n keys for IPTV are added by root later; until then the English fallback shows.
export function t(key, fallback, params = {}) {
  return I18n.t(key, params, { fallback });
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
