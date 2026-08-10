# DESIGN.md — the visual system (v13)

## Tokens
`--elev0/1/2` surface levels · `--r-sm/md/lg` radii (7/10/14) · `--sp-1..4` spacing rhythm ·
`--grad` the signature night-field gradient (scorebug, overlay mastheads) ·
`--track-lb` (.14em) for uppercase micro-labels. All colors flow from the base palette
tokens (`--bg --panel --line --text --dim --green --gold --red` + position colors); no
component declares a hex.

## Type
Five sizes: 34 (hero scores) · 26 (h2) · 14.5 (row names) · 12.5 (body) · 10 (sublines,
floor on mobile). Numerals are always mono + `tabular-nums`. Uppercase labels always
carry the standard tracking.

## Components
`.sscard` (gradient `.sshead` header) · `.ssrow` (headshot row: avatar, slot chip,
name+subline, mono value) · `.sstile` (stat tile with up/down semantics) · `.ssbbug`
(scorebug) · `.spdial` (win dial) · `.hbtn` variants primary/act/quiet/danger ·
`.scpill` variants good/warn/stat · `.snov` (overlay → bottom sheet under 640px).

## Charts (win.js chart kit)
`chartArea` (grid, reference line, endpoint dot + label) · `chartBars` (paired, semantic
color vs comparator) · `chartRace` (field grey, me gold, rival red) · `chartDist`
(smoothed sim curves, p10/p90 markers). Heights fixed: strip 20 / card 64 / feature 120.
Under 3 data points every chart renders its designed empty state. Every SVG carries a
sentence-long `aria-label` with the actual numbers.

## Motion
First-paint card cascade (60ms stagger, once) · overlay scale-in + row cascade (cap 12) ·
spring presses · dial sweep · score flash by direction + count-up · tile pulse on change.
Transforms/opacity only. Two escape hatches: `prefers-reduced-motion` and the 🧊 calm
mode setting (kills all decorative motion unconditionally).

## Mobile
5-tab bar + More sheet under 640px · overlays are bottom sheets · 44px targets · sticky
compact scorebug · landscape left rail · standalone-mode notch padding · pull-to-refresh.
