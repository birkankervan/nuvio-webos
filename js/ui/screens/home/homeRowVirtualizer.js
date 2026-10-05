// ponytail: cache detached rows to preserve focus/track state. This bounds live
// layout/paint work, not retained heap; data-based remounting can replace the cache.
export class HomeRowVirtualizer {
  constructor(viewport) {
    this.viewport = viewport;
    this.records = [];
    this.frame = 0;
    this.cardOwners = new WeakMap();
    this.refresh();
  }

  refresh() {
    this.restore();
    this.records.forEach(({ track, onScroll }) => track?.removeEventListener("scroll", onScroll));
    this.records = Array.from(this.viewport.querySelectorAll(".home-row[data-row-key]"), (row) => {
      // Reattaching a window must not restart the row's entrance animation.
      row.classList.remove("home-row-enter");
      const spacer = row.ownerDocument.createElement("section");
      spacer.className = row.className.replace(/\bhome-row-enter\b/g, "") + " home-virtual-row-placeholder";
      const style = getComputedStyle(row);
      spacer.style.cssText = "box-sizing:border-box;min-height:0;max-height:none;padding:0;border:0;";
      spacer.style.margin = style.margin;
      spacer.setAttribute("aria-hidden", "true");
      spacer.style.flexShrink = "0";
      spacer.style.visibility = "hidden";
      const track = row.querySelector(".home-track");
      const record = { row, spacer, track, scrollLeft: 0, detached: false, cards: [] };
      record.onScroll = () => this.requestSync();
      track?.addEventListener("scroll", record.onScroll, { passive: true });
      this.readCards(record);
      return record;
    });
    this.sync();
  }

  mount(target) {
    const owner = typeof target === "string" ? null : this.cardOwners.get(target);
    const record = owner?.record || this.records.find(({ row }) =>
      typeof target === "string" ? row.dataset.rowKey === target : row === target || row.contains(target)
    );
    if (!record) return;
    if (record.detached) {
      record.spacer.replaceWith(record.row);
      record.detached = false;
      if (record.track) record.track.scrollLeft = record.scrollLeft;
    }
    if (owner?.card.detached) {
      owner.card.spacer.replaceWith(owner.card.node);
      owner.card.detached = false;
    }
    this.requestSync();
  }

  readCards(record) {
    record.cards = Array.from(record.track?.querySelectorAll(".home-content-card.focusable") || [], (node) => {
      const spacer = node.ownerDocument.createElement("div");
      spacer.className = "home-virtual-card-placeholder";
      spacer.setAttribute("aria-hidden", "true");
      const style = getComputedStyle(node);
      spacer.style.cssText = "box-sizing:border-box;flex-shrink:0;visibility:hidden;pointer-events:none;";
      spacer.style.margin = style.margin;
      spacer.style.width = `${node.offsetWidth}px`;
      spacer.style.height = `${node.offsetHeight}px`;
      const card = { node, spacer, detached: false };
      this.cardOwners.set(node, { record, card });
      return card;
    });
  }

  getTrackCards(track) {
    const record = this.records.find(record => record.track === track);
    return record ? record.cards.map(card => card.node) : Array.from(track?.querySelectorAll(".home-content-card.focusable") || []);
  }

  refreshTrack(track) {
    const record = this.records.find(record => record.track === track);
    if (!record) return;
    this.restoreCards(record);
    this.readCards(record);
    this.requestSync();
  }

  restoreCards(record) {
    record.cards.forEach(card => {
      if (!card.detached) return;
      card.spacer.replaceWith(card.node);
      card.detached = false;
    });
  }

  getCardChanges(record) {
    if (record.detached || !record.track?.clientWidth) return [];
    const rect = record.track.getBoundingClientRect();
    const margin = Math.max(240, record.track.clientWidth * 0.5);
    const active = this.viewport.ownerDocument.activeElement;
    return record.cards.map(card => {
      const box = (card.detached ? card.spacer : card.node).getBoundingClientRect();
      return { card, width: card.node.offsetWidth, height: card.node.offsetHeight,
        keep: card.node === active || card.node.contains(active) || card.node.classList.contains("focused") ||
        (box.right >= rect.left - margin && box.left <= rect.right + margin) };
    });
  }

  sync() {
    if (!this.viewport.isConnected || !this.viewport.clientHeight) return;
    const viewportRect = this.viewport.getBoundingClientRect();
    const margin = Math.max(240, this.viewport.clientHeight * 0.5);
    const activeRow = this.viewport.ownerDocument.activeElement?.closest?.(".home-row");
    const focusedRow = this.viewport.querySelector(".focusable.focused")?.closest(".home-row");
    // Read all geometry before changing the live row tree.
    const changes = this.records.map((record) => {
      const node = record.detached ? record.spacer : record.row;
      const rect = node.getBoundingClientRect();
      const focused = record.row === activeRow || record.row === focusedRow;
      return { record, height: rect.height, keep: focused ||
        (rect.bottom >= viewportRect.top - margin && rect.top <= viewportRect.bottom + margin) };
    });
    let changed = false;
    changes.forEach(({ record, height, keep }) => {
      if (keep && record.detached) {
        record.spacer.replaceWith(record.row);
        record.detached = false;
        if (record.track) record.track.scrollLeft = record.scrollLeft;
        changed = true;
      } else if (!keep && !record.detached && height > 0) {
        record.spacer.style.height = `${height}px`;
        record.scrollLeft = record.track?.scrollLeft || 0;
        record.row.replaceWith(record.spacer);
        record.detached = true;
        changed = true;
      }
    });
    const cardChanges = this.records.flatMap(record => this.getCardChanges(record));
    cardChanges.forEach(({ card, keep, width, height }) => {
      if (keep && card.detached) {
        card.spacer.replaceWith(card.node);
        card.detached = false;
        changed = true;
      } else if (!keep && !card.detached && width > 0) {
        card.spacer.style.width = `${width}px`;
        card.spacer.style.height = `${height}px`;
        card.node.replaceWith(card.spacer);
        card.detached = true;
        changed = true;
      }
    });
    if (changed) this.onChange?.();
  }

  requestSync() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); });
  }

  captureTrackStates() {
    return Object.fromEntries(this.records.filter(({ track }) => track).map(({ row, track, detached, scrollLeft }) =>
      [row.dataset.rowKey, detached ? scrollLeft : track.scrollLeft]
    ));
  }

  restore() {
    this.records.forEach((record) => {
      this.restoreCards(record);
      if (!record.detached) return;
      record.spacer.replaceWith(record.row);
      record.detached = false;
      if (record.track) record.track.scrollLeft = record.scrollLeft;
    });
  }

  destroy() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.restore();
    this.records.forEach(({ track, onScroll }) => track?.removeEventListener("scroll", onScroll));
    this.records = [];
    this.onChange = null;
  }
}
