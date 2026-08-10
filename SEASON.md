# Season Mode — how the war room runs September through January

Season Mode turns on by itself: once your Sleeper league ID is in Settings and
the league's draft is complete, the finished draft imports on load (your picks
detected by draft slot) and Season HQ becomes page 1.

## The loops

| Loop | Cadence | What it does |
|---|---|---|
| Season tick | 5 min (visibility-aware) | NFL week, live roster, matchup data, heat scan, lineup alarm, waiver-day reminder, milestones |
| Scoreboard loop | 2 min in game windows (Sun, Mon/Thu nights), 15 min otherwise | league matchups, game-day checks (inactives, score bursts, close games, opponent news), season ticker |

## Sleeper endpoints touched (all public, no keys)

`/state/nfl` (current week) · `/league/<id>` (waiver settings) ·
`/league/<id>/rosters` · `/league/<id>/users` · `/league/<id>/matchups/<w>`
(live + history + future pairings for playoff odds) ·
`/league/<id>/transactions/<w>` · `/draft/<id>` + `/picks` (import) ·
`/players/nfl/trending/add` and `/trending/drop`

## The surfaces (season deck, left to right)

📊 **Scores** — every matchup live with projected finals and win %, standings,
power rankings with movement, all-play luck index, last week's awards, my
lineup-efficiency line, 300-sim playoff odds. ⌨ `s`

📥 **Waivers** — add/drop upgrade pairs with +pts/week, FAAB for all 12 teams,
bid suggester, claim planner with lineup what-if, bye-hole fixes, DEF
streamer, stash radar, trending drops, league wire, rival FAAB spy. ⌨ `v`

🔁 **Trades** — builder with both-lineup verdicts, finder scanning all 11
rosters, 2-for-1 packages, strength heatmap, buy-low/sell-high, playoff-odds
impact, PNG proposal card, trade block, per-team notes. ⌨ `d`

📈 **Season** — efficiency sparkline, luck ledger, MVP/bust tallies, waiver
ROI, trade ROI, draft-judged-by-reality, ghost season, JSON export. ⌨ `x`

📖 **Recap** — last week's story with MVP, bust, efficiency, luck note, and a
share-card PNG. 🔔 **Alerts** — every alert ever fired, unread count on the bell.

## Alert matrix (Settings → Season Mode)

heat · lineup (inactive sweeper + weekly alarm) · scores (burst threshold) ·
close games · waiver day · opponent news — all through one dispatcher that
respects quiet hours, falls back to title-blink when notifications are denied,
and keeps the PWA badge equal to real pending actions.

## Storage keys (all under the board's LS prefix)

`-mhist` weekly matchup archive · `-txhist` transaction archive · `-claims`
waiver planner · `-tblock` trade block · `-tnotes` team notes · `-alertlog`
alert center · `-heatseen` `-inact<w>` `-oppout<w>` `-close<w>` `-lineupalarm`
`-wvday` `-smiles` one-shot alert guards · `-powerprev` ranking movement.
