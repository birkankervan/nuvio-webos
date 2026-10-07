import { calculateHomeVirtualWindow } from "../home/homeVirtualWindow.js";

// Pure window math for the IPTV lists. Indexes are logical (data positions);
// the DOM only ever holds the ranges returned here, so mounted cards stay
// constant for 1k or 50k channels. Reuses the Home axis helper with rows as
// items, then expands each row range back to item indexes.

export const rowCountFor = (count, columns) => Math.ceil(Math.max(0, count) / Math.max(1, columns));
export const rowOfIndex = (index, columns) => Math.floor(index / Math.max(1, columns));

export function clampScroll(scrollTop, { count, columns, rowStride, viewportHeight }) {
  const total = rowCountFor(count, columns) * rowStride;
  const max = Math.max(0, total - Math.max(0, viewportHeight));
  const value = Number.isFinite(scrollTop) ? scrollTop : 0;
  return Math.min(max, Math.max(0, value));
}

// Minimal scroll that keeps the focused row fully visible (nearest edge).
export function scrollToReveal(scrollTop, index, geometry) {
  const { columns, rowStride, viewportHeight } = geometry;
  const top = rowOfIndex(index, columns) * rowStride;
  let next = scrollTop;
  if (top < scrollTop) next = top;
  else if (top + rowStride > scrollTop + viewportHeight) next = top + rowStride - viewportHeight;
  return clampScroll(next, geometry);
}

export function computeChannelWindow({
  count = 0,
  columns = 1,
  rowStride = 0,
  viewportHeight = 0,
  scrollTop = 0,
  overscanRows = 1,
  focusedIndex = -1
} = {}) {
  columns = Math.max(1, Math.floor(columns));
  const rows = rowCountFor(count, columns);
  const focusedRow = focusedIndex >= 0 && focusedIndex < count ? rowOfIndex(focusedIndex, columns) : -1;
  const window = calculateHomeVirtualWindow({
    count: rows,
    stride: rowStride,
    gap: 0,
    offset: scrollTop,
    viewportExtent: viewportHeight,
    overscan: overscanRows * rowStride,
    focusedIndex: focusedRow
  });
  const ranges = window.ranges.map((range) => ({
    start: range.start * columns,
    end: Math.min(count, range.end * columns)
  }));
  return {
    ranges,
    scrollTop: window.offset,
    totalHeight: window.totalExtent,
    mountedCount: ranges.reduce((sum, range) => sum + (range.end - range.start), 0)
  };
}
