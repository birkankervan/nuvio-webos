/* eslint-disable no-unused-vars */
import * as internals from "./playerScreenContext.js";
import { createVirtualList } from "../iptv/iptvVirtualList.js";

// IPTV live: the Sources button becomes a channel list of the current category
// (macOS "Kanallar"). Rows are windowed (categories can hold 1000+ channels).
const ROW_HEIGHT = 84;

export function createPlayerScreenMethods78() {
  const { escapeHtml, t, clamp, isSelectKeyCode, isBackEvent } = internals;

  return {
    isIptvLivePlayback() {
      return this.params?.itemType === "channel" && Boolean(this.params?.playIptv?.channelId);
    },

    ensurePlayerChannelsPanel() {
      const root = this.uiRefs?.root;
      if (!root) {
        return null;
      }
      let panel = root.querySelector("#playerChannelsPanel");
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "playerChannelsPanel";
        panel.className = "player-sources-panel player-channels-panel hidden";
        root.appendChild(panel);
      }
      return panel;
    },

    toggleChannelsPanel() {
      return this.channelsPanelVisible ? this.closeChannelsPanel() : this.openChannelsPanel();
    },

    async openChannelsPanel() {
      const panel = this.ensurePlayerChannelsPanel();
      if (!panel || !this.isIptvLivePlayback()) {
        return false;
      }
      if (this.sourcesPanelVisible) {
        this.sourcesPanelVisible = false;
        this.renderSourcesPanel?.();
      }
      this.closeChaptersPanel?.({ restoreFocus: false });
      if (this.episodePanelVisible) {
        this.hideEpisodePanel?.();
      }
      this.subtitleDialogVisible = false;
      this.audioDialogVisible = false;
      this.speedDialogVisible = false;
      this.renderSubtitleDialog?.();
      this.renderAudioDialog?.();
      this.renderSpeedDialog?.();
      this.channelsPanelVisible = true;
      this.setControlsVisible?.(true, { focus: false });
      this.resetControlsAutoHide?.();
      this.updateModalBackdrop?.();
      panel.classList.remove("hidden");
      panel.innerHTML = `<div class="player-sources-header"><div class="player-sources-title">${escapeHtml(
        t("player_channels_title", {}, "Channels")
      )}</div>
        <button type="button" class="player-sources-top-btn focusable" data-channels-action="close">${escapeHtml(
          t("episodes_panel_close", {}, "Close")
        )}</button></div>
        <div class="player-channels-viewport"><div class="player-channels-status">${escapeHtml(
          t("iptv_loading", {}, "Loading channels...")
        )}</div></div>`;
      const { sourceId, channelId } = this.params.playIptv;
      const categoryId = this.params.iptvCategoryId ?? null;
      const token = (this.channelsPanelToken = (this.channelsPanelToken || 0) + 1);
      try {
        const [{ IptvRepository }, { panelChannels }, { createItemRowNode, bindItemRow }] = await Promise.all([
          import("../../../data/repository/iptvRepository.js"),
          import("../iptv/iptvZap.js"),
          import("../iptv/iptvCards.js")
        ]);
        const list = await IptvRepository.getChannels(sourceId, categoryId);
        if (token !== this.channelsPanelToken || !this.channelsPanelVisible) {
          return true;
        }
        const { items, index } = panelChannels(list, channelId);
        const category = (IptvRepository.getCatalog?.(sourceId)?.categories || []).find(
          (entry) => categoryId != null && String(entry.id) === String(categoryId)
        );
        if (category?.name) {
          panel.querySelector(".player-sources-title").textContent = `${t("player_channels_title", {}, "Channels")} · ${category.name}`;
        }
        const viewport = panel.querySelector(".player-channels-viewport");
        viewport.innerHTML = "";
        this.channelsList = createVirtualList({
          viewport,
          rowHeight: ROW_HEIGHT,
          className: "player-channels-track",
          createNode: createItemRowNode,
          bindNode: (node, item, i) => bindItemRow(node, item, i, { isFavorite: () => false, progressOf: null })
        });
        this.channelsFocusIndex = index;
        this.channelsList.setItems(items, { focus: index });
        this.channelsList.setSelected(index);
      } catch (_) {
        if (token === this.channelsPanelToken && this.channelsPanelVisible) {
          const status = panel.querySelector(".player-channels-viewport");
          if (status) {
            status.innerHTML = `<div class="player-channels-status">${escapeHtml(
              t("iptv_error_generic", {}, "Something went wrong. Try again.")
            )}</div>`;
          }
        }
      }
      return true;
    },

    closeChannelsPanel({ restoreFocus = true } = {}) {
      if (!this.channelsPanelVisible) {
        return false;
      }
      this.channelsPanelVisible = false;
      this.channelsPanelToken = (this.channelsPanelToken || 0) + 1;
      this.channelsList?.destroy();
      this.channelsList = null;
      const panel = this.uiRefs?.root?.querySelector("#playerChannelsPanel");
      if (panel) {
        panel.classList.add("hidden");
        panel.innerHTML = "";
      }
      this.updateModalBackdrop?.();
      if (restoreFocus) {
        this.controlFocusZone = "buttons";
        this.renderControlButtons?.();
      }
      this.resetControlsAutoHide?.();
      return true;
    },

    setChannelsFocus(index) {
      const items = this.channelsList?.getItems() || [];
      if (!items.length || !Number.isFinite(index)) {
        return false;
      }
      this.channelsFocusIndex = clamp(index, 0, items.length - 1);
      this.channelsList.setFocus(this.channelsFocusIndex);
      return true;
    },

    activateChannelsFocus() {
      const next = this.channelsList?.getItems()[this.channelsFocusIndex];
      if (!next) {
        return false;
      }
      // Already playing: just close, no reconnect (single-connection providers).
      if (next.id === this.params?.playIptv?.channelId) {
        return this.closeChannelsPanel();
      }
      this.switchIptvChannel(next).catch(() => {});
      return true;
    },

    handleChannelsPanelKey(event) {
      if (!this.channelsPanelVisible) {
        return false;
      }
      const keyCode = Number(event?.keyCode || 0);
      const handled = isBackEvent?.(event) || keyCode === 38 || keyCode === 40 || isSelectKeyCode(keyCode) || keyCode === 66;
      if (!handled) {
        return false;
      }
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (isBackEvent?.(event)) {
        this.closeChannelsPanel();
      } else if (keyCode === 38 || keyCode === 40) {
        this.setChannelsFocus((this.channelsFocusIndex || 0) + (keyCode === 38 ? -1 : 1));
      } else {
        this.activateChannelsFocus();
      }
      return true;
    }
  };
}
