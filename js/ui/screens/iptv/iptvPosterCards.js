// Poster card for the Movies/Series grid (recycled by iptvVirtualList).
// The poster src exists only on mounted nodes; a rebind to another item first
// drops the old src so a recycled node never flashes the previous poster.

const MIN_POSTER_SIZE_PX = 8;

function el(tag, className, parent) {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

const initialOf = (name) => String(name || "").match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() || "#";

export function createPosterCardNode() {
  const node = el("div", "iptv-poster");
  node.setAttribute("role", "button");
  node.dataset.iptvCard = "1";
  const box = el("div", "iptv-poster-box", node);
  const initial = el("span", "iptv-poster-initial", box);
  const img = el("img", "iptv-poster-img", box);
  img.alt = "";
  img.decoding = "async";
  // Providers send 1x1 placeholders; only a real image hides the initial tile.
  img.onload = () => {
    const current = img.getAttribute("src");
    if (current && current === img._poster && img.naturalWidth >= MIN_POSTER_SIZE_PX) node.classList.add("has-poster");
  };
  img.onerror = () => node.classList.remove("has-poster");
  const rating = el("div", "iptv-poster-rating", box);
  const caption = el("div", "iptv-poster-caption", box);
  const title = el("div", "iptv-poster-title", caption);
  node._parts = { initial, img, title, rating };
  return node;
}

export function bindPosterCard(node, item) {
  const { initial, img, title, rating } = node._parts;
  title.textContent = item.name;
  initial.textContent = initialOf(item.name);
  rating.textContent = item.rating > 0 ? `★ ${Number(item.rating).toFixed(1)}` : "";
  if (img._poster !== item.poster) {
    img._poster = item.poster;
    node.classList.remove("has-poster");
    img.removeAttribute("src");
    if (item.poster) img.src = item.poster;
  }
  node.dataset.channelId = item.id;
}
