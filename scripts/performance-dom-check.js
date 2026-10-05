import { HomeRowVirtualizer } from "../js/ui/screens/home/homeRowVirtualizer.js";
import { updateKeyedDom } from "../js/ui/components/keyedDomUpdate.js";
import { createHomeScreenMethods05 } from "../js/ui/screens/home/homeScreenMethods-05-apply-hero-to-dom.js";
import { buildModernHeroPresentation, renderModernHeroPrimary, renderModernHeroSecondary } from "../js/ui/screens/home/homeScreenHelpers-11-build-hero-display-model.js";

// Bundle as an IIFE for an isolated browser/TV Inspector check. No application
// state or installed files are changed; the temporary DOM is removed in finally.
export function run() {
  const previousFocus = document.activeElement;
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;left:0;top:0;width:300px;height:200px;opacity:0;pointer-events:none;overflow:auto;z-index:-1";
  document.body.append(root);
  let virtualizer;
  let checks = 0;
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    checks++;
  };
  try {
    root.innerHTML = Array.from({ length: 30 }, (_, index) =>
      `<section class="home-row" data-row-key="row-${index}" style="height:100px;min-height:100px;margin:0;padding:0;display:block"><div class="home-track" style="width:200px;overflow:auto"><button class="focusable" style="width:500px;flex-shrink:0">${index}</button></div></section>`
    ).join("");
    const rows = Array.from(root.children);
    const originalHeight = root.scrollHeight;
    rows[20].querySelector(".home-track").scrollLeft = 85;
    virtualizer = new HomeRowVirtualizer(root);
    const mountedRows = root.querySelectorAll(".home-row[data-row-key]").length;
    check(mountedRows < 10, "offscreen rows stay attached");
    check(root.scrollHeight === originalHeight, "spacers changed scroll height");
    check(virtualizer.captureTrackStates()["row-20"] === 85, "detached track state lost");
    const target = rows[20].querySelector("button");
    virtualizer.mount(target);
    target.focus({ preventScroll: true });
    virtualizer.sync();
    check(target.isConnected && document.activeElement === target, "focused target was detached");
    check(rows[20].querySelector(".home-track").scrollLeft === 85, "track scroll not restored");
    virtualizer.destroy();
    check(root.querySelectorAll(".home-row[data-row-key]").length === 30, "cleanup failed to restore rows");
    check(!root.querySelector(".home-virtual-row-placeholder"), "orphan placeholder");

    const cardMarkup = index => `<button class="home-content-card focusable" data-nav-col="${index}" style="flex:0 0 100px;width:100px;min-width:100px;max-width:100px;height:100px;margin:0;padding:0;border:0;transform:none">${index}</button>`;
    root.innerHTML = `<section class="home-row" data-row-key="horizontal" style="height:100px;margin:0"><div class="home-track" style="width:300px;height:100px;display:flex;gap:12px;overflow:auto;padding:0">${Array.from({ length: 40 }, (_, i) => cardMarkup(i)).join("")}</div></section>`;
    root.scrollTop = 0;
    const track = root.querySelector(".home-track");
    const cards = Array.from(track.children);
    const originalWidth = track.scrollWidth;
    virtualizer = new HomeRowVirtualizer(root);
    const mountedCards = track.querySelectorAll(".home-content-card").length;
    check(mountedCards < 12, "horizontal cards not windowed");
    check(track.scrollWidth === originalWidth, "card spacers changed track width");
    check(virtualizer.getTrackCards(track).length === 40, "logical pagination count lost");
    virtualizer.mount(cards[35]);
    cards[35].focus({ preventScroll: true });
    virtualizer.sync();
    check(cards[35].isConnected && document.activeElement === cards[35], "horizontal target focus lost");
    track.scrollLeft = 3000;
    virtualizer.sync();
    check(track.scrollWidth === originalWidth, "scrolled track width changed");
    track.insertAdjacentHTML("beforeend", cardMarkup(40) + cardMarkup(41));
    virtualizer.refreshTrack(track);
    virtualizer.sync();
    check(virtualizer.getTrackCards(track).length === 42, "append duplicated or dropped logical cards");
    virtualizer.destroy();
    check(track.querySelectorAll(".home-content-card").length === 42 && !track.querySelector(".home-virtual-card-placeholder"), "card cleanup restore failed");

    const heroMarkup = hero => {
      const display = buildModernHeroPresentation(hero);
      return `<div class="home-shell"><article class="home-hero-card"><h1 class="home-hero-title-text">${display.title}</h1><div class="home-modern-hero-meta-line">${renderModernHeroPrimary(display)}</div><div class="home-modern-hero-secondary">${renderModernHeroSecondary(display)}</div><p class="home-hero-description">${display.description}</p><div class="home-hero-indicators"></div></article></div>`;
    };
    const firstHero = { id: "test-one", type: "movie", name: "First", description: "First description", genres: ["Drama"], releaseInfo: "2024" };
    const secondHero = { ...firstHero, id: "test-two", name: "Second", description: "Second description", releaseInfo: "2026" };
    updateKeyedDom(root, heroMarkup(firstHero));
    const home = { ...createHomeScreenMethods05(), container: root, layoutMode: "modern", heroItem: secondHero,
      heroCandidates: [], scheduleHomeTruncationUpdate() {}, syncCollectionHeroMedia() {} };
    home.applyHeroToDom();
    root.querySelector(".home-hero-description").textContent = "Second desc...";
    updateKeyedDom(root, heroMarkup(secondHero), { incremental: true });
    check(root.querySelector("h1").textContent === "Second", "hero title duplicated");
    check(root.querySelector(".home-hero-description").textContent === "Second description", "hero description duplicated");
    check(root.querySelectorAll(".home-modern-hero-meta-group-leading").length === 1 && root.querySelectorAll(".home-modern-hero-meta-group-trailing").length === 1, "hero metadata duplicated");

    const markup = (label, extra = "") => `<div class="stream-route-shell"><div class="stream-list"><button class="focusable" data-stream-key="one">${label}</button>${extra}</div></div>`;
    updateKeyedDom(root, markup("First"), { shellSelector: ".stream-route-shell" });
    const shell = root.firstElementChild;
    const focused = root.querySelector("button");
    focused.classList.add("focused");
    focused.focus();
    updateKeyedDom(root, markup("Updated", '<button class="focusable" data-stream-key="two">Second</button>'), {
      incremental: true, focusedNode: focused, shellSelector: ".stream-route-shell"
    });
    check(root.firstElementChild === shell, "stream shell replaced");
    check(root.querySelector('[data-stream-key="one"]') === focused, "stream row replaced");
    check(document.activeElement === focused && focused.classList.contains("focused"), "stream focus lost");
    check(focused.textContent === "Updated" && root.querySelectorAll("button").length === 2, "stream data not updated");
    return { passed: checks, totalRows: 30, mountedRows, preservedScrollHeight: originalHeight, totalCards: 40, mountedCards, preservedTrackWidth: originalWidth };
  } finally {
    virtualizer?.destroy();
    root.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}
