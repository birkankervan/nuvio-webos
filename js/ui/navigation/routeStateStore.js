const stateMap = new Map();
export const MAX_ROUTE_STATE_ENTRIES = 12;

export const RouteStateStore = {
  get(key) {
    if (!key) return null;
    if (!stateMap.has(key)) return null;
    const value = stateMap.get(key);
    stateMap.delete(key);
    stateMap.set(key, value);
    return value;
  },

  set(key, value) {
    if (!key) return;
    if (value == null) {
      stateMap.delete(key);
      return;
    }
    stateMap.delete(key);
    stateMap.set(key, value);
    while (stateMap.size > MAX_ROUTE_STATE_ENTRIES) stateMap.delete(stateMap.keys().next().value);
  },

  clear(key) {
    if (!key) return;
    stateMap.delete(key);
  },

  clearByPrefix(prefix) {
    if (!prefix) return;
    for (const key of stateMap.keys()) {
      if (String(key).startsWith(prefix)) {
        stateMap.delete(key);
      }
    }
  },

  clearAll() {
    stateMap.clear();
  }
};
