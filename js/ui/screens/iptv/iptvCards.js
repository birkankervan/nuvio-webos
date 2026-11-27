import { progressRatio } from "./iptvDetail.js";

// DOM factories/binders for the recycled IPTV list nodes. Built once per node;
// binding only updates text/classes/src, so scrolling never recreates markup.
// All provider text goes through textContent (no HTML injection).

function el(tag, className, parent) {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

function initialOf(name) {
  const match = String(name || "").match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : "#";
}

// Some providers serve logos from hosts with broken TLS (the TV rejects the
// certificate) while the same files work over plain http. Retry such a logo once
// over http and remember the host so later logos skip the failing https attempt.
const hostsWithBrokenHttps = new Set();
const MIN_LOGO_SIZE_PX = 8;

function logoHost(url) {
  try {
    return new URL(url).host;
  } catch (_) {
    return "";
  }
}

function resolveLogoUrl(url) {
  return url && url.startsWith("https://") && hostsWithBrokenHttps.has(logoHost(url))
    ? `http://${url.slice(8)}`
    : url;
}

// One row for live channels, movies and series (single-column list).
// Separator rows reuse the node and show only the (uppercase) name.
export function createItemRowNode() {
  const node = el("div", "iptv-row");
  node.setAttribute("role", "button");
  node.dataset.iptvCard = "1";
  const box = el("div", "iptv-row-box", node);
  const number = el("span", "iptv-row-number", box);
  const logo = el("div", "iptv-row-logo", box);
  const fallback = el("span", "iptv-row-initial", logo);
  const img = el("img", "iptv-row-img", logo);
  img.alt = "";
  img.decoding = "async";
  const markNoLogo = () => {
    img._failed = true;
    node.classList.remove("has-logo");
  };
  img.onerror = () => {
    const failed = img.getAttribute("src") || "";
    if (failed.startsWith("https://")) {
      hostsWithBrokenHttps.add(logoHost(failed));
      img.src = `http://${failed.slice(8)}`;
      return;
    }
    markNoLogo();
  };
  // Providers often send a 1x1 transparent placeholder instead of no logo.
  img.onload = () => {
    if (img.naturalWidth < MIN_LOGO_SIZE_PX || img.naturalHeight < MIN_LOGO_SIZE_PX) markNoLogo();
  };
  const text = el("div", "iptv-row-text", box);
  const name = el("div", "iptv-row-name", text);
  const bar = el("div", "iptv-row-bar", text);
  const fill = el("div", "iptv-row-fill", bar);
  const check = el("span", "iptv-row-check", box);
  check.textContent = "✓";
  const fav = el("span", "iptv-row-fav", box);
  fav.setAttribute("aria-hidden", "true");
  fav.textContent = "★";
  node._parts = { number, fallback, img, name, bar, fill };
  return node;
}

// Provider "category header" rows: box/block/geometric/dingbat glyphs, a run of 3+ of
// one decoration char, decorations framing both ends, or no letters/digits at all.
// "+" is not decoration ("Premium+++"); single "|TR|" prefixes are not frames.
// ponytail: name heuristic only; Xtream gives no other provider-independent signal.
const SEPARATOR_RE =
  /[\u2500-\u27BF]|([#=\-_~*.\u2022])\1{2,}|^[|*#=~_\-\u2022<>\u00AB\u00BB]+\s.*\s[|*#=~_\-\u2022<>\u00AB\u00BB]+$|^[^\p{L}\p{N}]+$/u;
export function isSeparatorName(name) {
  return SEPARATOR_RE.test(String(name ?? "").trim());
}

// options: { isFavorite(id), progressOf(item) -> {posMs,durMs,watched}|null }
export function bindItemRow(node, item, _index, { isFavorite, progressOf }) {
  const { number, fallback, img, name, bar, fill } = node._parts;
  name.textContent = item.name;
  number.textContent = item.number == null ? "" : String(item.number);
  fallback.textContent = initialOf(item.name);
  const logo = item.logo || item.poster || "";
  // Logos load only for mounted (visible/near) rows; recycled nodes drop the old one.
  if (img._logo !== logo) {
    img._logo = logo;
    img._failed = false;
    if (logo) img.src = resolveLogoUrl(logo);
    else img.removeAttribute("src");
  }
  node.classList.toggle("has-logo", Boolean(logo) && !img._failed);
  node.classList.toggle("is-favorite", isFavorite(item.id));
  node.classList.toggle("is-separator", isSeparatorName(item.name));
  const progress = progressOf?.(item) || null;
  const ratio = progress?.watched ? 0 : progressRatio(progress);
  bar.hidden = !ratio;
  fill.style.width = `${Math.round(ratio * 100)}%`;
  node.classList.toggle("is-watched", Boolean(progress?.watched));
  node.dataset.channelId = item.id;
}

export function createCategoryNode() {
  const node = el("div", "iptv-category");
  node.setAttribute("role", "button");
  node.dataset.iptvCategory = "1";
  const box = el("div", "iptv-category-box", node);
  node._label = el("span", "iptv-category-label", box);
  node._count = el("span", "iptv-category-count", box);
  return node;
}

// countOf(key) -> number | undefined (known only once the category was loaded).
export function bindCategory(node, entry, _index, { isSelected, countOf }) {
  node._label.textContent = entry.name;
  const count = countOf?.(entry.key);
  node._count.textContent = count > 0 ? String(count) : "";
  node.classList.toggle("is-selected", isSelected(entry.key));
  node.dataset.viewKey = entry.key;
}
