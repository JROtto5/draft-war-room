# Draft War Room — The Manual

## Getting in
The door asks for the house key (you know the classic). `?demo` shows a live
sample board; `?wall` turns a second window into a TV board; `?e2e` is for tests.

## Before draft day
Settings → check the **Prep checklist** in Help. Set slot, league names, 💖
favorites (state/college), rival, risk appetite, timer, draft date. Study
cards (`C` compare, `Q` queue, boost/fade from the Intel tab), pin a **Plan**
target per round, rehearse with 🎲 Mocks and 🧪 Scenarios, export your prep
file to your phone.

## Drafting on Sleeper?
Settings → paste the league ID (names import themselves), then hit **🔄 Sync**
when the room opens — every pick marks itself. See SYNC.md.

## Draft day
Flip **🔴 Live**. Mark every pick — `✓ MINE` for yours, `✕ taken` for theirs
(📋 Paste to catch up; click the pick banner to resync the number). The panic
banner and `P` take your queue-top/engine-top instantly; `1–9` grab from Best
Available; the chime, pace clock and app badge keep you honest. Watch the
pills: pace deltas, elite shelf, run flames, threat board, VONA.

## Reading a player card
Overview: story, chips (💖 rookie/injury/finish/depth/regression), projection
band, survival odds at both your picks. History: three seasons of bars,
trends, PPG floor/ceiling. Intel: analyst note, prop leans, buzz, playoff
slate, market edits (ADP ✎, tier ▲▼, boost/fade), your note, one-pager, 🖼 PNG.

## After the draft
Confetti → 🎓 Report (grade, awards, steals, stacks, roots map, hindsight).
Season HQ takes over the hero: 📡 waiver radar, 📰 your players' headlines,
🏥 IR stashes, 📅 week recaps once games start, 🔔 injury notifications.

## Every summer
`./tools/refresh.sh new-projections.csv new-board.csv` then push. Done.

Any-league setup: LEAGUES.md · Live sync: SYNC.md · In-season: SEASONS.md · Full docs: README · PREP · ENGINE · PERF · DATA · ARCHITECTURE · BESTPRACTICES · PRIVACY · CHANGELOG.

## Sim lab extras (v9)

- Mock picks carry a tiny letter: **N**eed, **S**tack, **V**alue, **F**orced opening.
- The 🎲 seed under the strategy brief reproduces any mock exactly — paste a
  seed and **re-run**, or **A/B vs seed** to see how many picks are room noise.
- Settings → 🌊 **Run contagion** tunes how hard sim rooms panic during a
  position run (lower = harder panic).
- Settings → 🔊 **Sound theme** picks the draft-day soundscape; 💬 add your own
  lock-screen quips (one per line). If a draft date is set, the lock screen
  counts down to it.
- During live drafts the header shows the 🏆 **MVP belt** — the best-value pick
  of the draft so far. Milestone toasts fire at 25/50/75/90% with the room's pace.

## 🏟 The season loop (v11)

Draft's over — here's the weekly rhythm the app runs with you:

1. **Monday**: HQ shows the Monday review (result, efficiency, what's heating
   on the wire). Open 📖 Recap for the story + share card, then 📥 Waivers and
   plan claims — the planner tracks your bids against your FAAB.
2. **Waiver day**: you get a reminder if claims are pending. Landed adds show
   up in the live roster automatically on the next tick.
3. **Week**: My Week panel keeps the optimal lineup current (byes, injuries,
   matchups). If your ACTUAL Sleeper lineup leaves points on the bench, the
   red banner names the swaps. The superflex guard yells if a QB sits.
4. **Game day**: scoreboard refreshes every 2 minutes, the ticker crawls your
   players' live points, and alerts fire for inactives, score bursts, close
   games, and your opponent's bad news. Monday-night math tells you exactly
   what you need.
5. **Deck keys**: `s` scores · `v` waivers · `d` trades · `x` season · `w` top.

Draft-day tools live behind 🗂 Draft ▾ in the header all season.

## 🏆 The Win Machine (v12)

Five weapons, one loop (see WINNING.md for the doctrine):

- **🏆 Plan (`g`)** — the one-pager. Moves ranked by win-prob gain with
  LOCK/LEAN/COIN-FLIP confidence, what the game is worth in playoff odds,
  path to playoffs, deadline stance. Tick moves off; it nags Sunday if you don't.
- **🎲 Sim (`m`)** — 1,000 simulated Sundays with stack correlation. Trust the
  win rate over the projection: sometimes the "worse" flex wins more games.
- **🕵️ Scout** — every opponent's sloppiness, thin rooms, infirmary, and
  tendencies. Share the beatdown bars when appropriate. It's always appropriate.
- **😤 Ego** — hype card, draft receipts, trash talk with citations, and the
  pregame speech (FULL SEND only). The humility guard mutes it 48h after a loss.
- **🧘 Ritual** — checklist, goals, management grade, confidence calibration,
  and the bright side when it stings. Streaks reward the process.

Game day runs itself: real NFL clocks on every player, live win probability,
scenario ticker, two-minute-drill pings, and the late-window verdict.

## 🎛 The v13 interface

- **Left: the rail.** Scorebug (live score + win%), stat tiles, quick actions,
  the Starting Nine with headshots, bench drawer, the wire, byes ahead.
- **Center: the dashboard.** Sticky week bar, the matchup hero with the win
  dial and both lineups, five KPI tiles, then standings / around-the-league /
  the chase / the wire as cards. `▤` toggles compact density; 🗂 reveals the
  player pool; ✏️ jumps to the draft room.
- **Phone: the tab bar.** Plan · Sim · Scores · Wire · More (everything else).
  Overlays slide up as sheets. Pull down at the top to refresh.
- **Calm mode** (Settings) turns off every decorative animation.

## ⚙️ v14: the app does things now

- **Swap:** ⇄ on any starter (rail or hero) → ranked bench with deltas →
  staged with OUT/IN chips → one tap to commit in Sleeper (auto-clears when
  matched). ⚡ Stage optimal does the whole lineup at once; slot chips open
  the per-slot editor; locked (kicked-off) players are excluded.
- **Your numbers:** Settings → 📄 drop a name,ppg CSV (or pull real Sleeper
  PPG). Pins (📌) flow through literally everything — see DATA-FLOW.md.
- **The crystal ball:** 🔮 Future (or `y`) = 500 simulated seasons: record
  distribution, seed odds, title chain, the road week by week, and what your
  lineup sloppiness costs in wins.

## 🎛 The Sim Center (v15)

One home for every future: **This week** (1,000 Sundays), **Season** (500
lineup-aware injury-world seasons), **What-if** (scenarios priced in playoff
odds), **Fragility** (who breaks and what it costs). Tabs at the top of each,
`m`/`y` deep-link, runs share caches so switching is instant, and the Season
tab exports its full results as JSON.
