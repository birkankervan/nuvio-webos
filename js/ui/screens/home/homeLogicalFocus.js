import { getHomeFocusIdentity } from "./homeFocusPolicy.js";

const identityFields = ["itemType", "videoId", "season", "episode"];
const indexWithin = (value, length) => Math.max(0, Math.min(length - 1, Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0));
const identityOf = (item) => getHomeFocusIdentity({ dataset: item });

function matchesIdentity(item, identity) {
  const candidate = identityOf(item);
  return Boolean(candidate && candidate.itemId === identity.itemId &&
    identityFields.every(field => !identity[field] || candidate[field] === identity[field]));
}

function focusAt(rows, rowIndex, itemIndex, preferredItemIndexByRowKey) {
  const row = rows[rowIndex];
  const index = indexWithin(itemIndex, row.items.length);
  return {
    rowKey: row.rowKey,
    rowIndex,
    itemIndex: index,
    itemIdentity: identityOf(row.items[index]),
    preferredItemIndexByRowKey: { ...preferredItemIndexByRowKey, [row.rowKey]: index }
  };
}

/** Rows contain full logical item identities, never DOM nodes or only the visible slice. */
export function resolveHomeLogicalFocus(rows = [], state = {}) {
  if (!rows.length) return null;
  state = state || {};
  let rowIndex = rows.findIndex(row => row.rowKey === state.rowKey);
  if (rowIndex < 0) rowIndex = indexWithin(state.rowIndex, rows.length);
  if (!rows[rowIndex].items?.length) {
    const nextIndex = rows.findIndex((row, index) => index >= rowIndex && row.items?.length);
    if (nextIndex >= 0) rowIndex = nextIndex;
    else {
      while (rowIndex >= 0 && !rows[rowIndex].items?.length) rowIndex--;
      if (rowIndex < 0) return null;
    }
  }
  const row = rows[rowIndex];
  const preferred = Object.fromEntries(rows
    .filter(entry => Object.prototype.hasOwnProperty.call(state.preferredItemIndexByRowKey || {}, entry.rowKey))
    .map(entry => [entry.rowKey, state.preferredItemIndexByRowKey[entry.rowKey]]));
  let itemIndex = indexWithin(state.rowKey === row.rowKey ? state.itemIndex : preferred[row.rowKey], row.items.length);
  const identity = identityOf(state.itemIdentity);
  if (state.rowKey === row.rowKey && identity && !matchesIdentity(row.items[itemIndex], identity)) {
    // The usual key press checks one item; a reorder scans data once, without DOM queries.
    const identityIndex = row.items.findIndex(item => matchesIdentity(item, identity));
    if (identityIndex >= 0) itemIndex = identityIndex;
  }
  return focusAt(rows, rowIndex, itemIndex, preferred);
}

/** Boundary decisions are returned to the screen (sidebar, pagination, hero rotation). */
export function moveHomeLogicalFocus(rows = [], state = {}, direction) {
  const focus = resolveHomeLogicalFocus(rows, state);
  if (!focus) return null;
  const result = { ...focus, boundary: null, action: null };
  const row = rows[focus.rowIndex];
  if (direction === "left" || direction === "right") {
    if (row.kind === "hero") return { ...result, action: "rotateHero", delta: direction === "right" ? 1 : -1 };
    const index = focus.itemIndex + (direction === "right" ? 1 : -1);
    if (index < 0 || index >= row.items.length) return { ...result, boundary: direction };
    return { ...focusAt(rows, focus.rowIndex, index, focus.preferredItemIndexByRowKey), boundary: null, action: null };
  }
  if (direction === "up" || direction === "down") {
    const delta = direction === "down" ? 1 : -1;
    let rowIndex = focus.rowIndex + delta;
    while (rowIndex >= 0 && rowIndex < rows.length && !rows[rowIndex].items?.length) rowIndex += delta;
    if (rowIndex < 0 || rowIndex >= rows.length) return { ...result, boundary: direction === "up" ? "top" : "bottom" };
    // Keep current Home behavior: each row remembers its own column, new rows start at zero.
    return { ...focusAt(rows, rowIndex, focus.preferredItemIndexByRowKey[rows[rowIndex].rowKey],
      focus.preferredItemIndexByRowKey), boundary: null, action: null };
  }
  return result;
}
