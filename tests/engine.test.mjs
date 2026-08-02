// Direct import of the pure kernel — no DOM stubs needed (#310).
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../engine.js", import.meta.url), "utf8") +
  "\nthis.x={mulberry32,parsePicks,satAdjust,injSeverity,ordinal,fmt,isSubseq,nq};", ctx);
const x = ctx.x;
assert.strictEqual(x.mulberry32(7)(), x.mulberry32(7)());
assert.strictEqual(JSON.stringify(x.parsePicks("3.04", 12)), "[28]");
assert.strictEqual(x.satAdjust("QB", 0, 50).score, 50);
assert.ok(x.satAdjust("QB", 1, 50, {QB:1}).score < 25, "custom startable: QB2 discounted in 1QB");
assert.strictEqual(x.injSeverity("Out").code, "O");
assert.strictEqual(x.ordinal(2), "2nd");
assert.strictEqual(x.fmt(12345), "12,345");
assert.ok(x.isSubseq("jsn", "jaxonsmithnjigba"));
assert.strictEqual(x.nq("St. Brown"), "st brown");
console.log("engine.test OK — pure kernel imports clean");
