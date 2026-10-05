import { createLazyRoute } from "./lazyRoute.js";
import { HomeScreen } from "../screens/home/homeScreen.js";
import { AccountScreen } from "../screens/account/accountScreen.js";
import { AuthQrSignInScreen } from "../screens/account/authQrSignInScreen.js";
import { AuthSignInScreen } from "../screens/account/authSignInScreen.js";
import { ServerConnectionScreen } from "../screens/account/serverConnectionScreen.js";
import { SyncCodeScreen } from "../screens/account/syncCodeScreen.js";
import { ProfileSelectionScreen } from "../../core/profile/profileSelectionScreen.js";
import { ExperienceModeSelectionScreen } from "../screens/onboarding/experienceModeSelectionScreen.js";
import { EssentialAddonSetupScreen } from "../screens/onboarding/essentialAddonSetupScreen.js";
import { Platform } from "../../platform/index.js";
import { TizenCapabilities } from "../../platform/tizen/tizenCapabilities.js";
import { RouteStateStore } from "./routeStateStore.js";
import { Router } from "./routerState.js";
import { LocalStore } from "../../core/storage/localStore.js";

import { createRouterMethods01 } from "./routerMethods-01-get-route-state-key.js";
import { createRouterMethods02 } from "./routerMethods-02-complete-route-return-back-guard.js";
import { createRouterMethods03 } from "./routerMethods-03-back.js";

export {
  Router,
  HomeScreen,
  AccountScreen,
  AuthQrSignInScreen,
  AuthSignInScreen,
  ServerConnectionScreen,
  SyncCodeScreen,
  ProfileSelectionScreen,
  ExperienceModeSelectionScreen,
  EssentialAddonSetupScreen,
  Platform,
  TizenCapabilities,
  RouteStateStore,
  LocalStore,
  ROUTER_PERF_DEBUG,
  routerPerfNow,
  logRouterPerf,
  NON_BACKSTACK_ROUTES,
  WEBOS_RESUME_ROUTE_KEY,
  WEBOS_RESUME_ROUTE_TTL_MS,
  TIZEN_ROUTE_RETURN_BACK_GUARD_MS,
  WEBOS_NON_RESTORABLE_ROUTES,
  getStackEntryRoute,
  getStackEntryParams,
  resolvePendingHistoryReturnParams
};
const ROUTER_PERF_DEBUG = Boolean(
  globalThis.__NUVIO_DEBUG_ROUTER_PERF__ || globalThis.__NUVIO_DEBUG_HOME_PERF__
);

function routerPerfNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function logRouterPerf(stage, data = {}) {
  if (!ROUTER_PERF_DEBUG) {
    return;
  }
  try {
    console.info(`[router-perf] ${stage}`, data);
  } catch (_) {}
}

const NON_BACKSTACK_ROUTES = new Set([
  "profileSelection",
  "authQrSignIn",
  "authSignIn",
  "serverConnection",
  "syncCode",
  "experienceModeSelection",
  "essentialAddonSetup"
]);
const WEBOS_RESUME_ROUTE_KEY = "webos_last_resume_route";
const WEBOS_RESUME_ROUTE_TTL_MS = 20 * 60 * 1000;
const TIZEN_ROUTE_RETURN_BACK_GUARD_MS = 700;
const WEBOS_NON_RESTORABLE_ROUTES = new Set([
  ...NON_BACKSTACK_ROUTES,
  "debugConsole",
  "plugin",
  "plugins",
  "catalogOrder",
  "detail",
  "player",
  "stream"
]);

function getStackEntryRoute(entry) {
  return typeof entry === "string" ? entry : String(entry?.route || "");
}

function getStackEntryParams(entry) {
  return typeof entry === "string" ? {} : entry?.params || {};
}

function resolvePendingHistoryReturnParams(pending, state, stackEntry) {
  const stackParams = getStackEntryParams(stackEntry);
  const historyParams = state?.params && typeof state.params === "object" ? state.params : {};
  const pendingParams = pending?.params && typeof pending.params === "object" ? pending.params : {};

  // The pending params come from the live source route (for example the
  // player's current resume position). Browser history can still contain the
  // older params captured when that route was originally opened, so preserve
  // its untouched fields but let the explicit return params win.
  return {
    ...(stackParams && typeof stackParams === "object" ? stackParams : {}),
    ...historyParams,
    ...pendingParams
  };
}

Object.assign(Router, {
  current: null,
  currentParams: {},
  stack: [],
  historyInitialized: false,
  webOsHomeBackGuardInitialized: false,
  popstateBound: false,
  suppressPopstateUntil: 0,
  skipConsumeNextPopstate: false,
  ignoreNextPopstate: false,
  routeReturnBackGuardActive: false,
  routeReturnBackGuardUntil: 0,
  routeReturnBackGuardNavigationId: 0,
  pendingHistoryReturn: null,
  pendingPostPlayNavigation: null,
  routes: {
    home: HomeScreen,
    player: createLazyRoute(() => import("../screens/player/playerScreen.js"), "PlayerScreen"),
    account: AccountScreen,
    authQrSignIn: AuthQrSignInScreen,
    authSignIn: AuthSignInScreen,
    serverConnection: ServerConnectionScreen,
    syncCode: SyncCodeScreen,
    profileSelection: ProfileSelectionScreen,
    experienceModeSelection: ExperienceModeSelectionScreen,
    essentialAddonSetup: EssentialAddonSetupScreen,
    detail: createLazyRoute(() => import("../screens/detail/metaDetailsScreen.js"), "MetaDetailsScreen"),
    library: createLazyRoute(() => import("../screens/library/libraryScreen.js"), "LibraryScreen"),
    search: createLazyRoute(() => import("../screens/search/searchScreen.js"), "SearchScreen"),
    discover: createLazyRoute(() => import("../screens/search/discoverScreen.js"), "DiscoverScreen"),
    settings: createLazyRoute(() => import("../screens/settings/settingsScreen.js"), "SettingsScreen"),
    debugConsole: createLazyRoute(() => import("../screens/debug/consoleDebugScreen.js"), "ConsoleDebugScreen"),
    trakt: createLazyRoute(() => import("../screens/trakt/traktScreen.js"), "TraktScreen"),
    supportersContributors: createLazyRoute(() => import("../screens/supporters/supportersContributorsScreen.js"), "SupportersContributorsScreen"),
    licensesAttributions: createLazyRoute(() => import("../screens/settings/licensesAttributionsScreen.js"), "LicensesAttributionsScreen"),
    plugin: createLazyRoute(() => import("../screens/plugin/pluginScreen.js"), "PluginScreen"),
    plugins: createLazyRoute(() => import("../screens/plugin/pluginsScreen.js"), "PluginsScreen"),
    catalogOrder: createLazyRoute(() => import("../screens/plugin/catalogOrderScreen.js"), "CatalogOrderScreen"),
    stream: createLazyRoute(() => import("../screens/stream/streamScreen.js"), "StreamScreen"),
    castDetail: createLazyRoute(() => import("../screens/cast/castDetailScreen.js"), "CastDetailScreen"),
    catalogSeeAll: createLazyRoute(() => import("../screens/catalog/catalogSeeAllScreen.js"), "CatalogSeeAllScreen"),
    tmdbEntityBrowse: createLazyRoute(() => import("../screens/tmdb/tmdbEntityBrowseScreen.js"), "TmdbEntityBrowseScreen"),
    folderDetail: createLazyRoute(() => import("../screens/collection/folderDetailScreen.js"), "FolderDetailScreen")
  },
  ...createRouterMethods01(),
  ...createRouterMethods02(),
  ...createRouterMethods03()
});
