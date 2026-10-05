import test from "node:test";
import assert from "node:assert/strict";
import { HomeRowMetrics } from "./homeRowMetrics.js";

const row = (rowKey, estimatedHeight) => ({ rowKey, estimatedHeight });
const indexes = view => view.ranges.map(({ start, end }) => [start, end]);
const exactSegments = view => assert.equal(view.segments.reduce((sum, segment) => sum + segment.extent, 0), view.totalExtent);

test("different CW/catalog heights, gaps, overscan and measured updates preserve exact geometry", () => {
  const metrics = new HomeRowMetrics({ gap: 20, layoutKey: "modern" });
  metrics.setRows([row("cw", 100), row("movies", 300), row("series", 200)]);
  assert.deepEqual(metrics.getRowMetrics("series"), { index: 2, offset: 440, height: 200 });
  let view = metrics.getWindow({ offset: 105, viewportExtent: 10 });
  assert.equal(view.totalExtent, 640);
  assert.deepEqual(view.ranges, []);
  exactSegments(view);
  view = metrics.getWindow({ offset: 120, viewportExtent: 300 });
  assert.deepEqual(view.ranges, [{ start: 1, end: 2, offset: 120, extent: 300 }]);
  exactSegments(view);
  assert.deepEqual(indexes(metrics.getWindow({ offset: 120, viewportExtent: 300, overscan: 21 })), [[0, 3]]);
  const oldOffsets = metrics.offsets;
  assert.equal(metrics.setMeasuredHeight("cw", 150), true);
  assert.equal(metrics.setMeasuredHeight("movies", 250), true);
  assert.equal(metrics.offsets, oldOffsets, "measurement batch must not eagerly rebuild prefixes");
  assert.deepEqual(metrics.getRowMetrics("movies"), { index: 1, offset: 170, height: 250 });
  const rebuilt = metrics.offsets;
  metrics.getWindow({ viewportExtent: 20 });
  metrics.getRowMetrics("cw");
  assert.equal(metrics.offsets, rebuilt, "unchanged geometry reuses one prefix rebuild");
  assert.equal(metrics.setMeasuredHeight("cw", 150), false);
});

test("reorder retains key measurements, shrink removes them, layout changes reset them", () => {
  const metrics = new HomeRowMetrics({ gap: 10, layoutKey: "modern" });
  metrics.setRows([row("cw", 100), row("movies", 200), row("series", 300)]);
  metrics.setMeasuredHeight("cw", 120);
  metrics.setMeasuredHeight("movies", 220);
  metrics.setRows([row("movies", 200), row("cw", 100)]);
  assert.deepEqual(metrics.getRowMetrics("cw"), { index: 1, offset: 230, height: 120 });
  const view = metrics.getWindow({ offset: 9999, viewportExtent: 200 });
  assert.equal(view.offset, 150);
  assert.equal(view.totalExtent, 350);
  exactSegments(view);
  metrics.setRows([row("cw", 100)]);
  assert.equal(metrics.measuredHeights.has("movies"), false);
  metrics.setRows([row("cw", 100), row("movies", 200)]);
  assert.equal(metrics.getRowMetrics("movies").height, 200);
  metrics.setRows([row("cw", 100), row("movies", 200)], { layoutKey: "classic", gap: 0 });
  assert.equal(metrics.getRowMetrics("cw").height, 100);
  assert.equal(metrics.getWindow({ viewportExtent: 1000 }).totalExtent, 300);
  metrics.setMeasuredHeight("cw", 140);
  metrics.resetMeasurements();
  assert.equal(metrics.getRowMetrics("cw").height, 100);
  metrics.setRows([]);
  assert.equal(metrics.measuredHeights.size, 0);
  assert.equal(metrics.getRowMetrics("cw"), null);
});

test("distant focus pins only one row and zero/invalid dimensions never allocate missing rows", () => {
  const metrics = new HomeRowMetrics({ gap: 10 });
  metrics.setRows(Array.from({ length: 10000 }, (_, index) => row(String(index), 90)));
  const view = metrics.getWindow({ viewportExtent: 300, focusedRowKey: "9000" });
  assert.deepEqual(indexes(view), [[0, 3], [9000, 9001]]);
  assert.equal(view.renderedCount, 4);
  assert.equal(view.segments.length, 4);
  exactSegments(view);
  assert.equal(metrics.getWindow({ viewportExtent: 0, focusedRowKey: "9000" }).renderedCount, 1);
  assert.equal(metrics.getWindow({ viewportExtent: NaN, focusedRowKey: "unknown" }).renderedCount, 0);
  assert.equal(metrics.setMeasuredHeight("unknown", 100), false);
  for (const value of [NaN, Infinity, -1]) assert.equal(metrics.setMeasuredHeight("0", value), false);
  metrics.setRows([row("zero", 0), row("negative", -100), row("nan", NaN), row("infinite", Infinity), row("real", 50)]);
  const safe = metrics.getWindow({ viewportExtent: 100, offset: -20, overscan: Infinity });
  assert.deepEqual(indexes(safe), [[4, 5]]);
  exactSegments(safe);
  assert.equal(metrics.setMeasuredHeight("real", 0), true);
  assert.equal(metrics.getWindow({ viewportExtent: 100, focusedRowKey: "real" }).renderedCount, 0);
  metrics.setRows(null);
  assert.equal(metrics.getWindow().totalExtent, 0);
  metrics.setRows(-1);
  assert.equal(metrics.getWindow().renderedCount, 0);
  metrics.setRows([null, row("", 30), row("real", 50), row("real", 100)]);
  assert.equal(metrics.rows.length, 1);
  assert.equal(metrics.getRowMetrics("real").height, 50);
  metrics.setRows([row("huge", 1e308)], { gap: 1e308 });
  assert.equal(metrics.getWindow().totalExtent, 1e308, "no trailing gap must overflow a single row");
  metrics.setRows([row("huge", 1e308), row("overflow", 1e308)]);
  assert.equal(metrics.getWindow({ viewportExtent: 100 }).renderedCount, 0);
});

test("variable-height segment windows match exact intersections across offsets", () => {
  const metrics = new HomeRowMetrics({ gap: 7 });
  const rows = [row("a", 35), row("b", 80), row("c", 0), row("d", 150), row("e", 15)];
  metrics.setRows(rows);
  for (const offset of [0, 36, 42, 121, 150, 10000]) {
    for (const viewportExtent of [1, 5, 37, 80, 1000]) {
      const view = metrics.getWindow({ offset, viewportExtent, focusedRowKey: "e" });
      const expected = new Set([4]);
      rows.forEach((entry, index) => {
        const geometry = metrics.getRowMetrics(entry.rowKey);
        if (geometry.height > 0 && geometry.offset + geometry.height > view.offset && geometry.offset < view.offset + viewportExtent) expected.add(index);
      });
      const actual = view.ranges.flatMap(({ start, end }) => Array.from({ length: end - start }, (_, index) => start + index));
      assert.deepEqual(actual, [...expected].sort((a, b) => a - b));
      exactSegments(view);
      assert.ok(view.segments.every(segment => segment.extent > 0));
    }
  }
});
