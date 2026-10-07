import test from "node:test";
import assert from "node:assert/strict";
import { clampScroll, computeChannelWindow, scrollToReveal } from "./iptvChannelWindow.js";

const geo = (count) => ({ count, columns: 4, rowStride: 156, viewportHeight: 800 });

test("mounted cards stay bounded for 1k, 10k and 50k channels", () => {
  const counts = [1000, 10_000, 50_000];
  const mounted = counts.map((count) =>
    computeChannelWindow({ ...geo(count), scrollTop: 156 * 40, overscanRows: 1, focusedIndex: 160 }).mountedCount
  );
  assert.ok(mounted.every((n) => n <= 40), `mounted ${mounted}`);
  assert.equal(new Set(mounted).size, 1);
});

test("window covers the viewport plus overscan in logical indexes", () => {
  const win = computeChannelWindow({ ...geo(1000), scrollTop: 156 * 10, overscanRows: 1, focusedIndex: 40 });
  assert.equal(win.ranges.length, 1);
  assert.equal(win.ranges[0].start, 9 * 4);
  assert.ok(win.ranges[0].end >= (10 + 5) * 4);
});

test("returning to a distant channel renders no prefix DOM", () => {
  const scroll = scrollToReveal(0, 9000, geo(10_000));
  const win = computeChannelWindow({ ...geo(10_000), scrollTop: scroll, focusedIndex: 9000 });
  assert.ok(win.ranges[0].start > 8000);
  assert.ok(win.mountedCount <= 40);
});

test("last partial row is clamped to the item count", () => {
  const win = computeChannelWindow({ ...geo(10), scrollTop: 0, focusedIndex: 9 });
  assert.equal(win.ranges.at(-1).end, 10);
});

test("scrollToReveal moves minimally and clamps", () => {
  const g = geo(1000);
  assert.equal(scrollToReveal(0, 3, g), 0);
  assert.equal(scrollToReveal(0, 4 * 6, g), 156 * 7 - 800);
  assert.equal(scrollToReveal(156 * 20, 0, g), 0);
  assert.equal(clampScroll(1e9, g), 250 * 156 - 800);
});

test("empty list and missing measurement mount nothing", () => {
  assert.equal(computeChannelWindow({ ...geo(0) }).mountedCount, 0);
  assert.equal(computeChannelWindow({ count: 100, columns: 4, rowStride: 0 }).mountedCount, 0);
});
