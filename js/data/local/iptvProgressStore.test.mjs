import test from "node:test";
import assert from "node:assert/strict";

const data = new Map();
globalThis.localStorage = {
  getItem: (key) => (data.has(key) ? data.get(key) : null),
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: (key) => data.delete(key)
};
const { IptvProgressStore: store } = await import("./iptvProgressStore.js");
const { IptvSourcesStore } = await import("./iptvSourcesStore.js");

test("save/get, <10s ignored, 90% completes", () => {
  data.clear();
  store.save("s1:movie:1", { posMs: 5000, durMs: 100000, title: "A" }, "1");
  assert.equal(store.get("s1:movie:1", "1"), null);
  store.save("s1:movie:1", { posMs: 60000, durMs: 100000, title: "A" }, "1");
  const entry = store.get("s1:movie:1", "1");
  assert.equal(entry.posMs, 60000);
  assert.equal(entry.title, "A");
  assert.ok(entry.updatedAt > 0);
  assert.equal(store.get("s1:movie:1", "2"), null);
  store.save("s1:movie:1", { posMs: 90000, durMs: 100000 }, "1");
  assert.equal(store.get("s1:movie:1", "1"), null);
});

test("bounded to 500, oldest dropped", () => {
  data.clear();
  const now = Date.now;
  let t = 1000;
  Date.now = () => t++;
  try {
    for (let i = 0; i < 502; i++) store.save(`s1:ep:${i}`, { posMs: 20000, durMs: 100000 }, "1");
  } finally {
    Date.now = now;
  }
  assert.equal(store.get("s1:ep:0", "1"), null);
  assert.equal(store.get("s1:ep:1", "1"), null);
  assert.ok(store.get("s1:ep:2", "1"));
  assert.ok(store.get("s1:ep:501", "1"));
});

test("removeSource and source/profile removal clean progress", () => {
  data.clear();
  store.save("a:movie:1", { posMs: 20000, durMs: 100000 }, "1");
  store.save("ab:movie:1", { posMs: 20000, durMs: 100000 }, "1");
  store.removeSource("a", "1");
  assert.equal(store.get("a:movie:1", "1"), null);
  assert.ok(store.get("ab:movie:1", "1"));
  const src = IptvSourcesStore.upsert({ name: "A", server: "http://h.tv", username: "u", password: "p" }, "1");
  store.save(`${src.id}:ep:9`, { posMs: 20000, durMs: 100000 }, "1");
  IptvSourcesStore.remove(src.id, "1");
  assert.equal(store.get(`${src.id}:ep:9`, "1"), null);
  IptvSourcesStore.clearProfile("1");
  assert.equal(store.get("ab:movie:1", "1"), null);
});
