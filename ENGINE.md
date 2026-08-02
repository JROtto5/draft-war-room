# Engine notes

**Layers.** `engine.js` is the pure kernel (RNG, snake parsing, saturation,
injury grading, formatting) — imported directly by `tests/engine.test.mjs`
with zero DOM stubbing. `app.js` hosts the stateful engine (VORP scoring,
Monte Carlo, mocks) whose free variables (`S`, `INJ`, `_memo`) bind to the
page. A dedicated Web Worker was evaluated for the sims; because the stateful
engine is deliberately global-bound, the shipped answer is **chunked
execution**: mock sims yield to the event loop between runs with a progress
readout, and the odds Monte Carlo is pre-warmed in `requestIdleCallback`
after every commit, so interaction never blocks.

**CPU model** (`cpuPick`) — one brain for odds, mocks, sim-to-pick and the
predictor: market eADP → injury slide → per-team QB greed → **observed
tendency bias** (each real team's average reach, measured from the log,
recentered into their sim noise) → **run contagion** (a hot position gets a
0.92 urgency multiplier while a 2+ streak is live) → seeded noise.

**Scoring pipeline** (`scoreBoard`): VORP → risk dial (3-year floor/ceiling)
→ boost/fade → saturation → needs/locks → stacks & anti-correlation → intel →
injuries → tier cliffs → market fall notes. Everything memoized behind
`stateKey()`; sim count is user-tunable (20–100).
