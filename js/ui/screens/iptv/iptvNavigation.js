// Pure D-pad transitions between the IPTV zones. The screen applies the
// returned focus to the DOM; indexes are logical positions, never DOM order.

export const ZONE = Object.freeze({
  SIDEBAR: "sidebar",
  HEADER: "header",
  CATEGORIES: "categories",
  GRID: "grid"
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createFocus(overrides = {}) {
  return { zone: ZONE.GRID, header: 0, category: 0, channel: 0, ...overrides };
}

// ctx: { headerCount, categoryCount, channelCount, columns }
// Returns { focus, handled, selectCategory }.
export function moveFocus(focus, direction, ctx) {
  const { headerCount = 0, categoryCount = 0, channelCount = 0, columns = 1 } = ctx;
  const next = { ...focus };
  const move = (patch, extra = {}) => ({ focus: { ...next, ...patch }, handled: true, ...extra });
  const stay = () => ({ focus: next, handled: true });

  switch (focus.zone) {
    case ZONE.SIDEBAR:
      if (direction === "right") return move({ zone: ZONE.HEADER });
      return stay();
    case ZONE.HEADER:
      if (direction === "left") {
        return focus.header > 0 ? move({ header: focus.header - 1 }) : move({ zone: ZONE.SIDEBAR });
      }
      if (direction === "right") return move({ header: clamp(focus.header + 1, 0, Math.max(0, headerCount - 1)) });
      if (direction === "down") {
        if (categoryCount > 0) return move({ zone: ZONE.CATEGORIES });
        if (channelCount > 0) return move({ zone: ZONE.GRID });
      }
      return stay();
    case ZONE.CATEGORIES:
      if (direction === "up") {
        return focus.category > 0 ? move({ category: focus.category - 1 }) : move({ zone: ZONE.HEADER });
      }
      if (direction === "down") return move({ category: clamp(focus.category + 1, 0, Math.max(0, categoryCount - 1)) });
      if (direction === "left") return move({ zone: ZONE.SIDEBAR });
      if (direction === "right" && channelCount > 0) return move({ zone: ZONE.GRID }, { selectCategory: true });
      return stay();
    case ZONE.GRID: {
      const index = clamp(focus.channel, 0, Math.max(0, channelCount - 1));
      const col = index % columns;
      if (direction === "left") {
        if (col > 0) return move({ channel: index - 1 });
        return categoryCount > 0 ? move({ zone: ZONE.CATEGORIES }) : move({ zone: ZONE.SIDEBAR });
      }
      if (direction === "right") {
        return col < columns - 1 && index + 1 < channelCount ? move({ channel: index + 1 }) : stay();
      }
      if (direction === "up") {
        return index - columns >= 0 ? move({ channel: index - columns }) : move({ zone: ZONE.HEADER });
      }
      if (direction === "down") {
        if (index + columns < channelCount) return move({ channel: index + columns });
        // Partial last row: land on its last item instead of getting stuck.
        const lastRow = Math.floor((channelCount - 1) / columns);
        if (Math.floor(index / columns) < lastRow) return move({ channel: channelCount - 1 });
      }
      return stay();
    }
    default:
      return { focus: next, handled: false };
  }
}

// Identity-first focus restore: cheap check at the remembered index, one scan
// only when the list changed (search/category/favorite/remove), nearest on miss.
export function resolveFocusIndex(items, identity, fallbackIndex = 0) {
  if (!items.length) return 0;
  const last = items.length - 1;
  const guess = clamp(Number.isFinite(fallbackIndex) ? Math.trunc(fallbackIndex) : 0, 0, last);
  if (!identity || items[guess]?.id === identity) return guess;
  const found = items.findIndex((item) => item.id === identity);
  return found >= 0 ? found : guess;
}
