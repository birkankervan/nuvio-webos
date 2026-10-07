import { ScreenUtils } from "../../navigation/screen.js";
import { LayoutPreferences } from "../../../data/local/layoutPreferences.js";
import { IptvRepository } from "../../../data/repository/iptvRepository.js";
import { IptvSourcesStore, normalizeIptvServer } from "../../../data/local/iptvSourcesStore.js";
import { resetDpadRepeat } from "../../navigation/dpadRepeatThrottle.js";
import {
  bindRootSidebarEvents,
  getSidebarProfileState,
  renderRootSidebar
} from "../../components/sidebarNavigation.js";
import { renderLoadingIndicator } from "../../components/loadingIndicator.js";
import { createResultCache } from "./iptvChannelFilter.js";
import { ZONE, createFocus } from "./iptvNavigation.js";
import { validateAccountInput } from "./iptvFormLogic.js";
import { createVirtualList } from "./iptvVirtualList.js";
import { bindCategory, bindChannelCard, createCategoryNode, createChannelCardNode } from "./iptvCards.js";
import { createAccountForm, renderAccountFormMarkup } from "./iptvAccountForm.js";
import { iptvDataMethods } from "./iptvScreenData.js";
import { FORM_ZONE, iptvFocusMethods } from "./iptvScreenFocus.js";
import { escapeHtml, t } from "./iptvText.js";

const GRID_COLUMNS = 4;
const CARD_ROW_HEIGHT = 156;
const CATEGORY_ROW_HEIGHT = 72;
const EXPIRY_WARNING_DAYS = 14;

/**
 * IPTV root screen (route "iptv", container #iptv).
 *
 * Interface: mount(params, navigationContext), cleanup(), onKeyDown/onKeyUp,
 * consumeBackRequest(), getRouteStateKey()/captureRouteState() (Back from the
 * player restores source, category, search, focused channel and scroll),
 * onPointerFocus/onPointerActivate (Magic Remote).
 *
 * Player contract: Router.navigate("player", { itemType: "channel",
 * itemId: channel.id, playIptv: { sourceId, channelId }, title, playerTitle,
 * resumePosition: 0 }). Stream URL/credentials never enter route params.
 *
 * Mounted DOM is bounded by the window (~(visibleRows + 2) * columns cards),
 * independent of channel count; see iptvVirtualList/iptvChannelWindow.
 */
export const IptvScreen = {
  ...iptvDataMethods,
  ...iptvFocusMethods,

  getRouteStateKey() {
    return "route:iptv";
  },

  captureRouteState() {
    if (this.mode !== "channels" || !this.source) return null;
    return {
      sourceId: this.source.id,
      viewKey: this.viewKey,
      query: this.query,
      focus: { ...this.focus },
      channelId: this.currentChannelId(),
      channelScroll: this.chanList?.getScrollTop() || 0,
      categoryScroll: this.catList?.getScrollTop() || 0
    };
  },

  async mount(_params = {}, navigationContext = {}) {
    this.container = document.getElementById("iptv");
    ScreenUtils.show(this.container);
    const token = (this.mountToken = (this.mountToken || 0) + 1);
    this.layoutPrefs = LayoutPreferences.get();
    this.sidebarExpanded = false;
    this.pillIconOnly = false;
    this.sidebarIndex = 0;
    this.columns = GRID_COLUMNS;
    this.sidebarProfile = await getSidebarProfileState({ cacheOnly: true }).catch(() => null);
    if (token !== this.mountToken) return;
    const sources = IptvRepository.listSources();
    if (!sources.length) {
      this.source = null;
      this.showForm({});
      return;
    }
    const restored = navigationContext?.isBackNavigation ? navigationContext.restoredState : null;
    const source = sources.find((item) => item.id === restored?.sourceId) || sources[0];
    this.enterChannels(source, restored?.sourceId === source.id ? restored : null);
  },

  cleanup() {
    this.mountToken = (this.mountToken || 0) + 1;
    this.teardownView();
    this.catalog = null;
    this.channels = [];
    this.bases = null;
    this.resultCache = null;
    ScreenUtils.hide(this.container);
  },

  // Stops everything the current view started: requests, timers, list DOM.
  teardownView() {
    this.abortLoad?.();
    this.viewController?.abort();
    this.formController?.abort();
    this.loadRun = (this.loadRun || 0) + 1;
    this.viewRun = (this.viewRun || 0) + 1;
    [this.searchTimer, this.holdTimer, this.deleteTimer].forEach((timer) => clearTimeout(timer));
    this.searchTimer = this.holdTimer = this.deleteTimer = null;
    this.holdArmed = false;
    this.catList?.destroy();
    this.chanList?.destroy();
    this.catList = this.chanList = null;
    this.manualFocused = null;
    this.form = null;
    this.formBusy = false;
    resetDpadRepeat(this);
  },

  renderSidebar() {
    return renderRootSidebar({
      selectedRoute: "iptv",
      profile: this.sidebarProfile,
      layout: this.layoutPrefs,
      expanded: Boolean(this.sidebarExpanded),
      pillIconOnly: Boolean(this.pillIconOnly)
    });
  },

  bindSidebar() {
    bindRootSidebarEvents(this.container, {
      currentRoute: "iptv",
      onSelectedAction: () => this.focusContent(),
      onExpandSidebar: () => this.focusSidebar()
    });
  },

  // ---- Channel view ----------------------------------------------------------
  enterChannels(source, restore = null) {
    this.teardownView();
    this.mode = "channels";
    this.source = source;
    this.catalog = null;
    this.entries = [];
    this.channels = [];
    this.viewKey = "";
    this.query = restore?.query || "";
    this.favorites = new Set(IptvSourcesStore.getFavorites());
    this.favVersion = 0;
    this.resultCache = createResultCache();
    this.bases = new Map();
    this.searchIndexes = new WeakMap();
    this.deleteArmed = false;
    this.statusAction = null;
    this.statusRetry = null;
    const restoredZone = [ZONE.HEADER, ZONE.CATEGORIES, ZONE.GRID].includes(restore?.focus?.zone)
      ? restore.focus.zone
      : ZONE.GRID;
    this.focus = restore
      ? { ...createFocus(), ...restore.focus, zone: restoredZone }
      : createFocus({ zone: ZONE.HEADER, header: 1 });
    this.returnZone = null;
    this.renderChannelsShell();
    void this.loadCatalog({ restore });
  },

  renderChannelsShell() {
    const button = (action, label) =>
      `<button type="button" class="iptv-btn" data-action="${action}">${escapeHtml(label)}</button>`;
    this.container.innerHTML = `
      <div class="home-shell iptv-shell">
        ${this.renderSidebar()}
        <main class="home-main iptv-main">
          <header class="iptv-header">
            <div class="iptv-title-block">
              <h1 class="iptv-title">${escapeHtml(t("iptv_title", "IPTV"))}</h1>
              <div class="iptv-source-name"></div>
              <div class="iptv-notice" role="status"></div>
            </div>
            <div class="iptv-toolbar">
              <input class="iptv-search" type="text" data-action="search" autocomplete="off" spellcheck="false"
                     placeholder="${escapeHtml(t("iptv_search_placeholder", "Search channels"))}" />
              ${button("cycleSource", t("iptv_switch_source", "Source"))}
              ${button("refresh", t("iptv_refresh", "Refresh"))}
              ${button("editSource", t("iptv_edit", "Edit"))}
              ${button("addSource", t("iptv_add", "Add"))}
              ${button("deleteSource", t("iptv_delete", "Delete"))}
            </div>
          </header>
          <div class="iptv-body">
            <aside class="iptv-categories"><div class="iptv-viewport iptv-cat-viewport"></div></aside>
            <section class="iptv-channels">
              <div class="iptv-viewport iptv-channel-viewport"></div>
              <div class="iptv-status" hidden></div>
              <div class="iptv-hint">${escapeHtml(t("iptv_hold_hint", "Hold OK to add or remove a favorite"))}</div>
            </section>
          </div>
        </main>
      </div>`;
    const root = this.container;
    this.searchInput = root.querySelector(".iptv-search");
    this.headerNodes = Array.from(root.querySelectorAll(".iptv-toolbar > *"));
    this.statusNode = root.querySelector(".iptv-status");
    this.noticeNode = root.querySelector(".iptv-notice");
    this.searchInput.value = this.query;
    this.searchInput.addEventListener("input", () => this.onSearchInput(this.searchInput.value));
    this.catList = createVirtualList({
      viewport: root.querySelector(".iptv-cat-viewport"),
      columns: 1,
      rowHeight: CATEGORY_ROW_HEIGHT,
      createNode: createCategoryNode,
      bindNode: (node, entry, index) => bindCategory(node, entry, index, { isSelected: (key) => key === this.viewKey })
    });
    this.chanList = createVirtualList({
      viewport: root.querySelector(".iptv-channel-viewport"),
      columns: this.columns,
      rowHeight: CARD_ROW_HEIGHT,
      createNode: createChannelCardNode,
      bindNode: (node, channel, index) =>
        bindChannelCard(node, channel, index, { isFavorite: (id) => this.favorites.has(id) })
    });
    this.bindSidebar();
    this.updateHeaderLabels();
    this.setStatus("loading");
    this.applyFocus();
  },

  sourceInfoText() {
    const { source } = this;
    const count = IptvRepository.listSources().length;
    const parts = [source.name];
    if (count > 1) parts.push(`${IptvRepository.listSources().findIndex((item) => item.id === source.id) + 1}/${count}`);
    const expDate = source.lastAccount?.expDate;
    if (expDate) {
      const days = Math.ceil((expDate * 1000 - Date.now()) / 86_400_000);
      if (days >= 0 && days <= EXPIRY_WARNING_DAYS) parts.push(t("iptv_expires_in", `Expires in ${days} days`, { days }));
    }
    return parts.join(" · ");
  },

  updateHeaderLabels() {
    const info = this.container?.querySelector(".iptv-source-name");
    if (info) info.textContent = this.sourceInfoText();
    const del = this.container?.querySelector("[data-action='deleteSource']");
    if (del) {
      del.textContent = this.deleteArmed
        ? t("iptv_delete_confirm", "Press OK again to delete")
        : t("iptv_delete", "Delete");
      del.classList.toggle("is-danger", Boolean(this.deleteArmed));
    }
  },

  setNotice(text) {
    if (this.noticeNode) this.noticeNode.textContent = text || "";
  },

  // status: ready | loading | error | empty | no_results | no_favorites
  setStatus(status, error = null, retry = null) {
    this.status = status;
    const host = this.statusNode;
    if (!host) return;
    this.statusAction = null;
    this.statusRetry = null;
    if (status === "ready") {
      host.hidden = true;
      host.replaceChildren();
    } else {
      const messages = {
        empty: t("iptv_empty", "This category has no channels."),
        no_results: t("iptv_no_results", "No channels match your search."),
        no_favorites: t("iptv_no_favorites", "No favorites yet. Hold OK on a channel to add one."),
        error: error ? this.messageFor(error) : ""
      };
      host.hidden = false;
      host.innerHTML =
        status === "loading"
          ? `${renderLoadingIndicator({ className: "iptv-spinner" })}<div class="iptv-status-text">${escapeHtml(t("iptv_loading", "Loading channels..."))}</div>`
          : `<div class="iptv-status-text">${escapeHtml(messages[status] || "")}</div>${
              status === "error"
                ? `<button type="button" class="iptv-btn iptv-btn-primary" data-action="retry">${escapeHtml(t("iptv_retry", "Retry"))}</button>`
                : ""
            }`;
      if (status === "error") {
        this.statusAction = host.querySelector("[data-action='retry']");
        this.statusRetry = retry || (() => this.loadCatalog({ force: true }));
      }
    }
    if (this.focus.zone === ZONE.GRID && !this.channels.length) this.applyFocus();
  },

  // ---- Account form ---------------------------------------------------------------
  showForm({ source = null }) {
    this.teardownView();
    this.mode = "form";
    this.editing = source;
    this.formCanCancel = Boolean(this.source && IptvRepository.getSource(this.source.id));
    const labels = {
      title: source ? t("iptv_form_edit_title", "Edit IPTV account") : t("iptv_form_title", "Sign in to IPTV"),
      hint: t("iptv_form_hint", "Enter the details from your IPTV provider."),
      server: t("iptv_form_server", "Server address"),
      username: t("iptv_form_username", "Username"),
      password: t("iptv_form_password", "Password"),
      show: t("iptv_form_show_password", "Show password"),
      hide: t("iptv_form_hide_password", "Hide password"),
      save: t("iptv_form_save", "Save"),
      cancel: this.formCanCancel ? t("iptv_form_cancel", "Cancel") : ""
    };
    this.container.innerHTML = `
      <div class="home-shell iptv-shell">
        ${this.renderSidebar()}
        <main class="home-main iptv-main iptv-form-main">${renderAccountFormMarkup(labels)}</main>
      </div>`;
    this.form = createAccountForm(this.container.querySelector(".iptv-form"), labels);
    this.form.setValues(source ? { server: source.server, username: source.username, password: source.password } : {});
    this.focus = createFocus({ zone: FORM_ZONE });
    this.bindSidebar();
    this.applyFocus();
  },

  async submitForm() {
    if (this.formBusy) return; // double submit guard
    const check = validateAccountInput(this.form.getValues(), normalizeIptvServer);
    if (!check.ok) {
      this.form.setError(this.messageFor(check.errorCode));
      return;
    }
    const token = this.mountToken;
    const controller = (this.formController = new AbortController());
    this.formBusy = true;
    this.form.setError("");
    this.form.setBusy(true, t("iptv_form_checking", "Checking..."));
    try {
      const { signal } = controller;
      const source = this.editing
        ? await IptvRepository.updateSource({ id: this.editing.id, ...check.values }, { signal })
        : await IptvRepository.addSource(check.values, { signal });
      if (token !== this.mountToken || signal.aborted) return;
      this.enterChannels(source); // clears busy via teardownView
    } catch (error) {
      if (token !== this.mountToken || error?.code === "aborted") return;
      // Inputs are kept as typed so the user only fixes what failed.
      this.formBusy = false;
      this.form.setBusy(false);
      this.form.setError(this.messageFor(error));
    }
  }
};
