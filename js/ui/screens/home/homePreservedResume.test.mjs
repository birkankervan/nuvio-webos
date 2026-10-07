import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { HomeDataWindow } = await import("./homeDataWindow.js");
const { createHomeScreenMethods30 } = await import("./homeScreenMethods-30-cleanup.js");
const { Platform } = await import("./homeScreenContext.js");

const noopScreen = (base) => new Proxy(base, {
  get(target, key) {
    if (key in target) return target[key];
    // Methods are verbs; state fields such as homeRowVirtualizer stay undefined.
    return typeof key === "string" && /^(cancel|clear|collapse|destroy|end|persist|stop|teardown|unlock)/.test(key) ? () => {} : undefined;
  }
});

test("suspended data window keeps measurements and never syncs hidden DOM", () => {
  const row = { rowKey: "catalog", kind: "catalog", items: [{ source: { id: "one" } }], loadingItems: [], source: { catalogName: "Movies" } };
  const renderer = new HomeDataWindow({ rows: [row], renderCard: () => "", renderTitle: () => "Movies", escapeAttribute: String });
  renderer.metrics.setMeasuredHeight("catalog", 500);
  let markupCalls = 0;
  renderer.markup = () => { markupCalls++; return ""; };
  renderer.content = { isConnected: true };
  renderer.suspend();
  renderer.sync();
  assert.equal(markupCalls, 0, "hidden Home must not be re-rendered or measured");
  assert.equal(renderer.metrics.measuredHeights.get("catalog"), 500);
  renderer.pendingScrollAnchor = { rowKey: "catalog", offset: 0 };
  const savedRaf = globalThis.requestAnimationFrame;
  let scheduled = 0;
  globalThis.requestAnimationFrame = () => ++scheduled;
  try {
    renderer.resume();
  } finally {
    globalThis.requestAnimationFrame = savedRaf;
  }
  assert.equal(renderer.suspended, false);
  assert.equal(renderer.pendingScrollAnchor, null, "hidden-time anchor is dropped");
  assert.equal(scheduled, 1, "resume schedules a visible sync");
});

test("TV cleanup with preserved DOM suspends the renderer instead of destroying it", () => {
  const savedWebOs = Platform.isWebOS;
  const savedTizen = Platform.isTizen;
  try {
    const style = { removeProperty() {} };
    const container = { style, childNodes: [1], classList: { add() {}, remove() {} } };
    let destroyed = 0;
    let suspended = 0;
    const renderer = { destroy() { destroyed++; }, suspend() { suspended++; } };
    const run = (isTv) => {
      Platform.isWebOS = () => isTv;
      Platform.isTizen = () => false;
      const screen = noopScreen({ ...createHomeScreenMethods30(), container, hasLoadedOnce: true, rows: [{}], homeDataWindow: renderer });
      screen.cleanup();
      return screen;
    };
    const tv = run(true);
    assert.equal(tv.homeDataWindow, renderer);
    assert.equal(suspended, 1);
    assert.equal(destroyed, 0);
    assert.equal(tv.homeDomPreserved, true);

    const web = run(false);
    assert.equal(web.homeDataWindow, null);
    assert.equal(destroyed, 1);
  } finally {
    Platform.isWebOS = savedWebOs;
    Platform.isTizen = savedTizen;
  }
});

test("scroll frames skip row measurement unless markup changed; explicit syncs always measure", () => {
  const row = { rowKey: "catalog", kind: "catalog", items: [{ source: { id: "one" } }], loadingItems: [], source: { catalogName: "Movies" } };
  const renderer = new HomeDataWindow({ rows: [row], renderCard: () => "", renderTitle: () => "Movies", escapeAttribute: String });
  let measurePasses = 0;
  renderer.markup = () => "same";
  renderer.lastMarkup = "same";
  renderer.viewport = { clientHeight: 500, scrollTop: 0 };
  renderer.content = { isConnected: true, querySelectorAll: () => { measurePasses++; return []; } };
  renderer.captureTrackStates = () => ({});

  renderer.sync({ scrollFrame: true });
  renderer.sync({ scrollFrame: true });
  assert.equal(measurePasses, 0, "unchanged scroll frames must not force layout reads");
  renderer.sync();
  assert.equal(measurePasses, 1, "explicit sync re-measures (CSS-only size changes)");

  const savedRaf = globalThis.requestAnimationFrame;
  const frames = [];
  globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  try {
    renderer.requestSync({ scrollFrame: true });
    renderer.requestSync(); // a measuring request joins the pending scroll frame
    assert.equal(frames.length, 1);
    frames[0]();
    assert.equal(measurePasses, 2, "coalesced frame keeps the measuring request");

    renderer.requestSync({ scrollFrame: true });
    frames[1]();
    assert.equal(measurePasses, 2, "a pure scroll frame stays cheap");

    renderer.animateExpansionUntil = Date.now() + 1000;
    renderer.sync({ scrollFrame: true });
    assert.equal(measurePasses, 3, "expansion animation keeps measuring");
  } finally {
    globalThis.requestAnimationFrame = savedRaf;
  }
});

test("scroll frames inside an unchanged window skip markup and scrollLeft reads", () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ rowKey: `row-${index}`, kind: "catalog",
    items: [{ itemId: `item-${index}`, source: { id: `item-${index}` } }], loadingItems: [], source: { catalogName: "Movies" } }));
  const renderer = new HomeDataWindow({ rows, renderCard: () => "<article></article>", renderTitle: () => "Movies", escapeAttribute: String });
  const realMarkup = renderer.markup.bind(renderer);
  let markupCalls = 0;
  let captures = 0;
  renderer.markup = options => { markupCalls++; return realMarkup(options); };
  renderer.captureTrackStates = () => { captures++; return {}; };
  renderer.viewport = { clientHeight: 560, clientWidth: 900, scrollTop: 0, querySelector: () => null };
  renderer.content = { isConnected: true, querySelectorAll: () => [] };
  renderer.patchWindowRows = () => true;
  renderer.bindTracks = () => {};
  renderer.indexMountedNodes = () => {};

  renderer.sync();
  assert.equal(markupCalls, 1);
  renderer.viewport.scrollTop = 4; // spring frame, same mounted rows
  renderer.sync({ scrollFrame: true });
  assert.equal(markupCalls, 1, "unchanged window must not rebuild markup");
  assert.equal(captures, 1, "scroll frames rely on track handlers, not scrollLeft reads");

  renderer.viewport.scrollTop = 4000; // far enough to mount other rows
  renderer.sync({ scrollFrame: true });
  assert.equal(markupCalls, 2, "a changed window rebuilds markup");

  renderer.trackStates.set(renderer.rows[renderer.verticalWindow(4000, 560).ranges[0].start].rowKey, 300);
  renderer.sync({ scrollFrame: true });
  assert.equal(markupCalls, 3, "a horizontal offset change rebuilds markup");
});
