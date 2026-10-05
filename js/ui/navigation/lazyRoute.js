export function createLazyRoute(importScreen, exportName) {
  let loading = null;
  return {
    load() {
      if (!loading) {
        loading = importScreen().then((module) => {
          const screen = module[exportName];
          if (!screen?.mount) throw new Error(`Invalid screen export: ${exportName}`);
          return screen;
        }).catch((error) => {
          loading = null;
          throw error;
        });
      }
      return loading;
    }
  };
}
