import test from "node:test";
import assert from "node:assert/strict";
import { iptvErrorMessage, validateAccountInput, withServerScheme, IPTV_ERROR_MESSAGES } from "./iptvFormLogic.js";

const normalize = (value) => {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.origin : "";
  } catch (_) {
    return "";
  }
};

test("every Xtream error code has a distinct message and unknown codes are generic", () => {
  const codes = ["auth_failed", "expired", "disabled", "network", "timeout", "too_large", "bad_response"];
  const keys = codes.map((code) => iptvErrorMessage({ code }).key);
  assert.equal(new Set(keys).size, codes.length);
  assert.equal(iptvErrorMessage(new Error("boom")).key, "iptv_error_generic");
  assert.equal(iptvErrorMessage("missing_fields").key, IPTV_ERROR_MESSAGES.missing_fields[0]);
});

test("server input gains an http scheme only when missing", () => {
  assert.equal(withServerScheme(" host:8080 "), "http://host:8080");
  assert.equal(withServerScheme("https://h"), "https://h");
  assert.equal(withServerScheme(""), "");
});

test("validation requires all fields and a usable server, and keeps the password verbatim", () => {
  assert.equal(validateAccountInput({ server: "", username: "u", password: "p" }, normalize).errorCode, "missing_fields");
  assert.equal(validateAccountInput({ server: "ftp://x", username: "u", password: "p" }, normalize).errorCode, "invalid_server");
  const ok = validateAccountInput({ server: "host:8080", username: " u ", password: " p " }, normalize);
  assert.deepEqual(ok.values, { server: "http://host:8080", username: "u", password: " p ", showAdult: false });
});

test("error results never contain the password", () => {
  const result = validateAccountInput({ server: "", username: "u", password: "SECRET" }, normalize);
  assert.ok(!JSON.stringify(result).includes("SECRET"));
});
