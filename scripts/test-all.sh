#!/usr/bin/env bash
# One command, every suite (#429).
set -e
cd "$(dirname "$0")/.."
node scripts/lint.mjs
for t in tests/engine.test.mjs tests/data.test.mjs tests/golden.test.mjs tests/logic.test.mjs; do node "$t"; done
echo "all suites ✓ (browser E2E runs in CI / manually via tests/build-e2e.mjs)"
