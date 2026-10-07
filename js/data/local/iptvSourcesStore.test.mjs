import test from "node:test";
import assert from "node:assert/strict";

const data = new Map();
globalThis.localStorage = {
  getItem: (key) => (data.has(key) ? data.get(key) : null),
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: (key) => data.delete(key)
};
const { IptvSourcesStore: store, normalizeIptvServer } = await import("./iptvSourcesStore.js");

const input = { name: "A", server: "http://host.tv:8080/", username: "u", password: "p@ss" };

test("normalizeIptvServer", () => {
  assert.equal(normalizeIptvServer("http://h.tv:8080/"), "http://h.tv:8080");
  assert.equal(normalizeIptvServer("https://h.tv/xc/player_api.php?x=1"), "https://h.tv/xc");
  assert.equal(normalizeIptvServer("https://h.tv/player_api.php/"), "https://h.tv");
  for (const bad of ["", "ftp://h.tv", "h.tv", "http://u:p@h.tv", "javascript:1"]) {
    assert.equal(normalizeIptvServer(bad), "");
  }
});

test("profiles are isolated and never seeded from primary", () => {
  data.clear();
  const a = store.upsert(input, "1");
  assert.equal(a.server, "http://host.tv:8080");
  assert.equal(store.list("2").length, 0);
  assert.equal(store.get(a.id, "2"), null);
  assert.equal(store.list("1").length, 1);
});

test("writes never queue a settings sync", () => {
  data.clear();
  store.upsert(input, "1");
  store.setFavorite("x:1", true, "1");
  assert.equal(data.has("profileSettingsSyncPendingProfiles"), false);
});

test("upsert keeps createdAt, rejects invalid, normalizes account", () => {
  data.clear();
  const a = store.upsert(input, "1");
  const b = store.upsert(
    { ...a, name: "B", lastAccount: { status: "Active", expDate: "99", maxConnections: "1", allowedFormats: ["TS"], timezone: "X" } },
    "1"
  );
  assert.equal(b.createdAt, a.createdAt);
  assert.equal(store.list("1").length, 1);
  assert.deepEqual(b.lastAccount.allowedFormats, ["ts"]);
  assert.equal(b.lastAccount.maxConnections, 1);
  assert.throws(() => store.upsert({ ...input, server: "nope" }, "1"), { code: "invalid_source" });
  assert.throws(() => store.upsert({ ...input, password: "" }, "1"), { code: "invalid_source" });
});

test("remove drops favorites, last channel and notifies; others kept", () => {
  data.clear();
  const a = store.upsert(input, "1");
  const b = store.upsert({ ...input, name: "B" }, "1");
  store.setFavorite(`${a.id}:1`, true, "1");
  store.setFavorite(`${b.id}:2`, true, "1");
  store.setLastChannel(`${a.id}:1`, "1");
  const events = [];
  const off = store.onRemoval((event) => events.push(event));
  assert.equal(store.remove(a.id, "1"), true);
  assert.equal(store.remove(a.id, "1"), false);
  off();
  assert.deepEqual(store.getFavorites("1"), [`${b.id}:2`]);
  assert.equal(store.getLastChannel("1"), null);
  assert.deepEqual(events, [{ profileId: "1", sourceId: a.id }]);
});

test("favorites toggle and clearProfile removes everything for that profile only", () => {
  data.clear();
  const a = store.upsert(input, "1");
  const b = store.upsert(input, "2");
  store.setFavorite(`${a.id}:1`, true, "1");
  store.setFavorite(`${a.id}:1`, true, "1");
  assert.equal(store.getFavorites("1").length, 1);
  store.setFavorite(`${a.id}:1`, false, "1");
  assert.equal(store.getFavorites("1").length, 0);
  store.setLastChannel(`${b.id}:9`, "2");
  store.clearProfile("1");
  assert.equal(store.list("1").length, 0);
  assert.equal(store.list("2").length, 1);
  assert.equal(store.getLastChannel("2"), `${b.id}:9`);
  assert.ok(!data.get("iptvSources").includes('"1":{"sources":[{'));
});
