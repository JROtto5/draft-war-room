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
  location: { protocol: "file:", search: "", hash: "" }, window: {}, alert: () => {}, confirm: () => false,
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
vm.runInContext(readFileSync(new URL("../engine.js", import.meta.url), "utf8"), ctx);
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

// injury severity grading
const sev = g("injSeverity");
assert.strictEqual(sev("Questionable").mult, 0.97);
assert.strictEqual(sev("Doubtful").code, "D");
assert.strictEqual(sev("Out").mult, 0.85);
assert.strictEqual(sev("Injured Reserve").code, "IR");
assert.strictEqual(sev("Active"), null);
assert.strictEqual(sev(""), null);
// baked injuries reachable through the live layer
vm.runInContext("initInjuries()", ctx);
const hurt = players.filter(p => g("injuryOf")(p));
assert.ok(hurt.length >= 10, "expected baked injuries, got " + hurt.length);
const factor = g("injAdpFactor");
assert.ok(factor(hurt[0]) > 1, "injured player should slide in sim ADP");

// utilities
assert.strictEqual(JSON.stringify(g("parsePicks")("1.12, 2.01 37", 12)), "[12,13,37]");
const curve = g("pickValueCurve()");
for(let i=1;i<curve.length;i++) assert.ok(curve[i] <= curve[i-1]+1e-9, "value curve must be non-increasing at "+i);
const r1 = g("mulberry32(42)"), r2 = g("mulberry32(42)");
assert.strictEqual(r1(), r2(), "mulberry32 not deterministic");
// teamRosters slot math: picks 1 and 2 belong to slots 1 and 2 in round 1
vm.runInContext("S.log=[];S.taken={};S.mine=[];", ctx);
vm.runInContext("markTaken(allPlayers()[0].id); markTaken(allPlayers()[1].id);", ctx);
const ros = g("teamRosters()");
assert.strictEqual(ros[1].length, 1, "slot1 roster");
assert.strictEqual(ros[2].length, 1, "slot2 roster");
// migration: v1 save gains queue/keepers and v stamp
const mig = g("migrate")({mine:[], log:[], taken:{}});
assert.strictEqual(mig.v, g("STATE_V"));
assert.ok(Array.isArray(mig.queue) && typeof mig.keepers === "object");

// edge cases (#166)
assert.strictEqual(sat("WR", 4, 80).score, 80, "WR5 still startable");
assert.strictEqual(sat("WR", 5, 80).score, 80*0.3, "WR6 = depth discount");
assert.ok(sat("WR", 6, 80).score < -300, "WR7 buried");
assert.strictEqual(sat("RB", 5, 80).score, 80*0.3, "RB6 = depth discount");
const tmap = g("tierMapRaw(allPlayers())");
{ // tiers never decrease as projections fall within a position
  const qbs = players.filter(p=>p.pos==="QB").sort((a,b)=>b.proj-a.proj);
  for(let i=1;i<qbs.length;i++) assert.ok(tmap[qbs[i].id] >= tmap[qbs[i-1].id], "tier monotonic");
}
{ // a microscopic QB projection prices below the board
  vm.runInContext("S.custom.push(['Tiny Qb','BUF','QB',31,31,'ctiny'])", ctx);
  const ri2 = g("roundInfoRaw(allPlayers())");
  const tiny = g("allPlayers()").find(p=>p.name==="Tiny Qb");
  assert.ok(ri2[tiny.id].ud || ri2[tiny.id].rd >= 14, "tiny QB near/past the end");
  vm.runInContext("S.custom.pop()", ctx);
}
// fuzz (#169): invariants across random op sequences
vm.runInContext("S.log=[];S.taken={};S.mine=[];S.queue=[];redoStack.length=0;", ctx);
const rnd = g("mulberry32(2026)");
for(let i=0;i<500;i++){
  const roll = rnd();
  const pid = "p"+Math.floor(rnd()*300);
  if(roll<0.4) vm.runInContext(`if(!offBoard("${pid}")) markTaken("${pid}")`, ctx);
  else if(roll<0.7) vm.runInContext(`if(!offBoard("${pid}")) pickMine("${pid}")`, ctx);
  else if(roll<0.85) vm.runInContext("undoLast()", ctx);
  else if(roll<0.95) vm.runInContext("redoLast()", ctx);
  else vm.runInContext(`if(!offBoard("${pid}")) toggleQueue("${pid}")`, ctx);
}
{
  const logLen = g("S.log.length"), takenN = g("Object.keys(S.taken).length"), mineN = g("S.mine.length");
  assert.strictEqual(logLen, takenN + mineN, `fuzz: log ${logLen} != taken ${takenN} + mine ${mineN}`);
  assert.ok(!g("S.mine.some(id=>S.taken[id])"), "fuzz: player both mine and taken");
  vm.runInContext("pruneQueue()", ctx);
  assert.ok(!g("S.queue.some(id=>offBoard(id))"), "fuzz: queue holds off-board player");
}
// migration fixture (#175): realistic v1 save
const fixture = {taken:{p0:true}, mine:["p5"], log:[{id:"p0",who:"other"},{id:"p5",who:"me"}],
  settings:{teams:12, roster:16, slot:12, scoring:"ppr", ptd:6, min:{QB:2,RB:3,WR:3,TE:1,DEF:2,K:0}},
  notes:{}, custom:[], overrides:{}};
const up = g("migrate")(JSON.parse(JSON.stringify(fixture)));
assert.strictEqual(up.v, g("STATE_V"));
assert.ok(Array.isArray(up.queue) && up.keepers, "fixture upgraded");

// personalization layer (#201-#225)
const allen = players.find(p=>p.name==="Josh Allen");
const h3a = g("hist3For")(allen);
assert.strictEqual(h3a.length, 3, "Allen 3yr history");
const hw = g("hometownOf")(allen);
assert.ok(hw && hw.st==="CA", "Allen hometown state: "+JSON.stringify(hw));
const ci = g("collegeInfo")(allen);
assert.strictEqual(ci.name, "Wyoming");
const story = g("storyOf")(allen);
assert.ok(story.includes("Wyoming") && /410|385|375/.test(story), "story mentions college+arc: "+story);
vm.runInContext('S.settings.favState="CA"', ctx);
assert.ok(g("isFav")(allen), "CA favorite matches Allen");
vm.runInContext('S.settings.favState=""', ctx);
// keeper migration v3 (#235)
const up3 = g("migrate")({v:2, keepers:{p1:5}, mine:[], log:[], taken:{}});
assert.deepStrictEqual(JSON.parse(JSON.stringify(up3.keepers.p1)), {s:5, r:0});
// boost affects the engine (#228)
vm.runInContext("S.log=[];S.taken={};S.mine=[];S.queue=[];_memo={key:null};", ctx);
const before = g("scoreBoard().scored")[0];
vm.runInContext(`S.boost["${before.p.id}"]=-1;_memo={key:null};`, ctx);
const after = g("scoreBoard().scored").find(s=>s.p.id===before.p.id);
assert.ok(after.score < before.score, "fade lowers score");
vm.runInContext(`S.boost={};_memo={key:null};`, ctx);

// corrupt-input hardening (#385)
assert.strictEqual(g("migrate")(null).v, g("STATE_V"));
assert.strictEqual(g("migrate")("garbage").v, g("STATE_V"));
assert.strictEqual(g("migrate")([1,2,3]).v, g("STATE_V"));
// settings sweep: every combo yields a legal mock (#380)
for(const scoring of ["ppr","half"]) for(const risk of ["balanced","ceiling","floor"]) for(const ptd of [6,4]){
  vm.runInContext(`S.settings.scoring="${scoring}";S.settings.risk="${risk}";S.settings.ptd=${ptd};S.log=[];S.taken={};S.mine=[];_memo={key:null};`, ctx);
  const mk = g('runMock(STRATS[0], 999)');
  assert.strictEqual(mk.mineIds.length, 16, `sweep ${scoring}/${risk}/${ptd}`);
}
vm.runInContext('S.settings.scoring="ppr";S.settings.risk="balanced";S.settings.ptd=6;_memo={key:null};', ctx);
// fuzz 2: keeper/queue/plan churn (#379)
const rnd2 = g("mulberry32(777)");
for(let i=0;i<200;i++){
  const pid = "p"+Math.floor(rnd2()*200);
  const roll = rnd2();
  if(roll<0.3) vm.runInContext(`S.keepers["${pid}"]={s:${1+Math.floor(rnd2()*12)}, r:${Math.floor(rnd2()*16)}}`, ctx);
  else if(roll<0.5) vm.runInContext(`delete S.keepers["${pid}"]`, ctx);
  else if(roll<0.7) vm.runInContext(`S.plan[${1+Math.floor(rnd2()*16)}]="${pid}"`, ctx);
  else vm.runInContext(`if(!offBoard("${pid}")) toggleQueue("${pid}")`, ctx);
}
assert.ok(g("Object.values(S.keepers).every(k=>k && typeof k.s==='number')"), "keeper shapes survive churn");
assert.ok(g("teamRosters()") && g("myIds()").length >= 0, "roster math survives churn");
const remig = g("migrate")(JSON.parse(JSON.stringify(g("S"))));
assert.strictEqual(remig.v, g("STATE_V"), "re-migration idempotent");
vm.runInContext("S.keepers={};S.plan={};S.queue=[];_memo={key:null};", ctx);

// byes/SOS/sync mapping (#404-415)
vm.runInContext("this.d2={BYES,SCHED};", ctx);
assert.strictEqual(Object.keys(ctx.d2.BYES).length, 32, "32 byes");
assert.ok(Object.values(ctx.d2.BYES).every(w=>w>=4 && w<=14), "bye weeks sane");
assert.ok(Object.values(ctx.d2.SCHED).every(s=>Object.keys(s).length>=15), "schedules complete");
const b1 = g('byeOf("KCC")');
assert.ok(b1>=4 && b1<=14, "KCC bye");
const sos1 = g('sosOf("KCC")');
assert.ok(sos1>=1 && sos1<=32, "SOS rank in range");
const smap = g("sleeperToOurs()");
assert.ok(Object.keys(smap).length > 350, "sleeper map coverage: "+Object.keys(smap).length);
assert.ok(g('sleeperToOurs()["KC"]'), "DEF mapping via team code");

console.log("logic.test OK — engine, snake, saturation, mocks, odds, rounds, injuries, utils, fuzz, story, sweep, sync");
