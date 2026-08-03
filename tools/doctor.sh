#!/usr/bin/env bash
# MIT License — see LICENSE. © 2026 JROtto5 / Draft War Room.
# Environment checkup for Draft War Room development.
cd "$(dirname "$0")/.."
ok(){ echo "✅ $1"; } ; bad(){ echo "❌ $1"; }
command -v node >/dev/null && ok "node $(node -v)" || bad "node missing"
command -v python3 >/dev/null && ok "python3 $(python3 -V 2>&1 | cut -d' ' -f2)" || bad "python3 missing"
(command -v chromium || command -v google-chrome) >/dev/null && ok "chrome/chromium present" || bad "no headless browser (E2E will skip)"
command -v gh >/dev/null && gh auth status >/dev/null 2>&1 && ok "gh authenticated" || bad "gh missing/unauthenticated"
curl -s --max-time 6 -o /dev/null -w "" https://api.sleeper.app/v1/state/nfl && ok "Sleeper API reachable" || bad "Sleeper API unreachable"
curl -s --max-time 6 -o /dev/null https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=1 && ok "ESPN API reachable" || bad "ESPN API unreachable"
node scripts/lint.mjs >/dev/null && ok "lint passes" || bad "lint failing"
npx -y -p typescript@5.6.3 tsc --allowJs --checkJs --noEmit --target es2020 engine.js >/dev/null 2>&1 && ok "engine.js type-checks" || bad "engine.js type errors"
echo "Doctor done."
