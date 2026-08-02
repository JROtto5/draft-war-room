#!/usr/bin/env bash
# ./tools/release.sh 5.0   — bump version, bump SW cache, test, tag
set -euo pipefail
cd "$(dirname "$0")/.."
NEW="${1:?usage: release.sh <version>}"
sed -i "s/const BUILD = \"[^\"]*\";/const BUILD = \"$NEW\";/" app.js
V=$(grep -o 'war-room-v[0-9]*' sw.js | head -1 | grep -o '[0-9]*')
sed -i "s/war-room-v$V/war-room-v$((V+1))/" sw.js
node --check app.js && node --check sw.js
node scripts/lint.mjs
node tests/data.test.mjs && node tests/logic.test.mjs
git add -A && git commit -m "Release v$NEW"
git tag "v$NEW" -m "Draft War Room v$NEW"
echo "✅ v$NEW ready — push with: git push && git push --tags"
