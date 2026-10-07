import { HomeDataWindow } from "../js/ui/screens/home/homeDataWindow.js";

// Bundle as an IIFE and await run() in a real browser/TV Inspector. The fixture
// has no account/network dependencies and removes its DOM in finally.
export async function run() {
  const previousFocus = document.activeElement;
  const root = document.createElement("div");
  root.className = "nuvio-data-window-fixture";
  root.style.cssText = "position:fixed;left:0;top:0;width:900px;height:560px;opacity:0;pointer-events:none;z-index:-1";
  const style = document.createElement("style");
  style.textContent = `
    .nuvio-data-window-fixture * {box-sizing:border-box;transform:none!important;transition:none!important;animation:none!important;}
    .nuvio-data-window-fixture .fixture-viewport {width:900px;height:560px;overflow:auto;scroll-behavior:auto;}
    .nuvio-data-window-fixture .home-modern-rows-scroll {margin:0;padding:0;display:block;gap:0;}
    .nuvio-data-window-fixture .home-row {height:auto;min-height:0;padding:0;border:0;}
    .nuvio-data-window-fixture .home-row-head {display:block;height:46px;min-height:0;margin:0;padding:0;border:0;}
    .nuvio-data-window-fixture .home-row-title {height:46px;margin:0;padding:0;line-height:46px;font-size:16px;}
    .nuvio-data-window-fixture .home-track {width:100%;height:auto;min-height:0;max-height:none;margin:0;padding:0;border:0;overflow-x:auto;overflow-y:hidden;}
    .nuvio-data-window-fixture .home-data-track {margin:0;padding:0;border:0;}
    .nuvio-data-window-fixture .fixture-card {display:block;width:212px;min-width:212px;max-width:212px;height:318px;min-height:318px;margin:0;padding:0;border:0;outline:0;}
    .nuvio-data-window-fixture .fixture-card[data-kind="continue"] {width:419px;min-width:419px;max-width:419px;height:236px;min-height:236px;}
    .nuvio-data-window-fixture.fixture-wrapped-header .home-row-head,
    .nuvio-data-window-fixture.fixture-wrapped-header .home-row-title {height:76.4px;line-height:38.2px;}
    .nuvio-data-window-fixture.fixture-tall-collection .fixture-card[data-kind="collection"][data-shape="POSTER"] {height:400px;min-height:400px;}
    .nuvio-data-window-fixture.fixture-tall-cards .fixture-card[data-kind="catalog"] {height:350px;min-height:350px;}
    .nuvio-data-window-fixture .fixture-card[data-kind="collection"][data-shape="LANDSCAPE"] {width:318px;min-width:318px;max-width:318px;height:179px;min-height:179px;}
  `;
  root.innerHTML = '<div class="home-shell"><div class="fixture-viewport"><div class="home-modern-rows-scroll"></div></div></div>';
  const shell = root.querySelector(".home-shell");
  document.head.append(style);
  document.body.append(root);
  const viewport = root.querySelector(".fixture-viewport");
  const content = root.querySelector(".home-modern-rows-scroll");
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  let renderer;
  let checks = 0;
  let renderedCalls = 0;
  const renderedByRow = new Map();
  const check = (condition, message) => {
    if (!condition) throw new Error(`Data window fixture: ${message}`);
    checks++;
  };
  const makeItems = (rowKey, count) => Array.from({ length: count }, (_, itemIndex) => ({
    itemId: `${rowKey}-item-${itemIndex}`, itemType: "movie", videoId: "", season: "", episode: "",
    source: { id: `${rowKey}-item-${itemIndex}`, type: "movie" }, itemIndex, sourceIndex: itemIndex,
    action: "openDetail", focusable: true
  }));
  const makeRow = (index, count = 100) => ({ rowKey: `row-${index}`, kind: "catalog",
    items: makeItems(`row-${index}`, count), loadingItems: [], sourceRowIndex: index, isLoading: false });
  const rows = Array.from({ length: 20 }, (_, index) => makeRow(index));
  const assertMountedOnly = () => {
    const cards = root.querySelectorAll(".fixture-card");
    check(renderer.mountedNodes.size === cards.length, "mounted map differs from actual DOM");
    check([...renderer.mountedNodes.values()].every(node => node.isConnected && root.contains(node)), "mounted map retains detached cards");
    check([...renderer.trackHandlers.keys()].every(node => node.isConnected && root.contains(node)), "track map retains detached rows");
    check(cards.length < 50, "rendered card budget exceeds 50 for fixed fixture viewport");
  };
  try {
    renderer = new HomeDataWindow({ rows, layoutKey: "fixture:portrait:900",
      escapeAttribute: value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;"),
      renderTitle: row => row.title || row.rowKey,
      renderCard: (row, item, index) => {
        renderedCalls++;
        renderedByRow.set(row.rowKey, (renderedByRow.get(row.rowKey) || 0) + 1);
        return `<article class="home-content-card focusable fixture-card" tabindex="0" data-kind="${row.kind}" data-shape="${item.source?.tileShape || "POSTER"}" data-row-index="${row.sourceRowIndex ?? ""}" data-source-index="${item.sourceIndex ?? ""}" data-item-id="${item.itemId}" data-item-type="${item.itemType}" data-item-index="${item.itemIndex}"><span>${item.source?.name || item.itemId}</span><b>${index}</b></article>`;
      }
    });
    const initialMarkup = renderer.markup({ width: 900, height: 560 });
    const initialCalls = renderedCalls;
    check(initialCalls > 0 && initialCalls < 50, "initial markup rendered full 20x100 collection");
    check(!initialMarkup.includes("row-19-item-99"), "distant initial card rendered");
    content.innerHTML = initialMarkup;
    renderer.attach(viewport);
    await frames();
    assertMountedOnly();
    const initialCards = root.querySelectorAll(".fixture-card").length;
    const initialRows = root.querySelectorAll(".home-row[data-row-key]").length;
    const expectedHeight = 20 * (318 + 46) + 19 * 24;
    check(viewport.scrollHeight === expectedHeight, "initial vertical extent includes unexpected gap or clipping");
    check(getComputedStyle(content).gap === "0px", "content parent gap must be zero");
    const firstTrack = root.querySelector(".home-track");
    check(firstTrack.scrollWidth === 100 * (212 + 24) - 24, "horizontal extent does not match full data length");

    const retainedWindow = content.querySelector(".home-data-window");
    const unchangedRow = root.querySelector('[data-row-key="row-1"]');
    const unchangedCard = unchangedRow?.querySelector('[data-item-id="row-1-item-0"]');
    check(Boolean(unchangedRow && unchangedCard), "unchanged visible row fixture was not mounted");
    const unchangedCallsBefore = renderedByRow.get("row-1") || 0;
    const focusBeforeUpdate = renderer.target({ rowKey: "row-0", itemIndex: 2 });
    focusBeforeUpdate.classList.add("focused");
    focusBeforeUpdate.focus({ preventScroll: true });
    renderer.remember(focusBeforeUpdate);
    const updateTrack = focusBeforeUpdate.closest(".home-track");
    updateTrack.scrollLeft = 31;
    updateTrack.dispatchEvent(new Event("scroll"));
    await frames();
    const updateScrollLeft = updateTrack.scrollLeft;
    const rowZero = rows[0];
    const rowZeroItems = [...rowZero.items];
    rowZeroItems[0] = { ...rowZeroItems[0], source: { ...rowZeroItems[0].source, name: "Updated title" } };
    rowZeroItems.push({ ...makeItems("row-0", 1)[0], itemId: "row-0-appended", itemIndex: 100,
      sourceIndex: 100, source: { id: "row-0-appended", type: "movie", name: "Appended" } });
    const changedRows = rows.map(row => row.rowKey === "row-0" ? { ...row, items: rowZeroItems } : row);
    renderer.setRows(changedRows, renderer.focus, { dirtyRows: new Set(["row-0"]) });
    renderer.sync();
    await frames();
    check(content.querySelector(".home-data-window") === retainedWindow, "data commit replaced the mounted window node");
    check(root.querySelector(".home-shell") === shell, "data commit replaced the Home shell");
    check(root.querySelector('[data-row-key="row-1"]') === unchangedRow, "unchanged visible row node was replaced");
    check(root.querySelector('[data-item-id="row-1-item-0"]') === unchangedCard, "unchanged visible card node was replaced");
    check((renderedByRow.get("row-1") || 0) === unchangedCallsBefore, "unchanged visible row called renderCard");
    check(focusBeforeUpdate.isConnected && document.activeElement === focusBeforeUpdate, "focused node was lost during a row update");
    check(updateTrack.scrollLeft === updateScrollLeft, "horizontal scroll changed during a row update");
    check(focusBeforeUpdate.closest(".home-row").querySelector('[data-item-id="row-0-item-0"] span').textContent === "Updated title",
      "same-identity metadata mutation left stale card markup");
    check(!root.querySelector('[data-item-id="row-2-item-0"]'), "offscreen row card markup was generated");
    const changedTrack = root.querySelector('[data-row-key="row-0"] .home-track');
    check(renderer.rowByKey.get("row-0").row.items.length === 101 && changedTrack.scrollWidth === 101 * (212 + 24) - 24,
      "appended item did not extend the logical horizontal data window");
    check(!root.querySelector('[data-item-id="row-0-appended"]'), "offscreen appended item received markup");
    assertMountedOnly();

    // A small shift keeps the cards that stay visible in the same row.
    const stayingCard = changedTrack.querySelector('[data-item-id="row-0-item-3"]');
    changedTrack.scrollLeft = 2 * (212 + 24);
    changedTrack.dispatchEvent(new Event("scroll"));
    await frames();
    check(Boolean(stayingCard) && changedTrack.querySelector('[data-item-id="row-0-item-3"]') === stayingCard,
      "small horizontal shift replaced a card that stayed visible");
    // A different item at the same index gets a fresh card, not the old node's state.
    stayingCard.classList.add("is-expanded");
    const swappedItems = renderer.rowByKey.get("row-0").row.items.map((item, index) => index === 3
      ? { ...item, itemId: "row-0-swapped", source: { ...item.source, id: "row-0-swapped", name: "Swapped" } } : item);
    renderer.setRows(renderer.rows.map(row => row.rowKey === "row-0" ? { ...row, items: swappedItems } : row), renderer.focus,
      { dirtyItems: new Set(["row-0\u0000row-0-item-3"]) });
    renderer.sync();
    await frames();
    const swappedCard = changedTrack.querySelector('[data-window-index="3"]');
    check(!stayingCard.isConnected && swappedCard && swappedCard !== stayingCard && !swappedCard.classList.contains("is-expanded"),
      "a swapped item reused the previous card node and its runtime state");
    // Later checks mutate changedRows in place; hand those row objects back.
    renderer.setRows(changedRows, renderer.focus, { dirtyRows: new Set(["row-0"]) });
    renderer.sync();
    await frames();

    // A horizontal window shift re-renders only its own row: sibling row and
    // card nodes keep identity, the focused card stays connected.
    changedTrack.scrollLeft = 20 * (212 + 24);
    changedTrack.dispatchEvent(new Event("scroll"));
    await frames();
    check(Boolean(changedTrack.querySelector('[data-item-id="row-0-item-22"]')), "horizontal shift did not mount the new window");
    check(root.querySelector('[data-row-key="row-1"]') === unchangedRow, "horizontal shift replaced a sibling row node");
    check(root.querySelector('[data-item-id="row-1-item-0"]') === unchangedCard, "horizontal shift replaced a sibling card node");
    check(focusBeforeUpdate.isConnected && document.activeElement === focusBeforeUpdate, "horizontal shift lost the focused card");
    assertMountedOnly();
    changedTrack.scrollLeft = updateScrollLeft;
    changedTrack.dispatchEvent(new Event("scroll"));
    await frames();
    // Like setFocusedNode, release the manual focus class once this scenario ends;
    // retained card nodes would otherwise keep a stale second "focused" card.
    focusBeforeUpdate.classList.remove("focused");
    focusBeforeUpdate.blur();

    const rowZeroCalls = renderedByRow.get("row-0") || 0;
    changedRows[0].sourceRowIndex = 7;
    renderer.sync();
    await frames();
    check((renderedByRow.get("row-0") || 0) > rowZeroCalls, "source row index change reused stale card markup");
    check(root.querySelector('[data-row-key="row-0"] [data-item-id="row-0-item-0"]').dataset.rowIndex === "7",
      "source row index change did not update card markup");

    const cwMain = { rowKey: "continue_watching", kind: "continue", cardStyle: "card", loadingItems: [],
      items: [{ ...makeItems("cw-main", 1)[0], itemId: "cw-main-0", itemIndex: 0, sourceIndex: 0 }] };
    const upcoming = { rowKey: "upcoming_section", kind: "continue", cardStyle: "card", loadingItems: [],
      items: [{ ...makeItems("cw-upcoming", 1)[0], itemId: "cw-upcoming-0", itemIndex: 0, sourceIndex: 1 }] };
    renderer.setRows([cwMain, upcoming], renderer.focus, { dirtyRows: new Set(["row-0"]) });
    renderer.sync();
    await frames();
    const upcomingCard = root.querySelector('[data-row-key="upcoming_section"] [data-item-id="cw-upcoming-0"]');
    check(upcomingCard?.dataset.sourceIndex === "1", "initial upcoming source index incorrect");
    const upcomingCallsBefore = renderedByRow.get("upcoming_section") || 0;
    const longerMain = { ...cwMain, items: [{ ...cwMain.items[0] }, { ...makeItems("cw-main", 1)[0], itemId: "cw-main-1", itemIndex: 1, sourceIndex: 1 }] };
    const shiftedUpcoming = { ...upcoming, items: [{ ...upcoming.items[0], sourceIndex: 2 }] };
    renderer.setRows([longerMain, shiftedUpcoming], renderer.focus, { dirtyRows: new Set(["continue_watching"]) });
    renderer.sync();
    await frames();
    check(root.querySelector('[data-row-key="upcoming_section"] [data-item-id="cw-upcoming-0"]').dataset.sourceIndex === "2",
      "upcoming markup retained stale source index after main CW grew");
    check((renderedByRow.get("upcoming_section") || 0) > upcomingCallsBefore,
      "upcoming source index shift did not invalidate its card markup");

    const duplicates = { rowKey: "duplicate-row", kind: "catalog", sourceRowIndex: 0, loadingItems: [], items: [
      { ...makeItems("duplicate", 1)[0], itemId: "same-id", itemIndex: 0, sourceIndex: 4 },
      { ...makeItems("duplicate", 1)[0], itemId: "same-id", itemIndex: 1, sourceIndex: 5 }
    ] };
    renderer.setRows([duplicates], renderer.focus, { dirtyRows: new Set(["duplicate-row"]) });
    renderer.sync();
    await frames();
    const duplicateCalls = renderedByRow.get("duplicate-row") || 0;
    renderer.sync();
    await frames();
    check((renderedByRow.get("duplicate-row") || 0) === duplicateCalls,
      "duplicate item identities re-rendered unchanged cache slots");
    check(root.querySelectorAll('[data-row-key="duplicate-row"] [data-item-id="same-id"]').length === 2,
      "duplicate item identities collapsed in the mounted DOM");

    const staleCollection = { rowKey: "unknown-collection", kind: "collection", loadingItems: [], items: makeItems("shape", 6)
      .map(item => ({ ...item, source: { ...item.source, tileShape: "POSTER" } })) };
    renderer.setRows([staleCollection]);
    renderer.target({ rowKey: staleCollection.rowKey, itemIndex: 0 });
    await frames();
    await frames();
    const staleMetrics = renderer.trackMetrics.get(staleCollection.rowKey);
    check(staleMetrics.getRowMetrics("0").height === 212 && renderer.trackHeights.get(staleCollection.rowKey) === 318,
      "poster collection fixture geometry was not measured");
    const refreshedCollection = { ...staleCollection, items: staleCollection.items.map(item => ({ ...item,
      source: { ...item.source, tileShape: "LANDSCAPE" } })) };
    renderer.setRows([refreshedCollection]);
    renderer.target({ rowKey: refreshedCollection.rowKey, itemIndex: 0 });
    await frames();
    await frames();
    check(renderer.trackMetrics.get(refreshedCollection.rowKey).getRowMetrics("0").height === 318,
      "unknown update retained stale collection card width measurement");
    check(renderer.trackHeights.get(refreshedCollection.rowKey) === 179,
      "unknown update retained stale collection row height estimate");
    check(renderer.metrics.getRowMetrics(refreshedCollection.rowKey).height === 225,
      "unknown update retained stale collection vertical row measurement");

    renderer.setRows(rows);
    renderer.sync();
    await frames();
    viewport.scrollTop = Math.max(0, renderer.metrics.totalExtent - viewport.clientHeight);
    renderer.sync();
    await frames();
    const bottomAnchorRange = renderer.metrics.getWindow({ offset: viewport.scrollTop, viewportExtent: 1 }).ranges[0];
    const bottomAnchor = renderer.rows[bottomAnchorRange.start];
    const bottomAnchorOffset = viewport.scrollTop - renderer.metrics.getRowMetrics(bottomAnchor.rowKey).offset;
    const topContinue = { rowKey: "inserted_continue", kind: "continue", cardStyle: "card", loadingItems: [],
      items: makeItems("inserted-cw", 2).map((item, index) => ({ ...item, itemIndex: index, sourceIndex: index })) };
    renderer.setRows([topContinue, ...rows]);
    renderer.sync();
    await frames();
    const expectedBottomAnchor = renderer.metrics.getRowMetrics(bottomAnchor.rowKey).offset + bottomAnchorOffset;
    check(Math.abs(viewport.scrollTop - expectedBottomAnchor) < 1,
      "adding a CW row above the bottom viewport moved the prior visible row anchor");

    const anchorOffsetInRow = 37;
    renderer.setRows(rows);
    renderer.sync();
    await frames();
    const anchorBefore = renderer.metrics.getRowMetrics("row-8");
    viewport.scrollTop = renderer.metrics.getRowMetrics("row-8").offset + anchorOffsetInRow;
    renderer.sync();
    await frames();
    const anchorScrollBeforeReorder = viewport.scrollTop;
    const reversedRows = [...rows].reverse().map((row, index) => ({ ...row, sourceRowIndex: index }));
    const focusedRow = reversedRows.find(row => row.rowKey === "row-5");
    const focusedBeforeReorder = renderer.target({ rowKey: focusedRow.rowKey, itemIndex: 5 });
    focusedBeforeReorder.classList.add("focused");
    focusedBeforeReorder.focus({ preventScroll: true });
    renderer.remember(focusedBeforeReorder);
    await frames();
    viewport.scrollTop = renderer.metrics.getRowMetrics("row-8").offset + anchorOffsetInRow;
    renderer.setRows(reversedRows, renderer.focus, { dirtyRows: new Set(rows.map(row => row.rowKey)) });
    renderer.sync();
    await frames();
    const anchorAfter = renderer.metrics.getRowMetrics("row-8");
    check(Math.abs(viewport.scrollTop - (anchorAfter.offset + anchorOffsetInRow)) < 1,
      "vertical scroll anchor moved when row order changed");
    check(focusedBeforeReorder.isConnected && document.activeElement === focusedBeforeReorder,
      "focused card node was replaced during row reorder");
    check(focusedBeforeReorder.dataset.navRow === String(renderer.rowByKey.get("row-5").index),
      "focused card row projection did not follow reordered data");
    check(anchorBefore && anchorScrollBeforeReorder > anchorBefore.offset, "vertical anchor fixture did not enter row 8");
    assertMountedOnly();

    const extendedRows = rows.map(row => row.rowKey === "row-17" ? { ...row, items: makeItems(row.rowKey, 250) } : row);
    renderer.setRows(extendedRows);
    const distant = renderer.target({ rowKey: "row-17", rowIndex: 17, itemIndex: 200 });
    check(distant?.isConnected, "not-mounted distant target was not created");
    check(distant.dataset.navCol === "200" && distant.dataset.itemIndex === "200", "logical/source index incorrectly became slice index");
    check(distant.dataset.itemId === "row-17-item-200", "distant target has wrong identity");
    distant.classList.add("focused");
    distant.focus({ preventScroll: true });
    renderer.remember(distant);
    await frames();
    assertMountedOnly();
    const sparseRows = [...root.querySelectorAll(".home-row[data-row-key]")].map(node => node.dataset.rowKey);
    check(sparseRows.includes("row-17") && !sparseRows.includes("row-10"), "distant focus allocated intermediate row prefix");
    check(!root.querySelector('[data-item-id="row-17-item-100"]'), "distant item focus allocated intermediate card prefix");
    check(document.activeElement === distant, "distant focused node was replaced during settle");
    const distantTrack = distant.closest(".home-track");
    check(distantTrack.scrollWidth === 250 * (212 + 24) - 24, "extended logical pagination length lost");
    distantTrack.scrollLeft = 200 * (212 + 24);
    distantTrack.dispatchEvent(new Event("scroll"));
    await frames();
    check(renderer.captureTrackStates()["row-17"] === distantTrack.scrollLeft, "horizontal scroll state was not captured");
    assertMountedOnly();

    const savedTrackLeft = distantTrack.scrollLeft;
    distantTrack.scrollLeft = 0;
    distantTrack.dispatchEvent(new Event("scroll"));
    await frames();
    const backTarget = renderer.target({ ...renderer.focus, mainScrollTop: renderer.metrics.getRowMetrics("row-17").offset,
      trackStates: { "row-17": savedTrackLeft } }, { restoreScroll: true });
    await frames();
    check(backTarget?.dataset.itemId === "row-17-item-200", "Back restore target identity changed");
    check(backTarget.closest(".home-track").scrollLeft === savedTrackLeft,
      "Back requested scroll was overwritten by previous mounted track state");
    check(renderer.captureTrackStates()["row-17"] === savedTrackLeft, "Back numeric scroll snapshot was overwritten");

    const tracksBeforeVertical = new Set(root.querySelectorAll(".home-track"));
    viewport.scrollTop = renderer.metrics.getRowMetrics("row-17").offset;
    renderer.sync();
    await frames();
    check(root.querySelector('[data-row-key="row-17"]'), "vertical scroll did not mount visible distant row");
    const tracksAfterVertical = [...root.querySelectorAll(".home-track")];
    check(tracksAfterVertical.some(track => tracksBeforeVertical.has(track)),
      "entering rows built new tracks instead of reusing departed ones");
    check(tracksAfterVertical.every(track => track.dataset.trackRowKey === track.closest(".home-row").dataset.rowKey &&
      Math.abs(track.scrollLeft - (renderer.trackStates.get(track.dataset.trackRowKey) || 0)) <= 1),
      "a reused track kept the previous row's key or horizontal position");
    check(!root.querySelector('[data-row-key="row-0"]'), "old offscreen row remains mounted after scroll");
    assertMountedOnly();
    const next = renderer.move("right");
    check(next.target?.dataset.navCol === "201", "D-pad logical movement failed after sparse mount");
    distant.classList.remove("focused");
    next.target.classList.add("focused");
    next.target.focus({ preventScroll: true });
    renderer.remember(next.target);
    await frames();

    const reordered = extendedRows.map(row => row.rowKey === "row-17" ? { ...row, items: [...row.items].reverse() } : row);
    renderer.setRows(reordered, renderer.focus);
    const restored = renderer.target(renderer.focus);
    check(restored?.dataset.itemId === "row-17-item-201", "reorder lost logical identity");
    check(restored.dataset.navCol === "48" && restored.dataset.itemIndex === "201", "reordered logical and source indices conflated");
    next.target.classList.remove("focused");
    restored.classList.add("focused");
    restored.focus({ preventScroll: true });
    renderer.remember(restored);
    await frames();
    assertMountedOnly();

    restored.classList.remove("focused");
    restored.blur();
    viewport.scrollTop = 0;
    renderer.setRows([rows[0]]);
    renderer.target({ rowKey: "row-0", itemIndex: 0 });
    await frames();
    check(!root.querySelector('[data-row-key="row-17"]'), "removed row DOM remains mounted");
    check(!renderer.trackStates.has("row-17") && !renderer.metrics.measuredHeights.has("row-17"), "removed row retained numeric state");
    check(viewport.scrollHeight === 560, "shrink left stale vertical extent beyond viewport");
    assertMountedOnly();

    const cwRow = { rowKey: "continue_watching", kind: "continue", cardStyle: "card", items: makeItems("cw", 100), loadingItems: [] };
    renderer.setRows([cwRow, rows[0]]);
    renderer.target({ rowKey: "continue_watching", itemIndex: 0 });
    await frames();
    check(renderer.metrics.getRowMetrics("continue_watching").height === 282, "CW measured height incorrect");
    check(renderer.metrics.getRowMetrics("row-0").offset === 306, "variable CW/catalog gap incorrect");
    check(viewport.scrollHeight === 670, "mixed CW/catalog vertical extent incorrect");
    assertMountedOnly();

    root.classList.add("fixture-wrapped-header");
    viewport.scrollTop = 0;
    const collection = { rowKey: "mixed-collection", kind: "collection", loadingItems: [],
      items: makeItems("mixed-collection", 40).map((item, index) => ({ ...item,
        source: { ...item.source, tileShape: index % 2 ? "LANDSCAPE" : "POSTER" } })) };
    renderer.setRows([collection, rows[0]]);
    renderer.target({ rowKey: collection.rowKey, itemIndex: 0 });
    await frames();
    await frames();
    const collectionNode = root.querySelector('[data-row-key="mixed-collection"]');
    const collectionTrack = collectionNode.querySelector(".home-data-track");
    const collectionHeader = collectionNode.querySelector(".home-row-head");
    const trackHeight = collectionTrack.getBoundingClientRect().height;
    const sectionHeight = renderer.metrics.getRowMetrics(collection.rowKey).height;
    check(Math.abs(collectionHeader.getBoundingClientRect().height - 76.4) < 0.1, "wrapped header fixture height incorrect");
    check(trackHeight === 318, "mixed collection track must match tallest card, excluding wrapped header");
    check(Math.abs(sectionHeight - (trackHeight + collectionHeader.getBoundingClientRect().height)) < 0.1,
      "collection row measurement must include wrapped header exactly once");
    check(collectionNode.querySelector('[data-shape="LANDSCAPE"]').getBoundingClientRect().height === 179,
      "mixed collection landscape card height not represented");
    for (let pass = 0; pass < 4; pass++) {
      renderer.sync();
      await frames();
      check(collectionTrack.getBoundingClientRect().height === trackHeight, "collection track grows on each measured sync");
      check(renderer.metrics.getRowMetrics(collection.rowKey).height === sectionHeight,
        "wrapped collection header feeds back into section height");
    }
    check(renderer.frame === 0, "collection height feedback keeps scheduling frames");
    const nextRow = root.querySelector('[data-row-key="row-0"]');
    check(nextRow.getBoundingClientRect().top >= collectionNode.getBoundingClientRect().bottom + 23.9,
      "wrapped collection overlaps next row");
    assertMountedOnly();

    root.classList.add("fixture-tall-collection");
    renderer.sync();
    await frames();
    await frames();
    const tallCollectionHeight = renderer.metrics.getRowMetrics(collection.rowKey).height;
    const tallCollectionOffset = renderer.metrics.getRowMetrics("row-0").offset;
    check(renderer.trackHeights.get(collection.rowKey) === 400, "collection must measure beyond the shape estimate");
    const changedCollection = { ...collection, items: collection.items.map((item, index) => index
      ? item : { ...item, source: { ...item.source, name: "Collection metadata" } }) };
    renderer.setRows([changedCollection, rows[0]], renderer.focus, { dirtyRows: [collection.rowKey] });
    check(renderer.trackHeights.get(collection.rowKey) === 400 &&
      renderer.metrics.getRowMetrics(collection.rowKey).height === tallCollectionHeight,
    "collection metadata discarded measured track or section height");
    renderer.sync();
    check(renderer.metrics.getRowMetrics("row-0").offset === tallCollectionOffset &&
      collectionTrack.getBoundingClientRect().height === 400,
    "first collection metadata sync reverted to the shape estimate");
    await frames();
    check(renderer.metrics.getRowMetrics("row-0").offset === tallCollectionOffset,
      "collection metadata measurement shifted the following row");
    const measuredCollectionWidth = renderer.trackMetrics.get(collection.rowKey).measuredHeights.get("0");
    const appendedCollection = { ...changedCollection, items: [...changedCollection.items,
      { ...makeItems("collection-appended", 1)[0], source: { tileShape: "POSTER" } }] };
    renderer.setRows([appendedCollection, rows[0]], renderer.focus, { dirtyRows: [collection.rowKey] });
    check(renderer.trackHeights.get(collection.rowKey) === 400 &&
      renderer.trackMetrics.get(collection.rowKey).measuredHeights.get("0") === measuredCollectionWidth &&
      renderer.metrics.getRowMetrics(collection.rowKey).height === tallCollectionHeight,
    "same-shape collection append discarded existing measured geometry");
    renderer.sync();
    await frames();
    renderer.setRows([changedCollection, rows[0]], renderer.focus, { dirtyRows: [collection.rowKey] });
    check(renderer.trackHeights.get(collection.rowKey) === 400 &&
      renderer.trackMetrics.get(collection.rowKey).measuredHeights.get("0") === measuredCollectionWidth &&
      !renderer.trackMetrics.get(collection.rowKey).measuredHeights.has("40"),
    "same-shape collection shrink discarded valid measurements or retained removed index");
    root.classList.remove("fixture-tall-collection");

    // Actual card/header heights differ from estimates. Check the commit and
    // first sync too: a later measurement must not hide a one-frame jump.
    root.classList.add("fixture-tall-cards");
    const measuredRows = Array.from({ length: 5 }, (_, index) => makeRow(index, 12));
    renderer.setRows(measuredRows);
    const measuredFocus = renderer.target({ rowKey: "row-1", itemIndex: 2 });
    measuredFocus.classList.add("focused");
    measuredFocus.focus({ preventScroll: true });
    renderer.remember(measuredFocus);
    await frames();
    await frames();
    viewport.scrollTop = renderer.metrics.getRowMetrics("row-1").offset + 25;
    renderer.sync();
    await frames();
    const measuredHeight = renderer.metrics.getRowMetrics("row-0").height;
    check(measuredHeight > 420 && renderer.sizes.get("row-0").height === 350,
      "metadata regression must use measured card/header heights unlike estimates");
    const stableOffset = renderer.metrics.getRowMetrics("row-1").offset;
    const stableScroll = viewport.scrollTop;
    const stableTop = root.querySelector('[data-row-key="row-1"]').getBoundingClientRect().top;
    const stableTrackLeft = measuredFocus.closest(".home-track").scrollLeft;
    for (let pass = 0; pass < 3; pass++) {
      measuredRows[0] = { ...measuredRows[0], title: `Updated row title ${pass}`, items: measuredRows[0].items.map((item, index) => index
        ? item : { ...item, source: { ...item.source, name: `Metadata ${pass}` } }) };
      renderer.setRows(measuredRows, renderer.focus, { dirtyRows: ["row-0"] });
      check(renderer.metrics.getRowMetrics("row-0").height === measuredHeight &&
        renderer.metrics.getRowMetrics("row-1").offset === stableOffset,
      "metadata commit discarded measured geometry before sync");
      renderer.sync();
      check(Math.abs(viewport.scrollTop - stableScroll) < 1 &&
        Math.abs(root.querySelector('[data-row-key="row-1"]').getBoundingClientRect().top - stableTop) < 1,
      "first metadata sync shifted scroll or the following row");
      await frames();
      check(Math.abs(viewport.scrollTop - stableScroll) < 1 &&
        Math.abs(root.querySelector('[data-row-key="row-1"]').getBoundingClientRect().top - stableTop) < 1,
      "metadata measurement frame shifted scroll or the following row");
      check(document.activeElement === measuredFocus && measuredFocus.isConnected &&
        measuredFocus.closest(".home-track").scrollLeft === stableTrackLeft,
      "metadata update lost focus or horizontal scroll");
    }
    root.classList.remove("fixture-tall-cards");

    const lastRow = makeRow(0, 3);
    renderer.setRows([lastRow], null, { dirtyRows: new Set([lastRow.rowKey]) });
    const lastCard = renderer.target({ rowKey: lastRow.rowKey, itemIndex: 2 });
    lastCard.classList.add("focused");
    lastCard.focus({ preventScroll: true });
    renderer.remember(lastCard);
    await frames();
    renderer.setRows([], renderer.focus, { dirtyRows: new Set([lastRow.rowKey]) });
    renderer.sync();
    await frames();
    check(renderer.focus === null && !lastCard.isConnected,
      "removing the only row did not release the focused final card");

    renderer.requestSync();
    check(renderer.frame !== 0, "cleanup fixture did not schedule a frame");
    renderer.destroy();
    check(renderer.frame === 0 && renderer.mountedNodes.size === 0 && renderer.trackHandlers.size === 0,
      "destroy retained mounted nodes/listeners or frame");
    check(renderer.viewport === null && renderer.content === null, "destroy retained viewport DOM");
    await frames();
    check(renderer.frame === 0 && renderer.mountedNodes.size === 0, "stale frame repopulated destroyed renderer");
    return { passed: checks, totalInitialRows: 20, totalInitialCards: 2000,
      initialMarkupCalls: initialCalls, initialMountedRows: initialRows, initialMountedCards: initialCards,
      sparsePinnedRows: sparseRows, initialScrollHeight: expectedHeight, distantLogicalIndex: 200 };
  } finally {
    renderer?.destroy();
    root.remove();
    style.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}
