import { HomeRowMetrics } from "./homeRowMetrics.js";
import { calculateHomeVirtualWindow } from "./homeVirtualWindow.js";
import { resolveHomeLogicalFocus, moveHomeLogicalFocus } from "./homeLogicalFocus.js";
import { getHomeFocusIdentity } from "./homeFocusPolicy.js";
import { updateKeyedDom } from "../../components/keyedDomUpdate.js";

const indices = ranges => ranges.flatMap(({ start, end }) => Array.from({ length: end - start }, (_, index) => start + index));
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const itemIdentityKey = item => JSON.stringify([item?.itemId || "", item?.itemType || "", item?.videoId || "", item?.season || "", item?.episode || ""]);
const cardCacheKey = (row, item, index) => JSON.stringify([row.rowKey, itemIdentityKey(item), index,
  Number(item?.itemIndex), Number(item?.sourceIndex), Number(row.sourceRowIndex)]);

/** Modern data renderer. Only mounted DOM is reachable; offscreen state is numeric. */
export class HomeDataWindow {
  constructor({ rows = [], renderCard, renderTitle, escapeAttribute, landscape = false, layoutKey = "", focus = null } = {}) {
    this.renderCard = renderCard;
    this.renderTitle = renderTitle;
    this.escapeAttribute = escapeAttribute;
    this.landscape = landscape;
    this.layoutKey = layoutKey;
    this.metrics = new HomeRowMetrics({ gap: 24, layoutKey });
    this.trackStates = new Map();
    this.trackMetrics = new Map();
    this.sizes = new Map();
    this.trackHeights = new Map();
    this.trackHandlers = new Map();
    this.mountedNodes = new Map();
    this.cardMarkupCache = new Map();
    this.pendingScrollAnchor = null;
    this.frame = 0;
    this.width = 1280;
    this.height = 560;
    this.posterWidth = 212;
    this.posterHeight = landscape ? 179 : 318;
    this.continueWidth = 419;
    this.continueHeight = 236;
    this.gap = 24;
    this.setRows(rows, focus);
  }

  dimensions(row, item = null) {
    if (row.kind !== "collection" && this.sizes.has(row.rowKey)) return this.sizes.get(row.rowKey);
    if (row.kind === "continue") {
      if (row.cardStyle === "poster") return { width: this.posterWidth, height: this.posterWidth * 1.5 };
      return { width: this.continueWidth, height: this.continueHeight };
    }
    if (row.kind === "collection") {
      item ||= row.items[0];
      const shape = String(item?.source?.tileShape || item?.source?.posterShape || "POSTER").toUpperCase();
      if (shape === "SQUARE") return { width: this.posterWidth * 1.5, height: this.posterWidth * 1.5 };
      if (shape === "LANDSCAPE") return { width: this.posterWidth * 1.5, height: this.posterWidth * 0.844 };
      return { width: this.posterWidth, height: this.posterWidth * 1.5 };
    }
    return { width: this.landscape ? this.posterWidth * 1.5 : this.posterWidth, height: this.posterHeight };
  }

  measurementKeys(row) {
    const loading = Boolean(row.isLoading);
    const collection = row.kind === "collection";
    const dimensions = collection ? row.items.map(item => this.dimensions(row, item)) : [];
    const estimatedHeight = collection
      ? dimensions.reduce((height, size) => Math.max(height, size.height), 0) || this.dimensions(row).height
      : null;
    return {
      card: JSON.stringify([row.kind, row.cardStyle || "", loading]),
      section: JSON.stringify([row.kind, row.cardStyle || "", loading, estimatedHeight]),
      dimensions: collection ? dimensions.map(({ width, height }) => [width, height]) : null
    };
  }

  setRows(rows, focus = this.focus, invalidation = {}) {
    rows = Array.isArray(rows) ? rows : [];
    const dirtyRows = new Set(invalidation.dirtyRows || []);
    const dirtyItems = new Set(invalidation.dirtyItems || []);
    const previousMeasurementKeys = this.measurementKeysByRow || new Map();
    const measurementKeysByRow = new Map(rows.map(row => [row.rowKey, this.measurementKeys(row)]));
    const unknownUpdate = !dirtyRows.size && !dirtyItems.size && !invalidation.invalidateMountedCatalogCards && this.rows?.length;
    if (unknownUpdate) {
      this.cardMarkupCache.clear();
    }
    if (invalidation.invalidateMountedCatalogCards) {
      for (const [key, entry] of this.cardMarkupCache) if (entry.kind !== "continue") this.cardMarkupCache.delete(key);
    }
    for (const [key, entry] of this.cardMarkupCache) {
      if (dirtyRows.has(entry.rowKey) || dirtyItems.has(`${entry.rowKey}\u0000${entry.itemId}`)) this.cardMarkupCache.delete(key);
    }
    const pendingMetrics = this.pendingScrollAnchor && this.metrics.getRowMetrics(this.pendingScrollAnchor.rowKey);
    const scrollTop = this.viewport
      ? pendingMetrics ? pendingMetrics.offset + this.pendingScrollAnchor.offset : this.viewport.scrollTop || 0
      : 0;
    const anchorRange = this.viewport ? this.metrics.getWindow({ offset: scrollTop, viewportExtent: 1 }).ranges[0] : null;
    const anchorRow = anchorRange ? this.rows[anchorRange.start] : null;
    const anchorOffset = anchorRow ? scrollTop - (this.metrics.getRowMetrics(anchorRow.rowKey)?.offset || 0) : 0;
    const previousTrackMetrics = this.trackMetrics;
    if (unknownUpdate) {
      this.sizes.clear();
      this.trackHeights.clear();
      this.metrics.resetMeasurements();
      previousTrackMetrics.forEach(metrics => metrics.resetMeasurements());
    }
    this.rows = rows;
    this.rowByKey = new Map(rows.map((row, index) => [row.rowKey, { row, index }]));
    this.focus = resolveHomeLogicalFocus(rows, focus || {}) || null;
    for (const key of this.trackStates.keys()) if (!this.rowByKey.has(key)) this.trackStates.delete(key);
    for (const key of this.sizes.keys()) if (!this.rowByKey.has(key)) this.sizes.delete(key);
    for (const key of this.trackHeights.keys()) if (!this.rowByKey.has(key)) this.trackHeights.delete(key);
    for (const key of dirtyRows) {
      const previous = previousMeasurementKeys.get(key);
      const next = measurementKeysByRow.get(key);
      const cardChanged = !previous || !next || previous.card !== next.card;
      const sectionChanged = cardChanged || previous.section !== next.section;
      if (cardChanged) this.sizes.delete(key);
      if (sectionChanged) {
        this.metrics.clearMeasuredHeight(key);
        this.trackHeights.delete(key);
      }
      if (previous?.dimensions && next?.dimensions) {
        const trackMetrics = previousTrackMetrics.get(key);
        for (let index = 0; index < next.dimensions.length; index++) {
          const oldSize = previous.dimensions[index];
          const nextSize = next.dimensions[index];
          if (oldSize && (oldSize[0] !== nextSize[0] || oldSize[1] !== nextSize[1])) {
            trackMetrics?.clearMeasuredHeight(String(index));
          }
        }
      }
    }
    rows.filter(row => row.kind === "collection").forEach(row => {
      const estimated = row.items.reduce((height, item) => Math.max(height, this.dimensions(row, item).height), 0) || this.dimensions(row).height;
      this.trackHeights.set(row.rowKey, Math.max(estimated, this.trackHeights.get(row.rowKey) || 0));
    });
    this.metrics.setRows(rows.map(row => ({ rowKey: row.rowKey,
      estimatedHeight: (row.kind === "collection" ? this.trackHeights.get(row.rowKey) || this.dimensions(row).height : this.dimensions(row).height) + 46 })),
    { gap: 24, layoutKey: this.layoutKey });
    this.trackMetrics = new Map();
    rows.filter(row => row.kind === "collection").forEach(row => {
      const metrics = previousTrackMetrics.get(row.rowKey) || new HomeRowMetrics({ gap: this.gap });
      metrics.setRows(row.items.map((item, index) => ({ rowKey: String(index), estimatedHeight: this.dimensions(row, item).width })));
      this.trackMetrics.set(row.rowKey, metrics);
    });
    this.measurementKeysByRow = measurementKeysByRow;
    this.pendingScrollAnchor = anchorRow && this.rowByKey.has(anchorRow.rowKey) && this.viewport
      ? { rowKey: anchorRow.rowKey, offset: anchorOffset } : null;
  }

  captureTrackStates() {
    this.trackHandlers.forEach((_, track) => {
      if (track.isConnected && this.rowByKey.has(track.dataset.trackRowKey)) this.trackStates.set(track.dataset.trackRowKey, track.scrollLeft);
    });
    return Object.fromEntries(this.trackStates);
  }

  rowWindow(row, rowIndex, width, { focusedRowKey, focusedItemIndex, expandedRowKey, expandedIndex, expandedWidth }) {
    const dimension = this.dimensions(row);
    const focusIndex = this.focus?.rowKey === row.rowKey ? this.focus.itemIndex : -1;
    const offset = this.trackStates.get(row.rowKey) || 0;
    const variable = this.trackMetrics.get(row.rowKey);
    const focusedItem = focusIndex >= 0 ? row.items[focusIndex] : null;
    const viewportExtent = Math.max(1, width - 208);
    const options = { offset, viewportExtent, overscan: dimension.width, focusedIndex: focusIndex };
    const window = variable
      ? variable.getWindow({ ...options, focusedRowKey: focusedItem ? String(focusIndex) : "" })
      : calculateHomeVirtualWindow({ ...options, count: row.items.length, stride: dimension.width + this.gap, gap: this.gap });
    const visible = new Set(indices(window.ranges));
    const rowExpandedIndex = expandedRowKey === row.rowKey ? expandedIndex : -1;
    const expandedExtra = rowExpandedIndex >= 0 ? Math.max(0, expandedWidth - dimension.width) : 0;
    // Keep the old live focused card for the brief handoff to a newly mounted
    // target. It is released after the focus commit, never an entire prefix.
    if (focusedRowKey === row.rowKey) visible.add(focusedItemIndex);
    const cards = [...visible].sort((a, b) => a - b).map(index => {
      const item = row.items[index];
      if (!item) return "";
      const baseLeft = variable ? variable.getRowMetrics(String(index))?.offset || 0 : index * (dimension.width + this.gap);
      const left = baseLeft + (index > rowExpandedIndex && rowExpandedIndex >= 0 ? expandedExtra : 0);
      const markup = this.renderCardMarkup(row, item, index, rowIndex);
      // The renderer produces an article. Absolute coordinates preserve the
      // full scroll extent without offscreen element/spacer allocations.
      return markup.replace(/<article\b/, `<article data-window-index="${index}" style="position:absolute;left:${left}px;top:0"`);
    }).join("");
    const skeletons = row.loadingItems.map((item, index) => index < Math.ceil(viewportExtent / (dimension.width + this.gap)) + 1
      ? this.renderCardMarkup(row, item, -1, rowIndex).replace(/<article\b/, `<article style="position:absolute;left:${index * (dimension.width + this.gap)}px;top:0"`) : "").join("");
    const extent = Math.max(window.totalExtent + expandedExtra, row.loadingItems.length * (dimension.width + this.gap) - this.gap, 0);
    // Section metrics include a potentially wrapped header. Feeding them back
    // into track height would grow that height on every measurement pass.
    const height = Math.max(this.trackHeights.get(row.rowKey) || 0, dimension.height);
    return { cards: cards + skeletons, extent, height: Math.max(1, height), offset: window.offset };
  }

  renderCardMarkup(row, item, index, rowIndex) {
    const key = cardCacheKey(row, item, index);
    const itemId = String(item.itemId || "");
    const itemIndex = Number(item.itemIndex ?? item.sourceIndex ?? index);
    const sourceIndex = Number.isFinite(Number(item.sourceIndex)) ? Number(item.sourceIndex) : null;
    const sourceRowIndex = Number.isFinite(Number(row.sourceRowIndex)) ? Number(row.sourceRowIndex) : null;
    const cached = this.cardMarkupCache.get(key);
    if (cached && cached.rowIndex === rowIndex && cached.itemIndex === itemIndex && cached.sourceIndex === sourceIndex &&
        cached.sourceRowIndex === sourceRowIndex && cached.logicalIndex === index && cached.cardStyle === row.cardStyle) {
      this.renderedCardKeys.add(key);
      return cached.markup;
    }
    const markup = this.renderCard(row, item, index, rowIndex);
    this.cardMarkupCache.set(key, { rowKey: row.rowKey, itemId, kind: row.kind, rowIndex, itemIndex, sourceIndex,
      sourceRowIndex, logicalIndex: index, cardStyle: row.cardStyle, markup });
    this.renderedCardKeys.add(key);
    return markup;
  }

  markup({ offset = 0, width = this.width, height = this.height } = {}) {
    this.renderedCardKeys = new Set();
    const window = this.metrics.getWindow({ offset, viewportExtent: height, overscan: 160, focusedRowKey: this.focus?.rowKey || "" });
    const visible = new Set(indices(window.ranges));
    const focusedNode = this.viewport?.querySelector(".focusable.focused") || null;
    const focusedRowKey = focusedNode?.dataset.navRowKey || "";
    const focusedItemIndex = Number(focusedNode?.dataset.navCol);
    const currentRow = focusedRowKey ? this.rowByKey.get(focusedRowKey) : null;
    if (currentRow) visible.add(currentRow.index);
    const expandedNode = this.viewport?.querySelector(".home-poster-card.is-expanded") || null;
    const expandedRowKey = expandedNode?.dataset.navRowKey || "";
    const expandedIndex = Number(expandedNode?.dataset.navCol);
    const expandedRow = expandedRowKey ? this.rowByKey.get(expandedRowKey) : null;
    const expandedWidth = expandedNode && expandedRow && expandedIndex >= 0 && visible.has(expandedRow.index)
      ? expandedNode.offsetWidth : 0;
    const context = { focusedRowKey, focusedItemIndex, expandedRowKey, expandedIndex, expandedWidth };
    const markup = [...visible].sort((a, b) => a - b).map(rowIndex => {
      const row = this.rows[rowIndex];
      const geometry = this.metrics.getRowMetrics(row.rowKey);
      const track = this.rowWindow(row, rowIndex, width, context);
      const continueClass = row.kind === "continue" ? `home-row-continue home-row-continue-${row.cardStyle}` : "home-modern-row";
      const key = this.escapeAttribute(row.rowKey);
      return `<section class="home-row ${continueClass}" data-row-key="${key}" data-row-index="${rowIndex}" style="position:absolute;top:${geometry.offset}px;left:0;width:100%;margin:0">
        <div class="home-row-head"><h2 class="home-row-title">${this.renderTitle(row)}</h2></div>
        <div class="home-track${row.kind === "continue" ? " home-track-continue" : ""}" data-track-row-key="${key}" style="display:block;position:relative;gap:0;overflow-anchor:none">
          <div class="home-data-track" style="position:relative;width:${track.extent}px;height:${track.height}px">${track.cards}</div>
        </div></section>`;
    }).join("");
    for (const key of this.cardMarkupCache.keys()) if (!this.renderedCardKeys.has(key)) this.cardMarkupCache.delete(key);
    return `<div class="home-data-window" style="position:relative;height:${window.totalExtent}px;flex-shrink:0;overflow-anchor:none">${markup}</div>`;
  }

  attach(viewport) {
    this.viewport = viewport;
    this.content = viewport?.querySelector(".home-modern-rows-scroll");
    if (!this.content) return;
    this.content.style.display = "block";
    this.content.style.gap = "0";
    this.viewport.style.overflowAnchor = "none";
    this.width = viewport.clientWidth || this.width;
    this.height = viewport.clientHeight || this.height;
    this.sync();
  }

  sync() {
    if (!this.content?.isConnected) return;
    this.captureTrackStates();
    const pendingAnchor = this.pendingScrollAnchor;
    const pendingRow = pendingAnchor && this.metrics.getRowMetrics(pendingAnchor.rowKey);
    const maxScrollTop = Math.max(0, this.metrics.totalExtent - (this.viewport.clientHeight || this.height));
    const intendedScrollTop = pendingRow
      ? Math.min(maxScrollTop, Math.max(0, pendingRow.offset + pendingAnchor.offset)) : this.viewport.scrollTop;
    const markup = this.markup({ offset: intendedScrollTop, width: this.viewport.clientWidth || this.width,
      height: this.viewport.clientHeight || this.height });
    if (markup !== this.lastMarkup) {
      updateKeyedDom(this.content, markup, { incremental: true, shellSelector: ".home-data-window",
        focusedNode: this.viewport.querySelector(".focusable.focused") });
      this.lastMarkup = markup;
      this.bindTracks();
      this.indexMountedNodes();
      this.onChange?.();
    }
    if (pendingAnchor) {
      this.pendingScrollAnchor = null;
      if (pendingRow) this.viewport.scrollTop = intendedScrollTop;
    }
    let changed = false;
    this.content.querySelectorAll(".home-row[data-row-key]").forEach(node => {
      const row = this.rowByKey.get(node.dataset.rowKey)?.row;
      const card = node.querySelector(".home-content-card:not(.is-expanded)");
      if (row && row.kind !== "collection" && card?.offsetWidth && card?.offsetHeight) {
        const previous = this.dimensions(row);
        if (Math.abs(previous.width - card.offsetWidth) > 1 || Math.abs(previous.height - card.offsetHeight) > 1) {
          this.sizes.set(row.rowKey, { width: card.offsetWidth, height: card.offsetHeight });
          changed = true;
        }
      }
      if (row?.kind === "collection") {
        node.querySelectorAll("[data-window-index]").forEach(cardNode => {
          if (cardNode.offsetWidth && !cardNode.classList.contains("is-expanded")) {
            changed = this.trackMetrics.get(row.rowKey)?.setMeasuredHeight(cardNode.dataset.windowIndex, cardNode.offsetWidth) || changed;
          }
          if (cardNode.offsetHeight > (this.trackHeights.get(row.rowKey) || 0)) {
            this.trackHeights.set(row.rowKey, cardNode.offsetHeight);
            changed = true;
          }
        });
      }
      changed = this.metrics.setMeasuredHeight(node.dataset.rowKey, node.getBoundingClientRect().height) || changed;
    });
    if (changed || Date.now() < Number(this.animateExpansionUntil || 0)) this.requestSync();
  }

  bindTracks() {
    for (const [track, handler] of this.trackHandlers) {
      if (!track.isConnected) { track.removeEventListener("scroll", handler); this.trackHandlers.delete(track); }
    }
    this.content.querySelectorAll(".home-track").forEach(track => {
      if (this.trackHandlers.has(track)) return;
      track.scrollLeft = this.trackStates.get(track.dataset.trackRowKey) || 0;
      const handler = () => {
        if (!track.isConnected || !this.rowByKey.has(track.dataset.trackRowKey)) return;
        this.trackStates.set(track.dataset.trackRowKey, track.scrollLeft);
        this.requestSync(); this.onTrackScroll?.(track.dataset.trackRowKey);
      };
      track.addEventListener("scroll", handler, { passive: true });
      this.trackHandlers.set(track, handler);
    });
  }

  indexMountedNodes() {
    this.mountedNodes.clear();
    this.content.querySelectorAll(".focusable[data-window-index]").forEach(node => {
      const rowKey = node.closest("[data-row-key]")?.dataset.rowKey;
      const rowIndex = this.rowByKey.get(rowKey)?.index || 0;
      node.dataset.navZone = "main";
      node.dataset.navRow = String(rowIndex);
      node.dataset.navCol = node.dataset.windowIndex;
      node.dataset.navRowKey = rowKey;
      this.mountedNodes.set(`${rowKey}:${node.dataset.windowIndex}`, node);
    });
  }

  requestSync() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); });
  }

  remember(node) {
    if (!node?.dataset.navRowKey || node.dataset.windowIndex == null) return;
    this.focus = resolveHomeLogicalFocus(this.rows, { ...this.focus, rowKey: node.dataset.navRowKey,
      itemIndex: Number(node.dataset.windowIndex), itemIdentity: getHomeFocusIdentity(node),
      preferredItemIndexByRowKey: this.focus?.preferredItemIndexByRowKey });
    this.requestSync();
  }

  target(state = this.focus, { restoreScroll = false } = {}) {
    this.focus = resolveHomeLogicalFocus(this.rows, state || {});
    if (!this.focus) return null;
    if (restoreScroll) {
      for (const [key, value] of Object.entries(state.trackStates || {})) if (this.rowByKey.has(key)) this.trackStates.set(key, Math.max(0, number(value, 0)));
      this.trackHandlers.forEach((_, track) => { track.scrollLeft = this.trackStates.get(track.dataset.trackRowKey) || 0; });
      this.sync();
      this.viewport.scrollTop = Math.max(0, number(state.mainScrollTop, 0));
    }
    this.sync();
    return this.mountedNodes.get(`${this.focus.rowKey}:${this.focus.itemIndex}`) || null;
  }

  move(direction) {
    const result = moveHomeLogicalFocus(this.rows, this.focus || {}, direction);
    if (!result || result.boundary || result.action) return { result, target: null };
    return { result, target: this.target(result) };
  }

  destroy() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.trackHandlers.forEach((handler, track) => track.removeEventListener("scroll", handler));
    this.trackHandlers.clear();
    this.mountedNodes.clear();
    this.cardMarkupCache.clear();
    this.renderedCardKeys?.clear();
    this.frame = 0;
    this.pendingScrollAnchor = null;
    this.viewport = null;
    this.content = null;
    this.onChange = null;
    this.onTrackScroll = null;
    this.rows = [];
    this.rowByKey.clear();
    this.trackStates.clear();
    this.trackMetrics.clear();
    this.measurementKeysByRow.clear();
    this.sizes.clear();
    this.trackHeights.clear();
    this.metrics.setRows([]);
    this.focus = null;
    this.lastMarkup = null;
    this.renderCard = null;
    this.renderTitle = null;
  }
}
