#!/usr/bin/env bash
# tools/shot.sh [name] [url] [WxH] — screenshot the app (#957)
set -e
cd "$(dirname "$0")/.."
NAME="${1:-season}"; URL="${2:-http://localhost:8199/?peek}"; SIZE="${3:-1600,1000}"
chromium --headless=new --no-sandbox --user-data-dir="/tmp/wr-shot-$NAME" --window-size="$SIZE" \
  --virtual-time-budget=20000 --screenshot="shots/$NAME.png" "$URL" 2>/dev/null
echo "shots/$NAME.png"
