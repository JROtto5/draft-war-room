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
