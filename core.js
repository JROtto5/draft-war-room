"use strict";
/* Draft War Room · core: state, engine bindings, sims, injuries, analytics helpers.
   Loads after data.js + engine.js; exposes globals consumed by views/wire/boot. */
"use strict";

const POSITIONS = ["QB","RB","WR","TE","DEF"];
const LS_KEY = "draft-war-room-v2";

/* ---------- State ---------- */
const STATE_V = 4;
const MIGRATIONS = {
  // 1 -> 2: keepers/queue introduced (defaults suffice); stamp only
  1: s => { s.keepers = s.keepers||{}; s.queue = s.queue||[]; return s; },
  // 3 -> 4: configurable roster slots + auction prices
  3: s => {
    s.settings = s.settings || {};
    s.settings.slots = s.settings.slots || {QB:1,RB:2,WR:2,TE:1,FLEX:1,SF:1,DEF:1,K:0,BN:7};
    s.prices = s.prices || {};
    return s;
  },
  // 2 -> 3: keepers gain a round cost — old shape was id -> slot number
  2: s => {
    const k = {};
    for(const id in (s.keepers||{})){
      const v = s.keepers[id];
      k[id] = typeof v === "object" ? v : {s:+v, r:0};
    }
    s.keepers = k;
    s.boost = s.boost||{}; s.adpOverride = s.adpOverride||{}; s.tierBump = s.tierBump||{};
    return s;
  },
};
function migrate(p){
  if(!p || typeof p !== "object" || Array.isArray(p)) p = {};
  let v = p.v || 1;
  while(v < STATE_V){
    if(MIGRATIONS[v]) p = MIGRATIONS[v](p);
    v++;
  }
  p.v = STATE_V;
  return p;
}
const defaultState = () => ({
  v: STATE_V,
  taken: {},            // id -> true (drafted by someone else)
  pickOffset: 0,        // manual correction: real overall pick - marked picks
  pickOwner: {},        // overall pick -> slot (traded picks)
  keepers: {},          // id -> slot number (kept pre-draft, consumes no pick)
  queue: [],            // ids, user watch/queue order
  boost: {},            // id -> +1 (my guy) / -1 (fade)
  adpOverride: {},      // id -> manual ADP
  tierBump: {},         // id -> +/- tier levels
  plan: {},             // round -> player id (my target board)
  queueRounds: {},      // id -> "want him by round N"
  notes: {},            // id -> personal note
  dnd: {},              // id -> true (do-not-draft)
  mine: [],             // ids in pick order
  log: [],              // {id, who:'me'|'other'}
  custom: [],           // [name,team,pos,proj,id]
  overrides: {},        // id -> proj
  settings: { teams:12, roster:16, slot:12, scoring:"ppr", ptd:6, min:{QB:2,RB:3,WR:3,TE:1,DEF:1},
              slots:{QB:1,RB:2,WR:2,TE:1,FLEX:1,SF:1,DEF:1,K:0,BN:7}, budget:200 },
  prices: {},           // id -> auction price paid (auction mode)
  slotNames: {"1":"adamslanding","2":"NoahSchindler","3":"schinbad91","4":"DNSchindler","5":"DiddyPartay","6":"SPIDEYxSENSEZ","7":"picklerick10","8":"Cards0407","9":"nbachman","10":"JSchindler5","11":"schindler","12":"Otto5"},
  ui: { pos:"ALL", showTaken:false, sort:"vorp", dir:-1, round:"ALL", targetsOnly:false, stacksOnly:false, survivors:false }
});
let S = defaultState();

/* ---------- Per-board-state memoization ----------
   Odds sims, tiers, rounds and replacement levels only change when the
   board does — cache them behind a state fingerprint. */
let _memo = {key:null};
function stateKey(){
  return S.log.length+"|"+S.mine.length+"|"+Object.keys(S.taken).length+"|"+S.custom.length+"|"+
         JSON.stringify(S.overrides)+"|"+JSON.stringify(S.boost||{})+"|"+JSON.stringify(S.adpOverride||{})+"|"+JSON.stringify(S.tierBump||{})+"|"+(S.pickOffset||0)+"|"+(S.dataRev||0)+"|"+INJ.at+"|"+JSON.stringify(S.settings);
}
function cached(name, fn){
  const k = stateKey();
  if(_memo.key!==k) _memo = {key:k};
  if(!(name in _memo)) _memo[name] = fn();
  return _memo[name];
}
function pickNow(){ return S.log.length + 1 + (S.pickOffset||0); }
function slotOfPick(n){
  if(S.pickOwner && S.pickOwner[n]) return +S.pickOwner[n];
  const t = S.settings.teams, r = Math.ceil(n/t), idx = n-(r-1)*t;
  return (r%2===1) ? idx : t+1-idx;
}
function slotName(s){ return (S.slotNames && S.slotNames[s]) || ("T"+s); }
function slotCfg(){ return (S.settings.slots) || {QB:1,RB:2,WR:2,TE:1,FLEX:1,SF:1,DEF:1,K:0,BN:7}; }
function startableNow(){
  const sl = slotCfg();
  return { QB: sl.QB + sl.SF, RB: sl.RB + sl.FLEX + 2, WR: sl.WR + sl.FLEX + 2,
           TE: sl.TE + 1, DEF: Math.max(1, sl.DEF), K: sl.K };
}
function starterCount(){ const sl = slotCfg(); return sl.QB+sl.RB+sl.WR+sl.TE+sl.FLEX+sl.SF+sl.DEF+sl.K; }
function myKeeperIds(){
  const mySlot = Math.min(S.settings.slot, S.settings.teams);
  return Object.keys(S.keepers||{}).filter(id=>+(S.keepers[id].s!=null?S.keepers[id].s:S.keepers[id])===mySlot);
}
function myIds(){ return S.mine.concat(myKeeperIds()); }
function offBoard(id){ return S.taken[id] || S.mine.includes(id) || (S.keepers && S.keepers[id]); }
/* who has whom: slot -> [player ids], reconstructed from pick order */
function teamRosters(){
  const byId = idIndex(), t = S.settings.teams, ros = {};
  for(let s=1;s<=t;s++) ros[s] = [];
  for(const id in (S.keepers||{})){ const s2=+(S.keepers[id].s!=null?S.keepers[id].s:S.keepers[id]); if(ros[s2] && byId[id]) ros[s2].push(id); }
  S.log.forEach((e,i)=>{
    const slot = slotOfPick(i+1+(S.pickOffset||0));
    const p = byId[e.id];
    if(p && ros[slot]) ros[slot].push(e.id);
  });
  return ros;
}

function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const p = migrate(JSON.parse(raw));
      S = Object.assign(defaultState(), p);
      S.settings = Object.assign(defaultState().settings, p.settings||{});
      S.settings.min = Object.assign(defaultState().settings.min, (p.settings||{}).min||{});
      S.ui = Object.assign(defaultState().ui, p.ui||{});
      S.slotNames = Object.assign(defaultState().slotNames, p.slotNames||{});
      S.keepers = p.keepers || {};
      S.queue = p.queue || [];
      S.boost = p.boost || {};
      S.adpOverride = p.adpOverride || {};
      S.tierBump = p.tierBump || {};
      S.plan = p.plan || {};
      S.queueRounds = p.queueRounds || {};
    }
  }catch(e){
    console.warn("load failed, trying backup", e);
    try{
      const b = JSON.parse(localStorage.getItem(LS_KEY+"-backup"));
      if(b && b.state){ S = Object.assign(defaultState(), b.state); window._recovered = b.when; }
    }catch(e2){ console.warn("backup also unreadable", e2); }
    // last resort: the IndexedDB mirror (async — applies on arrival)
    try{
      const req2 = indexedDB.open("war-room", 1);
      req2.onsuccess = ()=>{
        try{
          const g = req2.result.transaction("kv").objectStore("kv").get("state");
          g.onsuccess = ()=>{
            if(g.result && !S.log.length){
              S = Object.assign(defaultState(), migrate(JSON.parse(g.result)));
              _memo = {key:null}; render();
              toast("♻️ Restored from the IndexedDB mirror");
            }
          };
        }catch(e3){}
      };
    }catch(e3){}
  }
}
let saveTimer=null;
function save(){
  if(window._spectate){ return; }
  const payload = JSON.stringify(S);
  if(payload.length > 3500000 && !window._quotaWarned){
    window._quotaWarned = true;
    toast("⚠️ Board state is "+(payload.length/1048576).toFixed(1)+"MB — close to browser limits. Consider reverting imported data.", {warn:true});
  }
  idbMirror(payload);
  try{ localStorage.setItem(LS_KEY, payload); }
  catch(e){
    const b = document.getElementById("saveBadge");
    b.textContent = "⚠ SAVE FAILED"; b.style.color = "var(--red)";
    return;
  }
  const b = document.getElementById("saveBadge");
  b.textContent = "Saved ✓"; b.classList.add("flash");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{ b.textContent="Autosave on"; b.classList.remove("flash"); }, 1400);
}

/* ---------- Players ---------- */
function allPlayers(){
  const col = S.settings.scoring==="half" ? 4 : 3;
  const tdAdj = S.settings.ptd===4 ? 2 : 0;   // stored projections use 6pt pass TDs
  const recPts = S.settings.recPts;           // null = follow the full/half select
  const tePrem = +S.settings.tePrem || 0;
  const SRC = (S.dataRows && S.dataRows.length) ? S.dataRows : RAW;
  const base = SRC.map((r,i)=>{
    const rec = Math.max(0, (r[3]-r[4])*2);   // receptions derived from the 1.0 vs 0.5 PPR gap
    let proj = recPts==null ? r[col] : r[4] + rec*(recPts-0.5);
    if(r[2]==="TE" && tePrem) proj += rec*tePrem;
    return {id:"p"+i, name:r[0], team:r[1], pos:r[2], proj:Math.round((proj-tdAdj*(r[6]||0))*10)/10, adp:r[5]||0};
  });
  const customs = S.custom.map((r,i)=>({id:r[4]||("c"+i), name:r[0], team:r[1], pos:r[2], proj:r[3], adp:0, custom:true}));
  const all = base.concat(customs);
  for(const p of all){
    if(S.overrides[p.id]!=null) p.proj = S.overrides[p.id];
    if(S.adpOverride && S.adpOverride[p.id]!=null) p.adp = S.adpOverride[p.id];
    p.intel = INTEL[normName(p.name)] || null;
  }
  return all;
}

/* Snake draft math — overall pick numbers for my slot */
function myOverallPicks(){
  const t=S.settings.teams, slot=Math.min(S.settings.slot,t), out=[];
  for(let r=1;r<=S.settings.roster;r++){
    const n = (r-1)*t + (r%2===1 ? slot : t+1-slot);
    if(!(S.pickOwner && S.pickOwner[n] && +S.pickOwner[n]!==slot)) out.push(n);
  }
  for(const n in (S.pickOwner||{})) if(+S.pickOwner[n]===slot && !out.includes(+n)) out.push(+n);
  return out.sort((a,b)=>a-b);
}
/* Expected draft round per player. Listed players: straight from ADP.
   Unlisted (~): interpolate between same-position ADP anchors by projection,
   so a 205-pt QB prices like the 205-pt QBs the market DID rank — not like a
   205-pt WR. Positions with no anchors at all (DEF) map to the late rounds
   by position rank. */
function roundInfoRaw(players){
  const t = S.settings.teams, cap = t*S.settings.roster, R = S.settings.roster;
  const anchors = {}, posRank = {};
  for(const pos of POSITIONS){
    const inPos = players.filter(p=>p.pos===pos).sort((a,b)=>b.proj-a.proj);
    inPos.forEach((p,i)=>posRank[p.id]=i+1);
    let run = 0;
    anchors[pos] = inPos.filter(p=>p.adp).map(p=>{ run=Math.max(run,p.adp); return {proj:p.proj, adp:run}; });
  }
  const m = {};
  for(const p of players){
    let a = p.adp; const est = !a;
    if(est){
      const A = anchors[p.pos];
      if(A.length >= 3){
        if(p.proj >= A[0].proj) a = A[0].adp;
        else {
          for(let i=1;i<A.length;i++){
            if(p.proj >= A[i].proj){
              const hi=A[i-1], lo=A[i];
              const f = (hi.proj-p.proj)/Math.max(0.01, hi.proj-lo.proj);
              a = Math.round(hi.adp + f*(lo.adp-hi.adp)); break;
            }
          }
          if(!a){ // below every anchor: extend the position's price curve
            const first=A[0], last=A[A.length-1];
            const slope = (last.adp-first.adp)/Math.max(1, first.proj-last.proj);
            a = Math.round(last.adp + (last.proj-p.proj)*Math.max(0.5,slope));
          }
        }
      } else {
        a = (R-3)*t + posRank[p.id];
      }
    }
    if(a > cap){ m[p.id] = {rd:99, ud:true, est, label:"UD", eadp:a}; continue; }
    const rd = Math.ceil(a/t), rd2 = Math.min(rd+1, R);
    m[p.id] = {rd, ud:false, est, label:(est?"~":"")+"R"+rd+(rd2>rd?"–"+rd2:""), eadp:a};
  }
  return m;
}

/* Position tiers from projection gaps: a new tier starts wherever the
   drop-off from the previous player is meaningful (4.5% or 8+ pts). */
function tierMapRaw(players){
  const m = {};
  for(const pos of POSITIONS){
    const list = players.filter(p=>p.pos===pos).sort((a,b)=>b.proj-a.proj);
    let tier = 1;
    for(let i=0;i<list.length;i++){
      if(i>0){
        const gap = list[i-1].proj - list[i].proj;
        const sense = (typeof S!=="undefined" && S.settings && S.settings.tierSense) || 0.045;
        if(gap >= Math.max(8, list[i-1].proj*sense) && tier<9) tier++;
      }
      m[list[i].id] = tier;
    }
  }
  return m;
}

/* Monte Carlo: % chance each available player survives the CPU picks
   between now and my next pick. Seeded by board state so it's stable
   until another pick happens. Back-to-back turn picks → 100%. */
/**
 * Monte Carlo: N seeded sims of the CPU picks before my next two turns.
 * Returns {at1,at2,h1,h2,posGone} — survival % per player per horizon and
 * expected positional losses. Cached via survivalOdds().
 */
function survivalOddsRaw(){
  const h = nextPickHorizon(); if(!h) return null;
  const from = pickNow();
  const players = allPlayers();
  const at1 = h.next;
  const later = myOverallPicks().filter(x=>x>at1);
  const at2 = later.length ? later[0] : null;
  const end = at2 || at1;
  const out1 = {}, out2 = {}, gone = {QB:0,RB:0,WR:0,TE:0,DEF:0};
  if(end <= from){
    players.forEach(p=>{ out1[p.id]=100; out2[p.id]=100; });
    return {at1, at2, h1:out1, h2:out2, posGone:gone};
  }
  const rinfo = roundInfo(players);
  const t = S.settings.teams;
  const myPicks = new Set(myOverallPicks());
  const trials = Math.min(100, Math.max(20, S.settings.simN||30)), s1 = {}, s2 = {};
  const R = S.settings.roster;
  for(let k=0;k<trials;k++){
    const rng = mulberry32(987654 + k*104729 + S.log.length*7919);
    const taken = new Set(Object.keys(S.taken)); S.mine.forEach(id=>taken.add(id));
    const cpu = seedCpuTeams(rng);
    let lastP2 = null, runP2 = 0;
    for(let pk=from; pk<end; pk++){
      if(pk===at1) for(const p of players){ if(!taken.has(p.id)) s1[p.id]=(s1[p.id]||0)+1; }
      if(myPicks.has(pk)) continue;
      const r = Math.ceil(pk/t), idx = pk-(r-1)*t, slot = (r%2===1)?idx:t+1-idx;
      const avail = players.filter(p=>!taken.has(p.id));
      const best = cpuPick(avail, cpu[slot], r, rng, rinfo, R, runP2>=2?lastP2:null);
      if(best){
        taken.add(best.id); cpu[slot][best.pos]++; if(pk<at1) gone[best.pos]++;
        if(best.pos===lastP2) runP2++; else { lastP2=best.pos; runP2=1; }
      }
    }
    if(end===at1) for(const p of players){ if(!taken.has(p.id)) s1[p.id]=(s1[p.id]||0)+1; }
    for(const p of players){ if(!taken.has(p.id)) s2[p.id]=(s2[p.id]||0)+1; }
  }
  for(const p of players){
    out1[p.id] = Math.round(100*(s1[p.id]||0)/trials);
    out2[p.id] = Math.round(100*(s2[p.id]||0)/trials);
  }
  gone.__trials = trials;
  for(const pos in gone) gone[pos] = Math.round(gone[pos]/trials*10)/10;
  return {at1, at2: at2||null, h1:out1, h2: at2?out2:null, posGone:gone};
}
function tierMap(players){
  return cached("tiers", ()=>{
    const m = tierMapRaw(players);
    for(const id in (S.tierBump||{})) if(m[id]!=null) m[id] = Math.max(1, m[id]-S.tierBump[id]);
    return m;
  });
}
function survivalOdds(){ return cached("odds", survivalOddsRaw); }
function roundInfo(players){ return cached("rounds", ()=>roundInfoRaw(players)); }
function replacementLevels(players){ return cached("repl", ()=>replacementLevelsRaw(players)); }
function oddsClass(v){ return v>=70 ? "ok" : v>=35 ? "mid" : "low"; }

function simToMyPick(){
  const h = nextPickHorizon();
  if(!h || h.onClock){ toast("You're already on the clock"); return; }
  const players = allPlayers(), rinfo = roundInfo(players), t = S.settings.teams, R = S.settings.roster;
  const rng = mulberry32(Date.now() % 100000);
  const cpu = seedCpuTeams(rng);
  let made = 0;
  while(!nextPickHorizon().onClock && made < t){
    const pk = pickNow(), r = Math.ceil(pk/t), idx = pk-(r-1)*t, slot = (r%2===1)?idx:t+1-idx;
    const avail = players.filter(p=>!offBoard(p.id));
    const best = cpuPick(avail, cpu[slot], r, rng, rinfo, R);
    if(!best) break;
    redoStack.length=0;
    S.taken[best.id]=true; S.log.push({id:best.id, who:"other", t:Date.now()});
    cpu[slot][best.pos]++;
    made++;
  }
  pruneQueue(); commit();
  toast("⏩ Simmed "+made+" CPU picks — you're up");
}
function predictNextPicks(){
  const h = nextPickHorizon();
  if(!h || h.onClock) return null;
  const t = S.settings.teams, pk = h.cur, r = Math.ceil(pk/t), idx = pk-(r-1)*t;
  const slot = (r%2===1)?idx:t+1-idx;
  const players = allPlayers(), rinfo = roundInfo(players);
  const ros = teamRosters(), byId = idIndex();
  const c = {QB:0,RB:0,WR:0,TE:0,DEF:0};
  (ros[slot]||[]).forEach(id=>{ const p=byId[id]; if(p) c[p.pos]++; });
  const cand = players.filter(p=>!offBoard(p.id) && !(p.pos==="DEF" && r<12))
    .map(p=>({p, e: rinfo[p.id].eadp * injAdpFactor(p) * (p.pos==="QB" ? (c.QB<1?0.7:0.95) : 1)}))
    .sort((a,b)=>a.e-b.e).slice(0,3);
  return {slot, cand};
}
function nextPickHorizon(){
  const cur = pickNow();                       // pick currently on the clock
  const mine = myOverallPicks().filter(x=>x>=cur);
  if(!mine.length) return null;
  const onClock = mine[0]===cur;
  const next = (onClock && mine.length>1) ? mine[1] : mine[0]; // survival horizon
  return {cur, onClock, mine0:mine[0], mine1:mine[1]||null, next};
}

/* Replacement level per position — scales with league size. 2-QB league:
   teams×2 QB starters, so replacement QB is deep and QBs carry huge value. */
function replacementLevelsRaw(players){
  const t = S.settings.teams;
  const sl = slotCfg();
  const demand = { QB:Math.round(t*(sl.QB+sl.SF)*1.15), RB:Math.round(t*(sl.RB+0.5*sl.FLEX+0.6)*1.05),
                   WR:Math.round(t*(sl.WR+0.5*sl.FLEX+0.7)*1.05), TE:Math.round(t*(sl.TE+0.3)),
                   DEF:Math.round(t*Math.max(1,sl.DEF)*1.1), K:Math.round(t*sl.K*1.05) };
  const repl = {};
  for(const pos of POSITIONS){
    const list = players.filter(p=>p.pos===pos).sort((a,b)=>b.proj-a.proj);
    const idx = Math.min(demand[pos], list.length-1);
    repl[pos] = list.length ? list[Math.max(0,idx)].proj : 0;
  }
  return repl;
}

function myCounts(){
  const map = {QB:0,RB:0,WR:0,TE:0,DEF:0};
  const byId = idIndex();
  for(const id of myIds()){ const p=byId[id]; if(p) map[p.pos]++; }
  return map;
}
let _idx=null;
function idIndex(){
  const m={};
  for(const p of allPlayers()) m[p.id]=p;
  return m;
}

/* ---------- Recommendation engine ---------- */
/* Marginal value of adding the Nth player at a position: you start
   QB+SF (2 QB), 2RB+2WR+TE+flex+DEF. Depth has bench value, hoarding doesn't. */
/* Returns adjusted score. First player past startable = depth discount
   (QB3 is real superflex insurance); anything beyond that is dead weight
   and gets buried so it can never beat a live position. */
function needInfo(){
  const counts = myCounts();
  const min = S.settings.min;
  const needs = {};
  let totalNeeded = 0;
  for(const pos of POSITIONS){
    needs[pos] = Math.max(0, (min[pos]||0) - counts[pos]);
    totalNeeded += needs[pos];
  }
  const picksLeft = Math.max(0, S.settings.roster - S.mine.length - myKeeperIds().length);
  return {counts, needs, totalNeeded, picksLeft};
}

/**
 * The heart: score every available player for MY next pick.
 * VORP -> risk dial -> boost/fade -> saturation -> needs/locks -> stacks ->
 * intel -> injuries -> tier cliffs -> market falls. Memoized per board state.
 */
function scoreBoard(){
  const players = allPlayers();
  const repl = replacementLevels(players);
  const {counts, needs, totalNeeded, picksLeft} = needInfo();
  const byId = idIndex();
  const myTeamsQB = new Set(), myTeamsPC = new Set(); // QB teams, pass-catcher teams I own
  for(const id of myIds()){
    const p = byId[id]; if(!p) continue;
    if(p.pos==="QB") myTeamsQB.add(p.team);
    if(p.pos==="WR"||p.pos==="TE") myTeamsPC.add(p.team);
  }
  const mustFill = totalNeeded >= picksLeft && picksLeft > 0; // out of slack: only needed positions
  const horizon = nextPickHorizon();
  const avail = players.filter(p => !offBoard(p.id) && !S.dnd[p.id]);
  const tm = tierMap(players);
  const tierLeft = {};
  for(const p of avail){ const k=p.pos+tm[p.id]; tierLeft[k]=(tierLeft[k]||0)+1; }

  const scored = avail.map(p=>{
    const vorp = p.proj - (repl[p.pos]||0);
    let score = vorp;
    let why = [];
    // Positional saturation: value the slot he'd actually fill on YOUR roster
    const sat = satAdjust(p.pos, counts[p.pos], score, startableNow());
    score = sat.score; if(sat.note) why.push(sat.note);
    // Need pressure
    if(needs[p.pos] > 0){
      const urgency = picksLeft>0 ? Math.min(1, totalNeeded/picksLeft) : 1;
      score *= (1 + 0.35*urgency);
      why.push("fills required "+p.pos+" slot ("+needs[p.pos]+" still needed)");
    } else if(mustFill){
      score = -9999; // hard lock to required positions
    }
    // Stacks
    let stack = null;
    if((p.pos==="WR"||p.pos==="TE") && myTeamsQB.has(p.team)){ stack = "stacks with your "+p.team+" QB"; }
    if(p.pos==="QB" && myTeamsPC.has(p.team)){ stack = "stacks with your "+p.team+" pass-catcher"; }
    if(stack){ score *= 1.08; why.push(stack); }
    else if(p.pos!=="QB" && p.pos!=="DEF"){
      const mate = myIds().map(id2=>byId[id2]).filter(Boolean).find(q=>q.team===p.team && q.pos!=="QB" && q.pos!=="DEF");
      if(mate){ score *= 0.99; why.push("shares the "+p.team+" offense with your "+mate.name.split(" ").slice(-1)[0]+" (mild anti-correlation)"); }
    }
    // Analyst / prop-market intel
    if(p.intel){
      if(p.intel.t!=null){ score *= 1.04; why.push("⭐ analyst target: "+(p.intel.t||"flagged as a value pick")); }
      if(p.intel.lean>0){ score *= 1.03; why.push("▲ prop market leans bullish on his volume"); }
      if(p.intel.lean<0){ score *= 0.97; why.push("▼ prop market leans bearish on his volume"); }
    }
    // Risk tolerance: weight 3-year floor/ceiling into the score
    if(S.settings.risk && S.settings.risk!=="balanced"){
      if(S.settings.risk==="ceiling" && spikeRate(p) >= 0.45){
        score *= 1.05;
        why.push("🌋 spike machine: top-12 in "+usageFor(p)[4]+" of "+usageFor(p)[5]+" weeks");
      }
      const cns = consistencyOf(p);
      if(S.settings.risk==="ceiling" && spikeRate(p) >= 0.45){
        score *= 1.05;
        why.push("🌋 spike machine: top-12 in "+usageFor(p)[4]+" of "+usageFor(p)[5]+" weeks");
      }
      if(cns && cns.mean>0){
        if(S.settings.risk==="ceiling"){
          const up = Math.min(0.12, Math.max(0, (cns.hi/cns.mean-1))*0.5);
          if(up>0.02){ score *= 1+up; why.push("🎢 ceiling mode: best-year PPG "+cns.hi.toFixed(1)); }
        } else if(S.settings.risk==="floor"){
          const dn = Math.min(0.12, Math.max(0, (1-cns.lo/cns.mean))*0.5);
          if(dn>0.02){ score *= 1-dn; why.push("🛡 floor mode: worst-year PPG "+cns.lo.toFixed(1)); }
        }
      }
    }
    // Personal boost/fade (my-guys list)
    const bf = (S.boost||{})[p.id];
    if(bf===1){ score *= 1.1; why.push("▲ on your boost list"); }
    if(bf===-1){ score *= 0.88; why.push("▼ on your fade list"); }
    // Tier cliff: the last players in a tier are worth reaching for
    const left = tierLeft[p.pos+tm[p.id]];
    if(left<=2 && vorp>15){
      score *= 1.05;
      why.push("⚠️ tier cliff — "+(left===1?"LAST one":"only "+left)+" left in "+p.pos+" Tier "+tm[p.id]);
    }
    // Injury caution, graded by severity, with the actual report
    const injE = injuryOf(p);
    if(injE){
      const sv = injSeverity(injE.s);
      score *= sv.mult;
      why.push("🩹 "+sv.label+(injE.c?" — "+injE.c.slice(0,100):"")+(injE.d?" ("+injE.d+")":""));
    }
    // Market steal: sliding well past his ADP
    const fall = p.adp ? pickNow() - p.adp : 0;
    if(fall >= 10) why.push("💎 falling — "+fall+" picks past his ADP ("+p.adp+")");
    // Will he survive to my next pick? (snake, slot-aware)
    let backRisk = null;
    if(p.adp && horizon){
      if(p.adp <= horizon.next){ backRisk="gone"; why.push("🔥 won't make it back to your pick #"+horizon.next+" (ADP "+p.adp+")"); }
      else if(p.adp <= horizon.next+8){ backRisk="risky"; why.push("⏳ coin-flip to survive until pick #"+horizon.next+" (ADP "+p.adp+")"); }
    }
    return {p, vorp, score, why, stack, backRisk, tier:tm[p.id], steal:fall>=10?fall:0};
  }).filter(x=>x.score > -9000);

  scored.sort((a,b)=>b.score-a.score);
  return {scored, repl};
}

/* ---------- Actions ---------- */
const POS_EMOJI = {QB:"🎯", RB:"💨", WR:"🙌", TE:"🧱", DEF:"🛡"};
function emojiBurst(pos){
  if(!S.ui.live) return;
  for(let i=0;i<7;i++){
    const s = document.createElement("span");
    s.className = "cf";
    s.textContent = POS_EMOJI[pos]||"🏈";
    s.style.left = (42+Math.random()*16)+"vw";
    s.style.fontSize = "18px";
    s.style.background = "transparent";
    s.style.animationDelay = (Math.random()*0.3)+"s";
    document.body.appendChild(s);
    setTimeout(()=>s.remove(), 3600);
  }
}
function confetti(){
  const acc = getComputedStyle(document.documentElement).getPropertyValue("--green").trim() || "#2fd47a";
  const colors = [acc,"#ffc94d","#5aa9ff","#ff6b6b","#b78cff","#ffffff"].sort(()=>Math.random()-0.5);
  for(let i=0;i<48;i++){
    const s = document.createElement("span");
    s.className = "cf";
    s.style.left = Math.random()*100+"vw";
    s.style.background = colors[i%colors.length];
    s.style.animationDelay = (Math.random()*0.9)+"s";
    s.style.transform = "rotate("+Math.random()*360+"deg)";
    document.body.appendChild(s);
    setTimeout(()=>s.remove(), 4200);
  }
}

/* ---------- Toasts ---------- */
const ACHIEVEMENTS = [
  ["first-blood","🩸 First Blood","Log your first pick of a draft", s=>s.log.length>=1],
  ["queue-master","⭐ Queue Master","Queue 8+ players", s=>(s.queue||[]).length>=8],
  ["planner","📌 The Architect","Pin 5+ rounds on the plan board", s=>Object.keys(s.plan||{}).length>=5],
  ["stacked","🔗 Stacked","Roster a QB + pass-catcher stack", s=>{
    const byId=idIndex(), teams={};
    myIds().map(id=>byId[id]).filter(Boolean).forEach(p=>{(teams[p.team]=teams[p.team]||[]).push(p.pos);});
    return Object.values(teams).some(a=>a.includes("QB")&&(a.includes("WR")||a.includes("TE")));
  }],
  ["value-hound","💎 Value Hound","Draft a player 15+ past ADP", s=>{
    const byId=idIndex();
    return s.log.some((e,i)=>{ const p=byId[e.id]; return e.who==="me"&&p&&p.adp&&(i+1+(s.pickOffset||0))-p.adp>=15; });
  }],
  ["home-team","💖 Homer","Draft a favorite-state/college player", s=>{
    const byId=idIndex(); return s.mine.some(id=>{const p=byId[id]; return p&&isFav(p);});
  }],
  ["full-house","🏟 Full House","Complete a 16-man draft", s=>myIds().length>=s.settings.roster],
];
function checkAchievements(){
  try{
    const got = JSON.parse(localStorage.getItem(LS_KEY+"-ach")||"{}");
    let dirty = false;
    ACHIEVEMENTS.forEach(([id,label,desc,test])=>{
      if(!got[id] && test(S)){ got[id]=Date.now(); dirty=true; toast("🏆 Achievement: <b>"+label+"</b> — "+desc); }
    });
    if(dirty) localStorage.setItem(LS_KEY+"-ach", JSON.stringify(got));
  }catch(e){}
}
function toast(msg, opts){
  let wrap = document.getElementById("toastWrap");
  if(!wrap){ wrap = document.createElement("div"); wrap.id = "toastWrap"; document.body.appendChild(wrap); }
  const el = document.createElement("div");
  el.className = "toast" + (opts && opts.warn ? " warn" : "");
  el.setAttribute("role", "status");
  el.innerHTML = "<span>"+msg+"</span>";
  const act = opts && (opts.action || (opts.undo ? {label:"UNDO", fn:opts.undo} : null));
  if(act){
    const b = document.createElement("button"); b.textContent = act.label;
    b.addEventListener("click", ()=>{ act.fn(); el.remove(); });
    el.appendChild(b);
  }
  wrap.appendChild(el);
  while(wrap.children.length > 3) wrap.firstChild.remove();
  setTimeout(()=>{ el.classList.add("out"); setTimeout(()=>el.remove(), 300); }, 3200);
}

let redoStack = [];
function patchRow(id, cls){
  const tr = document.querySelector('#poolBody tr[data-pid="'+id+'"]');
  if(tr){ tr.className = cls; tr.style.opacity = cls==="taken" ? ".32" : ""; }
}
function markTaken(id){
  redoStack.length=0; S.taken[id]=true; S.log.push({id, who:"other", t:Date.now()});
  patchRow(id, "taken");
  commit();
  const p = idIndex()[id];
  if(p) toast("✕ <b>"+esc(p.name)+"</b> off the board", {undo:undoLast});
  {
    const n = S.log.length+(S.pickOffset||0), t2 = S.settings.teams;
    const r2 = Math.ceil(n/t2), idx2 = n-(r2-1)*t2, slot2 = (r2%2===1)?idx2:t2+1-idx2;
    if(+S.settings.rivalSlot===slot2 && p) toast("😤 Rival <b>"+esc(slotName(slot2))+"</b> took "+esc(p.name), {warn:true});
    if(S.queue.includes(id) && p) toast("🎯 SNIPED — <b>"+esc(p.name)+"</b> was in your queue", {warn:true});
  }
  if(p) announce(p.name+", off the board.");
  blip();
  pruneQueue();
}
function pickMine(id){
  if(S.settings.auctionMode){
    const v = prompt("Price paid? ($)", auctionOf(idIndex()[id]));
    if(v!==null){ const n = parseInt(v,10); if(!isNaN(n) && n>=0) S.prices[id] = n; }
  }
  let gradeChip = "";
  try{
    const {scored} = scoreBoard();
    const me = scored.find(s=>s.p.id===id);
    if(me && scored.length){
      const best = scored[0].vorp;
      const ratio = best>0 ? me.vorp/best : 1;
      const g = ratio>=0.92 ? "A" : ratio>=0.75 ? "B" : ratio>=0.5 ? "C" : "D";
      gradeChip = ' <b class="'+(g==="A"?"ok":g==="B"?"mid":"low")+'">['+g+']</b>';
    }
  }catch(e){}
  redoStack.length=0; S.mine.push(id); S.log.push({id, who:"me", t:Date.now()});
  patchRow(id, "mine-row");
  commit();
  const p = idIndex()[id];
  const who = S.settings.flair ? esc(S.settings.flair) : "you";
  if(p) toast("✓ "+who+" drafted <b style='color:var(--green)'>"+esc(p.name)+"</b>"+gradeChip, {undo:undoLast});
  if(p && isFav(p)) toast("💖 A "+((S.settings.favState||"").toUpperCase()||"favorite")+" kid joins the squad. This is the way.");
  if(p) emojiBurst(p.pos);
  if(p) announce("Pick "+pickNow()+". You drafted "+p.name+".");
  blip();
}
function undoLast(){
  const last = S.log.pop();
  if(!last) return;
  if(last.who==="me"){ S.mine = S.mine.filter(x=>x!==last.id); }
  else { delete S.taken[last.id]; }
  redoStack.push(last);
  commit();
}
function redoLast(){
  const e = redoStack.pop();
  if(!e) return;
  if(e.who==="me") S.mine.push(e.id); else S.taken[e.id]=true;
  S.log.push(e);
  commit();
}
function undoEntry(i){
  const e = S.log[i];
  if(!e) return;
  redoStack.length=0;
  if(e.who==="me"){ const k=S.mine.lastIndexOf(e.id); if(k>=0) S.mine.splice(k,1); }
  else delete S.taken[e.id];
  S.log.splice(i,1);
  commit();
}
function dropMine(id){
  redoStack.length=0;
  const k=S.mine.lastIndexOf(id); if(k>=0) S.mine.splice(k,1);
  for(let i=S.log.length-1;i>=0;i--){ if(S.log[i].id===id && S.log[i].who==="me"){ S.log.splice(i,1); break; } }
  commit();
}
function editNote(id){
  const p = idIndex()[id]; if(!p) return;
  const v = prompt("Note for "+p.name+":", S.notes[id]||"");
  if(v===null) return;
  if(v.trim()==="") delete S.notes[id]; else S.notes[id]=v.trim();
  commit();
}
function editProj(id){
  const p = idIndex()[id]; if(!p) return;
  const v = prompt("Projected season points for "+p.name+":", p.proj);
  if(v===null) return;
  const n = parseFloat(v);
  if(!isNaN(n) && n>=0){ S.overrides[id]=n; commit(); }
}
function commit(){
  save(); render();
  checkAchievements();
  if(window.requestIdleCallback) requestIdleCallback(()=>{ try{ survivalOdds(); }catch(e){} }, {timeout:2000});
}

/* ---------- Mock draft simulator ---------- */
/* One CPU drafting brain shared by odds sims and mocks (#46), with team
   rosters reconstructed from the actual pick log (#47). */
function seedCpuTeams(rng){
  const t = S.settings.teams, cpu = {};
  const byId0 = idIndex(), tend = {};
  S.log.forEach((e,i)=>{
    const p0 = byId0[e.id]; if(!p0 || !p0.adp) return;
    const n = i+1+(S.pickOffset||0), r0 = Math.ceil(n/t), idx0 = n-(r0-1)*t;
    const slot0 = (r0%2===1)?idx0:t+1-idx0;
    (tend[slot0]=tend[slot0]||[]).push(n - p0.adp);
  });
  for(let s=1;s<=t;s++){
    const arr = tend[s]||[];
    const bias = arr.length>=2 ? Math.max(-10, Math.min(10, arr.reduce((a,b)=>a+b,0)/arr.length)) : 0;
    cpu[s] = {QB:0,RB:0,WR:0,TE:0,DEF:0, qbGreed:0.5+rng()*0.55, bias};
  }
  const byId = idIndex();
  S.log.forEach((e,i)=>{
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), idx = n-(r-1)*t;
    const slot = (r%2===1) ? idx : t+1-idx;
    const p = byId[e.id];
    if(p && cpu[slot]) cpu[slot][p.pos]++;
  });
  return cpu;
}
function cpuPick(avail, st, r, rng, rinfo, R, runPos){
  const caps = {QB:3,RB:7,WR:8,TE:3,DEF:2};
  let pool = avail.filter(p=>st[p.pos]<caps[p.pos]);
  const missing = []; if(st.QB<1)missing.push("QB"); if(st.TE<1)missing.push("TE"); if(st.DEF<1)missing.push("DEF");
  if(missing.length >= R-r+1) pool = pool.filter(p=>missing.includes(p.pos));
  else if(r<12) pool = pool.filter(p=>p.pos!=="DEF" || rng()<0.02);
  if(!pool.length) pool = avail;
  let best=null, bk=1e9;
  for(const p of pool){
    let e = rinfo[p.id].eadp * injAdpFactor(p);
    if(p.pos==="QB") e *= st.qbGreed;
    if(runPos && p.pos===runPos) e *= 0.92;      // run contagion: the room panics
    e += (rng()*2-1)*_mockNoise + (st.bias||0);
    if(e<bk){bk=e; best=p;}
  }
  return best;
}


let _mockNoise = 9;
const SCENARIOS = [
  {name:"BPA (engine)", force:[]},
  {name:"QB-QB start", force:["QB","QB"]},
  {name:"RB-RB start", force:["RB","RB"]},
  {name:"WR-WR start", force:["WR","WR"]},
  {name:"Elite TE first", force:["TE"]},
];
const STRATS = [
 {name:"Balanced Value", icon:"⚖️", blurb:"Pure engine: best value, fill needs", mod:(p,c)=>1},
 {name:"QB Hammer", icon:"🔨", blurb:"Lock elite QBs before the run", mod:(p,c)=> p.pos==="QB" ? (c.counts.QB<2 ? 1.3 : (c.counts.QB<3 ? 1.05 : 1)) : 1},
 {name:"RB Anchor", icon:"🏃", blurb:"Pound RB volume in rounds 1–5", mod:(p,c)=> p.pos==="RB" && c.round<=5 ? 1.25 : 1},
 {name:"Stack Attack", icon:"🔗", blurb:"Chase QB + pass-catcher stacks", mod:(p,c)=> c.stacks ? 1.18 : 1},
 {name:"Target Hunter", icon:"⭐", blurb:"Lean hard on the analyst board", mod:(p,c)=> p.intel && p.intel.t!=null ? 1.12 : 1},
];

function bestStarters(ids, byId){
  const ps = ids.map(id=>byId[id]).filter(Boolean).sort((a,b)=>b.proj-a.proj);
  const used = new Set();
  const take = poss => { for(const p of ps){ if(!used.has(p.id) && poss.includes(p.pos)){ used.add(p.id); return p; } } return null; };
  const sl = slotCfg();
  const defs = [];
  const add = (n, lab, poss) => { for(let i=1;i<=n;i++) defs.push([n>1?lab+i:lab, poss]); };
  add(sl.QB, "QB", ["QB"]); add(sl.RB, "RB", ["RB"]); add(sl.WR, "WR", ["WR"]); add(sl.TE, "TE", ["TE"]);
  add(sl.FLEX, "FLEX", ["RB","WR","TE"]); add(sl.SF, "SFLX", ["QB","RB","WR","TE"]);
  add(sl.DEF, "DEF", ["DEF"]); add(sl.K, "K", ["K"]);
  const line = defs.map(([lab,poss])=>({lab, p:take(poss)}));
  return {line, starterIds:new Set([...used]), pts:line.reduce((a,s)=>a+(s.p?s.p.proj:0),0)};
}

/**
 * Simulate the rest of the draft: CPUs via cpuPick, my picks via a
 * needs-aware VORP scorer shaped by `strat` (and optional strat.force
 * opening). Deterministic per seed. Never mutates real state.
 */
function runMock(strat, seed){
  const rng = mulberry32(seed);
  const players = allPlayers();
  const repl = replacementLevels(players);
  const rinfo = roundInfo(players);
  const byId = {}; players.forEach(p=>byId[p.id]=p);
  const t=S.settings.teams, R=S.settings.roster, total=t*R, mySlot=Math.min(S.settings.slot,t);
  const min = S.settings.min;
  const taken = new Set(Object.keys(S.taken)); S.mine.forEach(id=>taken.add(id));
  const mineIds = S.mine.slice();
  const cpu = seedCpuTeams(rng);
  let mockLast = null, mockRun = 0;
  const picks = [];

  for(let pick=pickNow(); pick<=total; pick++){
    const r = Math.ceil(pick/t);
    const idx = pick-(r-1)*t;
    const slot = (r%2===1) ? idx : t+1-idx;
    const avail = players.filter(p=>!taken.has(p.id));
    if(!avail.length) break;
    let chosen = null;

    if(slot===mySlot){
      const counts={QB:0,RB:0,WR:0,TE:0,DEF:0};
      mineIds.forEach(id=>{const p=byId[id]; if(p)counts[p.pos]++;});
      let needed=0; for(const pos of POSITIONS) needed+=Math.max(0,(min[pos]||0)-counts[pos]);
      const left = R - mineIds.length;
      const mustFill = needed>=left && left>0;
      const myQBt=new Set(), myPCt=new Set();
      mineIds.forEach(id=>{const p=byId[id]; if(!p)return; if(p.pos==="QB")myQBt.add(p.team); if(p.pos==="WR"||p.pos==="TE")myPCt.add(p.team);});
      let bestScore=-1e9;
      for(const p of avail){
        if(S.dnd[p.id]) continue;
        const need=(min[p.pos]||0)-counts[p.pos];
        if(strat.force && strat.force[picks.length] && p.pos!==strat.force[picks.length]) continue;
        if(mustFill && need<=0) continue;
        let sc = p.proj-(repl[p.pos]||0);
        if(need>0) sc *= 1+0.35*Math.min(1, needed/Math.max(1,left));
        const stacks = ((p.pos==="WR"||p.pos==="TE")&&myQBt.has(p.team)) || (p.pos==="QB"&&myPCt.has(p.team));
        if(stacks) sc*=1.08;
        if(p.intel){ if(p.intel.t!=null)sc*=1.04; if(p.intel.lean>0)sc*=1.03; if(p.intel.lean<0)sc*=0.97; }
        if(p.pos==="DEF" && r<12 && need>=0 && !mustFill) sc-=40;         // no early DEF
        sc = satAdjust(p.pos, counts[p.pos], sc, startableNow()).score;    // don't hoard
        sc *= strat.mod(p,{counts, round:r, stacks});
        sc *= 0.97+rng()*0.06;
        if(sc>bestScore){bestScore=sc; chosen=p;}
      }
      if(!chosen) chosen=avail[0];
      mineIds.push(chosen.id);
      picks.push({pick, round:r, idx, p:chosen});
    } else {
      const st = cpu[slot];
      chosen = cpuPick(avail, st, r, rng, rinfo, R, mockRun>=2?mockLast:null);
      st[chosen.pos]++;
    }
    if(chosen){ if(chosen.pos===mockLast) mockRun++; else { mockLast=chosen.pos; mockRun=1; } }
    taken.add(chosen.id);
  }
  const {starterIds, pts} = bestStarters(mineIds, byId);
  const totalPts = mineIds.reduce((a,id)=>a+((byId[id]||{}).proj||0),0);
  return {strat, picks, mineIds, starterIds, startPts:Math.round(pts), totalPts:Math.round(totalPts), byId};
}

function renderMocks(){
  const base = Math.floor(Math.random()*1e9);
  const already = S.mine.length;
  $("#mockCtx").textContent = already ? "(continuing from your "+already+" real pick"+(already>1?"s":"")+")" : "(from a clean board)";
  $("#mockGrid").innerHTML = '<div class="empty" id="mockProg">Simulating… 0/'+STRATS.length+'</div>';
  $("#mockConsensus").innerHTML = "";
  const ROOMS = [9, 6, 9, 12, 14];   // sharp → chaos noise per sim
  const results = [];
  const step = i => {
    if(i < STRATS.length){
      _mockNoise = ROOMS[i] || 9;
      results.push(runMock(STRATS[i], base + i*7919));
      _mockNoise = 9;
      const prog = document.getElementById("mockProg");
      if(prog) prog.textContent = "Simulating… "+results.length+"/"+STRATS.length;
      setTimeout(()=>step(i+1), 10);                 // yield to the UI between sims
      return;
    }
    finishMocks(results, already);
  };
  step(0);
}
function finishMocks(results, already){
  $("#mockGrid").innerHTML = STRATS.map((st,i)=>{
    const m = results[i];
    const rows = m.picks.map(pk=>{
      const isStart = m.starterIds.has(pk.p.id);
      const tag = (pk.p.intel&&pk.p.intel.t!=null?" ⭐":"");
      return '<div class="mkrow '+(isStart?"strt":"bench")+'">'+
        '<span class="rp mono">'+pk.round+'.'+String(pk.idx).padStart(2,"0")+'</span>'+
        '<span class="mpos pos '+pk.p.pos+'">'+pk.p.pos+'</span>'+
        '<span class="mn">'+pk.p.name+tag+'</span></div>';
    }).join("");
    const kept = already ? '<div class="mkrow" style="color:var(--faint);font-size:10px">+ your '+already+' real pick'+(already>1?"s":"")+'</div>' : '';
    const roomLbl = ["", " · 🎯 sharp room", "", " · 🎲 loose room", " · 🌪 chaos room"][i] || "";
    return '<div class="mock">'+
      '<h4>'+st.icon+' '+st.name+'<span class="dimtxt" style="font-size:9px">'+roomLbl+'</span></h4>'+
      '<div class="mtot" title="Optimal starting lineup projection (QB/2RB/2WR/TE/FLEX/SF/DEF)">Starters <b class="mono">'+m.startPts+'</b> pts · roster '+m.totalPts+'</div>'+
      '<div class="mtot" style="margin:-4px 0 8px; font-size:10px">'+st.blurb+'</div>'+
      kept + rows + '</div>';
  }).join("");
  // Consensus: who the sims keep handing you at current prices
  const exp = {};
  results.forEach(m=>m.picks.forEach(pk=>{ exp[pk.p.id] = exp[pk.p.id] ? {p:pk.p, n:exp[pk.p.id].n+1} : {p:pk.p, n:1}; }));
  const guys = Object.values(exp).filter(x=>x.n>=3).sort((a,b)=>b.n-a.n || b.p.proj-a.p.proj).slice(0,12);
  // strategy brief: per-round consensus across the sims
  const byRound = {};
  results.forEach(m=>m.picks.forEach((pk,i2)=>{ (byRound[i2]=byRound[i2]||[]).push(pk); }));
  const brief = Object.keys(byRound).slice(0,8).map(i2=>{
    const pks = byRound[i2];
    const posCnt = {};
    pks.forEach(pk=>posCnt[pk.p.pos]=(posCnt[pk.p.pos]||0)+1);
    const topPos = Object.entries(posCnt).sort((a,b)=>b[1]-a[1])[0];
    const names = [...new Set(pks.map(pk=>pk.p.name.split(" ").slice(-1)[0]))].slice(0,3).join("/");
    return '<span class="mono">'+pks[0].round+'.'+String(pks[0].idx).padStart(2,"0")+'</span> <b>'+topPos[0]+'</b> ('+topPos[1]+'/5: '+esc(names)+')';
  }).join(" &nbsp;·&nbsp; ");
  $("#mockConsensus").innerHTML = '<div style="margin-bottom:8px">📋 <b>Strategy brief</b> — '+brief+'</div>' + "";
  $("#mockConsensus").innerHTML += guys.length
    ? '🎯 <b>Your guys</b> — landed on your team in 3+ of 5 sims: ' + guys.map(x=>'<b>'+x.p.name+'</b> ('+x.n+'/5)').join(" · ")
    : "No strong consensus across strategies — your seat has options.";
}

/* ---------- Live Sleeper draft sync (#401-#403, #415) ---------- */
const SYNC = {on:false, draftId:null, seen:0, myRoster:null, timer:null, base:"https://api.sleeper.app/v1"};
function sleeperToOurs(){
  return cached("slp2us", ()=>{
    const inv = {};
    if(typeof HEADSHOT!=="undefined"){
      const byId = idIndex();
      const byNorm = {}; allPlayers().forEach(p=>byNorm[normName(p.name)]=p.id);
      for(const k in HEADSHOT) if(byNorm[k]) inv[String(HEADSHOT[k])] = byNorm[k];
    }
    // team defenses: sleeper uses team codes as player_id for DEF
    allPlayers().filter(p=>p.pos==="DEF").forEach(p=>{
      const slp = ({SFO:"SF",GBP:"GB",KCC:"KC",NEP:"NE",NOS:"NO",TBB:"TB",LVR:"LV",JAC:"JAX"})[p.team] || p.team;
      inv[slp] = p.id;
    });
    return inv;
  });
}
async function syncImportLeague(leagueId){
  try{
    const users = await (await fetch(SYNC.base+"/league/"+leagueId+"/users")).json();
    const rosters = await (await fetch(SYNC.base+"/league/"+leagueId+"/rosters")).json();
    const drafts = await (await fetch(SYNC.base+"/league/"+leagueId+"/drafts")).json();
    const draft = drafts && drafts[0];
    if(draft){
      const order = draft.draft_order || {};
      const uname = {}; users.forEach(u=>uname[u.user_id] = u.display_name || (u.metadata&&u.metadata.team_name) || u.user_id);
      for(const uid in order) S.slotNames[String(order[uid])] = uname[uid] || S.slotNames[String(order[uid])];
      S.settings.sleeperDraftId = draft.draft_id;
      commit();
      toast("📥 League imported: names + draft "+draft.draft_id.slice(-6));
    } else toast("League found, no draft yet", {warn:true});
  }catch(e){ toast("League import failed — check the ID", {warn:true}); }
}
async function syncPoll(){
  if(!SYNC.on || !SYNC.draftId) return;
  try{
    const picks = await (await fetch(SYNC.base+"/draft/"+SYNC.draftId+"/picks")).json();
    if(!Array.isArray(picks)) throw 0;
    if(SYNC.myRoster==null){
      try{
        const dr = await (await fetch(SYNC.base+"/draft/"+SYNC.draftId)).json();
        const order = dr.draft_order || {};
        for(const uid in order) if(+order[uid]===+S.settings.slot) SYNC.myRoster = uid;
      }catch(e){}
    }
    const map = sleeperToOurs();
    let applied = 0;
    picks.slice(SYNC.seen).forEach(pk=>{
      const ours = map[String(pk.player_id)];
      if(ours && !offBoard(ours)){
        const mine = SYNC.myRoster && String(pk.picked_by)===String(SYNC.myRoster);
        if(mine){ S.mine.push(ours); S.log.push({id:ours, who:"me", t:Date.now()}); }
        else { S.taken[ours]=true; S.log.push({id:ours, who:"other", t:Date.now()}); }
        applied++;
      }
    });
    SYNC.seen = picks.length;
    const chip = document.getElementById("syncChip");
    if(chip) chip.textContent = "🔄 synced "+picks.length+" picks";
    if(applied){ redoStack.length=0; pruneQueue(); _memo={key:null}; commit(); toast("🔄 Sleeper sync: +"+applied+" picks"); }
  }catch(e){
    const chip = document.getElementById("syncChip");
    if(chip) chip.textContent = "🔄 sync error — retrying";
  }
}
function setSync(on){
  SYNC.on = on;
  SYNC.draftId = (S.settings.sleeperDraftId||"").trim() || null;
  clearInterval(SYNC.timer);
  const chip = document.getElementById("syncChip");
  if(on && SYNC.draftId){
    SYNC.seen = Math.max(0, S.log.length);   // don't replay what's already marked
    SYNC.timer = setInterval(syncPoll, 10000);
    syncPoll();
    if(chip){ chip.style.display=""; chip.textContent = "🔄 sync armed"; }
    toast("🔄 Live sync ON — picks will mark themselves (manual edits still yours)");
  } else {
    if(chip) chip.style.display="none";
    if(on) toast("Set a Sleeper draft ID in Settings first", {warn:true});
    SYNC.on = false;
  }
  const b = document.getElementById("syncBtn");
  if(b) b.classList.toggle("liveon", SYNC.on);
}
document.getElementById("syncBtn").addEventListener("click", ()=>setSync(!SYNC.on));

/* ---------- Season HQ actions ---------- */
async function weekRecap(){
  try{
    const st = await (await fetch("https://api.sleeper.app/v1/state/nfl")).json();
    const wk = st.season_type==="regular" ? st.week : 0;
    if(!wk){ toast("📅 Season hasn't kicked off — recap unlocks Week 1"); return; }
    const stats = await (await fetch("https://api.sleeper.app/v1/stats/nfl/regular/"+st.season+"/"+wk)).json();
    const inv = {}; if(typeof HEADSHOT!=="undefined") for(const k in HEADSHOT) inv[HEADSHOT[k]] = k;
    const byId = idIndex();
    const rows = myIds().map(id2=>byId[id2]).filter(Boolean).map(p2=>{
      const sid = HEADSHOT[normName(p2.name)];
      const s2 = sid && stats[String(sid)];
      return {p:p2, pts: s2 && s2.pts_ppr!=null ? s2.pts_ppr : null};
    }).sort((a,b)=>(b.pts||0)-(a.pts||0));
    $("#cardBody").innerHTML = '<div class="chead"><div class="cid"><div class="cname">📅 Week '+wk+' recap</div></div></div>'+
      rows.map(x=>'<div class="cintel">'+posBadge(x.p.pos)+' '+esc(x.p.name)+' — <b class="mono">'+(x.pts==null?"—":x.pts.toFixed(1))+'</b></div>').join("")+
      '<div class="cacts"></div>';
    $("#cardOverlay").classList.add("show");
  }catch(e){ toast("Week recap needs a connection", {warn:true}); }
}
document.addEventListener("click", e=>{
  if(e.target && e.target.id==="weekRecapBtn") weekRecap();
  if(e.target && e.target.id==="healthDigestBtn"){
    const byId = idIndex();
    const mine = myIds().map(id2=>byId[id2]).filter(Boolean);
    const txt = "🩹 "+(S.settings.flair||"My team")+" health ("+new Date().toLocaleDateString()+"):\n"+
      mine.map(p2=>{ const e2=injuryOf(p2); return "• "+p2.name+": "+(e2?injSeverity(e2.s).label+(e2.c?" — "+e2.c.slice(0,60):""):"healthy ✓"); }).join("\n");
    navigator.clipboard.writeText(txt).then(()=>toast("🩹 Health digest copied"));
  }
});

/* ---------- Team pages ---------- */
function openTeamPage(slot){
  const rivalDiff = (slot===+S.settings.rivalSlot);
  const byId = idIndex(), mySlot = Math.min(S.settings.slot, S.settings.teams);
  const ids = slot===mySlot ? myIds() : teamRosters()[slot];
  const ps = ids.map(id=>byId[id]).filter(Boolean);
  const bs = ps.length ? bestStarters(ids, byId) : null;
  const byPos = {};
  ps.forEach(p=>{ (byPos[p.pos]=byPos[p.pos]||[]).push(p); });
  document.getElementById("boardOverlay").classList.remove("show");
  $("#cardBody").innerHTML =
    '<div class="chead"><div class="cid"><div class="cname">'+esc(slotName(slot))+(slot===mySlot?' ★':'')+'</div>'+
    '<div class="csub">slot '+slot+' · '+ps.length+' players'+(bs?' · projected starters <b class="mono">'+fmt(bs.pts)+'</b>':'')+'</div></div></div>'+
    (ps.length ? POSITIONS.map(pos=> byPos[pos] ?
      '<div class="cintel"><b>'+pos+'</b> — '+byPos[pos].sort((a,b)=>b.proj-a.proj).map(p=>esc(p.name)+' <span class="dimtxt mono">'+p.proj+'</span>').join(" · ")+'</div>' : "").join("")
      : '<div class="empty">No tracked picks yet.</div>')+
    (rivalDiff ? (()=>{
      const myBs = bestStarters(myIds(), byId);
      const d3 = Math.round(myBs.pts - (bs?bs.pts:0));
      return '<div class="cintel" style="color:'+(d3>=0?'var(--green)':'var(--red)')+'">😤 Head-to-head: your starters project <b>'+(d3>=0?'+':'')+d3+'</b> vs this roster.</div>';
    })() : '')+
    '<div class="cacts"></div>';
  $("#cardOverlay").classList.add("show");
}

/* ---------- Injury Center ---------- */
function renderInjCenter(){
  const players = allPlayers();
  const hurt = players
    .map(p=>({p, e:injuryOf(p)}))
    .filter(x=>x.e && !S.taken[x.p.id])
    .map(x=>({...x, sv:injSeverity(x.e.s)}))
    .sort((a,b)=>{
      const rank = {IR:0, O:1, D:2, "?":3, Q:4};
      return (rank[a.sv.code]-rank[b.sv.code]) || String(b.e.d).localeCompare(String(a.e.d));
    });
  $("#injFresh").textContent = INJ.at
    ? "as of "+new Date(INJ.at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})+" · "+INJ.src
    : "baked snapshot ("+(typeof DATA_STAMP!=="undefined"?DATA_STAMP:"")+") — refresh for live";
  let h = hurt.length ? hurt.map(x=>
    '<div class="injrow" data-card="'+x.p.id+'" data-tabpre="hist">'+
      avatarImg(x.p,30)+
      '<div class="info"><div class="nm">'+x.p.name+
        (S.mine.includes(x.p.id)?' <span class="stackchip">YOURS</span>':'')+
        ' <span class="sevchip '+x.sv.cls+'">'+esc(x.sv.code==="?"?x.e.s:x.sv.label)+'</span></div>'+
        '<div class="sm">'+(x.e.c?esc(x.e.c):"no report text")+(x.e.d?' <span class="dimtxt">('+x.e.d+' · '+x.e.src+')</span>':'')+'</div></div>'+
      posBadge(x.p.pos)+
    '</div>').join("")
    : '<div class="empty">No injury reports among draftable players. 🎉</div>';
  // news headlines
  h += '<div class="sechead" style="margin-top:16px">📰 Latest NFL headlines</div>';
  h += NEWS.list.length
    ? NEWS.list.slice(0,8).map(n=>'<div class="newsrow">'+(n.u?'<a href="'+esc(n.u)+'" target="_blank" rel="noopener">':'')+esc(n.h)+(n.u?'</a>':'')+' <span class="dimtxt">'+n.d+'</span></div>').join("")
    : '<div class="dimtxt">Loading headlines… (needs network)</div>';
  $("#injBody").innerHTML = h;
}
document.getElementById("injBtn").addEventListener("click", ()=>{
  document.getElementById("injOverlay").classList.add("show");
  renderInjCenter();
  refreshNews().then(renderInjCenter);
  if(Date.now()-INJ.at > 5*60e3) refreshInjuries(true);
});
document.getElementById("injClose").addEventListener("click", ()=>document.getElementById("injOverlay").classList.remove("show"));
document.getElementById("injRefresh").addEventListener("click", ()=>{ refreshInjuries(false); refreshTrending(); NEWS.at=0; refreshNews().then(renderInjCenter); });
document.getElementById("injDigest").addEventListener("click", ()=>{
  const sevRank = {IR:0,O:1,D:2,"?":3,Q:4};
  const hurt = allPlayers().map(p=>({p, e:injuryOf(p)})).filter(x=>x.e && !S.taken[x.p.id])
    .map(x=>({p:x.p, e:x.e, sv:injSeverity(x.e.s)}))
    .sort((a,b)=>sevRank[a.sv.code]-sevRank[b.sv.code]).slice(0,12);
  const txt = "🩺 Injury digest ("+new Date().toLocaleDateString()+"):\n"+
    hurt.map(x=>"• "+x.p.name+" ("+x.p.pos+" "+x.p.team+") — "+x.sv.label+(x.e.c?": "+x.e.c.slice(0,80):"")).join("\n");
  navigator.clipboard.writeText(txt).then(()=>toast("📤 Injury digest copied"));
});

/* ---------- Player card ---------- */

function openCard(id){
  window._recent = (window._recent||[]).filter(x=>x!==id); window._recent.unshift(id); window._recent = window._recent.slice(0,5);
  const p = idIndex()[id]; if(!p) return;
  const players = allPlayers();
  const repl = replacementLevels(players), tm = tierMap(players), rinfo = roundInfo(players), odds = survivalOdds();
  const {scored} = scoreBoard(); const sc = scored.find(s=>s.p.id===id);
  const vorp = Math.round(p.proj-(repl[p.pos]||0));
  const status = S.mine.includes(id) ? "on your roster" : (S.taken[id] ? "drafted" : (S.dnd[id] ? "do-not-draft" : "available"));
  const ps = psosFor(p.team);
  const stat = (l,v)=>'<div class="cstat"><div class="cl">'+l+'</div><div class="cv">'+v+'</div></div>';
  const m = metaFor(p), L = lastFor(p), PR = projFor(p);
  const chips = [];
  if(m && m[1]===0) chips.push('<span class="chip rk">🎓 ROOKIE</span>');
  const injE = injuryOf(p);
  if(injE){ const sv=injSeverity(injE.s); chips.push('<span class="chip inj '+sv.cls+'">🩹 '+esc(sv.code==="?"?injE.s:sv.label)+'</span>'); }
  if(buzzOf(p)>1000) chips.push('<span class="chip" style="color:var(--green)">📈 '+buzzOf(p).toLocaleString()+' adds/24h</span>');
  if(L && L[11]) chips.push('<span class="chip">'+p.pos+L[11]+' in '+LAST_SEASON+'</span>');
  if(L && L[0] && L[0]<=13) chips.push('<span class="chip warn">missed '+(17-L[0])+' games '+LAST_SEASON+'</span>');
  if(ageCliff(p)) chips.push('<span class="chip warn">age-cliff: '+ageCliff(p)+' yrs</span>');
  if(m && m[8]) chips.push('<span class="chip">depth '+esc(m[8])+(m[7]||"")+'</span>');
  if(L){
    const d = Math.round(p.proj - L[10]);
    chips.push('<span class="chip" style="color:'+(d>=0?"var(--green)":"var(--red)")+'">'+(d>=0?"+":"")+d+' vs '+LAST_SEASON+'</span>');
  }
  let bio = "";
  if(m){
    const season = m[1]===0 ? "rookie season" : (m[1]>0 ? (m[1]+1)+ordSuffix(m[1]+1)+" NFL season" : "");
    bio = [m[0]?("Age "+m[0]):"", season, m[2], (m[3]&&m[4])?(m[3]+" "+m[4]+" lbs"):"", m[5]?("#"+m[5]):""].filter(Boolean).join(" · ");
  }
  const qbName = (p.pos==="WR"||p.pos==="TE") && typeof TEAMQB!=="undefined" && TEAMQB[p.team];
  const myQBhere = qbName && S.mine.some(id=>{ const q=idIndex()[id]; return q && q.pos==="QB" && q.team===p.team; });
  // aligned 2025 vs 2026 table
  let tbl = "";
  if(L || PR){
    const rows = [];
    const add = (lab, lv, pv, dec) => {
      if((lv==null||lv===0) && (pv==null||pv===0)) return;
      const fmt = x => x==null ? "—" : (dec ? (+x).toFixed(1) : Math.round(x).toLocaleString());
      rows.push('<tr><td>'+lab+'</td><td>'+fmt(lv)+'</td><td>'+fmt(pv)+'</td></tr>');
    };
    add("Games", L&&L[0], PR&&PR[0], true);
    if(p.pos==="QB"){
      add("Pass yds", L&&L[1], PR&&PR[1]); add("Pass TD", L&&L[2], PR&&PR[2], true); add("INT", L&&L[3], PR&&PR[3], true);
      add("Rush yds", L&&L[4], PR&&PR[4]); add("Rush TD", L&&L[5], PR&&PR[5], true);
    } else {
      add("Targets", L&&L[6], PR&&PR[6]); add("Rec", L&&L[7], PR&&PR[7]); add("Rec yds", L&&L[8], PR&&PR[8]); add("Rec TD", L&&L[9], PR&&PR[9], true);
      add("Rush yds", L&&L[4], PR&&PR[4]); add("Rush TD", L&&L[5], PR&&PR[5], true);
    }
    add("PPR pts", L&&L[10], p.proj, true);
    add("PPG", L&&L[0]?L[10]/L[0]:null, PR&&PR[0]?p.proj/PR[0]:null, true);
    tbl = '<table class="stattbl"><tr><th></th><th>'+LAST_SEASON+'</th><th>\u201926 proj</th></tr>'+rows.join("")+'</table>';
  }
  const hw = hometownOf(p), ci = collegeInfo(p), h3 = hist3For(p), fav = isFav(p), cons = consistencyOf(p);
  const stars = playoffStars(p.team);
  const tab = window._cardTab || "ov";
  const tabBtn = (id2,lab)=>'<button class="ctab'+(tab===id2?" on":"")+'" data-cardtab="'+id2+'" data-cardid="'+id+'">'+lab+'</button>';
  // History tab pieces
  const maxPts = Math.max(1, ...h3.map(x=>x[2]), p.proj);
  const barRow = (label, pts, extra)=>'<div class="h3row"><span class="h3y mono">'+label+'</span>'+
    '<span class="h3bar"><span class="h3fill" style="width:'+Math.round(pts/maxPts*100)+'%"></span></span>'+
    '<span class="h3v mono">'+pts.toFixed(1)+'</span><span class="h3x dimtxt">'+extra+'</span></div>';
  const histBars = h3.map(x=>barRow(String(x[0]), x[2], (x[3]?p.pos+x[3]+" · ":"")+x[1]+" gm"+(x[1]<14?" 🩹":""))).join("")+
    barRow("'26*", p.proj, "projected");
  let trendLine = "";
  if(h3.length>=2){
    if(p.pos==="QB"){
      trendLine = "Pass yds: "+h3.map(x=>fmt(x[5])).join(" → ")+" · Rush yds: "+h3.map(x=>fmt(x[6])).join(" → ");
    } else {
      trendLine = (h3.some(x=>x[4])?"Targets: "+h3.map(x=>x[4]).join(" → ")+" · ":"")+"Rush yds: "+h3.map(x=>fmt(x[6])).join(" → ");
    }
  }
  const effLine = (()=>{
    const L2 = lastFor(p); if(!L2) return "";
    if((p.pos==="WR"||p.pos==="TE") && L2[6]>0) return "Yards per target ("+LAST_SEASON+"): "+(L2[8]/L2[6]).toFixed(1);
    if(p.pos==="RB" && L2[0]>0) return "Scrimmage yds/game ("+LAST_SEASON+"): "+((L2[4]+L2[8])/L2[0]).toFixed(1);
    return "";
  })();
  const careerHigh = h3.length ? Math.max(...h3.map(x=>x[2])) : null;
  const myCollegeMate = (()=>{
    if(!ci) return null;
    const mate = myIds().map(id2=>idIndex()[id2]).filter(Boolean).find(q=>q.id!==p.id && collegeInfo(q) && collegeInfo(q).name===ci.name);
    return mate ? mate.name : null;
  })();
  const ovChips = chips.slice();
  if(fav) ovChips.unshift('<span class="chip" style="color:#ff7bac;border-color:#ff7bac">💖 one of yours</span>');
  if(breakoutTag(p)) ovChips.push('<span class="chip" style="color:var(--green)">🚀 breakout profile</span>');
  if(bustTag(p)) ovChips.push('<span class="chip warn">⚠ bust profile</span>');
  if(tdRegressTag(p)) ovChips.push('<span class="chip warn">📉 TD regression</span>');
  if(p.adp && p.adp>=60 && p.adp<=90 && p.pos==="RB") ovChips.push('<span class="chip">☠ RB dead zone</span>');
  const wi = winnerIndex(p);
  if(wi>=3) ovChips.push('<span class="chip" style="color:var(--gold)">🏆 league-winner index '+wi+'/5</span>');
  if(myCollegeMate) ovChips.push('<span class="chip">🎓 '+esc(ci.name)+' with '+esc(myCollegeMate)+'</span>');
  const u = usageFor(p);
  if(u && u[3] >= 35) ovChips.push('<span class="chip" style="color:var(--gold)">❄️ January performer ('+u[3]+' playoff pts)</span>');
  const uprof = usageProfile(p);
  if(uprof) ovChips.push('<span class="chip">'+esc(uprof)+'</span>');
  const bioLine2 = bio + (m&&m[13]?' · b. '+m[13].slice(0,10):'');
  const overview =
    (ovChips.length?'<div class="chips">'+ovChips.join("")+'</div>':'')+
    '<div class="cstats">'+
      stat("Projected", p.proj+((()=>{ if(!cons||!cons.mean) return ""; const band=Math.round(p.proj*Math.min(.3,(cons.hi-cons.lo)/(2*cons.mean))); return band>5?' <span class="dimtxt" style="font-size:10px">±'+band+'</span>':""; })()))+
      stat("Value", (vorp>0?"+":"")+vorp)+stat("Auction", "$"+auctionOf(p))+stat("ADP", p.adp||"—")+
      stat("Round", rinfo[p.id]?rinfo[p.id].label:"—")+
      stat("At #"+(odds?odds.at1:"?"), odds&&odds.h1[id]!=null?odds.h1[id]+"%":"—")+
      stat(odds&&odds.at2?"At #"+odds.at2:"Later", odds&&odds.h2&&odds.h2[id]!=null?odds.h2[id]+"%":"—")+
    '</div>'+
    '<div class="cstory">'+esc(storyOf(p))+'</div>'+
    ((()=>{ const u3 = usageFor(p); if(!u3) return "";
      return '<div class="cintel dim">🎯 '+LAST_SEASON+' usage: '+fmt(u3[2])+' opportunities · '+u3[0]+' inside the 20 · '+u3[1]+'% snaps'+
        (u3[5]>=6?' · <b>'+u3[4]+'</b> top-12 weeks of '+u3[5]:'')+'</div>'; })())+
    (sc && sc.why.length ? '<div class="cwhy">▸ '+sc.why.join("<br>▸ ")+'</div>' : '')+
    (qbName?'<div class="cintel dim">🎯 His QB: <b>'+esc(qbName)+'</b>'+(myQBhere?' — <span class="ok">your stack ✓</span>':'')+'</div>':'')+
    (injE?'<div class="cintel" style="color:var(--red)">🩹 <b>'+esc(injE.s)+'</b>'+(m&&m[9]?' ('+esc(m[9])+')':'')+(injE.c?' — '+esc(injE.c):'')+(injE.d?' <span class="dimtxt">('+injE.d+' · '+injE.src+')</span>':'')+'</div>':'');
  const history =
    '<div class="cintel"><b>Season points</b></div><div style="padding:0 20px 8px">'+histBars+'</div>'+
    (trendLine?'<div class="cintel dim">'+trendLine+'</div>':'')+
    (effLine?'<div class="cintel dim">'+effLine+'</div>':'')+
    ((()=>{ const u4 = usageFor(p), L4 = lastFor(p);
      if(!u4 || !L4 || !L4[0]) return "";
      return '<div class="cintel dim">Per game ('+LAST_SEASON+'): '+(u4[2]/L4[0]).toFixed(1)+' opportunities · '+(u4[0]/L4[0]).toFixed(1)+' RZ looks</div>'; })())+
    (careerHigh?'<div class="cintel dim">Career high: <b>'+careerHigh.toFixed(1)+'</b> PPR'+(cons?' · PPG band '+cons.lo.toFixed(1)+'–'+cons.hi.toFixed(1)+' ('+cons.label+')':'')+'</div>':'<div class="cintel dim">'+(m&&m[1]===0?"Rookie — class of "+(m[12]||"2026")+", no NFL seasons yet.":"No recent season data.")+'</div>')+
    (tbl?'<div class="cwiki">'+tbl+'</div>':'');
  const intelTab =
    (p.intel&&p.intel.t?'<div class="cintel">⭐ '+esc(p.intel.t)+'</div>':'')+
    (p.intel&&p.intel.p?'<div class="cintel dim">'+esc(p.intel.p)+'</div>':'')+
    ((()=>{const n=newsFor(p); return n?'<div class="cintel dim">📰 '+(n.u?'<a href="'+esc(n.u)+'" target="_blank" rel="noopener" style="color:var(--green)">':'')+esc(n.h)+(n.u?'</a>':'')+' <span class="dimtxt">'+n.d+'</span></div>':"";})())+
    (buzzOf(p)>500?'<div class="cintel dim">📈 '+buzzOf(p).toLocaleString()+' Sleeper adds in 24h</div>':'')+
    (ps?'<div class="cintel dim">🗓 '+ps.short+' · playoff softness '+"★".repeat(stars)+"☆".repeat(5-stars)+'</div>':'')+
    '<div class="cintel dim">Market: <button class="undo1" data-adpedit="'+id+'">ADP '+(p.adp||"—")+' ✎</button> '+
    '<button class="undo1" data-tierup="'+id+'">tier ▲</button><button class="undo1" data-tierdn="'+id+'">tier ▼</button> '+
    '<button class="undo1" data-boost="'+id+'">'+((S.boost||{})[id]===1?"▲ boosted":"▲ boost")+'</button>'+
    '<button class="undo1" data-fade="'+id+'">'+((S.boost||{})[id]===-1?"▼ faded":"▼ fade")+'</button></div>'+
    '<div class="cnote" id="cardNote">'+(S.notes[id]?'📝 '+esc(S.notes[id]):'')+'</div>';
  $("#cardBody").innerHTML =
    '<div class="chead">'+
      (logoUrl(p.team)?'<img class="clogo" src="'+logoUrl(p.team)+'" alt="">':'')+
      avatarImg(p,84)+
      '<div class="cid"><div class="cname">'+p.name+intelBadges(p)+(fav?' 💖':'')+'</div>'+
      '<div class="csub">'+posBadge(p.pos)+' &nbsp;'+p.team+' · T'+tm[p.id]+((()=>{const e2=envRank(p.team); return e2?' · offense #'+e2:'';})())+(byeOf(p.team)?' · bye W'+byeOf(p.team):'')+((()=>{const s3=sosOf(p.team); return s3?' · SOS '+(s3<=8?'😊 soft':s3>=25?'😖 brutal':'#'+s3):'';})())+' · '+status+'</div>'+
      (bioLine2?'<div class="cbio">'+bioLine2+'</div>':'')+
      '<div class="cbio">'+
        (hw?'<span class="chip">🏠 '+esc(hw.town)+(hw.st?', '+hw.st:'')+'</span> ':'')+
        (ci?'<span class="chip" style="'+(ci.color?'color:#fff;background:'+ci.color+';border-color:'+ci.color:'')+'">🎓 '+esc(ci.name)+(ci.conf?' · '+ci.conf:'')+'</span>':'')+
      '</div></div>'+
    '</div>'+
    '<div class="ctabs">'+tabBtn("ov","Overview")+tabBtn("hist","History")+tabBtn("intel","Intel")+'</div>'+
    '<div class="ctabbody">'+(tab==="hist"?history:tab==="intel"?intelTab:overview)+'</div>'+
    '<div class="cacts">'+
      (status==="available"||status==="do-not-draft" ?
        '<button class="pick" data-pick="'+id+'">✓ MINE</button>'+
        '<button class="kill" data-take="'+id+'">✕ taken</button>'+
        '<button class="undo1" data-dnd="'+id+'">'+(S.dnd[id]?"↩ allow":"🚫 never")+'</button>' : '')+
      (status==="on your roster" ? '<button class="undo1" data-unpickpre="'+id+'">↩ what-if drop</button>' : '')+
      '<button class="undo1" data-note="'+id+'">📝</button>'+
      ("webkitSpeechRecognition" in window ? '<button class="undo1" data-voicenote="'+id+'" title="Dictate a note">🎤</button>' : '')+
      '<button class="undo1" data-notetpl="'+id+'" title="Quick note: handcuff / flier / sleeper">📎</button>'+
      '<button class="undo1" data-cmpfrom="'+id+'">⚖</button>'+
      '<button class="undo1" data-keeper="'+id+'">👑</button>'+
      '<button class="undo1" data-queue="'+id+'">'+(S.queue.includes(id)?"★":"☆")+'</button>'+
      '<button class="undo1" data-plan="'+id+'">📌 plan</button>'+
      '<button class="undo1" data-onepager="'+id+'">📋 one-pager</button>'+
      '<button class="undo1" data-cardpng="'+id+'">🖼</button>'+
    '</div>';
    $("#cardOverlay").classList.add("show");
}
document.getElementById("cardClose").addEventListener("click", ()=>document.getElementById("cardOverlay").classList.remove("show"));

/* ---------- Head-to-head compare ---------- */
function renderCompare(){
  const an=$("#cmpA").value.trim(), bn=$("#cmpB").value.trim();
  const players = allPlayers();
  const find = n => players.find(p=>nq(p.name)===nq(n)) || (n.length>=4 ? players.find(p=>nq(p.name).includes(nq(n))) : null);
  const A=find(an), B=find(bn);
  if(!A || !B){ $("#cmpOut").innerHTML = "Pick two players."; return; }
  const repl=replacementLevels(players), tm=tierMap(players), rinfo=roundInfo(players), odds=survivalOdds();
  const {scored}=scoreBoard(); const sMap={}; scored.forEach(s=>sMap[s.p.id]=s);
  const stat = p => ({
    vorp: Math.round(p.proj-(repl[p.pos]||0)),
    tier: tm[p.id], rd: rinfo[p.id]?rinfo[p.id].label:"—",
    odds: odds&&odds.h1[p.id]!=null?odds.h1[p.id]+"%":"—",
    sc: sMap[p.id]?sMap[p.id].score:null,
    status: S.mine.includes(p.id)?"on your roster":(S.taken[p.id]?"already taken":"available"),
    why: sMap[p.id]?sMap[p.id].why:[]
  });
  const a=stat(A), b=stat(B);
  const row=(lab,va,vb,hi)=>{ // hi: 1 higher better
    let ca="",cb="";
    if(hi && va!==vb && va!=="—" && vb!=="—"){ const na=parseFloat(va),nb=parseFloat(vb);
      if(!isNaN(na)&&!isNaN(nb)){ ca=na>nb?"style='color:var(--green);font-weight:700'":""; cb=nb>na?"style='color:var(--green);font-weight:700'":""; } }
    return '<tr><td style="color:var(--dim)">'+lab+'</td><td '+ca+'>'+va+'</td><td '+cb+'>'+vb+'</td></tr>';
  };
  let verdict;
  if(a.sc!=null && b.sc!=null){
    const w = a.sc>=b.sc?A:B, l = a.sc>=b.sc?B:A;
    const pct = Math.round(100*Math.abs(a.sc-b.sc)/Math.max(1,Math.min(Math.abs(a.sc),Math.abs(b.sc))));
    verdict = '🏆 Engine takes <b style="color:var(--green)">'+w.name+'</b>'+(pct>=5?' comfortably':' — coin flip, go with your gut')+'.';
  } else verdict = '⚠️ '+(a.sc==null?A.name+" is "+a.status:B.name+" is "+b.status)+".";
  $("#cmpOut").innerHTML =
    '<table style="width:100%; font-size:12.5px" class="cmptab">'+
    '<tr><td></td><td style="font-weight:700">'+A.name+intelBadges(A)+'</td><td style="font-weight:700">'+B.name+intelBadges(B)+'</td></tr>'+
    row("Pos · Team", A.pos+" · "+A.team, B.pos+" · "+B.team) +
    row("Projected pts", A.proj, B.proj, 1) +
    ((()=>{
      const ha = hist3For(A), hb = hist3For(B);
      const yr = y => { const fa=ha.find(x=>x[0]===y), fb=hb.find(x=>x[0]===y);
        return (fa||fb) ? row(String(y)+" pts", fa?fa[2]:"—", fb?fb[2]:"—", 1) : ""; };
      const ys = [...new Set(ha.concat(hb).map(x=>x[0]))].sort();
      return ys.map(yr).join("");
    })()) +
    row("Value vs repl.", (a.vorp>0?"+":"")+a.vorp, (b.vorp>0?"+":"")+b.vorp, 1) +
    row("Tier", "T"+a.tier+" "+A.pos, "T"+b.tier+" "+B.pos) +
    row("ADP", A.adp||"—", B.adp||"—") +
    row("Expected round", a.rd, b.rd) +
    row("Snap share", (usageFor(A)||[])[1]!=null?(usageFor(A)||[])[1]+"%":"—", (usageFor(B)||[])[1]!=null?(usageFor(B)||[])[1]+"%":"—", 1) +
    row("RZ touches", (usageFor(A)||[])[0]!=null?(usageFor(A)||[])[0]:"—", (usageFor(B)||[])[0]!=null?(usageFor(B)||[])[0]:"—", 1) +
    row("Top-12 weeks", (usageFor(A)||[])[4]!=null?(usageFor(A)||[])[4]:"—", (usageFor(B)||[])[4]!=null?(usageFor(B)||[])[4]:"—", 1) +
    row("Back at next pick", a.odds, b.odds, 1) +
    row("Health", (()=>{const e=injuryOf(A); return e?injSeverity(e.s).label+(e.c?" — "+e.c.slice(0,40)+"…":""):"healthy ✓";})(), (()=>{const e=injuryOf(B); return e?injSeverity(e.s).label+(e.c?" — "+e.c.slice(0,40)+"…":""):"healthy ✓";})()) +
    row("Bye week", byeOf(A.team)||"—", byeOf(B.team)||"—") +
    row("Playoff weeks", psosFor(A.team)?psosFor(A.team).short:"—", psosFor(B.team)?psosFor(B.team).short:"—") +
    row("Engine score", a.sc!=null?Math.round(a.sc):"—", b.sc!=null?Math.round(b.sc):"—", 1) +
    row("Status", a.status, b.status) +
    '</table><div style="margin-top:12px; font-size:13px">'+verdict+'</div>'+
    (a.why.length||b.why.length ? '<div class="note">'+(a.why.length?'<b>'+A.name+':</b> '+a.why.join(" · ")+'<br>':'')+(b.why.length?'<b>'+B.name+':</b> '+b.why.join(" · "):'')+'</div>' : '');
}

/* ---------- Draft grade ---------- */
function gradeDraft(){
  const proj = runMock(STRATS[0], 555001);           // autopilot the rest
  const key = JSON.stringify([S.settings.teams,S.settings.roster,S.settings.slot,S.settings.scoring,S.settings.ptd]);
  if(!window._gradeBase || window._gradeBase.key!==key){
    const bak = {taken:S.taken, mine:S.mine, log:S.log};
    S.taken={}; S.mine=[]; S.log=[];                  // clean-board baseline
    const runs = [1,2,3,4,5].map(i=>runMock(STRATS[0], 777000+i*104729));
    const base = runs.map(m=>m.startPts);
    const posSum = {};
    runs.forEach(m=>{
      const bs2 = bestStarters(m.mineIds, m.byId);
      bs2.line.forEach(sl=>{ if(sl.p) posSum[sl.p.pos]=(posSum[sl.p.pos]||0)+sl.p.proj; });
    });
    const posAvg = {}; for(const k2 in posSum) posAvg[k2] = posSum[k2]/runs.length;
    S.taken=bak.taken; S.mine=bak.mine; S.log=bak.log;
    window._gradeBase = {key, avg: base.reduce((a,b)=>a+b,0)/base.length, pos: posAvg};
  }
  const basePts = window._gradeBase.avg;
  const r = proj.startPts/basePts;
  const letter = r>=1.05?"A+":r>=1.025?"A":r>=1.005?"A-":r>=0.99?"B+":r>=0.97?"B":r>=0.94?"C":r>=0.90?"D":"F";
  return {myPts:Math.round(proj.startPts), basePts:Math.round(basePts), letter, diff:Math.round(proj.startPts-basePts)};
}


window.__mod = window.__mod || []; window.__mod.push("core.js");
