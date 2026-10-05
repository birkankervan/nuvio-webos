import { test } from "node:test";
import assert from "node:assert/strict";

// Home shares browser-backed stores; use empty storage rather than real accounts.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { Platform } = await import("../../../platform/index.js");
const { resetTvRuntimePerformanceProfile } = await import("../../../platform/tvRuntimePerformance.js");
const { createHomeScreenMethods03 } = await import("./homeScreenMethods-03-is-scroll-animation-active.js");
const { createHomeScreenMethods04 } = await import("./homeScreenMethods-04-get-hero-focus-delay.js");
const { createHomeScreenMethods24 } = await import("./homeScreenMethods-24-schedule-home-lazy-image-hydration.js");
const { createHomeScreenMethods10 } = await import("./homeScreenMethods-10-schedule-modern-hero-update.js");
const { Router } = await import("../../navigation/routerState.js");

test("detail module prefetch waits for idle and ignores departed Home generations", async () => {
  const previous = { setTimeout, clearTimeout, idle: globalThis.requestIdleCallback,
    cancelIdle: globalThis.cancelIdleCallback, browser: Platform.isBrowser, webos: Platform.isWebOS,
    current: Router.getCurrent, routes: Router.routes };
  const timers = new Map();
  const idle = new Map();
  let id = 0;
  let imports = 0;
  try {
    Platform.isBrowser = () => false;
    Platform.isWebOS = () => true;
    resetTvRuntimePerformanceProfile();
    globalThis.setTimeout = callback => { timers.set(++id, callback); return id; };
    globalThis.clearTimeout = id => timers.delete(id);
    globalThis.requestIdleCallback = callback => { idle.set(++id, callback); return id; };
    globalThis.cancelIdleCallback = id => idle.delete(id);
    Router.getCurrent = () => "home";
    Router.routes = { detail: { async load() { imports++; } } };
    const home = { ...createHomeScreenMethods10(), homeLoadToken: 1 };
    home.scheduleDetailScreenPrefetch();
    home.scheduleDetailScreenPrefetch();
    assert.equal(timers.size, 1);
    timers.get(home.detailScreenPrefetchTimer)();
    assert.equal(imports, 0);
    home.homeLoadToken++;
    idle.get(home.detailScreenPrefetchIdle)();
    assert.equal(imports, 0);
    home.scheduleDetailScreenPrefetch();
    timers.get(home.detailScreenPrefetchTimer)();
    idle.get(home.detailScreenPrefetchIdle)();
    await Promise.resolve();
    assert.equal(imports, 1);
    assert.equal(home.detailScreenPrefetchComplete, true);
    home.scheduleDetailScreenPrefetch();
    assert.equal(home.detailScreenPrefetchTimer, null);
  } finally {
    globalThis.setTimeout = previous.setTimeout;
    globalThis.clearTimeout = previous.clearTimeout;
    globalThis.requestIdleCallback = previous.idle;
    globalThis.cancelIdleCallback = previous.cancelIdle;
    Platform.isBrowser = previous.browser;
    Platform.isWebOS = previous.webos;
    Router.getCurrent = previous.current;
    Router.routes = previous.routes;
    resetTvRuntimePerformanceProfile();
  }
});

test("TV repeat limits and render deferral respect runtime and direction", () => {
  const browser = Platform.isBrowser;
  const webos = Platform.isWebOS;
  const tizen = Platform.isTizen;
  const now = Date.now;
  try {
    Platform.isBrowser = () => false;
    Platform.isWebOS = () => true;
    Platform.isTizen = () => false;
    resetTvRuntimePerformanceProfile();
    const policy = {
      ...createHomeScreenMethods03(),
      ...createHomeScreenMethods04(),
      layoutMode: "classic",
      isLegacyTvRuntime: () => true,
      isPerformanceConstrained: () => true
    };
    assert.equal(policy.getDirectionalRepeatThrottleMs("right"), 120);
    assert.equal(policy.getDirectionalRepeatThrottleMs("down"), 120);
    policy.isLegacyTvRuntime = () => false;
    assert.equal(policy.getDirectionalRepeatThrottleMs("right"), 100);
    assert.equal(policy.getDirectionalRepeatThrottleMs("down"), 112);
    policy.isPerformanceConstrained = () => false;
    assert.equal(policy.getDirectionalRepeatThrottleMs("right"), 80);
    assert.equal(policy.getDirectionalRepeatThrottleMs("down"), 112);

    Date.now = () => 2000;
    policy.lastHomeInputAt = 1800;
    assert.equal(policy.shouldDeferHomeRenderForInput(), true);
    policy.lastHomeInputAt = 1750;
    assert.equal(policy.shouldDeferHomeRenderForInput(), false);
    policy.isPerformanceConstrained = () => true;
    policy.lastHomeInputAt = 1201;
    assert.equal(policy.shouldDeferHomeRenderForInput(), true);
    policy.lastHomeInputAt = 1200;
    assert.equal(policy.shouldDeferHomeRenderForInput(), false);
    policy.lastHomeInputAt = 0;
    assert.equal(policy.shouldDeferHomeRenderForInput(), false);

    Platform.isBrowser = () => true;
    Platform.isWebOS = () => false;
    resetTvRuntimePerformanceProfile();
    policy.isPerformanceConstrained = () => false;
    policy.lastHomeInputAt = 1999;
    assert.equal(policy.shouldDeferHomeRenderForInput(), false);
  } finally {
    Platform.isBrowser = browser;
    Platform.isWebOS = webos;
    Platform.isTizen = tizen;
    Date.now = now;
    resetTvRuntimePerformanceProfile();
  }
});

test("image queue deduplicates, refreshes sources and drains two images per frame", () => {
  const previousImage = globalThis.HTMLImageElement;
  const previousRaf = globalThis.requestAnimationFrame;
  const frames = [];
  class Image {
    constructor(src) { this.dataset = { src }; this.isConnected = true; }
    closest() { return null; }
    removeAttribute(name) { if (name === "data-src") delete this.dataset.src; }
  }
  globalThis.HTMLImageElement = Image;
  globalThis.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
  try {
    const row = {};
    const a = new Image("a");
    const b = new Image("b");
    const c = new Image("c");
    const context = createHomeScreenMethods24();
    const entry = (image) => ({ image, src: image.dataset.src, row, isFocusedImage: image === a, priority: image === a ? 0 : 1 });
    context.commitHomeLazyImageSources([entry(a), entry(b), entry(a), entry(c)], a, row);
    assert.equal(context.homeLazyImageCommitQueue.length, 3);
    assert.equal(context.homeLazyImageCommitQueue[0].image, a);
    assert.equal(frames.length, 1);
    b.dataset.src = "updated-b";
    context.commitHomeLazyImageSources([entry(b)], a, row);
    assert.equal(context.homeLazyImageCommitQueue.length, 3);
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.equal(a.src, "a");
    assert.equal(c.src, "c");
    assert.equal(b.src, undefined);
    assert.equal(context.homeLazyImageCommitQueue.length, 1);
    frames.shift()();
    assert.equal(b.src, "updated-b");
    assert.equal(context.homeLazyImageCommitQueue.length, 0);
    assert.equal(context.homeLazyImageCommitRaf, 0);
  } finally {
    globalThis.HTMLImageElement = previousImage;
    globalThis.requestAnimationFrame = previousRaf;
  }
});
