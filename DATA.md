# Shipped dataset (generated — do not edit; `node scripts/gen-data-doc.mjs`)

Stamped **2026-08-03**, last completed season **2025**.

| const | entries | shape |
|---|---|---|
| RAW | 390 | [name, team, pos, ppr6, half6, adp, passTD] |
| PLAYERMETA | 355 | [age, expYears, college, height, weight, jersey, injStatus, depthOrder, depthPos, injBodyPart, injNotes, highSchool, rookieYear, birthDate] |
| LAST3 | 304 | per season: [year, games, ptsPPR, posFinish, targets, passYds, rushYds] |
| LASTSZN | 298 | [gp, passYd, passTD, int, rushYd, rushTD, tgt, rec, recYd, recTD, ptsPPR, posRank] |
| PROJ26 | 390 | [games, passYds, passTD, int, rushYds, rushTD, tgt, rec, recYds, recTD] |
| INTEL | 75 | {t: analyst note, lean: ±1, p: prop summary} |
| INJBASE | 23 | [status, report, date] (baked ESPN snapshot) |
| PSOS | 32 | playoff W15–17 opponents + matchup ranks |
| TEAMQB | 32 | team → starting QB |
| HEADSHOT | 355 | normName → Sleeper photo id |
| PHYS / SNAPTREND / TSHARE | — | [heightPct, weightPct] · [snap%23,24,25] · projected target share % |
| STADIUM | 2 lists | dome teams · cold-region outdoor teams (playoff weather) |
| COLLEGE | 63 | program → [conference, color] |

All keys are `normName(name)` — lowercase, punctuation stripped, suffixes dropped.
