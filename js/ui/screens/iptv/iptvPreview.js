// Live-channel preview inside the IPTV right panel: one <video>, hls.js when
// available, native src otherwise. The provider allows a single connection, so
// stop() must release it completely before the full-screen player opens.

const isHlsUrl = (url) => /\.m3u8(?:$|[?#])/i.test(String(url));

export function createIptvPreview(containerEl) {
  const video = document.createElement("video");
  video.className = "iptv-preview-video";
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.muted = false;
  containerEl.appendChild(video);
  let hls = null;

  function stop() {
    if (hls) {
      try {
        hls.destroy();
      } catch (_) {}
      hls = null;
    }
    try {
      video.pause();
    } catch (_) {}
    video.removeAttribute("src");
    try {
      video.load(); // drops the connection; removeAttribute alone keeps it open on some engines
    } catch (_) {}
  }

  const start = () => video.play?.()?.catch?.(() => {});

  return {
    play(url) {
      stop();
      if (!url) return;
      const Hls = globalThis.Hls;
      if (isHlsUrl(url) && Hls?.isSupported?.()) {
        const instance = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls = instance;
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal && hls === instance) stop(); // silent: the panel just stays black
        });
        instance.on(Hls.Events.MANIFEST_PARSED, start);
        instance.loadSource(url);
        instance.attachMedia(video);
      } else {
        video.src = url;
        start();
      }
    },
    stop,
    destroy() {
      stop();
      video.remove();
    }
  };
}
