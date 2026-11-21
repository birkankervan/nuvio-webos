#!/usr/bin/env bash
# Installs ~/Applications/Nuvio.app: a Chrome --app launcher over the local dist server.
# Usage: npm run install:macos [-- --no-build]
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME="/Applications/Google Chrome.app"
APP="$HOME/Applications/Nuvio.app"

NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "error: node not found in PATH" >&2; exit 1; }
[ -d "$CHROME" ] || { echo "error: $CHROME not found" >&2; exit 1; }

if [ "${1:-}" = "--no-build" ] && [ -f "$REPO/dist/index.html" ]; then
  echo "skipping build (--no-build)"
else
  (cd "$REPO" && npm run build)
fi

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Nuvio</string>
  <key>CFBundleIdentifier</key><string>space.nuvio.macos</string>
  <key>CFBundleExecutable</key><string>Nuvio</string>
  <key>CFBundleIconFile</key><string>Nuvio</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
</dict>
</plist>
PLIST

# Icon: largeIcon (or icon) from appinfo.json -> .icns; non-fatal.
make_icon() {
  local rel src set
  rel="$("$NODE" -e 'const a=require(process.argv[1]);process.stdout.write(a.largeIcon||a.icon||"")' "$REPO/appinfo.json")"
  src="$REPO/$rel"
  # packaged icons live in assets/images, appinfo paths are relative to the package root
  [ -f "$src" ] || src="$REPO/assets/images/$(basename "$rel")"
  [ -n "$rel" ] && [ -f "$src" ] || return 1
  set="$(mktemp -d)/Nuvio.iconset"
  mkdir -p "$set"
  local s
  for s in 16 32 128 256 512; do
    sips -z $s $s "$src" --out "$set/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) "$src" --out "$set/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$set" -o "$APP/Contents/Resources/Nuvio.icns"
}
make_icon || echo "warning: icon generation failed, continuing without icon" >&2

cat > "$APP/Contents/MacOS/Nuvio" <<LAUNCHER
#!/usr/bin/env bash
REPO="$REPO"
NODE="$NODE"
URL=http://127.0.0.1:4173/

if ! curl -sf -o /dev/null "\$URL"; then
  cd "\$REPO"
  # HOST stays 127.0.0.1: the env script contains keys, never bind LAN.
  HOST=127.0.0.1 PORT=4173 nohup "\$NODE" "\$REPO/scripts/serve.mjs" >>"\$HOME/Library/Logs/Nuvio.log" 2>&1 &
  for _ in \$(seq 1 30); do
    curl -sf -o /dev/null "\$URL" && break
    sleep 0.5
  done
fi

# ponytail: --disable-web-security only in this dedicated profile; TV runtime has no CORS and Xtream/HLS hosts send no CORS headers. Replace with a serve.mjs CORS proxy if this profile ever browses the web.
exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --user-data-dir="\$HOME/Library/Application Support/NuvioChrome" --app=http://127.0.0.1:4173/ --disable-web-security --start-fullscreen --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required
LAUNCHER
chmod +x "$APP/Contents/MacOS/Nuvio"

touch "$APP"
echo "Installed: $APP"
echo "open ~/Applications/Nuvio.app"
