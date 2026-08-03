// Benchmark: the War Room engine vs a pure-ADP drafter, head to head.
// Both draft Otto's slot in fresh sim rooms; we compare starter points.
//   node scripts/benchmark.mjs [sims]      (default 100; CI smoke uses 20)
//   node scripts/benchmark.mjs 100 --write   also regenerates BENCHMARK.md
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

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
  Date, fetch: () => Promise.reject(new Error("no network in benchmark")),
  Blob: anyProxy(), URL: anyProxy(), FileReader: anyProxy(),
};
ctx.window = ctx;
ctx.addEventListener = () => {};
ctx.removeEventListener = () => {};
vm.createContext(ctx);
for (const mod of ["data.js", "engine.js", "core.js", "views.js", "wire.js", "boot.js"])
  vm.runInContext(readFileSync(new URL("../" + mod, import.meta.url), "utf8"), ctx);
const g = (code) => vm.runInContext(code, ctx);

const SIMS = Math.max(2, parseInt(process.argv[2], 10) || 100);
const WRITE = process.argv.includes("--write");

// The ADP drafter: always takes the best-available ADP that is still legal
// (respects roster minimums so it can't strand itself, no early DEF) —
// a fair proxy for "just follow the board".
vm.runInContext(`
function benchAdpMock(seed){
  const rng = mulberry32(seed);
  const players = allPlayers();
  const rinfo = roundInfo(players);
  const t=S.settings.teams, R=S.settings.roster, total=t*R, mySlot=Math.min(S.settings.slot,t);
  const min = S.settings.min;
  const taken = new Set();
  const cpu = seedCpuTeams(rng);
  const mineIds = [];
  const counts = {QB:0,RB:0,WR:0,TE:0,DEF:0};
  let mockLast=null, mockRun=0;
  for(let pick=1; pick<=total; pick++){
    const r = Math.ceil(pick/t), idx = pick-(r-1)*t;
    const slot = (r%2===1) ? idx : t+1-idx;
    const avail = players.filter(p=>!taken.has(p.id));
    if(!avail.length) break;
    let chosen;
    if(slot===mySlot){
      const left = R - mineIds.length;
      let needed=0; for(const pos of POSITIONS) needed+=Math.max(0,(min[pos]||0)-counts[pos]);
      const mustFill = needed>=left && left>0;
      const legal = avail.filter(p=>{
        const need=(min[p.pos]||0)-counts[p.pos];
        if(mustFill && need<=0) return false;
        if(p.pos==="DEF" && r<12 && !mustFill) return false;
        return true;
      });
      const pool = legal.length ? legal : avail;
      chosen = pool.reduce((a,b)=> (a.adp||999) <= (b.adp||999) ? a : b);
      counts[chosen.pos]++; mineIds.push(chosen.id);
    } else {
      const st = cpu[slot];
      if(mockLast){ /* run tracking mirrors runMock */ }
      chosen = cpuPick(avail, st, r, rng, rinfo, R, mockRun>=2?mockLast:null, pick);
      st[chosen.pos]++;
      if(chosen.pos==="QB" && !st.qbTeam) st.qbTeam = chosen.team;
      if(chosen.pos==="RB" && !st.rbTeam) st.rbTeam = chosen.team;
      if(chosen.pos===mockLast){ mockRun++; } else { mockRun=1; mockLast=chosen.pos; }
    }
    taken.add(chosen.id);
  }
  const byId = {}; players.forEach(p=>byId[p.id]=p);
  return bestLineupPts(mineIds, byId);
}
function bestLineupPts(ids, byId){
  const ps = ids.map(id=>byId[id]).filter(Boolean).sort((a,b)=>b.proj-a.proj);
  const used = new Set(); let pts = 0;
  const grab = (want) => {
    for(const p of ps){ if(used.has(p.id)) continue; if(want(p)){ used.add(p.id); pts += p.proj||0; return; } }
  };
  const sl = S.settings.slots;
  for(let i=0;i<(sl.QB||0);i++) grab(p=>p.pos==="QB");
  for(let i=0;i<(sl.RB||0);i++) grab(p=>p.pos==="RB");
  for(let i=0;i<(sl.WR||0);i++) grab(p=>p.pos==="WR");
  for(let i=0;i<(sl.TE||0);i++) grab(p=>p.pos==="TE");
  for(let i=0;i<(sl.FLEX||0);i++) grab(p=>p.pos==="RB"||p.pos==="WR"||p.pos==="TE");
  for(let i=0;i<(sl.SFLX||0);i++) grab(p=>p.pos!=="DEF");
  for(let i=0;i<(sl.DEF||0);i++) grab(p=>p.pos==="DEF");
  return Math.round(pts);
}
`, ctx);

console.log(`⚔️  Benchmark: engine vs pure-ADP drafter — ${SIMS} sims each, slot ${g("S.settings.slot")} of ${g("S.settings.teams")}\n`);

const engine = [], adp = [];
for (let i = 0; i < SIMS; i++) {
  const seed = 1000003 * (i + 1) + 17;
  const m = g(`(()=>{const m=runMock(STRATS[0], ${seed}); return {pts:m.startPts};})()`);
  engine.push(m.pts);
  adp.push(g(`benchAdpMock(${seed})`));
  if ((i + 1) % 25 === 0) console.log(`  …${i + 1}/${SIMS}`);
}

const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sorted = (a) => [...a].sort((x, y) => x - y);
const pct = (a, q) => sorted(a)[Math.min(a.length - 1, Math.floor(q * a.length))];
const wins = engine.filter((e, i) => e > adp[i]).length;
const eAvg = avg(engine), aAvg = avg(adp);
const edge = eAvg - aAvg;

const lines = [
  `engine  avg ${eAvg.toFixed(1)} pts   p10 ${pct(engine, 0.1)}   p90 ${pct(engine, 0.9)}`,
  `ADP-bot avg ${aAvg.toFixed(1)} pts   p10 ${pct(adp, 0.1)}   p90 ${pct(adp, 0.9)}`,
  `edge    +${edge.toFixed(1)} pts/season starters   head-to-head ${wins}/${SIMS} (${Math.round(100 * wins / SIMS)}%)`,
];
console.log("\n" + lines.join("\n"));

if (WRITE) {
  const md = `# Benchmark — engine vs pure-ADP drafter

Both drafters take Otto's slot in identical sim rooms (same seeds, same CPU
opponents from \`seedCpuTeams\`) and we compare projected **starter points**.
The ADP bot always takes the best remaining ADP that keeps its roster legal;
the engine runs its full Balanced strategy (VORP, needs, stacks, saturation,
late-round upside).

Regenerate: \`node scripts/benchmark.mjs 100 --write\`

## Latest run (${SIMS} sims)

\`\`\`
${lines.join("\n")}
\`\`\`

A CI smoke (20 sims) asserts the engine's average never falls below the ADP
bot's — if a scoring change regresses the engine below "just follow the
board", the build fails.
`;
  writeFileSync(new URL("../BENCHMARK.md", import.meta.url), md);
  console.log("\n📄 BENCHMARK.md updated");
}

if (eAvg < aAvg) {
  console.error("\n❌ SMOKE FAIL: engine average fell below the pure-ADP drafter");
  process.exit(1);
}
console.log("\n✅ engine ≥ ADP bot");
