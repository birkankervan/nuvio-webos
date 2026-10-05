import { test } from "node:test";
import assert from "node:assert/strict";
import { renderModernHomeLayout } from "./modernHomeLayout.js";

test("Modern shell consumes window markup without generating catalog or CW cards", () => {
  const rows = Array.from({ length: 20 }, (_, rowIndex) => ({
    homeCatalogKey: `row-${rowIndex}`, addonId: "fixture", catalogId: `catalog-${rowIndex}`,
    type: "movie", catalogName: "Fixture", supportsSkip: true,
    result: { status: "success", data: { items: Array.from({ length: 100 }, (_, index) => ({ id: `item-${index}` })), nextSkip: 100, hasMore: true } }
  }));
  let cards = 0;
  let continueSections = 0;
  const options = { rows, continueWatchingItems: [{ id: "continue" }], upcomingItems: [{ id: "upcoming" }],
    createPosterCardMarkup: () => { cards++; return "<article></article>"; },
    renderContinueWatchingSection: () => { continueSections++; return ""; },
    formatCatalogRowTitle: name => name, escapeHtml: String, escapeAttribute: String };
  const windowMarkup = '<div class="home-data-window"><article data-window-index="200"></article></div>';
  const bounded = renderModernHomeLayout({ ...options, virtualRowsMarkup: windowMarkup });
  assert.equal(cards, 0, "the full catalog must never be generated before windowing");
  assert.equal(continueSections, 0, "CW rows must use the same bounded renderer");
  assert.ok(bounded.markup.includes(windowMarkup));
  assert.equal(bounded.catalogSeeAllMap.size, 20);
  const catalog = bounded.catalogSeeAllMap.get("fixture_catalog-0_movie");
  assert.equal(catalog.initialItems, rows[0].result.data.items);
  assert.equal(catalog.initialNextSkip, 100);
  assert.equal(catalog.initialHasMore, true);
  renderModernHomeLayout({ ...options, virtualRowsMarkup: "" });
  assert.equal(cards, 0, "an empty data window must not fall back to full markup");
  renderModernHomeLayout(options);
  assert.equal(cards, 20 * 15, "the existing non-window rendering limit must remain intact");
  assert.equal(continueSections, 2);
});
