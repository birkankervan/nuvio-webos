import test from "node:test";
import assert from "node:assert/strict";
import { calculateHomeVirtualWindow as windowFor } from "./homeVirtualWindow.js";

test("viewport, gaps and overscan preserve exact scroll extent", () => {
  const view = windowFor({ count: 100, stride: 110, gap: 10, offset: 220, viewportExtent: 220 });
  assert.deepEqual(view.ranges, [{ start: 2, end: 4, offset: 220, extent: 210 }]);
  assert.deepEqual(view.segments, [
    { kind: "spacer", extent: 220 },
    { kind: "items", start: 2, end: 4, offset: 220, extent: 210 },
    { kind: "spacer", extent: 10560 }
  ]);
  assert.equal(view.totalExtent, 10990);
  assert.deepEqual(windowFor({ count: 10, stride: 110, gap: 10,
    offset: 105, viewportExtent: 3 }).ranges, []);
  assert.equal(windowFor({ count: 10, stride: 110, gap: 10,
    offset: 220, viewportExtent: 220, overscan: 110 }).renderedCount, 4);
});

test("distant focus never allocates the prefix and adjacent focus merges", () => {
  const input = { count: 10000, stride: 100, gap: 20, viewportExtent: 300 };
  const distant = windowFor({ ...input, focusedIndex: 9000 });
  assert.equal(distant.renderedCount, 4);
  assert.deepEqual(distant.ranges.map(({ start, end }) => [start, end]), [[0, 3], [9000, 9001]]);
  assert.equal(windowFor({ ...input, focusedIndex: 3 }).ranges.length, 1);
  assert.equal(windowFor({ ...input, focusedIndex: 2 }).renderedCount, 3);
  assert.equal(windowFor({ ...input, focusedIndex: 10000 }).renderedCount, 3);
});

test("zero, invalid and shrinking collections clamp without huge allocations", () => {
  for (const count of [0, -1, NaN, Infinity]) assert.equal(windowFor({ count, stride: 100 }).segments.length, 0);
  for (const stride of [0, -1, NaN, Infinity]) assert.equal(windowFor({ count: 100, stride }).renderedCount, 0);
  assert.equal(windowFor({ count: 100, stride: 100, gap: 100 }).renderedCount, 0);
  const shrinking = windowFor({ count: 4.9, stride: 100, gap: 10, offset: 9999, viewportExtent: 200 });
  assert.equal(shrinking.offset, 190);
  assert.deepEqual(shrinking.ranges.map(({ start, end }) => [start, end]), [[2, 4]]);
  assert.equal(windowFor({ count: 5, stride: 100, viewportExtent: 1000 }).renderedCount, 5);
  assert.equal(windowFor({ count: 5, stride: 100, viewportExtent: 0 }).renderedCount, 0);
  assert.equal(windowFor({ count: 5, stride: 100, viewportExtent: 0, focusedIndex: 4 }).renderedCount, 1);
});

test("segment extents and indexes match item intersections over varying windows", () => {
  for (let count = 1; count <= 20; count += 1) {
    for (const offset of [0, 17, 43, 91, 430, 10000]) {
      for (const viewportExtent of [1, 10, 37, 100, 1000]) {
        const view = windowFor({ count, stride: 43, gap: 6, offset, viewportExtent, focusedIndex: count - 1 });
        const expected = new Set([count - 1]);
        for (let index = 0; index < count; index += 1) {
          if (index * 43 + 37 > view.offset && index * 43 < view.offset + viewportExtent) expected.add(index);
        }
        const actual = view.ranges.flatMap(({ start, end }) => Array.from({ length: end - start }, (_, i) => start + i));
        assert.deepEqual(actual, [...expected].sort((a, b) => a - b));
        assert.equal(view.segments.reduce((sum, segment) => sum + segment.extent, 0), view.totalExtent);
        assert.ok(view.segments.every(segment => segment.extent > 0));
        assert.equal(view.renderedCount, expected.size);
      }
    }
  }
});
