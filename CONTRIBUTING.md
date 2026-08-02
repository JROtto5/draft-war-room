# Contributing

This is a family-league tool with a real test suite. Ground rules:

1. **No build step, no dependencies.** Four files ship: index.html, styles.css, engine.js (pure), app.js. Keep it that way.
2. **Green or it didn't happen.** `node scripts/lint.mjs && node tests/*.test.mjs`, plus the headless E2E (`tests/build-e2e.mjs`, serve, open `e2e.html?e2e`). The pre-commit hook (`ln -sf ../../scripts/hooks/pre-commit .git/hooks/pre-commit`) runs the fast half.
3. **Data comes from the pipeline.** Never hand-edit data.js — change tools/enrich.py and regenerate. Goldens (`tests/goldens.json`) guard the narrative outputs; rebless intentionally with `UPDATE_GOLDENS=1 node tests/golden.test.mjs` and mention why in the commit (goldens exist to make narrative drift a decision, not an accident).
4. **State changes need a migration.** Bump STATE_V, add to MIGRATIONS, add a fixture test.
5. Check `tools/doctor.sh` if anything seems off. Issues use the bug/enhancement/data/draft-day labels.
