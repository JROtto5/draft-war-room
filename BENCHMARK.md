# Benchmark — engine vs pure-ADP drafter

Both drafters take Otto's slot in identical sim rooms (same seeds, same CPU
opponents from `seedCpuTeams`) and we compare projected **starter points**.
The ADP bot always takes the best remaining ADP that keeps its roster legal;
the engine runs its full Balanced strategy (VORP, needs, stacks, saturation,
late-round upside).

Regenerate: `node scripts/benchmark.mjs 100 --write`

## Latest run (100 sims)

```
engine  avg 2105.4 pts   p10 2056   p90 2167
ADP-bot avg 1742.2 pts   p10 1679   p90 1796
edge    +363.1 pts/season starters   head-to-head 100/100 (100%)
```

A CI smoke (20 sims) asserts the engine's average never falls below the ADP
bot's — if a scoring change regresses the engine below "just follow the
board", the build fails.
