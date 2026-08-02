// Data sanity: catches regeneration mistakes (duplicate blocks, bad rows).
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const src = readFileSync(new URL("../data.js", import.meta.url), "utf8");

// no duplicated top-level blocks (the bug class that broke a build once)
for (const name of ["const RAW", "const INTEL", "const PSOS", "function normName", "const DATA_STAMP", "const HEADSHOT", "const TEAMLOGO", "const PLAYERMETA", "const LASTSZN", "const PROJ26", "const TEAMQB", "const INJBASE"]) {
  const n = src.split(name).length - 1;
  assert.strictEqual(n, 1, `${name} appears ${n} times, expected 1`);
}

const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + "\nthis.RAW=RAW;this.INTEL=INTEL;this.PSOS=PSOS;this.normName=normName;this.DATA_STAMP=DATA_STAMP;this.HEADSHOT=HEADSHOT;this.TEAMLOGO=TEAMLOGO;this.PLAYERMETA=PLAYERMETA;this.LASTSZN=LASTSZN;this.PROJ26=PROJ26;this.TEAMQB=TEAMQB;this.INJBASE=INJBASE;", ctx);

assert.ok(ctx.RAW.length > 300, "RAW too small: " + ctx.RAW.length);
const POS = new Set(["QB", "RB", "WR", "TE", "DEF"]);
for (const r of ctx.RAW) {
  assert.strictEqual(r.length, 7, "row shape: " + JSON.stringify(r));
  assert.ok(typeof r[0] === "string" && r[0].length > 1, "name: " + r[0]);
  assert.ok(POS.has(r[2]), "pos: " + JSON.stringify(r));
  assert.ok(typeof r[3] === "number" && r[3] > 0, "ppr: " + JSON.stringify(r));
  assert.ok(typeof r[4] === "number" && r[4] > 0, "half: " + JSON.stringify(r));
  assert.ok(typeof r[5] === "number" && r[5] >= 0, "adp: " + JSON.stringify(r));
  assert.ok(typeof r[6] === "number" && r[6] >= 0, "patd: " + JSON.stringify(r));
}
// QBs carry pass TDs; non-QBs shouldn't
assert.ok(ctx.RAW.filter(r => r[2] === "QB" && r[6] > 5).length > 20, "QB patd column looks wrong");
assert.ok(ctx.RAW.every(r => r[2] === "QB" || r[6] < 5), "non-QB with big patd");

// intel keys must be normalized names
for (const k of Object.keys(ctx.INTEL)) {
  assert.strictEqual(k, ctx.normName(k), "INTEL key not normalized: " + k);
}
assert.ok(Object.keys(ctx.PSOS).length >= 30, "PSOS teams: " + Object.keys(ctx.PSOS).length);
for (const [t, s] of Object.entries(ctx.PSOS)) {
  assert.strictEqual(s.o.length, 3, t);
  assert.strictEqual(s.r.length, 3, t);
}
assert.match(ctx.DATA_STAMP, /^\d{4}-\d{2}-\d{2}$/);
// headshots: most non-DEF players should have one; logos: all 32 team codes
const nonDef = ctx.RAW.filter(r => r[2] !== "DEF");
const withHead = nonDef.filter(r => ctx.HEADSHOT[ctx.normName(r[0])]);
assert.ok(withHead.length / nonDef.length > 0.9, `headshot coverage ${withHead.length}/${nonDef.length}`);
for (const r of ctx.RAW) assert.ok(ctx.TEAMLOGO[r[1]], "no logo slug for team " + r[1]);
// enrichment coverage
assert.ok(Object.keys(ctx.PLAYERMETA).length > 300, "bios");
assert.ok(Object.keys(ctx.LASTSZN).length > 250, "last-season lines");
assert.ok(Object.keys(ctx.PROJ26).length > 300, "projection lines");
assert.ok(Object.keys(ctx.TEAMQB).length >= 30, "team QBs");
assert.strictEqual(ctx.LASTSZN["josh allen"][11], 1, "Allen should be QB1 in 2025");
for (const [k, v] of Object.entries(ctx.LASTSZN)) assert.strictEqual(v.length, 12, "LAST25 shape " + k);
for (const [k, v] of Object.entries(ctx.PROJ26)) assert.strictEqual(v.length, 10, "PROJ26 shape " + k);
for (const [k, v] of Object.entries(ctx.PLAYERMETA)) assert.strictEqual(v.length, 11, "PLAYERMETA shape " + k);
for (const [k, v] of Object.entries(ctx.INJBASE)) {
  assert.strictEqual(v.length, 3, "INJBASE shape " + k);
  assert.ok(typeof v[0] === "string" && v[0].length > 1, "INJBASE status " + k);
}

console.log(`data.test OK — ${ctx.RAW.length} players, ${Object.keys(ctx.INTEL).length} intel, ${Object.keys(ctx.PSOS).length} teams`);
