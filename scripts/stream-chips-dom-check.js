import { updateKeyedDom } from "../js/ui/components/keyedDomUpdate.js";
import { createStreamScreenMethods08 } from "../js/ui/screens/stream/streamScreenMethods-08-build-web-os-native-player-launch-parameters.js";
import { getOrderedFilterNames } from "../js/ui/screens/stream/streamScreenHelpers-03-render-image-badge-chip.js";

// Isolated browser/TV DOM regression; no route, account or installed files change.
export function run() {
  const previousFocus = document.activeElement;
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;opacity:0;pointer-events:none;left:0;top:0;width:600px;z-index:-1";
  document.body.append(root);
  let checks = 0;
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    checks++;
  };
  const streams = [];
  const ctx = {
    ...createStreamScreenMethods08(), container: root, streams,
    sourceChips: [{ name: "alpha", status: "loading" }, { name: "beta", status: "error" }],
    addonFilter: "alpha", addonLogoLookup: {}, focusState: { zone: "filter", index: 1 },
    renderedStreamListStable: true, renderedStreamListStreams: streams,
    getOrderedFilterNames() { return getOrderedFilterNames(this.sourceChips, streams); },
    getFilteredStreams: () => streams, applyAddonFilterDomState: () => true,
    applyFocus() { root.querySelector('[data-addon="alpha"]').focus({ preventScroll: true }); }
  };
  const markup = () => `<div class="stream-route-shell"><div class="stream-route-chip-track">${ctx.buildSourceChipMarkup()}</div></div>`;
  const fullRender = () => updateKeyedDom(root, markup(), { incremental: true,
    shellSelector: ".stream-route-shell", focusedNode: document.activeElement });
  const expectChips = names => {
    const chips = Array.from(root.querySelectorAll(".stream-route-chip"));
    check(chips.length === names.length, "partial/full render duplicated source buttons");
    check(chips.every((chip, index) => chip.dataset.addon === names[index]), "source order or identity changed");
    check(names.every(name => root.querySelectorAll(`[data-addon="${name}"]`).length === 1), "duplicate source key");
  };
  try {
    fullRender();
    ctx.applyFocus();
    ctx.sourceChips = ctx.sourceChips.filter(chip => chip.name !== "beta");
    check(ctx.refreshSourceChipsOnly(), "partial chip refresh did not retain the stable list");
    expectChips(["all", "alpha"]);
    const alpha = root.querySelector('[data-addon="alpha"]');
    ctx.sourceChips = [{ name: "alpha", status: "success" }, { name: "gamma", status: "loading" }];
    fullRender();
    expectChips(["all", "alpha", "gamma"]);
    check(root.querySelector('[data-addon="alpha"]') === alpha && document.activeElement === alpha,
      "full render replaced or blurred the selected filter");
    check(!alpha.querySelector(".stream-route-chip-spinner"), "success source retained loading spinner");
    check(root.querySelectorAll('[data-addon="gamma"] .stream-route-chip-spinner').length === 1,
      "loading source spinner duplicated");
    ctx.sourceChips = [{ name: "alpha", status: "success" }];
    ctx.refreshSourceChipsOnly();
    expectChips(["all", "alpha"]);
    ctx.sourceChips.push({ name: "gamma", status: "success" });
    fullRender();
    expectChips(["all", "alpha", "gamma"]);
    check(ctx.addonFilter === "alpha" && document.activeElement?.dataset.addon === "alpha", "filter/focus state lost");
    return { passed: checks, sourceNames: ["all", "alpha", "gamma"], duplicateChips: 0 };
  } finally {
    root.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}
