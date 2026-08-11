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

## Projection sources
weekProj feeds every sim; source picker (📊/📱/🔀) and 📌 pins upstream of
everything — see DATA-FLOW.md.

## Determinism
Every sim is seeded (week-derived + re-roll counter). Same seed, same future.
