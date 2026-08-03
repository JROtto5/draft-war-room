## What changed

<!-- one or two sentences -->

## Test evidence

- [ ] `./scripts/test-all.sh` — all local suites green
- [ ] Headless E2E (`tests/build-e2e.mjs` + chromium) — 23/23
- [ ] Marathon (`tests/build-marathon.mjs`) — 10/10 (if draft flow touched)
- [ ] `sw.js` cache version bumped (required whenever shipped files change)
- [ ] `node scripts/lint.mjs` — budgets and load order OK
