# Engine notes (v2)

**Layers.** `engine.js` is the pure kernel (RNG, snake parsing, saturation,
injury grading, formatting) — imported directly by `tests/engine.test.mjs`
with zero DOM stubbing. `core.js` hosts the stateful engine (VORP scoring,
Monte Carlo, mocks) whose free variables (`S`, `INJ`, `_memo`) bind to the
page. A dedicated Web Worker was evaluated for the sims; because the stateful
engine is deliberately global-bound, the shipped answer is **chunked
execution**: mock sims yield to the event loop between runs with a progress
readout, and the odds Monte Carlo is pre-warmed in `requestIdleCallback`
after every commit, so interaction never blocks.

## CPU model (`cpuPick`)

One brain for odds, mocks, sim-to-pick, finish-the-room and the predictor.
Per candidate, in order:

1. **Market eADP** with injury slide (`injAdpFactor`).
2. **ADP drift** — a player who has fallen 10+ picks behind the current pick
   reprices into the best-available cluster (`pk-5 … pk+5`). Real rooms
   don't let a top-30 name rot at pick 80; neither do ours.
3. **QB greed** — per-team appetite for early quarterbacks (superflex rooms
   run hot).
4. **Stack lean** — once a CPU team owns a QB, its pass-catchers from that
   team get a 0.93 urgency bump in rounds 4–10 (`st.qbTeam`).
5. **Handcuff lean** — from round 9, a team sometimes (30%) leans toward the
   backup to its first RB (`st.rbTeam`, ×0.9).
6. **Observed tendency bias** — each real team's average reach, measured
   from the live log, recentered into their sim noise.
7. **Run contagion** — a hot position (2+ streak) gets an urgency multiplier,
   default **0.92**, tunable in Settings (lower = rooms panic harder).
8. Seeded noise (`mulberry32`), so every sim is reproducible.

## My picks in mocks (`runMock`)

Strategy score = engine score × need pressure × stack bonus × strategy
modifier, plus a **late-round upside shift**: in the final four rounds,
breakout profiles and 35%+ spike-rate players get ×1.08 while age-cliff
players get ×0.94 — benches should hold lottery tickets, not floors.
Every pick carries a reason tag: **N**eed / **S**tack / **V**alue / **F**orced.

## Seeds & reproducibility

The mock lab shows its seed (🎲) — paste a seed to re-run the exact same
room, or A/B two seeds to see how many picks swing on room noise alone.
`runMock(strat, seed)` with the same seed and state is bit-identical
(guarded by `tests/logic.test.mjs`).

## Benchmark

`node scripts/benchmark.mjs 100 --write` drafts Otto's slot with the full
engine and with a pure best-ADP bot in identical rooms, and writes
BENCHMARK.md. CI runs a 20-sim smoke and fails the build if the engine ever
scores below "just follow the board".

## Scoring pipeline (`scoreBoard`)

VORP → risk dial (3-year floor/ceiling) → boost/fade → saturation →
needs/locks → stacks & anti-correlation → intel → injuries → tier cliffs →
market fall notes. Everything memoized behind `stateKey()`; sim count is
user-tunable (20–100).
