# Changelog — Draft War Room

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
