"use strict";

const POSITIONS = ["QB","RB","WR","TE","DEF"];
const LS_KEY = "draft-war-room-v2";

/* ---------- State ---------- */
const defaultState = () => ({
  taken: {},            // id -> true (drafted by someone else)
  pickOffset: 0,        // manual correction: real overall pick - marked picks
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
         JSON.stringify(S.overrides)+"|"+(S.pickOffset||0)+"|"+(S.dataRev||0)+"|"+INJ.at+"|"+JSON.stringify(S.settings);
}
function cached(name, fn){
  const k = stateKey();
  if(_memo.key!==k) _memo = {key:k};
  if(!(name in _memo)) _memo[name] = fn();
  return _memo[name];
}
function pickNow(){ return S.log.length + 1 + (S.pickOffset||0); }
function slotName(s){ return (S.slotNames && S.slotNames[s]) || ("T"+s); }
/* who has whom: slot -> [player ids], reconstructed from pick order */
function teamRosters(){
  const byId = idIndex(), t = S.settings.teams, ros = {};
  for(let s=1;s<=t;s++) ros[s] = [];
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
      const p = JSON.parse(raw);
      S = Object.assign(defaultState(), p);
      S.settings = Object.assign(defaultState().settings, p.settings||{});
      S.settings.min = Object.assign(defaultState().settings.min, (p.settings||{}).min||{});
      S.ui = Object.assign(defaultState().ui, p.ui||{});
      S.slotNames = Object.assign(defaultState().slotNames, p.slotNames||{});
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
  try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }
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
  const SRC = (S.dataRows && S.dataRows.length) ? S.dataRows : RAW;
  const base = SRC.map((r,i)=>({id:"p"+i, name:r[0], team:r[1], pos:r[2], proj:Math.round((r[col]-tdAdj*(r[6]||0))*10)/10, adp:r[5]||0}));
  const customs = S.custom.map((r,i)=>({id:r[4]||("c"+i), name:r[0], team:r[1], pos:r[2], proj:r[3], adp:0, custom:true}));
  const all = base.concat(customs);
  for(const p of all){
    if(S.overrides[p.id]!=null) p.proj = S.overrides[p.id];
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
  const trials = 30, s1 = {}, s2 = {};
  const R = S.settings.roster;
  for(let k=0;k<trials;k++){
    const rng = mulberry32(987654 + k*104729 + S.log.length*7919);
    const taken = new Set(Object.keys(S.taken)); S.mine.forEach(id=>taken.add(id));
    const cpu = seedCpuTeams(rng);
    for(let pk=from; pk<end; pk++){
      if(pk===at1) for(const p of players){ if(!taken.has(p.id)) s1[p.id]=(s1[p.id]||0)+1; }
      if(myPicks.has(pk)) continue;
      const r = Math.ceil(pk/t), idx = pk-(r-1)*t, slot = (r%2===1)?idx:t+1-idx;
      const avail = players.filter(p=>!taken.has(p.id));
      const best = cpuPick(avail, cpu[slot], r, rng, rinfo, R);
      if(best){ taken.add(best.id); cpu[slot][best.pos]++; if(pk<at1) gone[best.pos]++; }
    }
    if(end===at1) for(const p of players){ if(!taken.has(p.id)) s1[p.id]=(s1[p.id]||0)+1; }
    for(const p of players){ if(!taken.has(p.id)) s2[p.id]=(s2[p.id]||0)+1; }
  }
  for(const p of players){
    out1[p.id] = Math.round(100*(s1[p.id]||0)/trials);
    out2[p.id] = Math.round(100*(s2[p.id]||0)/trials);
  }
  for(const pos in gone) gone[pos] = Math.round(gone[pos]/trials*10)/10;
  return {at1, at2: at2||null, h1:out1, h2: at2?out2:null, posGone:gone};
}
function tierMap(players){ return cached("tiers", ()=>tierMapRaw(players)); }
function survivalOdds(){ return cached("odds", survivalOddsRaw); }
function roundInfo(players){ return cached("rounds", ()=>roundInfoRaw(players)); }
function replacementLevels(players){ return cached("repl", ()=>replacementLevelsRaw(players)); }
function oddsClass(v){ return v>=70 ? "ok" : v>=35 ? "mid" : "low"; }

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
  for(const id of S.mine){ const p=byId[id]; if(p) map[p.pos]++; }
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
const STARTABLE = {QB:2, RB:5, WR:5, TE:2, DEF:1};
/* Returns adjusted score. First player past startable = depth discount
   (QB3 is real superflex insurance); anything beyond that is dead weight
   and gets buried so it can never beat a live position. */
function satAdjust(pos, curCount, score){
  const over = curCount + 1 - (STARTABLE[pos]||1);
  if(over <= 0) return {score, note:null};
  if(over === 1 && pos!=="DEF") return {score: score*(pos==="QB"?0.45:0.3), note:"your "+pos+" starters are set — depth value only"};
  return {score: Math.min(score,0)-400, note:"you're saturated at "+pos};
}
function needInfo(){
  const counts = myCounts();
  const min = S.settings.min;
  const needs = {};
  let totalNeeded = 0;
  for(const pos of POSITIONS){
    needs[pos] = Math.max(0, (min[pos]||0) - counts[pos]);
    totalNeeded += needs[pos];
  }
  const picksLeft = Math.max(0, S.settings.roster - S.mine.length);
  return {counts, needs, totalNeeded, picksLeft};
}

function scoreBoard(){
  const players = allPlayers();
  const repl = replacementLevels(players);
  const {counts, needs, totalNeeded, picksLeft} = needInfo();
  const byId = idIndex();
  const myTeamsQB = new Set(), myTeamsPC = new Set(); // QB teams, pass-catcher teams I own
  for(const id of S.mine){
    const p = byId[id]; if(!p) continue;
    if(p.pos==="QB") myTeamsQB.add(p.team);
    if(p.pos==="WR"||p.pos==="TE") myTeamsPC.add(p.team);
  }
  const mustFill = totalNeeded >= picksLeft && picksLeft > 0; // out of slack: only needed positions
  const horizon = nextPickHorizon();
  const avail = players.filter(p => !S.taken[p.id] && !S.mine.includes(p.id) && !S.dnd[p.id]);
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
    // Analyst / prop-market intel
    if(p.intel){
      if(p.intel.t!=null){ score *= 1.04; why.push("⭐ analyst target: "+(p.intel.t||"flagged as a value pick")); }
      if(p.intel.lean>0){ score *= 1.03; why.push("▲ prop market leans bullish on his volume"); }
      if(p.intel.lean<0){ score *= 0.97; why.push("▼ prop market leans bearish on his volume"); }
    }
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
function confetti(){
  const colors = ["#2fd47a","#ffc94d","#5aa9ff","#ff6b6b","#b78cff"];
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
function toast(msg, opts){
  let wrap = document.getElementById("toastWrap");
  if(!wrap){ wrap = document.createElement("div"); wrap.id = "toastWrap"; document.body.appendChild(wrap); }
  const el = document.createElement("div");
  el.className = "toast" + (opts && opts.warn ? " warn" : "");
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
  redoStack.length=0; S.taken[id]=true; S.log.push({id, who:"other"}); commit();
  const p = idIndex()[id];
  if(p) toast("✕ <b>"+esc(p.name)+"</b> off the board", {undo:undoLast});
}
function pickMine(id){
  redoStack.length=0; S.mine.push(id); S.log.push({id, who:"me"}); commit();
  const p = idIndex()[id];
  if(p) toast("✓ Drafted <b style='color:var(--green)'>"+esc(p.name)+"</b>", {undo:undoLast});
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
function commit(){ save(); render(); }

/* ---------- Mock draft simulator ---------- */
/* One CPU drafting brain shared by odds sims and mocks (#46), with team
   rosters reconstructed from the actual pick log (#47). */
function seedCpuTeams(rng){
  const t = S.settings.teams, cpu = {};
  for(let s=1;s<=t;s++) cpu[s] = {QB:0,RB:0,WR:0,TE:0,DEF:0, qbGreed:0.5+rng()*0.55};
  const byId = idIndex();
  S.log.forEach((e,i)=>{
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), idx = n-(r-1)*t;
    const slot = (r%2===1) ? idx : t+1-idx;
    const p = byId[e.id];
    if(p && cpu[slot]) cpu[slot][p.pos]++;
  });
  return cpu;
}
function cpuPick(avail, st, r, rng, rinfo, R){
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
    e += (rng()*2-1)*9;
    if(e<bk){bk=e; best=p;}
  }
  return best;
}

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

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
      chosen = cpuPick(avail, st, r, rng, rinfo, R);
      st[chosen.pos]++;
    }
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
  const results = STRATS.map((st,i)=>runMock(st, base + i*7919));
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
    return '<div class="mock">'+
      '<h4>'+st.icon+' '+st.name+'</h4>'+
      '<div class="mtot" title="Optimal starting lineup projection (QB/2RB/2WR/TE/FLEX/SF/DEF)">Starters <b class="mono">'+m.startPts+'</b> pts · roster '+m.totalPts+'</div>'+
      '<div class="mtot" style="margin:-4px 0 8px; font-size:10px">'+st.blurb+'</div>'+
      kept + rows + '</div>';
  }).join("");
  // Consensus: who the sims keep handing you at current prices
  const exp = {};
  results.forEach(m=>m.picks.forEach(pk=>{ exp[pk.p.id] = exp[pk.p.id] ? {p:pk.p, n:exp[pk.p.id].n+1} : {p:pk.p, n:1}; }));
  const guys = Object.values(exp).filter(x=>x.n>=3).sort((a,b)=>b.n-a.n || b.p.proj-a.p.proj).slice(0,12);
  $("#mockConsensus").innerHTML = guys.length
    ? '🎯 <b>Your guys</b> — landed on your team in 3+ of 5 sims: ' + guys.map(x=>'<b>'+x.p.name+'</b> ('+x.n+'/5)').join(" · ")
    : "No strong consensus across strategies — your seat has options.";
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
    '<div class="injrow" data-card="'+x.p.id+'">'+
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
  $("#cardBody").innerHTML =
    '<div class="chead">'+
      (logoUrl(p.team)?'<img class="clogo" src="'+logoUrl(p.team)+'" alt="">':'')+
      avatarImg(p,84)+
      '<div class="cid"><div class="cname">'+p.name+intelBadges(p)+'</div>'+
      '<div class="csub">'+posBadge(p.pos)+' &nbsp;'+p.team+' · T'+tm[p.id]+' · '+status+'</div>'+
      (bio?'<div class="cbio">'+bio+'</div>':'')+
      '</div>'+
    '</div>'+
    (chips.length?'<div class="chips">'+chips.join("")+'</div>':'')+
    '<div class="cstats">'+
      stat("Projected", p.proj)+
      stat("Value", (vorp>0?"+":"")+vorp)+
      stat("ADP", p.adp||"—")+
      stat("Round", rinfo[p.id]?rinfo[p.id].label:"—")+
      stat("At #"+(odds?odds.at1:"?"), odds&&odds.h1[id]!=null?odds.h1[id]+"%":"—")+
      stat(odds&&odds.at2?"At #"+odds.at2:"Later", odds&&odds.h2&&odds.h2[id]!=null?odds.h2[id]+"%":"—")+
    '</div>'+
    (tbl?'<div class="cwiki">'+tbl+'</div>':'')+
    (injE?'<div class="cintel" style="color:var(--red)">🩹 <b>'+esc(injE.s)+'</b>'+(m&&m[9]?' ('+esc(m[9])+')':'')+(injE.c?' — '+esc(injE.c):'')+(injE.d?' <span class="dimtxt">('+injE.d+' · '+injE.src+')</span>':'')+'</div>':'')+
    ((()=>{const n=newsFor(p); return n?'<div class="cintel dim">📰 '+(n.u?'<a href="'+esc(n.u)+'" target="_blank" rel="noopener" style="color:var(--green)">':'')+esc(n.h)+(n.u?'</a>':'')+' <span class="dimtxt">'+n.d+'</span></div>':"";})())+
    (qbName?'<div class="cintel dim">🎯 His QB: <b>'+esc(qbName)+'</b>'+(myQBhere?' — <span class="ok">your stack ✓</span>':'')+'</div>':'')+
    (sc && sc.why.length ? '<div class="cwhy">▸ '+sc.why.join("<br>▸ ")+'</div>' : '')+
    (p.intel&&p.intel.t?'<div class="cintel">⭐ '+esc(p.intel.t)+'</div>':'')+
    (p.intel&&p.intel.p?'<div class="cintel dim">'+esc(p.intel.p)+'</div>':'')+
    (ps?'<div class="cintel dim">🗓 '+ps.short+'</div>':'')+
    '<div class="cnote" id="cardNote">'+(S.notes[id]?'📝 '+esc(S.notes[id]):'')+'</div>'+
    '<div class="cacts">'+
      (status==="available"||status==="do-not-draft" ?
        '<button class="pick" data-pick="'+id+'">✓ MINE</button>'+
        '<button class="kill" data-take="'+id+'">✕ taken</button>'+
        '<button class="undo1" data-dnd="'+id+'">'+(S.dnd[id]?"↩ allow":"🚫 never")+'</button>' : '')+
      '<button class="undo1" data-note="'+id+'">📝 note</button>'+
      '<button class="undo1" data-cmpfrom="'+id+'">⚖ compare…</button>'+
    '</div>';
  $("#cardOverlay").classList.add("show");
}
function ordSuffix(n){ return n%10===1&&n%100!==11?"st":n%10===2&&n%100!==12?"nd":n%10===3&&n%100!==13?"rd":"th"; }
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
    const base = [1,2,3,4,5].map(i=>runMock(STRATS[0], 777000+i*104729).startPts);
    S.taken=bak.taken; S.mine=bak.mine; S.log=bak.log;
    window._gradeBase = {key, avg: base.reduce((a,b)=>a+b,0)/base.length};
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
function nq(s){ return s.toLowerCase().replace(/[.'’\-]/g,"").trim(); }
function isSubseq(needle, hay){
  let i=0;
  for(let j=0; j<hay.length && i<needle.length; j++) if(hay[j]===needle[i]) i++;
  return i===needle.length;
}
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
function injSeverity(status){
  const s = String(status||"").toLowerCase();
  if(!s || s.indexOf("active")===0) return null;
  if(s.indexOf("quest")===0 || s.indexOf("day-to-day")>=0) return {code:"Q", mult:0.97, cls:"sevq", label:"Questionable"};
  if(s.indexOf("doubt")===0) return {code:"D", mult:0.92, cls:"sevd", label:"Doubtful"};
  if(s.indexOf("out")===0) return {code:"O", mult:0.85, cls:"sevo", label:"Out"};
  if(s.indexOf("injured reserve")>=0 || s==="ir" || s.indexOf("pup")===0 || s.indexOf("unable")>=0 ||
     s.indexOf("sus")===0 || s.indexOf("nfi")>=0 || s.indexOf("dnr")>=0)
    return {code:"IR", mult:0.5, cls:"sevir", label:status};
  return {code:"?", mult:0.96, cls:"sevq", label:status};
}
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
async function refreshInjuries(silent){
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
    render();
    if(document.getElementById("injOverlay").classList.contains("show")) renderInjCenter();
    if(!silent) toast("🩺 Injuries refreshed — "+Object.keys(m).length+" league-wide reports");
  }catch(e){
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
  const s = typeof TEAMLOGO!=="undefined" ? TEAMLOGO[team] : null;
  return s ? "https://a.espncdn.com/i/teamlogos/nfl/500/"+s+".png" : null;
}
function avatarImg(p, size){
  const u = headshotUrl(p);
  if(!u) return '<span class="avatar ph" style="width:'+size+'px;height:'+size+'px">'+p.name[0]+'</span>';
  return '<img class="avatar" src="'+u+'" width="'+size+'" height="'+size+'"'+(size>=56?' fetchpriority="high"':' loading="lazy"')+' decoding="async" alt="" onerror="this.outerHTML=\'<span class=&quot;avatar ph&quot; style=&quot;width:'+size+'px;height:'+size+'px&quot;>'+esc(p.name[0])+'</span>\'">';
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
  const tabs = ["ALL","QB","RB","WR","TE","FLEX","DEF"];
  $("#posTabs").innerHTML = tabs.map(t=>
    '<button class="ptab'+(S.ui.pos===t?" on":"")+'" data-pos="'+t+'">'+t+'</button>').join("");
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

  if(S.ui.pos==="FLEX") rows = rows.filter(r=>["RB","WR","TE"].includes(r.p.pos));
  else if(S.ui.pos!=="ALL") rows = rows.filter(r=>r.p.pos===S.ui.pos);
  if(q) rows = rows.filter(r=> matchesQuery(r.p, q));
  if(!S.ui.showTaken) rows = rows.filter(r=>!r.taken);
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
      '<td><span class="pcell" data-card="'+r.p.id+'" title="Open player card">'+avatarImg(r.p,24)+'<span class="pname">'+r.p.name+'</span></span>'+(S.notes[r.p.id]?'<span class="ib gold" title="'+esc(S.notes[r.p.id])+'">📝</span>':'')+(S.dnd[r.p.id]&&!r.taken&&!r.mine?'<span class="ib bear" title="On your do-not-draft list">🚫</span>':'')+((()=>{const e=injuryOf(r.p); if(!e) return ""; const sv=injSeverity(e.s); return '<span class="ib '+sv.cls+'" title="'+esc(sv.label+(e.c?" — "+e.c:"")+(e.d?" ("+e.d+" · "+e.src+")":""))+'">●</span>';})())+(buzzOf(r.p)>3000?'<span class="ib bull" title="'+buzzOf(r.p).toLocaleString()+' Sleeper adds in 24h">📈</span>':'')+((metaFor(r.p)||[])[1]===0?'<span class="ib" title="Rookie">🎓</span>':'')+intelBadges(r.p)+(r.stack?'<span class="stackchip">🔗 stack</span>':'')+(!r.taken&&!r.mine&&r.p.adp&&(pickNow()-r.p.adp)>=10?'<span class="ib" title="Falling: '+(pickNow()-r.p.adp)+' picks past ADP '+r.p.adp+'">💎</span>':'')+(r.backRisk==="gone"?'<span class="ib" title="Won\'t make it back to your next pick">🔥</span>':r.backRisk==="risky"?'<span class="ib" title="Coin-flip to survive to your next pick">⏳</span>':'')+'</td>'+
      '<td>'+posBadge(r.p.pos)+'<span class="tier t'+Math.min(tm[r.p.id],5)+'">T'+tm[r.p.id]+'</span></td>'+
      '<td class="mono" style="color:var(--dim)'+(psosFor(r.p.team)?';cursor:help':'')+'"'+(psosFor(r.p.team)?' title="'+esc(psosFor(r.p.team).txt)+'"':'')+'>'+(logoUrl(r.p.team)?'<img class="tlogo" src="'+logoUrl(r.p.team)+'" width="14" height="14" loading="lazy" decoding="async" alt=""> ':'')+r.p.team+'</td>'+
      '<td><span class="proj mono" data-edit="'+r.p.id+'">'+r.p.proj+'</span></td>'+
      '<td class="mono" style="color:'+(r.vorp>=0?'var(--green)':'var(--faint)')+'">'+(r.vorp>0?"+":"")+Math.round(r.vorp)+'</td>'+
      '<td class="mono" style="color:var(--dim)">'+(r.p.adp||"—")+'</td>'+
      '<td class="mono" style="font-size:12px;color:'+(r.edge>0?'var(--green)':r.edge<0?'var(--red)':'var(--faint)')+'" title="ADP minus value rank: positive = market prices him later than his value">'+(r.edge==null?"—":(r.edge>0?"+":"")+r.edge)+'</td>'+
      '<td><span class="rd'+(curRd && !r.rd.ud && r.rd.rd<=curRd?" now":"")+'" title="'+(r.rd.est?"Estimated from projection rank (no market ADP)":"Expected round window from ADP")+'">'+r.rd.label+'</span></td>'+
      '<td><div class="act">'+act+'</div></td></tr>';
  }).join("") || '<tr><td colspan="10" class="empty">No players match the current filters.<br><br><button class="undo1" data-clearfilters="1">✕ Clear all filters</button></td></tr>';
  if(tw) tw.scrollTop = scrollSave;
  $("#poolCount").textContent = rows.length + " players";
  window._poolIds = rows.filter(r=>!r.taken && !r.mine).length ? rows.map(r=>r.p.id) : [];
  applyKbSel();
}

/* Keyboard drafting: arrows move the highlight, M = my pick, T/X = taken */
let kbSel = -1;
function applyKbSel(){
  const trs = document.querySelectorAll("#poolBody tr[data-pid]");
  trs.forEach((tr,i)=>tr.classList.toggle("kbsel", i===kbSel));
  if(kbSel>=0 && trs[kbSel]) trs[kbSel].scrollIntoView({block:"nearest"});
}

function renderBest(){
  const {scored} = scoreBoard();
  const rinfo = roundInfo(allPlayers());
  const odds = survivalOdds();
  const hz = nextPickHorizon();
  const top = scored[0];
  const hero = $("#hero");
  if(!top){ hero.innerHTML = '<div class="empty">Board is empty — nice draft!</div>'; $("#baList").innerHTML=""; return; }
  const p = top.p;
  const why = top.why.length ? "▸ " + top.why.join("<br>▸ ") : "▸ best raw value on the board";
  const h = nextPickHorizon();
  let pickline = "";
  if(h){
    pickline = '<div class="pickline'+(h.onClock?' onclock':'')+'" data-picksync="1" title="Click to correct the current overall pick if the board drifted" style="cursor:pointer">Pick <b class="mono">#'+h.cur+'</b> on the clock'+
      (h.onClock ? ' — <b style="color:var(--green)">THAT\'S YOU, DRAFT NOW</b>' : '') +
      ' · your next: <b class="mono">#'+h.mine0+'</b>'+(h.mine1?' then <b class="mono">#'+h.mine1+'</b>':'')+'</div>';
  }
  document.title = (h && h.onClock ? "🟢 YOUR PICK — " : "") + "Draft War Room — 2QB";
  if(h && h.onClock && !window._wasOnClock && S.ui.live) chime();
  window._wasOnClock = !!(h && h.onClock);
  updatePanic(h, top);
  if(S.ui.live && h && S.ui.liveStart){
    const el = (Date.now()-S.ui.liveStart)/1000;
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
    return '<span class="scpill'+(scLeft[pos]<=3?' dry':'')+'" title="Available '+pos+'s above replacement'+(g?'; sims expect ~'+g+' more gone before your pick #'+odds.at1:'')+'">'+
      pos+' <b>'+scLeft[pos]+'</b>'+(g>=1?' <span style="color:var(--red)">−'+Math.round(g)+'</span>':'')+'</span>';
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
  const freshTop = window._lastTopId !== p.id;
  window._lastTopId = p.id;
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
  hero.innerHTML = pickline + scarce + threats +
    '<div class="toppick'+(freshTop?' fresh':'')+'">'+
      '<div class="tag">⭐ Top Pick Right Now'+((()=>{const e=injuryOf(p); if(!e) return ""; const sv=injSeverity(e.s); return ' &nbsp;<span class="sevchip '+sv.cls+'">🩹 '+esc(sv.code==="?"?e.s:sv.label)+'</span>';})())+'</div>'+
      '<div class="heroline" data-card="'+p.id+'" title="Open player card">'+avatarImg(p,56)+'<div><div class="name">'+p.name+'</div>'+
      '<div class="meta">'+posBadge(p.pos)+' &nbsp;'+p.team+' &nbsp;·&nbsp; <span class="mono">'+p.proj+' proj</span> &nbsp;·&nbsp; <span class="mono" style="color:var(--green)">+'+Math.round(top.vorp)+' vs replacement</span>'+(heroGain?' &nbsp;·&nbsp; <span class="mono ok">+'+heroGain+' lineup</span>':'')+(rinfo[p.id]&&!rinfo[p.id].ud?' &nbsp;·&nbsp; <span class="rd">'+rinfo[p.id].label+'</span>':'')+(odds&&odds.h1[p.id]!=null?' &nbsp;·&nbsp; <b class="'+oddsClass(odds.h1[p.id])+'" title="Simulated survival odds at your next two picks">'+odds.h1[p.id]+'% at #'+odds.at1+(odds.h2?' · '+odds.h2[p.id]+'% at #'+odds.at2:'')+'</b>':'')+'</div></div></div>'+
      '<div class="why">'+why+'</div>'+
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
  $("#baList").innerHTML = scored.slice(1,16).map((s,i)=>
    '<div class="barow" data-card="'+s.p.id+'">'+
      '<div class="rk mono">'+(i+2)+'</div>'+
      avatarImg(s.p,26)+
      posBadge(s.p.pos)+
      '<div class="info"><div class="nm">'+s.p.name+intelBadges(s.p)+(s.stack?'<span class="stackchip">🔗</span>':'')+(s.steal?' 💎':'')+(s.backRisk==="gone"?' 🔥':s.backRisk==="risky"?' ⏳':'')+'</div>'+
      '<div class="sm">'+s.p.team+' · '+s.p.proj+' pts'+(s.p.adp?' · ADP '+s.p.adp:'')+(odds&&odds.h1[s.p.id]!=null?' · <b class="'+oddsClass(odds.h1[s.p.id])+'">'+odds.h1[s.p.id]+'% back</b>':'')+(lineupGain(s.p)?' · <b class="ok">+'+lineupGain(s.p)+' lineup</b>':'')+'</div></div>'+
      '<div class="val mono">+'+Math.round(s.vorp)+'</div>'+
      '<button class="pick" data-pick="'+s.p.id+'">✓</button>'+
      '<button class="kill" data-take="'+s.p.id+'">✕</button>'+
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
      return '<div class="barow"><div class="rk"></div>'+posBadge(pos)+
        '<div class="info"><div class="nm">'+s.p.name+'</div><div class="sm">'+s.p.proj+' pts'+(odds&&odds.h1[s.p.id]!=null?' · <b class="'+oddsClass(odds.h1[s.p.id])+'">'+odds.h1[s.p.id]+'%</b>':'')+'</div></div>'+
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
  if(!S.mine.length){
    $("#myRoster").innerHTML = '<div class="empty">No picks yet.<br>Hit <b style="color:var(--green)">✓ MINE</b> on a player when you draft them.</div>';
  } else {
    bs = bestStarters(S.mine, byId);
    const orderOf = {}; S.mine.forEach((id,i)=>orderOf[id]=i+1);
    const rowFor = (p, lab) => '<div class="myp"><span class="slotlab">'+lab+'</span>'+avatarImg(p,22)+posBadge(p.pos)+((()=>{const e=injuryOf(p); if(!e) return ""; const sv=injSeverity(e.s); return '<span class="ib '+sv.cls+'" title="'+esc(sv.label+(e.c?" — "+e.c:""))+'">●</span>';})())+
      '<div class="n">'+p.name+' <span class="t">'+(logoUrl(p.team)?'<img class="tlogo" src="'+logoUrl(p.team)+'" width="12" height="12" loading="lazy" alt=""> ':'')+p.team+' · <span class="mono">'+p.proj+'</span></span></div>'+
      '<span class="t mono">R'+orderOf[p.id]+'</span>'+
      '<span class="x" data-drop="'+p.id+'" role="button" tabindex="0" aria-label="Remove '+esc(p.name)+' from my roster" title="Remove from my roster">✕</span></div>';
    let html = bs.line.map(sl => sl.p ? rowFor(sl.p, sl.lab) :
      '<div class="myp" style="opacity:.45"><span class="slotlab">'+sl.lab+'</span><span class="t">— open</span></div>').join("");
    const bench = S.mine.filter(id=>!bs.starterIds.has(id)).map(id=>byId[id]).filter(Boolean);
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

  // My roster health warning
  const hurtMine = S.mine.map(id=>byId[id]).filter(Boolean).filter(p=>badInjury(p));
  if(hurtMine.length){
    warn.innerHTML += '<div class="warn crit">🩹 On your roster: '+hurtMine.map(p=>'<b>'+esc(p.name)+'</b> ('+esc(badInjury(p))+')').join(", ")+'</div>';
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

function renderLog(){
  const byId = idIndex();
  const t = S.settings.teams;
  const players = allPlayers(), repl = replacementLevels(players);
  $("#logList").innerHTML = S.log.length ? S.log.map((e,i)=>{
    const p = byId[e.id]; if(!p) return "";
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), ri = n-(r-1)*t;
    return '<div class="logrow"><span class="pickno mono">'+r+'.'+String(ri).padStart(2,"0")+'</span>'+
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
  _idx = null;
  renderHeader(); renderTabs(); renderPool(); renderBest(); renderRoster(); renderLog();
}
function renderHeader(){
  const el = document.querySelector(".logo .sub");
  if(el) el.textContent = (S.settings.name||"Buck Breakers")+" · Superflex · "+(S.settings.ptd||6)+"pt Pass TD · Slot "+S.settings.slot;
}

/* ---------- Events (delegated) ---------- */
document.addEventListener("click", e=>{
  const t = e.target.closest("[data-pick],[data-take],[data-drop],[data-untake],[data-edit],[data-pos],[data-undoentry],[data-picksync],[data-note],[data-dnd],[data-clearfilters],[data-card],[data-cmpfrom],[data-slotname],#tradeGo,th[data-sort]");
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
  if(t.dataset.card){ return openCard(t.dataset.card); }
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
  if((e.ctrlKey||e.metaKey) && (e.key==="y" || (e.shiftKey && e.key.toLowerCase()==="z"))){ e.preventDefault(); redoLast(); return; }
  if((e.ctrlKey||e.metaKey) && e.key==="z"){ e.preventDefault(); undoLast(); return; }
  if(e.key==="Enter"){
    const ae = document.activeElement;
    if(ae && ae.dataset && (ae.dataset.drop!=null || ae.dataset.undoentry!=null || (ae.tagName==="TH" && ae.dataset.sort))){ e.preventDefault(); ae.click(); return; }
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if(e.key==="/" && !typing){ e.preventDefault(); $("#search").focus(); return; }
  if(e.key==="?" && !typing){ e.preventDefault(); $("#helpOverlay").classList.toggle("show"); return; }
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
  bs.line.forEach(sl=>{ if(sl.p) txt += sl.lab.padEnd(5)+" "+sl.p.name+" ("+sl.p.team+", "+sl.p.proj+")\n"; });
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
  h += '<div class="sechead">Stacks</div>' + (stacks.length
    ? stacks.map(([t,ps])=>'<div class="mkrow">'+(logoUrl(t)?'<img class="tlogo" src="'+logoUrl(t)+'" width="13" height="13" alt=""> ':'')+'<span class="mn">🔗 '+t+' — '+ps.map(x=>x.name.split(" ").slice(-1)[0]).join(" + ")+'</span></div>').join("")
    : '<div class="dimtxt">None yet — pair a WR/TE with one of your QBs.</div>');
  if(stacks.length) txt += "Stacks: "+stacks.map(([t,ps])=>t+" ("+ps.map(x=>x.name.split(" ").slice(-1)[0]).join("+")+")").join(", ")+"\n";
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
    const rows = [];
    for(let s2=1;s2<=t;s2++){
      const ids = s2===mySlot ? S.mine : ros[s2];
      rows.push({s:s2, pts: ids.length ? bestStarters(ids, byId).pts : 0, n: ids.length});
    }
    rows.sort((a,b)=>b.pts-a.pts);
    h += '<div class="sechead" style="margin-top:16px">🏆 Projected standings (optimal starters so far)</div><table class="stattbl" style="max-width:420px">'+
      '<tr><th style="text-align:left">#</th><th style="text-align:left">Team</th><th>Starters</th><th>Picks</th></tr>'+
      rows.map((r2,i)=>'<tr'+(r2.s===mySlot?' style="color:var(--green);font-weight:700"':'')+'><td style="text-align:left">'+(i+1)+'</td><td style="text-align:left">'+esc(slotName(r2.s))+'</td><td>'+Math.round(r2.pts)+'</td><td>'+r2.n+'</td></tr>').join("")+
      '</table>';
  } else {
    h += '<div class="dimtxt" style="margin-top:12px">Standings appear after round 1 is fully logged.</div>';
  }
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
function parsePicks(str){
  const t = S.settings.teams, out = [];
  String(str).split(/[,\s]+/).filter(Boolean).forEach(tok=>{
    const m = tok.match(/^(\d+)\.(\d+)$/);
    if(m) out.push((+m[1]-1)*t + Math.min(t,+m[2]));
    else if(/^\d+$/.test(tok)) out.push(+tok);
  });
  return out;
}
function tradeEval(){
  const curve = pickValueCurve();
  const v = n => curve[Math.min(curve.length-1, Math.max(0, n-1))] || 0;
  const give = parsePicks($("#tradeGive").value), get = parsePicks($("#tradeGet").value);
  if(!give.length || !get.length){ $("#tradeOut").textContent = "Enter picks on both sides (1.12 or overall numbers)."; return; }
  const gv = give.reduce((a,n)=>a+v(n),0), rv = get.reduce((a,n)=>a+v(n),0);
  const d = Math.round(rv-gv);
  $("#tradeOut").innerHTML = 'Give #'+give.join(", #")+' ('+Math.round(gv)+' pts of value) for #'+get.join(", #")+' ('+Math.round(rv)+') → '+
    '<b style="color:'+(d>=0?"var(--green)":"var(--red)")+'">'+(d>=0?"ACCEPT — you gain ~"+d:"DECLINE — you lose ~"+(-d))+' pts</b>'+
    '<span class="dimtxt"> (value = nth-best player remaining on a full board)</span>';
}
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
$("#mocksClose").addEventListener("click", ()=>$("#mocksOverlay").classList.remove("show"));

/* Settings modal */
$("#settingsBtn").addEventListener("click", ()=>{
  $("#setTeams").value=S.settings.teams; $("#setRoster").value=S.settings.roster;
  $("#setSlot").value=S.settings.slot; $("#setScoring").value=S.settings.scoring;
  $("#setName").value=S.settings.name||"Buck Breakers";
  $("#setCompact").checked=!!S.settings.compact;
  const cols=S.settings.cols||{};
  $("#colADP").checked=cols.adp!==false; $("#colEdge").checked=cols.edge!==false; $("#colRd").checked=cols.rd!==false;
  $("#setSound").checked=S.settings.sound!==false;
  refreshProfiles(); refreshProjStatus();
  $("#setPtd").value=String(S.settings.ptd||6);
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
  S.settings.name = $("#setName").value.trim() || "Buck Breakers";
  S.settings.compact = $("#setCompact").checked;
  S.settings.sound = $("#setSound").checked;
  S.settings.cols = {adp:$("#colADP").checked, edge:$("#colEdge").checked, rd:$("#colRd").checked};
  applyTheme();
  for(const pos of POSITIONS) S.settings.min[pos] = Math.max(0, +$("#min"+pos).value||0);
  $("#settingsOverlay").classList.remove("show");
  commit();
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
  const rows=players.map(p=>({p, vorp:p.proj-(repl[p.pos]||0)})).sort((a,b)=>b.vorp-a.vorp).slice(0,200);
  let html='<!DOCTYPE html><html><head><title>Buck Breakers Cheat Sheet</title><style>'+
    'body{font-family:Arial,sans-serif;font-size:10px;margin:18px} h1{font-size:15px;margin:0 0 2px} p{margin:0 0 10px;color:#555;font-size:9px}'+
    'table{border-collapse:collapse;width:100%} th,td{border:1px solid #bbb;padding:2px 5px;text-align:left} th{background:#eee}'+
    'tr:nth-child(even){background:#f6f6f6} .t1{font-weight:bold} @media print{body{margin:8px}}'+
    '</style></head><body><h1>Draft War Room — Cheat Sheet</h1>'+
    '<p>Buck Breakers · superflex · 6pt pass TD · slot '+S.settings.slot+' · top 200 by value over replacement · ★=analyst target ▲▼=prop lean</p>'+
    '<table><tr><th>#</th><th>Player</th><th>Pos</th><th>Tm</th><th>Tier</th><th>Proj</th><th>Value</th><th>ADP</th><th>Rd</th><th></th></tr>';
  rows.forEach((r,i)=>{
    const p=r.p, badges=(p.intel&&p.intel.t!=null?"★":"")+(p.intel&&p.intel.lean>0?"▲":p.intel&&p.intel.lean<0?"▼":"");
    html+='<tr class="'+(tm[p.id]===1?'t1':'')+'"><td>'+(i+1)+'</td><td>'+p.name+'</td><td>'+p.pos+'</td><td>'+p.team+'</td><td>T'+tm[p.id]+'</td><td>'+p.proj+'</td><td>'+Math.round(r.vorp)+'</td><td>'+(p.adp||"")+'</td><td>'+(rinfo[p.id]?rinfo[p.id].label:"")+'</td><td>'+badges+'</td></tr>';
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
$("#helpBtn").addEventListener("click", ()=>$("#helpOverlay").classList.add("show"));
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
    backupState();
    S.dataRows=rows; S.dataRev=(S.dataRev||0)+1;
    commit(); refreshProjStatus();
    toast("Loaded "+rows.length+" players from CSV");
  };
  rd.readAsText(f);
  e.target.value="";
});

/* Board profiles */
const PROF_KEY = LS_KEY+"-profiles";
function profAll(){ try{ return JSON.parse(localStorage.getItem(PROF_KEY))||{}; }catch(e){ return {}; } }
function refreshProfiles(){
  const sel=$("#profileSel"); if(!sel) return;
  const names=Object.keys(profAll());
  sel.innerHTML = names.length ? names.map(n=>'<option>'+esc(n)+'</option>').join("") : '<option value="">(none saved)</option>';
}
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
    const url = location.origin+location.pathname+"#b="+b64;
    await navigator.clipboard.writeText(url);
    toast("🔗 Board snapshot link copied ("+(url.length/1024).toFixed(1)+" KB)");
  }catch(e){ toast("Share link failed: "+esc(e.message), {warn:true}); }
}
async function loadSharedBoard(){
  const m = location.hash.match(/#b=([A-Za-z0-9_-]+)/);
  if(!m) return false;
  try{
    const bin = Uint8Array.from(atob(m[1].replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
    const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"));
    const j = JSON.parse(await new Response(ds).text());
    backupState();
    S = Object.assign(defaultState(), j);
    S.slotNames = Object.assign(defaultState().slotNames, j.slotNames||{});
    history.replaceState(null, "", location.pathname);
    save();
    toast("📥 Shared board loaded — your previous board is in Settings → Restore backup");
    return true;
  }catch(e){ toast("Share link unreadable", {warn:true}); return false; }
}
document.getElementById("shareBtn").addEventListener("click", copyShareLink);

/* Auto-backup before destructive actions */
function backupState(){
  try{ localStorage.setItem(LS_KEY+"-backup", JSON.stringify({when:new Date().toLocaleString(), state:S})); }catch(e){}
}

/* Export / Import / Reset */
$("#exportBtn").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(S,null,2)], {type:"application/json"});
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
  r.onload = ()=>{ try{ const parsed=JSON.parse(r.result); backupState(); S = Object.assign(defaultState(), parsed); commit(); }catch(err){ alert("Invalid save file"); } };
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
function initLock(){
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
if(location.hash.indexOf("#b=")===0){ loadSharedBoard().then(ok=>{ if(ok){ initInjuries(); render(); } }); }
initInjuries();
const E2E_MODE = location.search.indexOf("e2e") >= 0;   // deterministic test runs: no network side-effects
if(!E2E_MODE && location.protocol.indexOf("http")===0){
  setTimeout(()=>{ refreshInjuries(true); refreshTrending(); }, 1500);
  setInterval(()=>{ if(document.visibilityState==="visible") refreshInjuries(true); }, 5*60e3);
  setInterval(()=>{ if(document.visibilityState==="visible") refreshTrending(); }, 15*60e3);
}
document.querySelectorAll(".modal").forEach(m=>{ m.setAttribute("role","dialog"); m.setAttribute("aria-modal","true"); });
const BUILD = "4.0";
/* Theme: auto follows the OS, or force dark/light */
function applyTheme(){
  const pref = S.settings.theme || "auto";
  const dark = pref==="auto" ? !window.matchMedia("(prefers-color-scheme: light)").matches : pref==="dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.content = dark ? "#0b0f14" : "#eef2f7";
  const b = document.getElementById("themeBtn");
  if(b) b.textContent = pref==="auto" ? "🌓" : (pref==="dark" ? "🌙" : "☀️");
  document.body.classList.toggle("compact", !!S.settings.compact);
  document.body.classList.toggle("live", !!S.ui.live);
  const cols = S.settings.cols || {};
  document.body.classList.toggle("hidecol-adp", cols.adp===false);
  document.body.classList.toggle("hidecol-edge", cols.edge===false);
  document.body.classList.toggle("hidecol-rd", cols.rd===false);
}
function setLive(on){
  S.ui.live = on;
  if(on){ S.ui.liveStart = Date.now(); S.ui.liveLen0 = S.log.length; }
  document.body.classList.toggle("live", on);
  const b = document.getElementById("liveBtn");
  b.classList.toggle("liveon", on);
  b.textContent = on ? "🔴 LIVE" : "⚪ Live";
  save(); render();
  toast(on ? "🔴 Draft Day mode ON — chime + panic button armed" : "Live mode off");
}
document.getElementById("liveBtn").addEventListener("click", ()=>setLive(!S.ui.live));
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
function updatePanic(hz, top){
  let bar = document.getElementById("panicBar");
  const want = hz && hz.onClock && S.ui.live && window._panicDismissed!==hz.cur && top;
  if(!want){ if(bar) bar.remove(); return; }
  if(!bar){ bar = document.createElement("div"); bar.id="panicBar"; document.body.appendChild(bar); }
  bar.innerHTML = '<span>🚨 PICK #'+hz.cur+' — YOU ARE ON THE CLOCK</span>'+
    '<button class="pick" data-pick="'+top.p.id+'" style="font-size:15px;padding:10px 18px">✓ TAKE '+esc(top.p.name.toUpperCase())+'</button>'+
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

(function(){
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
let _lastErrToast = 0;
function surfaceError(msg){
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
