import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { httpRequest } = await import("./httpClient.js");

test("a third-party 429 does not put the Nuvio backend into cooldown", async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("provider.example")
    ? new Response("{}", { status: 429, headers: { "retry-after": "5" } })
    : new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  try {
    await httpRequest("http://provider.example/player_api.php", { includeSessionAuth: false }).catch(() => {});
    const t0 = Date.now();
    await httpRequest("https://backend.example/rest/v1/profiles", { includeSessionAuth: false });
    assert.ok(Date.now() - t0 < 1000, "backend request waited for a third-party cooldown");
  } finally {
    globalThis.fetch = savedFetch;
  }
});
