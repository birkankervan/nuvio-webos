import { buildModernRowKey } from "./modernHomeLayout.js";

const text = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];
const first = (...values) => values.map(text).find(Boolean) || "";
const id = (value) => typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? text(value) : "";
const firstId = (...values) => values.map(id).find(Boolean) || "";

function catalogItem(source, itemIndex, row) {
  if (typeof source !== "object" || Array.isArray(source)) return null;
  const collection = row.rowKind === "collection" ||
    ["collection_folder"].includes(text(source.type || source.apiType).toLowerCase()) ||
    Boolean(source.collectionId && source.folderId);
  const collectionId = firstId(source.collectionId, row.collectionId, row.collection?.id);
  const folderId = firstId(source.folderId, source.id);
  const title = firstId(source.rawTitle, source.folderTitle, source.title, source.name, source.heroTitle);
  const folder = collection && collectionId && folderId && title;
  const itemId = folder ? `collection:${collectionId}:${folderId}` : id(source.id);
  // Invalid folders must not fall through to a metadata/detail route. Loading
  // placeholders are kept separately and never become navigation targets.
  if (!source.isLoading && ((!folder && collection) || !itemId)) return null;
  return {
    itemId,
    itemType: folder ? "collection_folder" : first(source.type, source.apiType, row.type, "movie"),
    videoId: "", season: "", episode: "",
    source, itemIndex, action: source.isLoading ? null : folder ? "openCollectionFolder" : "openDetail",
    focusable: !source.isLoading, isLoading: Boolean(source.isLoading),
    ...(folder ? { collectionId, folderId } : {})
  };
}

function continueRow(sources, rowKey, sourceOffset, options) {
  const items = sources.map((source, itemIndex) => {
    const itemId = firstId(source?.contentId, source?.id);
    if (!source || typeof source !== "object" || Array.isArray(source) || !itemId) return null;
    return {
      itemId,
      itemType: first(source.contentType, source.type, "movie"),
      videoId: text(source.videoId), season: text(source.season), episode: text(source.episode),
      source, itemIndex, sourceIndex: sourceOffset + itemIndex,
      action: "resumeProgress", focusable: true, isLoading: false
    };
  }).filter(Boolean);
  if (!items.length && options.loading) {
    const requested = Number(options.loadingCount);
    const count = Math.max(1, Math.min(10, Number.isFinite(requested) && requested > 0 ? Math.ceil(requested) : 3));
    for (let itemIndex = 0; itemIndex < count; itemIndex++) {
      items.push({ itemId: `__cw_loading__:${rowKey}:${itemIndex}`, itemType: "action",
        videoId: "", season: "", episode: "", source: null, itemIndex,
        sourceIndex: sourceOffset + itemIndex, action: "continueWatchingLoading", focusable: true, isLoading: true });
    }
  }
  return { rowKey, kind: "continue", items, loadingItems: [],
    isLoading: Boolean(options.loading), cardStyle: options.cardStyle };
}

/**
 * Full Modern Home data rows. CW/upcoming must already be partitioned by the
 * caller, exactly as renderModernHomeLayout receives them. No render-limit
 * truncation, DOM properties, hero or synthetic See All entries are added.
 * .items[logicalIndex] gives a canonical item whose itemIndex remains the
 * absolute source position; invalid/skeleton entries can make them differ.
 */
export function buildModernHomeVirtualRows({
  rows = [], continueWatchingItems = [], upcomingItems = [],
  continueWatchingLoading = false, continueWatchingLoadingCount = 0,
  continueWatchingCardStyle = "card"
} = {}) {
  const main = list(continueWatchingItems);
  const upcoming = list(upcomingItems);
  const cardStyle = ["card", "wide", "poster"].includes(continueWatchingCardStyle) ? continueWatchingCardStyle : "card";
  const result = [];
  if (main.length || continueWatchingLoading) result.push(continueRow(main, "continue_watching", 0,
    { loading: continueWatchingLoading, loadingCount: continueWatchingLoadingCount, cardStyle }));
  if (upcoming.length) result.push(continueRow(upcoming, "upcoming_section", main.length, { cardStyle }));
  list(rows).forEach((source, sourceRowIndex) => {
    if (!source) return;
    const loaded = list(source.result?.data?.items);
    const sources = loaded.length ? loaded : list(source.loadingItems);
    if (!sources.length) return;
    const entries = sources.map((item, itemIndex) => item ? catalogItem(item, itemIndex, source) : null).filter(Boolean);
    result.push({ rowKey: text(source.homeCatalogKey || buildModernRowKey(source)),
      kind: source.rowKind === "collection" ? "collection" : "catalog",
      source, sourceRowIndex, isLoading: source.result?.status === "loading",
      items: entries.filter(item => item.focusable), loadingItems: entries.filter(item => !item.focusable) });
  });
  return result;
}
