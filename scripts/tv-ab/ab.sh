#!/bin/zsh
# Usage: ab.sh A B A B ...   (fresh install + launch per run)
HERE=${0:A:h}
AB=${AB:-$HERE}  # directory holding A.ipk/B.ipk and the logs
REPO=${HERE:h:h}
ARES="node --require $REPO/scripts/node24-ares-compat.cjs $REPO/node_modules/@webos-tools/cli/bin"
cd $REPO
for v in "$@"; do
  eval "$ARES/ares-launch.js -d nuvio-lg-145 --close space.nuvio.webos" >/dev/null 2>&1
  eval "$ARES/ares-install.js -d nuvio-lg-145 $AB/$v.ipk" >/dev/null 2>&1 || { echo "{\"label\":\"$v\",\"error\":\"install\"}"; continue; }
  sleep 3
  eval "$ARES/ares-launch.js -d nuvio-lg-145 space.nuvio.webos" >/dev/null 2>&1
  sleep 4
  log=$AB/inspect-$v.log
  eval "$ARES/ares-inspect.js -a space.nuvio.webos -d nuvio-lg-145" >$log 2>&1 &
  ipid=$!
  url=""
  for i in {1..30}; do url=$(grep -o 'ws=localhost:[0-9]*/devtools/page/[A-Z0-9]*' $log | head -1); [ -n "$url" ] && break; sleep 1; done
  if [ -z "$url" ]; then echo "{\"label\":\"$v\",\"error\":\"inspect\"}"; kill $ipid 2>/dev/null; continue; fi
  sleep 2
  node $HERE/measure.mjs $v "ws://${url#ws=}" 2>>$AB/measure-$v.err || echo "{\"label\":\"$v\",\"error\":\"measure exit\"}"
  kill $ipid 2>/dev/null; pkill -f "ares-inspect.js -a space.nuvio.webos" 2>/dev/null
  sleep 2
done
