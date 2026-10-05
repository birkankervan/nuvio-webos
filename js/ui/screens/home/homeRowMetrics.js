const nonNegative = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const keyOf = value => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

function firstIndex(values, predicate) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (predicate(values[middle])) right = middle;
    else left = middle + 1;
  }
  return left;
}

/** Numeric row geometry only; no retained DOM, observers or callbacks. */
export class HomeRowMetrics {
  constructor({ gap = 0, layoutKey = "" } = {}) {
    this.gap = nonNegative(gap);
    this.layoutKey = keyOf(layoutKey);
    this.rows = [];
    this.indexByKey = new Map();
    this.measuredHeights = new Map();
    this.offsets = [];
    this.ends = [];
    this.totalExtent = 0;
    this.dirty = true;
  }

  setRows(rows = [], { gap = this.gap, layoutKey = this.layoutKey } = {}) {
    const nextLayout = keyOf(layoutKey);
    if (nextLayout !== this.layoutKey) this.resetMeasurements(nextLayout);
    this.gap = nonNegative(gap);
    this.rows = [];
    this.indexByKey.clear();
    for (const row of Array.isArray(rows) ? rows : []) {
      const rowKey = keyOf(row?.rowKey);
      if (!rowKey || this.indexByKey.has(rowKey)) continue;
      this.indexByKey.set(rowKey, this.rows.length);
      this.rows.push({ rowKey, estimatedHeight: nonNegative(row.estimatedHeight) });
    }
    for (const key of this.measuredHeights.keys()) {
      if (!this.indexByKey.has(key)) this.measuredHeights.delete(key);
    }
    this.dirty = true;
  }

  setMeasuredHeight(rowKey, height) {
    const key = keyOf(rowKey);
    if (!this.indexByKey.has(key) || !Number.isFinite(height) || height < 0) return false;
    if (this.measuredHeights.get(key) === height) return false;
    this.measuredHeights.set(key, height);
    this.dirty = true;
    return true;
  }

  clearMeasuredHeight(rowKey) {
    const key = keyOf(rowKey);
    if (!this.measuredHeights.delete(key)) return false;
    this.dirty = true;
    return true;
  }

  resetMeasurements(layoutKey = this.layoutKey) {
    this.layoutKey = keyOf(layoutKey);
    this.measuredHeights.clear();
    this.dirty = true;
  }

  _ensureOffsets() {
    if (!this.dirty) return;
    this.offsets = [];
    this.ends = [];
    let cursor = 0;
    for (const row of this.rows) {
      const height = this.measuredHeights.has(row.rowKey) ? this.measuredHeights.get(row.rowKey) : row.estimatedHeight;
      this.offsets.push(cursor);
      this.ends.push(cursor + height);
      cursor += height;
      if (this.ends.length < this.rows.length) cursor += this.gap;
    }
    this.totalExtent = cursor;
    if (!Number.isFinite(this.totalExtent)) this.totalExtent = 0;
    this.dirty = false;
  }

  getRowMetrics(rowKey) {
    const index = this.indexByKey.get(keyOf(rowKey));
    if (index === undefined) return null;
    this._ensureOffsets();
    if (!this.totalExtent) return { index, offset: 0, height: 0 };
    return { index, offset: this.offsets[index], height: this.ends[index] - this.offsets[index] };
  }

  /** Same exclusive ranges / spacer-items segments contract as homeVirtualWindow. */
  getWindow({ offset = 0, viewportExtent = 0, overscan = 0, focusedRowKey = "" } = {}) {
    this._ensureOffsets();
    const totalExtent = this.totalExtent;
    if (!totalExtent) return { offset: 0, totalExtent: 0, renderedCount: 0, ranges: [], segments: [] };
    viewportExtent = nonNegative(viewportExtent);
    overscan = nonNegative(overscan);
    offset = Math.min(nonNegative(offset), Math.max(0, totalExtent - viewportExtent));
    const ranges = [];
    if (viewportExtent > 0) {
      const from = Math.max(0, offset - overscan);
      const to = Math.min(totalExtent, offset + viewportExtent + overscan);
      const start = firstIndex(this.ends, value => value > from);
      const end = firstIndex(this.offsets, value => value >= to);
      for (let index = start; index < end; index++) {
        if (this.ends[index] <= this.offsets[index]) continue;
        const last = ranges[ranges.length - 1];
        if (last?.end === index) last.end++;
        else ranges.push({ start: index, end: index + 1 });
      }
    }
    const focusedIndex = this.indexByKey.get(keyOf(focusedRowKey));
    if (focusedIndex !== undefined && this.ends[focusedIndex] > this.offsets[focusedIndex]) {
      ranges.push({ start: focusedIndex, end: focusedIndex + 1 });
    }
    ranges.sort((left, right) => left.start - right.start);
    const merged = [];
    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
      else merged.push({ ...range });
    }
    const segments = [];
    let cursor = 0;
    let renderedCount = 0;
    for (const range of merged) {
      range.offset = this.offsets[range.start];
      range.extent = this.ends[range.end - 1] - range.offset;
      if (range.offset > cursor) segments.push({ kind: "spacer", extent: range.offset - cursor });
      segments.push({ kind: "items", ...range });
      cursor = range.offset + range.extent;
      renderedCount += range.end - range.start;
    }
    if (cursor < totalExtent) segments.push({ kind: "spacer", extent: totalExtent - cursor });
    return { offset, totalExtent, renderedCount, ranges: merged, segments };
  }
}
