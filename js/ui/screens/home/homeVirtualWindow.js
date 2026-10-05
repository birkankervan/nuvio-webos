const nonNegative = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * Fixed-size window for either axis; indexes are logical, not DOM positions.
 * stride includes gap. Ranges use an exclusive end. A distant focused item
 * adds a singleton range rather than extending the viewport's range.
 * Render segments in a gap:0 parent; apply gap only inside each items segment.
 * Variable-size rows need measured offsets and are not covered by this helper.
 */
export function calculateHomeVirtualWindow({
  count = 0, stride = 0, gap = 0, offset = 0,
  viewportExtent = 0, overscan = 0, focusedIndex = -1
} = {}) {
  count = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(nonNegative(count)));
  stride = nonNegative(stride);
  gap = Math.min(nonNegative(gap), stride);
  const itemExtent = stride - gap;
  // A missing measurement must not accidentally allocate the whole collection.
  if (!count || !itemExtent || !Number.isFinite(count * stride)) {
    return { offset: 0, totalExtent: 0, renderedCount: 0, ranges: [], segments: [] };
  }
  const totalExtent = count * stride - gap;
  viewportExtent = nonNegative(viewportExtent);
  overscan = nonNegative(overscan);
  offset = Math.min(nonNegative(offset), Math.max(0, totalExtent - viewportExtent));
  const ranges = [];
  if (viewportExtent > 0) {
    const from = Math.max(0, offset - overscan);
    const to = Math.min(totalExtent, offset + viewportExtent + overscan);
    let start = Math.floor(from / stride);
    // The viewport can start entirely inside the inter-item gap.
    if (from >= start * stride + itemExtent) start += 1;
    const end = Math.min(count, Math.ceil(to / stride));
    if (start < end) ranges.push({ start, end });
  }
  if (Number.isInteger(focusedIndex) && focusedIndex >= 0 && focusedIndex < count) {
    ranges.push({ start: focusedIndex, end: focusedIndex + 1 });
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged = [];
  ranges.forEach((range) => {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  });
  const segments = [];
  let cursor = 0;
  let renderedCount = 0;
  merged.forEach((range) => {
    range.offset = range.start * stride;
    range.extent = (range.end - range.start) * stride - gap;
    if (range.offset > cursor) segments.push({ kind: "spacer", extent: range.offset - cursor });
    segments.push({ kind: "items", ...range });
    cursor = range.offset + range.extent;
    renderedCount += range.end - range.start;
  });
  if (cursor < totalExtent) segments.push({ kind: "spacer", extent: totalExtent - cursor });
  return { offset, totalExtent, renderedCount, ranges: merged, segments };
}
