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
  return url && url.startsWith("https://") && hostsWithBrokenHttps.has(logoHost(url)) ? `http://${url.slice(8)}` : url;
}

export function createChannelCardNode() {
  const node = el("div", "iptv-card");
  node.setAttribute("role", "button");
  node.dataset.iptvCard = "1";
  const box = el("div", "iptv-card-box", node);
  const logo = el("div", "iptv-card-logo", box);
  const fallback = el("span", "iptv-card-initial", logo);
  const img = el("img", "iptv-card-img", logo);
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
  const text = el("div", "iptv-card-text", box);
  const name = el("div", "iptv-card-name", text);
  const number = el("div", "iptv-card-number", text);
  const fav = el("span", "iptv-card-fav", box);
  fav.setAttribute("aria-hidden", "true");
  fav.textContent = "★";
  node._parts = { fallback, img, name, number };
  return node;
}

export function bindChannelCard(node, channel, _index, { isFavorite }) {
  const { fallback, img, name, number } = node._parts;
  name.textContent = channel.name;
  number.textContent = channel.number == null ? "" : `#${channel.number}`;
  fallback.textContent = initialOf(channel.name);
  // Logo loads only for mounted (visible/near) cards; recycled nodes drop the old one.
  if (img._logo !== channel.logo) {
    img._logo = channel.logo;
    img._failed = false;
    if (channel.logo) img.src = resolveLogoUrl(channel.logo);
    else img.removeAttribute("src");
  }
  node.classList.toggle("has-logo", Boolean(channel.logo) && !img._failed);
  node.classList.toggle("is-favorite", isFavorite(channel.id));
  node.dataset.channelId = channel.id;
}

export function createCategoryNode() {
  const node = el("div", "iptv-category");
  node.setAttribute("role", "button");
  node.dataset.iptvCategory = "1";
  node._label = el("span", "iptv-category-label", el("div", "iptv-category-box", node));
  return node;
}

export function bindCategory(node, entry, _index, { isSelected }) {
  node._label.textContent = entry.name;
  node.classList.toggle("is-selected", isSelected(entry.key));
  node.dataset.viewKey = entry.key;
}
