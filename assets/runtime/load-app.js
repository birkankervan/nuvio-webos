(function () {
  var script = document.createElement("script");
  var isTizen = window.__NUVIO_PLATFORM__ === "tizen" || /tizen/i.test(navigator.userAgent);
  if (!isTizen && "noModule" in script) {
    script.type = "module";
    script.src = "app.module.js";
  } else {
    script.src = "app.bundle.js";
  }
  script.onerror = function () {
    if (window.NuvioBootGuard) window.NuvioBootGuard.scriptFailed(script.src);
  };
  document.body.appendChild(script);
})();
