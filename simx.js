/* ============================================================
   simx.js — the Perfect Sim (#1067–#1166): weekly projection
   feeds, the injury engine, lineup-aware season simulation,
   opponent modeling, and the what-if machine.
   ============================================================ */

/* ---------- R67 Sleeper weekly projections feed (#1067–#1081) ---------- */
const PROJX = {future:{}};                                                       // week → {map: ourId→league-corrected pts, at}
function projSource(){ return S.settings.projSrc || "blend"; }                   // #1068
function projBlendPct(){ const b = +S.settings.projBlendPct; return isNaN(b) ? 50 : Math.max(0, Math.min(100, b)); }
async function fetchWeekProjections(w, force){                                   // #1067/#1074
  if(!force && PROJX.future[w] && Date.now()-(PROJX.future[w].at||0) < 30*60e3) return PROJX.future[w].map;
  try{
    const yr = new Date().getFullYear();
    const j = await (await fetch("https://api.sleeper.app/v1/projections/nfl/regular/"+yr+"/"+w)).json();
    const s2o = sleeperToOurs();
    const m = {};
    for(const sid in j){
      const st = j[sid]; if(!st || st.pts_ppr==null) continue;
      const oid = s2o[String(sid)]; if(!oid) continue;
      m[oid] = Math.round((st.pts_ppr + 2*(st.pass_td||0))*10)/10;               // league-exact: +2/passTD (#1070), DEFs via team codes (#1075)
    }
    if(Object.keys(m).length > 50){
      PROJX.future[w] = {map:m, at:Date.now()};
      try{ localStorage.setItem(LS_KEY+"-projx"+w, JSON.stringify(m)); }catch(e){}
    }
  }catch(e){}
  if(!PROJX.future[w]){                                                          // offline: last fetch (#1074)
    try{ const c = JSON.parse(localStorage.getItem(LS_KEY+"-projx"+w)||"null"); if(c) PROJX.future[w] = {map:c, at:0}; }catch(e){}
  }
  return (PROJX.future[w]||{}).map || null;
}
function sleeperWk(p, w){ const f = PROJX.future[w]; return (f && f.map[p.id]!=null) ? f.map[p.id] : null; }
function projSrcLabel(){                                                         // #1071
  const w = curWeek(), f = PROJX.future[w], mode = projSource();
  if(mode==="baked" || !f) return "📊 baked";
  const stale = f.at && Date.now()-f.at > 2*60*60e3 ? " ⚠" : "";
  return (mode==="sleeper" ? "📱 wk"+w : "🔀 "+projBlendPct()+"%")+stale;
}
function projSourceLine(p){                                                      // card source note (#1077)
  try{
    const w = curWeek(), sv = sleeperWk(p, w);
    if(sv==null || S.overrides[p.id]!=null) return "";
    const baked = Math.round(p.proj/16*10)/10;
    if(Math.abs(sv-baked) < 0.3) return "";
    return '<div class="cintel dimtxt" style="font-size:11px">wk'+w+' models: 📊 '+baked+' · 📱 '+sv+' · using '+esc(projSource())+'</div>';
  }catch(e){ return ""; }
}
function divergenceRows(){                                                       // #1073
  const w = curWeek(), byId = idIndex();
  return rosterIds().map(id=>byId[id]).filter(Boolean).filter(p=>p.pos!=="DEF")
    .map(p=>({p, baked:Math.round(p.proj/16*10)/10, slp:sleeperWk(p, w)}))
    .filter(x=>x.slp!=null && Math.abs(x.slp-x.baked)>=1)
    .sort((a,b)=>Math.abs(b.slp-b.baked)-Math.abs(a.slp-a.baked));
}
function projDivergence(){
  const old = document.getElementById("dvOverlay"); if(old){ old.remove(); return; }
  const rows = divergenceRows();
  const ov = document.createElement("div"); ov.id = "dvOverlay"; ov.className = "snov";
  ov.innerHTML = '<div class="sbcard" role="dialog"><button class="sbx" data-dvx="1">✕</button>'+
    '<div class="tag">⚖ MODEL DISAGREEMENTS — WEEK '+curWeek()+'</div>'+
    (rows.length ? rows.map(x=>'<div class="sbply" data-card="'+x.p.id+'" style="cursor:pointer"><span>'+esc(x.p.name)+
      ' <span class="dimtxt">'+x.p.pos+'</span></span><b class="mono">📊 '+x.baked+' vs 📱 '+x.slp+
      ' <span style="color:var(--'+(x.slp>x.baked?'green':'red')+')">('+(x.slp>x.baked?'+':'')+Math.round((x.slp-x.baked)*10)/10+')</span></b></div>').join("")
    : '<div class="empty">'+((PROJX.future[curWeek()]||{}).map ? 'The models agree this week — rare.' : 'Sleeper feed not loaded yet — it pulls on the season tick.')+'</div>')+'</div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{ if(e.target===ov || e.target.closest("[data-dvx]")) ov.remove(); });
}
function divergenceAlerts(){                                                     // #1078 full send
  try{
    if(typeof hypeOn!=="function" || !hypeOn("full")) return;
    const w = curWeek(), k = LS_KEY+"-divg"+w;
    let seen = []; try{ seen = JSON.parse(localStorage.getItem(k)||"[]"); }catch(e){}
    divergenceRows().forEach(x=>{
      if(seen.includes(x.p.id) || x.baked<5) return;
      if(Math.abs(x.slp-x.baked)/x.baked >= 0.25){
        seen.push(x.p.id);
        alertFire("divg", "⚖ Models split on "+x.p.name, "Sleeper says "+x.slp+", draft model says "+x.baked+" — someone knows something");
      }
    });
    localStorage.setItem(k, JSON.stringify(seen));
  }catch(e){}
}
function projTick(){                                                             // prefetch this + next 2 weeks (#1072)
  const w = curWeek();
  fetchWeekProjections(w).then(()=>{ divergenceAlerts(); if(typeof renderNow==="function") renderNow(); });
  fetchWeekProjections(w+1); fetchWeekProjections(w+2);
}

/* ---------- R68 The injury engine (#1082–#1096) ---------- */
function hazardOf(p){                                                            // #1082/#1093: weekly P(new multi-week injury)
  const base = ({RB:.040, TE:.032, WR:.030, QB:.022, DEF:.002})[p.pos];
  let h = base==null ? .025 : base;
  const m = (typeof metaFor==="function") ? metaFor(p) : null;
  const age = m && m[0] ? +m[0] : 26;
  if(age>=30) h *= 1.4; else if(age>=28) h *= 1.2;
  const e = (typeof injuryOf==="function") ? injuryOf(p) : null;
  const sv = e ? injSeverity(e.s) : null;
  if(sv && (sv.code==="Q" || sv.code==="D" || sv.code==="?")) h *= 1.35;         // nagging
  return Math.min(.09, Math.round(h*1000)/1000);
}
function hazardBand(p){
  const h = hazardOf(p);
  return h<.025 ? {t:"LOW", c:"green"} : h<.04 ? {t:"MED", c:"gold"} : {t:"HIGH", c:"red"};
}
function hazardLine(p){                                                          // card band (#1091)
  try{
    if(p.pos==="DEF") return "";
    const b = hazardBand(p), h = hazardOf(p);
    const m = (typeof metaFor==="function") ? metaFor(p) : null;
    const why = [];
    if(p.pos==="RB") why.push("RB workload");
    if(m && m[0]>=28) why.push("age "+m[0]);
    const e = injuryOf(p); if(e) why.push("current flag");
    return '<div class="cintel dimtxt" style="font-size:11px">🩹 injury risk <b style="color:var(--'+b.c+')">'+b.t+'</b> ('+(h*100).toFixed(1)+'%/wk'+(why.length?' — '+why.join(", "):'')+')</div>';
  }catch(e){ return ""; }
}
function sampleDur(rng){ let d = 1; while(rng()<0.55 && d<5) d++; return d; }     // mean ≈2.2 weeks (#1083)
function returnWeekOf(p, w, rng){                                                // current O/IR timelines (#1085)
  const e = (typeof injuryOf==="function") ? injuryOf(p) : null;
  const sv = e ? injSeverity(e.s) : null;
  if(!sv) return w;
  if(sv.code==="IR") return w+4+Math.floor(rng()*5);
  if(sv.code==="O") return w+1+Math.floor(rng()*3);
  return w;
}
function rosterPack(rid, wLo, wHi){                                              // per-team sim pack (#1084)
  const byId = idIndex();
  const ids = (+rid===+S.settings.sleeperRosterId) ? rosterIds() : leagueRosterIds(rid);
  const ps = ids.map(id=>byId[id]).filter(Boolean);
  const repl = {QB:11, RB:8, WR:8, TE:5, DEF:5};
  const pack = ps.filter(p=>p.pos!=="DEF").map(p=>{
    let v = 0, g = 0;
    for(let w2=wLo; w2<=Math.min(wHi, wLo+3); w2++){ const x = weekProj(p, w2); if(x>0){ v+=x; g++; } }
    const val = g ? v/g : 0;
    const benchMates = ps.filter(q=>q.pos===p.pos && q.id!==p.id).map(q=>weekProj(q, wLo)).sort((a,b)=>b-a);
    const replacement = Math.max(repl[p.pos]||6, benchMates[2]!=null ? benchMates[2] : (benchMates[1]!=null ? benchMates[1]*0.8 : 0));
    return {id:p.id, p, val, dep:Math.max(0, val-replacement), haz:hazardOf(p),
      outNow:(()=>{ const e = injuryOf(p); const sv = e?injSeverity(e.s):null; return sv && (sv.code==="O"||sv.code==="IR"); })()};
  }).sort((a,b)=>b.dep-a.dep);
  return pack;
}
function injuryDragOf(rid, wLo, wHi){                                            // expected weekly pts lost (#1086 cheap path)
  return Math.round(rosterPack(rid, wLo, wHi).reduce((a,x)=>a+x.dep*x.haz*2.2, 0)*10)/10;
}
function seasonSimX(data, opts){                                                 // lineup-aware injury-world sim (#1083–#1086, #1097–#1109)
  const N = opts.N||300, seed = opts.seed==null?7:opts.seed, myMult = opts.myMult||1;
  const injOn = opts.injuries!==false;
  const vec = opts.vectors || null;                                              // {mu[rid][w], sd[rid][w]}
  const rng = mulberry32(seed);
  const rids = Object.keys(data.mu).map(Number);
  const wNow = curWeek();
  const packs = {}; rids.forEach(r=>{ packs[r] = rosterPack(r, wNow, data.lastW).slice(0, 10); });
  const weeks = Object.keys(data.schedule).map(Number).sort((a,b)=>a-b).filter(w2=>w2<=data.lastW);
  const recDist = {}, seedCount = new Array((data.spots||6)+1).fill(0);
  let titles = 0, finals = 0, made = 0, winsSum = 0, injSum = 0, lastPlace = 0, rivalH2H = 0, rivalGames = 0;
  const muOf = (r,w2)=> vec ? vec.mu[r][w2]*driftMult(vec, r, w2, wNow) : data.mu[r];
  const noiseOf = (r,w2)=> (rng()+rng()+rng()-1.5)*2*(vec ? vec.sd[r][w2] : 13);
  for(let s2=0; s2<N; s2++){
    const wins = {}, pf = {}, outUntil = {};
    rids.forEach(r=>{ wins[r] = data.wins0[r]||0; pf[r] = data.pf0[r]||0;
      packs[r].forEach(x=>{ if(x.outNow) outUntil[x.id] = returnWeekOf(x.p, weeks[0]||wNow, rng); }); });
    weeks.forEach(w2=>{
      const delta = {};
      if(injOn) rids.forEach(r=>{
        let d = 0;
        packs[r].forEach(x=>{
          if(outUntil[x.id]>w2) d += x.dep;
          else if(!x.outNow && rng()<x.haz){ outUntil[x.id] = w2+sampleDur(rng); d += x.dep; injSum++; }
        });
        delta[r] = d;
      });
      (data.schedule[w2]||[]).forEach(pair=>{
        const a = pair[0], b = pair[1];
        const sa = (a===data.myRid ? muOf(a,w2)*myMult : muOf(a,w2)) - (delta[a]||0) + noiseOf(a,w2);
        const sb = (b===data.myRid ? muOf(b,w2)*myMult : muOf(b,w2)) - (delta[b]||0) + noiseOf(b,w2);
        pf[a]+=sa; pf[b]+=sb;
        const aWins = sa>sb || (sa===sb && pf[a]>=pf[b]);                        // PF tiebreak (#1100)
        if(aWins) wins[a]++; else wins[b]++;
        if(data.rivRid!=null && ((a===data.myRid&&b===data.rivRid)||(b===data.myRid&&a===data.rivRid))){
          rivalGames++; if((a===data.myRid)===aWins) rivalH2H++;                 // #1109
        }
      });
    });
    const order = rids.slice().sort((x,y)=> wins[y]-wins[x] || pf[y]-pf[x]);
    const mySeed = order.indexOf(data.myRid);
    if(order[order.length-1]===data.myRid) lastPlace++;                          // #1103
    winsSum += wins[data.myRid];
    const key = wins[data.myRid]+"-"+(data.games - wins[data.myRid]);
    recDist[key] = (recDist[key]||0)+1;
    if(mySeed < (data.spots||6)){
      seedCount[mySeed]++; made++;
      const seeds = order.slice(0, data.spots||6);
      const home = 1.5;
      const pw = data.lastW+1;
      const g = (x,y,hx)=> (muOf(x,weeks[weeks.length-1]||pw)+ (hx?home:0) + noiseOf(x,weeks[weeks.length-1]||pw)) >=
                           (muOf(y,weeks[weeks.length-1]||pw) + noiseOf(y,weeks[weeks.length-1]||pw)) ? x : y;
      const w1 = g(seeds[2], seeds[5], true), w2b = g(seeds[3], seeds[4], true);
      const survivors = [w1, w2b].sort((x,y)=>seeds.indexOf(x)-seeds.indexOf(y));  // reseed (#1102)
      const f1 = g(seeds[0], survivors[1], true), f2 = g(seeds[1], survivors[0], true);
      const inFinal = f1===data.myRid || f2===data.myRid;
      if(inFinal) finals++;
      if(g(f1, f2, seeds.indexOf(f1)<seeds.indexOf(f2))===data.myRid) titles++;
    } else seedCount[data.spots||6]++;
  }
  return {recDist, seedCount, titlePct:Math.round(titles/N*1000)/10, winsAvg:Math.round(winsSum/N*10)/10,
    N, injPerSeason:Math.round(injSum/N/rids.length*10)/10,
    makePct:Math.round(made/N*100), finalPct:Math.round(finals/N*100), lastPct:Math.round(lastPlace/N*100),
    rivalH2HPct: rivalGames ? Math.round(rivalH2H/rivalGames*100) : null};
}
/* ---------- R69 weekly vectors: lineup-aware seasons (#1097–#1111) ---------- */
const VEC = {key:null, mu:{}, sd:{}};
function weeklyVectors(data){                                                    // #1097/#1098/#1106
  const key = (typeof stateKey==="function"?stateKey():"")+":"+curWeek()+":"+((typeof projSource==="function")?projSource():"");
  if(VEC.key===key && VEC.mu[data.myRid]) return VEC;
  const byId = idIndex();
  VEC.mu = {}; VEC.sd = {};
  const weeks = Object.keys(data.schedule).map(Number);
  Object.keys(data.mu).map(Number).forEach(rid=>{
    const ids = (+rid===+S.settings.sleeperRosterId) ? rosterIds() : leagueRosterIds(rid);
    VEC.mu[rid] = {}; VEC.sd[rid] = {};
    weeks.forEach(w2=>{
      if(!ids.length){ VEC.mu[rid][w2] = data.mu[rid]; VEC.sd[rid][w2] = 26; return; }
      const bs = bestStartersWeek(ids, byId, w2);
      VEC.mu[rid][w2] = Math.max(60, bs.pts);
      let v = 0;
      bs.line.forEach(sl=>{ if(sl.p && sl.wp>0){ const s3 = Math.min(playerVariance(sl.p), Math.max(2, sl.wp*1.1)); v += s3*s3; } });
      VEC.sd[rid][w2] = Math.max(12, Math.sqrt(v));
    });
  });
  VEC.key = key;
  return VEC;
}
function driftMult(vec, rid, w2, wNow){                                          // waiver drift (#1101)
  const mus = Object.values(vec.mu).map(m2=>m2[w2]).filter(x=>x!=null).sort((a,b)=>a-b);
  const med = mus[Math.floor(mus.length/2)]||100;
  if(vec.mu[rid][w2] >= med*0.9) return 1;
  return Math.min(1.08, 1 + 0.02*Math.max(0, w2-wNow));
}
function fragilityRows(rid){ return rosterPack(rid, curWeek(), 14).slice(0, 6); }   // #1087
function depthGrade(rid){                                                        // #1089
  const pack = rosterPack(rid, curWeek(), 14);
  if(!pack.length) return "?";
  const avgDep = pack.slice(0,5).reduce((a,x)=>a+x.dep,0)/Math.min(5,pack.length);
  return avgDep<4 ? "A" : avgDep<6 ? "B" : avgDep<8 ? "C" : "D";
}
function gamesLostRows(hist){                                                    // #1090 zero-point starter starts
  const counts = {};
  (hist||[]).forEach(wm=>(wm||[]).forEach(m=>{
    if(!m.players_points) return;
    counts[m.roster_id] = (counts[m.roster_id]||0) + (m.starters||[]).filter(sid=>(+m.players_points[sid]||0)===0).length;
  }));
  return counts;
}
function renderFragility(){                                                      // #1087/#1088
  const old = document.getElementById("frOverlay"); if(old){ old.remove(); return; }
  const myRid = +S.settings.sleeperRosterId;
  const mine = fragilityRows(myRid);
  const hist = seasonArchive();
  const lost = gamesLostRows(hist);
  const avgLost = Object.keys(lost).length ? Object.values(lost).reduce((a,b)=>a+b,0)/Object.keys(lost).length : 0;
  const ov = document.createElement("div"); ov.id = "frOverlay"; ov.className = "snov";
  let h = '<div class="sbcard" role="dialog"><button class="sbx" data-frx="1">✕</button>'+
    '<div class="tag">🩹 FRAGILITY REPORT — depth grade '+depthGrade(myRid)+'</div>';
  h += '<div class="benchhead">My load-bearing walls (dependence × risk)</div>'+
    mine.map(x=>'<div class="sbply" data-card="'+x.id+'" style="cursor:pointer"><span>'+esc(x.p.name)+
    ' <span class="dimtxt">'+x.p.pos+' · risk '+(x.haz*100).toFixed(1)+'%/wk</span></span>'+
    '<b class="mono" style="color:var(--'+(x.dep>8?'red':x.dep>5?'gold':'green')+')">−'+x.dep.toFixed(1)+'/wk if down</b></div>').join("");
  if(SCOREB.rosters){
    const rows = standingsRows(SCOREB.rosters, SCOREB.users).map(r=>({name:r.name, rid:r.rid,
      drag:injuryDragOf(r.rid, curWeek(), 14), grade:depthGrade(r.rid), lost:lost[r.rid]||0}))
      .sort((a,b)=>b.drag-a.drag);
    h += '<div class="benchhead">League fragility (expected pts/wk at risk · depth · zero-starts so far)</div>'+
      rows.map(r=>'<div class="sbply"'+(r.rid===myRid?' style="color:var(--gold)"':'')+'><span>'+esc(r.name)+'</span>'+
      '<b class="mono">'+r.drag.toFixed(1)+' · '+r.grade+(hist.length?' · '+r.lost+(r.lost>avgLost+1?' 🤕':r.lost<avgLost-1?' 🍀':''):'')+'</b></div>').join("");
  }
  h += '</div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{ if(e.target===ov || e.target.closest("[data-frx]")) ov.remove(); });
}
function fragilityAlert(){                                                       // #1094
  try{
    if(typeof hypeOn!=="function" || !hypeOn("full")) return;
    const top = fragilityRows(+S.settings.sleeperRosterId)[0];
    if(!top) return;
    const e = injuryOf(top.p); if(!e) return;
    const k = LS_KEY+"-frag"+curWeek();
    if(localStorage.getItem(k)===top.id) return;
    localStorage.setItem(k, top.id);
    const swap = (typeof benchSwapFor==="function") ? benchSwapFor(top.p) : null;
    alertFire("frag", "🧱 Load-bearing wall flagged: "+top.p.name,
      "−"+top.dep.toFixed(1)+"/wk if he sits"+(swap?" · backup plan: "+swap.name:" · no bench cover — hit the wire"));
  }catch(e){}
}

window.__mod = window.__mod || []; window.__mod.push("simx.js");
