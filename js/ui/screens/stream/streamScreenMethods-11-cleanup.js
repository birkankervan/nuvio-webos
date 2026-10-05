/* eslint-disable no-unused-vars */
import * as internals from "./streamScreen.js";

export function createStreamScreenMethods11() {
  const { ScreenUtils, streamRepository } = internals;

  return {
    cleanup() {
      this.streamLoadAbortController?.abort?.();
      this.streamLoadAbortController = null;
      if (this.streamChunkTimer) clearTimeout(this.streamChunkTimer);
      this.streamChunkTimer = null;
      if (this.debridPreparationTimer) clearTimeout(this.debridPreparationTimer);
      this.debridPreparationTimer = null;
      this.debridPreparationScheduled = false;
      streamRepository.setLocalPluginSearchPaused(true);
      this.cancelAutoPlayCountdown();
      this.cancelAutoPlaySelectionWait();
      this.loadToken = (this.loadToken || 0) + 1;
      this.playResolveToken = Number(this.playResolveToken || 0) + 1;
      this.nativePlayerRequestToken = Number(this.nativePlayerRequestToken || 0) + 1;
      this.cancelScheduledRender();
      this.stopStreamVirtualization();
      if (this.errorChipTimer) {
        clearTimeout(this.errorChipTimer);
        this.errorChipTimer = null;
      }
      if (this.streamToastTimer) {
        clearTimeout(this.streamToastTimer);
        this.streamToastTimer = null;
      }
      if (this.releaseImageProxyReadyListener) {
        this.releaseImageProxyReadyListener();
        this.releaseImageProxyReadyListener = null;
      }
      this.renderedMarkup = null;
      this.renderedStreamListStable = false;
      this.renderedStreamListStreams = null;
      this.renderedStreamListSourceChips = null;
      this.boundStreamListNode = null;
      this.streamFocusDomCache = null;
      this.focusedElement = null;
      this.streamLastNavigationRepeatAt = 0;
      this.streams = [];
      this.sourceChips = [];
      this._filteredStreamsCache = null;
      this.addonLogoLookup = {};
      this.params = null;
      this.streamVirtualHeights?.clear?.();
      ScreenUtils.hide(this.container);
    }
  };
}
