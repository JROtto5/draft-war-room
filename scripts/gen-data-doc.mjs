// Regenerates DATA.md from the shipped dataset.
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync("data.js","utf8") + "\nthis.d={RAW,INTEL,PSOS,HEADSHOT,PLAYERMETA,LASTSZN,LAST3,PROJ26,TEAMQB,INJBASE,COLLEGE,TEAMLOGO,DATA_STAMP,LAST_SEASON};", ctx);
const d = ctx.d;
const md = `# Shipped dataset (generated — do not edit; \`node scripts/gen-data-doc.mjs\`)

Stamped **${d.DATA_STAMP}**, last completed season **${d.LAST_SEASON}**.

| const | entries | shape |
|---|---|---|
| RAW | ${d.RAW.length} | [name, team, pos, ppr6, half6, adp, passTD] |
| PLAYERMETA | ${Object.keys(d.PLAYERMETA).length} | [age, expYears, college, height, weight, jersey, injStatus, depthOrder, depthPos, injBodyPart, injNotes, highSchool, rookieYear, birthDate] |
| LAST3 | ${Object.keys(d.LAST3).length} | per season: [year, games, ptsPPR, posFinish, targets, passYds, rushYds] |
| LASTSZN | ${Object.keys(d.LASTSZN).length} | [gp, passYd, passTD, int, rushYd, rushTD, tgt, rec, recYd, recTD, ptsPPR, posRank] |
| PROJ26 | ${Object.keys(d.PROJ26).length} | [games, passYds, passTD, int, rushYds, rushTD, tgt, rec, recYds, recTD] |
| INTEL | ${Object.keys(d.INTEL).length} | {t: analyst note, lean: ±1, p: prop summary} |
| INJBASE | ${Object.keys(d.INJBASE).length} | [status, report, date] (baked ESPN snapshot) |
| PSOS | ${Object.keys(d.PSOS).length} | playoff W15–17 opponents + matchup ranks |
| TEAMQB | ${Object.keys(d.TEAMQB).length} | team → starting QB |
| HEADSHOT | ${Object.keys(d.HEADSHOT).length} | normName → Sleeper photo id |
| COLLEGE | ${Object.keys(d.COLLEGE).length} | program → [conference, color] |

All keys are \`normName(name)\` — lowercase, punctuation stripped, suffixes dropped.
`;
writeFileSync("DATA.md", md);
console.log("DATA.md written");
