import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const api = await import("./xtreamApi.js");
const { XtreamApi, IptvError, normalizeChannels, normalizeCategories, resolvePlaybackUrl } = api;

const source = { id: "s1", server: "http://secret-host.tv:8080", username: "user1", password: "pw/1" };
const realFetch = globalThis.fetch;
let calls = [];
const stub = (handler) => {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(url, init);
  };
};
test.after(() => {
  globalThis.fetch = realFetch;
});
const json = (body, init) => new Response(JSON.stringify(body), init);
const account = (info, server = { timezone: "Europe/Istanbul" }) => json({ user_info: info, server_info: server });
const activeInfo = { auth: 1, status: "Active", exp_date: "4102444800", max_connections: "1", allowed_output_formats: ["m3u8", "ts"] };

async function code(promise) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof IptvError, String(error));
    for (const secret of ["secret-host", "user1", "pw", "player_api"]) {
      assert.ok(!error.message.includes(secret) && !JSON.stringify(error).includes(secret));
    }
    return error;
  }
  assert.fail("expected rejection");
}

test("authenticate maps account and sends no app auth", async () => {
  stub(() => account(activeInfo));
  const result = await XtreamApi.authenticate(source);
  assert.deepEqual(result, { status: "Active", expDate: 4102444800, maxConnections: 1, allowedFormats: ["m3u8", "ts"], timezone: "Europe/Istanbul" });
  assert.match(calls[0].url, /^http:\/\/secret-host\.tv:8080\/player_api\.php\?username=user1&password=pw%2F1$/);
  assert.equal(calls[0].init.credentials, "omit");
  assert.equal(JSON.stringify(calls[0].init.headers).includes("Authorization"), false);
});

test("authenticate failure mapping", async () => {
  stub(() => account({ auth: 0 }));
  assert.equal((await code(XtreamApi.authenticate(source))).code, "auth_failed");
  stub(() => account({ ...activeInfo, status: "Expired" }));
  assert.equal((await code(XtreamApi.authenticate(source))).code, "expired");
  stub(() => account({ ...activeInfo, exp_date: "1000" }));
  assert.equal((await code(XtreamApi.authenticate(source))).code, "expired");
  stub(() => account({ ...activeInfo, status: "Banned" }));
  assert.equal((await code(XtreamApi.authenticate(source))).code, "disabled");
  stub(() => account({ ...activeInfo, exp_date: null }));
  assert.equal((await XtreamApi.authenticate(source)).expDate, null);
  stub(() => json({ nothing: true }));
  assert.equal((await code(XtreamApi.authenticate(source))).code, "bad_response");
});

test("http errors never leak body", async () => {
  stub(() => new Response("user1 pw/1 http://secret-host.tv", { status: 401 }));
  const unauthorized = await code(XtreamApi.authenticate(source));
  assert.deepEqual([unauthorized.code, unauthorized.status], ["auth_failed", 401]);
  stub(() => new Response("x", { status: 403 }));
  assert.equal((await code(XtreamApi.authenticate(source))).code, "disabled");
  stub(() => new Response("secret-host", { status: 500 }));
  assert.deepEqual(
    (({ code: c, status }) => [c, status])(await code(XtreamApi.authenticate(source))),
    ["network", 500]
  );
  stub(() => {
    throw new TypeError("fetch failed http://secret-host.tv user1");
  });
  assert.equal((await code(XtreamApi.authenticate(source))).code, "network");
  stub(() => new Response("not json {", { status: 200 }));
  assert.equal((await code(XtreamApi.authenticate(source))).code, "bad_response");
});

test("timeout and abort", async () => {
  const hang = (_url, init) =>
    new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("x"), { name: "AbortError" }))));
  stub(hang);
  assert.equal((await code(XtreamApi.authenticate(source, { timeoutMs: 20 }))).code, "timeout");
  stub(hang);
  const controller = new AbortController();
  const pending = code(XtreamApi.authenticate(source, { signal: controller.signal }));
  controller.abort();
  assert.equal((await pending).code, "aborted");
  assert.equal((await code(XtreamApi.authenticate(source, { signal: controller.signal }))).code, "aborted");
});

test("body cap: content-length and streamed bytes", async () => {
  stub(() => new Response("[]", { headers: { "content-length": String(21 * 1024 * 1024) } }));
  assert.equal((await code(XtreamApi.getLiveStreams(source))).code, "too_large");
  let cancelled = false;
  const chunk = new Uint8Array(1024 * 1024);
  stub(
    () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(chunk);
          },
          cancel() {
            cancelled = true;
          }
        })
      )
  );
  assert.equal((await code(XtreamApi.getLiveStreams(source))).code, "too_large");
  assert.ok(cancelled, "reader cancelled on overflow");
});

test("getLiveCategories / getLiveStreams requests and mapping", async () => {
  stub(() => json([{ category_id: "1", category_name: "News" }, { category_id: "1" }, { nope: 1 }]));
  assert.deepEqual(await XtreamApi.getLiveCategories(source), [{ id: "1", name: "News", order: 0 }]);
  assert.match(calls[0].url, /action=get_live_categories/);
  stub(() => json([{ stream_id: 7, name: "A", category_id: "1" }]));
  const channels = await XtreamApi.getLiveStreams(source, { categoryId: 1 });
  assert.equal(channels[0].id, "s1:7");
  assert.match(calls[0].url, /action=get_live_streams&category_id=1/);
  stub(() => json({ error: 1 }));
  assert.equal((await code(XtreamApi.getLiveStreams(source))).code, "bad_response");
});

test("normalizeChannels: duplicate, broken, non-live, cap, fields", () => {
  const raw = [
    { stream_id: 1, num: "5", name: " One ", stream_type: "live", category_id: 3, stream_icon: "https://x/l.png", epg_channel_id: " e1 ", tv_archive: 1 },
    { stream_id: 1, name: "dup" },
    { stream_id: 2, stream_type: "movie" },
    { name: "no id" },
    null,
    { stream_id: "a:b" },
    { stream_id: 3, stream_icon: "javascript:x", tv_archive: 0 }
  ];
  const channels = normalizeChannels(raw, "S");
  assert.deepEqual(channels[0], { id: "S:1", sourceId: "S", streamId: "1", name: "One", number: 5, categoryId: "3", logo: "https://x/l.png", epgId: "e1", archive: true });
  assert.equal(channels.length, 2);
  assert.equal(channels[1].logo, "");
  assert.equal(channels[1].name, "3");
  assert.equal(normalizeChannels([{ stream_id: 1 }, { stream_id: 2 }], "S", { limit: 2 }).length, 2);
  assert.throws(() => normalizeChannels([{ stream_id: 1 }, { stream_id: 2 }, { stream_id: 3 }], "S", { limit: 2 }), { code: "too_large" });
  assert.throws(() => normalizeCategories("x"), { code: "bad_response" });
});

test("resolvePlaybackUrl prefers HLS, uses ts only without m3u8, encodes credentials", () => {
  const channel = { sourceId: "s1", streamId: "42" };
  assert.equal(resolvePlaybackUrl(source, channel, ["m3u8", "ts"]), "http://secret-host.tv:8080/live/user1/pw%2F1/42.m3u8");
  assert.match(resolvePlaybackUrl(source, channel, ["TS"]), /\/42\.ts$/);
  assert.match(resolvePlaybackUrl(source, channel, ["m3u8"]), /\/42\.m3u8$/);
  assert.match(resolvePlaybackUrl(source, channel, []), /\.m3u8$/);
  assert.match(resolvePlaybackUrl(source, channel), /\.m3u8$/);
  assert.match(resolvePlaybackUrl({ ...source, lastAccount: { allowedFormats: ["ts"] } }, channel), /\.ts$/);
  assert.throws(() => resolvePlaybackUrl(source, { sourceId: "other", streamId: "1" }, []), { code: "bad_response" });
});
