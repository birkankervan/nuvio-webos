import { MediaServerScrobbleService } from "../mediaserver/mediaServerScrobbleService.js";
import { TraktScrobbleService } from "./traktScrobbleService.js";
import { SimklScrobbleService } from "./simklScrobbleService.js";

import { MdbListScrobbleService } from "./mdbListScrobbleService.js";

const providers = [
  MediaServerScrobbleService,
  TraktScrobbleService,
  SimklScrobbleService,
  MdbListScrobbleService
];

let stopped = false;

function enabledProviders() {
  return providers.filter((provider) => provider.isEnabled());
}

export const TrackingScrobbleService = {
  isEnabled() {
    return enabledProviders().length > 0;
  },

  // A null context means "not scrobblable" (e.g. a live channel).
  start(context) {
    stopped = false;
    if (context) enabledProviders().forEach((provider) => provider.start(context));
  },

  pause(context) {
    if (context) enabledProviders().forEach((provider) => provider.pause(context));
  },

  stop(context) {
    if (stopped) return;
    stopped = true;
    if (context) enabledProviders().forEach((provider) => provider.stop(context));
  },

  cancel() {
    stopped = true;
    providers.forEach((provider) => provider.cancel());
  }
};
