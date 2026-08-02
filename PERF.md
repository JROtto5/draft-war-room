# Performance notes

**Budgets v2** (enforced by `scripts/lint.mjs`, warning at 90%): the former
app.js hit 99% of its 215KB budget and was split into ordered modules —
core.js ≤ 107KB · views.js ≤ 88KB · wire.js ≤ 83KB · boot.js ≤ 29KB ·
engine.js ≤ 39KB · data.js ≤ 439KB · styles.css ≤ 68KB · index.html ≤ 33KB.
Load order (data → engine → core → views → wire → boot) is lint-enforced and
E2E sentinels prove each module executed. Marked picks patch their row
instantly before the coalesced re-render; timers register for leak sweeps;
lint also audits palette contrast ratios.

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
