# Competitor research → Draft War Room features

Researched Aug 2026: FantasyPros Draft Wizard, Sleeper, Underdog, RotoWire Draft
Assistant, PlayerProfiler, DraftSharks (sources in README/PR notes).

| Best practice (who does it) | Our implementation |
|---|---|
| Pick Predictor — % available at your next pick (Draft Wizard) | Dual-horizon Monte Carlo odds + 🔮 next-CPU-pick predictor |
| Custom rankings / my-guys & fade lists (Draft Wizard, ESPN) | ▲ boost / ▼ fade lists, manual ADP override, personal tier bumps |
| Wizard-driven snake workflow with live roster sync (Draft Wizard) | Pick-order slot math, ⏩ sim-to-my-pick, keepers, board grid |
| Player profile pages with bio, hometown, college, breakout age (PlayerProfiler) | Card v2: hometown from HS town/state, college w/ school colors, 3-season history, breakout/bust/prime tags, auto Story paragraph |
| Consensus + projections blend (RotoWire, FantasyPros) | League CSV projections + analyst targets + prop-market leans + trending |
| Roster rules connected to draft (Sleeper) | Superflex-aware engine, requirement locks, lineup autofill |
| Draft → lineup continuity (Underdog) | Season HQ + Sleeper-format roster export |
| Visual cues over data walls (fantasy UX guides) | Badges with tooltips, tier dividers, heat tints, hover mini-cards |
