# Using the War Room for any league

Settings → **Roster shape**: set starting slots (QB/RB/WR/TE/FLEX/SFLX/DEF/K)
and bench. Everything derives from the shape — required minimums, roster
size, replacement levels, positional saturation, lineup autofill, standings.
Presets: Buck Breakers (superflex, no K), ESPN default, Yahoo default.

Scoring: full/half PPR, custom points-per-reception (any value — 0.25 works),
TE premium, 4 or 6-point passing TDs.

**Auction leagues**: every card shows a dollar value (budget-configurable,
$1-floor math). Flip auction mode and each of your picks asks the price paid;
the roster header tracks budget remaining.

No kicker data ships by default (Buck Breakers has none) — run
`tools/enrich.py --keep-kickers` or add kickers via **+ Player**.

Share links carry the whole league shape, so one setup configures everyone.
