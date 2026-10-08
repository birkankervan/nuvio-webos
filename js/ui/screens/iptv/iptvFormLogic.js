// Pure helpers for the IPTV account form: input normalization, validation and
// the mapping from sanitized error codes to user-facing messages.
// Messages carry an i18n key plus an English fallback; the screen resolves them.
// No function here ever receives or returns the password in an error/message.

export const IPTV_ERROR_MESSAGES = Object.freeze({
  auth_failed: ["iptv_error_auth_failed", "Wrong username or password."],
  expired: ["iptv_error_expired", "This subscription has expired."],
  disabled: ["iptv_error_disabled", "This account is disabled."],
  network: ["iptv_error_network", "Could not reach the server. Check the address and your connection."],
  timeout: ["iptv_error_timeout", "The server took too long to respond."],
  too_large: ["iptv_error_too_large", "The channel list is too large to load."],
  bad_response: ["iptv_error_bad_response", "The server answered in an unexpected way. Check the address."],
  not_found: ["iptv_error_not_found", "This source no longer exists."],
  too_many_sources: ["iptv_error_too_many_sources", "Too many sources saved. Remove one first."],
  invalid_server: ["iptv_error_invalid_server", "Enter a valid server address."],
  missing_fields: ["iptv_error_missing_fields", "Fill in server, username and password."]
});

const GENERIC = ["iptv_error_generic", "Something went wrong. Try again."];

export function iptvErrorMessage(error) {
  const code = typeof error === "string" ? error : error?.code;
  const [key, fallback] = IPTV_ERROR_MESSAGES[code] || GENERIC;
  return { key, fallback };
}

// TV users rarely type the scheme; assume http when it is missing.
export function withServerScheme(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
}

// normalizeServer is injected (normalizeIptvServer) to keep this module data-layer free.
export function validateAccountInput(values, normalizeServer) {
  const username = String(values?.username ?? "").trim();
  const password = String(values?.password ?? "");
  const rawServer = String(values?.server ?? "").trim();
  if (!rawServer || !username || !password) return { ok: false, errorCode: "missing_fields" };
  const server = normalizeServer(withServerScheme(rawServer));
  if (!server) return { ok: false, errorCode: "invalid_server" };
  return { ok: true, values: { server, username, password, showAdult: values?.showAdult === true } };
}
