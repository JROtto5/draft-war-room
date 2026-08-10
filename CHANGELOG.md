# Changelog — Draft War Room

## v13.0 (2026-08-10) — The Badass Update (#849–#948)
The interface catches up to the engine. 🏟 The Rail: broadcast scorebug,
stat tiles, quick actions, Starting Nine with headshots and slot chips, bench
drawer, skeleton-first loading · 🎨 identity v2: design tokens, the signature
gradient, button/chip systems, unified overlay mastheads, zebra tables, gold
focus rings, real light-theme depth · 📊 dashboard: matchup hero with SVG win
dial, five KPI tiles, card grid (standings with movement + PF/PA bars,
around-the-league mini bugs, the chase, the wire), density toggle, deep links ·
📈 chart kit: areas with reference lines, paired bars vs league median,
standings race (me in gold), smoothed sim distributions with p10/p90 markers,
count-up numbers · ✨ motion: first-paint choreography, sheet/overlay
entrances, spring presses, dial sweep, score flashes, ticker fades — all
behind reduced-motion plus a 🧊 calm mode · 📱 app feel: 5-tab bar + More
sheet, bottom-sheet overlays, 44px targets, sticky scorebug, landscape rail,
pull-to-refresh, safe areas everywhere. 48 E2E checks.

## v12.0 (2026-08-10) — The Win Hundred (#740–#839)
Built to win it all, and loud about it. 🏆 Game Plan: every move ranked by
win-prob gain with LOCK/LEAN/COIN-FLIP confidence, floor-when-favored /
ceiling-when-chasing lineups, must-win playoff-swing pricing, path to
playoffs, deadline stance · 🎲 1,000-Sunday Monte Carlo with stack
correlation, p10/p90 honesty bars, leverage men, lineup variants judged by
WIN RATE · 🕵️ opponent scouting: sloppiness index, exploit windows, tendency
board, H2H ledger, beatdown share card · 😤 hype engine: ego dashboard, hype
card, draft receipts, cited trash talk, TTS pregame speech, humility guard ·
📡 live war room v2: real ESPN game clocks per player, live re-sim win prob
with the rollercoaster sparkline, scenario ticker, two-minute-drill pings,
garbage-time detection · 🧘 rituals: auto-detecting checklist with streaks,
goal progress bars, A–F management grades, bright-side + autopsy after
losses, confidence calibration, rival death-watch, heater skin. New win.js
module, duplicate-global lint, 42 E2E checks.

## v11.0 (2026-08-10) — Season Mode (#634–#739)
The draft ended; the app didn't. 🏁 finished Sleeper drafts import
themselves and Season HQ becomes page 1 · 🗓 My Week: live roster, week-aware
optimal lineup, actual-vs-optimal start/sit with named swaps, superflex guard,
flex agonizer, matchup preview with win prob, bye forecaster · 📊 league
scoreboard with live points, standings, power rankings, all-play luck,
weekly awards, 300-sim playoff odds · 📥 waiver war room: upgrade pairs, FAAB
intel, bid suggester, claim planner, DEF streamer, stash radar, transactions
wire · 🔁 trade machine: both-lineup verdicts, league-wide finder, 2-for-1
packages, strength heatmap, buy-low/sell-high, playoff-odds impact, PNG
proposal card · 🔥 heat alerts for trending free agents in YOUR league ·
🚨 game-day grid: inactive sweeper, score bursts, close-game alerts,
Monday-night math, live season ticker, alert center with quiet hours ·
📈 season analytics: efficiency, luck ledger, waiver/trade/draft ROI, ghost
season, milestones, JSON export · 🎛 season command deck (mobile bottom dock),
draft tools folded behind 🗂 Draft ▾, keyboard shortcuts s/v/d/x/w. New
season.js module. E2E grows to 33 checks.

## v10.0 (2026-08-03) — The Bold Update (#601–#615)
⚡ **On-the-Clock Takeover**: your pick arrives and the screen becomes a
decision cockpit — top 3 with the case for each, survival odds if you wait,
one-tap draft · 🎯 **Snipe alerts** predict who's stealing your targets before
your turn · 🧠 **Coach's Call** argues the top pick in plain English · 📜
**War Plan** pre-decides your next three picks with fallbacks · 🎙 **voice
control** ("taken Gibbs", "mine Bowers") · 📺 broadcast-booth commentary +
live market ticker · 🔀 **what-if time machine** re-simulates any of your
picks · 👻 **ghost drafter** races the engine in parallel · 📈 annotated
win-probability chart · ⚔️ rivalry radar (grudge tracking) · 📱 pocket
cheat-card wallpaper · 🏁 60-second cinematic draft story · 🎛 glove-mode
command strip. E2E grows to 27 checks.

## v9.0 (2026-08-03) — The sixth hundred (#501–#600)
Table superpowers: query operators (`pos:` `team:` `bye:` `tier:` `rookie:`),
saveable filter presets, multi-select mass actions, pinned rows · sim realism:
live ADP drift, CPU teams that stack their QB and handcuff their RB1, tunable
run contagion, late-round upside autopilot, reason-tagged mock picks,
reproducible seeds with A/B compare · **benchmark: the engine beats a pure-ADP
drafter 100/100 rooms (+363 starter pts), enforced by a CI smoke gate** ·
personality: sound themes, heart confetti, superlatives, MVP belt, milestone
toasts, emoji rivals, editable quips, og-image · trust: @ts-check'd kernel with
tsc in CI, sha256 integrity manifest per release, CODEOWNERS, issue forms,
SECURITY.md, dependabot, least-privilege CI.

## v8.0 (2026-08-02) — The fifth hundred (#401–#500)
🔄 Live Sleeper draft sync (picks mark themselves) · real 2026 byes + season
SOS from ESPN schedules · red-zone/snap/playoff/spike-week usage layer ·
any-league roster shapes with auction values · traded-pick ownership, board
editing and replay · voice notes, rebindable keys · modular architecture
(core/views/wire/boot) with per-module budgets, goldens, coverage and a
19-check E2E · Season HQ: title odds, FAAB hints, digests, calendars.

## v7.0 (2026-08-02) — The fourth hundred (#301–#400)
Engine: pure kernel (engine.js), adaptive bots that learn each team's reach
tendency, run contagion, risk dial, sim-count setting, offense environment,
projection bands. Prep: plan board with on-clock reminders, scenario matrix,
prep files, queue target rounds. Season: waiver radar, week recaps, injury
notifications, wake lock, app badge. Delight: awards, achievements,
soundboard, terminal skin, Konami mode, roster-roots map. A11y/perf: SR
announcer, font sizes, colorblind palette, scroll windowing, IndexedDB
mirror, staged paint. QA: goldens, settings sweep, fuzz II, CI matrix +
artifacts, doctor, DATA.md, pre-commit. Docs: MANUAL, CONTRIBUTING, PREP,
ENGINE, PERF.

## v6.0 (2026-08-02) — The personalization & edge hundred (#201–#300)
Every player now has a life: hometown (with 💖 favorite-state/college mode),
college in school colors, high school, rookie class, birthday, an auto-written
Story paragraph, and three seasons of points/finishes with trend bars. New
edge layer: boost/fade lists, manual ADP, tier bumps, VONA already + pick
predictor, ⏩ sim-to-my-pick, per-pick grades, rival watch, snipe alerts,
handcuff finder, keeper costs & surplus, hindsight score, musical-chairs QB
alert, draft wall mode, hover scouting cards, and a research-mapped
BESTPRACTICES.md. Pipeline pulls 2023–2025 seasons.

## v5.0 (2026-08-02) — Fully-fledged product
195+ tracked improvements across 13 rounds. Highlights by era:

**R1–3 · The engine** — superflex VORP with saturation, requirement locks, tiers
+ cliffs, dual-horizon Monte Carlo survival odds, mocks with five strategies,
draft grade, snake math for slot 12, file split + CI.

**R4–5 · Identity & scouting** — player photos, team logos, player cards with
2025-vs-2026 stat tables, bios, positional finishes, market Edge, lineup impact,
light theme, PWA install.

**R6–7 · Live intelligence** — ESPN injury feed with severity grading and
mid-draft alerts, Sleeper trending, news, Draft Day mode (pace clock, chime,
panic button), standings + threat board with real league names, trade
calculator, share links, "Hello Otto" lock screen.

**R8–10 · Draft craft** — queue, keepers, context menus, MINE tab, command
palette, VONA, elite-shelf and run-risk reads, capital + tendency standings,
richer reports (value by round, reaches & steals, bench upside).

**R11–13 · Product** — spectator links, team pages, needs matrix, custom
PPR/TE-premium scoring, spoken picks, taunt generator, PNG reports, CSP,
self-hosted fonts, fuzz-tested state machine, Season HQ, trophy case, demo
mode, accents, countdown, changelog you are reading.

Annual data swap: `./tools/refresh.sh <proj.csv> <board.csv>`.
