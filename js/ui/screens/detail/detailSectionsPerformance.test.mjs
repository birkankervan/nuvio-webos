import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Router } = await import("../../navigation/routerState.js");
const { createMetaDetailsScreenMethods08 } = await import("./metaDetailsScreenMethods-08-render-external-ratings-row.js");
const { createMetaDetailsScreenMethods27 } = await import("./metaDetailsScreenMethods-27-on-pointer-move.js");

test("detail section updates coalesce and departed callbacks cannot affect the next detail", () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const originalTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalCurrent = Router.getCurrent;
  const callbacks = new Map();
  const cancelled = [];
  const applied = [];
  let nextId = 0;
  let route = "detail";
  try {
    globalThis.requestAnimationFrame = callback => { callbacks.set(++nextId, callback); return nextId; };
    globalThis.cancelAnimationFrame = function (id) {
      // Mirrors the browser: a native cancelAnimationFrame bound to another object throws.
      if (this && this !== globalThis) throw new TypeError("Illegal invocation");
      cancelled.push(id);
    };
    Router.getCurrent = () => route;
    const ctx = {
      ...createMetaDetailsScreenMethods08(),
      ...createMetaDetailsScreenMethods27(),
      container: { style: {}, querySelector: () => ({}) },
      detailLoadToken: 1,
      _renderDetailSectionsNow: (meta, focus) => applied.push({ meta, focus }),
      cancelTraktCommentsRequest() {}, cancelPendingEpisodeHold() {}, cancelPendingSeasonHold() {},
      cancelPendingPosterHold() {}, cancelPendingHeroHold() {}, destroyDetailHoldDialog() {},
      clearEpisodeTitleMarquee() {}, stopTrailerPlayback() {}
    };
    const a = { id: "a" };
    const latestA = { id: "latest-a" };
    const focus = { contentId: "a" };
    ctx.updateRenderedDetailSections(a, focus);
    const first = ctx._sectionsUpdateRaf;
    ctx.updateRenderedDetailSections(latestA);
    assert.equal(ctx._sectionsUpdateRaf, first, "one frame serves overlapping updates");
    callbacks.get(first)();
    assert.deepEqual(applied, [{ meta: latestA, focus }]);

    ctx.updateRenderedDetailSections(a, focus);
    const stale = ctx._sectionsUpdateRaf;
    ctx.cleanup();
    assert.ok(cancelled.includes(stale));
    assert.equal(ctx._pendingSectionsMeta, null);
    assert.equal(ctx._pendingSectionsFocusRestore, null);
    ctx.detailLoadToken++;
    const b = { id: "b" };
    ctx.updateRenderedDetailSections(b);
    const next = ctx._sectionsUpdateRaf;
    callbacks.get(stale)(); // A cancelled callback must also be harmless if already dispatched.
    assert.equal(ctx._sectionsUpdateRaf, next);
    assert.equal(ctx._pendingSectionsMeta, b);
    assert.equal(applied.length, 1);
    callbacks.get(next)();
    assert.deepEqual(applied[1], { meta: b, focus: null });

    ctx.updateRenderedDetailSections({ id: "hidden" });
    route = "home";
    callbacks.get(ctx._sectionsUpdateRaf)();
    assert.equal(applied.length, 2, "departed route never patches the detail container");
    ctx.cleanup();

    route = "detail";
    globalThis.requestAnimationFrame = undefined;
    globalThis.setTimeout = callback => { callbacks.set(++nextId, callback); return nextId; };
    globalThis.clearTimeout = id => cancelled.push(id);
    ctx.updateRenderedDetailSections({ id: "timer-fallback" });
    const timer = ctx._sectionsUpdateRaf;
    ctx.cleanup();
    assert.ok(cancelled.includes(timer), "fallback timer is cancelled with clearTimeout");
    callbacks.get(timer)();
    assert.equal(applied.length, 2);
  } finally {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
    globalThis.setTimeout = originalTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    Router.getCurrent = originalCurrent;
  }
});
