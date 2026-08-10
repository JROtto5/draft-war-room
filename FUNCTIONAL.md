# FUNCTIONAL.md — what every control actually does

## The rail (left, on /)
**Scorebug** live score + win% · **Tiles** record/place/odds/streak ·
**Plan/Sim/Wire/Scout** quick actions · **Deck** Scores · Trades · Season ·
Future · Ritual · Ego · Recap · Alerts · Report · Health · Analyst ·
**Starting Nine** tap row = player card, tap SLOT chip = slot editor,
⇄ = swap sheet (ranked bench, deltas, locks) · **Lineup Lab card**
⚡ Stage optimal / 🎲 Stage win-prob, per-swap ✕, Commit-in-Sleeper link ·
**Bench** drawer with gap-to-starter reasons · **Wire** heat cards.

## The dashboard (center)
Week bar (density ▤ · 🗂 pool · ✏️ draft room) · matchup hero (win dial,
both lineups, ⇄ on my side) · KPI tiles · standings (tap team → scout) ·
around the league · the chase · the wire.

## Keyboard
`g` plan · `m` sim · `y` future · `s` scores · `v` waivers · `d` trades ·
`x` season · `w` top · `Esc` closes anything · `Ctrl+K` everything.

## Your data
Settings → 📄: CSV import (name,ppg or season totals), ⇩ template,
📡 real Sleeper PPG, ↩ clear. Cards: ✏️ ppg · 📈/📉 · ＋ claim (FAs).
📌 marks any number you own. One pipeline: see DATA-FLOW.md.

## Proof it all works
lint: no inline handlers, no duplicate globals · E2E 55 checks including
the button crawler (every action click-verified), the truth matrix
(one number everywhere), and real staged-swap flows.
