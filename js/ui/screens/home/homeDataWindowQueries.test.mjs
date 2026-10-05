import test from "node:test";
import assert from "node:assert/strict";
import { HomeDataWindow } from "./homeDataWindow.js";

const makeRow = (rowKey, count = 100) => ({ rowKey, kind: "catalog", loadingItems: [],
  items: Array.from({ length: count }, (_, itemIndex) => ({ itemId: `${rowKey}-${itemIndex}`, itemType: "movie",
    itemIndex, sourceIndex: itemIndex })) });

const makeRenderer = rows => new HomeDataWindow({ rows, escapeAttribute: value => String(value),
  renderTitle: row => row.rowKey,
  renderCard: (row, item, index) => `<article class="home-content-card focusable" data-item-id="${item.itemId}" data-item-index="${index}"></article>` });

test("markup snapshots viewport focus and expansion once for many visible rows", () => {
  const rows = Array.from({ length: 40 }, (_, index) => makeRow(`row-${index}`));
  const renderer = makeRenderer(rows);
  const focusedNode = { dataset: { navRowKey: "row-39", navCol: "47" } };
  let expandedWidthReads = 0;
  const expandedNode = { dataset: { navRowKey: "row-1", navCol: "2" },
    get offsetWidth() { expandedWidthReads++; return 320; } };
  const queries = [];
  renderer.viewport = { querySelector(selector) {
    queries.push(selector);
    return selector === ".focusable.focused" ? focusedNode : expandedNode;
  } };

  const markup = renderer.markup({ width: 900, height: 5000 });

  assert.equal(queries.length, 2);
  assert.deepEqual(queries, [".focusable.focused", ".home-poster-card.is-expanded"]);
  assert.ok((markup.match(/<section class="home-row/g) || []).length > 10, "fixture should render many rows");
  assert.match(markup, /data-row-key="row-39"[\s\S]*?data-window-index="47"/,
    "the old focused card stays mounted for the focus handoff");
  assert.equal(expandedWidthReads, 1);
  const expandedRowStart = markup.indexOf('data-row-key="row-1"');
  const expandedRowEnd = markup.indexOf("</section>", expandedRowStart);
  const expandedRowMarkup = markup.slice(expandedRowStart, expandedRowEnd);
  assert.match(expandedRowMarkup, /data-window-index="3" style="position:absolute;left:816px;top:0"/,
    "cards after the expanded item include its extra width");
  assert.match(expandedRowMarkup, /class="home-data-track" style="position:relative;width:23684px;/,
    "track extent includes the expanded width");
});

test("initial markup works without an attached viewport", () => {
  const renderer = makeRenderer([makeRow("detached", 1)]);
  assert.match(renderer.markup({ width: 900, height: 560 }), /data-item-id="detached-0"/);
});
