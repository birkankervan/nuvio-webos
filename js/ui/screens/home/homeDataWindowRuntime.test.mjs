import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { createHomeScreenMethods31 } = await import("./homeScreenMethods-31-data-window.js");
const { HomeDataWindow } = await import("./homeDataWindow.js");
const { createHomeScreenMethods04 } = await import("./homeScreenMethods-04-get-hero-focus-delay.js");
const { createHomeScreenMethods23 } = await import("./homeScreenMethods-23-render.js");
const { createHomeScreenMethods19 } = await import("./homeScreenMethods-19-handle-home-dpad.js");
const { catalogRepository } = await import("../../../data/repository/catalogRepository.js");
const { Router } = await import("../../navigation/routerState.js");

test("dirty metadata keeps measured geometry while loading and collection shape changes invalidate it", () => {
  const catalog = { rowKey: "catalog", kind: "catalog", isLoading: false, items: [{ source: { id: "one" } }],
    loadingItems: [], source: { catalogName: "Movies" } };
  let titleCalls = 0;
  const renderer = new HomeDataWindow({ rows: [catalog], renderCard: () => "", renderTitle: row => { titleCalls++; return row.source.catalogName; },
    escapeAttribute: String });
  renderer.sizes.set("catalog", { width: 350, height: 380 });
  renderer.metrics.setMeasuredHeight("catalog", 500);
  renderer.setRows([{ ...catalog, source: { ...catalog.source, catalogName: "Movies Updated", metadataVersion: 2 } }], null,
    { dirtyRows: ["catalog"] });
  assert.deepEqual(renderer.sizes.get("catalog"), { width: 350, height: 380 });
  assert.equal(renderer.metrics.measuredHeights.get("catalog"), 500);
  assert.notEqual(renderer.metrics.rows[0].estimatedHeight, 500);
  assert.equal(titleCalls, 0, "setRows should defer visible title rendering to markup");

  renderer.setRows([{ ...catalog, isLoading: true }], null, { dirtyRows: ["catalog"] });
  assert.equal(renderer.sizes.has("catalog"), false);
  assert.equal(renderer.metrics.measuredHeights.has("catalog"), false);

  const collection = { rowKey: "collection", kind: "collection", isLoading: false,
    items: [{ source: { tileShape: "POSTER" } }, { source: { tileShape: "LANDSCAPE" } }],
    loadingItems: [], source: { collectionTitle: "Collection" } };
  renderer.setRows([collection], null, { dirtyRows: ["collection"] });
  const track = renderer.trackMetrics.get("collection");
  track.setMeasuredHeight("0", 215);
  track.setMeasuredHeight("1", 321);
  renderer.trackHeights.set("collection", 400);
  renderer.metrics.setMeasuredHeight("collection", 420);
  const appended = { ...collection, source: { collectionTitle: "Collection Updated" },
    items: [...collection.items, { source: { tileShape: "LANDSCAPE" } }] };
  renderer.setRows([appended], null, { dirtyRows: ["collection"] });
  assert.equal(track.measuredHeights.get("0"), 215);
  assert.equal(track.measuredHeights.get("1"), 321);
  assert.equal(track.measuredHeights.has("2"), false);
  assert.equal(renderer.trackHeights.get("collection"), 400);
  assert.equal(renderer.metrics.measuredHeights.get("collection"), 420);

  const changedShape = { ...appended, items: [appended.items[0], { source: { tileShape: "SQUARE" } }, appended.items[2]] };
  renderer.setRows([changedShape], null, { dirtyRows: ["collection"] });
  assert.equal(track.measuredHeights.get("0"), 215);
  assert.equal(track.measuredHeights.has("1"), false, "only the changed collection index loses its width measurement");
  assert.equal(renderer.trackHeights.get("collection"), 400, "same maximum shape height preserves row geometry");
  assert.equal(renderer.metrics.measuredHeights.get("collection"), 420);

  const shrunk = { ...changedShape, items: [collection.items[1], collection.items[1]] };
  renderer.setRows([shrunk], null, { dirtyRows: ["collection"] });
  assert.equal(track.measuredHeights.size, 0, "shape changes at retained indexes are invalidated");
  assert.equal(renderer.trackHeights.get("collection"), 212 * 0.844);
  assert.equal(renderer.metrics.measuredHeights.has("collection"), false);
  renderer.destroy();
});

test("real Home factory builds only bounded cards and preserves source/logical indexes", () => {
  const items = Array.from({ length: 300 }, (_, index) => ({ id: `item${index}`, type: "movie", name: `Title ${index}` }));
  items[0] = { id: "" };
  const home = { ...createHomeScreenMethods31(), layoutMode: "modern", layoutPrefs: {}, rows: [{ addonId: "a", catalogId: "movies", type: "movie",
    result: { status: "success", data: { items } } }], continueWatchingLoading: false };
  const renderer = home.createDataHomeWindow({ main: [], upcoming: [] }, 3,
    { rowKey: "a_movie_movies", itemIndex: 200 });
  const markup = renderer.markup({ width: 900, height: 560 });
  assert.ok((markup.match(/<article\b/g) || []).length < 10);
  assert.ok(markup.includes('data-window-index="200"'));
  assert.ok(markup.includes('data-item-index="201"'));
  assert.ok(markup.includes('data-item-id="item201"'));
  assert.equal(markup.includes('data-item-id="item100"'), false);
  assert.equal(home.restoreDataHomeFocus({ layoutMode: "classic", rowKey: "a_movie_movies" }), false);
  renderer.trackStates.set("removed", 1234);
  renderer.sizes.set("a_movie_movies", { width: 222, height: 333 });
  const replacement = home.createDataHomeWindow({ main: [], upcoming: [] }, 3);
  assert.equal(replacement.trackStates.has("removed"), false);
  assert.deepEqual(replacement.sizes.get("a_movie_movies"), { width: 222, height: 333 });
  assert.equal(renderer.renderCard, null);
  assert.equal(renderer.rows.length, 0);
  replacement.destroy();
});

test("Modern D-pad uses logical target even when mounted nav projection has a different order", () => {
  const current = { dataset: { navRowKey: "far", navCol: "200" }, classList: { contains: () => false } };
  const target = { dataset: { navRowKey: "far", navCol: "201", itemIndex: "250" } };
  let direction;
  let applied;
  const home = { ...createHomeScreenMethods19(), navModel: { rows: [[{}]], sidebar: [] }, layoutMode: "modern",
    container: {}, getCurrentFocusedNode: () => current, isMainNode: () => false, isSidebarNode: () => false,
    scheduleDetailScreenPrefetch() {},
    homeDataWindow: { remember: node => assert.equal(node, current), move(value) { direction = value; return { target, result: {} }; } },
    focusNode(previous, next) { assert.equal(previous, current); applied = next; return true; } };
  assert.equal(home.handleHomeDpad({ keyCode: 39, preventDefault() {} }), true);
  assert.equal(direction, "right");
  assert.equal(applied, target);
});

test("pagination follows data across same-route renderer replacement and drops departed generations", async () => {
  const original = { setTimeout, clearTimeout, getCatalog: catalogRepository.getCatalog, current: Router.getCurrent };
  const timers = new Map();
  let timerId = 0;
  let resolvePage;
  let commits = 0;
  try {
    globalThis.setTimeout = callback => { timers.set(++timerId, callback); return timerId; };
    globalThis.clearTimeout = id => timers.delete(id);
    Router.getCurrent = () => "home";
    catalogRepository.getCatalog = () => new Promise(resolve => { resolvePage = resolve; });
    const makeRenderer = payload => ({ rowByKey: new Map([["row", { row: { kind: "catalog", items: payload.items,
      source: { addonId: "a", catalogId: "c", type: "movie", result: { data: payload } } } }]]),
      focus: { rowKey: "row", itemIndex: 99 }, trackStates: new Map(), width: 900, gap: 24,
      dimensions: () => ({ width: 212 }) });
    const payload = { hasMore: true, items: Array.from({ length: 100 }, (_, i) => ({ id: `item${i}` })), nextSkip: 100 };
    const home = { ...createHomeScreenMethods31(), homeLoadToken: 1, homeDataWindow: makeRenderer(payload),
      refreshDataHomeWindow() { commits++; } };
    home.scheduleDataHomePagination("row");
    const task = timers.get(timerId)();
    const replacementPayload = { ...payload, items: [...payload.items] };
    home.homeDataWindow = makeRenderer(replacementPayload);
    resolvePage({ status: "success", data: { items: [{ id: "item100" }], nextSkip: 101, hasMore: false } });
    await task;
    assert.equal(payload.items.length, 100);
    assert.equal(replacementPayload.items.length, 101);
    assert.equal(commits, 1);
    assert.equal(home._trackPaginationInFlight.size, 0);
    replacementPayload.hasMore = true;
    home.scheduleDataHomePagination("row");
    const stale = timers.get(timerId)();
    home.homeLoadToken++;
    resolvePage({ status: "success", data: { items: [{ id: "stale" }] } });
    await stale;
    assert.equal(commits, 1);
    assert.equal(replacementPayload.items.some(item => item.id === "stale"), false);
    home.cancelDataHomePagination();
    assert.equal(home.dataHomePaginationTimers.size, 0);
  } finally {
    globalThis.setTimeout = original.setTimeout;
    globalThis.clearTimeout = original.clearTimeout;
    catalogRepository.getCatalog = original.getCatalog;
    Router.getCurrent = original.current;
  }
});

test("scheduled Home render commits catalog data into the mounted Modern renderer", () => {
  const original = { requestAnimationFrame: globalThis.requestAnimationFrame, current: Router.getCurrent };
  const frames = [];
  const rowKey = "a_movie_movies";
  const row = { homeCatalogKey: rowKey, addonId: "a", catalogId: "movies", type: "movie",
    result: { status: "success", data: { items: [{ id: "one", name: "One" }] } } };
  const shell = {};
  const viewport = { isConnected: true, scrollTop: 84 };
  const content = { isConnected: true };
  const renderer = {
    rows: [], focus: null, viewport, content, syncs: 0, invalidation: null,
    setRows(rows, focus, invalidation) { this.rows = rows; this.focus = focus; this.invalidation = invalidation; },
    sync() { this.syncs++; }
  };
  const home = {
    ...createHomeScreenMethods04(), ...createHomeScreenMethods23(), ...createHomeScreenMethods31(),
    container: { querySelector: selector => selector === ".home-shell" ? shell : null },
    layoutMode: "modern", layoutPrefs: { heroSectionEnabled: false, continueWatchingEnabled: true },
    rows: [row], continueWatchingDisplay: [], continueWatchingLoading: false, homeDataWindow: renderer,
    isInitialHomeLoading: false, homeRouteEnterPending: false, isRestoringFocusFromBack: false,
    pendingBackFocusState: null, homeHoldFocusLocked: false, forceInitialContinueWatchingFocus: false,
    pendingContinueWatchingFocusIndex: null, pendingPosterHoldFocus: null, renderedMarkup: "old markup",
    renderedDataHomeSettingsKey: "", getCurrentFocusedNode: () => null,
    getBackgroundRenderDelay: () => 0, shouldDeferHomeRenderForInput: () => false
  };
  home.renderedDataHomeSettingsKey = home.getDataHomeRenderSettingsKey();
  try {
    Router.getCurrent = () => "home";
    globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    row.result.data.items.push({ id: "two", name: "Two" });
    home.requestBackgroundRender({ dirtyRows: [rowKey], hero: true });
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.equal(home.homeDataWindow, renderer);
    assert.equal(renderer.syncs, 1);
    assert.equal(renderer.rows.find(entry => entry.rowKey === rowKey)?.items.length, 2);
    assert.equal(renderer.invalidation.dirtyRows.has(rowKey), true);
    assert.equal(home.container.querySelector(".home-shell"), shell);
    assert.equal(home.renderedMarkup, null);

    home.layoutPrefs = { ...home.layoutPrefs, posterLabelsEnabled: false };
    assert.equal(home.commitModernHomeDataUpdate({ dirtyRows: new Set([rowKey]) }), false,
      "settings changes must stay on the complete render path");
    assert.equal(renderer.syncs, 1);
  } finally {
    globalThis.requestAnimationFrame = original.requestAnimationFrame;
    Router.getCurrent = original.current;
  }
});

test("scheduled Home data render abandons a frame after route departure", () => {
  const original = { requestAnimationFrame: globalThis.requestAnimationFrame, current: Router.getCurrent };
  const frames = [];
  const home = { ...createHomeScreenMethods04(), container: {}, getBackgroundRenderDelay: () => 0,
    shouldDeferHomeRenderForInput: () => false, render() { throw new Error("departed Home rendered"); } };
  try {
    Router.getCurrent = () => "home";
    globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    home.requestBackgroundRender({ dirtyRows: ["row"] });
    Router.getCurrent = () => "detail";
    frames.shift()();
    assert.equal(home.homeRenderFrame, null);
  } finally {
    globalThis.requestAnimationFrame = original.requestAnimationFrame;
    Router.getCurrent = original.current;
  }
});

test("a removed focused last row falls back to a complete Home render when logical focus is gone", () => {
  const rowKey = "last-row";
  const focused = { isConnected: true };
  const renderer = { viewport: { isConnected: true, scrollTop: 0 }, content: { isConnected: true },
    focus: { rowKey, itemIndex: 1 }, captureTrackStates: () => ({}) };
  const home = { ...createHomeScreenMethods31(), layoutMode: "modern", layoutPrefs: { heroSectionEnabled: false },
    homeDataWindow: renderer, isInitialHomeLoading: false, homeRouteEnterPending: false,
    isRestoringFocusFromBack: false, pendingBackFocusState: null, homeHoldFocusLocked: false,
    forceInitialContinueWatchingFocus: false, pendingContinueWatchingFocusIndex: null,
    pendingPosterHoldFocus: null, renderedDataHomeSettingsKey: "", getCurrentFocusedNode: () => focused,
    container: { querySelector: selector => selector === ".home-shell" ? {} : null },
    refreshDataHomeWindow() { renderer.focus = null; focused.isConnected = false; },
    restoreDataHomeFocus: () => false };
  home.renderedDataHomeSettingsKey = home.getDataHomeRenderSettingsKey();
  assert.equal(home.commitModernHomeDataUpdate({ dirtyRows: new Set([rowKey]) }), false,
    "the incremental path must yield when the removed last card has no logical successor");
});
