import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const api = await import("./xtreamApi.js");
const { XtreamApi, IptvError, normalizeChannels, normalizeCategories, resolvePlaybackUrl, normalizeVodStreams, normalizeSeries, normalizeSeriesInfo, normalizeVodInfo, resolveVodUrl } = api;
const fast = { retryDelaysMs: [1, 1] };

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
    (({ code: c, status }) => [c, status])(await code(XtreamApi.authenticate(source, fast))),
    ["network", 500]
  );
  assert.equal(calls.length, 3);
  stub(() => new Response("secret-host", { status: 500 }));
  assert.deepEqual(
    (({ code: c, status }) => [c, status])(await code(XtreamApi.authenticate(source, { retryDelaysMs: [] }))),
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
    new Promise((_, reject) => {
      const fail = () => reject(Object.assign(new Error("x"), { name: "AbortError" }));
      if (init.signal.aborted) fail();
      else init.signal.addEventListener("abort", fail);
    });
  stub(hang);
  assert.equal((await code(XtreamApi.authenticate(source, { timeoutMs: 20, retryDelaysMs: [] }))).code, "timeout");
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

test("normalizeVodStreams: slim fields, tmdb rewrite, dup/invalid, ext, cap", () => {
  const raw = [
    { stream_id: 1, name: " Film ", category_id: 4, container_extension: "MKV", rating: "7.5", added: "1700000000", stream_icon: "https://image.tmdb.org/t/p/w600_and_h900_bestv2/a.jpg", plot: "x", cast: "y" },
    { stream_id: 1, name: "dup" },
    { stream_id: 2, container_extension: "bad/ext", stream_icon: "https://image.tmdb.org/t/p/original/b.jpg" },
    { stream_id: 3, stream_icon: "https://other.tv/p.jpg", rating: "" },
    { stream_id: 4, stream_icon: "javascript:x" },
    { stream_id: "a:b" },
    { name: "no id" },
    null
  ];
  const items = normalizeVodStreams(raw);
  assert.deepEqual(items[0], { id: "1", name: "Film", categoryId: "4", ext: "mkv", rating: 7.5, added: 1700000000, poster: "https://image.tmdb.org/t/p/w342/a.jpg" });
  assert.equal(items.length, 4);
  assert.equal(items[1].ext, "mp4");
  assert.equal(items[1].poster, "https://image.tmdb.org/t/p/w342/b.jpg");
  assert.deepEqual([items[2].poster, items[2].rating, items[3].poster, items[3].name], ["https://other.tv/p.jpg", null, "", "4"]);
  assert.throws(() => normalizeVodStreams([{ stream_id: 1 }, { stream_id: 2 }], { limit: 1 }), { code: "too_large" });
  assert.throws(() => normalizeVodStreams({}), { code: "bad_response" });
});

test("normalizeSeries slim item", () => {
  const items = normalizeSeries([{ series_id: 9, name: "S", category_id: "2", cover: "http://x/c.jpg", rating: "8", plot: "p", backdrop_path: ["b"] }, { series_id: 9 }]);
  assert.deepEqual(items, [{ id: "9", name: "S", categoryId: "2", rating: 8, poster: "http://x/c.jpg" }]);
});

test("normalizeSeriesInfo groups, sorts, drops empty seasons", () => {
  const out = normalizeSeriesInfo({
    info: { name: "Show", plot: "P", cover: "https://image.tmdb.org/t/p/w600_and_h900_bestv2/c.jpg", backdrop_path: ["https://b/1.jpg"], releaseDate: "2020" },
    seasons: [{ season_number: 2, name: "Second" }, { season_number: 3, name: "Empty" }],
    episodes: {
      2: [{ id: "22", episode_num: 2, title: "B", container_extension: "mp4", info: { duration_secs: 60 } }, { id: "21", episode_num: 1 }],
      1: [{ id: "11", episode_num: "1", title: "A", info: { plot: "pp", movie_image: "http://i/e.jpg" } }, { id: "11" }],
      3: []
    }
  });
  assert.equal(out.info.poster, "https://image.tmdb.org/t/p/w342/c.jpg");
  assert.equal(out.info.backdrop, "https://b/1.jpg");
  assert.deepEqual(out.seasons.map((s) => [s.number, s.name, s.episodes.map((e) => e.id)]), [[1, "Season 1", ["11"]], [2, "Second", ["21", "22"]]]);
  assert.deepEqual(out.seasons[0].episodes[0], { id: "11", number: 1, title: "A", ext: "mp4", durationSecs: 0, plot: "pp", image: "http://i/e.jpg" });
  assert.equal(out.seasons[1].episodes[1].durationSecs, 60);
  assert.deepEqual(normalizeSeriesInfo({ info: {}, episodes: {} }).seasons, []);
  assert.throws(() => normalizeSeriesInfo({ info: {} }), { code: "bad_response" });
});

test("normalizeVodInfo", () => {
  const info = normalizeVodInfo({ info: { name: "M", plot: "p", genre: "g", cast: "c", director: "d", releasedate: "2001", rating: "6", duration_secs: 90, movie_image: "http://p/i.jpg", backdrop_path: ["http://p/b.jpg"] }, movie_data: { container_extension: "avi" } });
  assert.deepEqual(info, { name: "M", plot: "p", genre: "g", cast: "c", director: "d", releaseDate: "2001", rating: 6, durationSecs: 90, poster: "http://p/i.jpg", backdrop: "http://p/b.jpg", ext: "avi" });
  assert.throws(() => normalizeVodInfo([]), { code: "bad_response" });
});

test("VOD requests and retry policy", async () => {
  stub(() => json([{ category_id: "1", category_name: "Action" }]));
  assert.equal((await XtreamApi.getVodCategories(source))[0].name, "Action");
  assert.match(calls[0].url, /action=get_vod_categories/);
  stub(() => json([{ stream_id: 1 }]));
  await XtreamApi.getVodStreams(source, { categoryId: 5 });
  assert.match(calls[0].url, /action=get_vod_streams&category_id=5/);
  await XtreamApi.getVodStreams(source);
  assert.doesNotMatch(calls[1].url, /category_id/);
  await XtreamApi.getSeries(source, { categoryId: 2 });
  assert.match(calls[2].url, /action=get_series&category_id=2/);
  stub(() => json([]));
  await XtreamApi.getSeriesCategories(source);
  assert.match(calls[0].url, /action=get_series_categories/);
  stub(() => json({ info: {}, episodes: {} }));
  await XtreamApi.getSeriesInfo(source, 7);
  assert.match(calls[0].url, /action=get_series_info&series_id=7/);
  stub(() => json({ info: {} }));
  await XtreamApi.getVodInfo(source, 8);
  assert.match(calls[0].url, /action=get_vod_info&vod_id=8/);

  let n = 0;
  stub(() => (++n < 3 ? new Response("x", { status: 520 }) : json([{ stream_id: 1 }])));
  assert.equal((await XtreamApi.getVodStreams(source, fast)).length, 1);
  assert.equal(calls.length, 3);
  stub(() => new Response("x", { status: 404 }));
  assert.equal((await code(XtreamApi.getVodStreams(source, fast))).code, "network");
  assert.equal(calls.length, 1);
  stub(() => new Response("x", { status: 401 }));
  await code(XtreamApi.getVodStreams(source, fast));
  assert.equal(calls.length, 1);
  // timeout retries, then succeeds
  n = 0;
  stub((_url, init) => (++n < 2 ? new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("x"), { name: "AbortError" })))) : json([])));
  await XtreamApi.getVodStreams(source, { ...fast, timeoutMs: 20 });
  assert.equal(calls.length, 2);
  // abort during backoff is not retried
  const controller = new AbortController();
  stub(() => {
    controller.abort();
    return new Response("x", { status: 520 });
  });
  assert.equal((await code(XtreamApi.getVodStreams(source, { signal: controller.signal, retryDelaysMs: [50] }))).code, "aborted");
  assert.equal(calls.length, 1);
});

test("resolveVodUrl builders", () => {
  assert.equal(resolveVodUrl(source, "movie", "42", "mkv"), "http://secret-host.tv:8080/movie/user1/pw%2F1/42.mkv");
  assert.equal(resolveVodUrl(source, "episode", "7", "mp4"), "http://secret-host.tv:8080/series/user1/pw%2F1/7.mp4");
  assert.match(resolveVodUrl(source, "movie", "42", "m/../x"), /\/42\.mp4$/);
  assert.match(resolveVodUrl(source, "movie", "42"), /\/42\.mp4$/);
  assert.throws(() => resolveVodUrl(source, "live", "1", "mp4"), { code: "bad_response" });
  assert.throws(() => resolveVodUrl(source, "movie", "a/b", "mp4"), { code: "bad_response" });
});
