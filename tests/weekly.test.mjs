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

const storage = new Map();
const ctx = {
  console, JSON, Math, Array, Object, String, Number, parseFloat, parseInt,
  isNaN, setTimeout: () => 0, clearTimeout: () => {},
  document: anyProxy(), localStorage: {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)}, navigator: anyProxy(),
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
for(const mod of ["core.js","season.js","win.js","simx.js","ultra.js","views.js","wire.js","boot.js"])
  vm.runInContext(readFileSync(new URL("../"+mod, import.meta.url), "utf8"), ctx);
const g = name => vm.runInContext(name, ctx);

// Exact league stat weights: passing TDs, interceptions, receiving, and defense.
assert.equal(g('scoreWeeklyStats')({pts_ppr:15,pass_yd:250,pass_td:2,pass_int:1},{pass_yd:.04,pass_td:6,pass_int:-1}),21);
assert.equal(g('scoreWeeklyStats')({pts_ppr:10,rec:5,rec_yd:50},{rec:.5,rec_yd:.1}),7.5);
assert.equal(g('scoreWeeklyStats')({pts_ppr:5,sack:3,ff:1,int:1,pts_allow_14_20:1},{sack:1,ff:1,int:2,pts_allow_14_20:1}),7);
assert.equal(g('scoreWeeklyStats')({adp:30},{pass_td:6}),null);

// The live lineup follows Sleeper's slot order, preserves locked slots, and never uses a locked bench player.
g(`S=defaultState(); S.settings.sleeperLeagueId='test'; S.settings.sleeperRosterId=12;
WAIV.league={league_id:'test',season:'2026',roster_positions:['SUPER_FLEX','QB','RB','WR','FLEX','BN'],scoring_settings:{pass_td:6}};
WEEKST.week=1; INJ={map:{},at:Date.now()}; NFLSTATE.map={};
window.testPlayers={q1:{id:'q1',name:'Quarter One',team:'Q1',pos:'QB',proj:320},q2:{id:'q2',name:'Quarter Two',team:'Q2',pos:'QB',proj:304},
 r1:{id:'r1',name:'Runner One',team:'R1',pos:'RB',proj:240},r2:{id:'r2',name:'Runner Two',team:'R2',pos:'RB',proj:224},
 w1:{id:'w1',name:'Receiver One',team:'W1',pos:'WR',proj:256},w2:{id:'w2',name:'Receiver Two',team:'W2',pos:'WR',proj:208}};
window.testSide={starters:['q1','q2','r1','w1','r2']};`);
const solve=()=>g('recommendedWeekLineup(testSide,Object.keys(testPlayers),testPlayers,1)');
let bs=solve();
assert.equal(bs.line.length,5);
assert.equal(bs.starterIds.size,5);
assert.equal(bs.pts,84);
assert.equal(bs.line[0].lab,'SFLX');
assert.equal(bs.line[1].p.pos,'QB');
// Put a low-scoring starter in a flexible slot and lock it after kickoff.
g(`testSide.starters=['r2','q1','r1','w1','w2']; NFLSTATE.map.R2={state:'pre',kickoff:'2000-01-01T00:00:00Z'};`);
bs=solve();
assert.equal(bs.line[0].p.id,'r2','locked flex must stay in its exact slot');
assert.ok(!bs.starterIds.has('q2'),'cannot slide a locked flex player to RB to admit another QB');
g(`NFLSTATE.map.Q2={state:'post'}; testSide.starters=['q1','q2','r1','w1','r2'];`);
assert.equal(solve().line[1].p.id,'q2','final player stays locked even with no points');
g(`testSide.starters=['q1',null,'r1','w1','r2'];`);
assert.ok(!solve().starterIds.has('q2'),'cannot promote a locked bench QB');
assert.equal(solve().line[1].p.id,'q1','can legally move an unlocked QB out of superflex');
g(`NFLSTATE.map={}; WAIV.league.roster_positions=['QB','IDP_FLEX'];`);
assert.equal(solve(),null,'unsupported league positions fail visibly');

// Never display a previous week's cached matchup.
g(`WEEKST.mate={w:2,league:'test',me:testSide}; WEEKST.week=1;`);
assert.equal(g('currentWeekMate()'),null);
g(`WEEKST.mate={w:1,league:'another-league',me:testSide};`);
assert.equal(g('currentWeekMate()'),null);

// No matchup_id means an unassigned opponent, not a pairing with another unassigned team.
ctx.fetch=async url=>({ok:true,json:async()=>url.includes('/matchups/') ? [{roster_id:12,matchup_id:null,starters:[],players:[]},{roster_id:6,matchup_id:null,starters:[],players:[]}] : []});
const md=await g('myWeekData(true)');
assert.equal(md.opp,null);

// Empty live roster is authoritative and must not resurrect drafted players.
g(`S.mine=['old-draft'];SEASON_LIVE.league='test';SEASON_LIVE.ids=[];`);
assert.equal(g('rosterIds().length'),0);

// Projection caches cannot leak across leagues, years, or scoring configurations.
g(`WAIV.league={league_id:'test',season:'2026',roster_positions:['QB'],scoring_settings:{pass_td:6}};WAIV.leagueAt=Date.now();
PROJX.future[1]={map:{q1:99},at:Date.now(),context:'old-league'};`);
ctx.fetch=async()=>{throw new Error('offline');};
assert.equal(await g('fetchWeekProjections(1,true)'),null);
assert.equal(g('sleeperWk(testPlayers.q1,1)'),null);

// Live API calls bypass the service worker's image cache, including offline failures.
const handlers={};let cached=0,requests=0,reply;
const swctx={self:{addEventListener:(name,fn)=>handlers[name]=fn},location:{origin:'https://app.test'},URL,Response,
 caches:{match:async()=>{cached++;return new Response('stale');}},
 fetch:async(req,opts)=>{requests++;assert.equal(opts.cache,'no-store');return new Response('fresh');}};
vm.createContext(swctx);vm.runInContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),swctx);
handlers.fetch({request:{method:'GET',url:'https://api.sleeper.app/v1/league/test',destination:''},respondWith:p=>reply=p});
assert.equal(await (await reply).text(),'fresh');assert.equal(cached,0);assert.equal(requests,1);
swctx.fetch=async()=>{throw new Error('offline');};
handlers.fetch({request:{method:'GET',url:'https://api.sleeper.app/v1/league/test',destination:''},respondWith:p=>reply=p});
assert.equal((await reply).status,503);assert.equal(cached,0);
handlers.fetch({request:{method:'GET',url:'https://app.test/feeds/nfl/injuries',destination:''},respondWith:p=>reply=p});
assert.equal((await reply).status,503);assert.equal(cached,0,'same-origin feeds also bypass cached HTML and JSON');
console.log('weekly lineup, scoring, freshness, and kickoff-lock tests passed');
