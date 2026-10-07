import { clampScroll, computeChannelWindow, scrollToReveal } from "./iptvChannelWindow.js";

// Windowed list/grid renderer. Data lives in `items`; only the nodes of the
// current window exist in the DOM and they are recycled (moved + rebound)
// instead of recreated while scrolling. The focused item is a logical index,
// so focus survives re-windowing and never depends on DOM child order.

const FALLBACK_VIEWPORT_HEIGHT = 720;

export function createVirtualList({
  viewport,
  columns = 1,
  rowHeight,
  overscanRows = 1,
  className = "",
  createNode,
  bindNode
}) {
  const track = document.createElement("div");
  track.className = `iptv-vlist-track ${className}`.trim();
  track.style.position = "relative";
  viewport.appendChild(track);

  let items = [];
  let scrollTop = 0;
  let focusIndex = -1;
  let viewportHeight = FALLBACK_VIEWPORT_HEIGHT;
  let mounted = new Map(); // logical index -> node
  let pool = [];
  let focusedNode = null;

  const geometry = () => ({ count: items.length, columns, rowStride: rowHeight, viewportHeight });

  function measure() {
    viewportHeight = viewport.clientHeight || viewportHeight;
  }

  function place(node, index) {
    const row = Math.floor(index / columns);
    node.style.top = `${row * rowHeight}px`;
    node.style.left = `${((index % columns) * 100) / columns}%`;
  }

  function sync() {
    const win = computeChannelWindow({ ...geometry(), scrollTop, overscanRows, focusedIndex: focusIndex });
    scrollTop = win.scrollTop;
    track.style.height = `${win.totalHeight}px`;
    track.style.transform = `translate3d(0,${-scrollTop}px,0)`;
    const wanted = new Set();
    for (const range of win.ranges) for (let i = range.start; i < range.end; i += 1) wanted.add(i);
    for (const [index, node] of mounted) {
      if (!wanted.has(index)) {
        mounted.delete(index);
        pool.push(node);
      }
    }
    for (const index of wanted) {
      if (mounted.has(index)) continue;
      let node = pool.pop();
      if (!node) {
        node = createNode();
        node.style.position = "absolute";
        node.style.height = `${rowHeight}px`;
        node.style.width = `${100 / columns}%`;
        track.appendChild(node);
      }
      node.dataset.index = String(index);
      place(node, index);
      bindNode(node, items[index], index);
      mounted.set(index, node);
    }
    // Nodes beyond the window are dropped, so the DOM never exceeds the budget.
    for (const node of pool) node.remove();
    pool = [];
    paintFocus();
  }

  function paintFocus() {
    const next = focusIndex >= 0 ? mounted.get(focusIndex) || null : null;
    if (focusedNode && focusedNode !== next) focusedNode.classList.remove("focused");
    if (next) next.classList.add("focused");
    focusedNode = next;
  }

  return {
    // reveal: index to bring into view without marking it focused.
    setItems(nextItems, { focus = -1, scroll = 0, reveal = -1 } = {}) {
      items = nextItems;
      focusIndex = focus;
      measure();
      scrollTop = clampScroll(scroll, geometry());
      const target = focusIndex >= 0 ? focusIndex : reveal;
      if (target >= 0 && target < items.length) scrollTop = scrollToReveal(scrollTop, target, geometry());
      pool = Array.from(mounted.values());
      mounted = new Map();
      focusedNode?.classList.remove("focused");
      focusedNode = null;
      sync();
    },
    // index -1 clears the focus mark but keeps the scroll position.
    setFocus(index) {
      focusIndex = index >= 0 && index < items.length ? index : -1;
      if (focusIndex < 0) return paintFocus();
      const nextScroll = scrollToReveal(scrollTop, focusIndex, geometry());
      if (nextScroll !== scrollTop || !mounted.has(focusIndex)) {
        scrollTop = nextScroll;
        sync();
      } else {
        paintFocus();
      }
    },
    // Rebind mounted nodes after external state (selected category, favorites) changed.
    refresh() {
      for (const [index, node] of mounted) bindNode(node, items[index], index);
    },
    getScrollTop: () => scrollTop,
    getMountedCount: () => mounted.size,
    getItems: () => items,
    destroy() {
      track.remove();
      mounted = new Map();
      pool = [];
      items = [];
      focusedNode = null;
    }
  };
}
