import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.HTMLElement ||= class HTMLElement {};
const { createHomeScreenMethods14 } = await import("./homeScreenMethods-14-activate-focused-poster-flow.js");

class FakeDescription extends HTMLElement {
  constructor(text) {
    super();
    this.textContent = text;
    this.dataset = {};
    this.classList = { contains: name => name === "home-hero-description", toggle() {}, add() {} };
    this.textWrites = 0;
  }
  set textContent(value) { this._text = value; this.textWrites++; }
  get textContent() { return this._text; }
  closest() { return {}; }
  get clientWidth() { return 400; }
  get clientHeight() { return 40; }
  get scrollWidth() { return 400; }
  get scrollHeight() { return this._text.length > 20 ? 80 : 40; } // only short text fits
}

test("hero description truncation is skipped when text and box are unchanged", () => {
  const node = new FakeDescription("A long hero description that overflows the box");
  const screen = {
    ...createHomeScreenMethods14(),
    layoutMode: "modern",
    container: { querySelectorAll: () => [node] },
    applyModernHeroDescriptionBounds() {}
  };
  screen.applyHomeTruncationState();
  const firstPass = node.textWrites;
  const truncated = node.textContent;
  assert.ok(truncated.endsWith("..."));
  assert.ok(firstPass > 2, "first pass runs the binary search");

  screen.applyHomeTruncationState();
  assert.equal(node.textWrites, firstPass, "unchanged text and box must not reflow again");
  assert.equal(node.textContent, truncated);

  node.textContent = node.dataset.fullText; // hero re-applies the same full text
  const beforeRewrite = node.textWrites;
  screen.applyHomeTruncationState();
  assert.ok(node.textWrites > beforeRewrite + 1, "rewritten full text is truncated again");
  assert.equal(node.textContent, truncated);

  node.textContent = "New hero text that also overflows";
  const beforeNewText = node.textWrites;
  screen.applyHomeTruncationState();
  assert.ok(node.textWrites > beforeNewText + 1, "new hero text is truncated again");
});
