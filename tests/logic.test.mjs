// Logic tests: run app.js in a VM with a permissive DOM stub, then exercise
// the pure engine functions (search, snake math, saturation, mocks, odds).
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

function anyProxy() {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => "";
      if (k === "length") return 0;
      if (k === Symbol.iterator) return function* () {};
      return anyProxy();
    },
    set() { return true; },
    apply() { return anyProxy(); },
    construct() { return anyProxy(); },
    has() { return true; },
  });
}

const ctx = {
  console, JSON, Math, Array, Object, String, Number, parseFloat, parseInt,
  isNaN, setTimeout: () => 0, clearTimeout: () => {},
  document: anyProxy(), localStorage: anyProxy(), navigator: anyProxy(),
  location: { protocol: "file:" }, window: {}, alert: () => {}, confirm: () => false,
  prompt: () => null, requestAnimationFrame: () => 0, MutationObserver: anyProxy(),
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  Date, fetch: () => Promise.reject(new Error("no network in tests")),
  Blob: anyProxy(), URL: anyProxy(), FileReader: anyProxy(),
};
ctx.window = ctx;
ctx.addEventListener = () => {};
ctx.removeEventListener = () => {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../data.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../app.js", import.meta.url), "utf8"), ctx);
const g = name => vm.runInContext(name, ctx);

// fuzzy search
const players = g("allPlayers()");
assert.ok(players.length > 300);
const hit = (q, name) => players.filter(p => g("matchesQuery")(p, q)).some(p => p.name === name);
assert.ok(hit("cmc", "Christian McCaffrey"), "cmc");
assert.ok(hit("jsn", "Jaxon Smith-Njigba"), "jsn");
assert.ok(hit("st brown", "Amon-Ra St. Brown"), "st brown");

// snake math for slot 12 of 12
const picks = g("myOverallPicks()");
assert.strictEqual(JSON.stringify(picks.slice(0, 4)), "[12,13,36,37]");

// saturation: 3rd QB discounted, 4th buried
const sat = g("satAdjust");
assert.strictEqual(sat("QB", 1, 100).score, 100);
assert.ok(sat("QB", 2, 100).score < 50 && sat("QB", 2, 100).score > 30, "QB3 insurance");
assert.ok(sat("QB", 3, 100).score < -300, "QB4 buried");
assert.ok(sat("DEF", 1, 50).score < -300, "DEF2 buried");

// full mock produces a legal 16-man roster
const mock = g('runMock(STRATS[0], 12345)');
assert.strictEqual(mock.mineIds.length, 16);
const counts = { QB: 0, RB: 0, WR: 0, TE: 0, DEF: 0 };
mock.mineIds.forEach(id => { const p = mock.byId[id]; if (p) counts[p.pos]++; });
assert.ok(counts.QB >= 2 && counts.RB >= 3 && counts.WR >= 3 && counts.TE >= 1 && counts.DEF >= 1,
  "roster minimums: " + JSON.stringify(counts));
assert.strictEqual(new Set(mock.mineIds).size, 16, "duplicate picks");

// dual-horizon survival odds
const odds = g("survivalOddsRaw()");
assert.strictEqual(odds.at1, 12);
assert.strictEqual(odds.at2, 13);
const gibbs = players.find(p => p.name === "Jahmyr Gibbs");
assert.strictEqual(odds.h1[gibbs.id], 0, "Gibbs should never reach pick 12");
assert.ok(Object.values(odds.posGone).reduce((a, b) => a + b, 0) > 8, "pos pace sums to ~11 picks");

// round estimates: listed player from ADP, unlisted priced within position
const ri = g("roundInfoRaw(allPlayers())");
const law = players.find(p => p.name === "Trevor Lawrence");
assert.strictEqual(ri[law.id].label, "R8–9");

console.log("logic.test OK — engine, snake, saturation, mocks, odds, rounds");
