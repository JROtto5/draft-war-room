#!/usr/bin/env bash
# MIT License — see LICENSE. © 2026 JROtto5 / Draft War Room.
# Annual data swap — run this every summer with the new CSVs.
#
#   ./tools/refresh.sh <projections.csv> <team-board.csv> [last-season]
#
# Example for the 2027 draft (2026 season just ended):
#   ./tools/refresh.sh ~/Downloads/proj2027.csv ~/Downloads/board2027.csv 2026
#   git add -A && git commit -m "2027 data" && git push   → Vercel redeploys
set -euo pipefail
cd "$(dirname "$0")/.."

PROJ="${1:?usage: refresh.sh <projections.csv> <team-board.csv> [last-season]}"
BOARD="${2:?need the team board csv too}"
SEASON="${3:-$(($(date +%Y) - 1))}"

rm -rf tools/.cache   # force fresh Sleeper/ESPN pulls (rosters, stats, injuries)
python3 tools/enrich.py --proj "$PROJ" --board "$BOARD" --season "$SEASON"

# bump the service worker so every open PWA picks up the new data
V=$(grep -o 'war-room-v[0-9]*' sw.js | head -1 | grep -o '[0-9]*')
sed -i "s/war-room-v$V/war-room-v$((V+1))/" sw.js

node --check data.js
node tests/data.test.mjs
node tests/logic.test.mjs
echo
echo "✅ Data refreshed for the $(($SEASON + 1)) draft (last season: $SEASON)."
echo "   Review: git diff --stat"
echo "   In-season: re-run monthly (or after big injuries) — stats/injuries/trends all refresh."
echo "   Ship:   git add -A && git commit -m '$(($SEASON + 1)) data' && git push"
