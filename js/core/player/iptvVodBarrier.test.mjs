import { test } from "node:test";
import assert from "node:assert/strict";

const data = new Map();
globalThis.localStorage = {
  getItem: (key) => (data.has(key) ? data.get(key) : null),
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: (key) => data.delete(key)
};
const { createPlayerControllerMethods20 } = await import("./playerControllerMethods-20-flush-progress.js");
const { createPlayerControllerMethods11 } = await import("./playerControllerMethods-11-get-av-play-diagnostic-snapshot.js");
const { createPlayerScreenMethods07 } = await import("../../ui/screens/player/playerScreenMethods-07-build-subtitle-lookup-context.js");
const { createPlayerScreenMethods01 } = await import("../../ui/screens/player/playerScreenMethods-01-mount.js");
const { IptvProgressStore } = await import("../../data/local/iptvProgressStore.js");
const { iptvProgressKey } = await import("../../data/local/iptvProgressStore.js");
const { watchProgressRepository } = await import("../../data/repository/watchProgressRepository.js");
const { watchedItemsRepository } = await import("../../data/repository/watchedItemsRepository.js");

const controller = {
  ...createPlayerControllerMethods11(),
  ...createPlayerControllerMethods20(),
  recordProgressSnapshot() {},
  flushCloudLibraryProgress() { throw new Error("cloud"); },
  pushProgressIfDue() { throw new Error("push"); }
};

test("iptvvod is local-only, not live", () => {
  assert.equal(controller.isLocalOnlyProgressItemType("iptvvod"), true);
  assert.equal(controller.isLocalOnlyProgressItemType("movie"), false);
  assert.equal(controller.isLivePlaybackItemType("iptvvod"), false);
});

test("iptvvod flush writes only the local store", async () => {
  const calls = [];
  const trap = (obj, name) => {
    const original = obj[name];
    obj[name] = (...args) => (calls.push(name), original?.apply(obj, args));
  };
  ["saveProgress", "removeProgress"].forEach((n) => trap(watchProgressRepository, n));
  trap(watchedItemsRepository, "mark");
  const key = iptvProgressKey({ sourceId: "s1", kind: "movie", streamId: 7 });
  assert.equal(key, "s1:movie:7");
  const ctx = { itemId: key, itemType: "iptvvod", title: "Film" };
  await controller.flushProgress(60000, 100000, false, ctx);
  assert.equal(IptvProgressStore.get(key).posMs, 60000);
  await controller.flushProgress(95000, 100000, true, ctx);
  assert.equal(IptvProgressStore.get(key), null);
  assert.deepEqual(calls, []);
});

test("iptvvod has no scrobble context and no side-channel fetches", () => {
  const screen = createPlayerScreenMethods07();
  screen.params = { itemType: "iptvvod", itemId: "s1:movie:7" };
  assert.equal(screen.buildScrobbleContext(), null);
  assert.equal(screen.isLocalOnlyMedia(), true);
  screen.params = { itemType: "movie", itemId: "tt1" };
  assert.equal(screen.isLocalOnlyMedia(), false);
});

test("mount resolves VOD url via repository and keeps live path", async () => {
  const { IptvRepository } = await import("../../data/repository/iptvRepository.js");
  const seen = [];
  IptvRepository.resolveVodPlaybackUrl = async (...args) => (seen.push(args), "http://x/y.mp4");
  IptvRepository.resolveChannelPlaybackUrl = async () => "http://live";
  const screen = createPlayerScreenMethods01();
  assert.equal(await screen.resolveIptvStreamUrl({ sourceId: "s", kind: "episode", streamId: 3, ext: "mkv" }), "http://x/y.mp4");
  assert.deepEqual(seen[0], ["s", "episode", 3, "mkv"]);
  assert.equal(await screen.resolveIptvStreamUrl({ sourceId: "s", channelId: "s:1" }), "http://live");
});
