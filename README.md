# 🏈 Draft War Room — Buck Breakers Edition

Live draft assistant for a **12-team superflex (2-QB) league with 6-point passing TDs**, drafting from **slot 12**. Zero-build static site — import the repo at [vercel.com/new](https://vercel.com/new) and it deploys.

## The engine

- **Value over replacement** scaled for superflex QB scarcity, positional-saturation aware (it knows your 4th QB is worthless and your 3rd is insurance)
- **Roster requirement tracking** (2 QB / 3 RB / 3 WR / 1 TE / 1 DEF floors, editable) — boosts needed positions, hard-locks when picks run short
- **Team stacks** (QB + pass-catcher) flagged 🔗 and boosted
- **Analyst targets** ⭐ and **prop-market leans** ▲▼ folded into recommendations
- **Tiers** auto-detected per position, with tier-cliff alerts
- **Monte Carlo survival odds** — % chance each player is still there at your next pick (snake-aware, back-to-back turn picks handled)
- **💎 falling-value** badges when players slide past ADP · **🚨 positional run** detector · **scarcity meter** of startable players left

## Tools

- **🎲 Mocks** — five simulated drafts from your seat under different strategies, from the live board state
- **⚖ Compare** — any two players head-to-head with an engine verdict
- **🎓 Grade** — autopilots the rest of your draft and grades it vs your seat's expected outcome
- **📋 Paste** — bulk-mark a pasted pick list as taken (fuzzy matched)
- **🖨 Sheet** — print-ready top-200 cheat sheet
- **My Roster** renders your actual lineup (QB/RB1/RB2/WR1/WR2/TE/FLEX/SFLX/DEF) auto-filled optimally

## Live drafting

Mark every pick: **✓ MINE** for yours, **✕ taken** for everyone else's (or 📋 Paste to catch up). Everything autosaves locally; auto-backups before import/reset with restore in ⚙ Settings; Export/Import JSON to move devices.

**Keyboard:** `/` search (fuzzy — `cmc`, `jsn` work) · `↑↓` highlight · `M` mine · `T` taken · `Ctrl+Z` undo · `Esc` clear

## Data

2026 projections from league CSVs (PPR + half-PPR, 4 or 6-pt pass TDs — all toggleable), market ADP with position-aware estimates for unlisted players, analyst target notes, and prop-market edges. Click any projection to override; add custom players via **+ Player**.
