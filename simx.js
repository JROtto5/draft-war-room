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

window.__mod = window.__mod || []; window.__mod.push("simx.js");
