/* ============================================================
   simx.js — the Perfect Sim (#1067–#1166): weekly projection
   feeds, the injury engine, lineup-aware season simulation,
   opponent modeling, and the what-if machine.
   ============================================================ */

/* ---------- R67 Sleeper weekly projections feed (#1067–#1081) ---------- */
const PROJX = {future:{}};                                                       // week → {map: ourId→league-corrected pts, at}
function projSource(){ return S.settings.projSrc || "consensus"; }
function projBlendPct(){ const b = +S.settings.projBlendPct; return isNaN(b) ? 50 : Math.max(0, Math.min(100, b)); }
function weeklyScoring(){
  const league = typeof WAIV!=="undefined" ? WAIV.league : null;
  return league && league.league_id===S.settings.sleeperLeagueId ? league.scoring_settings : null;
}
function scoreWeeklyStats(st, scoring){
  if(!st || typeof st!=="object" || st.pts_ppr==null) return null;
  if(scoring && Object.keys(scoring).length)
    return Math.round(Object.entries(scoring).reduce((sum, [key, value])=>sum+(Number(st[key])||0)*(Number(value)||0),0)*10)/10;
  const recPts = S.settings.scoring==="half" ? 0.5 : S.settings.scoring==="std" ? 0 : 1;
  return Math.round((Number(st.pts_ppr)+((Number(S.settings.ptd)||4)-4)*(st.pass_td||0)+(recPts-1)*(st.rec||0))*10)/10;
}
async function fetchSleeperProjections(w, force){
  if(w<1 || w>18) return null;
  const league = await leagueMeta();
  const yr = league && league.season || new Date().getFullYear();
  const context = JSON.stringify([S.settings.sleeperLeagueId, yr, weeklyScoring(), S.settings.ptd, S.settings.scoring]);
  const key = LS_KEY+"-weekly-proj-"+yr+"-"+S.settings.sleeperLeagueId+"-"+w;
  const prev = PROJX.future[w];
  if(prev && prev.context!==context) delete PROJX.future[w];
  if(!force && prev && prev.context===context && Date.now()-prev.at < 30*60e3) return prev.map;
  try{
    const response = await fetch(SYNC.base+"/projections/nfl/regular/"+yr+"/"+w, {cache:"no-store"});
    if(!response.ok) throw new Error("Projection feed unavailable");
    const j = await response.json(), s2o = sleeperToOurs(), m = {};
    for(const sid in j){
      const oid = s2o[String(sid)], pts = scoreWeeklyStats(j[sid], weeklyScoring());
      if(oid && pts!=null && Number.isFinite(pts)) m[oid] = pts;
    }
    if(Object.keys(m).length <= 50) throw new Error("Projection feed incomplete");
    PROJX.future[w] = {map:m, at:Date.now(), context};
    try{ localStorage.setItem(key, JSON.stringify(PROJX.future[w])); }catch(e){}
  }catch(e){
    if(!PROJX.future[w]){
      try{ const c = JSON.parse(localStorage.getItem(key)||"null");
        if(c && c.context===context && c.map && Date.now()-c.at<24*3600e3) PROJX.future[w] = c;
      }catch(e2){}
    }
    if(PROJX.future[w]) PROJX.future[w].stale = true;
  }
  return (PROJX.future[w]||{}).map || null;
}
function sleeperWk(p, w){ const f = PROJX.future[w]; return (f && f.map[p.id]!=null) ? f.map[p.id] : null; }
function projSrcLabel(){                                                         // #1071
  const w = curWeek(), f = PROJX.future[w], mode = projSource();
  if(mode==="consensus") return CONSENSUS.weeks[w] ? "Consensus · W"+w : "Weekly feeds pending";
  if(mode==="baked" || !f) return "📊 baked";
  const stale = f.at && Date.now()-f.at > 2*60*60e3 ? " ⚠" : "";
  return (mode==="sleeper" ? "📱 wk"+w : "🔀 "+projBlendPct()+"%")+stale;
}
function projSourceLine(p){                                                      // card source note (#1077)
  try{
    const w = curWeek();
    if(projSource()==="consensus") return consensusNumbersHtml(p,w);
    const sv = sleeperWk(p, w);
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
  if(projSource()==="consensus"){
    const panel=document.createElement("div"); panel.id="dvOverlay"; panel.className="snov";
    panel.innerHTML='<div class="sbcard" role="dialog" aria-label="Weekly provider comparison"><button class="sbx" data-dvx="1" aria-label="Close comparison">✕</button><div class="tag">WEEK '+curWeek()+' PROVIDER COMPARISON</div>'+consensusSourcesHtml(curWeek())+consensusTableHtml(rosterIds(),idIndex(),curWeek()).replace('<details class="week-bench">','<details class="week-bench" open>')+'</div>';
    document.body.appendChild(panel);
    panel.addEventListener("click",e=>{if(e.target===panel || e.target.closest("[data-dvx]")) panel.remove();});
    return;
  }
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
function divergenceAlerts(){
  if(projSource()==="consensus") return; // Draft baselines are not current-week providers.                                                     // #1078 full send
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
  const effM = opts.oppEff || null;                                              // per-rid efficiency multipliers (#1112)
  const muOf = (r,w2)=> (vec ? (vec.mu[r][w2]??data.mu[r])*driftMult(vec, r, w2, wNow) : data.mu[r]) * (effM && r!==data.myRid && effM[r] ? effM[r] : 1);
  const noiseOf = (r,w2)=> (rng()+rng()+rng()-1.5)*2*(vec ? (vec.sd[r][w2]??26) : 13);
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
      const lw = weeks[weeks.length-1]||data.lastW;
      const g = (x,y,hx)=> (muOf(x,lw)+(hx?1.5:0)+noiseOf(x,lw)) >= (muOf(y,lw)+noiseOf(y,lw)) ? x : y;
      if(typeof CampaignModel!=='undefined'){
        const outcome=CampaignModel.bracket(seeds,(x,y,r)=>muOf(x,data.lastW+1+r)+noiseOf(x,data.lastW+1+r)>=muOf(y,data.lastW+1+r)+noiseOf(y,data.lastW+1+r)?x:y,!!data.reseed);
        if(outcome.finalists.includes(data.myRid))finals++;if(outcome.winner===data.myRid)titles++;
      } else if(seeds.length>=6){
        const w1 = g(seeds[2], seeds[5], true), w2b = g(seeds[3], seeds[4], true);
        const survivors = [w1, w2b].sort((x,y)=>seeds.indexOf(x)-seeds.indexOf(y));  // reseed (#1102)
        const f1 = g(seeds[0], survivors[1], true), f2 = g(seeds[1], survivors[0], true);
        if(f1===data.myRid || f2===data.myRid) finals++;
        if(g(f1, f2, seeds.indexOf(f1)<seeds.indexOf(f2))===data.myRid) titles++;
      } else {                                                                   // tiny fixtures: straight ladder
        if(mySeed<=1) finals++;
        if(mySeed===0) titles++;
      }
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
  if(VEC.key===key && VEC.campaignAt===(typeof CAMPAIGN!=="undefined"?CAMPAIGN.at:0) && VEC.mu[data.myRid]) return VEC;
  const byId = idIndex();
  VEC.mu = {}; VEC.sd = {};
  const weeks = [...new Set(Object.keys(data.schedule).map(Number).concat([data.lastW+1,data.lastW+2,data.lastW+3].filter(w=>w<=18)))];
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
  VEC.key = key; VEC.campaignAt=typeof CAMPAIGN!=="undefined"?CAMPAIGN.at:0;
  return VEC;
}
function driftMult(vec, rid, w2, wNow){                                          // waiver drift (#1101)
  const mus = Object.values(vec.mu).map(m2=>m2[w2]).filter(x=>x!=null).sort((a,b)=>a-b);
  const med = mus[Math.floor(mus.length/2)]||100;
  if((vec.mu[rid][w2]??med) >= med*0.9) return 1;
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
    '<div class="tag">🩹 FRAGILITY REPORT — depth grade '+depthGrade(myRid)+'</div>'+((typeof scTabs==="function")?scTabs("frag"):'');
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

/* ---------- R70 Opponent modeling (#1112–#1126) ---------- */
const OPPX = {at:0, eff:{}, faab:{}, futures:null, futuresAt:0, prevOdds:{}};
function teamEffMult(rid, hist){                                                 // #1112/#1119
  if(OPPX.eff[rid]!=null && Date.now()-OPPX.at < 10*60e3) return OPPX.eff[rid];
  const byId = idIndex();
  const effs = (hist||seasonArchive()).map(wm=>(wm||[]).find(x=>+x.roster_id===+rid)).filter(Boolean)
    .map(m=>lineupEffOf(m, byId)).filter(Boolean).map(e2=>e2.eff);
  const v = effs.length ? Math.max(0.85, Math.min(1, effs.reduce((a,b)=>a+b,0)/effs.length/100)) : 0.97;
  OPPX.eff[rid] = v; OPPX.at = Date.now();
  return v;
}
function faabAggro(rid, tendRows){                                               // #1113/#1122
  const t2 = (tendRows||[]).find(r=>+r.rid===+rid);
  if(!t2) return 1;
  const spend = t2.faab + t2.claims*3;
  return spend>=40 ? 1.5 : spend>=15 ? 1.15 : spend>0 ? 1 : 0.6;
}
async function leagueFutures(force){
  if(typeof CAMPAIGN!=='undefined' && CAMPAIGN.sim)return Object.fromEntries(CAMPAIGN.sim.rows.map(r=>[r.id,{make:Math.round(r.make),title:r.title,winsAvg:r.wins,rec:'—',eff:100}]));                                             // one sim powers everything (#1116/#1123)
  if(!force && OPPX.futures && Date.now()-OPPX.futuresAt < 15*60e3) return OPPX.futures;
  const data = await seasonSimData(); if(!data) return null;
  const hist = seasonArchive();
  const tend = leagueTendencies(await txHistory(), hist);
  const vectors = weeklyVectors(data);
  const rids = Object.keys(data.mu).map(Number);
  const wNow = curWeek();
  const out = {};
  for(const rid of rids){
    const d2 = Object.assign({}, data, {myRid:rid, rivRid:null});
    const eff = teamEffMult(rid, hist);
    const r = seasonSimX(d2, {N:150, seed:wNow*7+rid, myMult:eff, injuries:true, vectors});
    const topRec = Object.entries(r.recDist).sort((a,b)=>b[1]-a[1])[0];
    out[rid] = {rec:topRec?topRec[0]:"?", make:r.makePct, title:r.titlePct, winsAvg:r.winsAvg, eff:Math.round(eff*100)};
  }
  try{
    const k = LS_KEY+"-futprev"+wNow;
    if(!localStorage.getItem(k)){
      localStorage.setItem(k, JSON.stringify(Object.fromEntries(rids.map(r=>[r, out[r].make]))));
      const kp = LS_KEY+"-futprev"+(wNow-1);
      OPPX.prevOdds = JSON.parse(localStorage.getItem(kp)||"{}");
    } else OPPX.prevOdds = JSON.parse(localStorage.getItem(LS_KEY+"-futprev"+(wNow-1))||"{}");
  }catch(e){}
  try{ if(curWeek()>=6) OPPX.clinch = clinchMath(data, vectors, 400); }catch(e){}   // #1130/#1138
  OPPX.futures = out; OPPX.futuresAt = Date.now();
  return out;
}
function rootingGuide(data, vectors){                                            // pure-ish (#1117)
  const wNow = curWeek(), myRid = data.myRid;
  const base = seasonSimX(data, {N:120, seed:wNow*13, injuries:false, vectors});
  const out = [];
  (data.schedule[wNow]||[]).forEach(pair=>{
    if(pair.includes(myRid)) return;
    const [a,b] = pair;
    const muA = vectors ? vectors.mu[a][wNow] : data.mu[a];
    const muB = vectors ? vectors.mu[b][wNow] : data.mu[b];
    const fav = muA>=muB ? a : b, dog = muA>=muB ? b : a;
    const dataDog = Object.assign({}, data, {wins0:Object.assign({}, data.wins0, {[dog]:(data.wins0[dog]||0)+1}),
      schedule:Object.fromEntries(Object.entries(data.schedule).filter(([k2])=>+k2!==wNow))});
    const alt = seasonSimX(dataDog, {N:120, seed:wNow*13, injuries:false, vectors});
    const swing = alt.makePct - base.makePct;
    if(Math.abs(swing)>=2) out.push({root: swing>0 ? dog : fav, against: swing>0 ? fav : dog, swing:Math.abs(swing)});
  });
  return out.sort((a,b)=>b.swing-a.swing).slice(0,3);
}
async function myRootingGuide(){
  const data = await seasonSimData(); if(!data) return [];
  return rootingGuide(data, weeklyVectors(data));
}

/* ---------- R71 The what-if machine (#1127–#1141) ---------- */
const SIMD = {data:null, at:0};
async function ensureSimData(){
  if(SIMD.data && Date.now()-SIMD.at < 10*60e3) return SIMD.data;
  SIMD.data = await seasonSimData(); SIMD.at = Date.now();
  return SIMD.data;
}
function ciBand(pct, n){ return Math.round(Math.sqrt(Math.max(1, pct*(100-pct))/(n||150))*1.96); }   // #1131
function myVecWithDelta(vectors, data, delta){                                   // #1127/#1129/#1139
  const byId = idIndex();
  const ids = rosterIds().filter(id=>!((delta.dropIds)||[]).includes(id)).concat((delta.addIds)||[]);
  const myMu = {};
  Object.keys(vectors.mu[data.myRid]).map(Number).forEach(w2=>{
    let fix = null;
    if(delta.voidWeeks){
      fix = {};
      ids.map(id=>byId[id]).filter(Boolean).forEach(p=>{
        const vw = delta.voidWeeks[p.id];
        fix[p.id] = (vw && w2>=vw[0] && w2<=vw[1]) ? 0 : weekProj(p, w2);
      });
    }
    myMu[w2] = Math.max(60, bestStartersWeek(ids, byId, w2, fix).pts);
  });
  return {mu:Object.assign({}, vectors.mu, {[data.myRid]:myMu}), sd:vectors.sd};
}
function scenarioCore(data, vectors, delta, opts){                               // pure-ish
  const vec2 = (delta && (delta.addIds||delta.dropIds||delta.voidWeeks) && vectors)
    ? myVecWithDelta(vectors, data, delta) : vectors;
  return seasonSimX(data, Object.assign({N:150, seed:curWeek()*17, injuries:true, vectors:vec2}, opts||{}));
}
async function runScenario(delta, opts){
  const data = await ensureSimData(); if(!data) return null;
  return scenarioCore(data, weeklyVectors(data), delta||{}, opts);
}
function clinchMath(data, vectors, N){                                           // #1130
  const r = seasonSimX(data, {N:N||400, seed:curWeek()*23, injuries:false, vectors, tally:true});
  // build wins→make% from recDist + seed miss info: rerun capturing per-sim (wins, made) is cheaper inline:
  const rng = mulberry32(curWeek()*23);
  const rids = Object.keys(data.mu).map(Number);
  const weeks = Object.keys(data.schedule).map(Number).sort((a,b)=>a-b).filter(w2=>w2<=data.lastW);
  const table = {};
  const NN = N||400;
  const muOf = (r2,w2)=> vectors ? vectors.mu[r2][w2] : data.mu[r2];
  for(let s2=0; s2<NN; s2++){
    const wins = {}, pf = {};
    rids.forEach(r2=>{ wins[r2] = data.wins0[r2]||0; pf[r2] = data.pf0[r2]||0; });
    weeks.forEach(w2=>(data.schedule[w2]||[]).forEach(pair=>{
      const a = pair[0], b = pair[1];
      const sa = muOf(a,w2)+(rng()+rng()+rng()-1.5)*26, sb = muOf(b,w2)+(rng()+rng()+rng()-1.5)*26;
      pf[a]+=sa; pf[b]+=sb; if(sa>=sb) wins[a]++; else wins[b]++;
    }));
    const order = rids.slice().sort((x,y)=> wins[y]-wins[x] || pf[y]-pf[x]);
    const made = order.indexOf(data.myRid) < (data.spots||6);
    const wv = wins[data.myRid];
    (table[wv] = table[wv]||{n:0, made:0}).n++; if(made) table[wv].made++;
  }
  const rows = Object.keys(table).map(Number).sort((a,b)=>a-b)
    .map(wv=>({wins:wv, pct:Math.round(table[wv].made/table[wv].n*100), n:table[wv].n}));
  const clinch = rows.find(r2=>r2.pct>=95 && r2.n>=8);
  const elim = rows.slice().reverse().find(r2=>r2.pct<=5 && r2.n>=8);
  return {rows, clinchWins:clinch?clinch.wins:null, elimWins:elim?elim.wins:null};
}
function scenGet(){ try{ return JSON.parse(localStorage.getItem(LS_KEY+"-scen")||"[]"); }catch(e){ return []; } }
function scenSave(a){ try{ localStorage.setItem(LS_KEY+"-scen", JSON.stringify(a.slice(0,3))); }catch(e){} }
async function renderWhatIf(){                                                   // #1127/#1129/#1133/#1134
  const old = document.getElementById("wiOverlay"); if(old){ old.remove(); return; }
  toast("🧪 Base future computing…");
  const base = await runScenario(null, {N:200});
  if(!base) return toast("Link the league first", {warn:true});
  const byId = idIndex();
  const fas = (typeof freeAgents==="function") ? freeAgents().filter(p=>p.pos!=="DEF").sort((a,b)=>b.proj-a.proj).slice(0,20) : [];
  const mine = rosterIds().map(id=>byId[id]).filter(Boolean);
  const scans = scenGet();
  const ov = document.createElement("div"); ov.id = "wiOverlay"; ov.className = "snov";
  const band = ciBand(base.makePct, 200);
  let h = '<div class="sbcard" role="dialog" aria-label="What-if machine"><button class="sbx" data-wix="1">✕</button>'+
    '<div class="tag">🧪 WHAT-IF MACHINE</div>'+((typeof scTabs==="function")?scTabs("whatif"):'')+
    '<div class="sbply"><span>Base future</span><b class="mono">'+base.winsAvg+' wins · make '+base.makePct+'% ±'+band+' · title '+base.titlePct+'%</b></div>'+
    '<div class="benchhead">Build a scenario</div>'+
    '<div class="sspad" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'+
    '<select id="wiAdd"><option value="">＋ add nobody</option>'+fas.map(p=>'<option value="'+p.id+'">＋ '+esc(p.name)+' ('+ppgOf(p)+'/wk)</option>').join("")+'</select>'+
    '<select id="wiDrop"><option value="">− drop nobody</option>'+mine.filter(p=>p.pos!=="DEF").map(p=>'<option value="'+p.id+'">− '+esc(p.name)+'</option>').join("")+'</select>'+
    '<select id="wiVoid"><option value="">🩹 nobody hurt</option>'+mine.filter(p=>p.pos!=="DEF").map(p=>'<option value="'+p.id+'">🩹 '+esc(p.name)+'</option>').join("")+'</select>'+
    '<select id="wiVoidN"><option value="2">misses 2 wks</option><option value="4">4 wks</option><option value="6">6 wks</option></select>'+
    '<button class="hbtn act" id="wiRun">▶ Run 150 seasons</button></div><div id="wiOut"></div>';
  if(scans.length) h += '<div class="benchhead">Saved scenarios</div>'+scans.map((s3,i)=>
    '<div class="sbply"><span>'+esc(s3.name)+'</span><span><button class="undo1" data-wirun="'+i+'">▶</button> <button class="undo1" data-widel="'+i+'">✕</button></span></div>').join("")+
    '<div id="wiCmp"></div>';
  h += '<div class="benchhead">👑 Keeper board (next-year value)</div><div class="scarce">'+
    mine.filter(p=>p.pos!=="DEF").map(p=>({p, kv:(typeof keeperValue==="function")?keeperValue(p):0}))
      .sort((a,b)=>b.kv-a.kv).slice(0,5).map(x=>'<span class="scpill">'+esc(x.p.name.split(" ").slice(-1)[0])+' <b class="mono">'+x.kv+'</b></span>').join("")+'</div>';
  h += '</div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  const runDelta = async (delta, label)=>{
    const el = document.getElementById("wiOut");
    if(el) el.innerHTML = '<div class="sspad dim">simulating '+esc(label)+'…</div>';
    const r = await runScenario(delta, {N:150});
    if(!el || !r) return;
    const dMake = r.makePct-base.makePct, dTitle = Math.round((r.titlePct-base.titlePct)*10)/10;
    el.innerHTML = '<div class="benchhead">'+esc(label)+'</div>'+
      '<div class="sbply"><span>make the playoffs</span><b class="mono" style="color:var(--'+(dMake>=0?'green':'red')+')">'+r.makePct+'% ('+(dMake>=0?'+':'')+dMake+')</b></div>'+
      '<div class="sbply"><span>title</span><b class="mono">'+r.titlePct+'% ('+(dTitle>=0?'+':'')+dTitle+')</b></div>'+
      '<div class="sbply"><span>avg wins</span><b class="mono">'+r.winsAvg+' (base '+base.winsAvg+')</b></div>'+
      '<div class="sspad"><button class="hbtn" id="wiSave">💾 Save scenario</button></div>';
    window._wiLast = {delta, label, r};
  };
  ov.addEventListener("click", async e=>{
    if(e.target===ov || e.target.closest("[data-wix]")) return ov.remove();
    if(e.target.id==="wiRun"){
      const add = document.getElementById("wiAdd").value, drop = document.getElementById("wiDrop").value;
      const vid = document.getElementById("wiVoid").value, vn = +document.getElementById("wiVoidN").value;
      const delta = {};
      if(add) delta.addIds = [add];
      if(drop) delta.dropIds = [drop];
      if(vid){ const w0 = curWeek(); delta.voidWeeks = {[vid]:[w0, w0+vn-1]}; }
      if(!add && !drop && !vid) return toast("Pick at least one change", {warn:true});
      const label = [add?"+ "+byId[add].name:null, drop?"− "+byId[drop].name:null, vid?"🩹 "+byId[vid].name+" out "+vn+"wk":null].filter(Boolean).join(" · ");
      runDelta(delta, label);
      return;
    }
    if(e.target.id==="wiSave" && window._wiLast){
      const s3 = scenGet(); s3.unshift({name:window._wiLast.label, delta:window._wiLast.delta});
      scenSave(s3); ov.remove(); renderWhatIf();
      return;
    }
    const wr = e.target.closest("[data-wirun]");
    if(wr){ const s3 = scenGet()[+wr.dataset.wirun]; if(s3) runDelta(s3.delta, s3.name); return; }
    const wd = e.target.closest("[data-widel]");
    if(wd){ const s3 = scenGet(); s3.splice(+wd.dataset.widel,1); scenSave(s3); ov.remove(); renderWhatIf(); }
  });
}
function elimWatch(){                                                            // #1137
  try{
    if(typeof hypeOn!=="function" || !hypeOn("full") || !OPPX.clinch) return;
    const ms = (typeof myStandingsRow==="function") ? myStandingsRow() : null;
    if(!ms || OPPX.clinch.elimWins==null) return;
    const gamesLeft = 14-(ms.row.w+ms.row.l+ms.row.t);
    if(ms.row.w + gamesLeft - 1 === OPPX.clinch.elimWins){
      const k = LS_KEY+"-elimw"+curWeek();
      if(localStorage.getItem(k)) return;
      localStorage.setItem(k, "1");
      alertFire("elim", "⚠ Elimination math is live", "Lose this week and "+(OPPX.clinch.elimWins)+" wins becomes your ceiling — that's dead territory");
    }
  }catch(e){}
}

/* ---------- R72 Sim Center (#1142–#1156) ---------- */
const SC_TABS = [["week","🎲","This week"],["season","🔮","Season"],["whatif","🧪","What-if"],["frag","🩹","Fragility"]];
function scTabs(active){                                                         // #1142/#1143/#1150
  return '<div class="sctabs" role="tablist" aria-label="Sim Center">'+
    SC_TABS.map(([k2,ico,lab])=>'<button role="tab" aria-selected="'+(k2===active)+'" data-sctab="'+k2+'"'+
      (k2===active?' class="on"':'')+'><span>'+ico+'</span>'+lab+'</button>').join("")+
    '<span class="scmeta mono">'+((typeof projSrcLabel==="function")?projSrcLabel():'')+
    (S.settings.simInjuries!==false?' · 🩹on':' · 🩹off')+'</span></div>';
}
document.addEventListener("click", e=>{
  const t = e.target.closest("[data-sctab]");
  if(!t) return;
  e.preventDefault();
  const map = {week:"renderSim", season:"renderSeasonSim", whatif:"renderWhatIf", frag:"renderFragility"};
  const cur = t.closest(".snov");
  const fn = window[map[t.dataset.sctab]];
  if(t.getAttribute("aria-selected")==="true") return;
  if(cur) cur.remove();
  if(typeof fn==="function") fn();
});
function simCenter(){ if(typeof renderSim==="function") renderSim(); }           // #1149 default tab
function exportFuture(){                                                         // #1151
  if(!window._lastSeasonSimFull) return toast("Run the season sim first", {warn:true});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(window._lastSeasonSimFull, null, 1)], {type:"application/json"}));
  a.download = "war-room-future-wk"+curWeek()+".json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  toast("⇩ The future, exported");
}

window.__mod = window.__mod || []; window.__mod.push("simx.js");

/* Current-week consensus. Each provider contributes once; no draft or season-total fallback. */
const CONSENSUS = {weeks:{},pending:{}};
const WEEKLY_PROVIDERS = ['sleeper','espn','cbs'];
function projectionIdentity(name){ return String(name).toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g,'').replace(/[^a-z0-9]/g,''); }
function projectionContext(){
  return JSON.stringify([S.settings.sleeperLeagueId, WAIV.league && WAIV.league.season, weeklyScoring(), S.settings.ptd, S.settings.scoring]);
}
function providerPlayerId(row){
  const players=allPlayers(), key=projectionIdentity(row.name);
  if(row.position==='DEF' && row.team){
    const aliases={GB:'GBP',KC:'KCC',LV:'LVR',NE:'NEP',NO:'NOS',SF:'SFO',TB:'TBB',JAX:'JAC',WSH:'WAS'};
    return (players.find(p=>p.pos==='DEF' && p.team===(aliases[row.team]||row.team))||{}).id;
  }
  const matches=players.filter(p=>p.pos===row.position && projectionIdentity(p.name)===key);
  return matches.length===1 ? matches[0].id : null;
}
function providerLeaguePoints(row, scoring){
  const stats={...row.stats};
  if(row.position==='DEF' && stats.pts_allow!=null){
    // Approximation is exposed in the source table: mean PA is not a full scoring-tier distribution.
    const pa=stats.pts_allow;
    const bucket=pa<1?'pts_allow_0':pa<7?'pts_allow_1_6':pa<14?'pts_allow_7_13':pa<21?'pts_allow_14_20':pa<28?'pts_allow_21_27':pa<35?'pts_allow_28_34':'pts_allow_35p';
    stats[bucket]=1;
  }
  const weights=scoring||{pass_yd:.04,pass_td:+S.settings.ptd||6,pass_int:-1,rush_yd:.1,rush_td:6,rec:1,rec_yd:.1,rec_td:6,fum_lost:-2};
  const pts=Object.entries(weights).reduce((sum,[key,value])=>sum+(Number(stats[key])||0)*(Number(value)||0),0);
  return Number.isFinite(pts) ? Math.round(pts*100)/100 : null;
}
async function fetchCurrentProvider(source, season, week){
  const response=await fetch('/api/projections?source='+source+'&season='+season+'&week='+week,{cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok) throw new Error(source.toUpperCase()+' unavailable');
  const body=await response.json();
  if(body.source!==source || body.season!==+season || body.week!==week || !Array.isArray(body.rows)) throw new Error('Provider week/season mismatch');
  const map={}, approximate={};
  for(const row of body.rows){
    const id=providerPlayerId(row), pts=providerLeaguePoints(row,weeklyScoring());
    if(id && pts!=null){map[id]=pts;if(row.approximate) approximate[id]=true;}
  }
  return {map,approximate,at:body.fetchedAt,url:body.url,notes:body.notes||[],publishedAt:body.publishedAt};
}
async function fetchWeekProjections(w, force){
  if(w<1 || w>18) return null;
  await leagueMeta();
  const context=projectionContext(), season=Number(WAIV.league && WAIV.league.season)||new Date().getFullYear();
  const key=LS_KEY+'-consensus-'+season+'-'+S.settings.sleeperLeagueId+'-'+w;
  const old=CONSENSUS.weeks[w];
  if(!force && old && old.context===context && Date.now()-old.at<15*60e3) return old;
  const pendingKey=context+':'+w;
  if(CONSENSUS.pending[pendingKey]) return CONSENSUS.pending[pendingKey];
  const run=(async()=>{
    const results=await Promise.allSettled([
      fetchSleeperProjections(w,force).then(map=>{const f=PROJX.future[w];if(!map || !f || f.stale) throw new Error('Sleeper refresh unavailable');return {map,at:f.at,url:SYNC.base+'/projections/nfl/regular/'+season+'/'+w,notes:['Weekly stat projections; source update time not supplied.']};}),
      fetchCurrentProvider('espn',season,w),fetchCurrentProvider('cbs',season,w)
    ]);
    const sources={};
    results.forEach((result,i)=>{sources[WEEKLY_PROVIDERS[i]]=result.status==='fulfilled'?result.value:{map:{},error:'Could not refresh this provider'};});
    if(context!==projectionContext()) return null; // Ignore an in-flight response after the user switches leagues.
    const entry={season,week:w,context,at:Date.now(),sources};
    if(results.some(r=>r.status==='fulfilled')){
      CONSENSUS.weeks[w]=entry;
      try{localStorage.setItem(key,JSON.stringify(entry));}catch(e){}
    }else{
      let cached=old;
      if(!cached) try{cached=JSON.parse(localStorage.getItem(key)||'null');}catch(e){}
      CONSENSUS.weeks[w]=cached && cached.context===context && Date.now()-cached.at<24*3600e3 ? {...cached,stale:true} : entry;
    }
    return CONSENSUS.weeks[w];
  })().finally(()=>delete CONSENSUS.pending[pendingKey]);
  CONSENSUS.pending[pendingKey]=run;
  return run;
}
function consensusFor(p,w){
  const entry=CONSENSUS.weeks[w];
  if(!entry || entry.context!==projectionContext() || Date.now()-entry.at>24*3600e3) return null;
  const values=[];
  for(const source of WEEKLY_PROVIDERS){
    const feed=entry.sources[source], value=feed && feed.map[p.id];
    if(value!=null && Number.isFinite(value) && Date.now()-feed.at<24*3600e3) values.push({source,value,at:feed.at,approximate:!!(feed.approximate&&feed.approximate[p.id])});
  }
  if(!values.length) return null;
  const points=values.map(v=>v.value);
  return {mean:Math.round(points.reduce((n,v)=>n+v,0)/points.length*10)/10,min:Math.min(...points),max:Math.max(...points),count:points.length,values,stale:!!entry.stale};
}
function consensusVote(start,bench,w){
  const a=consensusFor(start,w),b=consensusFor(bench,w);
  if(!a || !b) return '';
  const common=a.values.map(v=>({a:v,b:b.values.find(x=>x.source===v.source)})).filter(v=>v.b);
  const wins=common.filter(v=>v.a.value>v.b.value).length;
  return common.length ? wins+' of '+common.length+' shared sources favor '+start.name+'.' : '';
}
function consensusNumbersHtml(p,w){
  const c=consensusFor(p,w);
  if(!c) return '<span class="week-reason">No current weekly projection</span>';
  return '<span class="week-reason source-numbers">'+c.values.map(v=>v.source.toUpperCase()+' '+v.value.toFixed(1)).join(' · ')+'</span>'+
    '<span class="week-reason">'+c.count+' source'+(c.count===1?' only':'s')+' · source range '+c.min.toFixed(1)+'–'+c.max.toFixed(1)+(c.stale?' · cached snapshot':'')+'</span>';
}
function consensusSourcesHtml(w){
  const entry=CONSENSUS.weeks[w];
  if(!entry || entry.context!==projectionContext()) return '<p class="week-warning">Loading current weekly providers. Recommendations wait for their projections.</p>';
  const title={sleeper:'Sleeper',espn:'ESPN',cbs:'CBS Sports'};
  return '<div class="consensus-sources">'+WEEKLY_PROVIDERS.map(source=>{
    const s=entry.sources[source], count=Object.keys(s.map||{}).length;
    const time=s.at?new Date(s.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'unavailable';
    return '<div><b>'+(s.url?'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+title[source]+' ↗</a>':title[source])+'</b><span>'+entry.season+' · Week '+w+'</span><small>'+(count?'Retrieved '+time+' · '+count+' players':'Unavailable — excluded from average')+'</small></div>';
  }).join('')+'</div><details class="consensus-method"><summary>How the average works</summary><p class="week-note">Equal-weight average of available weekly providers, not a proven accuracy ranking. Source ranges show disagreement, not confidence intervals. Retrieval time is when we checked; providers do not supply a reliable last-updated time. No preseason estimates or draft overrides enter this consensus.</p></details>';
}
function consensusTableHtml(ids,byId,w){
  return '<details class="week-bench"><summary>Compare every player’s provider projections</summary><div class="consensus-scroll"><table class="consensus-table"><thead><tr><th>Player</th><th>Sleeper</th><th>ESPN</th><th>CBS</th><th>Mean</th></tr></thead><tbody>'+ids.map(id=>{
    const p=byId[id];if(!p)return '';
    const c=consensusFor(p,w);
    return '<tr><th>'+esc(p.name)+'</th>'+WEEKLY_PROVIDERS.map(source=>{const v=c&&c.values.find(x=>x.source===source);return '<td>'+(v?v.value.toFixed(1):'—')+'</td>';}).join('')+'<td><b>'+(c?c.mean.toFixed(1):'—')+'</b></td></tr>';
  }).join('')+'</tbody></table></div><p class="week-note">D/ST conversions for ESPN and CBS are approximate: their expected points allowed select your league’s scoring tier. CBS rounds projected stats and does not publish every rare scoring category. These limitations can affect close defense calls.</p></details>';
}
