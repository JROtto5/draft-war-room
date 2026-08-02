"use strict";

const POSITIONS = ["QB","RB","WR","TE","DEF"];
const LS_KEY = "draft-war-room-v2";

/* ---------- State ---------- */
const STATE_V = 3;
const MIGRATIONS = {
  // 1 -> 2: keepers/queue introduced (defaults suffice); stamp only
  1: s => { s.keepers = s.keepers||{}; s.queue = s.queue||[]; return s; },
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
  settings: { teams:12, roster:16, slot:12, scoring:"ppr", ptd:6, min:{QB:2,RB:3,WR:3,TE:1,DEF:1} },
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
function slotName(s){ return (S.slotNames && S.slotNames[s]) || ("T"+s); }
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
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), idx = n-(r-1)*t;
    const slot = (r%2===1) ? idx : t+1-idx;
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
  for(let r=1;r<=S.settings.roster;r++) out.push((r-1)*t + (r%2===1 ? slot : t+1-slot));
  return out;
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
        if(gap >= Math.max(8, list[i-1].proj*0.045) && tier<9) tier++;
      }
      m[list[i].id] = tier;
    }
  }
  return m;
}

/* Monte Carlo: % chance each available player survives the CPU picks
   between now and my next pick. Seeded by board state so it's stable
   until another pick happens. Back-to-back turn picks → 100%. */
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
  const demand = { QB:Math.round(t*2.3), RB:Math.round(t*2.6), WR:Math.round(t*3.2), TE:Math.round(t*1.3), DEF:Math.round(t*1.1) };
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
    const sat = satAdjust(p.pos, counts[p.pos], score);
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
      const cns = consistencyOf(p);
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
function markTaken(id){
  redoStack.length=0; S.taken[id]=true; S.log.push({id, who:"other", t:Date.now()}); commit();
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
  redoStack.length=0; S.mine.push(id); S.log.push({id, who:"me", t:Date.now()}); commit();
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
  const slots = [["QB",["QB"]],["RB1",["RB"]],["RB2",["RB"]],["WR1",["WR"]],["WR2",["WR"]],["TE",["TE"]],["FLEX",["RB","WR","TE"]],["SFLX",["QB","RB","WR","TE"]],["DEF",["DEF"]]];
  const line = slots.map(([lab,poss])=>({lab, p:take(poss)}));
  return {line, starterIds:new Set([...used]), pts:line.reduce((a,s)=>a+(s.p?s.p.proj:0),0)};
}

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
        sc = satAdjust(p.pos, counts[p.pos], sc).score;                   // don't hoard
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
  const bioLine2 = bio + (m&&m[13]?' · b. '+m[13].slice(0,10):'');
  const overview =
    (ovChips.length?'<div class="chips">'+ovChips.join("")+'</div>':'')+
    '<div class="cstats">'+
      stat("Projected", p.proj+((()=>{ if(!cons||!cons.mean) return ""; const band=Math.round(p.proj*Math.min(.3,(cons.hi-cons.lo)/(2*cons.mean))); return band>5?' <span class="dimtxt" style="font-size:10px">±'+band+'</span>':""; })()))+
      stat("Value", (vorp>0?"+":"")+vorp)+stat("ADP", p.adp||"—")+
      stat("Round", rinfo[p.id]?rinfo[p.id].label:"—")+
      stat("At #"+(odds?odds.at1:"?"), odds&&odds.h1[id]!=null?odds.h1[id]+"%":"—")+
      stat(odds&&odds.at2?"At #"+odds.at2:"Later", odds&&odds.h2&&odds.h2[id]!=null?odds.h2[id]+"%":"—")+
    '</div>'+
    '<div class="cstory">'+esc(storyOf(p))+'</div>'+
    (sc && sc.why.length ? '<div class="cwhy">▸ '+sc.why.join("<br>▸ ")+'</div>' : '')+
    (qbName?'<div class="cintel dim">🎯 His QB: <b>'+esc(qbName)+'</b>'+(myQBhere?' — <span class="ok">your stack ✓</span>':'')+'</div>':'')+
    (injE?'<div class="cintel" style="color:var(--red)">🩹 <b>'+esc(injE.s)+'</b>'+(m&&m[9]?' ('+esc(m[9])+')':'')+(injE.c?' — '+esc(injE.c):'')+(injE.d?' <span class="dimtxt">('+injE.d+' · '+injE.src+')</span>':'')+'</div>':'');
  const history =
    '<div class="cintel"><b>Season points</b></div><div style="padding:0 20px 8px">'+histBars+'</div>'+
    (trendLine?'<div class="cintel dim">'+trendLine+'</div>':'')+
    (effLine?'<div class="cintel dim">'+effLine+'</div>':'')+
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
      '<div class="csub">'+posBadge(p.pos)+' &nbsp;'+p.team+' · T'+tm[p.id]+((()=>{const e2=envRank(p.team); return e2?' · offense #'+e2:'';})())+' · '+status+'</div>'+
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
    row("Back at next pick", a.odds, b.odds, 1) +
    row("Health", (()=>{const e=injuryOf(A); return e?injSeverity(e.s).label+(e.c?" — "+e.c.slice(0,40)+"…":""):"healthy ✓";})(), (()=>{const e=injuryOf(B); return e?injSeverity(e.s).label+(e.c?" — "+e.c.slice(0,40)+"…":""):"healthy ✓";})()) +
    row("Playoff weeks", psosFor(A.team)?psosFor(A.team).short:"—", psosFor(B.team)?psosFor(B.team).short:"—") +
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

/* ---------- Rendering ---------- */
const $ = s => document.querySelector(s);

function posBadge(pos){ return '<span class="pos '+pos+'">'+pos+'</span>'; }

/* Fuzzy player search: punctuation-insensitive, multi-token AND with
   word-prefix matching, plus initials/subsequence for shorthand
   ("jsn" → Jaxon Smith-Njigba, "cmc" → Christian McCaffrey). */
function matchesQuery(p, q){
  const toks = nq(q).split(/\s+/).filter(Boolean);
  if(!toks.length) return true;
  const hay = nq(p.name+" "+p.team);
  const words = nq(p.name).split(/\s+/);
  const ok = toks.every(tok => hay.includes(tok) || words.some(w=>w.startsWith(tok)));
  if(ok) return true;
  if(toks.length===1 && toks[0].length>=2){
    const tok = toks[0];
    if(words.map(w=>w[0]).join("").includes(tok)) return true;
    if(tok.length>=3 && isSubseq(tok, words.join(""))) return true;
  }
  return false;
}
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
/* ---------- Injury intelligence (live ESPN + baked Sleeper/ESPN) ---------- */
let INJ = {map:{}, at:0, src:"baked snapshot"};
function initInjuries(){
  const m = {};
  if(typeof PLAYERMETA!=="undefined")
    for(const k in PLAYERMETA){
      const v = PLAYERMETA[k];
      if(v[6]) m[k] = {s:v[6], c:(v[10]||"") || (v[9] ? "("+v[9]+")" : ""), d:"", src:"Sleeper"};
    }
  if(typeof INJBASE!=="undefined")
    for(const k in INJBASE) m[k] = {s:INJBASE[k][0], c:INJBASE[k][1], d:INJBASE[k][2], src:"ESPN"};
  INJ.map = m;
  try{
    const c = JSON.parse(localStorage.getItem(LS_KEY+"-inj"));
    if(c && Date.now()-c.at < 6*3600e3) INJ = {map:c.map, at:c.at, src:"ESPN (cached)"};
  }catch(e){}
}
function injuryOf(p){
  const e = INJ.map[normName(p.name)];
  return e && injSeverity(e.s) ? e : null;
}
function injAdpFactor(p){
  const e = injuryOf(p); if(!e) return 1;
  const sv = injSeverity(e.s);
  return {Q:1.02, D:1.08, O:1.2, IR:1.8, "?":1.04}[sv.code] || 1;
}
let _injFails = 0, _injLastTry = 0;
async function refreshInjuries(silent){
  if(navigator.onLine===false){ if(!silent) toast("📡 Offline — showing "+INJ.src, {warn:true}); return; }
  if(silent && _injFails && Date.now()-_injLastTry < Math.min(30, 5*Math.pow(2,_injFails))*60e3) return;
  _injLastTry = Date.now();
  try{
    const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries");
    if(!r.ok) throw 0;
    const j = await r.json();
    const m = {}, changes = [];
    const known = {}; allPlayers().forEach(p=>known[normName(p.name)]=p);
    (j.injuries||[]).forEach(t=>(t.injuries||[]).forEach(i=>{
      const a = i.athlete||{}, k = normName(a.displayName||"");
      const st = i.status||"";
      if(!k || /^active/i.test(st)) return;
      m[k] = {s:st, c:(i.shortComment||i.longComment||"").slice(0,240), d:(i.date||"").slice(0,10), src:"ESPN"};
    }));
    for(const k in m){
      const p = known[k];
      if(!p || S.taken[p.id]) continue;
      const oldE = INJ.map[k];
      if(!oldE || oldE.s!==m[k].s) changes.push({p, s:m[k].s, mine:S.mine.includes(p.id)});
    }
    for(const k in INJ.map){ if(!m[k] && INJ.map[k].src==="Sleeper") m[k]=INJ.map[k]; }
    INJ = {map:m, at:Date.now(), src:"ESPN live"};
    try{ localStorage.setItem(LS_KEY+"-inj", JSON.stringify({at:INJ.at, map:m})); }catch(e){}
    _memo = {key:null};
    if(S.log.length > 0) changes.slice(0,3).forEach(c=>
      toast((c.mine?"🚨 YOUR PLAYER — ":"🩹 ")+esc(c.p.name)+": "+esc(c.s), {warn:true}));
    if(S.settings.notifyInj && "Notification" in window && Notification.permission==="granted" && document.visibilityState==="hidden"){
      changes.filter(c=>c.mine).slice(0,2).forEach(c=>{
        try{ new Notification("🩹 "+c.p.name, {body:c.s, icon:"icon-192.png", tag:"inj-"+c.p.id}); }catch(e2){}
      });
    }
    render();
    if(document.getElementById("injOverlay").classList.contains("show")) renderInjCenter();
    _injFails = 0;
    if(!silent) toast("🩺 Injuries refreshed — "+Object.keys(m).length+" league-wide reports");
  }catch(e){
    _injFails++;
    if(!silent) toast("Injury refresh failed — using "+INJ.src, {warn:true});
  }
}
/* market buzz: Sleeper trending adds (24h) */
let TREND = {map:{}, at:0};
async function refreshTrending(){
  try{
    const r = await fetch("https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=100");
    if(!r.ok) throw 0;
    const arr = await r.json();
    const inv = {};
    if(typeof HEADSHOT!=="undefined") for(const k in HEADSHOT) inv[HEADSHOT[k]] = k;
    const m = {};
    arr.forEach(x=>{ const k = inv[+x.player_id]; if(k) m[k] = x.count; });
    TREND = {map:m, at:Date.now()};
  }catch(e){}
}
function buzzOf(p){ return TREND.map[normName(p.name)] || 0; }
/* ESPN news headlines */
let NEWS = {list:[], at:0};
async function refreshNews(){
  if(Date.now()-NEWS.at < 10*60e3) return;
  try{
    const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=20");
    if(!r.ok) throw 0;
    const j = await r.json();
    NEWS = {list:(j.articles||[]).map(a=>({h:a.headline||"", d:(a.published||"").slice(0,10), u:(a.links&&a.links.web&&a.links.web.href)||""})), at:Date.now()};
  }catch(e){}
}
function newsFor(p){
  const last = p.name.split(" ").slice(-1)[0];
  return NEWS.list.find(n=>n.h.includes(p.name) || (last.length>4 && n.h.includes(last)));
}

function hist3For(p){ return (typeof LAST3!=="undefined" && LAST3[normName(p.name)]) || []; }
function hometownOf(p){
  const m = metaFor(p); if(!m || !m[11]) return null;
  const mm = String(m[11]).match(/^(.*?)\s*\(([A-Z]{2})\)\s*$/);
  return mm ? {town:mm[1], st:mm[2]} : {town:String(m[11]), st:""};
}
function collegeInfo(p){
  const m = metaFor(p);
  if(!m || !m[2]) return null;
  const c = (typeof COLLEGE!=="undefined" && COLLEGE[m[2]]) || null;
  return {name:m[2], conf:c?c[0]:"", color:c?c[1]:""};
}
function isFav(p){
  const st = (S.settings.favState||"").toUpperCase().trim();
  const col = (S.settings.favCollege||"").toLowerCase().trim();
  const hw = hometownOf(p), ci = collegeInfo(p);
  const stHit = st && hw && hw.st===st;
  const colHit = col && ci && ci.name.toLowerCase().includes(col);
  return stHit || colHit ? {st:stHit, col:colHit} : null;
}
function consistencyOf(p){
  const h = hist3For(p).filter(x=>x[1]>=8);
  if(h.length<2) return null;
  const ppg = h.map(x=>x[2]/x[1]);
  const mean = ppg.reduce((a,b)=>a+b,0)/ppg.length;
  if(mean<=0) return null;
  const sd = Math.sqrt(ppg.reduce((a,b)=>a+(b-mean)*(b-mean),0)/ppg.length);
  const cv = sd/mean;
  return {mean, lo:Math.min(...ppg), hi:Math.max(...ppg),
          label: cv<0.12 ? "metronome" : cv<0.25 ? "steady" : "boom-bust"};
}
function breakoutTag(p){
  const m = metaFor(p);
  if(!m || !(p.pos==="WR"||p.pos==="TE"||p.pos==="RB")) return false;
  if(m[1]<1 || m[1]>2) return false;
  const h = hist3For(p);
  if(!h.length) return m[1]>=1;                       // year-2 with thin data still qualifies
  const last = h[h.length-1], prev = h.length>1 ? h[h.length-2] : null;
  const tgtGrowth = prev && prev[4]>0 ? last[4]/prev[4] : 2;
  return tgtGrowth >= 1.15 || (PROJ26[normName(p.name)] && PROJ26[normName(p.name)][6] > (last[4]||0)*1.15);
}
function tdRegressTag(p){
  const L = lastFor(p), PR = projFor(p);
  if(!L || !PR) return false;
  const lastTD = (L[5]||0)+(L[9]||0)+(p.pos==="QB"?(L[2]||0):0);
  const projTD = (PR[5]||0)+(PR[9]||0)+(p.pos==="QB"?(PR[2]||0):0);
  return lastTD >= 8 && projTD > 0 && lastTD > projTD*1.35;
}
function bustTag(p){
  return !!(p.adp && p.adp<=70 && (ageCliff(p) || tdRegressTag(p)));
}
function winnerIndex(p){
  const m = metaFor(p);
  let sc = 0;
  if(m && m[0] && m[0]<=25) sc++;
  if(breakoutTag(p)) sc++;
  if(p.intel && p.intel.t!=null) sc++;
  if(buzzOf(p)>1000) sc++;
  const c = consistencyOf(p);
  if(c && c.hi>=15) sc++;
  return sc;
}
function envRank(team){
  const r = cached("env", ()=>{
    const totals = {};
    allPlayers().forEach(p=>{ if(p.pos!=="DEF") totals[p.team]=(totals[p.team]||0)+p.proj; });
    const order = Object.keys(totals).sort((a,b)=>totals[b]-totals[a]);
    const m = {}; order.forEach((t2,i)=>m[t2]=i+1);
    return m;
  });
  return r[team] || 0;
}
function playoffStars(team){
  const s = typeof PSOS!=="undefined" ? PSOS[team] : null;
  if(!s) return 0;
  return Math.max(1, Math.min(5, Math.round((s.r[0]+s.r[1]+s.r[2])/3/32*5)));
}
function primeNote(p){
  const m = metaFor(p);
  if(!m || !m[0] || !PRIME[p.pos]) return "";
  const [lo,hi] = PRIME[p.pos], a = m[0];
  return a<lo ? "pre-prime ("+p.pos+" prime "+lo+"–"+hi+")" : a<=hi ? "in his prime years" : "past the typical "+p.pos+" prime";
}
function storyOf(p){
  const m = metaFor(p), hw = hometownOf(p), ci = collegeInfo(p), h = hist3For(p);
  const bits = [];
  if(hw) bits.push((hw.town?hw.town+", ":"")+(hw.st||"")+" kid");
  if(ci) bits.push(ci.name+(ci.conf?" ("+ci.conf+")":"")+" product");
  if(m && m[12]) bits.push(m[1]===0 ? "arrives in the "+m[12]+" class" : "in the league since "+m[12]);
  let arc = "";
  if(h.length>=2){
    const pts = h.map(x=>Math.round(x[2]));
    const dir = pts[pts.length-1] > pts[0]*1.15 ? "climbing" : pts[pts.length-1] < pts[0]*0.85 ? "sliding" : "holding steady";
    arc = "Fantasy arc: "+pts.join(" → ")+" — "+dir+".";
  } else if(m && m[1]===0){
    arc = "No NFL tape yet — the projection is the bet.";
  }
  const pn = primeNote(p);
  const inj = injuryOf(p);
  let out = bits.length ? bits.join(", ")+". " : "";
  out += arc ? arc+" " : "";
  if(pn) out += pn.charAt(0).toUpperCase()+pn.slice(1)+". ";
  const er = typeof envRank==="function" ? envRank(p.team) : 0;
  if(er && er<=5) out += "Lands in a top-5 projected offense. ";
  else if(er && er>=28) out += "Buried in a bottom-5 projected offense. ";
  if(inj) out += "Currently "+injSeverity(inj.s).label.toLowerCase()+". ";
  const fav = isFav(p);
  if(fav) out += "And yes — one of yours"+(fav.st?" ("+(S.settings.favState||"").toUpperCase()+" roots)":"")+". 💖";
  return out.trim();
}
function metaFor(p){ return (typeof PLAYERMETA!=="undefined" && PLAYERMETA[normName(p.name)]) || null; }
function lastFor(p){ return (typeof LASTSZN!=="undefined" && LASTSZN[normName(p.name)]) || null; }
function projFor(p){ return (typeof PROJ26!=="undefined" && PROJ26[normName(p.name)]) || null; }
function ageCliff(p){
  const m = metaFor(p); if(!m || !m[0]) return 0;
  const lim = {RB:28, WR:30, TE:30, QB:37}[p.pos];
  return lim && m[0] >= lim ? m[0] : 0;
}
function badInjury(p){
  const e = injuryOf(p); if(!e) return "";
  const sv = injSeverity(e.s);
  return sv && (sv.code==="O"||sv.code==="IR") ? sv.label : "";
}
function headshotUrl(p){
  if(p.pos==="DEF") return logoUrl(p.team);
  const id = typeof HEADSHOT!=="undefined" ? HEADSHOT[normName(p.name)] : null;
  return id ? "https://sleepercdn.com/content/nfl/players/thumb/"+id+".jpg" : null;
}
function logoUrl(team){
  if(S.settings && S.settings.lowData) return null;
  const s = typeof TEAMLOGO!=="undefined" ? TEAMLOGO[team] : null;
  return s ? "https://a.espncdn.com/i/teamlogos/nfl/500/"+s+".png" : null;
}
window._noimg = window._noimg || new Set();
document.addEventListener("error", e=>{
  const img = e.target;
  if(!(img instanceof HTMLImageElement) || !img.classList.contains("avatar")) return;
  window._noimg.add(img.src);
  const ph = document.createElement("span");
  ph.className = "avatar ph";
  ph.style.width = img.getAttribute("width")+"px"; ph.style.height = img.getAttribute("height")+"px";
  ph.textContent = "•";
  img.replaceWith(ph);
}, true);
function avatarImg(p, size){
  if(S.settings && S.settings.lowData){
    const init = p.name.split(" ").map(w=>w[0]).slice(0,2).join("");
    return '<span class="avatar ph pos'+p.pos+'" style="width:'+size+'px;height:'+size+'px">'+esc(init)+'</span>';
  }
  const u = headshotUrl(p);
  const init2 = p.name.split(" ").map(w=>w[0]).slice(0,2).join("");
  if(u && window._noimg.has(u)) return '<span class="avatar ph pos'+p.pos+'" style="width:'+size+'px;height:'+size+'px">'+esc(init2)+'</span>';
  if(!u) return '<span class="avatar ph pos'+p.pos+'" style="width:'+size+'px;height:'+size+'px">'+esc(init2)+'</span>';
  return '<img class="avatar" src="'+u+'" width="'+size+'" height="'+size+'"'+(size>=56?' fetchpriority="high"':' loading="lazy"')+' decoding="async" alt="">';
}
function psosFor(team){
  const s = typeof PSOS!=="undefined" ? PSOS[team] : null;
  if(!s) return null;
  return {txt:"Playoff weeks: W15 "+s.o[0]+" · W16 "+s.o[1]+" · W17 "+s.o[2]+" (matchup ranks "+s.r.join("/")+")",
          short:"W15 "+s.o[0]+" · W16 "+s.o[1]+" · W17 "+s.o[2]};
}
function intelBadges(p){
  if(!p.intel) return "";
  let h="";
  if(p.intel.t!=null) h += '<span class="ib gold" title="Analyst target: '+esc(p.intel.t||"flagged as a value pick")+'">⭐</span>';
  if(p.intel.lean>0) h += '<span class="ib bull" title="'+esc(p.intel.p)+'">▲</span>';
  if(p.intel.lean<0) h += '<span class="ib bear" title="'+esc(p.intel.p)+'">▼</span>';
  return h;
}

function renderTabs(){
  const tabs = ["ALL","QB","RB","WR","TE","FLEX","DEF","MINE"];
  const players = allPlayers();
  const cnt = {};
  players.forEach(p=>{ if(!offBoard(p.id) && !S.dnd[p.id]) cnt[p.pos]=(cnt[p.pos]||0)+1; });
  cnt.ALL = Object.values(cnt).reduce((a,b)=>a+b,0);
  cnt.FLEX = (cnt.RB||0)+(cnt.WR||0)+(cnt.TE||0);
  cnt.MINE = myIds().length;
  $("#posTabs").innerHTML = tabs.map(t=>
    '<button class="ptab'+(S.ui.pos===t?" on":"")+'" data-pos="'+t+'">'+t+(cnt[t]!=null?'<sup>'+cnt[t]+'</sup>':'')+'</button>').join("");
}

function renderPool(){
  const {scored} = scoreBoard();
  const vorpMap = {};
  for(const s of scored) vorpMap[s.p.id]=s;
  const players = allPlayers();
  const repl = replacementLevels(players);
  const rinfo = roundInfo(players);
  const tm = tierMap(players);
  const q = $("#search").value.trim().toLowerCase();

  let rows = players.map(p=>({
    p, vorp: p.proj-(repl[p.pos]||0),
    taken: !!S.taken[p.id], mine: S.mine.includes(p.id),
    score: vorpMap[p.id] ? vorpMap[p.id].score : -Infinity,
    stack: vorpMap[p.id] ? vorpMap[p.id].stack : null,
    backRisk: vorpMap[p.id] ? vorpMap[p.id].backRisk : null,
    rd: rinfo[p.id]
  }));
  const vRank = {}; players.slice().sort((a,b)=>{
    const va=a.proj-(repl[a.pos]||0), vb=b.proj-(repl[b.pos]||0); return vb-va;
  }).forEach((p,i)=>vRank[p.id]=i+1);
  rows.forEach(r=>{ r.edge = r.p.adp ? r.p.adp - vRank[r.p.id] : null; });

  if(S.ui.pos==="MINE") rows = rows.filter(r=> r.mine || myKeeperIds().includes(r.p.id));
  else if(S.ui.pos==="FLEX") rows = rows.filter(r=>["RB","WR","TE"].includes(r.p.pos));
  else if(S.ui.pos!=="ALL") rows = rows.filter(r=>r.p.pos===S.ui.pos);
  if(q) rows = rows.filter(r=> matchesQuery(r.p, q));
  if(!S.ui.showTaken && S.ui.pos!=="MINE") rows = rows.filter(r=> !r.taken && !(S.keepers[r.p.id] && !r.mine));
  if(S.ui.round!=="ALL"){
    let lo, hi;
    if(S.ui.round==="NEXT"){
      const h = nextPickHorizon();
      const t = S.settings.teams;
      lo = h ? Math.ceil(h.mine0/t) : 1; hi = Math.min(lo+1, S.settings.roster);
    } else { [lo,hi] = S.ui.round.split("-").map(Number); }
    rows = rows.filter(r=> !r.rd.ud && r.rd.rd>=lo && r.rd.rd<=hi);
  }
  if(S.ui.targetsOnly) rows = rows.filter(r=> r.p.intel && r.p.intel.t!=null);
  if(S.ui.stacksOnly) rows = rows.filter(r=> r.stack);
  if(S.ui.survivors) rows = rows.filter(r=> r.backRisk!=="gone" && !r.taken && !r.mine);
  if(S.ui.fallers) rows = rows.filter(r=> !r.taken && !r.mine && r.p.adp && (pickNow()-r.p.adp)>=10);
  if(S.ui.hideHurt) rows = rows.filter(r=> !badInjury(r.p));
  const filtersOn = S.ui.pos!=="ALL" || S.ui.round!=="ALL" || S.ui.targetsOnly || S.ui.stacksOnly || S.ui.survivors || S.ui.fallers || S.ui.hideHurt || S.ui.showTaken || q;
  const cfb = document.getElementById("clearFiltersBtn");
  if(cfb) cfb.style.display = filtersOn ? "" : "none";

  const dir = S.ui.dir, key = S.ui.sort;
  rows.sort((a,b)=>{
    let av,bv;
    switch(key){
      case "name": av=a.p.name; bv=b.p.name; return dir*av.localeCompare(bv);
      case "team": av=a.p.team; bv=b.p.team; return dir*av.localeCompare(bv);
      case "pos": av=a.p.pos; bv=b.p.pos; return dir*av.localeCompare(bv) || b.vorp-a.vorp;
      case "proj": return dir*(a.p.proj-b.p.proj);
      case "adp": return dir*((a.p.adp||999)-(b.p.adp||999));
      case "rd": return dir*(a.rd.rd-b.rd.rd) || (a.p.adp||999)-(b.p.adp||999);
      case "edge": return dir*((a.edge==null?-999:a.edge)-(b.edge==null?-999:b.edge));
      case "rank": case "vorp": default: return dir*(a.vorp-b.vorp);
    }
  });

  document.querySelectorAll("thead th").forEach(th=>{
    const on = th.dataset.sort===key;
    th.classList.toggle("sorton", on);
    if(th.dataset.sort) th.setAttribute("aria-sort", on ? (dir===-1?"descending":"ascending") : "none");
  });

  const curRd = Math.min(Math.ceil(pickNow()/S.settings.teams), S.settings.roster);
  const CAP = 250;
  const truncated = !window._showAllRows && rows.length > CAP;
  const fullLen = rows.length;
  if(truncated) rows = rows.slice(0, CAP);
  const hl = nm => {
    if(!q || q.length<2) return nm;
    const i = nm.toLowerCase().indexOf(q);
    return i<0 ? nm : nm.slice(0,i)+"<mark>"+nm.slice(i,i+q.length)+"</mark>"+nm.slice(i+q.length);
  };

  const showTierDividers = ["QB","RB","WR","TE","DEF"].includes(S.ui.pos) && (key==="vorp"||key==="rank"||key==="proj") && dir===-1;
  let prevTier = null;
  const tw = document.querySelector(".tablewrap");
  const scrollSave = tw ? tw.scrollTop : 0;
  $("#poolBody").innerHTML = rows.map((r,i)=>{
    const cls = r.mine ? "mine-row" : (r.taken ? "taken" : (S.dnd[r.p.id] ? "dndrow" : ""));
    const act = r.mine
      ? '<button class="undo1" data-drop="'+r.p.id+'">↩ un-pick</button>'
      : r.taken
        ? '<button class="undo1" data-untake="'+r.p.id+'">↩ restore</button>'
        : '<button class="pick" data-pick="'+r.p.id+'">✓ MINE</button><button class="kill" data-take="'+r.p.id+'">✕ taken</button>'+
          '<button class="undo1" data-dnd="'+r.p.id+'" title="'+(S.dnd[r.p.id]?"Allow drafting again":"Do not draft — hide from recommendations")+'" aria-label="Toggle do-not-draft">'+(S.dnd[r.p.id]?"↩":"🚫")+'</button>';
    let div = "";
    if(showTierDividers && tm[r.p.id]!==prevTier){
      div = '<tr class="tdiv"><td colspan="10">Tier '+tm[r.p.id]+'</td></tr>';
      prevTier = tm[r.p.id];
    }
    return div + '<tr class="'+cls+'" data-pid="'+r.p.id+'">'+
      '<td class="mono" style="color:var(--faint)">'+(i+1)+'</td>'+
      '<td><span class="pcell" data-card="'+r.p.id+'" title="Open player card">'+avatarImg(r.p,24)+'<span class="pname">'+hl(r.p.name)+'</span></span>'+(S.notes[r.p.id]?'<span class="ib gold" title="'+esc(S.notes[r.p.id])+'">📝</span>':'')+(S.dnd[r.p.id]&&!r.taken&&!r.mine?'<span class="ib bear" title="On your do-not-draft list">🚫</span>':'')+((()=>{const e=injuryOf(r.p); if(!e) return ""; const sv=injSeverity(e.s); return '<span class="ib '+sv.cls+'" title="'+esc(sv.label+(e.c?" — "+e.c:"")+(e.d?" ("+e.d+" · "+e.src+")":""))+'">●</span>';})())+(buzzOf(r.p)>3000?'<span class="ib bull" title="'+buzzOf(r.p).toLocaleString()+' Sleeper adds in 24h">📈</span>':'')+((metaFor(r.p)||[])[1]===0?'<span class="ib" title="Rookie">🎓</span>':'')+(isFav(r.p)?'<span class="ib" style="color:#ff7bac" title="Your favorite state/college">💖</span>':'')+((S.boost||{})[r.p.id]===1?'<span class="ib bull" title="On your boost list">▲</span>':(S.boost||{})[r.p.id]===-1?'<span class="ib bear" title="On your fade list">▼</span>':'')+((()=>{const n=newsFor(r.p); return n && (Date.now()-new Date(n.d).getTime())<3*86400e3 ? '<span class="ib" title="'+esc(n.h)+'">📰</span>' : "";})())+intelBadges(r.p)+(r.stack?'<span class="stackchip">🔗 stack</span>':'')+(!r.taken&&!r.mine&&r.p.adp&&(pickNow()-r.p.adp)>=10?'<span class="ib" title="Falling: '+(pickNow()-r.p.adp)+' picks past ADP '+r.p.adp+'">💎</span>':'')+(r.backRisk==="gone"?'<span class="ib" title="Won\'t make it back to your next pick">🔥</span>':r.backRisk==="risky"?'<span class="ib" title="Coin-flip to survive to your next pick">⏳</span>':'')+'</td>'+
      '<td>'+posBadge(r.p.pos)+'<span class="tier t'+Math.min(tm[r.p.id],5)+'">T'+tm[r.p.id]+'</span></td>'+
      '<td class="mono" style="color:var(--dim)'+(psosFor(r.p.team)?';cursor:help':'')+'"'+(psosFor(r.p.team)?' title="'+esc(psosFor(r.p.team).txt)+'"':'')+'>'+(logoUrl(r.p.team)?'<img class="tlogo" src="'+logoUrl(r.p.team)+'" width="14" height="14" loading="lazy" decoding="async" alt=""> ':'')+r.p.team+'</td>'+
      '<td><span class="proj mono" data-edit="'+r.p.id+'">'+r.p.proj+'</span></td>'+
      '<td class="mono" style="color:'+(r.vorp>=0?'var(--green)':'var(--faint)')+(r.vorp>0?';background:rgba(47,212,122,'+Math.min(0.22, r.vorp/700).toFixed(3)+')':'')+'">'+(r.vorp>0?"+":"")+Math.round(r.vorp)+'</td>'+
      '<td class="mono" style="color:var(--dim)">'+(r.p.adp||"—")+'</td>'+
      '<td class="mono" style="font-size:12px;color:'+(r.edge>0?'var(--green)':r.edge<0?'var(--red)':'var(--faint)')+'" title="ADP minus value rank: positive = market prices him later than his value">'+(r.edge==null?"—":(r.edge>0?"+":"")+r.edge)+'</td>'+
      '<td><span class="rd'+(curRd && !r.rd.ud && r.rd.rd<=curRd?" now":"")+'" title="'+(r.rd.est?"Estimated from projection rank (no market ADP)":"Expected round window from ADP")+'">'+r.rd.label+'</span></td>'+
      '<td><div class="act">'+act+'</div></td></tr>';
  }).join("") + (truncated ? '<tr><td colspan="10" style="text-align:center;padding:12px"><button class="undo1" data-showall="1">▾ show all '+fullLen+' players</button></td></tr>' : "") || '<tr><td colspan="10" class="empty">No players match the current filters.<br><br><button class="undo1" data-clearfilters="1">✕ Clear all filters</button></td></tr>';
  if(tw) tw.scrollTop = scrollSave;
  $("#poolCount").textContent = (truncated ? rows.length+" of "+fullLen : rows.length) + " players";
  window._poolIds = rows.filter(r=>!r.taken && !r.mine).length ? rows.map(r=>r.p.id) : [];
  applyKbSel();
}

/* Command palette (Ctrl+K) */
const PALETTE_ACTIONS = [
  ["🩺 Injury Center", ()=>document.getElementById("injBtn").click()],
  ["🎲 Mock drafts", ()=>document.getElementById("mocksBtn").click()],
  ["🗂 Draft board", ()=>document.getElementById("boardBtn").click()],
  ["🎓 Draft report", ()=>document.getElementById("gradeBtn").click()],
  ["⚖ Compare players", ()=>document.getElementById("cmpBtn").click()],
  ["📋 Paste picks", ()=>document.getElementById("pasteBtn").click()],
  ["⚙ Settings", ()=>document.getElementById("settingsBtn").click()],
  ["🔴 Toggle Live mode", ()=>document.getElementById("liveBtn").click()],
  ["🖨 Cheat sheet", ()=>document.getElementById("sheetBtn").click()],
  ["🔗 Copy share link", ()=>document.getElementById("shareBtn").click()],
  ["? Help & shortcuts", ()=>document.getElementById("helpBtn").click()],
];
function openPalette(){
  let w = document.getElementById("palWrap");
  if(w){ w.remove(); return; }
  w = document.createElement("div");
  w.id = "palWrap";
  w.innerHTML = '<div id="pal"><input id="palIn" placeholder="Type a player or command…" aria-label="Command palette"><div id="palList"></div></div>';
  document.body.appendChild(w);
  w.addEventListener("click", e=>{ if(e.target===w) w.remove(); });
  const inp = document.getElementById("palIn"), list = document.getElementById("palList");
  let sel = 0, items = [];
  const draw = ()=>{
    const q2 = inp.value.trim();
    const acts = PALETTE_ACTIONS.filter(a=>!q2 || a[0].toLowerCase().includes(q2.toLowerCase())).slice(0,4)
      .map(a=>({label:a[0], run:a[1], kind:"act"}));
    const ps = q2.length>=2 ? allPlayers().filter(p=>matchesQuery(p,q2)).slice(0,7)
      .map(p=>({label:p.name+" · "+p.pos+" "+p.team+(offBoard(p.id)?" · off board":""), p, kind:"player"})) : [];
    items = acts.concat(ps);
    sel = Math.min(sel, Math.max(0, items.length-1));
    list.innerHTML = items.map((it,i)=>'<div class="palrow'+(i===sel?" on":"")+'" data-pi="'+i+'">'+
      (it.kind==="player" ? avatarImg(it.p,20)+" " : "")+esc(it.label)+
      (it.kind==="player" ? '<span class="palbtns"><button data-pick="'+it.p.id+'">✓</button><button data-take="'+it.p.id+'">✕</button></span>' : "")+
      '</div>').join("") || '<div class="palrow dimtxt">No matches</div>';
  };
  const runSel = ()=>{
    const it = items[sel]; if(!it) return;
    w.remove();
    if(it.kind==="act") it.run(); else openCard(it.p.id);
  };
  inp.addEventListener("input", ()=>{ sel=0; draw(); });
  inp.addEventListener("keydown", e=>{
    if(e.key==="ArrowDown"){ e.preventDefault(); sel=Math.min(sel+1, items.length-1); draw(); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); sel=Math.max(sel-1,0); draw(); }
    else if(e.key==="Enter"){ e.preventDefault(); runSel(); }
    else if(e.key==="Escape"){ w.remove(); }
  });
  list.addEventListener("click", e=>{
    const b = e.target.closest("[data-pick],[data-take]");
    if(b){ w.remove(); return; }   // delegated global handler does the action
    const r = e.target.closest("[data-pi]");
    if(r){ sel = +r.dataset.pi; runSel(); }
  });
  draw();
  inp.focus();
}

/* Hover mini-card preview (#225) */
let _hovT = null;
document.addEventListener("mouseover", e=>{
  const cell = e.target.closest && e.target.closest(".pcell[data-card]");
  const hc = document.getElementById("hoverCard");
  if(!cell){ if(hc && !e.target.closest("#hoverCard")) hc.remove(); clearTimeout(_hovT); return; }
  clearTimeout(_hovT);
  _hovT = setTimeout(()=>{
    const p = idIndex()[cell.dataset.card]; if(!p) return;
    let el = document.getElementById("hoverCard");
    if(!el){ el = document.createElement("div"); el.id = "hoverCard"; document.body.appendChild(el); }
    const h3 = hist3For(p), hw = hometownOf(p), ci = collegeInfo(p);
    el.innerHTML = '<div style="display:flex;gap:10px;align-items:center">'+avatarImg(p,44)+
      '<div><b>'+esc(p.name)+'</b> '+(isFav(p)?"💖":"")+'<br><span class="dimtxt">'+p.pos+' '+p.team+
      (ci?' · '+esc(ci.name):'')+(hw&&hw.st?' · '+hw.st:'')+'</span></div></div>'+
      (h3.length?'<div class="dimtxt" style="margin-top:6px">'+h3.map(x=>x[0]+": <b>"+Math.round(x[2])+"</b>"+(x[3]?" ("+p.pos+x[3]+")":"")).join(" · ")+'</div>':'')+
      '<div class="dimtxt" style="margin-top:4px">proj <b style="color:var(--green)">'+p.proj+'</b> · ADP '+(p.adp||"—")+'</div>';
    const r2 = cell.getBoundingClientRect();
    el.style.left = Math.min(r2.left, innerWidth-300)+"px";
    el.style.top = (r2.bottom+6)+"px";
  }, 350);
});

/* Right-click context menu on pool rows */
document.addEventListener("contextmenu", e=>{
  const tr = e.target.closest("#poolBody tr[data-pid]");
  const old = document.getElementById("ctxMenu");
  if(old) old.remove();
  if(!tr) return;
  e.preventDefault();
  const id = tr.dataset.pid;
  const m = document.createElement("div");
  m.id = "ctxMenu";
  m.innerHTML = ['<button data-pick="'+id+'">✓ Mine</button>',
    '<button data-take="'+id+'">✕ Taken</button>',
    '<button data-queue="'+id+'">'+(S.queue.includes(id)?"★ Unqueue":"☆ Queue")+'</button>',
    '<button data-dnd="'+id+'">🚫 Never</button>',
    '<button data-note="'+id+'">📝 Note</button>',
    '<button data-card="'+id+'">👤 Card</button>'].join("");
  m.style.left = Math.min(e.clientX, innerWidth-160)+"px";
  m.style.top = Math.min(e.clientY, innerHeight-220)+"px";
  document.body.appendChild(m);
});
document.addEventListener("click", ()=>{ const m=document.getElementById("ctxMenu"); if(m) m.remove(); }, true);

/* Keyboard drafting: arrows move the highlight, M = my pick, T/X = taken */
let kbSel = -1;
function applyKbSel(){
  const trs = document.querySelectorAll("#poolBody tr[data-pid]");
  trs.forEach((tr,i)=>{ tr.classList.toggle("kbsel", i===kbSel); if(i===kbSel) tr.setAttribute("aria-selected","true"); else tr.removeAttribute("aria-selected"); });
  if(kbSel>=0 && trs[kbSel]) trs[kbSel].scrollIntoView({block:"nearest"});
}

function renderBest(){
  const {scored} = scoreBoard();
  const rinfo = roundInfo(allPlayers());
  const odds = survivalOdds();
  const hz = nextPickHorizon();
  const top = scored[0];
  const hero = $("#hero");
  const doneN = myIds().length;
  if(doneN >= S.settings.roster && doneN > 0){
    const byIdH = idIndex();
    const bsH = bestStarters(myIds(), byIdH);
    const hurtN = myIds().map(id=>byIdH[id]).filter(Boolean).filter(p2=>injuryOf(p2)).length;
    const st = quickStandings();
    const myRank = st.rows.findIndex(r=>r.s===st.mySlot)+1;
    const kick = new Date((S.settings.seasonStart||"2026-09-10")+"T20:20");
    const kd = Math.ceil((kick.getTime()-Date.now())/86400000);
    hero.innerHTML = '<div class="toppick">'+
      '<div class="tag">🏟 SEASON HQ'+(kd>0?' · 🏈 kickoff in '+kd+'d':'')+'</div>'+
      '<div class="name">'+esc(S.settings.flair||slotName(S.settings.slot))+'</div>'+
      '<div class="meta">Draft complete · optimal starters <b class="mono" style="color:var(--green)">'+fmt(bsH.pts)+'</b> · projected <b>'+ordinal(myRank)+'</b> of '+st.rows.length+
      (hurtN?' · 🩹 '+hurtN+' with injury flags':' · roster healthy ✓')+'</div>'+
      '<div class="actions">'+
        '<button class="hbtn" onclick="document.getElementById(\'gradeBtn\').click()">🎓 Report</button>'+
        '<button class="hbtn" onclick="document.getElementById(\'injBtn\').click()">🩺 Injuries</button>'+
        '<button class="hbtn" onclick="document.getElementById(\'recapBtn\').click()">📤 Share</button>'+
        '<button class="hbtn" id="weekRecapBtn">📅 Week recap</button>'+
        '<button class="hbtn" id="healthDigestBtn">🩹 Health digest</button>'+
      '</div></div>';
    // waiver radar: hot adds that nobody in this league rosters
    const rostered = new Set();
    Object.values(teamRosters()).forEach(ids=>ids.forEach(id2=>rostered.add(id2)));
    myIds().forEach(id2=>rostered.add(id2));
    const radar = allPlayers()
      .filter(p2=>!rostered.has(p2.id) && buzzOf(p2)>500)
      .sort((a,b)=>buzzOf(b)-buzzOf(a)).slice(0,5);
    // my-player headlines
    const myNews = myIds().map(id2=>byIdH[id2]).filter(Boolean)
      .map(p2=>({p:p2, n:newsFor(p2)})).filter(x=>x.n).slice(0,4);
    // drop candidates + IR stashes
    const bench2 = myIds().filter(id2=>!bsH.starterIds.has(id2)).map(id2=>byIdH[id2]).filter(Boolean);
    const drops = bench2.slice().sort((a,b)=>a.proj-b.proj).slice(0,2);
    const irs = myIds().map(id2=>byIdH[id2]).filter(Boolean)
      .filter(p2=>{ const e2=injuryOf(p2); return e2 && injSeverity(e2.s).code==="IR"; });
    let hq = "";
    if(radar.length) hq += '<div class="benchhead">📡 Waiver radar (unrostered, trending)</div>'+
      radar.map(p2=>'<div class="barow" data-card="'+p2.id+'">'+avatarImg(p2,22)+posBadge(p2.pos)+
        '<div class="info"><div class="nm">'+p2.name+'</div><div class="sm">📈 '+buzzOf(p2).toLocaleString()+' adds/24h</div></div></div>').join("");
    if(myNews.length) hq += '<div class="benchhead">📰 Your players in the news</div>'+
      myNews.map(x=>'<div class="barow" data-card="'+x.p.id+'">'+avatarImg(x.p,22)+
        '<div class="info"><div class="nm" style="font-size:11.5px">'+esc(x.n.h.slice(0,70))+'</div><div class="sm">'+esc(x.p.name)+' · '+x.n.d+'</div></div></div>').join("");
    if(irs.length) hq += '<div class="benchhead">🏥 IR-eligible (league has 3 IR slots)</div>'+
      irs.map(p2=>'<div class="barow" data-card="'+p2.id+'">'+avatarImg(p2,22)+'<div class="info"><div class="nm">'+p2.name+'</div><div class="sm">stash him, open a bench spot</div></div></div>').join("");
    if(drops.length) hq += '<div class="benchhead">🪓 Thinnest bench spots</div>'+
      drops.map(p2=>'<div class="barow" data-card="'+p2.id+'">'+avatarImg(p2,22)+'<div class="info"><div class="nm">'+p2.name+'</div><div class="sm mono">'+p2.proj+' proj</div></div></div>').join("");
    hq += '<div class="benchhead">League rosters</div><div class="scarce">'+
      Array.from({length:S.settings.teams},(_,i2)=>i2+1).map(s2=>'<span class="scpill" data-teampage="'+s2+'" style="cursor:pointer">'+esc(slotName(s2))+'</span>').join("")+'</div>';
    $("#baList").innerHTML = hq;
    document.title = "Draft War Room — 2QB";
    updatePanic(null, null);
    return;
  }
  if(!top){ hero.innerHTML = '<div class="empty">Board is empty — nice draft!</div>'; $("#baList").innerHTML=""; return; }
  const p = top.p;
  const why = top.why.length ? "▸ " + top.why.join("<br>▸ ") : "▸ best raw value on the board";
  const h = nextPickHorizon();
  let pickline = "";
  if(h){
    pickline = '<div class="pickline'+(h.onClock?' onclock':'')+'" data-picksync="1" title="Click to correct the current overall pick if the board drifted" style="cursor:pointer">Pick <b class="mono">#'+h.cur+'</b> on the clock'+
      (h.onClock ? ' — <b style="color:var(--green)">THAT\'S YOU, DRAFT NOW</b>' : '') +
      ' · your next: <b class="mono">#'+h.mine0+'</b>'+(h.mine1?' then <b class="mono">#'+h.mine1+'</b>':'')+
      (!h.onClock?' · <button class="undo1" data-simto="1" title="Let the engine make every CPU pick until your turn">⏩ sim to my pick</button>':'')+
      (S.ui.live?' · <button class="undo1" data-horn="1" title="Airhorn">📢</button><button class="undo1" data-siren="1" title="Steal siren">🚨</button>':'')+'</div>';
  }
  if(h && h.onClock && S.plan){
    const rNow2 = Math.ceil(h.cur/S.settings.teams);
    const planned = idIndex()[S.plan[rNow2]];
    if(planned && !offBoard(planned.id)){
      pickline += '<div class="pickline onclock" style="margin-top:-4px">📌 Your R'+rNow2+' plan is on the board: <b>'+esc(planned.name)+'</b> <button class="pick" data-pick="'+planned.id+'" style="margin-left:6px">✓ TAKE HIM</button></div>';
    }
  }
  const pred = predictNextPicks();
  if(pred){
    pickline += '<div class="pickline" style="margin-top:-4px;font-size:10.5px">🔮 '+esc(slotName(pred.slot))+' likely takes: '+
      pred.cand.map(x=>'<b>'+esc(x.p.name.split(" ").slice(-1)[0])+'</b> ('+x.p.pos+')').join(" or ")+'</div>';
  }
  document.title = (h && h.onClock ? "🟢 YOUR PICK — " : "") + "Draft War Room — 2QB";
  if(h && h.onClock && !window._wasOnClock && S.ui.live) chime();
  window._wasOnClock = !!(h && h.onClock);
  if(navigator.setAppBadge){
    try{
      if(S.ui.live && h && !h.onClock) navigator.setAppBadge(Math.max(1, h.mine0-h.cur));
      else if(navigator.clearAppBadge) navigator.clearAppBadge();
    }catch(e){}
  }
  updatePanic(h, top);
  if(S.ui.live && h && h.onClock && S.settings.timerSecs){
    if(!window._clockT0) window._clockT0 = Date.now();
    const left2 = Math.max(0, S.settings.timerSecs - (Date.now()-window._clockT0)/1000);
    pickline += '<div class="pickline'+(left2<=30?' onclock':'')+'" style="margin-top:-4px">⏲ <b class="mono" style="font-size:14px;color:'+(left2<=30?'var(--red)':'var(--text)')+'">'+Math.floor(left2/60)+':'+String(Math.floor(left2%60)).padStart(2,"0")+'</b> on your clock</div>';
    if(left2<=30 && !window._clockWarned){ window._clockWarned = true; chime(); toast("⏲ 30 seconds!", {warn:true}); }
  }
  if(h && !h.onClock){ window._clockT0 = 0; window._clockWarned = false; }
  if(S.ui.live && h && S.ui.liveStart){
    const el = (Date.now()-S.ui.liveStart-(S.ui.hiddenMs||0))/1000;
    const made = Math.max(0, S.log.length-(S.ui.liveLen0||0));
    const pace = made>2 ? el/made : 0;
    const left = S.settings.teams*S.settings.roster - h.cur + 1;
    const eta = pace ? new Date(Date.now()+left*pace*1000).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : "—";
    pickline += '<div class="pickline" style="margin-top:-4px">⏱ <b class="mono">'+Math.floor(el/60)+'m</b> · '+made+' picks · '+(pace?Math.round(pace)+'s/pick · draft ends ~<b class="mono">'+eta+'</b>':'measuring pace…')+'</div>';
  }
  // Startable players (VORP > 0) left per position
  const scLeft = {}; POSITIONS.forEach(pos=>scLeft[pos]=0);
  scored.forEach(s=>{ if(s.vorp>0) scLeft[s.p.pos]++; });
  const scarce = '<div class="scarce">'+POSITIONS.map(pos=>{
    const g = odds && odds.posGone ? odds.posGone[pos] : 0;
    const runRisk = g>=2.5 && scLeft[pos]<=6;
    return '<span class="scpill'+(scLeft[pos]<=3?' dry':'')+'" title="Available '+pos+'s above replacement'+(g?'; sims expect ~'+g+' more gone before your pick #'+odds.at1:'')+(runRisk?'; RUN RISK':'')+'">'+
      pos+' <b>'+scLeft[pos]+'</b>'+(g>=1?' <span style="color:var(--red)">−'+Math.round(g)+'</span>':'')+(runRisk?' <b style="color:var(--red)">🔥</b>':'')+'</span>';
  }).join("")+'</div>';
  // If you take him: engine's projected plan for your next picks
  const plan = cached("plan", ()=>{
    S.mine.push(p.id); S.log.push({id:p.id, who:"me"});
    const saveMemo = _memo; _memo = {key:null};
    let m;
    try{ m = runMock(STRATS[0], 424243); } finally {
      S.log.pop(); S.mine.pop(); _memo = saveMemo;
    }
    return m.picks.slice(0,3).map(pk=>pk.round+"."+String(pk.idx).padStart(2,"0")+" "+pk.p.name+" ("+pk.p.pos+")");
  });
  const heroGain = S.mine.length ? Math.max(0, Math.round(bestStarters(S.mine.concat([p.id]), idIndex()).pts - bestStarters(S.mine, idIndex()).pts)) : 0;
  // VONA: cost of waiting at the top pick's position
  let vona = "";
  if(odds && odds.h1){
    const alt = scored.find(s=>s!==top && s.p.pos===p.pos && odds.h1[s.p.id]!=null && odds.h1[s.p.id]>=60);
    if(alt){
      const cost = Math.round(top.vorp - alt.vorp);
      if(cost>0) vona = '<div class="planline">⏭ waiting at '+p.pos+' costs ~<b style="color:'+(cost>40?'var(--red)':'var(--gold)')+'">'+cost+' pts</b> — likely still there: '+esc(alt.p.name)+' ('+odds.h1[alt.p.id]+'%)</div>';
    }
  }
  const freshTop = window._lastTopId !== p.id;
  window._lastTopId = p.id;
  // Elite shelf: T1/T2 supply per position
  const tmB = tierMap(allPlayers());
  const shelf = {};
  scored.forEach(s=>{ const tr2=tmB[s.p.id]; if(tr2<=2) shelf[s.p.pos]=(shelf[s.p.pos]||0)+1; });
  const shelfLine = '<div class="scarce" style="margin-top:-4px" title="Players left in Tier 1–2 at each position">🏔 elite shelf: '+
    POSITIONS.map(pos=>'<span class="scpill'+((shelf[pos]||0)===0?' dry':'')+'">'+pos+' <b>'+(shelf[pos]||0)+'</b></span>').join("")+'</div>';
  // Momentum: last five picks
  let momentum = "";
  const last5 = S.log.slice(-5);
  if(last5.length===5){
    const byIdM = idIndex(), mc = {};
    last5.forEach(e2=>{ const pp=byIdM[e2.id]; if(pp) mc[pp.pos]=(mc[pp.pos]||0)+1; });
    const hot = Object.entries(mc).sort((a,b)=>b[1]-a[1])[0];
    momentum = '<div class="scarce" style="margin-top:-4px;font-size:10px;color:var(--dim)">〰 last 5 picks: '+
      Object.entries(mc).map(([k,v])=>k+"×"+v).join(" · ")+(hot[1]>=3?' — <b style="color:var(--gold)">'+hot[0]+' heating</b>':'')+'</div>';
  }
  // Threats: what teams picking before my next turn still need
  let threats = "";
  if(h && h.next > h.cur){
    const ros = teamRosters(), byIdT = idIndex(), t2 = S.settings.teams;
    const myPicksSet = new Set(myOverallPicks());
    const needBy = {QB:new Set(), RB:new Set(), WR:new Set(), TE:new Set(), DEF:new Set()};
    for(let pk=h.cur; pk<h.next; pk++){
      if(myPicksSet.has(pk)) continue;
      const r2 = Math.ceil(pk/t2), idx2 = pk-(r2-1)*t2, slot2 = (r2%2===1)?idx2:t2+1-idx2;
      const c = {QB:0,RB:0,WR:0,TE:0,DEF:0};
      (ros[slot2]||[]).forEach(id2=>{ const pp=byIdT[id2]; if(pp) c[pp.pos]++; });
      if(c.QB<2) needBy.QB.add(slot2); if(c.RB<2) needBy.RB.add(slot2);
      if(c.WR<2) needBy.WR.add(slot2); if(c.TE<1) needBy.TE.add(slot2); if(c.DEF<1) needBy.DEF.add(slot2);
    }
    const parts = POSITIONS.map(pos=>{
      const n = needBy[pos].size;
      return n ? '<span class="scpill" title="'+esc([...needBy[pos]].map(slotName).join(", "))+'" style="cursor:help">'+pos+'-needy <b'+(n>=3?' style="color:var(--red)"':'')+'>'+n+'</b></span>' : "";
    }).filter(Boolean);
    if(parts.length && S.log.length>=S.settings.teams)
      threats = '<div class="scarce" style="margin-top:-4px">🎯 before your #'+h.next+': '+parts.join("")+'</div>';
  }
  hero.innerHTML = pickline + scarce + shelfLine + momentum + threats +
    '<div class="toppick'+(freshTop?' fresh':'')+'">'+
      '<div class="tag">⭐ Top Pick Right Now'+((()=>{const e=injuryOf(p); if(!e) return ""; const sv=injSeverity(e.s); return ' &nbsp;<span class="sevchip '+sv.cls+'">🩹 '+esc(sv.code==="?"?e.s:sv.label)+'</span>';})())+'</div>'+
      '<div class="heroline" data-card="'+p.id+'" title="Open player card">'+avatarImg(p,56)+'<div><div class="name">'+p.name+'</div>'+
      '<div class="meta">'+posBadge(p.pos)+' &nbsp;'+p.team+' &nbsp;·&nbsp; <span class="mono">'+p.proj+' proj</span> &nbsp;·&nbsp; <span class="mono" style="color:var(--green)">+'+Math.round(top.vorp)+' vs replacement</span>'+(heroGain?' &nbsp;·&nbsp; <span class="mono ok">+'+heroGain+' lineup</span>':'')+(rinfo[p.id]&&!rinfo[p.id].ud?' &nbsp;·&nbsp; <span class="rd">'+rinfo[p.id].label+'</span>':'')+(odds&&odds.h1[p.id]!=null?' &nbsp;·&nbsp; <b class="'+oddsClass(odds.h1[p.id])+'" title="Simulated survival odds at your next two picks (30 sims, ±9% at mid-range)">'+odds.h1[p.id]+'% at #'+odds.at1+(odds.h2?' · '+odds.h2[p.id]+'% at #'+odds.at2:'')+'</b>':'')+'</div></div></div>'+
      '<div class="why">'+why+'</div>'+
      vona +
      (plan.length?'<div class="planline" title="Continuation sim: what the engine would do with your following picks">▸ then likely: '+plan.join(" · ")+'</div>':'')+
      '<div class="actions">'+
        '<button class="pick" data-pick="'+p.id+'">✓ DRAFT HIM</button>'+
        '<button class="kill" data-take="'+p.id+'">✕ someone took him</button>'+
      '</div>'+
    '</div>';
  const bl = document.querySelector(".balist"); const blScroll = bl ? bl.scrollTop : 0;
  const byIdL = idIndex();
  const baseLineup = S.mine.length ? bestStarters(S.mine, byIdL).pts : 0;
  const lineupGain = pp => {
    const g = bestStarters(S.mine.concat([pp.id]), byIdL).pts - baseLineup;
    return g > 0.5 ? Math.round(g) : 0;
  };
  $("#baList").innerHTML = scored.slice(1, 1+(S.settings.baCount||15)).map((s,i)=>
    '<div class="barow" data-card="'+s.p.id+'">'+
      '<div class="rk mono">'+(i+2)+'</div>'+
      avatarImg(s.p,26)+
      posBadge(s.p.pos)+
      '<div class="info"><div class="nm">'+s.p.name+intelBadges(s.p)+(s.stack?'<span class="stackchip">🔗</span>':'')+(s.steal?' 💎':'')+(s.backRisk==="gone"?' 🔥':s.backRisk==="risky"?' ⏳':'')+'</div>'+
      '<div class="sm">'+s.p.team+' · '+s.p.proj+' pts'+(s.p.adp?' · ADP '+s.p.adp:'')+(odds&&odds.h1[s.p.id]!=null?' · <b class="'+oddsClass(odds.h1[s.p.id])+'">'+odds.h1[s.p.id]+'% back</b>':'')+(lineupGain(s.p)?' · <b class="ok">+'+lineupGain(s.p)+' lineup</b>':'')+'</div></div>'+
      '<div class="val mono">+'+Math.round(s.vorp)+'</div>'+
      '<button class="pick" data-pick="'+s.p.id+'">✓</button>'+
      '<button class="kill" data-take="'+s.p.id+'">✕</button>'+
      '<button class="undo1" data-queue="'+s.p.id+'" title="Queue">'+(S.queue.includes(s.p.id)?"★":"☆")+'</button>'+
    '</div>'
  ).join("");
  // Stack opportunities: available partners for YOUR QBs / pass-catchers
  const stacks = scored.filter(s=>s.stack).slice(0,4);
  if(stacks.length){
    const byId2 = idIndex();
    const partnerOf = sp => {
      const mates = S.mine.map(id=>byId2[id]).filter(Boolean).filter(m=>m.team===sp.team &&
        ((sp.pos==="QB" && (m.pos==="WR"||m.pos==="TE")) || ((sp.pos==="WR"||sp.pos==="TE") && m.pos==="QB")));
      return mates.length ? mates[0].name.split(" ").slice(-1)[0] : "";
    };
    $("#baList").innerHTML += '<div class="benchhead" style="border-top:1px solid var(--line);margin-top:8px">🔗 Stack opportunities</div>' +
      stacks.map(s=>'<div class="barow stackrow" data-card="'+s.p.id+'">'+
        avatarImg(s.p,26)+posBadge(s.p.pos)+
        '<div class="info"><div class="nm">'+s.p.name+' <span class="stackchip">🔗 '+esc(partnerOf(s.p))+'</span></div>'+
        '<div class="sm">'+(logoUrl(s.p.team)?'<img class="tlogo" src="'+logoUrl(s.p.team)+'" width="12" height="12" alt=""> ':'')+s.p.team+' · '+s.p.proj+' pts'+(odds&&odds.h1[s.p.id]!=null?' · <b class="'+oddsClass(odds.h1[s.p.id])+'">'+odds.h1[s.p.id]+'% back</b>':'')+'</div></div>'+
        '<div class="val mono">+'+Math.round(s.vorp)+'</div>'+
        '<button class="pick" data-pick="'+s.p.id+'">✓</button></div>').join("");
    // shout when the turn is coming and a stack is at risk
    const risky = stacks.find(s=>odds && odds.h1[s.p.id]!=null && odds.h1[s.p.id]<50);
    if(risky) $("#baList").innerHTML = '<div class="warn" style="border-radius:9px;margin:4px 2px 8px">🔗 <b>'+risky.p.name+'</b> stacks with your roster and is only <b>'+odds.h1[risky.p.id]+'%</b> to last until #'+odds.at1+'.</div>' + $("#baList").innerHTML;
  }
  // Best available at each position
  const bypos = {};
  for(const s of scored){ if(!bypos[s.p.pos]) bypos[s.p.pos] = s; }
  $("#baList").innerHTML += '<div class="benchhead" style="border-top:1px solid var(--line);margin-top:8px">Best at position</div>' +
    POSITIONS.map(pos=>{
      const s = bypos[pos];
      if(!s) return '<div class="barow"><div class="rk"></div>'+posBadge(pos)+'<div class="info"><div class="sm">— none left</div></div></div>';
      const stash = pos==="QB" && myCounts().QB>=2
        ? (()=>{ const st2 = scored.filter(x=>x.p.pos==="QB" && x.p.adp>100).slice(0,1)[0];
                 return st2 ? ' · stash: '+esc(st2.p.name.split(" ").slice(-1)[0]) : ""; })()
        : "";
      return '<div class="barow"><div class="rk"></div>'+posBadge(pos)+
        '<div class="info"><div class="nm">'+s.p.name+'</div><div class="sm">'+s.p.proj+' pts'+stash+(odds&&odds.h1[s.p.id]!=null?' · <b class="'+oddsClass(odds.h1[s.p.id])+'">'+odds.h1[s.p.id]+'%</b>':'')+'</div></div>'+
        '<div class="val mono">'+(s.vorp>0?"+":"")+Math.round(s.vorp)+'</div>'+
        '<button class="pick" data-pick="'+s.p.id+'">✓</button>'+
        '<button class="kill" data-take="'+s.p.id+'">✕</button></div>';
    }).join("");
  if(bl) bl.scrollTop = blScroll;
}

function renderRoster(){
  const {counts, needs, totalNeeded, picksLeft} = needInfo();
  const min = S.settings.min;
  const byId = idIndex();

  $("#rosCount").textContent = S.mine.length + " / " + S.settings.roster;

  $("#reqBar").innerHTML = POSITIONS.filter(pos=>min[pos]>0 || counts[pos]>0).map(pos=>{
    const have=counts[pos], need=min[pos]||0;
    let pips="";
    for(let i=0;i<Math.max(need,have);i++){
      pips += '<span class="pip '+(i<Math.min(have,need)?"full":(i<have?"extra":""))+'"></span>';
    }
    return '<div class="reqrow"><span class="lbl" style="color:var(--'+pos.toLowerCase()+')">'+pos+'</span>'+
      '<div class="pips">'+pips+'</div><span class="cnt mono">'+have+' / '+need+'</span></div>';
  }).join("");

  const warn = $("#warnBox");
  if(picksLeft===0){
    warn.innerHTML = '<div class="warn">Roster full. Good luck this season! 🏆</div>';
    if(!window._celebrated && S.mine.length >= S.settings.roster){
      window._celebrated = true;
      confetti();
      try{
        const all = profAll();
        const nm = "🏁 "+(S.settings.name||"Draft")+" "+new Date().getFullYear()+" final";
        if(!all[nm]){ all[nm] = JSON.parse(JSON.stringify(S)); localStorage.setItem(PROF_KEY, JSON.stringify(all)); }
      }catch(e){}
      setTimeout(buildReport, 900);
    }
  } else if(totalNeeded > picksLeft){
    warn.innerHTML = '<div class="warn crit">⚠️ You owe '+totalNeeded+' required starters but only have '+picksLeft+' picks left. Fill requirements NOW.</div>';
  } else if(totalNeeded === picksLeft && totalNeeded>0){
    warn.innerHTML = '<div class="warn crit">🔒 Every remaining pick must fill a requirement ('+Object.entries(needs).filter(([,v])=>v>0).map(([k,v])=>v+" "+k).join(", ")+'). Recommendations are locked to those.</div>';
  } else if(totalNeeded>0){
    warn.innerHTML = '<div class="warn">Still required: '+Object.entries(needs).filter(([,v])=>v>0).map(([k,v])=>v+" "+k).join(", ")+' · '+picksLeft+' picks left ('+(picksLeft-totalNeeded)+' flex).</div>';
  } else {
    warn.innerHTML = '<div class="warn" style="color:var(--green)">✓ All requirements met — draft best value / upside.</div>';
  }

  let bs = null;
  const mineAll = myIds();
  if(!mineAll.length){
    $("#myRoster").innerHTML = '<div class="empty">No picks yet.<br>Hit <b style="color:var(--green)">✓ MINE</b> on a player when you draft them.</div>';
  } else {
    bs = bestStarters(mineAll, byId);
    const orderOf = {}; S.mine.forEach((id,i)=>orderOf[id]=i+1);
    myKeeperIds().forEach(id=>orderOf[id]="K");
    const posBase = (()=>{
      const players2 = allPlayers(), t2 = S.settings.teams;
      const starters = {QB:t2*2, RB:t2*2.5, WR:t2*2.5, TE:t2, DEF:t2};
      const b = {};
      POSITIONS.forEach(pos=>{
        const list2 = players2.filter(x=>x.pos===pos).sort((a,b)=>b.proj-a.proj).slice(0, Math.round(starters[pos]));
        b[pos] = list2.length ? list2.reduce((a,x)=>a+x.proj,0)/list2.length : 0;
      });
      return b;
    })();
    const rowFor = (p, lab) => '<div class="myp"><span class="slotlab">'+lab+'</span>'+avatarImg(p,22)+posBadge(p.pos)+((()=>{const e=injuryOf(p); if(!e) return ""; const sv=injSeverity(e.s); return '<span class="ib '+sv.cls+'" title="'+esc(sv.label+(e.c?" — "+e.c:""))+'">●</span>';})())+
      '<div class="n">'+p.name+' <span class="t">'+(logoUrl(p.team)?'<img class="tlogo" src="'+logoUrl(p.team)+'" width="12" height="12" loading="lazy" alt=""> ':'')+p.team+' · <span class="mono">'+p.proj+'</span></span></div>'+
      (function(){const d3=Math.round(p.proj-posBase[p.pos]); return '<span class="mono" style="font-size:9.5px;color:'+(d3>=0?'var(--green)':'var(--red)')+'" title="vs average starter at position">'+(d3>0?'+':'')+d3+'</span>';})()+
      '<span class="t mono">'+(orderOf[p.id]==="K"?"👑":"R"+orderOf[p.id])+'</span>'+
      '<span class="x" data-drop="'+p.id+'" role="button" tabindex="0" aria-label="Remove '+esc(p.name)+' from my roster" title="Remove from my roster">✕</span></div>';
    let html = bs.line.map(sl => sl.p ? rowFor(sl.p, sl.lab) :
      '<div class="myp" style="opacity:.45"><span class="slotlab">'+sl.lab+'</span><span class="t">— open</span></div>').join("");
    const bench = mineAll.filter(id=>!bs.starterIds.has(id)).map(id=>byId[id]).filter(Boolean);
    if(bench.length) html += '<div class="benchhead">Bench</div>' + bench.map(p=>rowFor(p,"BN")).join("");
    $("#myRoster").innerHTML = html;
  }

  // Stacks summary
  const teams={};
  for(const id of S.mine){ const p=byId[id]; if(!p) continue; (teams[p.team]=teams[p.team]||[]).push(p); }
  const stacks = Object.entries(teams).filter(([,ps])=>ps.length>1 && ps.some(x=>x.pos==="QB") && ps.some(x=>x.pos==="WR"||x.pos==="TE"));
  const multis = Object.entries(teams).filter(([,ps])=>ps.length>1);
  let html="";
  if(stacks.length) html += "🔗 <b>Live stacks:</b> " + stacks.map(([t,ps])=>t+" ("+ps.map(x=>x.name.split(" ").pop()).join(" + ")+")").join(" · ");
  else if(multis.length) html += "Same-team pairs: " + multis.map(([t,ps])=>t+" ×"+ps.length).join(" · ");
  else if(S.mine.length) html += "No stacks yet — pairing a WR/TE with your QB adds a boost to recommendations.";
  $("#stackBox").innerHTML = html;

  const total = S.mine.reduce((a,id)=>a+((byId[id]||{}).proj||0),0);
  if(S.mine.length) $("#stackBox").innerHTML += '<br>Starters proj: <b class="mono">'+Math.round(bs?bs.pts:0)+'</b> · full roster: <span class="mono">'+Math.round(total)+'</span>';

  // FLEX advice late
  if(bs && picksLeft>0 && picksLeft<=5){
    const flexSlot = bs.line.find(sl=>sl.lab==="FLEX");
    if(flexSlot && !flexSlot.p){
      const bestFlex = scoreBoard().scored.find(s=>["RB","WR","TE"].includes(s.p.pos));
      if(bestFlex) warn.innerHTML += '<div class="warn">🎯 Your FLEX is open — best fit now: <b>'+esc(bestFlex.p.name)+'</b> ('+bestFlex.p.pos+', +'+Math.round(bestFlex.vorp)+')</div>';
    }
  }
  // Superflex musical chairs
  {
    const ros2 = teamRosters(), t2 = S.settings.teams;
    let needQb = 0;
    for(let s2=1;s2<=t2;s2++){
      const ids2 = s2===Math.min(S.settings.slot,t2) ? myIds() : ros2[s2];
      const qb2 = ids2.map(id2=>byId[id2]).filter(Boolean).filter(p2=>p2.pos==="QB").length;
      if(qb2<2) needQb++;
    }
    const seats = allPlayers().filter(p2=>p2.pos==="QB" && !offBoard(p2.id) && !S.dnd[p2.id] && (p2.proj-(replacementLevels(allPlayers()).QB||0))>0).length;
    if(needQb>0 && seats <= needQb && counts.QB<2 && picksLeft>0){
      warn.innerHTML += '<div class="warn crit">🎵 Musical chairs: <b>'+needQb+'</b> teams (incl. you) still need a QB2 and only <b>'+seats+'</b> startable QBs remain.</div>';
    }
  }
  // My roster health warning
  const hurtMine = S.mine.map(id=>byId[id]).filter(Boolean).filter(p=>badInjury(p));
  if(hurtMine.length){
    warn.innerHTML += '<div class="warn crit">🩹 On your roster: '+hurtMine.map(p=>'<b>'+esc(p.name)+'</b> ('+esc(badInjury(p))+')').join(", ")+'</div>';
  }
  // Handcuff finder for my RBs
  {
    const myRbs = myIds().map(id2=>byId[id2]).filter(Boolean).filter(p2=>p2.pos==="RB");
    if(myRbs.length){
      const avail2 = allPlayers().filter(p2=>p2.pos==="RB" && !offBoard(p2.id));
      const cuffs = [];
      myRbs.forEach(rb=>{
        const c2 = avail2.filter(p2=>p2.team===rb.team).sort((a,b)=>b.proj-a.proj)[0];
        if(c2) cuffs.push(rb.name.split(" ").slice(-1)[0]+" → <b data-card=\""+c2.id+"\" style=\"cursor:pointer\">"+esc(c2.name)+"</b>");
      });
      if(cuffs.length) $("#stackBox").innerHTML += '<br>🔗 Handcuffs available: '+cuffs.join(" · ");
    }
  }
  // Positional run detector — 4+ of the last 10 picks at one position
  const recent = S.log.slice(-10);
  const rc = {};
  recent.forEach(e=>{ const p=byId[e.id]; if(p) rc[p.pos]=(rc[p.pos]||0)+1; });
  const runs = Object.entries(rc).filter(([pos,v])=>v>=4 && pos!=="DEF");
  if(runs.length && picksLeft>0 && recent.length>=6){
    warn.innerHTML += '<div class="warn crit">🚨 '+runs.map(([pos,v])=>'<b>'+pos+' RUN</b> — '+v+' of the last '+recent.length+' picks').join(' · ')+'. If you need one, move now.</div>';
  }
}

let logMineOnly = false;
function undoLastN(n){ for(let i=0;i<n;i++) undoLast(); }
function exportLogCsv(){
  const byId = idIndex(), t = S.settings.teams;
  let csv = "Pick,Round,Team,Player,Pos,NFLTeam,Who,Time\n";
  S.log.forEach((e,i)=>{
    const p = byId[e.id]; if(!p) return;
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), idx = n-(r-1)*t;
    const slot = (r%2===1)?idx:t+1-idx;
    csv += [n, r+"."+String(idx).padStart(2,"0"), '"'+slotName(slot).replace(/"/g,'""')+'"', '"'+p.name.replace(/"/g,'""')+'"', p.pos, p.team, e.who, e.t?new Date(e.t).toISOString():""].join(",")+"\n";
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = "draft-log.csv"; a.click(); URL.revokeObjectURL(a.href);
}
function renderLog(){
  const byId = idIndex();
  const t = S.settings.teams;
  const players = allPlayers(), repl = replacementLevels(players);
  $("#logList").innerHTML = S.log.length ? S.log.map((e,i)=>{
    const p = byId[e.id]; if(!p) return "";
    if(logMineOnly && e.who!=="me") return "";
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), ri = n-(r-1)*t;
    return '<div class="logrow"><span class="pickno mono">'+r+'.'+String(ri).padStart(2,"0")+'</span>'+avatarImg(p,18)+
      '<span class="who '+(e.who==="me"?"me":"")+'">'+(e.who==="me"?"MY PICK":"taken")+'</span>'+
      '<span class="n">'+(logoUrl(p.team)?'<img class="tlogo" src="'+logoUrl(p.team)+'" width="13" height="13" loading="lazy" alt=""> ':'')+p.name+' <span style="color:var(--faint)">'+p.pos+' · '+p.team+'</span></span>'+
      (function(){const v=Math.round(p.proj-(repl[p.pos]||0)); return '<span class="mono" style="font-size:10px;color:'+(v>25?'var(--green)':v>0?'var(--dim)':'var(--faint)')+'">'+(v>0?'+':'')+v+'</span>';})()+
      '<span class="x undo1" data-undoentry="'+i+'" role="button" tabindex="0" aria-label="Undo this pick" style="font-size:10.5px">undo</span></div>';
  }).reverse().join("") : '<div class="empty">Nothing yet. Mark players as they come off the board.</div>';
}

let _rafPending = false;
function render(){
  if(_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(()=>{ _rafPending = false; renderNow(); });
}
function renderNow(){
  try{ performance.mark("render-start"); }catch(e){}
  _idx = null;
  [renderHeader, renderTabs, renderPool, renderBest, renderRoster, renderLog, renderQueue, renderPlan].forEach(fn=>{
    try{ fn(); }catch(e){ console.error(fn.name, e); if(typeof surfaceError==="function") surfaceError(fn.name+": "+e.message); }
  });
  try{ performance.mark("render-end"); performance.measure("war-room-render", "render-start", "render-end"); }catch(e){}
}
function renderHeader(){
  const el = document.querySelector(".logo .sub");
  if(!el) return;
  let txt = (S.settings.name||"Buck Breakers")+" · Superflex · "+(S.settings.ptd||6)+"pt Pass TD · Slot "+S.settings.slot;
  if(S.settings.draftDate){
    const days = Math.ceil((new Date(S.settings.draftDate+"T20:00").getTime()-Date.now())/86400000);
    if(days>1) txt += " · ⏳ "+days+"d to draft";
    else if(days===1) txt += " · ⏳ TOMORROW";
    else if(days===0) txt += " · 🏈 DRAFT DAY";
  }
  el.textContent = txt;
  const fl = document.getElementById("rosFlair");
  if(fl) fl.textContent = S.settings.flair || "";
}

/* ---------- Events (delegated) ---------- */
document.addEventListener("click", e=>{
  const t = e.target.closest("[data-pick],[data-take],[data-drop],[data-untake],[data-edit],[data-pos],[data-undoentry],[data-picksync],[data-note],[data-dnd],[data-clearfilters],[data-card],[data-cardtab],[data-boost],[data-fade],[data-adpedit],[data-tierup],[data-tierdn],[data-onepager],[data-cardpng],[data-unpickpre],[data-cmpfrom],[data-slotname],[data-keeper],[data-queue],[data-qup],[data-qfill],[data-plan],[data-unplan],[data-plantoggle],[data-planqueue],[data-qround],[data-qdn],[data-showall],[data-simto],[data-horn],[data-siren],#tradeGo,#matrixCopy,#logMineBtn,#logCsvBtn,#undo5Btn,th[data-sort]");
  if(!t){
    const rowEl = e.target.closest("#poolBody tr[data-pid]");
    if(rowEl){
      kbSel = [...document.querySelectorAll("#poolBody tr[data-pid]")].indexOf(rowEl);
      applyKbSel();
    }
    return;
  }
  if(t.dataset.picksync){
    const v = prompt("Which overall pick is on the clock right now? (board thinks it's #"+pickNow()+")", pickNow());
    if(v===null) return;
    const n = parseInt(v,10);
    if(!isNaN(n) && n>=1){ S.pickOffset = n - 1 - S.log.length; commit(); }
    return;
  }
  if(t.dataset.slotname){
    const s = t.dataset.slotname;
    const v = prompt("Team name for draft slot "+s+":", slotName(s));
    if(v===null) return;
    S.slotNames[s] = v.trim() || ("T"+s);
    save(); renderBoard(); return;
  }
  if(t.id==="tradeGo"){ return tradeEval(); }
  if(t.id==="matrixCopy"){ navigator.clipboard.writeText(window._matrixTxt||"").then(()=>toast("📋 Matrix copied")); return; }
  if(t.dataset.teampage){ return openTeamPage(+t.dataset.teampage); }
  if(t.id==="randOrder"){
    const t2 = S.settings.teams;
    const order = Array.from({length:t2},(_,i)=>i+1).sort(()=>Math.random()-0.5);
    const out = document.getElementById("randOut");
    out.innerHTML = "";
    order.forEach((s2,i)=>setTimeout(()=>{
      out.innerHTML += (i+1)+". <b>"+esc(slotName(s2))+"</b>"+(i<order.length-1?" &nbsp;·&nbsp; ":"");
    }, i*350));
    return;
  }
  if(t.id==="copyResults"){
    const byId2 = idIndex(), t2 = S.settings.teams;
    let txt = "🏈 "+(S.settings.name||"Draft")+" results\n";
    S.log.forEach((e,i)=>{
      const p2 = byId2[e.id]; if(!p2) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/t2), idx = n-(r2-1)*t2, slot = (r2%2===1)?idx:t2+1-idx;
      if(idx===1) txt += "\n— Round "+r2+" —\n";
      txt += r2+"."+String(idx).padStart(2,"0")+" "+slotName(slot)+": "+p2.name+" ("+p2.pos+" "+p2.team+")\n";
    });
    navigator.clipboard.writeText(txt).then(()=>toast("📋 Results copied ("+S.log.length+" picks)"));
    return;
  }
  if(t.dataset.card){ if(t.dataset.tabpre) window._cardTab = t.dataset.tabpre; return openCard(t.dataset.card); }
  if(t.dataset.keeper){
    const id = t.dataset.keeper;
    if(S.keepers[id]) delete S.keepers[id];
    else {
      const v = prompt("Keeper for which draft slot? (1-"+S.settings.teams+", you are "+S.settings.slot+")", S.settings.slot);
      if(v===null) return;
      const s2 = parseInt(v,10);
      if(isNaN(s2) || s2<1 || s2>S.settings.teams) return toast("Bad slot", {warn:true});
      const rc = prompt("Which round does this keeper cost? (0 = free)", "0");
      S.keepers[id] = {s:s2, r:Math.max(0, parseInt(rc,10)||0)};
    }
    $("#cardOverlay").classList.remove("show");
    return commit();
  }
  if(t.dataset.queue){ $("#cardOverlay").classList.remove("show"); return toggleQueue(t.dataset.queue); }
  if(t.dataset.qfill){
    const {scored} = scoreBoard();
    scored.slice(0,8).forEach(s=>{ if(!S.queue.includes(s.p.id)) S.queue.push(s.p.id); });
    commit(); return;
  }
  if(t.dataset.qround){
    const id = t.dataset.qround;
    const v = prompt("Want him by which round? (blank clears)", (S.queueRounds||{})[id]||"");
    if(v===null) return;
    if(v.trim()==="") delete S.queueRounds[id];
    else S.queueRounds[id] = Math.max(1, Math.min(S.settings.roster, parseInt(v,10)||1));
    return commit();
  }
  if(t.dataset.qup!=null){ const i=+t.dataset.qup; if(i>0){ [S.queue[i-1],S.queue[i]]=[S.queue[i],S.queue[i-1]]; commit(); } return; }
  if(t.dataset.qdn!=null){ const i=+t.dataset.qdn; if(i<S.queue.length-1){ [S.queue[i+1],S.queue[i]]=[S.queue[i],S.queue[i+1]]; commit(); } return; }
  if(t.dataset.showall){ window._showAllRows = true; renderPool(); return; }
  if(t.dataset.simto){ return simToMyPick(); }
  if(t.dataset.horn){ return stinger("horn"); }
  if(t.dataset.siren){ return stinger("siren"); }
  if(t.id==="undo5Btn"){ undoLastN(5); return; }
  if(t.id==="logMineBtn"){ logMineOnly = !logMineOnly; t.classList.toggle("on", logMineOnly); renderLog(); return; }
  if(t.id==="logCsvBtn"){ return exportLogCsv(); }
  if(t.dataset.cardtab){ window._cardTab = t.dataset.cardtab; return openCard(t.dataset.cardid); }
  if(t.dataset.boost){
    const id = t.dataset.boost;
    S.boost[id] = S.boost[id]===1 ? 0 : 1;
    commit(); window._cardTab="intel"; return openCard(id);
  }
  if(t.dataset.fade){
    const id = t.dataset.fade;
    S.boost[id] = S.boost[id]===-1 ? 0 : -1;
    commit(); window._cardTab="intel"; return openCard(id);
  }
  if(t.dataset.adpedit){
    const id = t.dataset.adpedit, p = idIndex()[id];
    const v = prompt("Manual ADP for "+p.name+" (blank = restore source):", p.adp||"");
    if(v===null) return;
    if(v.trim()==="") delete S.adpOverride[id]; else S.adpOverride[id] = Math.max(1, parseInt(v,10)||p.adp);
    commit(); window._cardTab="intel"; return openCard(id);
  }
  if(t.dataset.tierup){ const id=t.dataset.tierup; S.tierBump[id]=(S.tierBump[id]||0)+1; commit(); window._cardTab="intel"; return openCard(id); }
  if(t.dataset.tierdn){ const id=t.dataset.tierdn; S.tierBump[id]=(S.tierBump[id]||0)-1; commit(); window._cardTab="intel"; return openCard(id); }
  if(t.dataset.plan){
    const id = t.dataset.plan;
    const v = prompt("Pin to which of YOUR rounds? (1-"+S.settings.roster+", blank clears)", "");
    if(v===null) return;
    for(const r in S.plan) if(S.plan[r]===id) delete S.plan[r];
    const r2 = parseInt(v,10);
    if(!isNaN(r2) && r2>=1 && r2<=S.settings.roster) S.plan[r2] = id;
    $("#cardOverlay").classList.remove("show");
    return commit();
  }
  if(t.dataset.unplan){ delete S.plan[t.dataset.unplan]; return commit(); }
  if(t.dataset.plantoggle){ window._planCollapsed = !window._planCollapsed; renderPlan(); return; }
  if(t.dataset.planqueue){
    pruneQueue();
    const mine = myOverallPicks(), cur = pickNow();
    const rounds = mine.filter(x=>x>=cur).map(x=>Math.ceil(x/S.settings.teams));
    S.plan = {};
    S.queue.forEach((id,i)=>{ if(rounds[i]) S.plan[rounds[i]] = id; });
    return commit();
  }
  if(t.dataset.cardpng){
    const p = idIndex()[t.dataset.cardpng]; if(!p) return;
    const c = document.createElement("canvas");
    c.width = 640; c.height = 360;
    const x = c.getContext("2d");
    x.fillStyle = "#0b0f14"; x.fillRect(0,0,640,360);
    x.fillStyle = "#2fd47a"; x.font = "bold 30px sans-serif"; x.fillText(p.name, 28, 54);
    x.fillStyle = "#8ba0bc"; x.font = "15px sans-serif";
    x.fillText(p.pos+" · "+p.team+" · proj "+p.proj+" · ADP "+(p.adp||"—"), 28, 84);
    x.fillStyle = "#e8eef7"; x.font = "14px sans-serif";
    const words = storyOf(p).split(" ");
    let line = "", yy = 130;
    words.forEach(w=>{
      if((line+w).length > 62){ x.fillText(line, 28, yy); yy += 24; line = ""; }
      line += w+" ";
    });
    x.fillText(line, 28, yy);
    hist3For(p).forEach((hrow,i)=>{
      x.fillStyle = "#2fd47a";
      x.fillRect(28, 250+i*26, Math.min(560, hrow[2]*1.2), 14);
      x.fillStyle = "#8ba0bc"; x.fillText(hrow[0]+"  "+hrow[2], 30+Math.min(560, hrow[2]*1.2)+8, 262+i*26);
    });
    c.toBlob(b=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=p.name.replace(/\s+/g,"-")+".png"; a.click(); URL.revokeObjectURL(a.href); });
    return;
  }
  if(t.dataset.onepager){
    const id = t.dataset.onepager, p = idIndex()[id];
    const h3 = hist3For(p);
    const txt = p.name+" ("+p.pos+" "+p.team+")\n"+storyOf(p)+"\n"+
      (h3.length?"Seasons: "+h3.map(x=>x[0]+": "+x[2]+" pts ("+p.pos+x[3]+")").join(" · ")+"\n":"")+
      "2026 projection: "+p.proj+" · ADP "+(p.adp||"—");
    navigator.clipboard.writeText(txt).then(()=>toast("📋 One-pager copied"));
    return;
  }
  if(t.dataset.unpickpre){
    const id = t.dataset.unpickpre, byId2 = idIndex();
    const with2 = bestStarters(myIds(), byId2).pts;
    const without = bestStarters(myIds().filter(x=>x!==id), byId2).pts;
    toast("Without "+esc(byId2[id].name)+": lineup drops <b>"+Math.round(with2-without)+"</b> pts");
    return;
  }
  if(t.dataset.cmpfrom){
    const p = idIndex()[t.dataset.cmpfrom]; if(!p) return;
    $("#cardOverlay").classList.remove("show");
    if(!$("#playersDL").children.length) fillPlayersDL();
    $("#cmpA").value = p.name; $("#cmpB").value = "";
    $("#cmpOverlay").classList.add("show");
    renderCompare(); $("#cmpB").focus();
    return;
  }
  if(t.dataset.note){
    editNote(t.dataset.note);
    if($("#cardOverlay").classList.contains("show")) openCard(t.dataset.note);
    return;
  }
  if(t.dataset.dnd){ S.dnd[t.dataset.dnd] ? delete S.dnd[t.dataset.dnd] : S.dnd[t.dataset.dnd]=true; return commit(); }
  if(t.dataset.clearfilters){
    S.ui.pos="ALL"; S.ui.round="ALL"; S.ui.targetsOnly=false; S.ui.stacksOnly=false; S.ui.survivors=false; S.ui.fallers=false; S.ui.showTaken=false;
    $("#search").value=""; $("#roundFilter").value="ALL";
    S.ui.hideHurt=false;
    ["fTargets","fStacks","fSurvive","fFallers","fHideHurt","showTaken"].forEach(id=>$("#"+id).checked=false);
    save(); renderTabs(); renderPool(); return;
  }
  if(t.dataset.pick){ $("#cardOverlay").classList.remove("show"); return pickMine(t.dataset.pick); }
  if(t.dataset.take){ $("#cardOverlay").classList.remove("show"); return markTaken(t.dataset.take); }
  if(t.dataset.untake){ delete S.taken[t.dataset.untake]; for(let i=S.log.length-1;i>=0;i--){if(S.log[i].id===t.dataset.untake&&S.log[i].who==="other"){S.log.splice(i,1);break;}} return commit(); }
  if(t.dataset.drop) return dropMine(t.dataset.drop);
  if(t.dataset.edit) return editProj(t.dataset.edit);
  if(t.dataset.undoentry!=null) return undoEntry(+t.dataset.undoentry);
  if(t.dataset.pos){ S.ui.pos=t.dataset.pos; save(); renderTabs(); renderPool(); return; }
  if(t.dataset.sort){
    if(S.ui.sort===t.dataset.sort) S.ui.dir*=-1; else { S.ui.sort=t.dataset.sort; S.ui.dir = (["name","team","pos","adp"].includes(t.dataset.sort))?1:-1; }
    save(); renderPool();
  }
});
let searchTimer=null;
$("#search").addEventListener("input", ()=>{ clearTimeout(searchTimer); searchTimer=setTimeout(renderPool, 120); });
$("#showTaken").addEventListener("change", e=>{ S.ui.showTaken=e.target.checked; save(); renderPool(); });
$("#roundFilter").addEventListener("change", e=>{ S.ui.round=e.target.value; save(); renderPool(); });
$("#fTargets").addEventListener("change", e=>{ S.ui.targetsOnly=e.target.checked; save(); renderPool(); });
$("#fStacks").addEventListener("change", e=>{ S.ui.stacksOnly=e.target.checked; save(); renderPool(); });
$("#fSurvive").addEventListener("change", e=>{ S.ui.survivors=e.target.checked; save(); renderPool(); });
$("#fFallers").addEventListener("change", e=>{ S.ui.fallers=e.target.checked; save(); renderPool(); });
$("#fHideHurt").addEventListener("change", e=>{ S.ui.hideHurt=e.target.checked; save(); renderPool(); });
$("#undoBtn").addEventListener("click", undoLast);
$("#redoBtn").addEventListener("click", redoLast);
document.addEventListener("keydown", e=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){ e.preventDefault(); openPalette(); return; }
  if((e.ctrlKey||e.metaKey) && (e.key==="y" || (e.shiftKey && e.key.toLowerCase()==="z"))){ e.preventDefault(); redoLast(); return; }
  if((e.ctrlKey||e.metaKey) && e.key==="z"){ e.preventDefault(); undoLast(); return; }
  if(e.key==="Enter"){
    const ae = document.activeElement;
    if(ae && ae.dataset && (ae.dataset.drop!=null || ae.dataset.undoentry!=null || (ae.tagName==="TH" && ae.dataset.sort))){ e.preventDefault(); ae.click(); return; }
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if(e.key==="/" && !typing){ e.preventDefault(); $("#search").focus(); return; }
  if(e.key==="?" && !typing){ e.preventDefault(); $("#helpOverlay").classList.toggle("show"); return; }
  if(e.key==="Tab"){
    const ov = document.querySelector(".overlay.show");
    if(ov){
      const f = [...ov.querySelectorAll("button,input,select,textarea,a[href],[tabindex='0']")].filter(x=>!x.disabled && x.offsetParent!==null);
      if(f.length){
        const first = f[0], last = f[f.length-1];
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      }
    }
  }
  if(e.key==="Escape"){
    const ov = document.querySelector(".overlay.show");
    if(ov){ ov.classList.remove("show"); return; }
    if(typing) document.activeElement.blur();
    else { kbSel=-1; applyKbSel(); }
    return;
  }
  if(typing || document.querySelector(".overlay.show")) return;
  const trs = document.querySelectorAll("#poolBody tr[data-pid]");
  if(e.key==="ArrowDown"){ e.preventDefault(); kbSel=Math.min(kbSel+1, trs.length-1); applyKbSel(); return; }
  if(e.key==="ArrowUp"){ e.preventDefault(); kbSel=Math.max(kbSel-1, 0); applyKbSel(); return; }
  if(kbSel>=0 && trs[kbSel]){
    const id = trs[kbSel].dataset.pid;
    if(!id) return;
    const k = e.key.toLowerCase();
    if(k==="m"){ e.preventDefault(); if(!S.mine.includes(id)) pickMine(id); }
    if(k==="t"||k==="x"){ e.preventDefault(); if(!S.taken[id] && !S.mine.includes(id)) markTaken(id); }
    if(k==="d"){ e.preventDefault(); S.dnd[id] ? delete S.dnd[id] : S.dnd[id]=true; commit(); }
    if(k==="n"){ e.preventDefault(); editNote(id); }
    if(k==="q"){ e.preventDefault(); toggleQueue(id); return; }
  }
  if(/^[1-9]$/.test(e.key) && S.ui.live){
    const {scored} = scoreBoard();
    const s = scored[+e.key-1];
    if(s){ e.preventDefault(); pickMine(s.p.id); }
    return;
  }
  if(kbSel>=0 && trs[kbSel]){
    const id = trs[kbSel].dataset.pid;
    if(!id) return;
    const k = e.key.toLowerCase();
    if(k==="c"){
      e.preventDefault();
      const p = idIndex()[id]; if(!p) return;
      if(!document.getElementById("playersDL").children.length) fillPlayersDL();
      const a = document.getElementById("cmpA"), b = document.getElementById("cmpB");
      if(!a.value || (a.value && b.value)) { a.value = p.name; b.value = ""; } else b.value = p.name;
      document.getElementById("cmpOverlay").classList.add("show");
      renderCompare();
    }
  }
});

/* Compare modal */
function fillPlayersDL(){
  $("#playersDL").innerHTML = allPlayers().map(p=>'<option value="'+esc(p.name)+'">'+p.pos+' · '+p.team+'</option>').join("");
}
$("#cmpBtn").addEventListener("click", ()=>{
  if(!$("#playersDL").children.length) fillPlayersDL();
  $("#cmpOverlay").classList.add("show"); $("#cmpA").focus();
});
$("#cmpClose").addEventListener("click", ()=>$("#cmpOverlay").classList.remove("show"));
$("#cmpA").addEventListener("input", renderCompare);
$("#cmpB").addEventListener("input", renderCompare);

/* Roster recap to clipboard */
$("#recapBtn").addEventListener("click", ()=>{
  const byId = idIndex();
  if(!S.mine.length) return toast("Nothing drafted yet", {warn:true});
  const bs = bestStarters(S.mine, byId);
  let txt = "🏈 "+(S.settings.name||"My league")+" — my draft (slot "+S.settings.slot+")\n";
  bs.line.forEach(sl=>{ txt += sl.lab.padEnd(5)+" "+(sl.p ? sl.p.name+" ("+sl.p.team+", "+sl.p.proj+")" : "—")+"\n"; });
  const bench = S.mine.filter(id=>!bs.starterIds.has(id)).map(id=>byId[id]).filter(Boolean);
  if(bench.length) txt += "BENCH "+bench.map(p=>p.name).join(", ")+"\n";
  txt += "Projected starters: "+Math.round(bs.pts)+" pts";
  navigator.clipboard.writeText(txt).then(()=>toast("📤 Roster copied — paste it in the chat"), ()=>toast("Copy failed", {warn:true}));
});

/* Draft grade + full report (#51) */
let _reportText = "";
function buildReport(){
  const g = gradeDraft();
  const byId = idIndex();
  const col = g.letter[0]==="A" ? "var(--green)" : g.letter[0]==="B" ? "var(--gold)" : "var(--red)";
  const bs = S.mine.length ? bestStarters(S.mine, byId) : null;
  // steals: my picks made 10+ past ADP
  const steals = [];
  S.log.forEach((e,i)=>{
    if(e.who!=="me") return;
    const p = byId[e.id]; if(!p || !p.adp) return;
    const overall = i+1+(S.pickOffset||0);
    if(overall - p.adp >= 10) steals.push({p, fall: overall - p.adp});
  });
  // stacks
  const teams = {};
  S.mine.forEach(id=>{ const p=byId[id]; if(p) (teams[p.team]=teams[p.team]||[]).push(p); });
  const stacks = Object.entries(teams).filter(([,ps])=>ps.some(x=>x.pos==="QB") && ps.some(x=>x.pos==="WR"||x.pos==="TE"));
  let h = '<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">'+
    '<span style="font-size:44px;font-weight:800;color:'+col+'">'+g.letter+'</span>'+
    '<span style="font-size:12.5px;line-height:1.6">Projected optimal starters if you finish on autopilot: <b class="mono">'+g.myPts+'</b><br>'+
    'Expected from slot '+S.settings.slot+': <b class="mono">'+g.basePts+'</b> → <b style="color:'+col+'">'+(g.diff>=0?'+':'')+g.diff+' pts</b></span></div>';
  let txt = "🎓 "+(S.settings.name||"League")+" draft report — grade "+g.letter+" ("+(g.diff>=0?"+":"")+g.diff+" vs expected)\n";
  if(bs){
    h += '<div class="sechead">Current lineup</div>' + bs.line.map(sl=> sl.p ?
      '<div class="mkrow strt"><span class="rp mono">'+sl.lab+'</span>'+(logoUrl(sl.p.team)?'<img class="tlogo" src="'+logoUrl(sl.p.team)+'" width="12" height="12" alt=""> ':'')+'<span class="mpos pos '+sl.p.pos+'">'+sl.p.pos+'</span><span class="mn">'+sl.p.name+' <span class="dimtxt mono">'+sl.p.proj+'</span></span></div>'
      : '<div class="mkrow bench"><span class="rp mono">'+sl.lab+'</span><span class="mn dimtxt">— open</span></div>').join("");
    bs.line.forEach(sl=>{ if(sl.p) txt += sl.lab.padEnd(5)+" "+sl.p.name+" ("+sl.p.team+")\n"; });
  }
  {
    const bench2 = myIds().filter(id2=>bs && !bs.starterIds.has(id2)).map(id2=>byId[id2]).filter(Boolean);
    if(bench2.length){
      h += '<div class="sechead">Bench upside</div>'+bench2.map(p2=>{
        const m2 = metaFor(p2), tags = [];
        if(m2 && m2[1]===0) tags.push("🎓 rookie");
        if(p2.intel && p2.intel.t!=null) tags.push("⭐ target");
        if(buzzOf(p2)>1000) tags.push("📈 trending");
        return '<div class="mkrow"><span class="mpos pos '+p2.pos+'">'+p2.pos+'</span><span class="mn">'+esc(p2.name)+(tags.length?' <span class="dimtxt">'+tags.join(" · ")+'</span>':'')+'</span></div>';
      }).join("");
    }
  }
  // analyst target capture (#247)
  {
    const got = myIds().map(id2=>byId[id2]).filter(Boolean).filter(p2=>p2.intel && p2.intel.t!=null);
    {
    const planned = Object.entries(S.plan||{});
    if(planned.length){
      const hits = planned.filter(([,id2])=>S.mine.includes(id2)).length;
      h += '<div class="sechead">Plan execution</div><div class="mkrow"><span class="mn">📌 '+hits+' of '+planned.length+' pinned targets landed ('+Math.round(100*hits/planned.length)+'%)</span></div>';
    }
  }
  h += '<div class="sechead">Analyst targets landed</div><div class="mkrow" style="white-space:normal"><span class="mn">'+
      (got.length? '⭐ '+got.length+' — '+got.map(p2=>p2.name.split(" ").slice(-1)[0]).join(", ") : "None yet — the board disagreed with the experts.")+'</span></div>';
  }
  // roster age + volatility (#280/#281)
  if(bs){
    const ages = bs.line.filter(sl=>sl.p).map(sl=>({p:sl.p, a:(metaFor(sl.p)||[])[0]||0})).filter(x=>x.a);
    if(ages.length){
      const avg2 = ages.reduce((a,x)=>a+x.a,0)/ages.length;
      const old = ages.sort((a,b)=>b.a-a.a)[0], young = ages[ages.length-1];
      const vols = bs.line.filter(sl=>sl.p).map(sl=>consistencyOf(sl.p)).filter(Boolean);
      const boomy = vols.filter(v=>v.label==="boom-bust").length;
      h += '<div class="sechead">Roster profile</div><div class="mkrow" style="white-space:normal"><span class="mn">'+
        'Avg starter age <b>'+avg2.toFixed(1)+'</b> · oldest '+esc(old.p.name.split(" ").slice(-1)[0])+' ('+old.a+') · youngest '+esc(young.p.name.split(" ").slice(-1)[0])+' ('+young.a+')'+
        (vols.length?' · volatility: '+boomy+'/'+vols.length+' boom-bust starters':'')+'</span></div>';
    }
    // archetype (#287)
    const first4 = S.log.filter(e=>e.who==="me").slice(0,4).map(e=>byId[e.id]).filter(Boolean);
    if(first4.length>=3){
      const rb = first4.filter(p2=>p2.pos==="RB").length;
      const arch = rb===0 ? "Zero-RB" : rb===1 ? "Hero-RB" : rb>=3 ? "Robust-RB" : "Balanced";
      h += '<div class="mkrow"><span class="mn">🏗 Build archetype: <b>'+arch+'</b> ('+first4.map(p2=>p2.pos).join("-")+' open)</span></div>';
    }
  }
  // keeper surplus (#235)
  {
    const ks = Object.keys(S.keepers||{}).filter(id2=>byId[id2]);
    if(ks.length){
      const curve = pickValueCurve(), t2 = S.settings.teams;
      h += '<div class="sechead">Keeper value</div>'+ks.map(id2=>{
        const p2 = byId[id2], k2 = S.keepers[id2];
        const rr = k2.r||0;
        const cost = rr>0 ? (curve[Math.min(curve.length-1,(rr-1)*t2+Math.floor(t2/2))]||0) : 0;
        const repl2 = replacementLevels(allPlayers());
        const surplus = Math.round((p2.proj-(repl2[p2.pos]||0)) - cost);
        return '<div class="mkrow"><span class="mn">👑 '+esc(p2.name)+' ('+esc(slotName(k2.s!=null?k2.s:k2))+(rr?', costs R'+rr:', free')+') → surplus <b style="color:'+(surplus>=0?'var(--green)':'var(--red)')+'">'+(surplus>0?'+':'')+surplus+'</b></span></div>';
      }).join("");
    }
  }
  // hindsight (#245) — replay the log, greedy-pick at each of my slots
  if(S.log.length >= S.settings.teams){
    const players2 = allPlayers(), repl2 = replacementLevels(players2);
    const vorpOf = p2 => p2.proj-(repl2[p2.pos]||0);
    const myPicksSet = new Set(myOverallPicks());
    const gone = new Set();
    let ideal = 0, actual = 0;
    S.log.forEach((e,i)=>{
      const n = i+1+(S.pickOffset||0);
      if(myPicksSet.has(n)){
        const bestNow = players2.filter(p2=>!gone.has(p2.id)).sort((a,b)=>vorpOf(b)-vorpOf(a))[0];
        if(bestNow) ideal += Math.max(0, vorpOf(bestNow));
        const mineP = byId[e.id];
        if(mineP) actual += Math.max(0, vorpOf(mineP));
      }
      gone.add(e.id);
    });
    if(ideal>0){
      const eff = Math.round(actual/ideal*100);
      h += '<div class="sechead">Hindsight</div><div class="mkrow"><span class="mn">🔭 You captured <b>'+eff+'%</b> of the perfect-hindsight value at your picks ('+Math.round(actual)+' of '+Math.round(ideal)+').</span></div>';
    }
  }
  // exposure across saved boards (#282)
  {
    const all2 = profAll(), names = Object.keys(all2);
    if(names.length>=2){
      const cnt2 = {};
      names.forEach(nm2=>{ (all2[nm2].mine||[]).forEach(id2=>cnt2[id2]=(cnt2[id2]||0)+1); });
      const multi = Object.entries(cnt2).filter(([,c2])=>c2>=2).map(([id2,c2])=>({p:byId[id2], c:c2})).filter(x=>x.p)
        .sort((a,b)=>b.c-a.c).slice(0,6);
      if(multi.length) h += '<div class="sechead">Exposure ('+names.length+' boards)</div><div class="mkrow" style="white-space:normal"><span class="mn">'+
        multi.map(x=>esc(x.p.name.split(" ").slice(-1)[0])+' ×'+x.c).join(" · ")+'</span></div>';
    }
  }
  h += '<div class="sechead">Stacks</div>' + (stacks.length
    ? stacks.map(([t,ps])=>{
        const pcs = ps.filter(x=>x.pos==="WR"||x.pos==="TE").length;
        return '<div class="mkrow">'+(logoUrl(t)?'<img class="tlogo" src="'+logoUrl(t)+'" width="13" height="13" alt=""> ':'')+'<span class="mn">🔗 '+t+' — '+ps.map(x=>x.name.split(" ").slice(-1)[0]).join(" + ")+(pcs>=2?' <b style="color:var(--gold)">DOUBLE STACK</b>':'')+'</span></div>';
      }).join("")
    : '<div class="dimtxt">None yet — pair a WR/TE with one of your QBs.</div>');
  if(stacks.length) txt += "Stacks: "+stacks.map(([t,ps])=>t+" ("+ps.map(x=>x.name.split(" ").slice(-1)[0]).join("+")+")").join(", ")+"\n";
  // round-by-round value captured
  const rv = {};
  let rvTotal = 0;
  {
    const players2 = allPlayers(), repl2 = replacementLevels(players2);
    S.log.forEach((e,i)=>{
      if(e.who!=="me") return;
      const p2 = byId[e.id]; if(!p2) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/S.settings.teams);
      const v = Math.round(p2.proj-(repl2[p2.pos]||0));
      rv[r2] = (rv[r2]||0)+v; rvTotal += v;
    });
  }
  if(Object.keys(rv).length){
    h += '<div class="sechead">Value by round</div><div class="mkrow" style="flex-wrap:wrap;white-space:normal">'+
      (()=>{ const bestR = Object.keys(rv).sort((a,b)=>rv[b]-rv[a])[0];
        return Object.keys(rv).sort((a,b)=>a-b).map(r2=>'<span class="mono" style="margin-right:10px">'+(r2===bestR?'🔥':'')+'R'+r2+' <b style="color:'+(rv[r2]>=60?'var(--green)':rv[r2]>=0?'var(--dim)':'var(--red)')+'">'+(rv[r2]>0?'+':'')+rv[r2]+'</b></span>').join(""); })()+
      ' <span class="mono">Σ <b>'+(rvTotal>0?'+':'')+rvTotal+'</b></span></div>';
  }
  // per-position delta vs sim baseline
  if(window._gradeBase && window._gradeBase.pos && S.mine.length){
    const bsNow = bestStarters(myIds(), byId);
    const mineByPos = {};
    bsNow.line.forEach(sl=>{ if(sl.p) mineByPos[sl.p.pos]=(mineByPos[sl.p.pos]||0)+sl.p.proj; });
    h += '<div class="sechead">Vs expected, by position</div><div class="mkrow" style="flex-wrap:wrap;white-space:normal">'+
      POSITIONS.map(pos=>{
        const d2 = Math.round((mineByPos[pos]||0)-(window._gradeBase.pos[pos]||0));
        return '<span class="mono" style="margin-right:10px">'+pos+' <b style="color:'+(d2>=15?'var(--green)':d2<=-15?'var(--red)':'var(--dim)')+'">'+(d2>0?'+':'')+d2+'</b></span>';
      }).join("")+'</div>';
  }
  // league-wide reaches & steals
  {
    const moves = [];
    S.log.forEach((e,i)=>{
      const p2 = byId[e.id]; if(!p2 || !p2.adp) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/S.settings.teams), idx = n-(r2-1)*S.settings.teams;
      const slot = (r2%2===1)?idx:S.settings.teams+1-idx;
      moves.push({p:p2, slot, d: n - p2.adp});
    });
    const reaches = moves.filter(m2=>m2.d<=-8).sort((a,b)=>a.d-b.d).slice(0,3);
    const steals2 = moves.filter(m2=>m2.d>=8).sort((a,b)=>b.d-a.d).slice(0,3);
    if(reaches.length || steals2.length){
      h += '<div class="sechead">League reaches & steals</div>'+
        reaches.map(m2=>'<div class="mkrow"><span class="mn">📈 '+esc(slotName(m2.slot))+' reached '+(-m2.d)+' for '+esc(m2.p.name)+'</span></div>').join("")+
        steals2.map(m2=>'<div class="mkrow"><span class="mn">💎 '+esc(slotName(m2.slot))+' stole '+esc(m2.p.name)+' ('+m2.d+' late)</span></div>').join("");
    }
  }
  // end-of-draft awards (#346)
  {
    const moves2 = [];
    S.log.forEach((e,i)=>{
      const p2 = byId[e.id]; if(!p2 || !p2.adp) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/S.settings.teams), idx = n-(r2-1)*S.settings.teams;
      const slot = (r2%2===1)?idx:S.settings.teams+1-idx;
      moves2.push({p:p2, slot, d:n-p2.adp, n});
    });
    if(moves2.length >= S.settings.teams*3){
      const bestVal = moves2.slice().sort((a,b)=>b.d-a.d)[0];
      const reach = moves2.slice().sort((a,b)=>a.d-b.d)[0];
      const lastPick = moves2[moves2.length-1];
      const dbl = stacks.find(([,ps2])=>ps2.filter(x=>x.pos==="WR"||x.pos==="TE").length>=2);
      h += '<div class="sechead">🏅 Draft awards</div>'+
        '<div class="mkrow"><span class="mn">💎 <b>Best Value</b>: '+esc(slotName(bestVal.slot))+' — '+esc(bestVal.p.name)+' ('+bestVal.d+' past ADP)</span></div>'+
        '<div class="mkrow"><span class="mn">🙈 <b>The Reach</b>: '+esc(slotName(reach.slot))+' — '+esc(reach.p.name)+' ('+(-reach.d)+' early)</span></div>'+
        '<div class="mkrow"><span class="mn">🎉 <b>Mr. Irrelevant</b>: '+esc(lastPick.p.name)+' (pick '+lastPick.n+')</span></div>'+
        (dbl?'<div class="mkrow"><span class="mn">🏗 <b>Stack Architect</b>: you, for the '+dbl[0]+' double stack</span></div>':'');
    }
  }
  // hometown map + favorite-state pride (#354/#355)
  {
    const states = {};
    myIds().map(id2=>byId[id2]).filter(Boolean).forEach(p2=>{
      const hw2 = hometownOf(p2); if(hw2 && hw2.st) states[hw2.st] = (states[hw2.st]||0)+1;
    });
    const fs = (S.settings.favState||"").toUpperCase();
    if(Object.keys(states).length){
      h += '<div class="sechead">🗺 Roster roots</div><div class="mkrow" style="white-space:normal"><span class="mn">'+
        Object.entries(states).sort((a,b)=>b[1]-a[1]).map(([st2,c2])=>(st2===fs?"💖":"")+st2+" ×"+c2).join(" · ")+
        (fs && states[fs] ? ' — <b style="color:#ff7bac">'+states[fs]+' '+fs+' kid'+(states[fs]>1?"s":"")+' on YOUR team</b>' : '')+'</span></div>';
    }
  }
  h += '<div class="sechead">Steals</div>' + (steals.length
    ? steals.map(s=>'<div class="mkrow"><span class="mn">💎 '+s.p.name+' — '+s.fall+' picks past ADP</span></div>').join("")
    : '<div class="dimtxt">No 10+ pick discounts landed (yet).</div>');
  if(steals.length) txt += "Steals: "+steals.map(s=>s.p.name+" (-"+s.fall+")").join(", ")+"\n";
  if(bs){
    const slates = [...new Set(bs.line.filter(sl=>sl.p).map(sl=>sl.p.team))].map(t=>({t, ps:psosFor(t)})).filter(x=>x.ps);
    h += '<div class="sechead">Playoff weeks (15–17)</div>' + slates.map(x=>'<div class="mkrow"><span class="rp mono">'+x.t+'</span><span class="mn dimtxt">'+x.ps.short+'</span></div>').join("");
  }
  txt += "Projected starters: "+g.myPts+" pts";
  _reportText = txt.replace(/\\n/g, "\n");
  $("#reportBody").innerHTML = h;
  $("#reportOverlay").classList.add("show");
}
function quickStandings(){
  const byId = idIndex(), t = S.settings.teams, mySlot = Math.min(S.settings.slot,t);
  const ros = teamRosters();
  const rows = [];
  for(let s2=1;s2<=t;s2++){
    const ids = s2===mySlot ? myIds() : ros[s2];
    rows.push({s:s2, pts: ids.length?bestStarters(ids, byId).pts:0});
  }
  rows.sort((a,b)=>b.pts-a.pts);
  return {rows, mySlot};
}
$("#tauntBtn").addEventListener("click", ()=>{
  const {rows, mySlot} = quickStandings();
  const my = rows.findIndex(r=>r.s===mySlot)+1;
  const last = rows[rows.length-1], top = rows[0];
  const lines = [
    "Projections have me "+ordinal(my)+" of "+rows.length+". "+(my===1?"Start engraving the trophy. 🏆":"And I drafted half-asleep."),
    esc(slotName(last.s))+" projects dead last at "+Math.round(last.pts)+" pts. Thoughts and prayers. 🙏",
    my===1 ? "Otto "+Math.round(rows[0].pts)+" — the field: cope." : esc(slotName(top.s))+" leads at "+Math.round(top.pts)+" — enjoy it while the injuries settle. 😈",
    "My optimal starters project "+Math.round(rows[my-1].pts)+". The math is not on your side, "+esc(slotName(last.s))+".",
  ];
  const line = lines[Math.floor(Math.random()*lines.length)];
  navigator.clipboard.writeText(line.replace(/<[^>]+>/g,"")).then(()=>toast("😈 Taunt copied: "+line));
});
$("#reportPng").addEventListener("click", ()=>{
  const c = document.createElement("canvas");
  const lines = _reportText.split("\n");
  c.width = 820; c.height = 120 + lines.length*30;
  const x = c.getContext("2d");
  x.fillStyle = "#0b0f14"; x.fillRect(0,0,c.width,c.height);
  x.fillStyle = "#2fd47a"; x.font = "bold 30px sans-serif";
  x.fillText("DRAFT WAR ROOM", 30, 52);
  x.fillStyle = "#8ba0bc"; x.font = "14px sans-serif";
  x.fillText(new Date().toLocaleDateString(), 30, 78);
  x.fillStyle = "#e8eef7"; x.font = "16px monospace";
  lines.forEach((ln,i)=>x.fillText(ln.slice(0,80), 30, 116+i*30));
  c.toBlob(b=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "draft-report.png"; a.click(); URL.revokeObjectURL(a.href);
  });
});
$("#gradeBtn").addEventListener("click", buildReport);
$("#reportClose").addEventListener("click", ()=>$("#reportOverlay").classList.remove("show"));
$("#reportCopy").addEventListener("click", ()=>{
  navigator.clipboard.writeText(_reportText).then(()=>toast("📤 Report copied"), ()=>toast("Copy failed", {warn:true}));
});
if(navigator.share){
  $("#reportShare").style.display = "";
  $("#reportShare").addEventListener("click", ()=>navigator.share({title:"My draft", text:_reportText}).catch(()=>{}));
}

/* Draft board grid */
function renderBoard(){
  const byId = idIndex(), t = S.settings.teams, mySlot = Math.min(S.settings.slot,t);
  const cells = {}; let maxR = 1;
  S.log.forEach((e,i)=>{
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), idx = n-(r-1)*t;
    const slot = (r%2===1) ? idx : t+1-idx;
    const p = byId[e.id];
    if(p){ cells[r+"-"+slot] = {p, mine:e.who==="me"}; maxR = Math.max(maxR, r); }
  });
  let h = '<table style="border-collapse:collapse;font-size:10.5px;min-width:'+(t*92)+'px"><tr><th style="padding:4px 6px"></th>';
  for(let s2=1;s2<=t;s2++) h += '<th data-slotname="'+s2+'" title="Click to rename" style="cursor:pointer;padding:4px 6px;color:'+(s2===mySlot?'var(--green)':'var(--faint)')+';font-size:9px;max-width:90px;overflow:hidden;text-overflow:ellipsis">'+esc(slotName(s2))+(s2===mySlot?' ★':'')+'</th>';
  h += '</tr>';
  for(let r=1;r<=Math.min(maxR+1,S.settings.roster);r++){
    h += '<tr><td class="mono" style="color:var(--faint);padding:3px 6px">R'+r+'</td>';
    for(let s2=1;s2<=t;s2++){
      const c = cells[r+"-"+s2];
      h += '<td style="padding:3px 5px;border:1px solid var(--line);'+(s2===mySlot?'background:rgba(47,212,122,.06);':'')+'">'+
        (c ? (logoUrl(c.p.team)?'<img class="tlogo" src="'+logoUrl(c.p.team)+'" width="12" height="12" loading="lazy" alt=""> ':'')+'<span class="pos '+c.p.pos+'" style="width:26px;font-size:8px;padding:2px 0">'+c.p.pos+'</span> '+c.p.name.split(" ").slice(-1)[0] : '<span style="color:var(--line)">·</span>')+'</td>';
    }
    h += '</tr>';
  }
  h += '</table>';
  // projected standings from tracked rosters
  const ros = teamRosters();
  if(S.log.length >= t){
    const curve = pickValueCurve();
    const pv = n => curve[Math.min(curve.length-1, Math.max(0,n-1))]||0;
    const now = pickNow();
    const tendency = {}, timing = {};
    S.log.forEach((e,i)=>{
      const p2 = byId[e.id]; if(!p2) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/t), idx = n-(r2-1)*t, slot = (r2%2===1)?idx:t+1-idx;
      if(p2.adp) (tendency[slot]=tendency[slot]||[]).push(n - p2.adp);
      if(e.t && i>0 && S.log[i-1].t) (timing[slot]=timing[slot]||[]).push((e.t-S.log[i-1].t)/1000);
    });
    const avg = a => a && a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
    const slowest = Object.entries(timing).filter(([,a])=>a.length>=3).sort((a,b)=>avg(b[1])-avg(a[1]))[0];
    const rows = [];
    for(let s2=1;s2<=t;s2++){
      const ids = s2===mySlot ? myIds() : ros[s2];
      const future = [];
      for(let r2=1;r2<=S.settings.roster;r2++){
        const n = (r2-1)*t + ((r2%2===1)?s2:t+1-s2);
        if(n>=now) future.push(n);
      }
      rows.push({s:s2, pts: ids.length ? bestStarters(ids, byId).pts : 0, n: ids.length,
                 cap: Math.round(future.reduce((a,n)=>a+pv(n),0)),
                 tend: avg(tendency[s2])});
    }
    rows.sort((a,b)=>b.pts-a.pts);
    h += '<div class="sechead" style="margin-top:16px">🏆 Projected standings</div><table class="stattbl" style="max-width:560px">'+
      '<tr><th style="text-align:left">#</th><th style="text-align:left">Team</th><th>Starters</th><th>Picks</th><th title="Value of remaining picks">Capital</th><th title="Avg picks vs ADP: negative = reaches early">Style</th></tr>'+
      rows.map((r2,i)=>'<tr'+(r2.s===mySlot?' style="color:var(--green);font-weight:700"':'')+'><td style="text-align:left">'+(i+1)+'</td><td style="text-align:left">'+esc(slotName(r2.s))+
        (slowest&&+slowest[0]===r2.s?' 🐢':'')+'</td><td>'+Math.round(r2.pts)+'</td><td>'+r2.n+'</td><td>'+r2.cap+'</td><td>'+
        (r2.tend==null?'—':(r2.tend<-3?'reaches '+r2.tend.toFixed(1):r2.tend>3?'value +'+r2.tend.toFixed(1):'neutral'))+'</td></tr>').join("")+
      '</table>'+(slowest?'<div class="dimtxt" style="margin-top:4px">🐢 slowest on the clock: '+esc(slotName(+slowest[0]))+' ('+Math.round(avg(slowest[1]))+'s avg)</div>':'');
  } else {
    h += '<div class="dimtxt" style="margin-top:12px">Standings appear after round 1 is fully logged.</div>';
  }
  // needs matrix: positions × teams
  {
    const need = (ids, pos, lim) => { let c=0; ids.forEach(id2=>{const p2=byId[id2]; if(p2&&p2.pos===pos)c++;}); return Math.max(0, lim-c); };
    const lims = {QB:2,RB:2,WR:2,TE:1,DEF:1};
    h += '<div class="sechead" style="margin-top:16px">🗺 Needs matrix (starters still owed)</div><table class="stattbl" style="max-width:560px"><tr><th style="text-align:left">Team</th>'+
      ["QB","RB","WR","TE","DEF"].map(p2=>'<th>'+p2+'</th>').join("")+'</tr>'+
      Array.from({length:t},(_,i)=>i+1).map(s2=>{
        const ids = s2===mySlot ? myIds() : ros[s2];
        return '<tr'+(s2===mySlot?' style="color:var(--green)"':'')+'><td style="text-align:left;cursor:pointer" data-teampage="'+s2+'" title="Open team page">'+esc(slotName(s2))+'</td>'+
          ["QB","RB","WR","TE","DEF"].map(p2=>{
            const n2 = need(ids, p2, lims[p2]);
            return '<td style="color:'+(n2>=2?'var(--red)':n2===1?'var(--gold)':'var(--faint)')+'">'+(n2||"·")+'</td>';
          }).join("")+'</tr>';
      }).join("")+'</table>';
  }
  // order randomizer + results copy
  h += '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+
    '<button class="hbtn" id="randOrder">🎲 Randomize order</button>'+
    '<button class="hbtn" id="copyResults">📋 Copy results text</button></div><div class="note" id="randOut" style="margin-top:8px"></div>';
  // trade calculator
  h += '<div class="sechead" style="margin-top:16px">⇄ Pick trade calculator</div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      '<input class="search" id="tradeGive" style="flex:1;min-width:130px" placeholder="You give: 1.12, 6.01">'+
      '<input class="search" id="tradeGet" style="flex:1;min-width:130px" placeholder="You get: 2.01, 3.12">'+
      '<button class="hbtn" id="tradeGo">Evaluate</button>'+
    '</div><div class="note" id="tradeOut" style="margin-top:8px"></div>';
  $("#boardGrid").innerHTML = h;
}
/* value of an overall pick = VORP of the nth-best player on the full board */
function pickValueCurve(){
  return cached("pvc", ()=>{
    const players = allPlayers(), repl = replacementLevels(players);
    return players.map(p=>Math.max(0, p.proj-(repl[p.pos]||0))).sort((a,b)=>b-a);
  });
}
function tradeEval(){
  const curve = pickValueCurve();
  const v = n => curve[Math.min(curve.length-1, Math.max(0, n-1))] || 0;
  const give = parsePicks($("#tradeGive").value, S.settings.teams), get = parsePicks($("#tradeGet").value, S.settings.teams);
  if(!give.length || !get.length){ $("#tradeOut").textContent = "Enter picks on both sides (1.12 or overall numbers)."; return; }
  const gv = give.reduce((a,n)=>a+v(n),0), rv = get.reduce((a,n)=>a+v(n),0);
  const d = Math.round(rv-gv);
  $("#tradeOut").innerHTML = 'Give #'+give.join(", #")+' ('+Math.round(gv)+' pts of value) for #'+get.join(", #")+' ('+Math.round(rv)+') → '+
    '<b style="color:'+(d>=0?"var(--green)":"var(--red)")+'">'+(d>=0?"ACCEPT — you gain ~"+d:"DECLINE — you lose ~"+(-d))+' pts</b>'+
    '<span class="dimtxt"> (value = nth-best player remaining on a full board)</span>';
}
$("#boardPrint").addEventListener("click", ()=>{
  const byId = idIndex(), t = S.settings.teams, mySlot = Math.min(S.settings.slot,t);
  const ros = teamRosters();
  const rows = [];
  for(let s2=1;s2<=t;s2++){
    const ids = s2===mySlot ? myIds() : ros[s2];
    rows.push({s:s2, pts: ids.length?Math.round(bestStarters(ids, byId).pts):0});
  }
  rows.sort((a,b)=>b.pts-a.pts);
  let h = '<!DOCTYPE html><html><head><title>'+esc(S.settings.name||"Draft")+' — Results</title><style>'+
    'body{font-family:Arial;font-size:11px;margin:18px} h1{font-size:16px;margin:0 0 4px} h2{font-size:12px;margin:14px 0 6px}'+
    'table{border-collapse:collapse;width:100%} th,td{border:1px solid #bbb;padding:3px 6px;text-align:left} th{background:#eee}'+
    '.me{font-weight:bold} @media print{body{margin:8px}}</style></head><body>'+
    '<h1>'+esc(S.settings.name||"Draft")+' — '+new Date().toLocaleDateString()+'</h1>'+
    '<h2>Projected standings</h2><table><tr><th>#</th><th>Team</th><th>Proj starters</th></tr>'+
    rows.map((r,i)=>'<tr class="'+(r.s===mySlot?'me':'')+'"><td>'+(i+1)+'</td><td>'+esc(slotName(r.s))+'</td><td>'+r.pts+'</td></tr>').join("")+'</table>'+
    '<h2>Full board</h2><table><tr><th>Pick</th><th>Team</th><th>Player</th><th>Pos</th></tr>'+
    S.log.map((e,i)=>{
      const p = byId[e.id]; if(!p) return "";
      const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), idx = n-(r-1)*t, slot = (r%2===1)?idx:t+1-idx;
      return '<tr class="'+(slot===mySlot?'me':'')+'"><td>'+r+'.'+String(idx).padStart(2,"0")+'</td><td>'+esc(slotName(slot))+'</td><td>'+esc(p.name)+'</td><td>'+p.pos+' · '+p.team+'</td></tr>';
    }).join("")+'</table></body></html>';
  const w = window.open("about:blank");
  if(w){ w.document.write(h); w.document.close(); }
});
$("#boardBtn").addEventListener("click", ()=>{ renderBoard(); $("#boardOverlay").classList.add("show"); });
$("#boardClose").addEventListener("click", ()=>$("#boardOverlay").classList.remove("show"));

/* Paste picks modal */
$("#pasteBtn").addEventListener("click", ()=>{ $("#pasteResult").textContent=""; $("#pasteOverlay").classList.add("show"); $("#pasteText").focus(); });
$("#pasteCancel").addEventListener("click", ()=>$("#pasteOverlay").classList.remove("show"));
$("#pasteGo").addEventListener("click", ()=>{
  const players = allPlayers();
  const lines = $("#pasteText").value.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  let marked=0, skipped=0; const missed=[];
  for(const line of lines){
    const ln = nq(line);
    let best=null;
    for(const p of players){
      const pn = normName(p.name);
      if(ln===pn || ln.includes(pn) || (pn.includes(ln) && ln.length>=5)){
        if(!best || p.name.length>best.name.length) best=p;
      }
    }
    if(!best){ missed.push(line); continue; }
    if(S.taken[best.id] || S.mine.includes(best.id)){ skipped++; continue; }
    S.taken[best.id]=true; S.log.push({id:best.id, who:"other"}); marked++;
  }
  if(marked) commit();
  $("#pasteResult").innerHTML = '✅ Marked <b>'+marked+'</b> taken'+(skipped?' · '+skipped+' already off the board':'')+
    (missed.length ? '<br>⚠️ No match: '+missed.map(esc).join(", ") : '');
});

/* Mocks modal */
$("#mocksBtn").addEventListener("click", ()=>{ $("#mocksOverlay").classList.add("show"); renderMocks(); });
$("#mocksReroll").addEventListener("click", renderMocks);
$("#scenarioBtn").addEventListener("click", ()=>{
  $("#mockGrid").innerHTML = '<div class="empty" id="mockProg">Testing openings… 0/'+SCENARIOS.length+'</div>';
  const base = Math.floor(Math.random()*1e9);
  const res = [];
  const step2 = i => {
    if(i < SCENARIOS.length){
      const strat = {name:SCENARIOS[i].name, icon:"🧪", mod:()=>1, force:SCENARIOS[i].force};
      res.push({sc:SCENARIOS[i], m:runMock(strat, base + i*104729)});
      const pr = document.getElementById("mockProg");
      if(pr) pr.textContent = "Testing openings… "+res.length+"/"+SCENARIOS.length;
      setTimeout(()=>step2(i+1), 10);
      return;
    }
    res.sort((a,b)=>b.m.startPts-a.m.startPts);
    let txt = "🧪 Opening scenarios ("+(S.settings.name||"league")+", slot "+S.settings.slot+"):\n";
    $("#mockGrid").innerHTML = '<table class="stattbl" style="max-width:520px"><tr><th style="text-align:left">Opening</th><th>Starters</th><th>vs best</th><th>First 3</th></tr>'+
      res.map((x,i2)=>{
        const first3 = x.m.picks.slice(0,3).map(pk=>pk.p.name.split(" ").slice(-1)[0]).join(", ");
        txt += (i2+1)+". "+x.sc.name+" — "+x.m.startPts+" pts ("+first3+")\n";
        return '<tr'+(i2===0?' style="color:var(--green);font-weight:700"':'')+'><td style="text-align:left">'+esc(x.sc.name)+'</td><td>'+x.m.startPts+'</td><td>'+(i2===0?"—":"-"+(res[0].m.startPts-x.m.startPts))+'</td><td style="font-size:10px">'+esc(first3)+'</td></tr>';
      }).join("")+'</table>'+
      '<button class="hbtn" id="matrixCopy" style="margin-top:10px">📋 Copy matrix</button>';
    window._matrixTxt = txt;
    $("#mockConsensus").innerHTML = "Best projected opening from your seat is highlighted. Re-run for different room randomness.";
  };
  step2(0);
});
$("#mocksClose").addEventListener("click", ()=>$("#mocksOverlay").classList.remove("show"));

/* Settings modal */
document.querySelectorAll("#settingsOverlay .sechead").forEach(sh=>{
  sh.style.cursor = "pointer";
  sh.addEventListener("click", ()=>{
    let el = sh.nextElementSibling;
    const hide = !sh.classList.contains("folded");
    sh.classList.toggle("folded", hide);
    while(el && !el.classList.contains("sechead")){
      el.style.display = hide ? "none" : "";
      el = el.nextElementSibling;
    }
  });
});
$("#settingsBtn").addEventListener("click", ()=>{
  $("#setTeams").value=S.settings.teams; $("#setRoster").value=S.settings.roster;
  $("#setSlot").value=S.settings.slot; $("#setScoring").value=S.settings.scoring;
  $("#setName").value=S.settings.name||"Buck Breakers";
  $("#setCompact").checked=!!S.settings.compact;
  const cols=S.settings.cols||{};
  $("#colADP").checked=cols.adp!==false; $("#colEdge").checked=cols.edge!==false; $("#colRd").checked=cols.rd!==false;
  $("#setSound").checked=S.settings.sound!==false;
  $("#setSpeak").checked=!!S.settings.speak;
  $("#setDraftDate").value=S.settings.draftDate||"";
  $("#setFlair").value=S.settings.flair||"";
  $("#setAccent").value=S.settings.accent||"green";
  $("#setFavState").value=S.settings.favState||"";
  $("#setFavCollege").value=S.settings.favCollege||"";
  $("#setTimer").value=S.settings.timerSecs||0;
  $("#setLowData").checked=!!S.settings.lowData;
  $("#setNotify").checked=!!S.settings.notifyInj;
  const rs=$("#setRival");
  rs.innerHTML='<option value="">none</option>'+Array.from({length:S.settings.teams},(_,i)=>i+1)
    .filter(s2=>s2!==S.settings.slot).map(s2=>'<option value="'+s2+'"'+(+S.settings.rivalSlot===s2?' selected':'')+'>'+esc(slotName(s2))+'</option>').join("");
  renderTrophies(); renderAchievements();
  $("#setBaCount").value=S.settings.baCount||15;
  $("#setSimN").value=S.settings.simN||30;
  $("#setRisk").value=S.settings.risk||"balanced";
  $("#setSheetCount").value=S.settings.sheetCount||200;
  $("#setSheetNotes").checked=!!S.settings.sheetNotes;
  refreshProfiles(); refreshProjStatus();
  const su = document.getElementById("storageUse");
  if(su && navigator.storage && navigator.storage.estimate){
    navigator.storage.estimate().then(e2=>{
      su.textContent = "Storage: "+((e2.usage||0)/1048576).toFixed(1)+" MB used of "+((e2.quota||0)/1073741824).toFixed(1)+" GB available.";
    }).catch(()=>{});
  }
  $("#setPtd").value=String(S.settings.ptd||6);
  $("#setRecPts").value = S.settings.recPts==null ? "" : S.settings.recPts;
  $("#setTePrem").value = S.settings.tePrem||0;
  for(const pos of POSITIONS) $("#min"+pos).value=S.settings.min[pos]||0;
  $("#settingsOverlay").classList.add("show");
});
$("#settingsCancel").addEventListener("click", ()=>$("#settingsOverlay").classList.remove("show"));
$("#settingsSave").addEventListener("click", ()=>{
  S.settings.teams = Math.max(4, +$("#setTeams").value||12);
  S.settings.roster = Math.max(8, +$("#setRoster").value||16);
  S.settings.slot = Math.max(1, +$("#setSlot").value||12);
  S.settings.scoring = $("#setScoring").value==="half" ? "half" : "ppr";
  S.settings.ptd = +$("#setPtd").value===4 ? 4 : 6;
  const rp = $("#setRecPts").value.trim();
  S.settings.recPts = rp==="" ? null : Math.min(2, Math.max(0, parseFloat(rp)||0));
  S.settings.tePrem = Math.min(1, Math.max(0, parseFloat($("#setTePrem").value)||0));
  S.settings.name = $("#setName").value.trim() || "Buck Breakers";
  S.settings.compact = $("#setCompact").checked;
  S.settings.sound = $("#setSound").checked;
  S.settings.speak = $("#setSpeak").checked;
  S.settings.draftDate = $("#setDraftDate").value || null;
  S.settings.flair = $("#setFlair").value.trim();
  S.settings.accent = $("#setAccent").value;
  S.settings.favState = $("#setFavState").value.trim().toUpperCase().slice(0,2);
  S.settings.favCollege = $("#setFavCollege").value.trim();
  S.settings.timerSecs = Math.max(0, +$("#setTimer").value||0);
  S.settings.lowData = $("#setLowData").checked;
  const wantNotify = $("#setNotify").checked;
  if(wantNotify && !S.settings.notifyInj && "Notification" in window && Notification.permission==="default"){
    Notification.requestPermission();
  }
  S.settings.notifyInj = wantNotify;
  S.settings.rivalSlot = $("#setRival").value ? +$("#setRival").value : null;
  S.settings.cols = {adp:$("#colADP").checked, edge:$("#colEdge").checked, rd:$("#colRd").checked};
  S.settings.baCount = Math.min(30, Math.max(5, +$("#setBaCount").value||15));
  S.settings.simN = Math.min(100, Math.max(20, +$("#setSimN").value||30));
  S.settings.risk = $("#setRisk").value;
  S.settings.sheetCount = Math.min(390, Math.max(50, +$("#setSheetCount").value||200));
  S.settings.sheetNotes = $("#setSheetNotes").checked;
  applyTheme();
  for(const pos of POSITIONS) S.settings.min[pos] = Math.max(0, +$("#min"+pos).value||0);
  $("#settingsOverlay").classList.remove("show");
  commit();
});

$("#debugBtn").addEventListener("click", ()=>{
  const info = {
    build: BUILD, data: typeof DATA_STAMP!=="undefined"?DATA_STAMP:"?",
    stateBytes: JSON.stringify(S).length,
    players: allPlayers().length, log: S.log.length, mine: S.mine.length,
    settings: S.settings, errors: window._errLog,
    ua: navigator.userAgent,
  };
  navigator.clipboard.writeText("Draft War Room debug\n"+JSON.stringify(info,null,2)).then(()=>toast("🐞 Debug info copied"));
});
$("#defaultsBtn").addEventListener("click", ()=>{
  if(!confirm("Reset all settings to Buck Breakers defaults? Board, notes and names are untouched.")) return;
  S.settings = defaultState().settings;
  $("#settingsOverlay").classList.remove("show");
  applyTheme(); commit();
  toast("Settings restored to defaults");
});
$("#restoreBtn").addEventListener("click", ()=>{
  const raw = localStorage.getItem(LS_KEY+"-backup");
  if(!raw) return alert("No backup found. One is saved automatically before every import or reset.");
  try{
    const b = JSON.parse(raw);
    if(!confirm("Restore the board from the backup saved "+b.when+"? Current state will be backed up first.")) return;
    const cur = JSON.stringify({when:new Date().toLocaleString(), state:S});
    S = Object.assign(defaultState(), b.state);
    localStorage.setItem(LS_KEY+"-backup", cur);   // swap, so restore is reversible
    $("#settingsOverlay").classList.remove("show");
    commit();
  }catch(e){ alert("Backup is corrupted."); }
});

/* Add player modal */
$("#addBtn").addEventListener("click", ()=>{ $("#addName").value=""; $("#addTeam").value=""; $("#addProj").value=""; $("#addOverlay").classList.add("show"); $("#addName").focus(); });
$("#addCancel").addEventListener("click", ()=>$("#addOverlay").classList.remove("show"));
$("#addSave").addEventListener("click", ()=>{
  const name=$("#addName").value.trim(), team=$("#addTeam").value.trim().toUpperCase()||"FA",
        pos=$("#addPos").value, proj=parseFloat($("#addProj").value)||0;
  if(!name) return alert("Name required");
  S.custom.push([name,team,pos,proj,"c"+Date.now()]);
  $("#addOverlay").classList.remove("show");
  commit();
});
document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click", e=>{ if(e.target===o) o.classList.remove("show"); }));
new MutationObserver(muts=>{
  for(const m of muts){
    const el = m.target;
    if(el.classList.contains("show") && el.classList.contains("overlay")){
      const f = el.querySelector("input:not([type=hidden]),select,textarea") || el.querySelector("button");
      if(f && !el.contains(document.activeElement)) setTimeout(()=>f.focus(), 60);
    }
  }
}).observe(document.body, {attributes:true, attributeFilter:["class"], subtree:true});

/* Printable cheat sheet */
$("#sheetBtn").addEventListener("click", ()=>{
  const players=allPlayers(), repl=replacementLevels(players), tm=tierMap(players), rinfo=roundInfo(players);
  const rows=players.map(p=>({p, vorp:p.proj-(repl[p.pos]||0)})).sort((a,b)=>b.vorp-a.vorp).slice(0, S.settings.sheetCount||200);
  let html='<!DOCTYPE html><html><head><title>Buck Breakers Cheat Sheet</title><style>'+
    'body{font-family:Arial,sans-serif;font-size:10px;margin:18px} h1{font-size:15px;margin:0 0 2px} p{margin:0 0 10px;color:#555;font-size:9px}'+
    'table{border-collapse:collapse;width:100%} th,td{border:1px solid #bbb;padding:2px 5px;text-align:left} th{background:#eee}'+
    'tr:nth-child(even){background:#f6f6f6} .t1{font-weight:bold} @media print{body{margin:8px}}'+
    '</style></head><body><h1>Draft War Room — Cheat Sheet</h1>'+
    '<p>Buck Breakers · superflex · 6pt pass TD · slot '+S.settings.slot+' · top 200 by value over replacement · ★=analyst target ▲▼=prop lean</p>'+
    '<table><tr><th>#</th><th>Player</th><th>Pos</th><th>Tm</th><th>Tier</th><th>Proj</th><th>Value</th><th>ADP</th><th>Rd</th><th></th>'+(S.settings.sheetNotes?'<th>Notes</th>':'')+'</tr>';
  rows.forEach((r,i)=>{
    const p=r.p, badges=(p.intel&&p.intel.t!=null?"★":"")+(p.intel&&p.intel.lean>0?"▲":p.intel&&p.intel.lean<0?"▼":"")+
      ((S.boost||{})[p.id]===1?" MY-GUY":(S.boost||{})[p.id]===-1?" FADE":"")+((S.tierBump||{})[p.id]?" T-adj":"");
    html+='<tr class="'+(tm[p.id]===1?'t1':'')+'"><td>'+(i+1)+'</td><td>'+p.name+'</td><td>'+p.pos+'</td><td>'+p.team+'</td><td>T'+tm[p.id]+'</td><td>'+p.proj+'</td><td>'+Math.round(r.vorp)+'</td><td>'+(p.adp||"")+'</td><td>'+(rinfo[p.id]?rinfo[p.id].label:"")+'</td><td>'+badges+'</td>'+(S.settings.sheetNotes?'<td>'+((S.notes[p.id]||"").slice(0,40))+'</td>':'')+'</tr>';
  });
  html+='</table></body></html>';
  const w=window.open("about:blank");
  if(w){ w.document.write(html); w.document.close(); }
});

/* CSV export of the evaluated board */
$("#csvBtn").addEventListener("click", ()=>{
  const players=allPlayers(), repl=replacementLevels(players), tm=tierMap(players), rinfo=roundInfo(players);
  const q = s => '"'+String(s).replace(/"/g,'""')+'"';
  let csv = "Rank,Player,Pos,Team,Tier,Proj,ValueOverRepl,ADP,ExpectedRound,Status,Note\n";
  players.map(p=>({p, vorp:p.proj-(repl[p.pos]||0)})).sort((a,b)=>b.vorp-a.vorp).forEach((r,i)=>{
    const p=r.p, st = S.mine.includes(p.id)?"mine":(S.taken[p.id]?"taken":(S.dnd[p.id]?"do-not-draft":"available"));
    csv += [i+1, q(p.name), p.pos, p.team, tm[p.id], p.proj, Math.round(r.vorp), p.adp||"", rinfo[p.id]?rinfo[p.id].label:"", st, q(S.notes[p.id]||"")].join(",")+"\n";
  });
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="draft-war-room-board.csv"; a.click(); URL.revokeObjectURL(a.href);
});

/* Help modal */
document.getElementById("fabSearch").addEventListener("click", ()=>{ $("#search").focus(); $("#search").scrollIntoView({block:"center"}); });
document.getElementById("fabInj").addEventListener("click", ()=>document.getElementById("injBtn").click());
document.getElementById("fabUndo").addEventListener("click", undoLast);
document.getElementById("changelogBtn").addEventListener("click", async ()=>{
  try{
    const r = await fetch("CHANGELOG.md");
    const txt = await r.text();
    $("#cardBody").innerHTML = '<div class="chead"><div class="cid"><div class="cname">📜 Changelog</div></div></div>'+
      '<div class="cintel" style="white-space:pre-wrap;font-size:12px;line-height:1.6;max-height:55vh;overflow-y:auto">'+esc(txt)+'</div><div class="cacts"></div>';
    document.getElementById("helpOverlay").classList.remove("show");
    $("#cardOverlay").classList.add("show");
  }catch(e){ toast("Changelog needs a network/HTTP context", {warn:true}); }
});
function renderPrepCheck(){
  const el = document.getElementById("prepCheck");
  if(!el) return;
  const ck = (ok, label) => (ok?"✅":"⬜")+" "+label+"<br>";
  el.innerHTML =
    ck(S.settings.slot===12 || S.settings.slot>0, "Draft slot set (you: "+S.settings.slot+")")+
    ck(Object.keys(S.slotNames||{}).length>0, "League names on the board")+
    ck(!!(S.settings.favState||S.settings.favCollege), "💖 favorites set"+(S.settings.favState?" ("+S.settings.favState+")":""))+
    ck(S.queue.length>0, "Queue seeded ("+S.queue.length+" players)")+
    ck(Object.keys(S.plan||{}).length>0, "Plan pinned ("+Object.keys(S.plan||{}).length+" rounds)")+
    ck(Object.keys(S.boost||{}).length>0, "Boost/fade list started")+
    ck(!!S.settings.draftDate, "Draft date set");
}
$("#helpBtn").addEventListener("click", ()=>{ renderPrepCheck(); $("#helpOverlay").classList.add("show"); });
$("#helpClose").addEventListener("click", ()=>$("#helpOverlay").classList.remove("show"));

/* Runtime projections import */
function parseCsvLine(line){
  const out=[]; let cur="", q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(q){ if(ch==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else if(ch==='"') q=true;
    else if(ch===','){ out.push(cur); cur=""; }
    else cur+=ch;
  }
  out.push(cur);
  return out;
}
function refreshProjStatus(){
  const el=$("#projStatus"); if(!el) return;
  el.textContent = S.dataRows && S.dataRows.length
    ? "Using imported dataset: "+S.dataRows.length+" players (rev "+(S.dataRev||1)+"). ADP and intel merged by name."
    : "Using built-in dataset ("+RAW.length+" players, "+DATA_STAMP+").";
  const ao = Object.keys(S.adpOverride||{}).length;
  if(ao) el.textContent += " Manual ADP overrides: "+ao+".";
}
$("#projImportBtn").addEventListener("click", ()=>$("#projFile").click());
$("#projTemplateBtn").addEventListener("click", ()=>{
  const t = "PLAYER,TEAM,POS,PPR,HALF,PATD\nJosh Allen,BUF,QB,365.8,352,25.6\nBijan Robinson,ATL,RB,339.3,283.1,0\nJa'Marr Chase,CIN,WR,331.6,256,0\nBrock Bowers,LVR,TE,249.4,190.7,0\nBroncos D/ST,DEN,DEF,135,135,0\n";
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([t],{type:"text/csv"}));
  a.download="projections-template.csv"; a.click(); URL.revokeObjectURL(a.href);
});
$("#projRevertBtn").addEventListener("click", ()=>{ S.dataRows=null; S.dataRev=(S.dataRev||0)+1; commit(); refreshProjStatus(); toast("Reverted to built-in projections"); });
$("#projFile").addEventListener("change", e=>{
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    const lines=String(rd.result).split(/\r?\n/).filter(l=>l.trim());
    const head=parseCsvLine(lines[0]).map(s=>s.trim().toUpperCase());
    const ix=n=>head.indexOf(n);
    const iN=ix("PLAYER")<0?ix("NAME"):ix("PLAYER"), iT=ix("TEAM"), iP=ix("POS"), iPPR=ix("PPR"), iH=ix("HALF"), iTD=ix("PATD");
    if(iN<0||iT<0||iP<0||iPPR<0){ toast("CSV needs PLAYER/NAME, TEAM, POS, PPR columns", {warn:true}); e.target.value=""; return; }
    const adpBy={}, patdBy={};
    RAW.forEach(r=>{ const k=normName(r[0]); if(r[5]) adpBy[k]=r[5]; if(r[6]) patdBy[k]=r[6]; });
    const rows=[];
    for(let i=1;i<lines.length;i++){
      const c=parseCsvLine(lines[i]);
      const name=(c[iN]||"").trim(); if(!name) continue;
      let pos=(c[iP]||"").trim().toUpperCase(); if(pos==="DST"||pos==="D/ST") pos="DEF";
      if(!POSITIONS.includes(pos)) continue;
      let ppr=parseFloat(c[iPPR]); if(isNaN(ppr)) continue;
      let half=iH>=0?parseFloat(c[iH]):ppr; if(isNaN(half)) half=ppr;
      const k=normName(name);
      let patd=iTD>=0?(parseFloat(c[iTD])||0):(patdBy[k]||0);
      if(iTD>=0 || patdBy[k]==null){ ppr+=2*patd; half+=2*patd; }  // normalize to 6pt storage
      else { ppr+=0; half+=0; }
      if(pos!=="DEF" && ppr<25) continue;
      rows.push([name,(c[iT]||"").trim().toUpperCase(),pos,Math.round(ppr*10)/10,Math.round(half*10)/10,adpBy[k]||0,patd]);
    }
    if(rows.length<50){ toast("Only parsed "+rows.length+" players — import aborted", {warn:true}); e.target.value=""; return; }
    const curNames = new Set(allPlayers().map(p=>normName(p.name)));
    const fresh = rows.filter(r2=>!curNames.has(normName(r2[0]))).length;
    if(!confirm("Import preview:\n• "+rows.length+" players parsed\n• "+fresh+" names not on the current board\n• current dataset will be replaced (backup saved)\n\nApply?")){ e.target.value=""; return; }
    backupState();
    S.dataRows=rows; S.dataRev=(S.dataRev||0)+1;
    commit(); refreshProjStatus();
    toast("Loaded "+rows.length+" players from CSV");
  };
  rd.readAsText(f);
  e.target.value="";
});

/* Personal prep export/import (#319) */
document.getElementById("prepExportBtn").addEventListener("click", ()=>{
  const prep = {__warRoomPrep:1, notes:S.notes, boost:S.boost, tierBump:S.tierBump, adpOverride:S.adpOverride,
                dnd:S.dnd, queue:S.queue, queueRounds:S.queueRounds, plan:S.plan};
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(prep,null,2)],{type:"application/json"}));
  a.download = "war-room-prep.json"; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById("prepImportBtn").addEventListener("click", ()=>document.getElementById("prepFile").click());
document.getElementById("prepFile").addEventListener("change", e=>{
  const f = e.target.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = ()=>{
    try{
      const j = JSON.parse(rd.result);
      if(!j.__warRoomPrep) throw 0;
      ["notes","boost","tierBump","adpOverride","dnd","queueRounds","plan"].forEach(k=>Object.assign(S[k], j[k]||{}));
      (j.queue||[]).forEach(id=>{ if(!S.queue.includes(id)) S.queue.push(id); });
      commit(); toast("📥 Prep merged (notes, boosts, plan, queue)");
    }catch(err){ toast("Not a prep file", {warn:true}); }
  };
  rd.readAsText(f); e.target.value = "";
});

/* Board profiles */
const PROF_KEY = LS_KEY+"-profiles";
function renderAchievements(){
  const box = document.getElementById("achCase");
  if(!box) return;
  let got = {};
  try{ got = JSON.parse(localStorage.getItem(LS_KEY+"-ach")||"{}"); }catch(e){}
  box.innerHTML = ACHIEVEMENTS.map(([id,label,desc])=>
    '<span class="chip" style="'+(got[id]?'color:var(--gold);border-color:rgba(255,201,77,.5)':'opacity:.45')+'" title="'+esc(desc)+(got[id]?' — earned '+new Date(got[id]).toLocaleDateString():' — locked')+'">'+label+'</span> ').join("");
}
function renderTrophies(){
  const box = document.getElementById("trophyCase");
  if(!box) return;
  const all = profAll();
  const finals = Object.keys(all).filter(n=>n.startsWith("🏁"));
  if(!finals.length){ box.innerHTML = '<span class="dimtxt">No finished drafts yet — finish one and it lands here automatically.</span>'; return; }
  const byId = idIndex();
  box.innerHTML = finals.map(n=>{
    let pts = "";
    try{
      const st2 = all[n];
      const ids = (st2.mine||[]).concat(Object.keys(st2.keepers||{}).filter(id=>+st2.keepers[id]===+(st2.settings||{}).slot));
      if(ids.length) pts = fmt(bestStarters(ids, byId).pts)+" pts";
    }catch(e){}
    return '<div class="mkrow">🏆 <span class="mn">'+esc(n)+'</span> <span class="mono dimtxt">'+pts+'</span></div>';
  }).join("");
}
function profAll(){ try{ return JSON.parse(localStorage.getItem(PROF_KEY))||{}; }catch(e){ return {}; } }
function refreshProfiles(){
  const sel=$("#profileSel"); if(!sel) return;
  const names=Object.keys(profAll());
  sel.innerHTML = names.length ? names.map(n=>'<option>'+esc(n)+'</option>').join("") : '<option value="">(none saved)</option>';
  const q = document.getElementById("profQuick");
  if(q){
    q.style.display = names.length ? "" : "none";
    q.innerHTML = '<option value="">boards…</option>'+names.map(n=>'<option>'+esc(n)+'</option>').join("");
  }
}
document.getElementById("profQuick").addEventListener("change", e=>{
  const name = e.target.value; if(!name) return;
  const all = profAll();
  if(!all[name]) return;
  if(!confirm("Switch to board '"+name+"'? Current board is backed up.")) { e.target.value=""; return; }
  backupState();
  S = Object.assign(defaultState(), migrate(all[name]));
  e.target.value = "";
  commit(); toast("Loaded: "+esc(name));
});
$("#profSnap").addEventListener("click", ()=>{
  const all = profAll();
  const name = "📸 "+new Date().toLocaleString([], {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});
  all[name] = JSON.parse(JSON.stringify(S));
  localStorage.setItem(PROF_KEY, JSON.stringify(all));
  refreshProfiles(); toast("Snapshot saved: "+esc(name));
});
$("#profSave").addEventListener("click", ()=>{
  const name=prompt("Save current board as:", S.settings.name||"Board 1");
  if(!name) return;
  const all=profAll(); all[name]=JSON.parse(JSON.stringify(S));
  localStorage.setItem(PROF_KEY, JSON.stringify(all));
  refreshProfiles(); toast("Saved profile: "+esc(name));
});
$("#profLoad").addEventListener("click", ()=>{
  const name=$("#profileSel").value; const all=profAll();
  if(!name || !all[name]) return toast("No profile selected", {warn:true});
  if(!confirm("Load '"+name+"'? Current board is backed up first.")) return;
  backupState();
  S = Object.assign(defaultState(), all[name]);
  $("#settingsOverlay").classList.remove("show");
  commit(); toast("Loaded profile: "+esc(name));
});
$("#profDel").addEventListener("click", ()=>{
  const name=$("#profileSel").value; const all=profAll();
  if(!name || !all[name]) return;
  if(!confirm("Delete profile '"+name+"'?")) return;
  delete all[name];
  localStorage.setItem(PROF_KEY, JSON.stringify(all));
  refreshProfiles();
});

async function copyShareLink(){
  try{
    const cs = new Blob([JSON.stringify(S)]).stream().pipeThrough(new CompressionStream("gzip"));
    const buf = new Uint8Array(await new Response(cs).arrayBuffer());
    let bin = ""; buf.forEach(b=>bin+=String.fromCharCode(b));
    const b64 = btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    const url = location.origin+location.pathname+"#b="+b64+(window._shareRO?"~ro":"");
    await navigator.clipboard.writeText(url);
    toast((window._shareRO?"👁 Spectator":"🔗 Board")+" link copied ("+(url.length/1024).toFixed(1)+" KB)");
    window._shareRO = false;
  }catch(e){ toast("Share link failed: "+esc(e.message), {warn:true}); }
}
async function loadSharedBoard(){
  const m = location.hash.match(/#b=([A-Za-z0-9_-]+)(~ro)?/);
  if(!m) return false;
  if(m[2]){ window._spectate = true; document.body.classList.add("spectate"); }
  try{
    const bin = Uint8Array.from(atob(m[1].replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
    const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"));
    const j = JSON.parse(await new Response(ds).text());
    if(!window._spectate) backupState();
    S = Object.assign(defaultState(), migrate(j));
    S.slotNames = Object.assign(defaultState().slotNames, j.slotNames||{});
    history.replaceState(null, "", location.pathname);
    if(window._spectate) toast("👁 Spectating a shared board — nothing is saved");
    else { save(); toast("📥 Shared board loaded — your previous board is in Settings → Restore backup"); }
    return true;
  }catch(e){ toast("Share link unreadable", {warn:true}); return false; }
}
document.getElementById("shareBtn").addEventListener("click", copyShareLink);
document.getElementById("roShareBtn").addEventListener("click", ()=>{ window._shareRO = true; copyShareLink(); });

/* Auto-backup before destructive actions */
function backupState(){
  try{ localStorage.setItem(LS_KEY+"-backup", JSON.stringify({when:new Date().toLocaleString(), state:S})); }catch(e){}
}

/* Export / Import / Reset */
$("#exportBtn").addEventListener("click", ()=>{
  const full = {__warRoomBackup:1, build:BUILD, when:new Date().toISOString(), state:S, profiles:profAll()};
  try{ full.injuries = JSON.parse(localStorage.getItem(LS_KEY+"-inj")); }catch(e2){}
  const blob = new Blob([JSON.stringify(full,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "draft-war-room-save.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
$("#importBtn").addEventListener("click", ()=>$("#importFile").click());
$("#importFile").addEventListener("change", e=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      const parsed = JSON.parse(r.result);
      backupState();
      if(parsed.__warRoomBackup){
        S = Object.assign(defaultState(), migrate(parsed.state||{}));
        if(parsed.profiles) localStorage.setItem(PROF_KEY, JSON.stringify(parsed.profiles));
        if(parsed.injuries) localStorage.setItem(LS_KEY+"-inj", JSON.stringify(parsed.injuries));
        initInjuries();
        toast("📥 Full backup restored ("+(parsed.when||"").slice(0,10)+")");
      } else {
        S = Object.assign(defaultState(), migrate(parsed));
      }
      commit();
    }catch(err){ alert("Invalid save file"); }
  };
  r.readAsText(f);
  e.target.value="";
});
$("#resetBtn").addEventListener("click", ()=>{
  if(confirm("Reset the whole board? This clears your roster, taken players, and log. (Settings & custom players are kept. A backup is saved — restore it from ⚙ Settings.)")){
    backupState();
    const keep = {settings:S.settings, custom:S.custom, overrides:S.overrides, notes:S.notes, dnd:S.dnd};
    S = Object.assign(defaultState(), keep);
    commit();
  }
});

/* ---------- Lock screen ---------- */
const LOCK_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // sha256("1234")
async function sha256hex(s){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
const LOCK_QUIPS = [
  "Buck Breakers War Room. Let's get this done.",
  "12 teams enter. One Otto leaves happy.",
  "The Schindlers are already nervous.",
  "Value doesn't draft itself.",
  "Trust the board. Fear the turn.",
];
function initLock(){
  const q = document.querySelector("#lockScreen .lockbox h1 + p");
  if(q){
    const m = new Date().getMonth();
    const seasonal = m===7 ? "It's draft szn. " : m>=8&&m<=11 ? "Season's live. " : "";
    q.textContent = seasonal + LOCK_QUIPS[Math.floor(Math.random()*LOCK_QUIPS.length)];
  }
  const scr = document.getElementById("lockScreen");
  const e2e = location.search.indexOf("e2e") >= 0;
  if(e2e || !window.crypto || !crypto.subtle){ scr.remove(); return; }
  try{ if(localStorage.getItem(LS_KEY+"-auth")===LOCK_HASH){ scr.remove(); return; } }catch(e){}
  scr.style.display = "flex";
  document.getElementById("lockPass").focus();
  document.getElementById("lockForm").addEventListener("submit", async ev=>{
    ev.preventDefault();
    const v = document.getElementById("lockPass").value;
    if((await sha256hex(v)) === LOCK_HASH){
      try{ localStorage.setItem(LS_KEY+"-auth", LOCK_HASH); }catch(e){}
      scr.classList.add("unlocking");
      setTimeout(()=>scr.remove(), 450);
      toast("🏈 Welcome back, Otto — let's get this done.");
    } else {
      const box = scr.querySelector(".lockbox");
      box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
      document.getElementById("lockNote").textContent = "nope — try the classic";
      document.getElementById("lockPass").value = "";
    }
  });
}
initLock();

/* ---------- Boot ---------- */
load();
if(location.search.indexOf("wall")>=0){
  document.addEventListener("DOMContentLoaded", ()=>{});
  setTimeout(()=>{
    document.body.innerHTML = '<div id="wallWrap"><h1 style="color:var(--green);letter-spacing:2px">'+esc(S.settings.name||"DRAFT")+' — LIVE BOARD</h1><div id="boardGrid"></div></div>';
    document.body.className = "wall";
    const draw = ()=>{ try{ renderBoard(); }catch(e){} };
    draw();
    window.addEventListener("storage", e2=>{ if(e2.key===LS_KEY && e2.newValue){ try{ S = Object.assign(defaultState(), migrate(JSON.parse(e2.newValue))); _memo={key:null}; draw(); }catch(err){} } });
    setInterval(draw, 30000);
  }, 400);
}
if(location.search.indexOf("demo")>=0 && location.search.indexOf("e2e")<0){
  window._spectate = true;
  document.body.classList.add("spectate");
  setTimeout(()=>{
    const byAdp = allPlayers().filter(p=>p.adp>0).sort((a,b)=>a.adp-b.adp);
    S.taken={}; S.mine=[]; S.log=[]; S.keepers={}; S.queue=[];
    byAdp.slice(0,11).forEach(p=>{ S.taken[p.id]=true; S.log.push({id:p.id, who:"other", t:Date.now()}); });
    _memo={key:null};
    render();
    toast("🎮 Demo mode — a live board at your pick, nothing is saved");
  }, 700);
}
setTimeout(()=>{
  const mo = (location.hash.match(/#open=(\w+)/)||[])[1];
  if(mo){
    history.replaceState(null, "", location.pathname);
    const map = {inj:"injBtn", mocks:"mocksBtn", board:"boardBtn", report:"gradeBtn"};
    const btn = document.getElementById(map[mo]||"");
    if(btn) btn.click();
  }
  refreshProfiles();
}, 600);
if(location.hash.indexOf("#b=")===0){ loadSharedBoard().then(ok=>{ if(ok){ initInjuries(); render(); } }); }
initInjuries();
const E2E_MODE = location.search.indexOf("e2e") >= 0;   // deterministic test runs: no network side-effects
if(!E2E_MODE && location.protocol.indexOf("http")===0){
  setTimeout(()=>{ refreshInjuries(true); refreshTrending(); }, 1500);
  setInterval(()=>{ if(document.visibilityState==="visible") refreshInjuries(true); }, 5*60e3);
  setInterval(()=>{ if(document.visibilityState==="visible") refreshTrending(); }, 15*60e3);
  setInterval(()=>{
    if(S.ui.live && S.settings.timerSecs && document.visibilityState==="visible"){
      const h2 = nextPickHorizon();
      if(h2 && h2.onClock) renderBest();
    }
  }, 1000);
}
document.querySelectorAll(".modal").forEach((m,i)=>{
  m.setAttribute("role","dialog"); m.setAttribute("aria-modal","true");
  const h3 = m.querySelector("h3");
  if(h3){ if(!h3.id) h3.id = "dlg"+i; m.setAttribute("aria-labelledby", h3.id); }
});
const BUILD = "6.0";
let _installEvt = null;
window.addEventListener("beforeinstallprompt", e=>{
  e.preventDefault();
  _installEvt = e;
  const b = document.getElementById("installBtn");
  if(b) b.style.display = "";
});
document.addEventListener("click", e=>{
  if(e.target && e.target.id==="installBtn" && _installEvt){
    _installEvt.prompt();
    _installEvt = null;
    e.target.style.display = "none";
  }
});
/* Theme: auto follows the OS, or force dark/light */
function applyTheme(){
  const pref = S.settings.theme || "auto";
  const dark = pref==="auto" ? !window.matchMedia("(prefers-color-scheme: light)").matches : pref==="dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.content = dark ? "#0b0f14" : "#eef2f7";
  const b = document.getElementById("themeBtn");
  if(b) b.textContent = pref==="auto" ? "🌓" : (pref==="dark" ? "🌙" : "☀️");
  document.documentElement.classList.toggle("terminal", S.settings.accent==="terminal");
  const ACCENTS = {green:["#2fd47a","#1d8a50"], blue:["#5aa9ff","#2f6fc0"], gold:["#ffc94d","#b98a1a"], terminal:["#33ff33","#1f9922"]};
  const acc = ACCENTS[S.settings.accent] || null;
  if(acc){ document.documentElement.style.setProperty("--green", acc[0]); document.documentElement.style.setProperty("--green-dim", acc[1]); }
  else { document.documentElement.style.removeProperty("--green"); document.documentElement.style.removeProperty("--green-dim"); }
  document.body.classList.toggle("compact", !!S.settings.compact);
  document.body.classList.toggle("live", !!S.ui.live);
  const cols = S.settings.cols || {};
  document.body.classList.toggle("hidecol-adp", cols.adp===false);
  document.body.classList.toggle("hidecol-edge", cols.edge===false);
  document.body.classList.toggle("hidecol-rd", cols.rd===false);
}
let _wakeLock = null;
async function holdWake(on){
  try{
    if(on && "wakeLock" in navigator){ _wakeLock = await navigator.wakeLock.request("screen"); }
    else if(_wakeLock){ _wakeLock.release(); _wakeLock = null; }
  }catch(e){}
}
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && S.ui.live) holdWake(true); });
function setLive(on){
  S.ui.live = on;
  holdWake(on);
  if(on){ S.ui.liveStart = Date.now(); S.ui.liveLen0 = S.log.length; }
  document.body.classList.toggle("live", on);
  const b = document.getElementById("liveBtn");
  b.classList.toggle("liveon", on);
  b.textContent = on ? "🔴 LIVE" : "⚪ Live";
  save(); render();
  toast(on ? "🔴 Draft Day mode ON — chime + panic button armed" : "Live mode off");
}
document.getElementById("liveBtn").addEventListener("click", ()=>setLive(!S.ui.live));
function announce(text){
  if(!S.settings.speak || !S.ui.live || !("speechSynthesis" in window)) return;
  try{
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.15; u.volume = 0.85;
    speechSynthesis.speak(u);
  }catch(e){}
}
function blip(){
  if(S.settings.sound===false || !S.ui.live) return;
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const o = ac.createOscillator(), g2 = ac.createGain();
    o.type = "square"; o.frequency.value = 520;
    o.connect(g2); g2.connect(ac.destination);
    g2.gain.setValueAtTime(0.05, ac.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+0.07);
    o.start(); o.stop(ac.currentTime+0.08);
  }catch(e){}
}
function stinger(kind){
  if(S.settings.sound===false) return;
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    if(kind==="horn"){
      [0,0.12,0.24].forEach(at=>{
        const o=ac.createOscillator(), g2=ac.createGain();
        o.type="sawtooth"; o.frequency.setValueAtTime(220, ac.currentTime+at);
        o.frequency.linearRampToValueAtTime(440, ac.currentTime+at+0.25);
        o.connect(g2); g2.connect(ac.destination);
        g2.gain.setValueAtTime(0.12, ac.currentTime+at);
        g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+at+0.3);
        o.start(ac.currentTime+at); o.stop(ac.currentTime+at+0.32);
      });
    } else {
      const o=ac.createOscillator(), g2=ac.createGain();
      o.type="triangle"; o.connect(g2); g2.connect(ac.destination);
      g2.gain.value=0.1;
      for(let i=0;i<6;i++){
        o.frequency.setValueAtTime(i%2?880:660, ac.currentTime+i*0.15);
      }
      g2.gain.setValueAtTime(0.1, ac.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+0.9);
      o.start(); o.stop(ac.currentTime+0.95);
    }
  }catch(e){}
}
function chime(){
  if(S.settings.sound===false) return;
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    [[880,0],[1174.7,0.18]].forEach(([f,at])=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.frequency.value=f; o.type="sine"; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.001, ac.currentTime+at);
      g.gain.exponentialRampToValueAtTime(0.22, ac.currentTime+at+0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+at+0.5);
      o.start(ac.currentTime+at); o.stop(ac.currentTime+at+0.55);
    });
  }catch(e){}
}
function toggleQueue(id){
  const i = S.queue.indexOf(id);
  if(i>=0) S.queue.splice(i,1); else S.queue.push(id);
  commit();
}
function pruneQueue(){ S.queue = (S.queue||[]).filter(id=>!offBoard(id)); }
function myRoundNow(){
  const mine = myOverallPicks(), cur = pickNow();
  const next = mine.find(x=>x>=cur);
  return next ? Math.ceil(next/S.settings.teams) : S.settings.roster+1;
}
function renderPlan(){
  const box = document.getElementById("planBox");
  if(!box) return;
  const entries = Object.keys(S.plan||{});
  const collapsed = window._planCollapsed;
  if(!entries.length){ box.innerHTML=""; box.style.display="none"; return; }
  box.style.display = "";
  const byId = idIndex(), rNow = myRoundNow();
  const keeperRounds = new Set(Object.values(S.keepers||{}).map(k=>k.r).filter(Boolean));
  let rows = "";
  if(!collapsed){
    rows = Array.from({length:S.settings.roster},(_,i)=>i+1).filter(r=>S.plan[r]||keeperRounds.has(r)).map(r=>{
      if(keeperRounds.has(r) && !S.plan[r]) return '<div class="barow"><span class="rk mono">R'+r+'</span><span class="dimtxt">🔒 keeper cost</span></div>';
      const p = byId[S.plan[r]];
      if(!p) return "";
      const gone = offBoard(p.id) && !S.mine.includes(p.id);
      const got = S.mine.includes(p.id);
      return '<div class="barow" data-card="'+p.id+'"><span class="rk mono">R'+r+'</span>'+avatarImg(p,20)+
        '<div class="info"><div class="nm" style="'+(gone?'text-decoration:line-through;opacity:.5':'')+'">'+p.name+
        (got?' <b class="ok">✓ GOT HIM</b>':gone?' <span class="low">sniped</span>':r<rNow?' <span class="mid">⏰ round passed</span>':'')+'</div></div>'+
        '<button class="kill" data-unplan="'+r+'" aria-label="Remove from plan">✕</button></div>';
    }).join("");
  }
  box.innerHTML = '<h2 style="cursor:pointer" data-plantoggle="1"><span class="dot" style="background:var(--wr);box-shadow:0 0 8px var(--wr)"></span> My Plan '+(collapsed?"▸":"▾")+
    '<button class="hbtn" data-planqueue="1" style="margin-left:auto;padding:2px 8px;font-size:10px" title="Seed the plan from your queue order">from queue</button></h2>'+
    (collapsed?"":'<div style="padding:6px 8px 10px">'+rows+'</div>');
}
function renderQueue(){
  pruneQueue();
  const box = document.getElementById("queueBox");
  if(!box) return;
  const byId = idIndex();
  if(!S.queue.length){ box.innerHTML=""; box.style.display="none"; return; }
  box.style.display = "";
  const oddsQ = survivalOdds();
  box.innerHTML = '<h2><span class="dot" style="background:var(--gold);box-shadow:0 0 8px var(--gold)"></span> My Queue'+
    '<button class="hbtn" data-qfill="1" style="margin-left:auto;padding:2px 8px;font-size:10px" title="Fill with the engine top needs">autofill</button></h2>'+
    '<div style="padding:6px 8px 10px">'+S.queue.map((id,i)=>{
      const p = byId[id]; if(!p) return "";
      const wantR = (S.queueRounds||{})[id];
      const lateQ = wantR && myRoundNow() > wantR;
      return '<div class="barow" data-card="'+id+'">'+avatarImg(p,22)+posBadge(p.pos)+
        '<div class="info"><div class="nm">'+p.name+(oddsQ&&oddsQ.h1[id]!=null&&oddsQ.h1[id]<60?' <span class="ib bear" title="Under 60% to survive to your pick — snipe risk">🎯</span>':'')+
        (wantR?' <span class="'+(lateQ?"low":"dimtxt")+'" style="font-size:9px" data-qround="'+id+'" title="Target round — click to change">R'+wantR+(lateQ?" ⏰":"")+'</span>':' <span class="dimtxt" style="font-size:9px;cursor:pointer" data-qround="'+id+'" title="Set a target round">+R?</span>')+'</div></div>'+
        '<button class="undo1" data-qup="'+i+'" aria-label="Move up"'+(i===0?' disabled':'')+'>↑</button>'+
        '<button class="undo1" data-qdn="'+i+'" aria-label="Move down"'+(i===S.queue.length-1?' disabled':'')+'>↓</button>'+
        '<button class="pick" data-pick="'+id+'">✓</button>'+
        '<button class="kill" data-queue="'+id+'" aria-label="Remove from queue">✕</button></div>';
    }).join("")+'</div>';
}
function updatePanic(hz, top){
  let bar = document.getElementById("panicBar");
  const want = hz && hz.onClock && S.ui.live && window._panicDismissed!==hz.cur && top;
  if(!want){ if(bar) bar.remove(); return; }
  if(!bar){ bar = document.createElement("div"); bar.id="panicBar"; document.body.appendChild(bar); }
  pruneQueue();
  const qTop = S.queue.length ? idIndex()[S.queue[0]] : null;
  const pickP = qTop || top.p;
  bar.innerHTML = '<span>🚨 PICK #'+hz.cur+' — YOU ARE ON THE CLOCK</span>'+
    '<button class="pick" data-pick="'+pickP.id+'" style="font-size:15px;padding:10px 18px">✓ TAKE '+esc(pickP.name.toUpperCase())+(qTop?" (QUEUED)":"")+'</button>'+
    '<button class="undo1" id="panicDismiss">✕</button>';
  bar.querySelector("#panicDismiss").addEventListener("click", ()=>{ window._panicDismissed=hz.cur; bar.remove(); });
}

document.getElementById("themeBtn").addEventListener("click", ()=>{
  const order = ["auto","dark","light"];
  S.settings.theme = order[(order.indexOf(S.settings.theme||"auto")+1)%3];
  save(); applyTheme();
  toast("Theme: "+S.settings.theme);
});
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyTheme);
let _konami = [];
document.addEventListener("keydown", e=>{
  _konami.push(e.key); _konami = _konami.slice(-10);
  if(_konami.join(",")==="ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a"){
    confetti(); stinger("horn");
    toast("🕹 <b>SUPER OTTO MODE</b> — nothing changes, but you feel unstoppable.");
  }
});

(function(){
  const av=document.getElementById("aboutVer");
  if(av) av.textContent = "v"+BUILD;
  const el=document.getElementById("buildStamp");
  if(el) el.textContent = "build v"+BUILD+" · projections "+(typeof DATA_STAMP!=="undefined"?DATA_STAMP:"?")+" · press ? for help";
  if(window._recovered) setTimeout(()=>toast("♻️ Save was corrupt — restored backup from "+esc(window._recovered), {warn:true}), 400);
  applyTheme();
  if(!S.seenTour && (typeof E2E_MODE==="undefined" || !E2E_MODE)){
    S.seenTour = true; save();
    setTimeout(()=>{ document.getElementById("helpOverlay").classList.add("show"); }, 900);
  }
  // stale projections hint (#58)
  try{
    const age = (Date.now() - new Date(DATA_STAMP).getTime())/86400000;
    if(age > 45 && !(S.dataRows&&S.dataRows.length)) setTimeout(()=>toast("📅 Built-in projections are "+Math.round(age)+" days old — Settings → import a fresh CSV", {warn:true}), 900);
  }catch(e){}
})();
function setOnlineUI(){
  const b = document.getElementById("saveBadge");
  document.body.classList.toggle("offline", navigator.onLine===false);
  if(navigator.onLine===false){ b.textContent = "📡 offline — cached data"; b.style.color = "var(--gold)"; }
  else { b.textContent = "Autosave on"; b.style.color = ""; }
}
window.addEventListener("storage", e=>{
  if(e.key !== LS_KEY || !e.newValue) return;
  try{
    S = Object.assign(defaultState(), migrate(JSON.parse(e.newValue)));
    _memo = {key:null};
    render();
    toast("🔄 Board updated in another tab");
  }catch(err){}
});
window.addEventListener("online", ()=>{ setOnlineUI(); refreshInjuries(true); });
window.addEventListener("offline", setOnlineUI);
let _hiddenAt = 0;
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState==="hidden") _hiddenAt = Date.now();
  else if(_hiddenAt && S.ui.live){ S.ui.hiddenMs = (S.ui.hiddenMs||0) + (Date.now()-_hiddenAt); _hiddenAt = 0; save(); }
});

let _lastErrToast = 0;
window._errLog = [];
function surfaceError(msg){
  window._errLog.push({t:new Date().toISOString(), m:String(msg).slice(0,200)});
  if(window._errLog.length>20) window._errLog.shift();
  const now = Date.now();
  if(now - _lastErrToast < 10000) return;
  _lastErrToast = now;
  toast("⚠️ Something broke: "+esc(String(msg).slice(0,120))+" — try a refresh; your board is saved.", {warn:true});
}
window.addEventListener("error", e=>surfaceError(e.message||"script error"));
window.addEventListener("unhandledrejection", e=>surfaceError((e.reason&&e.reason.message)||e.reason||"async error"));

/* #53: tell open sessions when a new version takes over */
if(typeof E2E_MODE!=="undefined" && !E2E_MODE && "serviceWorker" in navigator && location.protocol.indexOf("http")===0){
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{
    if(hadController) toast("⬆️ New version deployed", {action:{label:"RELOAD", fn:()=>location.reload()}});
  });
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
$("#showTaken").checked = S.ui.showTaken;
$("#roundFilter").value = S.ui.round || "ALL";
$("#fTargets").checked = !!S.ui.targetsOnly;
$("#fStacks").checked = !!S.ui.stacksOnly;
$("#fSurvive").checked = !!S.ui.survivors;
$("#fFallers").checked = !!S.ui.fallers;
$("#fHideHurt").checked = !!S.ui.hideHurt;
render();
