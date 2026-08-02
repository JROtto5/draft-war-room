// Data sanity: catches regeneration mistakes (duplicate blocks, bad rows).
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const src = readFileSync(new URL("../data.js", import.meta.url), "utf8");

// no duplicated top-level blocks (the bug class that broke a build once)
for (const name of ["const RAW", "const INTEL", "const PSOS", "function normName", "const DATA_STAMP"]) {
  const n = src.split(name).length - 1;
  assert.strictEqual(n, 1, `${name} appears ${n} times, expected 1`);
}

const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + "\nthis.RAW=RAW;this.INTEL=INTEL;this.PSOS=PSOS;this.normName=normName;this.DATA_STAMP=DATA_STAMP;", ctx);

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

console.log(`data.test OK — ${ctx.RAW.length} players, ${Object.keys(ctx.INTEL).length} intel, ${Object.keys(ctx.PSOS).length} teams`);
