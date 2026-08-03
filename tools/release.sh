#!/usr/bin/env bash
# MIT License — see LICENSE. © 2026 JROtto5 / Draft War Room.
# ./tools/release.sh 5.0   — bump version, bump SW cache, test, tag
set -euo pipefail
cd "$(dirname "$0")/.."
NEW="${1:?usage: release.sh <version>}"
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ working tree is dirty — commit or stash first"; exit 1
fi
sed -i "s/const BUILD = \"[^\"]*\";/const BUILD = \"$NEW\";/" boot.js
V=$(grep -o 'war-room-v[0-9]*' sw.js | head -1 | grep -o '[0-9]*')
sed -i "s/war-room-v$V/war-room-v$((V+1))/" sw.js
for f in core.js views.js wire.js boot.js sw.js; do node --check $f; done
# integrity manifest: sha256 of every shipped file (#578)
node scripts/gen-integrity.mjs
node scripts/gen-integrity.mjs --verify
node scripts/lint.mjs
node tests/data.test.mjs && node tests/logic.test.mjs
git add -A && git commit -m "Release v$NEW"
git tag "v$NEW" -m "Draft War Room v$NEW"
echo "Release notes (for gh release create v$NEW --notes-file <(node scripts/release-notes.mjs)):"
node scripts/release-notes.mjs | head -5
echo "✅ v$NEW ready — push with: git push && git push --tags"
