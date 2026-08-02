# 🏈 Draft War Room — 2-QB League Edition

Live fantasy football draft assistant built for a **2-QB league with 6-point passing touchdowns**.

**Live site:** deploy via Vercel (this is a zero-build static site — just import the repo).

## What it does

- **Best Available engine** — ranks every player by *value over replacement*, scaled for 2-QB scarcity (your league starts ~24 QBs, so QB replacement level is deep and QBs are gold).
- **6-pt pass TD scoring** baked into all QB projections.
- **Roster requirement tracking** — defaults to 2 QB / 3 RB / 3 WR / 1 TE / 2 DEF minimums (editable in ⚙ Settings). Recommendations boost needed positions and **hard-lock** onto them when you're running out of picks.
- **Team stacks** — players who stack with your QB (or a QB who stacks with your pass-catchers) get flagged 🔗 and boosted.
- **Live draft board** — one click to mark a player *taken* (eliminated) or *mine*. Undo anything (Ctrl+Z works). Full draft log.
- **Autosaves** every action to localStorage; Export/Import JSON to move between devices.
- **Editable projections** — click any projection number to override it. Add custom players too.

## Keyboard

- `/` — jump to search
- `Ctrl+Z` — undo last board action

## Deploy

Import this repo at [vercel.com/new](https://vercel.com/new) — no framework preset, no build command, output directory = root. Done.

## Data note

Player pool ships with 2026-season projection estimates (PPR-flavored, 6-pt pass TD). Projections are editable in-app — tune them to your favorite source before draft day.
