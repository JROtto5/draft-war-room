# DATA-FLOW.md — where every number comes from

## The one path (#1042)
`RAW` (baked season projections, 6pt-passTD full-PPR) → `allPlayers()` applies
scoring settings **then `S.overrides[id]`** (your CSV/PPG pins, stored at season
scale = ppg×16) → `p.proj` is the single override-aware season number.

- **Display ppg** → `ppgOf(p)` = proj/16, 1 decimal.
- **Weekly projection** → `weekProj(p, w)`: proj/16, zeroed on bye/OUT/IR,
  ×0.85 Q, ×0.4 D, ± opponent-defense lean. Consumed by: the rail, the hero,
  the plan, the swap sheet, waivers (`nextWeeksValue` = 3-week average),
  the matchup sim (`buildSimLine` mu), and staging deltas.
- **Variance** → `playerVariance(p)`: archive stdev when 3+ weeks, else
  spike-rate proxy off `p.proj`. Feeds the sim and confidence tags.
- **Season sim mu** → `rosterStrengthOf(rid)` = optimal-lineup proj/16, so
  pinned numbers move your simulated future.
- **Actual points** → Sleeper `players_points` per matchup: always beat
  projections in display (bold = banked, plain ~ = projected), archived weekly
  to `-mhist`, feed efficiency/ROI/consistency/live-sim locking.

## Sources (#1067–#1081)
Three weekly sources, one switch inside `weekProj`:
📊 **baked** (draft-CSV season model ÷16, matchup-leaned) · 📱 **Sleeper weekly**
(their live per-week numbers, 6pt-corrected via +2×pass_td, used as-is) ·
🔀 **blend** (slider-weighted mix, leaned). Priority: 📌 pins → source → bye/
injury zeros and discounts on top. Feed cached per week in `-projx<w>`,
prefetched w..w+2 on the season tick, silent-but-visible fallback to baked.

## Scales
Season totals live only in `p.proj` and the archive; every visible weekly
number passes through ppgOf/weekProj (≤ 60 by construction). CSV imports
auto-detect scale (avg > 60 = season) and sanity-reject rows outside 2–700.

## Cache correctness (#1048)
`cached()`/`_idx` key on `stateKey()` — overrides live in `S`, so any change
re-keys every memo. Imports also force `_memo={key:null}` and re-render.

## Persistence (#1051)
`S.overrides` is board state: autosaved, included in Export, restored by
Import, wiped only by ↩ clear (with count confirm).
