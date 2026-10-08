import { allowDpadRepeat, resetDpadRepeat } from "../../navigation/dpadRepeatThrottle.js";
import {
  activateLegacySidebarAction,
  focusWithoutAutoScroll,
  getRootSidebarNodes,
  getRootSidebarSelectedNode,
  isRootSidebarNode,
  isSelectedSidebarAction,
  setModernSidebarExpanded,
  setModernSidebarPillIconOnly
} from "../../components/sidebarNavigation.js";
import { TAB_LIVE, ZONE, moveFocus } from "./iptvNavigation.js";

const DIRECTIONS = { 37: "left", 38: "up", 39: "right", 40: "down" };
const OK = 13;
const HOLD_MS = 650;
export const FORM_ZONE = "form";

const isTextField = (node) => ["input", "textarea", "select"].includes(String(node?.tagName || "").toLowerCase());

// Focus + remote-control side of the screen. Every position is a logical
// index/identity in `this.focus`; the DOM only mirrors it.
export const iptvFocusMethods = {
  // ---- DOM mirroring -------------------------------------------------------
  setManualFocus(node) {
    const previous = this.manualFocused;
    if (previous && previous !== node) {
      previous.classList.remove("focused");
      if (previous === this.searchInput) previous.blur();
    }
    this.manualFocused = node || null;
    if (node) {
      node.classList.add("focused");
      focusWithoutAutoScroll(node);
    }
  },

  sidebarNodes() {
    return getRootSidebarNodes(this.container, this.layoutPrefs);
  },

  setSidebarExpanded(expanded) {
    if (!this.layoutPrefs?.modernSidebar || this.sidebarExpanded === expanded) return;
    this.sidebarExpanded = expanded;
    setModernSidebarExpanded(this.container, expanded);
  },

  applyFocus() {
    const { zone } = this.focus;
    this.setSidebarExpanded(zone === ZONE.SIDEBAR);
    if (this.mode === "form") {
      this.catList?.setFocus(-1);
      if (zone === ZONE.SIDEBAR) {
        this.form.nodes.forEach((node) => node.classList.remove("focused"));
        this.setManualFocus(this.sidebarNodes()[this.sidebarIndex] || getRootSidebarSelectedNode(this.container, this.layoutPrefs));
      } else {
        this.setManualFocus(null);
        this.form.focus();
      }
      return;
    }
    this.catList.setFocus(zone === ZONE.CATEGORIES ? this.focus.category : -1);
    this.chanList.setFocus(zone === ZONE.GRID && this.channels.length ? this.focus.channel : -1);
    let node = null;
    if (zone === ZONE.SIDEBAR) {
      const nodes = this.sidebarNodes();
      node = nodes[this.sidebarIndex] || getRootSidebarSelectedNode(this.container, this.layoutPrefs);
    } else if (zone === ZONE.HEADER) {
      node = this.headerNodes[this.focus.header];
    } else if (zone === ZONE.GRID && !this.channels.length) {
      node = this.statusAction;
    }
    this.setManualFocus(node);
  },

  focusSidebar() {
    const nodes = this.sidebarNodes();
    const selected = getRootSidebarSelectedNode(this.container, this.layoutPrefs);
    this.sidebarIndex = Math.max(0, nodes.indexOf(selected));
    if (this.focus.zone !== ZONE.SIDEBAR) this.returnZone = this.focus.zone;
    this.focus.zone = ZONE.SIDEBAR;
    this.applyFocus();
  },

  focusContent() {
    this.focus.zone = this.returnZone || (this.mode === "form" ? FORM_ZONE : ZONE.HEADER);
    this.applyFocus();
  },

  moveSidebar(delta) {
    const nodes = this.sidebarNodes();
    if (!nodes.length) return;
    this.sidebarIndex = Math.max(0, Math.min(nodes.length - 1, this.sidebarIndex + delta));
    this.applyFocus();
  },

  // ---- Back ---------------------------------------------------------------
  // Router calls this first; returning true consumes Back (see FocusEngine).
  consumeBackRequest() {
    if (this.closeDetail()) {
      this.applyFocus();
      return true;
    }
    const { zone } = this.focus;
    if (this.mode === "form") {
      if (zone === ZONE.SIDEBAR) return this.leaveToHomeIfNoHistory();
      if (this.formCanCancel) {
        this.enterChannels(this.source);
        return true;
      }
      this.focusSidebar();
      return true;
    }
    if (zone === ZONE.SIDEBAR) return this.leaveToHomeIfNoHistory();
    if (zone === ZONE.GRID && this.entries.length) {
      this.focus.zone = ZONE.CATEGORIES;
      this.applyFocus();
    } else {
      this.focusSidebar();
    }
    return true;
  },

  // Router sends Back to the previous route. A resumed/cold-started IPTV has none
  // (history.back() is a dead end, which webOS may treat as leaving the app), so go Home.
  leaveToHomeIfNoHistory() {
    if (globalThis.history?.state?.previousRoute) return false;
    activateLegacySidebarAction("gotoHome", "iptv");
    return true;
  },

  // ---- Keys ---------------------------------------------------------------
  navContext() {
    return {
      headerCount: this.headerNodes.length,
      categoryCount: this.entries.length,
      channelCount: this.channels.length || (this.statusAction ? 1 : 0),
      columns: this.columns
    };
  },

  async onKeyDown(event) {
    const code = Number(event?.keyCode || 0);
    if (this.detail) return this.onDetailKey(event);
    const direction = DIRECTIONS[code];
    if (this.layoutPrefs?.modernSidebar && !this.sidebarExpanded && direction) {
      if (code === 40 || code === 38) {
        this.pillIconOnly = code === 40;
        setModernSidebarPillIconOnly(this.container, this.pillIconOnly);
      }
    }
    if (this.focus.zone === ZONE.SIDEBAR) return this.onSidebarKey(event, code, direction);
    if (this.mode === "form") return this.onFormKey(event, code, direction);

    const active = document.activeElement;
    if (isTextField(active)) {
      if (!direction) return; // typing / OK on the search field stays native.
      // Left/Right edit the text until the caret reaches an edge.
      if (direction === "left" && active.selectionStart > 0) return;
      if (direction === "right" && active.selectionEnd < active.value.length) return;
    }
    if (direction) {
      if (!allowDpadRepeat(this, event, { horizontalMs: 80, verticalMs: 80 })) return;
      event.preventDefault?.();
      const before = this.focus.zone;
      const result = moveFocus(this.focus, direction, this.navContext());
      this.focus = result.focus;
      if (this.focus.zone === ZONE.SIDEBAR) {
        this.focus.zone = before; // focusSidebar remembers where to return to.
        this.focusSidebar();
        return;
      }
      this.applyFocus();
      if (result.selectCategory) this.activateCategory(this.focus.category);
      return;
    }
    if (code !== OK) return;
    if (this.focus.zone === ZONE.GRID && this.channels.length && this.tab !== TAB_LIVE) {
      event.preventDefault?.();
      if (!event.repeat) this.openItem(this.channels[this.focus.channel]);
      return;
    }
    if (this.focus.zone === ZONE.GRID && this.channels.length) {
      // OK plays on release; holding OK toggles the favorite instead.
      event.preventDefault?.();
      if (event.repeat || this.holdTimer) return;
      this.holdFired = false;
      this.holdTimer = setTimeout(() => {
        this.holdTimer = null;
        this.holdFired = true;
        this.toggleFavorite(this.channels[this.focus.channel]);
      }, HOLD_MS);
      this.holdArmed = true;
      return;
    }
    event.preventDefault?.();
    await this.activateFocused();
  },

  onKeyUp(event) {
    const code = Number(event?.keyCode || 0);
    if (DIRECTIONS[code]) resetDpadRepeat(this);
    if (code !== OK || !this.holdArmed) return;
    event.preventDefault?.();
    this.holdArmed = false;
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
      this.playChannel(this.channels[this.focus.channel]);
    }
    this.holdFired = false;
  },

  onSidebarKey(event, code, direction) {
    if (direction === "up" || direction === "down") {
      event.preventDefault?.();
      this.moveSidebar(direction === "up" ? -1 : 1);
    } else if (direction === "right") {
      event.preventDefault?.();
      this.focusContent();
    } else if (code === OK) {
      const node = this.sidebarNodes()[this.sidebarIndex];
      if (!node || !isRootSidebarNode(node)) return;
      event.preventDefault?.();
      const action = String(node.dataset.action || "");
      activateLegacySidebarAction(action, "iptv");
      if (isSelectedSidebarAction(action, "iptv")) this.focusContent();
    }
  },

  onFormKey(event, code, direction) {
    const form = this.form;
    const node = form.current();
    if (direction === "up" || direction === "down") {
      event.preventDefault?.();
      form.move(direction === "up" ? -1 : 1);
      return;
    }
    if (direction === "left" && !form.isTextInput(node)) {
      event.preventDefault?.();
      this.focusSidebar();
      return;
    }
    if (isTextField(document.activeElement)) return; // caret keys and OK stay native.
    if (code === OK) {
      event.preventDefault?.();
      this.activateFormNode(node);
    }
  },

  // ---- Activation -----------------------------------------------------------
  async activateFocused() {
    const { zone } = this.focus;
    if (zone === ZONE.CATEGORIES) return this.activateCategory(this.focus.category);
    if (zone === ZONE.GRID) return this.statusRetry?.();
    if (zone === ZONE.HEADER) return this.runHeaderAction(this.headerNodes[this.focus.header]);
  },

  activateCategory(index) {
    const entry = this.entries[index];
    if (!entry) return;
    if (this.tab !== TAB_LIVE && this.query) {
      // Picking a category ends a (global) VOD search.
      this.query = "";
      this.searchInput.value = "";
    } else if (entry.key === this.viewKey) {
      return;
    }
    return this.selectView(entry.key, { focusIndex: 0 });
  },

  runHeaderAction(node) {
    switch (node?.dataset.action) {
      case "cycleSource":
        return this.switchSource();
      case "tab":
        return this.setTab(node.dataset.tab);
      case "refresh":
        return this.tab === TAB_LIVE ? this.loadCatalog({ force: true }) : this.loadVodTab();
      case "editSource":
        return this.showForm({ source: this.source });
      case "addSource":
        return this.showForm({});
      case "deleteSource":
        return this.deleteSource();
      default:
    }
  },

  activateFormNode(node) {
    switch (node?.dataset.action) {
      case "togglePassword":
        return this.form.togglePasswordVisibility();
      case "toggleAdult":
        return this.form.toggleAdult();
      case "saveAccount":
        return this.submitForm();
      case "cancelAccount":
        return this.enterChannels(this.source);
      default:
    }
  },

  // ---- Magic Remote ------------------------------------------------------------
  onPointerFocus(target) {
    if (this.detail) return this.onDetailPointer(target, false);
    if (this.mode === "form") {
      if (target.closest?.("[data-iptv-form]")) {
        this.focus.zone = FORM_ZONE;
        this.form.setFocusIndexFromNode(target.closest("[data-iptv-form]"));
      }
      return;
    }
    const card = target.closest?.("[data-iptv-card]");
    const category = target.closest?.("[data-iptv-category]");
    const header = this.headerNodes.indexOf(target.closest?.(".iptv-header [data-action], .iptv-tab, .iptv-search"));
    if (card) this.focus = { ...this.focus, zone: ZONE.GRID, channel: Number(card.dataset.index) };
    else if (category) this.focus = { ...this.focus, zone: ZONE.CATEGORIES, category: Number(category.dataset.index) };
    else if (header >= 0) this.focus = { ...this.focus, zone: ZONE.HEADER, header };
    else return;
    this.applyFocus();
  },

  onPointerActivate(target) {
    if (this.detail) return this.onDetailPointer(target, true);
    if (isRootSidebarNode(target.closest?.(".focusable"))) return false; // sidebar has its own handler.
    if (this.mode === "form") {
      const node = target.closest?.("[data-iptv-form]");
      if (!node || this.form.isTextInput(node)) return false;
      this.activateFormNode(node);
      return true;
    }
    const card = target.closest?.("[data-iptv-card]");
    if (card) {
      const item = this.channels[Number(card.dataset.index)];
      if (this.tab === TAB_LIVE) this.playChannel(item);
      else this.openItem(item);
      return true;
    }
    const category = target.closest?.("[data-iptv-category]");
    if (category) {
      this.activateCategory(Number(category.dataset.index));
      return true;
    }
    const retry = target.closest?.(".iptv-status [data-action]");
    if (retry) {
      this.statusRetry?.();
      return true;
    }
    const header = target.closest?.(".iptv-header [data-action], .iptv-tab");
    if (header) {
      this.runHeaderAction(header);
      return true;
    }
    return false;
  }
};
