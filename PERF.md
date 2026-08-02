# Performance notes

**Budgets** (enforced by `scripts/lint.mjs` in CI): app.js ≤ 215KB, engine.js
≤ 40KB, data.js ≤ 440KB, styles.css ≤ 68KB, index.html ≤ 29KB.

**Techniques in play**: rAF-coalesced renders · staged first paint (pool
first, side panels next frame) · 250-row window extending on scroll ·
`content-visibility:auto` rows + `contain:content` panels · memoized engine
behind a state fingerprint · idle pre-warm of the Monte Carlo · chunked mock
sims · self-hosted fonts (no third-party blocking) · lazy, negative-cached
avatars · CSS-only skeletons.

**Measure**: `performance.measure("war-room-render")` wraps every full
render — check DevTools › Performance › Timings. E2E asserts a render of the
capped board under 400ms in headless Chrome.

**Lighthouse checklist**: run against the Vercel URL — PWA installable ✓,
CSP ✓, preconnects to image CDNs ✓, fonts self-hosted ✓, meta description ✓.
