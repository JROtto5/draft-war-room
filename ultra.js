/* ============================================================
   ultra.js — the Badass Hundred (#1167–#1266): war-room mode,
   the voice, the arsenal, broadcast, the vault, edge intel.
   ============================================================ */

/* ---------- R74 WAR ROOM MODE: the big screen (#1167–#1181) ---------- */
const BRIDGE = {on:false, rot:0, paused:false, timer:null, wake:null, lastPts:{}};
const BRIDGE_ROT = ["standings","rooting","wire","future"];
function bridgePanelIntel(){                                                     // #1169
  const kind = BRIDGE_ROT[BRIDGE.rot % BRIDGE_ROT.length];
  const byId = idIndex();
  if(kind==="standings" && SCOREB.rosters){
    const st = standingsRows(SCOREB.rosters, SCOREB.users), myRid = +S.settings.sleeperRosterId;
    return {t:"🏆 STANDINGS", h:st.slice(0,8).map((r,i)=>'<div class="brrow'+(r.rid===myRid?" me":"")+'"><span>'+(i+1)+' '+esc(r.name)+'</span><b class="mono">'+r.w+'-'+r.l+'</b></div>').join("")};
  }
  if(kind==="rooting"){
    const g = window._rootGuide||[];
    return {t:"📣 ROOTING GUIDE", h: g.length ? g.map(x=>'<div class="brrow"><span>'+esc(ridName(x.root))+' over '+esc(ridName(x.against))+'</span><b class="mono">+'+x.swing+'%</b></div>').join("")
      : '<div class="brrow dim">no games that move our odds</div>'};
  }
  if(kind==="wire"){
    return {t:"🔥 HEATING", h:(SEASON.avail||[]).slice(0,6).map(p=>'<div class="brrow"><span>'+esc(p.name)+' <span class="dim">'+p.pos+'</span></span><b class="mono">'+((typeof buzzOf==="function")?buzzOf(p).toLocaleString():'')+'</b></div>').join("")
      || '<div class="brrow dim">wire is quiet</div>'};
  }
  const ls = window._lastSeasonSim;
  const odds = SEASON.lastOdds ? SEASON.lastOdds[+S.settings.sleeperRosterId] : null;
  return {t:"🔮 THE FUTURE", h:'<div class="brrow"><span>playoff odds</span><b class="mono">'+(odds!=null?odds+'%':'—')+'</b></div>'+
    (ls?'<div class="brrow"><span>most likely record</span><b class="mono">'+esc(ls.rec)+'</b></div><div class="brrow"><span>title</span><b class="mono">'+ls.title+'%</b></div>':'<div class="brrow dim">run the season sim for more</div>')};
}
function bridgeHtml(){
  const byId = idIndex(), w = curWeek(), md = WEEKST.mate;
  const s2o = sleeperToOurs(), inv = {}; for(const k in s2o) inv[s2o[k]] = k;
  const bs = bestStartersWeek(rosterIds(), byId, w);
  const wp = (window._liveWp!=null && typeof anyGameLive==="function" && anyGameLive()) ? window._liveWp
    : (md && md.opp ? Math.round(winProb(bs.pts, bestStartersWeek(md.opp.ids, byId, w).pts)*100) : null);
  const nine = (side, mine)=>{
    if(!side || !side.starters) return '<div class="brrow dim">lineup loading…</div>';
    return side.starters.filter(Boolean).map(id=>{
      const p = byId[id]; if(!p) return "";
      const got = +side.ppts[inv[id]]||0;
      const g = (typeof gameStateOf==="function") ? gameStateOf(p.team) : null;
      const live = g && g.state==="in";
      return '<div class="brrow'+(live?" live":"")+'" data-brp="'+p.id+'"><span>'+esc(p.name.split(" ").slice(-1)[0])+
        ' <span class="dim">'+p.pos+((typeof gsBadge==="function" && gsBadge(p.team))?' '+gsBadge(p.team):'')+'</span></span>'+
        '<b class="mono">'+(got?got.toFixed(1):'~'+weekProj(p,w).toFixed(1))+'</b></div>';
    }).join("");
  };
  const intel = bridgePanelIntel();
  const kick = (typeof anyGameLive==="function" && anyGameLive()) ? null : (typeof nextOpp==="function" ? null : null);
  return '<div class="brtop">'+
      '<div class="brteam"><span>OTTO5</span><b class="mono" id="brMe">'+(md&&md.me?md.me.pts.toFixed(1):'0.0')+'</b></div>'+
      '<div class="brmid"><b class="mono">'+(wp!=null?wp+'%':'W'+w)+'</b><span>'+(wp!=null?'WIN PROBABILITY':'WEEK')+'</span>'+
        (typeof anyGameLive==="function" && anyGameLive() ? '<span class="brlive">● LIVE</span>' : '<span class="dim">'+((typeof scenarioLine==="function" && scenarioLine())||'awaiting kickoff')+'</span>')+'</div>'+
      '<div class="brteam right"><span>'+esc(md&&md.opp?md.opp.name.toUpperCase():'—')+'</span><b class="mono" id="brOpp">'+(md&&md.opp?md.opp.pts.toFixed(1):'0.0')+'</b></div>'+
    '</div>'+
    '<div class="brgrid">'+
      '<div class="brpanel" data-brpanel="1"><div class="brh">🏈 MY NINE <span class="mono">'+fmt(bs.pts)+' proj</span></div>'+nine(md&&md.me, true)+'</div>'+
      '<div class="brpanel" data-brpanel="2"><div class="brh">⚔ '+esc(md&&md.opp?md.opp.name:'OPPONENT')+'</div>'+nine(md&&md.opp, false)+'</div>'+
      '<div class="brpanel" data-brpanel="3"><div class="brh">'+intel.t+'<i class="brbar'+(BRIDGE.paused?" off":"")+'"></i></div>'+intel.h+'</div>'+
      '<div class="brpanel" data-brpanel="4"><div class="brh">📋 THE PLAN</div>'+
        (()=>{ try{ const {moves} = gamePlanMoves();
          return moves.length ? moves.slice(0,5).map(m=>'<div class="brrow"><span>'+esc(m.txt.replace(/^[^\w]+\s*/,""))+'</span><b style="color:var(--'+m.tag.c+')">'+m.tag.t+'</b></div>').join("")
            : '<div class="brrow" style="color:var(--green)">✓ Lineup is optimal — enjoy the games</div>'; }catch(e){ return '<div class="brrow dim">plan loading…</div>'; } })()+
      '</div>'+
    '</div>'+
    '<div class="brfoot"><span class="dim">1–4 focus · R rotate · Space pause · Esc exit</span>'+
      '<button class="hbtn" data-brfs="1">⛶ Fullscreen</button><button class="hbtn" data-brx="1">✕ Exit</button></div>';
}
function bridgeRender(){
  const el = document.getElementById("bridge"); if(!el) return;
  const prevMe = parseFloat((document.getElementById("brMe")||{}).textContent)||0;
  el.innerHTML = bridgeHtml();
  const meEl = document.getElementById("brMe");
  const md = WEEKST.mate;
  if(meEl && md && md.me && md.me.pts>prevMe+0.05){                              // #1173
    if(typeof countUp==="function"){ meEl.textContent = prevMe.toFixed(1); countUp(meEl, md.me.pts); }
    el.classList.add("brflash"); setTimeout(()=>el.classList.remove("brflash"), 900);
    if(typeof chime==="function" && S.settings.calm!==true) try{ chime(); }catch(e){}
  }
}
function bridgeOpen(){                                                           // #1167
  if(BRIDGE.on) return bridgeClose();
  const el = document.createElement("div");
  el.id = "bridge"; el.setAttribute("role","region"); el.setAttribute("aria-label","War room mode");
  document.body.appendChild(el);
  BRIDGE.on = true; document.body.classList.add("bridgeon");
  bridgeRender();
  const calm = document.body.classList.contains("calm") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  BRIDGE.paused = calm;                                                          // #1180
  clearInterval(BRIDGE.timer);
  BRIDGE.timer = setInterval(()=>{
    if(!BRIDGE.on) return;
    if(!BRIDGE.paused) BRIDGE.rot++;
    bridgeRender();
  }, 12000);
  try{ if(navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request("screen").then(s2=>{ BRIDGE.wake = s2; }).catch(()=>{}); }catch(e){}   // #1171
  if(typeof leagueWeekData==="function") leagueWeekData(true).then(()=>bridgeRender());
  toast("🖥 War room mode — F for fullscreen, Esc to exit");
}
function bridgeClose(){
  const el = document.getElementById("bridge"); if(el) el.remove();
  BRIDGE.on = false; document.body.classList.remove("bridgeon");
  clearInterval(BRIDGE.timer);
  try{ if(BRIDGE.wake && BRIDGE.wake.release) BRIDGE.wake.release(); }catch(e){}
  BRIDGE.wake = null;
  try{ if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); }catch(e){}
}
function bridgeFullscreen(){                                                     // #1172
  try{
    if(document.fullscreenElement){ document.exitFullscreen(); return; }
    const el = document.getElementById("bridge") || document.documentElement;
    if(el.requestFullscreen) el.requestFullscreen();
  }catch(e){ toast("Fullscreen blocked here", {warn:true}); }
}
document.addEventListener("click", e=>{
  if(e.target.closest("[data-brx]")){ e.preventDefault(); bridgeClose(); return; }
  if(e.target.closest("[data-brfs]")){ e.preventDefault(); bridgeFullscreen(); return; }
  const bp = e.target.closest("[data-brpanel]");
  if(bp && BRIDGE.on && +bp.dataset.brpanel===3){ BRIDGE.rot++; bridgeRender(); }  // #1179 tap to cycle
});
document.addEventListener("keydown", e=>{                                        // #1175
  if(!BRIDGE.on) return;
  const t = e.target;
  if(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const k = e.key.toLowerCase();
  if(k==="escape"){ e.preventDefault(); e.stopImmediatePropagation(); bridgeClose(); }
  else if(k==="r"){ e.preventDefault(); BRIDGE.rot++; bridgeRender(); }
  else if(k===" "){ e.preventDefault(); BRIDGE.paused = !BRIDGE.paused; bridgeRender(); toast(BRIDGE.paused?"⏸ rotation paused":"▶ rotating"); }
  else if(k==="f"){ e.preventDefault(); bridgeFullscreen(); }
  else if("1234".includes(k)){ const p = document.querySelector('[data-brpanel="'+k+'"]'); if(p){ e.preventDefault(); p.scrollIntoView({block:"center", behavior:"smooth"}); p.classList.add("brfocus"); setTimeout(()=>p.classList.remove("brfocus"), 1200); } }
}, true);
function bridgeTick(){ if(BRIDGE.on) bridgeRender(); }
function bridgeOffer(){                                                          // #1176
  try{
    if(BRIDGE.on || S.settings.bridgeOffer===false) return;
    if(typeof anyGameLive!=="function" || !anyGameLive()) return;
    const k = LS_KEY+"-bridgeoffer"+new Date().toDateString();
    if(localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    toast("🖥 Games are live — open War Room mode?", {action:{label:"OPEN", fn:bridgeOpen}});
  }catch(e){}
}

window.__mod = window.__mod || []; window.__mod.push("ultra.js");
