import * as internals from "./homeScreenContext.js";
import { HomeDataWindow } from "./homeDataWindow.js";
import { buildModernHomeVirtualRows } from "./homeVirtualRows.js";
import { resolveHomeLogicalFocus } from "./homeLogicalFocus.js";

export function createHomeScreenMethods31() {
  const { createPosterCardMarkup, renderContinueWatchingCard, renderContinueWatchingLoadingCard,
    escapeAttribute, escapeHtml, formatCatalogRowTitle, t, partitionContinueWatchingRows,
    resolveContinueWatchingBlurNextUp, catalogRepository, Router, normalizeHomeRowItem, normalizeContinueWatchingItem } = internals;
  return {
    getDataHomeRenderSettingsKey() {
      return JSON.stringify([this.layoutMode, this.layoutPrefs || {}]);
    },
    createDataHomeWindow(continueRows, loadingCount, retainedFocus) {
      const logicalRows = buildModernHomeVirtualRows({ rows: this.rows,
        continueWatchingItems: continueRows.main, upcomingItems: continueRows.upcoming,
        continueWatchingLoading: this.layoutPrefs?.continueWatchingEnabled !== false && this.continueWatchingLoading,
        continueWatchingLoadingCount: loadingCount, continueWatchingCardStyle: this.layoutPrefs?.continueWatchingCardStyle || "card" });
      const previous = this.homeDataWindow;
      const state = retainedFocus || previous?.focus;
      const trackStates = { ...(previous?.captureTrackStates() || {}), ...(retainedFocus?.trackStates || {}) };
      const oldMeasurements = previous ? { layoutKey: previous.metrics.layoutKey, measuredHeights: new Map(previous.metrics.measuredHeights) } : null;
      const oldSizes = previous ? new Map(previous.sizes) : null;
      const oldTrackHeights = previous ? new Map(previous.trackHeights) : null;
      previous?.destroy();
      const renderer = new HomeDataWindow({ rows: logicalRows, escapeAttribute,
        landscape: Boolean(this.layoutPrefs?.modernLandscapePostersEnabled),
        layoutKey: JSON.stringify([this.layoutPrefs?.modernLandscapePostersEnabled, this.layoutPrefs?.continueWatchingCardStyle, this.layoutPrefs?.posterWidth]),
        focus: state, renderCard: (row, item, index) => {
          if (row.kind === "continue") {
            if (item.isLoading) return renderContinueWatchingLoadingCard(index, row.rowKey);
            return renderContinueWatchingCard(item.source, item.sourceIndex, { rowKey: row.rowKey, navIndex: index,
              cardStyle: row.cardStyle, useEpisodeThumbnails: this.layoutPrefs?.useEpisodeThumbnailsInCw !== false,
              blurNextUp: resolveContinueWatchingBlurNextUp(this.layoutPrefs) });
          }
          return createPosterCardMarkup(item.source, row.sourceRowIndex, item.itemIndex, row.source.type, row.source,
            this.layoutPrefs?.posterLabelsEnabled !== false, "modern", false,
            Boolean(this.layoutPrefs?.modernLandscapePostersEnabled), true, this.watchedTitleIds);
        }, renderTitle: row => escapeHtml(row.kind === "continue"
          ? row.rowKey === "upcoming_section" ? t("upcoming_section_title", {}, "Upcoming") : t("home.continueWatching", {}, "Continue Watching")
          : row.kind === "collection" ? row.source.collectionTitle || row.source.collection?.title || "Collection"
            : formatCatalogRowTitle(row.source.catalogName, row.source.type, this.layoutPrefs?.catalogTypeSuffixEnabled !== false)) });
      if (oldMeasurements?.layoutKey === renderer.layoutKey) {
        oldMeasurements.measuredHeights.forEach((height, key) => renderer.metrics.setMeasuredHeight(key, height));
        oldSizes.forEach((size, key) => { if (renderer.rowByKey.has(key)) renderer.sizes.set(key, size); });
        oldTrackHeights.forEach((height, key) => { if (renderer.rowByKey.has(key)) renderer.trackHeights.set(key, height); });
      }
      Object.entries(trackStates).forEach(([key, value]) => { if (renderer.rowByKey.has(key)) renderer.trackStates.set(key, Number(value) || 0); });
      this.homeDataWindow = renderer;
      return renderer;
    },
    attachDataHomeWindow() {
      const renderer = this.homeDataWindow;
      if (!renderer) return;
      renderer.onChange = () => {
        this.buildDataHomeNavigation();
        this.homeLazyImageCommitQueue = (this.homeLazyImageCommitQueue || []).filter(entry => entry.image?.isConnected);
        this.homeLazyImageHydrationIndex = null;
        if (this.pendingHomeLazyImageAnchor && !this.pendingHomeLazyImageAnchor.isConnected) this.pendingHomeLazyImageAnchor = null;
        this.scheduleHomeLazyImageHydration(null, { refreshIndex: true });
        this.scheduleHomeTruncationUpdate();
      };
      renderer.onTrackScroll = rowKey => this.scheduleDataHomePagination(rowKey);
      renderer.attach(this.getHomeViewport());
      this.buildDataHomeNavigation();
    },
    buildDataHomeNavigation() {
      const renderer = this.homeDataWindow;
      if (!renderer) return;
      const sidebar = Array.from(this.container?.querySelectorAll(".home-sidebar .focusable, .modern-sidebar-panel .focusable") || []);
      sidebar.forEach((node, index) => { node.dataset.navZone = "sidebar"; node.dataset.navIndex = String(index); });
      const rows = renderer.rows.map(() => []);
      renderer.mountedNodes.forEach(node => rows[Number(node.dataset.navRow)]?.push(node));
      rows.forEach(nodes => nodes.sort((a, b) => Number(a.dataset.navCol) - Number(b.dataset.navCol)));
      const tracks = Array.from(this.container?.querySelectorAll(".home-track[data-track-row-key]") || []);
      this.navModel = { domVersion: Number(this.navigationDomVersion || 0), sidebar, rows, tracks,
        rowSectionByKey: new Map(Array.from(this.container?.querySelectorAll(".home-row[data-row-key]") || [], node => [node.dataset.rowKey, node])),
        rowNodesByRowKey: new Map(renderer.rows.map((row, index) => [row.rowKey, rows[index]])) };
      for (const field of ["currentFocusedNode", "lastMainFocus", "expandedPosterNode", "pendingDelegatedFocusTarget"]) {
        if (this[field] && !this[field].isConnected) this[field] = null;
      }
    },
    getDataHomeTarget(rowKey, itemIndex = 0, itemIdentity = null) {
      return this.homeDataWindow?.target({ ...this.homeDataWindow.focus, rowKey, itemIndex, itemIdentity }) || null;
    },
    restoreDataHomeFocus(state) {
      if (!this.homeDataWindow || this.homeHoldFocusLocked || !state) return false;
      if (state.layoutMode && state.layoutMode !== this.layoutMode) return false;
      if (this.isRestoringFocusFromBack && !this.homeDataWindow.rowByKey.has(state.rowKey)) return false;
      const target = this.homeDataWindow.target(state, { restoreScroll: true });
      if (!target) return false;
      this.setFocusedNode(target, { suppressDelegatedFocus: true });
      this.lastMainFocus = target;
      this.rememberMainRowFocus(target);
      this.syncFocusedCollectionCardState();
      this.scheduleModernHeroUpdate(target, { immediate: Boolean(this.isRestoringFocusFromBack) });
      this.scheduleFocusedPosterFlow(target);
      return true;
    },
    refreshDataHomeWindow(changes = {}) {
      const renderer = this.homeDataWindow;
      if (!renderer) return;
      const partition = this.layoutPrefs?.continueWatchingEnabled !== false
        ? partitionContinueWatchingRows(this.continueWatchingDisplay || [], this.layoutPrefs?.continueWatchingSortMode)
        : { main: [], upcoming: [] };
      this.continueWatchingRenderedItems = [...partition.main, ...partition.upcoming];
      const dirtyRows = new Set(changes.dirtyRows || []);
      if (changes.continueWatching) {
        dirtyRows.add("continue_watching");
        dirtyRows.add("upcoming_section");
      }
      renderer.setRows(buildModernHomeVirtualRows({ rows: this.rows, continueWatchingItems: partition.main, upcomingItems: partition.upcoming,
        continueWatchingLoading: this.layoutPrefs?.continueWatchingEnabled !== false && this.continueWatchingLoading,
        continueWatchingCardStyle: this.layoutPrefs?.continueWatchingCardStyle || "card" }), renderer.focus, {
          dirtyRows, dirtyItems: changes.dirtyItems || [],
          invalidateMountedCatalogCards: Boolean(changes.invalidateMountedCatalogCards)
        });
      renderer.sync();
    },
    commitModernHomeDataUpdate(changes) {
      const renderer = this.homeDataWindow;
      if (!changes || changes.full || this.layoutMode !== "modern" || this.isInitialHomeLoading ||
          !renderer?.viewport?.isConnected || !renderer.content?.isConnected ||
          !this.container?.querySelector?.(".home-shell") || this.homeRouteEnterPending ||
          this.isRestoringFocusFromBack || this.pendingBackFocusState || this.homeHoldFocusLocked ||
          this.forceInitialContinueWatchingFocus || Number.isFinite(this.pendingContinueWatchingFocusIndex) ||
          this.pendingPosterHoldFocus ||
          this.renderedDataHomeSettingsKey !== this.getDataHomeRenderSettingsKey()) return false;

      const heroNode = this.container.querySelector(".home-hero-card");
      const shouldHoldHero = this.layoutPrefs?.continueWatchingEnabled !== false && this.continueWatchingLoading &&
        !this.continueWatchingDisplay?.length && !this.heroItem;
      const nextHero = this.heroItem || this.heroCandidates?.[this.heroIndex] || null;
      const hasHero = Boolean(this.layoutPrefs?.heroSectionEnabled) && !shouldHoldHero && Boolean(nextHero);
      if (Boolean(heroNode) !== hasHero) return false;

      const focused = this.getCurrentFocusedNode?.() || null;
      if (changes.continueWatching || changes.dirtyRows?.size || changes.dirtyItems?.size || changes.invalidateMountedCatalogCards) {
        this.refreshDataHomeWindow(changes);
      }
      if (heroNode && (changes.hero || changes.continueWatching || changes.dirtyRows?.size)) this.applyHeroToDom();
      if (focused && !focused.isConnected) {
        if (!renderer.focus || !this.restoreDataHomeFocus({
          ...renderer.focus, layoutMode: "modern", mainScrollTop: renderer.viewport.scrollTop,
          trackStates: renderer.captureTrackStates()
        })) return false;
      }
      this.renderedMarkup = null;
      return true;
    },
    getDataHomeHeroSource(state) {
      const renderer = this.homeDataWindow;
      if (!renderer?.rowByKey.has(state?.rowKey)) return null;
      const focus = renderer ? resolveHomeLogicalFocus(renderer.rows, state) : null;
      const row = renderer?.rowByKey.get(focus?.rowKey)?.row;
      const entry = row?.items?.[focus.itemIndex];
      if (!entry?.source) return null;
      return row.kind === "continue" ? normalizeContinueWatchingItem(entry.source) : normalizeHomeRowItem(row.source, entry.source);
    },
    scheduleDataHomePagination(rowKey) {
      const renderer = this.homeDataWindow;
      const row = renderer?.rowByKey.get(rowKey)?.row;
      if (!row || row.kind !== "catalog" || !row.source?.result?.data?.hasMore || this._trackPaginationInFlight?.has(rowKey)) return;
      this.dataHomePaginationTimers ||= new Map();
      if (this.dataHomePaginationTimers.has(rowKey)) return;
      const token = this.homeLoadToken;
      const run = async () => {
        this.dataHomePaginationTimers.delete(rowKey);
        if (token !== this.homeLoadToken || this.homeDataWindow !== renderer || Router.getCurrent() !== "home") return;
        if (Date.now() - Number(this.lastHomeInputAt || 0) < 160) { this.scheduleDataHomePagination(rowKey); return; }
        const source = row.source;
        const payload = source.result?.data;
        if (!payload?.hasMore || source.supportsSkip === false || payload.supportsSkip === false) return;
        const count = row.items.length;
        const dimension = renderer.dimensions(row);
        const viewportWidth = renderer.viewport?.clientWidth || renderer.width;
        const projected = Math.ceil(((renderer.trackStates.get(rowKey) || 0) + viewportWidth) / (dimension.width + renderer.gap));
        const focused = renderer.focus?.rowKey === rowKey ? renderer.focus.itemIndex : -1;
        if (Math.max(projected, focused + 1) < count - 4) return;
        this._trackPaginationInFlight ||= new Set();
        this._trackPaginationInFlight.add(rowKey);
        try {
          const skip = Math.max(Number(payload.nextSkip || 0), payload.items?.length || 0);
          const result = await catalogRepository.getCatalog({ addonBaseUrl: source.addonBaseUrl, addonId: source.addonId,
            addonName: source.addonName, catalogId: source.catalogId, catalogName: source.catalogName, type: source.type,
            skip, skipStep: source.skipStep, supportsSkip: source.supportsSkip !== false });
          if (token !== this.homeLoadToken || Router.getCurrent() !== "home" || result?.status !== "success") return;
          const livePayload = this.homeDataWindow?.rowByKey.get(rowKey)?.row?.source?.result?.data;
          if (!livePayload) return;
          const latest = livePayload.items || [];
          const seen = new Set(latest.map(item => String(item?.id || "")));
          const incoming = result.data?.items || [];
          const added = incoming.filter(item => { const id = String(item?.id || ""); if (id && seen.has(id)) return false; if (id) seen.add(id); return true; });
          livePayload.items = [...latest, ...added];
          livePayload.nextSkip = Math.max(Number(result.data?.nextSkip || 0), skip + incoming.length);
          livePayload.supportsSkip = result.data?.supportsSkip !== false;
          livePayload.hasMore = Boolean(incoming.length && livePayload.supportsSkip && (result.data?.hasMore ?? added.length > 0));
          if (added.length) this.refreshDataHomeWindow({
            dirtyItems: added.map(item => `${rowKey}\u0000${String(item?.id || "")}`)
          });
        } catch (error) { console.warn("Home window pagination failed", error); }
        finally { if (token === this.homeLoadToken) this._trackPaginationInFlight?.delete(rowKey); }
      };
      this.dataHomePaginationTimers.set(rowKey, setTimeout(run, 160));
    },
    cancelDataHomePagination() {
      this.dataHomePaginationTimers?.forEach(timer => clearTimeout(timer));
      this.dataHomePaginationTimers?.clear();
    }
  };
}
