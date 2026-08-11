# SIM.md — how the futures are computed

## Matchup sim (🎲)
1,000 Sundays: every starter sampled N(weekProj, playerVariance), same-team
QB+catcher correlated (0.55 shared factor). Outputs win rate, p10/p50/p90,
blowout/collapse/one-score, leverage, variant table by WIN RATE.

## Season sim (🔮) — injury world
500 seasons over the real remaining pairings. Team weekly score =
strength(mu) − injury drag + triangular noise (σ≈26). The injury engine
(#1082–#1096):

- **Hazard**: weekly P(new multi-week injury) = position base (RB 4.0%,
  TE 3.2%, WR 3.0%, QB 2.2%) × age (28+ ×1.2, 30+ ×1.4) × nagging-flag ×1.35,
  capped 9%. Calibrated ≈2–4 multi-week injuries per roster-season.
- **Duration**: geometric, mean ≈2.2 weeks, max 5.
- **Cost**: dependence = player's 4-week value − next-man-up (bench third-best
  at position, floored at positional replacement). Deep teams bleed less.
- **Current O/IR**: enter sims with sampled returns (IR 4–8 wks, O 1–3).
- **Toggle**: clean-world vs injury-world in the 🔮 overlay; the headline
  playoff odds carry an expected-injury drag (Σ dep×haz×2.2) either way.

## Weekly vectors (v2, #1097–#1111)
Team strength is a PER-WEEK vector: each roster's real optimal lineup that
week (byes and injuries land exactly where the calendar puts them), with team
σ rolled up from starters' individual variances. Below-median teams drift
+2%/wk toward replacement (leagues heal). Ties break on PF everywhere; the
bracket reseeds semis and gives the better seed +1.5 homefield. Outputs add
make→final→title chain, toilet-bowl %, and sim-wide rival H2H.

## Projection sources
weekProj feeds every sim; source picker (📊/📱/🔀) and 📌 pins upstream of
everything — see DATA-FLOW.md.

## Determinism
Every sim is seeded (week-derived + re-roll counter). Same seed, same future.

## Opponent behavior (#1112–#1126)
Opponents aren't optimal robots: each team sims at ITS OWN season lineup
efficiency (archive-learned, floor 85%), and waiver drift is scaled by FAAB
aggression from the tendency board (big spenders heal ×1.5, ghosts ×0.6).
One cached 150-sim-per-team vector run (leagueFutures) powers the scoreboard
Futures table (record · make% · title% with week-over-week arrows), scout
future cards, dossier lines, and the Sunday rooting guide — the 2–3 games
whose outcomes move MY playoff odds most, pushed into the ticker.

## What-if machine (#1127–#1141)
Scenarios apply roster deltas (add/drop/void-weeks) to MY weekly vector only,
then re-run the full injury-world sim — trade builder shows make%/title%
before→after, waiver rows carry a 🔮 season-impact tap, injury what-ifs void a
player for N weeks. Clinch math tallies wins→make% across 400 sims: clinch =
fewest wins at ≥95%, dead = most wins at ≤5%; magic numbers surface in the
chase card from week 8 and elimination-watch alerts on full send. Odds carry
±1.96·SE bands. Up to 3 scenarios persist for side-by-side reruns.

## Edge intelligence (#1242–#1256)
edgeScan ranks exploitable edges by value×confidence: **BREAKOUT** (heat +
soft next-3 SOS + spike/breakout profile + rising 3-week trend, still on the
wire), **BUY LOW / SELL HIGH** (3-week actual vs ppgOf expectation, ±3),
**SCHEDULE** (next-3 opponents ≥23/32) and **PLAYOFF ALPHA** (weeks 15–17
≥24/32, before week 12), **FADE THE CROWD** (>4k adds on a <7 ppg player).
Confidence = data volume + effect size (HIGH/MED/LOW), the scarcity clock
counts startable free agents per position, every row links to the actual move,
and acted-on edges are logged for accountability. The top non-LOW edge is
absorbed into the Game Plan's move list.
