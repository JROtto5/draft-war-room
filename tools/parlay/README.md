# Parlay pricing toolkit

Turns a DraftKings projection export (the RotoGrinders `projections_draftkings_nfl_*.csv`
shape: `fpts,ceil,floor,proj_own,salary,...`) into fair prop lines and correlation-aware
parlay prices.

**These files contain no sportsbook odds.** The toolkit computes a *fair* price — the
break-even implied by the projections. It cannot compute edge. A bet exists only where a
book's posted number differs from fair.

## Files

| File | Does |
|---|---|
| `engine.py` | Fits a lognormal per player, prices single legs and correlated parlays |
| `decomp.py` | Converts DK fantasy points into implied receptions / yards / TDs |
| `optimize.py` | Searches the full same-game parlay space for the best structure at each payout tier |
| `card.html` | A published example output for slate 151307 |

## The distributional model

Each player's weekly DK score is modelled lognormal with **median = `fpts`, P90 = `ceil`,
P10 = `floor`**. Two checks establish this rather than assume it:

1. `sqrt(ceil*floor) / fpts` ≈ 1.00 across 170 skill players, i.e. ceiling and floor are
   symmetric in log space around `fpts` — which is what it means for `fpts` to be the median
   of a lognormal.
2. Solving for sigma under a 90/10 reading gives implied coefficients of variation of
   QB 0.35, RB 0.51, WR 0.61, TE 0.60 — matching real NFL weekly variance. An 85/15 or 95/5
   reading does not.

`fpts` being the **median** matters: the lognormal mean sits 6% (QB) to 19% (WR/TE) above it.
If a book sets a line at a mean-based consensus projection, the over is a 38–43% shot, not a
coin flip.

## Correlation

`parlay_prob()` draws joint outcomes through a Gaussian copula over the fitted marginals,
using a standard NFL correlation structure (same-team QB→WR +0.58, QB→TE +0.50, RB→RB −0.28;
opposing QB→QB +0.22, WR→WR +0.16). This is a specified structure, not estimated from the
slate, so lift magnitudes carry more model risk than single-leg probabilities do.

It returns both the joint probability and the naive independent product. The ratio is what
a book pricing legs independently would be giving away.

Correlation lift grows with **both** leg count and threshold depth:

| | lift |
|---|---|
| 3 legs, same game | 2.9× median |
| 4 legs, same game | 4.2× |
| 5 legs, same game | 7.4× |
| 6 legs, same game | 15.4× (best found: 75×) |
| any count, different games | 1.0× |

Practical consequence: conservative parlays gain almost nothing from stacking, aggressive
ones gain enormously. Safe parlays can be spread; longshots must be concentrated in one game.

## Defenses are excluded

`p_over()` emits a warning and its result is unusable for DST. The published DST columns are
not on the same footing as skill players: `ceil/fpts` runs ~6× (vs ~2×), 10 of 23 defenses
have a floor above their own median — impossible for a 10th percentile — and two have a floor
at or below zero. The DST `ceil` is a max case (defensive TD plus shutout), not a percentile.

## Known limitation

`decomp.py` scales yardage by each player's *fantasy-point* sigma. Much of fantasy variance is
touchdown variance rather than yardage variance, so decomposed yardage **tails run high** —
roughly 8–10 points too high at the 350-passing-yard mark. The median decompositions are sound;
do not price tail yardage props off them. Bet fantasy-points props, which need no translation.

## Usage

```bash
cd tools/parlay
python3 optimize.py                 # expects ./proj.csv, writes opt_results.json

python3 - <<'PY'
import engine
P = engine.load('proj.csv')
burrow, chase = engine.find(P,'Joe Burrow'), engine.find(P,"Ja'Marr")
print(engine.p_over(chase, 19.8), engine.american(engine.p_over(chase, 19.8)))
joint, naive = engine.parlay_prob([(burrow,19.5,'over'), (chase,19.8,'over')])
print(f"{joint:.4f} vs {naive:.4f} naive — lift {joint/naive:.2f}x")
PY
```

Pure stdlib, no dependencies.
