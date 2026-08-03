# Changelog — Draft War Room

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
