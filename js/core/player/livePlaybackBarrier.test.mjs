import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { createPlayerControllerMethods20 } = await import("./playerControllerMethods-20-flush-progress.js");
const { createPlayerControllerMethods11 } = await import("./playerControllerMethods-11-get-av-play-diagnostic-snapshot.js");
const { TrackingScrobbleService } = await import("../../data/repository/trackingScrobbleService.js");

test("live channels never write progress", async () => {
  let snapshots = 0;
  const controller = {
    ...createPlayerControllerMethods11(),
    ...createPlayerControllerMethods20(),
    recordProgressSnapshot() { snapshots++; }
  };
  const result = await controller.flushProgress(600000, 0, false, { itemId: "src:42", itemType: "channel" });
  assert.equal(result, false);
  assert.equal(snapshots, 0);
});

test("a null scrobble context reaches no provider", () => {
  assert.doesNotThrow(() => {
    TrackingScrobbleService.start(null);
    TrackingScrobbleService.pause(null);
    TrackingScrobbleService.stop(null);
  });
});
