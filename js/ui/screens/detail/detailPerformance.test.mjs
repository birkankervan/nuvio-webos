import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Router } = await import("../../navigation/routerState.js");
const { createMetaDetailsScreenMethods02 } = await import("./metaDetailsScreenMethods-02-mount.js");

test("detail paints a loading shell before fetching and cancels a departed route", async () => {
  const originalDocument = globalThis.document;
  const originalRaf = globalThis.requestAnimationFrame;
  const originalTimeout = globalThis.setTimeout;
  const originalCurrent = Router.getCurrent;
  const frames = [];
  const tasks = [];
  let loads = 0;
  const container = { style: {}, innerHTML: "" };
  try {
    globalThis.document = { getElementById: () => container };
    globalThis.requestAnimationFrame = callback => frames.push(callback);
    globalThis.setTimeout = callback => tasks.push(callback);
    Router.getCurrent = () => "detail";
    const ctx = {
      ...createMetaDetailsScreenMethods02(),
      stopTrailerPlayback() {}, cancelTraktCommentsRequest() {}, bindTrailerProxyMessaging() {},
      hydrateFromRouteState: () => false,
      async loadDetail() { loads++; }, renderError() { assert.fail("unexpected load error"); }
    };
    await ctx.mount({ itemId: "test" });
    assert.match(container.innerHTML, /detail-loading-shell/);
    assert.equal(loads, 0);
    frames.shift()();
    assert.equal(loads, 0, "fetch should start in the task after the frame");
    tasks.shift()();
    await Promise.resolve();
    assert.equal(loads, 1);
    await ctx.mount({ itemId: "second" });
    ctx.detailLoadToken++;
    frames.shift()();
    tasks.shift()();
    await Promise.resolve();
    assert.equal(loads, 1, "departed route should not fetch");
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.setTimeout = originalTimeout;
    Router.getCurrent = originalCurrent;
  }
});
