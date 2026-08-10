/* ============================================================
   season.js — Season Mode: weekly lineups, scoreboard, waivers,
   trades, game-day alerts, season analytics. Loads after core.js
   (state + engine helpers) and before views.js (render helpers are
   only called at runtime, after all modules are in).
   ============================================================ */

/* ---------- R38 My Week: the weekly lineup command center (#640–#654) ---------- */
const WEEKST = {week:0, at:0, mate:null, mw:0, matchAt:0};
async function refreshWeek(){                                                   // #640
  if(+S.settings.weekOverride){ WEEKST.week = +S.settings.weekOverride; window._nflWeek = WEEKST.week; return WEEKST.week; }
  if(WEEKST.week && Date.now()-WEEKST.at < 30*60e3) return WEEKST.week;
  try{
    const st = await (await fetch(SYNC.base+"/state/nfl")).json();
    WEEKST.week = st.season_type==="pre" ? 1 : Math.max(1, Math.min(18, +st.week || +st.leg || 1));
    WEEKST.at = Date.now();
    window._nflWeek = WEEKST.week;
  }catch(e){ WEEKST.week = WEEKST.week || 1; }
  return WEEKST.week;
}
function curWeek(){ return +S.settings.weekOverride || WEEKST.week || window._nflWeek || 1; }
const SEASON_LIVE = {ids:null, at:0};
async function myRosterId(){
  if(S.settings.sleeperRosterId) return +S.settings.sleeperRosterId;
  const lg = (S.settings.sleeperLeagueId||"").trim(); if(!lg) return null;
  try{
    let did = (S.settings.sleeperDraftId||"").trim();
    if(!did){ const ds = await (await fetch(SYNC.base+"/league/"+lg+"/drafts")).json(); if(ds && ds[0]) did = ds[0].draft_id; }
    if(did){
      const dr = await (await fetch(SYNC.base+"/draft/"+did)).json();
      if(dr.slot_to_roster_id) S.settings.slot2rid = dr.slot_to_roster_id;
      const rid = (dr.slot_to_roster_id||{})[String(S.settings.slot)];
      if(rid){ S.settings.sleeperRosterId = +rid; commit(); return +rid; }
    }
  }catch(e){}
  return null;
}
async function myLiveIds(force){                                                // #641
  const lg = (S.settings.sleeperLeagueId||"").trim(); if(!lg) return null;
  if(!force && SEASON_LIVE.ids && Date.now()-SEASON_LIVE.at < 5*60e3) return SEASON_LIVE.ids;
  try{
    const rid = await myRosterId(); if(rid==null) return null;
    const rosters = await (await fetch(SYNC.base+"/league/"+lg+"/rosters")).json();
    const mine = (rosters||[]).find(r=>+r.roster_id===+rid); if(!mine) return null;
    const map = sleeperToOurs();
    SEASON_LIVE.ids = (mine.players||[]).map(id=>map[String(id)]).filter(Boolean);
    SEASON_LIVE.at = Date.now();
  }catch(e){}
  return SEASON_LIVE.ids;
}
function rosterIds(){ return (SEASON_LIVE.ids && SEASON_LIVE.ids.length) ? SEASON_LIVE.ids : myIds(); }
/* opponent-defense toughness: rank 1 (meanest) … 32 (softest) from DEF projections */
function defToughRank(team){
  const r = cached("deftough", ()=>{
    const defs = allPlayers().filter(p=>p.pos==="DEF").sort((a,b)=>b.proj-a.proj);
    const out = {}; defs.forEach((d,i)=>{ out[d.team] = i+1;
      const slp = ({SFO:"SF",GBP:"GB",KCC:"KC",NEP:"NE",NOS:"NO",TBB:"TB",LVR:"LV",JAC:"JAX"})[d.team];
      if(slp) out[slp] = i+1; });
    return out;
  });
  return r[team] || 16;
}
function weekProj(p, w){                                                        // #642
  if(typeof BYES!=="undefined" && BYES[p.team]===w) return 0;
  const e = (typeof injuryOf==="function") ? injuryOf(p) : null;
  const sev = e ? injSeverity(e.s) : null;
  if(sev && (sev.code==="IR" || sev.code==="O")) return 0;
  let pts = p.proj/16;
  if(sev && sev.code==="D") pts *= 0.4;
  else if(sev && sev.code==="Q") pts *= 0.85;
  const opp = (typeof SCHED!=="undefined" && SCHED[p.team]) ? SCHED[p.team][w] : null;
  if(!opp && p.pos!=="DEF" && typeof SCHED!=="undefined" && SCHED[p.team]) return 0;  // no game that week
  if(opp && p.pos!=="DEF") pts *= 1 + (defToughRank(opp)-16.5)/110;              // soft matchup lean
  return Math.round(pts*10)/10;
}
function bestStartersWeek(ids, byId, w, fixture){                               // #642/#654
  const ps = ids.map(id=>byId[id]).filter(Boolean)
    .map(p=>({p, wp: fixture ? (fixture[p.id]!=null?+fixture[p.id]:0) : weekProj(p, w)}))
    .sort((a,b)=>b.wp-a.wp);
  const used = new Set();
  const take = poss=>{
    for(const x of ps) if(!used.has(x.p.id) && poss.includes(x.p.pos) && x.wp>0){ used.add(x.p.id); return x; }
    for(const x of ps) if(!used.has(x.p.id) && poss.includes(x.p.pos)){ used.add(x.p.id); return x; }
    return null;
  };
  const sl = slotCfg(), defs = [];
  const add = (n,lab,poss)=>{ for(let i=1;i<=n;i++) defs.push([n>1?lab+i:lab, poss]); };
  add(sl.QB,"QB",["QB"]); add(sl.RB,"RB",["RB"]); add(sl.WR,"WR",["WR"]); add(sl.TE,"TE",["TE"]);
  add(sl.FLEX,"FLEX",["RB","WR","TE"]); add(sl.SF,"SFLX",["QB","RB","WR","TE"]);
  add(sl.DEF,"DEF",["DEF"]); add(sl.K,"K",["K"]);
  const line = defs.map(([lab,poss])=>{ const x = take(poss); return {lab, p:x?x.p:null, wp:x?x.wp:0}; });
  return {line, starterIds:new Set([...used]), pts:Math.round(line.reduce((a,s)=>a+s.wp,0)*10)/10};
}
function winProb(a, b){ const s = Math.max(10, 0.16*(a+b)/2); return 1/(1+Math.exp(-(a-b)/s)); }   // #647
async function myWeekData(force){                                               // #644/#646
  const lg = (S.settings.sleeperLeagueId||"").trim(); if(!lg) return null;
  const w = curWeek();
  if(!force && WEEKST.mate && WEEKST.mw===w && Date.now()-WEEKST.matchAt < 5*60e3) return WEEKST.mate;
  try{
    const rid = await myRosterId(); if(rid==null) return null;
    const [mus, rosters, users] = await Promise.all([
      fetch(SYNC.base+"/league/"+lg+"/matchups/"+w).then(r=>r.json()),
      fetch(SYNC.base+"/league/"+lg+"/rosters").then(r=>r.json()),
      fetch(SYNC.base+"/league/"+lg+"/users").then(r=>r.json())
    ]);
    const mine = (mus||[]).find(m=>+m.roster_id===+rid);
    const opp = mine ? (mus||[]).find(m=>m.matchup_id===mine.matchup_id && +m.roster_id!==+rid) : null;
    const rmap = {}; (rosters||[]).forEach(r=>rmap[r.roster_id]=r);
    const umap = {}; (users||[]).forEach(u=>umap[u.user_id]=u.display_name);
    const map = sleeperToOurs();
    const conv = m=>m ? {rid:m.roster_id, pts:m.points||0,
      name:umap[(rmap[m.roster_id]||{}).owner_id] || ("Team "+m.roster_id),
      starters:(m.starters||[]).map(id=>map[String(id)]||null),
      ids:(m.players||[]).map(id=>map[String(id)]).filter(Boolean),
      ppts:m.players_points||{}} : null;
    WEEKST.mate = {w, me:conv(mine), opp:conv(opp)};
    WEEKST.mw = w; WEEKST.matchAt = Date.now();
  }catch(e){}
  return WEEKST.mate;
}
function startSitWhy(inn, out, w){                                              // #650
  const bits = [];
  if(out){
    if(typeof BYES!=="undefined" && BYES[out.team]===w) bits.push(out.name.split(" ").slice(-1)[0]+" is on bye");
    else { const e = injuryOf(out); if(e){ const sv = injSeverity(e.s); if(sv) bits.push(out.name.split(" ").slice(-1)[0]+" is "+sv.label.toLowerCase()); } }
  }
  if(inn && inn.pos!=="DEF" && typeof SCHED!=="undefined" && SCHED[inn.team] && SCHED[inn.team][w]){
    const rk = defToughRank(SCHED[inn.team][w]);
    if(rk>=22) bits.push("soft matchup vs "+SCHED[inn.team][w]);
  }
  if(!bits.length && inn && typeof buzzOf==="function" && buzzOf(inn)>1000) bits.push("trending up");
  return bits.length ? "— "+bits[0] : "";
}
function lineupAlarm(){                                                          // #645
  try{
    if(!SEASON.on || S.settings.heatAlerts===false) return;
    const md = WEEKST.mate; if(!md || !md.me || !md.me.starters) return;
    const w = curWeek(), byId = idIndex();
    const actual = md.me.starters.filter(Boolean);
    if(!actual.length) return;
    const bs = bestStartersWeek(rosterIds(), byId, w);
    const actPts = actual.map(id=>byId[id]).filter(Boolean).reduce((a,p)=>a+weekProj(p,w),0);
    const left = Math.round((bs.pts-actPts)*10)/10;
    const dead = actual.map(id=>byId[id]).filter(Boolean)
      .filter(p=>weekProj(p,w)===0).map(p=>p.name);
    if(left<=3 && !dead.length) return;
    const k = LS_KEY+"-lineupalarm";
    if(localStorage.getItem(k)===String(w)) return;
    localStorage.setItem(k, String(w));
    const msg = dead.length ? "🚨 "+dead[0]+" is in your Sleeper lineup but projects ZERO (bye/out)"
      : "⚠ Your Sleeper lineup leaves "+left+" pts on the bench";
    toast(msg, {warn:true});
    if("Notification" in window && Notification.permission==="granted" && document.visibilityState==="hidden"){
      try{ new Notification("📋 Lineup check — week "+w, {body:msg.replace(/^[^\w]+/,""), icon:"icon-192.png", tag:"lineup"}); }catch(e2){}
    }
  }catch(e){}
}

/* ---------- R39 Scoreboard, standings, playoff odds (#655–#669) ---------- */
const SCOREB = {at:0, w:0, mus:null, rosters:null, users:null, hist:null, histW:0, future:null, futureW:0};
function scoreRefreshMs(){                                                       // #665
  const d = new Date(), day = d.getDay(), h = d.getHours();
  const live = (day===0 && h>=13) || ((day===1 || day===4) && h>=20) || (day===2 && h<1);
  return live ? 2*60e3 : 15*60e3;
}
async function leagueWeekData(force){                                            // #655
  const lg = (S.settings.sleeperLeagueId||"").trim(); if(!lg) return null;
  const w = curWeek();
  if(!force && SCOREB.mus && SCOREB.w===w && Date.now()-SCOREB.at < scoreRefreshMs()) return SCOREB;
  try{
    const [mus, rosters, users] = await Promise.all([
      fetch(SYNC.base+"/league/"+lg+"/matchups/"+w).then(r=>r.json()),
      fetch(SYNC.base+"/league/"+lg+"/rosters").then(r=>r.json()),
      fetch(SYNC.base+"/league/"+lg+"/users").then(r=>r.json())
    ]);
    if(Array.isArray(mus)){ SCOREB.mus=mus; SCOREB.rosters=rosters; SCOREB.users=users; SCOREB.w=w; SCOREB.at=Date.now(); }
  }catch(e){}
  return SCOREB.mus ? SCOREB : null;
}
async function leagueHistory(){                                                  // #662/#663/#664
  const lg = (S.settings.sleeperLeagueId||"").trim(); if(!lg) return SCOREB.hist || [];
  const w = curWeek();
  if(SCOREB.hist && SCOREB.histW===w) return SCOREB.hist;
  const k = LS_KEY+"-mhist";
  let hist = []; try{ hist = JSON.parse(localStorage.getItem(k)||"[]"); }catch(e){}
  try{
    for(let pw=hist.length+1; pw<w; pw++){
      const mus = await (await fetch(SYNC.base+"/league/"+lg+"/matchups/"+pw)).json();
      if(Array.isArray(mus) && mus.some(m=>(m.points||0)>0)) hist.push(mus); else break;
    }
    try{ localStorage.setItem(k, JSON.stringify(hist)); }catch(e2){}
  }catch(e){}
  SCOREB.hist = hist; SCOREB.histW = w;
  return hist;
}
function ridName(rid, sb){
  sb = sb || SCOREB;
  const ro = (sb.rosters||[]).find(r=>+r.roster_id===+rid);
  const u = ro ? (sb.users||[]).find(u2=>u2.user_id===ro.owner_id) : null;
  return u ? u.display_name : "Team "+rid;
}
function scoreboardRows(sb, byId){                                               // pure (#655–#657)
  const mus = sb.mus||[], w = sb.w||curWeek(), pairs = {}, rows = [];
  mus.forEach(m=>{ (pairs[m.matchup_id]=pairs[m.matchup_id]||[]).push(m); });
  const s2o = (typeof sleeperToOurs==="function") ? sleeperToOurs() : {};
  const side = m=>{
    let rem = 0;
    (m.starters||[]).forEach(sid=>{
      const played = m.players_points && m.players_points[sid]!=null && m.players_points[sid]!==0;
      if(!played){ const p = byId[s2o[String(sid)]]; if(p) rem += weekProj(p, w); }
    });
    return {rid:m.roster_id, name:ridName(m.roster_id, sb), live:Math.round((m.points||0)*10)/10,
      proj:Math.round(((m.points||0)+rem)*10)/10, ppts:m.players_points||{}, starters:m.starters||[]};
  };
  Object.values(pairs).forEach(pr=>{ if(pr.length===2) rows.push([side(pr[0]), side(pr[1])]); });
  return rows;
}
function standingsRows(rosters, users){                                          // pure (#658)
  const un = {}; (users||[]).forEach(u=>un[u.user_id]=u.display_name);
  const g = r=>(r.settings||{});
  return (rosters||[]).map(r=>({rid:r.roster_id, name:un[r.owner_id]||("Team "+r.roster_id),
    w:g(r).wins||0, l:g(r).losses||0, t:g(r).ties||0,
    pf:Math.round((g(r).fpts||0) + (g(r).fpts_decimal||0)/100),
    pa:Math.round((g(r).fpts_against||0) + (g(r).fpts_against_decimal||0)/100),
    streak:(r.metadata && r.metadata.streak)||""}))
    .sort((a,b)=> b.w-a.w || b.pf-a.pf);
}
function rosterStrengthOf(rid){
  const byId = idIndex(), map = sleeperToOurs();
  const ro = (SCOREB.rosters||[]).find(r=>+r.roster_id===+rid);
  if(!ro) return 0;
  const ids = (ro.players||[]).map(id=>map[String(id)]).filter(Boolean);
  return ids.length ? bestStarters(ids, byId).pts : 0;
}
function powerRankings(){                                                        // #659
  const st = standingsRows(SCOREB.rosters, SCOREB.users);
  if(!st.length) return [];
  const mxPF = Math.max(...st.map(r=>r.pf), 1);
  const rows = st.map(r=>{
    const gp = r.w+r.l+r.t || 1, str = rosterStrengthOf(r.rid);
    return Object.assign({}, r, {str, score: 0.45*(r.w/gp) + 0.30*(r.pf/mxPF) + 0.25*(str ? Math.min(1, str/2200) : 0)});
  }).sort((a,b)=>b.score-a.score);
  const k = LS_KEY+"-powerprev";
  let prev = {}; try{ prev = JSON.parse(localStorage.getItem(k)||"{}"); }catch(e){}
  rows.forEach((r,i)=>{ r.move = prev[r.rid]!=null ? prev[r.rid]-i : 0; });
  try{ localStorage.setItem(k, JSON.stringify(Object.fromEntries(rows.map((r,i)=>[r.rid,i])))); }catch(e){}
  return rows;
}
async function playoffOdds(nSims){                                               // #660
  const lg = (S.settings.sleeperLeagueId||"").trim(); if(!lg || !SCOREB.rosters) return null;
  const w = curWeek(), LAST = 14, N = nSims||300, SPOTS = 6;
  if(!SCOREB.future || SCOREB.futureW!==w){
    try{
      const fut = {};
      for(let fw=w+1; fw<=LAST; fw++) fut[fw] = await (await fetch(SYNC.base+"/league/"+lg+"/matchups/"+fw)).json();
      SCOREB.future = fut; SCOREB.futureW = w;
    }catch(e){ return null; }
  }
  const st = standingsRows(SCOREB.rosters, SCOREB.users);
  const mu = {}; st.forEach(r=>{ mu[r.rid] = Math.max(80, rosterStrengthOf(r.rid)/16); });
  const madeIt = {}; st.forEach(r=>madeIt[r.rid]=0);
  for(let s2=0; s2<N; s2++){
    const wins = {}, pf = {};
    st.forEach(r=>{ wins[r.rid]=r.w; pf[r.rid]=r.pf; });
    for(let fw=w; fw<=LAST; fw++){
      const mus = fw===w ? SCOREB.mus : (SCOREB.future[fw]||[]);
      const pairs = {}; (mus||[]).forEach(m=>{ (pairs[m.matchup_id]=pairs[m.matchup_id]||[]).push(m); });
      Object.values(pairs).forEach(pr=>{
        if(pr.length!==2) return;
        const a = pr[0].roster_id, b = pr[1].roster_id;
        const sa = mu[a] + (Math.random()+Math.random()+Math.random()-1.5)*28;
        const sb2 = mu[b] + (Math.random()+Math.random()+Math.random()-1.5)*28;
        pf[a]+=sa; pf[b]+=sb2;
        if(sa>=sb2) wins[a]++; else wins[b]++;
      });
    }
    st.map(r=>r.rid).sort((x,y)=> wins[y]-wins[x] || pf[y]-pf[x]).slice(0,SPOTS).forEach(rid=>madeIt[rid]++);
  }
  const out = {}; st.forEach(r=>out[r.rid] = Math.round(madeIt[r.rid]/N*100));
  return out;
}
function allPlayStandings(hist, rosters, users){                                 // pure (#662)
  const un = {}; (users||[]).forEach(u=>un[u.user_id]=u.display_name);
  const ap = {};
  (rosters||[]).forEach(r=>ap[r.roster_id]={rid:r.roster_id, name:un[r.owner_id]||("Team "+r.roster_id),
    apw:0, apl:0, w:(r.settings&&r.settings.wins)||0});
  const oppN = Math.max(1, (rosters||[]).length-1);
  (hist||[]).forEach(weekMus=>{
    const scores = (weekMus||[]).map(m=>({rid:m.roster_id, pts:m.points||0}));
    scores.forEach(a=>scores.forEach(b=>{
      if(a.rid===b.rid || !ap[a.rid]) return;
      if(a.pts>b.pts) ap[a.rid].apw++; else if(a.pts<b.pts) ap[a.rid].apl++;
    }));
  });
  return Object.values(ap).map(r=>{
    const xw = Math.round(r.apw/oppN*10)/10;
    return Object.assign({}, r, {xWins:xw, luck:Math.round((r.w-xw)*10)/10});
  }).sort((a,b)=>b.apw-a.apw);
}
function weeklyAwards(weekMus, sb){                                              // pure (#663)
  const finals = (weekMus||[]).filter(m=>(m.points||0)>0);
  if(!finals.length) return null;
  const hi = finals.slice().sort((a,b)=>b.points-a.points)[0];
  const lo = finals.slice().sort((a,b)=>a.points-b.points)[0];
  const pairs = {}; finals.forEach(m=>{ (pairs[m.matchup_id]=pairs[m.matchup_id]||[]).push(m); });
  let blow = null, nail = null;
  Object.values(pairs).forEach(pr=>{
    if(pr.length!==2) return;
    const d = Math.abs(pr[0].points-pr[1].points);
    const wm = pr[0].points>pr[1].points ? pr[0] : pr[1];
    if(!blow || d>blow.d) blow = {d, rid:wm.roster_id};
    if(!nail || d<nail.d) nail = {d, rid:wm.roster_id};
  });
  return {hi:{rid:hi.roster_id, pts:Math.round(hi.points*10)/10, name:ridName(hi.roster_id, sb)},
    lo:{rid:lo.roster_id, pts:Math.round(lo.points*10)/10, name:ridName(lo.roster_id, sb)},
    blow:blow ? {rid:blow.rid, d:Math.round(blow.d*10)/10, name:ridName(blow.rid, sb)} : null,
    nail:nail ? {rid:nail.rid, d:Math.round(nail.d*10)/10, name:ridName(nail.rid, sb)} : null};
}
function lineupEffOf(m, byId){                                                   // pure (#664)
  if(!m || !m.players_points) return null;
  const pts = id=>+m.players_points[id]||0;
  const actual = (m.starters||[]).reduce((a,id)=>a+pts(id),0);
  const s2o = (typeof sleeperToOurs==="function") ? sleeperToOurs() : {};
  const cands = (m.players||[]).map(sid=>({sid, p:byId[s2o[String(sid)]], got:pts(sid)})).filter(x=>x.p);
  const used = new Set();
  const take = poss=>{
    let best = null;
    for(const x of cands){ if(used.has(x.sid) || !poss.includes(x.p.pos)) continue; if(!best || x.got>best.got) best = x; }
    if(best) used.add(best.sid);
    return best;
  };
  const sl = slotCfg(); let opt = 0;
  const grabN = (n,poss)=>{ for(let i=0;i<n;i++){ const x = take(poss); if(x) opt += x.got; } };
  grabN(sl.QB,["QB"]); grabN(sl.RB,["RB"]); grabN(sl.WR,["WR"]); grabN(sl.TE,["TE"]);
  grabN(sl.FLEX,["RB","WR","TE"]); grabN(sl.SF,["QB","RB","WR","TE"]); grabN(sl.DEF,["DEF"]);
  return {actual:Math.round(actual*10)/10, opt:Math.round(opt*10)/10, eff: opt ? Math.round(actual/opt*100) : 100};
}


/* ---------- season render surfaces (defined here, called at render time) ---------- */
/* ---------- My Week panel: the weekly command center (#643–#652) ---------- */
function myWeekHtml(byId){
  if(typeof bestStartersWeek!=="function") return "";
  const w = curWeek();
  const ids = rosterIds();
  if(!ids.length) return "";
  const bs = bestStartersWeek(ids, byId, w);
  let cd = "";                                   // kickoff lock countdown (#649)
  try{
    const now = new Date();
    const th = new Date(now); th.setHours(20,15,0,0);
    th.setDate(th.getDate() + ((4 - th.getDay()) + 7) % 7);
    if(th <= now) th.setDate(th.getDate() + 7);
    const ms = th - now, dd = Math.floor(ms/86400000), hh = Math.floor(ms%86400000/3600000);
    cd = ' · 🔒 locks in ' + (dd>0 ? dd+'d '+hh+'h' : hh+'h');
  }catch(e){}
  const live = (typeof SEASON_LIVE!=="undefined" && SEASON_LIVE.ids && SEASON_LIVE.ids.length);
  let h = '<div class="benchhead">🗓 MY WEEK '+w+' — optimal '+fmt(bs.pts)+' proj'+cd+(live?'':' · <span style="color:var(--dim)">draft-day roster — link your league for live</span>')+'</div>';
  h += '<div class="scarce">'+bs.line.map(sl=>{
    if(!sl.p) return '<span class="scpill" style="color:var(--red)">'+sl.lab+': HOLE</span>';
    const p = sl.p, bye = (typeof BYES!=="undefined" && BYES[p.team]===w);
    const e = injuryOf(p), sv = e ? injSeverity(e.s) : null;
    return '<span class="scpill" data-card="'+p.id+'" style="cursor:pointer" title="'+esc(p.name)+' — '+sl.wp+' proj">'+sl.lab+' '+
      esc(p.name.split(" ").slice(-1)[0])+(bye?' 🚫':'')+(sv?' <span class="'+sv.cls+'">'+sv.code+'</span>':'')+
      ' <b class="mono">'+sl.wp+'</b></span>';
  }).join("")+'</div>';
  // start/sit vs my ACTUAL Sleeper lineup (#644)
  const md = (typeof WEEKST!=="undefined") ? WEEKST.mate : null;
  if(md && md.me && md.me.starters && md.me.starters.filter(Boolean).length){
    const actual = md.me.starters.filter(Boolean);
    const actualSet = new Set(actual);
    const actPts = actual.map(id=>byId[id]).filter(Boolean).reduce((a,p)=>a+weekProj(p,w),0);
    const left = Math.round((bs.pts-actPts)*10)/10;
    if(left > 1){
      const outs = actual.filter(id=>!bs.starterIds.has(id)).map(id=>byId[id]).filter(Boolean);
      const ins = [...bs.starterIds].filter(id=>!actualSet.has(id)).map(id=>byId[id]).filter(Boolean);
      h += '<div class="benchhead" style="color:var(--red)">⚠ Sleeper lineup leaves <b class="mono">'+left+'</b> pts on the bench</div><div class="scarce">'+
        ins.slice(0,4).map((p,i)=>'<span class="scpill">▲ '+esc(p.name)+(outs[i]?' <span style="color:var(--dim)">over '+esc(outs[i].name)+'</span>':'')+
          ' <span style="color:var(--dim)">'+esc(startSitWhy(p, outs[i], w))+'</span></span>').join("")+'</div>';
    } else {
      h += '<div class="benchhead" style="color:var(--green)">✓ Sleeper lineup is optimal — nothing left on the bench</div>';
    }
  }
  // superflex discipline guard (#652)
  const sfx = bs.line.find(sl=>sl.lab==="SFLX");
  if(sfx && sfx.p && sfx.p.pos!=="QB"){
    const benchQB = ids.map(id=>byId[id]).filter(Boolean)
      .filter(p=>p.pos==="QB" && !bs.starterIds.has(p.id) && weekProj(p,w)>0);
    if(benchQB.length) h += '<div class="benchhead" style="color:var(--gold)">🎛 SFLX holds '+esc(sfx.p.name)+' while QB '+esc(benchQB[0].name)+' sits — 6-pt pass TDs usually say start the QB</div>';
  }
  // matchup preview + win prob (#646/#647)
  if(md && md.opp){
    const oppBs = bestStartersWeek(md.opp.ids, byId, w);
    const wp = winProb(bs.pts, oppBs.pts);
    const mx = Math.max(bs.pts, oppBs.pts, 1);
    h += '<div class="benchhead">⚔ vs '+esc(md.opp.name)+' — win prob <b style="color:var(--gold)">'+Math.round(wp*100)+'%</b> · proj <b class="mono">'+fmt(bs.pts)+'–'+fmt(oppBs.pts)+'</b></div>'+
      '<div style="padding:2px 12px 8px" aria-hidden="true">'+
      '<div style="height:7px;border-radius:4px;background:var(--green);width:'+Math.round(bs.pts/mx*100)+'%"></div>'+
      '<div style="height:7px;border-radius:4px;background:var(--red);width:'+Math.round(oppBs.pts/mx*100)+'%;margin-top:3px"></div></div>';
  }
  // flex agonizer (#651)
  const flexSl = bs.line.find(sl=>sl.lab==="FLEX");
  if(flexSl && flexSl.p){
    const cands = ids.map(id=>byId[id]).filter(Boolean)
      .filter(p=>["RB","WR","TE"].includes(p.pos) && (!bs.starterIds.has(p.id) || p.id===flexSl.p.id))
      .map(p=>({p, wp:weekProj(p,w)})).sort((a,b)=>b.wp-a.wp).slice(0,4);
    if(cands.length>1) h += '<div class="benchhead">🎲 Flex agonizer</div><div class="scarce">'+
      cands.map(x=>'<span class="scpill'+(x.p.id===flexSl.p.id?'" style="color:var(--green)':'')+'" data-card="'+x.p.id+'">'+
        (x.p.id===flexSl.p.id?'✓ ':'')+esc(x.p.name.split(" ").slice(-1)[0])+' <b class="mono">'+x.wp+'</b>'+
        (x.p.id!==flexSl.p.id?' <span style="color:var(--dim)">−'+Math.round((flexSl.wp-x.wp)*10)/10+'</span>':'')+'</span>').join("")+'</div>';
  }
  // bye forecaster: the next 4 weeks of holes (#648)
  const grid = [];
  for(let fw=w+1; fw<=Math.min(14, w+4); fw++){
    const outByes = ids.map(id=>byId[id]).filter(Boolean).filter(p=>typeof BYES!=="undefined" && BYES[p.team]===fw);
    if(outByes.length) grid.push('<span class="scpill">W'+fw+': '+outByes.map(p=>esc(p.name.split(" ").slice(-1)[0])).join(", ")+'</span>');
  }
  if(grid.length) h += '<div class="benchhead">📆 Byes ahead</div><div class="scarce">'+grid.join("")+'</div>';
  // rival tracker (#661)
  try{
    const rs = +S.settings.rivalSlot, s2r = S.settings.slot2rid;
    if(rs && s2r && typeof SCOREB!=="undefined" && SCOREB.mus){
      const rrid = +s2r[String(rs)];
      const rows = scoreboardRows(SCOREB, byId);
      for(const [a,b] of rows){
        const hit = a.rid===rrid ? [a,b] : (b.rid===rrid ? [b,a] : null);
        if(hit){
          const st = standingsRows(SCOREB.rosters, SCOREB.users);
          const rrec = st.find(r2=>r2.rid===rrid);
          h += '<div class="benchhead">😈 Rival watch: '+esc(hit[0].name)+(rrec?' ('+rrec.w+'-'+rrec.l+')':'')+
            ' — <b class="mono">'+hit[0].live+'</b> vs '+esc(hit[1].name)+' <b class="mono">'+hit[1].live+'</b> · proj '+hit[0].proj+'–'+hit[1].proj+'</div>';
          break;
        }
      }
    }
  }catch(e){}
  return h;
}

/* ---------- League scoreboard overlay (#655–#664, #667) ---------- */
async function renderScoreboard(){
  const old = document.getElementById("sbOverlay"); if(old){ old.remove(); return; }
  const sb = await leagueWeekData(false);
  if(!sb) return toast("Link your Sleeper league in Settings first", {warn:true});
  const hist = await leagueHistory();
  const byId = idIndex();
  const rows = scoreboardRows(sb, byId);
  const st = standingsRows(sb.rosters, sb.users);
  const pr = powerRankings();
  const ap = allPlayStandings(hist, sb.rosters, sb.users);
  const aw = hist.length ? weeklyAwards(hist[hist.length-1], sb) : null;
  const myRid = +S.settings.sleeperRosterId || null;
  const mine = r=>r.rid===myRid ? ' style="color:var(--gold)"' : '';
  const ov = document.createElement("div"); ov.id = "sbOverlay";
  let h = '<div class="sbcard" role="dialog" aria-label="League scoreboard"><button class="sbx" data-sbx="1" aria-label="Close">✕</button>';
  h += '<div class="tag">📊 WEEK '+sb.w+' SCOREBOARD</div>';
  rows.forEach(([a,b])=>{
    const wp = winProb(a.proj, b.proj);
    const mx = Math.max(a.proj, b.proj, 1);
    h += '<div class="sbrow'+((a.rid===myRid||b.rid===myRid)?' sbmine':'')+'">'+
      '<div class="sbteam"><span'+mine(a)+'>'+esc(a.name)+'</span><b class="mono">'+a.live.toFixed(1)+'</b></div>'+
      '<div class="sbbar"><i style="width:'+Math.round(a.proj/mx*100)+'%"></i></div>'+
      '<div class="sbteam"><span'+mine(b)+'>'+esc(b.name)+'</span><b class="mono">'+b.live.toFixed(1)+'</b></div>'+
      '<div class="sbbar red"><i style="width:'+Math.round(b.proj/mx*100)+'%"></i></div>'+
      '<div class="sbmeta">proj '+a.proj.toFixed(0)+'–'+b.proj.toFixed(0)+' · '+esc(a.name)+' '+Math.round(wp*100)+'%</div></div>';
  });
  // my matchup player-by-player (#656)
  const md = (typeof WEEKST!=="undefined") ? WEEKST.mate : null;
  if(md && md.me){
    const s2o = sleeperToOurs();
    const inv = {}; for(const k2 in s2o) inv[s2o[k2]] = k2;
    const plist = (side,label)=>{
      if(!side) return "";
      let t2 = '<div class="benchhead">'+label+'</div>';
      side.starters.filter(Boolean).forEach(id=>{
        const p = byId[id]; if(!p) return;
        const got = +side.ppts[inv[id]]||0;
        const played = got!==0;
        t2 += '<div class="sbply"><span>'+esc(p.name)+' <span class="dimtxt">'+p.pos+'</span></span><b class="mono"'+(played?'':' class="dimtxt"')+'>'+
          (played ? got.toFixed(1) : "~"+weekProj(p, sb.w).toFixed(1))+'</b></div>';
      });
      return t2;
    };
    h += '<div class="sbcols"><div>'+plist(md.me, "🏈 "+esc(md.me.name||"Me"))+'</div><div>'+plist(md.opp, "⚔ "+esc(md.opp?md.opp.name:""))+'</div></div>';
  }
  // standings (#658)
  h += '<div class="tag" style="margin-top:14px">🏆 STANDINGS</div><table class="sbtab"><tr><th></th><th>team</th><th>W-L</th><th>PF</th><th>PA</th><th>strk</th></tr>'+
    st.map((r,i)=>'<tr'+(r.rid===myRid?' class="sbme"':'')+'><td>'+(i+1)+'</td><td>'+esc(r.name)+'</td><td class="mono">'+r.w+'-'+r.l+(r.t?'-'+r.t:'')+'</td><td class="mono">'+r.pf+'</td><td class="mono">'+r.pa+'</td><td>'+esc(r.streak)+'</td></tr>').join("")+'</table>';
  // power rankings (#659)
  if(pr.length) h += '<div class="tag" style="margin-top:14px">⚡ POWER RANKINGS</div>'+pr.map((r,i)=>
    '<div class="sbply"'+(r.rid===myRid?' style="color:var(--gold)"':'')+'><span>'+(i+1)+'. '+esc(r.name)+
    (r.move>0?' <span style="color:var(--green)">▲'+r.move+'</span>':r.move<0?' <span style="color:var(--red)">▼'+(-r.move)+'</span>':'')+
    '</span><b class="mono">'+Math.round(r.score*100)+'</b></div>').join("");
  // luck / all-play (#662)
  if(ap.length && hist.length) h += '<div class="tag" style="margin-top:14px">🍀 LUCK (all-play)</div>'+ap.map(r=>
    '<div class="sbply"'+(r.rid===myRid?' style="color:var(--gold)"':'')+'><span>'+esc(r.name)+' <span class="dimtxt">'+r.apw+'-'+r.apl+' all-play</span></span>'+
    '<b class="mono" style="color:'+(r.luck>0.5?'var(--green)':r.luck<-0.5?'var(--red)':'var(--dim)')+'">'+(r.luck>0?'+':'')+r.luck+'</b></div>').join("");
  // last week's awards (#663)
  if(aw) h += '<div class="tag" style="margin-top:14px">🎖 LAST WEEK</div><div class="scarce">'+
    '<span class="scpill">🥇 high: '+esc(aw.hi.name)+' '+aw.hi.pts+'</span>'+
    '<span class="scpill">🥶 low: '+esc(aw.lo.name)+' '+aw.lo.pts+'</span>'+
    (aw.blow?'<span class="scpill">🔨 blowout: '+esc(aw.blow.name)+' by '+aw.blow.d+'</span>':'')+
    (aw.nail?'<span class="scpill">😅 nail-biter: '+esc(aw.nail.name)+' by '+aw.nail.d+'</span>':'')+'</div>';
  // my lineup efficiency across the season (#664)
  if(hist.length && myRid){
    const effs = hist.map(wm=>{ const m = (wm||[]).find(x=>+x.roster_id===myRid); return m ? lineupEffOf(m, byId) : null; }).filter(Boolean);
    if(effs.length){
      const avg = Math.round(effs.reduce((a,e2)=>a+e2.eff,0)/effs.length);
      h += '<div class="tag" style="margin-top:14px">🎯 MY LINEUP EFFICIENCY</div><div class="sbply"><span>avg '+avg+'% of the perfect lineup</span><span class="dimtxt">'+
        effs.map((e2,i)=>'W'+(i+1)+' '+e2.eff+'%').join(" · ")+'</span></div>';
    }
  }
  h += '<div id="sbOdds" class="dimtxt" style="padding:8px 2px">🎲 computing playoff odds…</div></div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{ if(e.target===ov || e.target.closest("[data-sbx]")) ov.remove(); });
  playoffOdds(300).then(po=>{                                                    // #660
    const el = document.getElementById("sbOdds"); if(!el || !po) { if(el) el.remove(); return; }
    el.innerHTML = '<div class="tag" style="margin-top:6px">🎲 PLAYOFF ODDS (300 sims)</div>'+
      st.slice().sort((a,b2)=>(po[b2.rid]||0)-(po[a.rid]||0)).map(r=>'<div class="sbply"'+(r.rid===myRid?' style="color:var(--gold)"':'')+'><span>'+esc(r.name)+'</span><b class="mono">'+(po[r.rid]||0)+'%</b></div>').join("");
  }).catch(()=>{});
}
function seasonHeroBits(){                                                       // #666
  try{
    if(typeof SCOREB==="undefined" || !SCOREB.rosters) return "";
    const st = standingsRows(SCOREB.rosters, SCOREB.users);
    const myRid = +S.settings.sleeperRosterId || null;
    const me = st.find(r=>r.rid===myRid); if(!me) return "";
    const place = st.indexOf(me)+1;
    let liveBit = "";
    const rows = scoreboardRows(SCOREB, idIndex());
    for(const [a,b] of rows){
      if(a.rid===myRid) liveBit = ' · this wk <b class="mono">'+a.live.toFixed(1)+'–'+b.live.toFixed(1)+'</b>';
      else if(b.rid===myRid) liveBit = ' · this wk <b class="mono">'+b.live.toFixed(1)+'–'+a.live.toFixed(1)+'</b>';
    }
    return ' · 📊 <b>'+me.w+'-'+me.l+(me.t?'-'+me.t:'')+'</b> ('+ordinal(place)+')'+liveBit;
  }catch(e){ return ""; }
}

/* ---------- R40 Waiver wire war room (#670–#684) ---------- */
const WAIV = {league:null, leagueAt:0, drops:{map:{}, at:0}, tx:null, txAt:0};
async function leagueMeta(){
  const lg = (S.settings.sleeperLeagueId||"").trim(); if(!lg) return null;
  if(WAIV.league && Date.now()-WAIV.leagueAt < 60*60e3) return WAIV.league;
  try{ WAIV.league = await (await fetch(SYNC.base+"/league/"+lg)).json(); WAIV.leagueAt = Date.now(); }catch(e){}
  return WAIV.league;
}
function freeAgents(){
  const rostered = SEASON.rostered;
  return allPlayers().filter(p=>rostered ? !rostered.has(p.id) : !offBoard(p.id));
}
function faabRows(rosters, users, league){                                       // pure (#671)
  const budget = (league && league.settings && league.settings.waiver_budget) || 100;
  const un = {}; (users||[]).forEach(u=>un[u.user_id]=u.display_name);
  return (rosters||[]).map(r=>{
    const used = (r.settings && r.settings.waiver_budget_used) || 0;
    return {rid:r.roster_id, name:un[r.owner_id]||("Team "+r.roster_id), used, left:budget-used, budget};
  }).sort((a,b)=>b.left-a.left);
}
function nextWeeksValue(p, w, n){
  let v = 0, g = 0;
  for(let fw=w; fw<w+(n||3) && fw<=17; fw++){ v += weekProj(p, fw); g++; }
  return g ? Math.round(v/g*10)/10 : 0;
}
function upgradeFinder(ids, byId, w, fas){                                       // pure-ish (#672)
  const bs = bestStartersWeek(ids, byId, w);
  const bench = ids.map(id=>byId[id]).filter(Boolean).filter(p=>!bs.starterIds.has(p.id));
  const out = [];
  for(const pos of ["QB","RB","WR","TE","DEF"]){
    const myWorst = bench.filter(p=>p.pos===pos).sort((a,b)=>nextWeeksValue(a,w,3)-nextWeeksValue(b,w,3))[0];
    const bestFA = (fas||[]).filter(p=>p.pos===pos).sort((a,b)=>nextWeeksValue(b,w,3)-nextWeeksValue(a,w,3))[0];
    if(!bestFA) continue;
    const mine = myWorst ? nextWeeksValue(myWorst, w, 3) : 0;
    const theirs = nextWeeksValue(bestFA, w, 3);
    if(theirs > mine + 1.5) out.push({add:bestFA, drop:myWorst||null, gain:Math.round((theirs-mine)*10)/10});
  }
  return out.sort((a,b)=>b.gain-a.gain);
}
function byeFillFinder(ids, byId, fas){                                          // #673
  const w = curWeek(), holes = [];
  for(let fw=Math.max(w,5); fw<=14; fw++){
    const outP = ids.map(id=>byId[id]).filter(Boolean).filter(p=>typeof BYES!=="undefined" && BYES[p.team]===fw);
    if(outP.length < 2) continue;
    const poss = [...new Set(outP.map(p=>p.pos))].filter(x=>x!=="DEF");
    const fills = (fas||[]).filter(p=>poss.includes(p.pos) && BYES[p.team]!==fw)
      .sort((a,b)=>weekProj(b,fw)-weekProj(a,fw)).slice(0,3);
    holes.push({w:fw, out:outP, fills});
  }
  return holes;
}
function defStreamRows(fas, w){                                                  // #674
  return (fas||[]).filter(p=>p.pos==="DEF").map(p=>{
    let soft = 0, g = 0;
    for(let fw=w; fw<w+2 && fw<=17; fw++){
      const opp = (typeof SCHED!=="undefined" && SCHED[p.team]) ? SCHED[p.team][fw] : null;
      if(opp && typeof envRank==="function"){ soft += envRank(opp); g++; }
    }
    return {p, soft: g ? Math.round(soft/g) : 16};
  }).sort((a,b)=>b.soft-a.soft).slice(0,5);
}
function dropHeat(p){ return (typeof buzzOf==="function") ? buzzOf(p) : 0; }     // #675
function bidSuggest(p, faabLeft){                                                // #678
  const repl = replacementLevels(allPlayers());
  const vor = Math.max(0, p.proj - (repl[p.pos]||0));
  let pct = Math.min(45, Math.max(1, Math.round(vor/3)));
  const heat = dropHeat(p);
  if(heat > 5000) pct = Math.min(60, Math.round(pct*1.6));
  else if(heat > 1500) pct = Math.round(pct*1.25);
  const bid = Math.round((faabLeft==null ? 100 : faabLeft) * pct/100);
  return {pct, bid:Math.max(1, Math.min(bid, faabLeft==null?100:faabLeft))};
}
function claimsGet(){ try{ return JSON.parse(localStorage.getItem(LS_KEY+"-claims")||"[]"); }catch(e){ return []; } }
function claimsSave(c){ try{ localStorage.setItem(LS_KEY+"-claims", JSON.stringify(c)); }catch(e){} }
function claimsAdd(addId, dropId, bid){                                          // #676
  const c = claimsGet();
  if(c.some(x=>x.add===addId)) return c;
  c.push({add:addId, drop:dropId||null, bid:+bid||1});
  claimsSave(c); return c;
}
async function trendingDropsMap(){                                               // #679
  if(WAIV.drops.map && Date.now()-WAIV.drops.at < 15*60e3 && Object.keys(WAIV.drops.map).length) return WAIV.drops.map;
  try{
    const arr = await (await fetch("https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=24&limit=50")).json();
    const inv = {}; if(typeof HEADSHOT!=="undefined") for(const k in HEADSHOT) inv[HEADSHOT[k]] = k;
    const m = {}; arr.forEach(x=>{ const k = inv[+x.player_id]; if(k) m[k] = x.count; });
    WAIV.drops = {map:m, at:Date.now()};
  }catch(e){}
  return WAIV.drops.map;
}
async function leagueTransactions(){                                             // #680
  const lg = (S.settings.sleeperLeagueId||"").trim(); if(!lg) return [];
  if(WAIV.tx && Date.now()-WAIV.txAt < 10*60e3) return WAIV.tx;
  try{
    const w = curWeek();
    const weeks = [w, w-1].filter(x=>x>=1);
    const all = (await Promise.all(weeks.map(x=>fetch(SYNC.base+"/league/"+lg+"/transactions/"+x).then(r=>r.json())))).flat();
    const map = sleeperToOurs(), byId = idIndex();
    const nm = sid=>{ const p = byId[map[String(sid)]]; return p ? p.name : ("#"+sid); };
    WAIV.tx = (all||[]).filter(t=>t.status==="complete").map(t=>({
      type:t.type, rid:(t.roster_ids||[])[0],
      adds:Object.keys(t.adds||{}).map(nm), drops:Object.keys(t.drops||{}).map(nm),
      bid:(t.settings && t.settings.waiver_bid)||0, at:t.status_updated||0
    })).sort((a,b)=>b.at-a.at).slice(0,20);
    WAIV.txAt = Date.now();
  }catch(e){ WAIV.tx = WAIV.tx || []; }
  return WAIV.tx;
}
function rivalFaabSpy(fr){                                                        // #681
  const rs = +S.settings.rivalSlot, s2r = S.settings.slot2rid;
  if(!rs || !s2r) return null;
  const rrid = +s2r[String(rs)];
  const row = (fr||[]).find(r=>r.rid===rrid);
  if(!row) return null;
  const byId = idIndex(), map = sleeperToOurs();
  const ro = (SCOREB.rosters||[]).find(r=>+r.roster_id===rrid);
  let hole = "";
  if(ro){
    const ids = (ro.players||[]).map(id=>map[String(id)]).filter(Boolean);
    const byPos = {}; ids.map(id=>byId[id]).filter(Boolean).forEach(p=>{ byPos[p.pos]=(byPos[p.pos]||0)+p.proj; });
    hole = ["RB","WR","TE","QB"].sort((a,b)=>(byPos[a]||0)-(byPos[b]||0))[0];
  }
  return Object.assign({}, row, {hole});
}
function stashRadar(fas){                                                         // #682
  return (fas||[]).filter(p=>p.pos!=="DEF")
    .filter(p=>(typeof breakoutTag==="function" && breakoutTag(p)) || (typeof spikeRate==="function" && spikeRate(p)>=0.4))
    .sort((a,b)=>b.proj-a.proj).slice(0,5);
}
function waiverDayReminder(){                                                     // #683
  try{
    const lgs = WAIV.league && WAIV.league.settings;
    if(!lgs || !claimsGet().length) return;
    const wd = lgs.waiver_day_of_week!=null ? lgs.waiver_day_of_week : 3;         // sleeper: 0=Mon … 6=Sun
    const sleeperToday = new Date().getDay()===0 ? 6 : new Date().getDay()-1;     // JS Sun=0 → sleeper 6
    if(sleeperToday!==wd) return;
    const k = LS_KEY+"-wvday";
    const stamp = new Date().toDateString();
    if(localStorage.getItem(k)===stamp) return;
    localStorage.setItem(k, stamp);
    toast("📥 Waivers clear today — you have "+claimsGet().length+" planned claim(s) in the planner");
    if("Notification" in window && Notification.permission==="granted" && document.visibilityState==="hidden"){
      try{ new Notification("📥 Waiver day", {body:claimsGet().length+" planned claim(s) — get them in", icon:"icon-192.png", tag:"waiver"}); }catch(e2){}
    }
  }catch(e){}
}
function whatIfSwap(addId, dropId){                                               // #684
  const byId = idIndex(), w = curWeek();
  const ids = rosterIds().slice();
  const before = bestStartersWeek(ids, byId, w).pts;
  const after = bestStartersWeek(ids.filter(id=>id!==dropId).concat(addId?[addId]:[]), byId, w).pts;
  return {before, after, delta:Math.round((after-before)*10)/10};
}
/* waiver overlay (#670) */
async function renderWaivers(){
  const old = document.getElementById("wvOverlay"); if(old){ old.remove(); return; }
  await Promise.all([leagueRosteredSet().catch(()=>null), leagueMeta(), refreshTrending && refreshTrending()]);
  const byId = idIndex(), w = curWeek(), fas = freeAgents();
  const fr = SCOREB.rosters ? faabRows(SCOREB.rosters, SCOREB.users, WAIV.league) : [];
  const myRid = +S.settings.sleeperRosterId || null;
  const myFaab = (fr.find(r=>r.rid===myRid)||{}).left;
  const ups = upgradeFinder(rosterIds(), byId, w, fas);
  const dst = defStreamRows(fas, w);
  const holes = byeFillFinder(rosterIds(), byId, fas);
  const stash = stashRadar(fas);
  const dropsMap = await trendingDropsMap();
  const tx = await leagueTransactions();
  const claims = claimsGet();
  const spy = rivalFaabSpy(fr);
  const bidHtml = p=>{ const b = bidSuggest(p, myFaab); return '<span class="dimtxt">bid ~'+b.pct+'%</span> <button class="undo1" data-claim="'+p.id+'" data-bid="'+b.bid+'">＋ claim</button>'; };
  const ov = document.createElement("div"); ov.id = "wvOverlay";
  let h = '<div class="sbcard" role="dialog" aria-label="Waiver wire"><button class="sbx" data-wvx="1" aria-label="Close">✕</button>';
  h += '<div class="tag">📥 WAIVER WIRE — week '+w+(myFaab!=null?' · my FAAB $'+myFaab:'')+'</div>';
  if(ups.length) h += '<div class="benchhead">🚀 Upgrades on the wire</div>'+ups.map(u=>
    '<div class="sbply"><span data-card="'+u.add.id+'" style="cursor:pointer"><b>'+esc(u.add.name)+'</b> '+u.add.pos+
    (u.drop?' <span class="dimtxt">over '+esc(u.drop.name)+(dropHeat(u.drop)>1000?' ⚠grabbed fast':'')+'</span>':'')+
    ' <b style="color:var(--green)">+'+u.gain+'</b>/wk</span><span>'+bidHtml(u.add)+'</span></div>').join("");
  if(holes.length) h += '<div class="benchhead">📆 Bye-hole fixes</div>'+holes.slice(0,3).map(x=>
    '<div class="sbply"><span>W'+x.w+' ('+x.out.map(p=>esc(p.name.split(" ").slice(-1)[0])).join(", ")+' out)</span><span>'+
    x.fills.map(p=>'<span class="scpill" data-card="'+p.id+'">'+esc(p.name.split(" ").slice(-1)[0])+' '+weekProj(p,x.w)+'</span>').join("")+'</span></div>').join("");
  if(dst.length) h += '<div class="benchhead">🛡 DEF streamer (next 2 weeks)</div><div class="scarce">'+
    dst.map(x=>'<span class="scpill" data-card="'+x.p.id+'">'+esc(x.p.team)+' D — soft '+x.soft+'/32</span>').join("")+'</div>';
  if(stash.length) h += '<div class="benchhead">🌱 Stash radar</div><div class="scarce">'+
    stash.map(p=>'<span class="scpill" data-card="'+p.id+'">'+esc(p.name)+' '+p.pos+'</span>').join("")+'</div>';
  const myDropping = rosterIds().map(id=>byId[id]).filter(Boolean).filter(p=>dropsMap[normName(p.name)]>500);
  if(myDropping.length) h += '<div class="benchhead" style="color:var(--gold)">🗑 The world is dropping (and you roster)</div><div class="scarce">'+
    myDropping.map(p=>'<span class="scpill">'+esc(p.name)+' — '+dropsMap[normName(p.name)].toLocaleString()+' drops/24h</span>').join("")+'</div>';
  if(claims.length) h += '<div class="benchhead">📋 My claim planner ($'+claims.reduce((a,c)=>a+c.bid,0)+' of $'+(myFaab==null?"?":myFaab)+')</div>'+
    claims.map((c,i)=>{ const a = byId[c.add], d = c.drop?byId[c.drop]:null;
      return '<div class="sbply"><span>'+(a?esc(a.name):"?")+(d?' <span class="dimtxt">drop '+esc(d.name)+'</span>':'')+' · $'+c.bid+'</span><button class="undo1" data-unclaim="'+i+'">✕</button></div>'; }).join("");
  if(fr.length) h += '<div class="benchhead">💰 FAAB league-wide</div><div class="scarce">'+
    fr.map(r=>'<span class="scpill"'+(r.rid===myRid?' style="color:var(--gold)"':'')+'>'+esc(r.name)+' $'+r.left+'</span>').join("")+'</div>';
  if(spy) h += '<div class="benchhead">😈 Rival spy: '+esc(spy.name)+' has $'+spy.left+' — thinnest at '+esc(spy.hole||"?")+'</div>';
  if(tx.length) h += '<div class="benchhead">🗞 League wire</div>'+tx.slice(0,8).map(t=>
    '<div class="sbply"><span>'+esc(ridName(t.rid))+' '+(t.type==="trade"?"🔁 traded":"")+
    (t.adds.length?' ➕'+t.adds.map(esc).join(", "):'')+(t.drops.length?' ➖'+t.drops.map(esc).join(", "):'')+
    (t.bid?' <span class="dimtxt">$'+t.bid+'</span>':'')+'</span></div>').join("");
  h += '</div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-wvx]")) return ov.remove();
    const cl = e.target.closest("[data-claim]");
    if(cl){
      const addId = cl.dataset.claim, bid = +cl.dataset.bid||1;
      const up = ups.find(u=>u.add.id===addId);
      const wi = whatIfSwap(addId, up && up.drop ? up.drop.id : null);            // #684
      claimsAdd(addId, up && up.drop ? up.drop.id : null, bid);
      toast("📋 Claim planned · lineup "+(wi.delta>=0?"+":"")+wi.delta+" pts/wk if it lands");
      ov.remove(); renderWaivers();
      return;
    }
    const uc = e.target.closest("[data-unclaim]");
    if(uc){ const c = claimsGet(); c.splice(+uc.dataset.unclaim,1); claimsSave(c); ov.remove(); renderWaivers(); }
  });
}

/* ---------- R41 Trade machine (#685–#699) ---------- */
function leagueRosterIds(rid){
  const map = sleeperToOurs();
  const ro = (SCOREB.rosters||[]).find(r=>+r.roster_id===+rid);
  return ro ? (ro.players||[]).map(id=>map[String(id)]).filter(Boolean) : [];
}
function tradeEvalRoster(mineOut, theirsOut, rid, myPool, theirPool){                  // pure-ish (#686)
  const byId = idIndex();
  const myNow = myPool || rosterIds(), theirNow = theirPool || leagueRosterIds(rid);
  const b = ids=>bestStarters(ids, byId).pts;
  const myAfter = myNow.filter(id=>!mineOut.includes(id)).concat(theirsOut);
  const theirAfter = theirNow.filter(id=>!theirsOut.includes(id)).concat(mineOut);
  const me = {before:b(myNow), after:b(myAfter)};
  const them = {before:b(theirNow), after:b(theirAfter)};
  me.delta = Math.round((me.after-me.before)*10)/10;
  them.delta = Math.round((them.after-them.before)*10)/10;
  const rawOut = mineOut.reduce((a,id)=>a+((byId[id]||{}).proj||0),0);
  const rawIn = theirsOut.reduce((a,id)=>a+((byId[id]||{}).proj||0),0);
  return {me, them, rawOut:Math.round(rawOut), rawIn:Math.round(rawIn), verdict:fairnessVerdict(me.delta, them.delta)};
}
function fairnessVerdict(meD, themD){                                            // pure (#687)
  if(meD>3 && themD<-3) return {label:"🔪 FLEECE — they should decline", cls:"green"};
  if(meD>1 && themD>=-1.5) return {label:"🤝 WIN-WIN — send it", cls:"green"};
  if(Math.abs(meD)<=1.5 && Math.abs(themD)<=1.5) return {label:"⚖ FAIR — comes down to preference", cls:"gold"};
  if(meD<-3) return {label:"🎁 DONATION — decline this", cls:"red"};
  if(meD<0) return {label:"👎 Slight loss for you — counter", cls:"red"};
  return {label:"🙂 Lean win for you", cls:"gold"};
}
function tradeFinder(){                                                          // #688
  const byId = idIndex(), myRid = +S.settings.sleeperRosterId||0, out = [];
  const myNow = rosterIds();
  const myBs = bestStarters(myNow, byId);
  const myBench = myNow.filter(id=>byId[id] && !myBs.starterIds.has(id) && byId[id].pos!=="DEF");
  (SCOREB.rosters||[]).forEach(ro=>{
    if(+ro.roster_id===myRid) return;
    const theirNow = leagueRosterIds(ro.roster_id);
    if(!theirNow.length) return;
    const thBs = bestStarters(theirNow, byId);
    const thBench = theirNow.filter(id=>byId[id] && !thBs.starterIds.has(id) && byId[id].pos!=="DEF");
    myBench.slice(0,5).forEach(mid=>{
      thBench.slice(0,5).forEach(tid=>{
        if(byId[mid].pos===byId[tid].pos) return;
        const ev = tradeEvalRoster([mid],[tid],ro.roster_id, myNow, theirNow);
        if(ev.me.delta>0.5 && ev.them.delta>-1) out.push({rid:ro.roster_id, give:mid, get:tid, ev});
      });
    });
  });
  return out.sort((a,b)=>b.ev.me.delta-a.ev.me.delta).slice(0,6);
}
function packageSuggest(rid){                                                    // #689
  const byId = idIndex(), out = [];
  const myNow = rosterIds(), theirNow = leagueRosterIds(rid);
  if(!theirNow.length) return out;
  const myBs = bestStarters(myNow, byId);
  const myMids = myNow.filter(id=>byId[id] && byId[id].pos!=="DEF")
    .sort((a,b)=>byId[b].proj-byId[a].proj).slice(2,8);
  const theirStuds = theirNow.filter(id=>byId[id] && byId[id].pos!=="DEF")
    .sort((a,b)=>byId[b].proj-byId[a].proj).slice(0,3);
  for(let i=0;i<myMids.length;i++) for(let j=i+1;j<myMids.length;j++){
    for(const stud of theirStuds){
      const ev = tradeEvalRoster([myMids[i],myMids[j]],[stud], rid, myNow, theirNow);
      if(ev.me.delta>1 && ev.them.delta>-2.5) out.push({give:[myMids[i],myMids[j]], get:stud, ev});
    }
  }
  return out.sort((a,b)=>b.ev.me.delta-a.ev.me.delta).slice(0,4);
}
function strengthHeatmap(){                                                      // pure-ish (#690)
  const byId = idIndex();
  return (SCOREB.rosters||[]).map(ro=>{
    const ids = leagueRosterIds(ro.roster_id);
    const ps = ids.map(id=>byId[id]).filter(Boolean);
    const top = (pos,n)=>ps.filter(p=>p.pos===pos).sort((a,b)=>b.proj-a.proj).slice(0,n).reduce((a,p)=>a+p.proj,0);
    return {rid:ro.roster_id, name:ridName(ro.roster_id), QB:Math.round(top("QB",2)), RB:Math.round(top("RB",3)),
      WR:Math.round(top("WR",3)), TE:Math.round(top("TE",2))};
  });
}
function buyLowSellHigh(hist, byId){                                             // pure (#691)
  const inv = {}; const s2o = sleeperToOurs(); for(const k in s2o) inv[s2o[k]] = k;
  const myRid = +S.settings.sleeperRosterId||0;
  const got = {}, games = {}, owner = {};
  (hist||[]).forEach(wm=>(wm||[]).forEach(m=>{
    for(const sid in (m.players_points||{})){
      const oid = s2o[String(sid)]; if(!oid) continue;
      got[oid] = (got[oid]||0) + m.players_points[sid];
      games[oid] = (games[oid]||0) + 1;
      owner[oid] = m.roster_id;
    }
  }));
  const rows = [];
  for(const oid in got){
    const p = byId[oid]; if(!p || p.pos==="DEF" || !games[oid]) continue;
    const exp = p.proj/16, act = got[oid]/games[oid];
    if(exp < 6) continue;
    rows.push({p, exp:Math.round(exp*10)/10, act:Math.round(act*10)/10, diff:Math.round((act-exp)*10)/10, mine:owner[oid]===myRid});
  }
  return {buyLow: rows.filter(r=>!r.mine && r.diff<-2.5).sort((a,b)=>a.diff-b.diff).slice(0,5),
          sellHigh: rows.filter(r=>r.mine && r.diff>2.5).sort((a,b)=>b.diff-a.diff).slice(0,5)};
}
function blockGet(){ try{ return JSON.parse(localStorage.getItem(LS_KEY+"-tblock")||"[]"); }catch(e){ return []; } }
function blockToggle(id){                                                        // #692
  const b = blockGet(), i = b.indexOf(id);
  if(i>=0) b.splice(i,1); else b.push(id);
  try{ localStorage.setItem(LS_KEY+"-tblock", JSON.stringify(b)); }catch(e){}
  return b;
}
async function tradeOddsImpact(mineOut, theirsOut, rid){                         // #693
  const myRid = +S.settings.sleeperRosterId; if(!myRid) return null;
  const base = await playoffOdds(200); if(!base) return null;
  const byId = idIndex();
  const b = ids=>bestStarters(ids, byId).pts;
  const save = rosterStrengthOf;
  const myAfter = b(rosterIds().filter(id=>!mineOut.includes(id)).concat(theirsOut));
  const theirAfter = b(leagueRosterIds(rid).filter(id=>!theirsOut.includes(id)).concat(mineOut));
  try{
    window.rosterStrengthOf = r2=> +r2===+myRid ? myAfter : (+r2===+rid ? theirAfter : save(r2));
    const after = await playoffOdds(200);
    return after ? {before:base[myRid], after:after[myRid]} : null;
  } finally { window.rosterStrengthOf = save; }
}
function notesGet(){ try{ return JSON.parse(localStorage.getItem(LS_KEY+"-tnotes")||"{}"); }catch(e){ return {}; } }
function noteSet(rid, txt){                                                      // #697
  const n = notesGet(); if(txt) n[rid]=txt; else delete n[rid];
  try{ localStorage.setItem(LS_KEY+"-tnotes", JSON.stringify(n)); }catch(e){}
}
function keeperValue(p){                                                         // #698
  const m = (typeof metaFor==="function") ? metaFor(p) : null;
  const age = m && m[0] ? +m[0] : 26;
  let f = age<24 ? 1.08 : age<27 ? 1.03 : age<30 ? 0.96 : 0.84;
  if(typeof spikeRate==="function" && spikeRate(p)>=0.4) f += 0.04;
  return Math.round(p.proj*f);
}
function seasonDossierHtml(slot){                                                // #694
  try{
    const s2r = S.settings.slot2rid; if(!s2r || typeof SCOREB==="undefined" || !SCOREB.rosters) return "";
    const rid = +s2r[String(slot)]; if(!rid) return "";
    const st = standingsRows(SCOREB.rosters, SCOREB.users);
    const me = st.find(r=>r.rid===rid); if(!me) return "";
    const place = st.indexOf(me)+1;
    const tx = (WAIV.tx||[]).filter(t=>t.rid===rid).slice(0,3);
    return '<div class="cintel" style="border-top:1px solid var(--line);margin-top:8px;padding-top:10px"><b>📅 Season form</b> · '+
      me.w+'-'+me.l+(me.t?'-'+me.t:'')+' ('+ordinal(place)+') · PF '+me.pf+(me.streak?' · '+esc(me.streak):'')+
      (tx.length?'<br>🗞 '+tx.map(t=>(t.adds.length?'➕'+t.adds[0]:'')+(t.drops.length?' ➖'+t.drops[0]:'')).join(" · "):'')+'</div>';
  }catch(e){ return ""; }
}
function tradeCardPng(ev, giveNames, getNames, teamName){                        // #695
  const c = document.createElement("canvas"); c.width = 1000; c.height = 640;
  const x = c.getContext("2d");
  x.fillStyle = "#0b0f14"; x.fillRect(0,0,1000,640);
  x.fillStyle = "#2fd47a"; x.font = "bold 40px sans-serif"; x.fillText("TRADE PROPOSAL", 40, 70);
  x.fillStyle = "#8b98a9"; x.font = "24px sans-serif"; x.fillText("Otto5  ⇄  "+teamName, 40, 115);
  x.fillStyle = "#e8eef5"; x.font = "bold 26px sans-serif";
  x.fillText("I send:", 40, 180); x.fillText("I get:", 520, 180);
  x.font = "24px sans-serif";
  giveNames.forEach((n,i)=>x.fillText("• "+n, 60, 220+i*38));
  getNames.forEach((n,i)=>x.fillText("• "+n, 540, 220+i*38));
  x.fillStyle = "#f0b429"; x.font = "bold 28px sans-serif";
  x.fillText(ev.verdict.label.replace(/^[^\s]+\s/,""), 40, 520);
  x.fillStyle = "#8b98a9"; x.font = "20px sans-serif";
  x.fillText("my lineup "+(ev.me.delta>=0?"+":"")+ev.me.delta+" pts · theirs "+(ev.them.delta>=0?"+":"")+ev.them.delta+" pts · draft-war-room", 40, 560);
  c.toBlob(b=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "trade-proposal.png"; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  });
}
/* trade center overlay (#685) */
async function renderTrades(){
  const old = document.getElementById("trOverlay"); if(old){ old.remove(); return; }
  if(!SCOREB.rosters) await leagueWeekData(false);
  if(!SCOREB.rosters) return toast("Link your Sleeper league in Settings first", {warn:true});
  const byId = idIndex(), myRid = +S.settings.sleeperRosterId||0;
  const others = (SCOREB.rosters||[]).filter(r=>+r.roster_id!==myRid);
  const sel = {rid:+((others[0]||{}).roster_id||0), give:new Set(), get:new Set()};
  const hist = await leagueHistory();
  const bl = buyLowSellHigh(hist, byId);
  const hm = strengthHeatmap();
  const finds = tradeFinder();
  const block = blockGet();
  const ov = document.createElement("div"); ov.id = "trOverlay";
  const rosterChecks = (ids, kind)=>ids.map(id=>byId[id]).filter(Boolean).sort((a,b)=>b.proj-a.proj)
    .map(p=>'<label class="trlab"><input type="checkbox" data-tsel="'+kind+'" data-id="'+p.id+'"> '+esc(p.name)+' <span class="dimtxt">'+p.pos+' '+p.proj+(kind==="give"&&block.includes(p.id)?' 🏷':'')+'</span></label>').join("");
  const build = ()=>{
    let h = '<div class="sbcard" role="dialog" aria-label="Trade center"><button class="sbx" data-trx="1" aria-label="Close">✕</button>';
    h += '<div class="tag">🔁 TRADE CENTER</div>';
    h += '<div class="frow"><label>Trade with</label><select id="trTeam">'+others.map(r=>'<option value="'+r.roster_id+'"'+(+r.roster_id===sel.rid?' selected':'')+'>'+esc(ridName(r.roster_id))+'</option>').join("")+'</select></div>';
    h += '<div class="sbcols"><div><div class="benchhead">I give</div>'+rosterChecks(rosterIds(),"give")+'</div>'+
      '<div><div class="benchhead">I get</div>'+rosterChecks(leagueRosterIds(sel.rid),"get")+'</div></div>';
    h += '<div style="padding:10px 0"><button class="hbtn" id="trEval">⚖ Evaluate</button> <button class="hbtn" id="trPng" style="display:none">📤 PNG</button></div><div id="trOut"></div>';
    if(finds.length) h += '<div class="benchhead">🔍 Trade finder (helps both sides)</div>'+finds.map(f=>
      '<div class="sbply"><span>'+esc(byId[f.give].name)+' → '+esc(ridName(f.rid))+' for <b>'+esc(byId[f.get].name)+'</b></span><b style="color:var(--green)">+'+f.ev.me.delta+'</b></div>').join("");
    h += '<div class="benchhead">🌡 Roster strength (top QB2/RB3/WR3/TE2)</div><table class="sbtab"><tr><th>team</th><th>QB</th><th>RB</th><th>WR</th><th>TE</th></tr>'+
      hm.map(r=>'<tr'+(r.rid===myRid?' class="sbme"':'')+'><td>'+esc(r.name)+'</td><td class="mono">'+r.QB+'</td><td class="mono">'+r.RB+'</td><td class="mono">'+r.WR+'</td><td class="mono">'+r.TE+'</td></tr>').join("")+'</table>';
    if(bl.buyLow.length) h += '<div class="benchhead">📉 Buy low around the league</div><div class="scarce">'+
      bl.buyLow.map(r=>'<span class="scpill" data-card="'+r.p.id+'">'+esc(r.p.name)+' '+r.diff+'/wk vs proj</span>').join("")+'</div>';
    if(bl.sellHigh.length) h += '<div class="benchhead">📈 Sell high from my roster</div><div class="scarce">'+
      bl.sellHigh.map(r=>'<span class="scpill" data-card="'+r.p.id+'">'+esc(r.p.name)+' +'+r.diff+'/wk · keeper’val '+keeperValue(r.p)+'</span>').join("")+'</div>';
    h += '<div class="benchhead">🏷 My trade block (tap to toggle)</div><div class="scarce">'+
      rosterIds().map(id=>byId[id]).filter(Boolean).filter(p=>p.pos!=="DEF").map(p=>
      '<span class="scpill" data-block="'+p.id+'" style="cursor:pointer'+(block.includes(p.id)?';color:var(--gold)':'')+'">'+esc(p.name.split(" ").slice(-1)[0])+(block.includes(p.id)?' 🏷':'')+'</span>').join("")+'</div>';
    h += '<div class="benchhead">📝 Note on '+esc(ridName(sel.rid))+'</div><textarea id="trNote" rows="2" style="width:100%">'+esc(notesGet()[sel.rid]||"")+'</textarea>';
    h += '</div>';
    return h;
  };
  ov.innerHTML = build();
  document.body.appendChild(ov);
  let lastEv = null;
  ov.addEventListener("change", e=>{
    if(e.target.id==="trTeam"){ sel.rid = +e.target.value; sel.give.clear(); sel.get.clear(); ov.innerHTML = build(); return; }
    const t = e.target.closest("[data-tsel]");
    if(t){ const set = t.dataset.tsel==="give" ? sel.give : sel.get; t.checked ? set.add(t.dataset.id) : set.delete(t.dataset.id); }
    if(e.target.id==="trNote") noteSet(sel.rid, e.target.value.trim());
  });
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-trx]")) return ov.remove();
    const bb = e.target.closest("[data-block]");
    if(bb){ blockToggle(bb.dataset.block); const keep={r:sel.rid}; ov.innerHTML = build(); sel.give.clear(); sel.get.clear(); return; }
    if(e.target.id==="trEval"){
      const give = [...sel.give], get = [...sel.get];
      if(!give.length && !get.length) return toast("Tick players on at least one side", {warn:true});
      lastEv = tradeEvalRoster(give, get, sel.rid);
      const o = document.getElementById("trOut");
      o.innerHTML = '<div class="benchhead" style="color:var(--'+lastEv.verdict.cls+')">'+lastEv.verdict.label+'</div>'+
        '<div class="sbply"><span>my lineup/wk</span><b class="mono" style="color:var(--'+(lastEv.me.delta>=0?'green':'red')+')">'+(lastEv.me.delta>=0?'+':'')+lastEv.me.delta+'</b></div>'+
        '<div class="sbply"><span>their lineup/wk</span><b class="mono">'+(lastEv.them.delta>=0?'+':'')+lastEv.them.delta+'</b></div>'+
        '<div class="sbply"><span>season value out/in</span><b class="mono">'+lastEv.rawOut+' / '+lastEv.rawIn+'</b></div>'+
        '<div class="sbply" id="trOddsRow"><span>playoff odds impact</span><b class="mono">…</b></div>';
      document.getElementById("trPng").style.display = "";
      tradeOddsImpact(give, get, sel.rid).then(oi=>{                             // #693
        const row = document.getElementById("trOddsRow");
        if(row) row.innerHTML = '<span>playoff odds impact</span><b class="mono">'+(oi ? oi.before+'% → '+oi.after+'%' : 'n/a')+'</b>';
      }).catch(()=>{});
      return;
    }
    if(e.target.id==="trPng" && lastEv){
      tradeCardPng(lastEv, [...sel.give].map(id=>byId[id].name), [...sel.get].map(id=>byId[id].name), ridName(sel.rid));
    }
  });
}

/* ---------- R42 Alerts & game day (#700–#714) ---------- */
function alertCfg(){ return Object.assign({heat:true, lineup:true, score:true, close:true, waiver:true, oppnews:true}, S.settings.alerts||{}); }
function quietNow(){                                                             // #710
  const q = S.settings.quietHours || {from:23, to:8};
  const h = new Date().getHours();
  return q.from>q.to ? (h>=q.from || h<q.to) : (h>=q.from && h<q.to);
}
function notifyLog(){ try{ return JSON.parse(localStorage.getItem(LS_KEY+"-alertlog")||"[]"); }catch(e){ return []; } }
function alertFire(kind, title, body){                                           // #709 central dispatcher
  try{
    const log = notifyLog(); log.unshift({kind, title, body:body||"", t:Date.now(), un:1});
    localStorage.setItem(LS_KEY+"-alertlog", JSON.stringify(log.slice(0,50)));
  }catch(e){}
  toast(title+(body ? " — "+body : ""));
  if(!quietNow() && "Notification" in window && Notification.permission==="granted" && document.visibilityState==="hidden"){
    try{ new Notification(title, {body:body||"", icon:"icon-192.png", tag:"wr-"+kind}); }catch(e){}
  } else if(document.visibilityState==="hidden") titleBlink(title);               // #712
  updateActionBadge();
}
function titleBlink(msg){                                                         // #712
  if(window._blinkT) return;
  const orig = document.title; let onn = false, n = 0;
  window._blinkT = setInterval(()=>{
    document.title = (onn=!onn) ? "🔔 "+msg : orig;
    if(++n>12){ clearInterval(window._blinkT); window._blinkT = null; document.title = orig; }
  }, 900);
}
function unreadAlerts(){ return notifyLog().filter(a=>a.un).length; }
function markAlertsRead(){
  try{ localStorage.setItem(LS_KEY+"-alertlog", JSON.stringify(notifyLog().map(a=>Object.assign({}, a, {un:0})))); }catch(e){}
  updateActionBadge();
}
function pendingActions(){                                                        // #711
  let n = unreadAlerts() + claimsGet().length;
  try{
    const md = WEEKST.mate;
    if(md && md.me && md.me.starters){
      const byId = idIndex(), w = curWeek();
      n += md.me.starters.filter(Boolean).map(id=>byId[id]).filter(Boolean).filter(p=>weekProj(p,w)===0).length;
    }
  }catch(e){}
  return n;
}
function updateActionBadge(){
  const n = pendingActions();
  if(navigator.setAppBadge){
    if(n) navigator.setAppBadge(n).catch(()=>{});
    else if(navigator.clearAppBadge) navigator.clearAppBadge().catch(()=>{});
  }
}
function benchSwapFor(p){
  const byId = idIndex(), w = curWeek();
  const bs = bestStartersWeek(rosterIds(), byId, w);
  return rosterIds().map(id=>byId[id]).filter(Boolean)
    .filter(b=>b.pos===p.pos && b.id!==p.id && !bs.starterIds.has(b.id) && weekProj(b,w)>0)
    .sort((a,b)=>weekProj(b,w)-weekProj(a,w))[0] || null;
}
function inactiveSweep(){                                                         // #700
  try{
    if(!alertCfg().lineup) return;
    const md = WEEKST.mate; if(!md || !md.me || !md.me.starters) return;
    const byId = idIndex(), w = curWeek();
    const k = LS_KEY+"-inact"+w;
    let seen = []; try{ seen = JSON.parse(localStorage.getItem(k)||"[]"); }catch(e){}
    md.me.starters.filter(Boolean).forEach(id=>{
      const p = byId[id]; if(!p || seen.includes(id)) return;
      const e = injuryOf(p), sv = e ? injSeverity(e.s) : null;
      if(sv && (sv.code==="O" || sv.code==="IR" || sv.code==="D")){
        seen.push(id);
        const swap = benchSwapFor(p);
        alertFire("inactive", "🚨 "+p.name+" is "+sv.label.toLowerCase()+" and in your lineup",
          swap ? "Best swap: "+swap.name+" ("+weekProj(swap,w)+" proj)" : "No healthy bench replacement — hit waivers");
      }
    });
    try{ localStorage.setItem(k, JSON.stringify(seen)); }catch(e){}
  }catch(e){}
}
function scoreAlerts(){                                                           // #702
  try{
    if(!alertCfg().score) return;
    const md = WEEKST.mate; if(!md || !md.me) return;
    const byId = idIndex(), s2o = sleeperToOurs();
    const inv = {}; for(const k2 in s2o) inv[s2o[k2]] = k2;
    const thr = +S.settings.scoreDelta || 5;
    const prev = window._lastPpts || {};
    const cur = {};
    md.me.starters.filter(Boolean).forEach(id=>{
      const got = +md.me.ppts[inv[id]] || 0;
      cur[id] = got;
      if(prev[id]!=null && got-prev[id] >= thr){
        const p = byId[id];
        if(p) alertFire("score", "💥 "+p.name+" just banked "+(Math.round((got-prev[id])*10)/10), "now "+got.toFixed(1)+" on the day");
      }
    });
    window._lastPpts = cur;
  }catch(e){}
}
function closeGameAlert(){                                                        // #703
  try{
    if(!alertCfg().close) return;
    const md = WEEKST.mate; if(!md || !md.me || !md.opp) return;
    const d = new Date(), day = d.getDay(), h = d.getHours();
    const late = (day===0 && h>=19) || (day===1 && h>=20);
    if(!late) return;
    const gap = Math.abs(md.me.pts - md.opp.pts);
    if(md.me.pts>0 && md.opp.pts>0 && gap<10){
      const k = LS_KEY+"-close"+curWeek();
      if(localStorage.getItem(k)) return;
      localStorage.setItem(k, "1");
      alertFire("close", "😰 Nail-biter: "+(md.me.pts>md.opp.pts?"up":"down")+" by "+gap.toFixed(1),
        md.me.name+" "+md.me.pts.toFixed(1)+" — "+md.opp.pts.toFixed(1)+" "+md.opp.name);
    }
  }catch(e){}
}
function mnfMath(){                                                               // #704
  try{
    const md = WEEKST.mate; if(!md || !md.me || !md.opp) return null;
    const byId = idIndex(), s2o = sleeperToOurs(), w = curWeek();
    const inv = {}; for(const k2 in s2o) inv[s2o[k2]] = k2;
    const leftOf = side=>side.starters.filter(Boolean).map(id=>byId[id]).filter(Boolean)
      .filter(p=>!(+side.ppts[inv[p.id]]) && weekProj(p,w)>0);
    const meLeft = leftOf(md.me), oppLeft = leftOf(md.opp);
    const behind = Math.round((md.opp.pts-md.me.pts)*10)/10;
    if(!meLeft.length && !oppLeft.length) return null;
    return {behind, meLeft, oppLeft,
      per: meLeft.length ? Math.round(Math.max(0,behind)/meLeft.length*10)/10 : 0};
  }catch(e){ return null; }
}
function oppNewsAlert(){                                                          // #706
  try{
    if(!alertCfg().oppnews) return;
    const md = WEEKST.mate; if(!md || !md.opp || !md.opp.starters) return;
    const byId = idIndex(), w = curWeek();
    const k = LS_KEY+"-oppout"+w;
    let seen = []; try{ seen = JSON.parse(localStorage.getItem(k)||"[]"); }catch(e){}
    md.opp.starters.filter(Boolean).forEach(id=>{
      const p = byId[id]; if(!p || seen.includes(id)) return;
      const e = injuryOf(p), sv = e ? injSeverity(e.s) : null;
      if(sv && (sv.code==="O" || sv.code==="IR")){
        seen.push(id);
        alertFire("oppnews", "😏 Their problem: "+p.name+" is "+sv.label.toLowerCase(), "That's your win probability going up");
      }
    });
    try{ localStorage.setItem(k, JSON.stringify(seen)); }catch(e){}
  }catch(e){}
}
function gameDayChecks(){                                                         // called from the scoreboard loop
  inactiveSweep(); scoreAlerts(); closeGameAlert(); oppNewsAlert(); updateActionBadge();
}
function seasonTicker(){                                                          // #701
  let tk = document.getElementById("ticker");
  const md = (typeof WEEKST!=="undefined") ? WEEKST.mate : null;
  const gameOn = scoreRefreshMs()===2*60e3;
  if(!gameOn || !md || !md.me){ if(tk) tk.remove(); return; }
  if(!tk){ tk = document.createElement("div"); tk.id = "ticker"; document.body.appendChild(tk); }
  const byId = idIndex(), s2o = sleeperToOurs();
  const inv = {}; for(const k2 in s2o) inv[s2o[k2]] = k2;
  const items = [];
  items.push('<span class="tk steal">🏈 '+esc(md.me.name)+' <b>'+md.me.pts.toFixed(1)+'</b>'+(md.opp?' — <b>'+md.opp.pts.toFixed(1)+'</b> '+esc(md.opp.name):'')+'</span>');
  md.me.starters.filter(Boolean).forEach(id=>{
    const p = byId[id]; if(!p) return;
    const got = +md.me.ppts[inv[id]] || 0;
    items.push('<span class="tk'+(got>=15?' steal':'')+'">'+esc(p.name.split(" ").slice(-1)[0])+' '+got.toFixed(1)+'</span>');
  });
  const mm = mnfMath();
  if(mm && mm.behind>0 && mm.meLeft.length) items.push('<span class="tk reach">need '+mm.per+'/player from '+mm.meLeft.map(p=>esc(p.name.split(" ").slice(-1)[0])).join(", ")+'</span>');
  const html = items.join('<span class="tksep">◆</span>');
  if(tk.dataset.h === String(items.length)+html.length) return;
  tk.dataset.h = String(items.length)+html.length;
  tk.innerHTML = '<div class="tkinner">'+html+'<span class="tksep">◆</span>'+html+'</div>';
  const inner = tk.firstChild;
  requestAnimationFrame(()=>{ try{ inner.style.animationDuration = Math.max(16, Math.round(inner.scrollWidth/2/75))+"s"; }catch(e){} });
}
function injuryDigest(){                                                          // #705
  const byId = idIndex(), w = curWeek();
  const rows = rosterIds().map(id=>byId[id]).filter(Boolean)
    .map(p=>({p, e:injuryOf(p)})).filter(x=>x.e)
    .map(x=>({...x, sv:injSeverity(x.e.s), swap:benchSwapFor(x.p)}));
  if(!rows.length) return toast("Roster fully healthy 🎉");
  const ov = document.createElement("div"); ov.id = "digOverlay";
  ov.style.cssText = "position:fixed;inset:0;z-index:320;background:rgba(11,15,20,.94);overflow-y:auto;padding:26px 12px";
  ov.innerHTML = '<div class="sbcard" role="dialog"><button class="sbx" data-dgx="1">✕</button><div class="tag">🩹 ROSTER HEALTH — week '+w+'</div>'+
    rows.map(x=>'<div class="sbply"><span><b>'+esc(x.p.name)+'</b> <span class="sevchip '+x.sv.cls+'">'+esc(x.sv.label)+'</span>'+
      (x.e.c?'<br><span class="dimtxt">'+esc(String(x.e.c).slice(0,90))+'</span>':'')+'</span>'+
      '<span class="dimtxt">'+(x.swap?'swap: '+esc(x.swap.name):'no bench cover')+'</span></div>').join("")+'</div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{ if(e.target===ov || e.target.closest("[data-dgx]")) ov.remove(); });
}
function weeklyRecap2(){                                                          // #707
  leagueHistory().then(hist=>{
    if(!hist.length) return toast("No finished weeks yet — recap unlocks after week 1", {warn:true});
    const wm = hist[hist.length-1], wk = hist.length;
    const myRid = +S.settings.sleeperRosterId;
    const m = (wm||[]).find(x=>+x.roster_id===myRid);
    if(!m) return toast("Couldn't find my matchup in history", {warn:true});
    const opp = (wm||[]).find(x=>x.matchup_id===m.matchup_id && +x.roster_id!==myRid);
    const byId = idIndex(), s2o = sleeperToOurs();
    const perf = (m.starters||[]).map(sid=>({p:byId[s2o[String(sid)]], got:+m.players_points[sid]||0})).filter(x=>x.p);
    const mvp = perf.slice().sort((a,b)=>b.got-a.got)[0];
    const bust = perf.filter(x=>x.p.pos!=="DEF").slice().sort((a,b)=>(a.got-a.p.proj/16)-(b.got-b.p.proj/16))[0];
    const eff = lineupEffOf(m, byId);
    const med = (wm||[]).map(x=>x.points||0).sort((a,b)=>a-b)[Math.floor(wm.length/2)];
    const won = opp ? m.points>opp.points : null;
    const rec = {wk, my:Math.round(m.points*10)/10, their:opp?Math.round(opp.points*10)/10:null, oppName:opp?ridName(opp.roster_id):"",
      won, mvp, bust, eff, luck: opp && m.points<med && !won ? "unlucky — you outscored half the league" : (won && m.points<med ? "stole one — below-median win" : "")};
    const ov = document.createElement("div"); ov.id = "rcOverlay";
    ov.style.cssText = "position:fixed;inset:0;z-index:320;background:rgba(11,15,20,.94);overflow-y:auto;padding:26px 12px";
    ov.innerHTML = '<div class="sbcard" role="dialog"><button class="sbx" data-rcx="1">✕</button>'+
      '<div class="tag">📖 WEEK '+wk+' STORY</div>'+
      '<div class="benchhead" style="font-size:15px;color:var(--'+(won?'green':'red')+')">'+(won?'W':'L')+' '+rec.my+'–'+rec.their+' vs '+esc(rec.oppName)+'</div>'+
      (mvp?'<div class="sbply"><span>🏅 MVP: '+esc(mvp.p.name)+'</span><b class="mono">'+mvp.got.toFixed(1)+'</b></div>':'')+
      (bust?'<div class="sbply"><span>🪦 Bust: '+esc(bust.p.name)+'</span><b class="mono">'+bust.got.toFixed(1)+'</b></div>':'')+
      (eff?'<div class="sbply"><span>🎯 Lineup efficiency</span><b class="mono">'+eff.eff+'% ('+eff.actual+' of '+eff.opt+')</b></div>':'')+
      (rec.luck?'<div class="sbply"><span>🍀 '+rec.luck+'</span></div>':'')+
      '<div style="padding:10px 0"><button class="hbtn" id="rcPng">📤 Share card</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", e=>{
      if(e.target===ov || e.target.closest("[data-rcx]")) return ov.remove();
      if(e.target.id==="rcPng") recapPng(rec);                                    // #708
    });
  });
}
function recapPng(rec){                                                           // #708
  const c = document.createElement("canvas"); c.width = 1000; c.height = 560;
  const x = c.getContext("2d");
  x.fillStyle = "#0b0f14"; x.fillRect(0,0,1000,560);
  x.fillStyle = rec.won ? "#2fd47a" : "#e5484d"; x.font = "bold 52px sans-serif";
  x.fillText((rec.won?"DUB.":"PAIN.")+"  "+rec.my+" – "+rec.their, 40, 90);
  x.fillStyle = "#8b98a9"; x.font = "26px sans-serif";
  x.fillText("Week "+rec.wk+" vs "+rec.oppName+" · Buck Breakers", 40, 135);
  x.fillStyle = "#e8eef5"; x.font = "28px sans-serif";
  if(rec.mvp) x.fillText("🏅 "+rec.mvp.p.name+" — "+rec.mvp.got.toFixed(1), 40, 210);
  if(rec.bust) x.fillText("🪦 "+rec.bust.p.name+" — "+rec.bust.got.toFixed(1), 40, 260);
  if(rec.eff) x.fillText("🎯 lineup efficiency "+rec.eff.eff+"%", 40, 310);
  if(rec.luck){ x.fillStyle = "#f0b429"; x.fillText("🍀 "+rec.luck, 40, 360); }
  x.fillStyle = "#8b98a9"; x.font = "20px sans-serif"; x.fillText("draft-war-room · Otto5", 40, 520);
  c.toBlob(b=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "week-"+rec.wk+"-recap.png"; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  });
}
function renderAlertCenter(){                                                     // #709
  const old = document.getElementById("acOverlay"); if(old){ old.remove(); return; }
  const log = notifyLog();
  const ov = document.createElement("div"); ov.id = "acOverlay";
  ov.style.cssText = "position:fixed;inset:0;z-index:320;background:rgba(11,15,20,.94);overflow-y:auto;padding:26px 12px";
  ov.innerHTML = '<div class="sbcard" role="dialog"><button class="sbx" data-acx="1">✕</button><div class="tag">🔔 ALERT CENTER</div>'+
    (log.length ? log.map(a=>'<div class="sbply'+(a.un?'" style="color:var(--text)':'')+'"><span>'+esc(a.title)+
      (a.body?'<br><span class="dimtxt">'+esc(a.body)+'</span>':'')+'</span><span class="dimtxt">'+
      new Date(a.t).toLocaleString([], {weekday:"short", hour:"2-digit", minute:"2-digit"})+'</span></div>').join("")
    : '<div class="empty">Quiet so far. Alerts land here as they fire.</div>')+'</div>';
  document.body.appendChild(ov);
  markAlertsRead();
  ov.addEventListener("click", e=>{ if(e.target===ov || e.target.closest("[data-acx]")) ov.remove(); });
}

window.__mod = window.__mod || []; window.__mod.push("season.js");
