import assert from "node:assert/strict";
import { test } from "node:test";

import { videoResolutionLabel } from "./videoResolutionLabel.js";

test("maps decoded size to label", () => {
  assert.equal(videoResolutionLabel(3840, 2160), "4K");
  assert.equal(videoResolutionLabel(3840, 1600), "4K");
  assert.equal(videoResolutionLabel(1920, 1080), "1080p");
  assert.equal(videoResolutionLabel(1920, 800), "1080p");
  assert.equal(videoResolutionLabel(1280, 720), "720p");
  assert.equal(videoResolutionLabel(720, 576), "576p");
  assert.equal(videoResolutionLabel(0, 0), "");
  assert.equal(videoResolutionLabel(undefined, 1080), "");
});
