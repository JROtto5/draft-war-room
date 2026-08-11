// Builds e2e.html: index.html + an injected assertion script.
// Injects at the LAST </body> (JS strings legitimately contain '</body>').
import { readFileSync, writeFileSync } from "node:fs";

let html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
// the injected assertion script is inline — drop the CSP for the test page only
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, "");
const test = `
<script>
window.addEventListener("DOMContentLoaded", ()=>{ setTimeout(()=>{
const out=[];
try {
  renderNow();
  out.push("rows:"+(document.querySelectorAll("#poolBody tr[data-pid]").length>=250?"OK":"BAD"));
  out.push("hero:"+(document.getElementById("hero").innerHTML.includes("% at #")?"OK":"BAD"));
  out.push("avatars:"+(document.querySelectorAll("#poolBody .avatar").length>10?"OK":"BAD"));
  out.push("stamp:"+(document.getElementById("buildStamp").textContent.includes("build v")?"OK":"BAD"));
  out.push("mods:"+((window.__mod||[]).length===8?"OK":"BAD("+(window.__mod||[]).join("/")+")"));
  pickMine(allPlayers().find(p=>p.name==="Josh Allen").id);
  const c={QB:0}; S.mine.forEach(id=>{const p=idIndex()[id]; if(p&&p.pos==="QB")c.QB++;});
  out.push("pick:"+(c.QB===1?"OK":"BAD"));
  undoLast();
  out.push("undo:"+(S.mine.length===0?"OK":"BAD"));
  openCard(allPlayers()[0].id);
  out.push("card:"+(document.getElementById("cardBody").innerHTML.includes("Projected")?"OK":"BAD"));
  document.getElementById("cardOverlay").classList.remove("show");
  renderInjCenter();
  out.push("inj:"+(document.getElementById("injBody").innerHTML.includes("sevchip")?"OK":"BAD"));
  // operators + presets + multiselect (#545)
  document.getElementById("search").value = "pos:qb team:buf"; renderPool();
  out.push("ops:"+(document.querySelectorAll("#poolBody tr[data-pid]").length===1?"OK":"BAD("+document.querySelectorAll("#poolBody tr[data-pid]").length+")"));
  S.filterPresets = {test:{pos:"TE", round:"ALL", q:""}};
  document.getElementById("search").value=""; renderPool();
  document.querySelector('[data-preset="test"]').click();
  out.push("preset:"+(S.ui.pos==="TE"?"OK":"BAD"));
  S.ui.pos="ALL"; document.getElementById("search").value=""; renderPool();
  kbSel = 0; applyKbSel();
  const trs2 = document.querySelectorAll("#poolBody tr[data-pid]");
  const before2 = S.log.length;
  const origConfirm = window.confirm; window.confirm = ()=>true;
  trs2[2].children[3].dispatchEvent(new MouseEvent("click", {bubbles:true, shiftKey:true}));
  window.confirm = origConfirm;
  out.push("multi:"+(S.log.length===before2+3?"OK":"BAD("+(S.log.length-before2)+")"));
  undoLastN(S.log.length-before2);
  // keyboard drafting (#167)
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"m",bubbles:true}));
  out.push("kbd:"+(S.mine.length===1?"OK":"BAD"));
  undoLast();
  // queue + live + panic (#168)
  toggleQueue(allPlayers()[3].id); renderQueue();
  out.push("queue:"+(document.getElementById("queueBox").style.display!=="none"?"OK":"BAD"));
  S.ui.live = true; S.pickOffset = 11; renderNow();
  out.push("panic:"+((document.getElementById("clockTakeover")||document.getElementById("panicBar"))?"OK":"BAD"));  // #601: takeover replaces the bar
  const tko0 = document.getElementById("clockTakeover"); if(tko0) tko0.remove();
  S.ui.live = false; S.pickOffset = 0; toggleQueue(allPlayers()[3].id); renderNow();
  // perf budget (#170)
  const t0 = performance.now(); renderPool(); const dt = performance.now()-t0;
  out.push("perf:"+(dt<400?"OK":"BAD("+Math.round(dt)+"ms)"));
  // story + 3yr history (#296)
  openCard(allPlayers().find(p=>p.name==="Josh Allen").id);
  out.push("story:"+(document.querySelector(".cstory")&&document.querySelector(".cstory").textContent.includes("Wyoming")?"OK":"BAD"));
  window._cardTab="hist"; openCard(allPlayers().find(p=>p.name==="Josh Allen").id);
  out.push("hist3:"+(document.querySelectorAll("#cardBody .h3row").length>=3?"OK":"BAD"));
  window._cardTab="ov"; document.getElementById("cardOverlay").classList.remove("show");
  // bold round (#601-615): ghost drafter, war plan, booth, story mode
  out.push("ghost2:"+((()=>{try{ const n0=S.ghost.length; pickMine(allPlayers()[8].id); const ok=S.ghost.length===n0+1; undoLast(); return ok; }catch(e){ return false; }})()?"OK":"BAD"));
  out.push("wp:"+((()=>{try{ const w=warPlan(); return w===null||Array.isArray(w); }catch(e){ return false; }})()?"OK":"BAD"));
  out.push("booth2:"+((()=>{try{ if(S.log.length) boothLine(S.log[0],0); return snipeScan().constructor===Array; }catch(e){ return false; }})()?"OK":"BAD"));
  // season mode + heat alerts degrade offline (#634/#636)
  out.push("heat:"+((()=>{try{ const pr=heatScan(false); return typeof pr.then==="function" && SEASON.avail.constructor===Array && typeof importCompletedDraft==="function" && typeof startSeasonMode==="function"; }catch(e){ return false; }})()?"OK":"BAD"));
  // Scoreboard math runs offline on fixtures (#669)
  out.push("sb:"+((()=>{try{
    const byId=idIndex();
    const rosters=[{roster_id:1,owner_id:"u1",settings:{wins:3,losses:1,fpts:480,fpts_against:400}},
                   {roster_id:2,owner_id:"u2",settings:{wins:1,losses:3,fpts:420,fpts_against:470}}];
    const users=[{user_id:"u1",display_name:"Alpha"},{user_id:"u2",display_name:"Beta"}];
    const mus=[{matchup_id:1,roster_id:1,points:88.4,starters:[],players:[],players_points:{}},
               {matchup_id:1,roster_id:2,points:71.2,starters:[],players:[],players_points:{}}];
    const rows=scoreboardRows({mus,rosters,users,w:3}, byId);
    const st=standingsRows(rosters,users);
    const aw=weeklyAwards(mus,{rosters,users});
    const ap=allPlayStandings([mus],rosters,users);
    return rows.length===1 && rows[0][0].live===88.4 && st[0].name==="Alpha" && st[0].w===3 &&
      aw && aw.hi.pts===88.4 && ap.length===2 && typeof renderScoreboard==="function" && typeof seasonHeroBits==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Waiver math runs offline on fixtures (#684)
  out.push("waiv:"+((()=>{try{
    localStorage.removeItem(LS_KEY+"-claims");
    const rosters=[{roster_id:1,owner_id:"u1",settings:{waiver_budget_used:40}},{roster_id:2,owner_id:"u2",settings:{waiver_budget_used:5}}];
    const users=[{user_id:"u1",display_name:"Alpha"},{user_id:"u2",display_name:"Beta"}];
    const fr=faabRows(rosters,users,{settings:{waiver_budget:100}});
    const bs2=bidSuggest(allPlayers()[20], 60);
    claimsAdd(allPlayers()[30].id, null, 7);
    const ok = fr[0].left===95 && bs2.bid>=1 && bs2.bid<=60 && claimsGet().length===1 &&
      Array.isArray(upgradeFinder(myIds().length?myIds():allPlayers().slice(0,16).map(p=>p.id), idIndex(), 3, [])) &&
      typeof renderWaivers==="function" && typeof whatIfSwap==="function";
    localStorage.removeItem(LS_KEY+"-claims");
    return ok;
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Trade math runs offline on fixtures (#699)
  out.push("trade:"+((()=>{try{
    const ids=allPlayers().slice(0,16).map(p=>p.id), theirs=allPlayers().slice(16,32).map(p=>p.id);
    const ev=tradeEvalRoster([ids[15]],[theirs[0]], 99, ids, theirs);
    const v1=fairnessVerdict(5,-5), v2=fairnessVerdict(-5,5), v3=fairnessVerdict(0,0);
    return ev && typeof ev.me.delta==="number" && ev.verdict && v1.label.includes("FLEECE") &&
      v2.label.includes("DONATION") && v3.label.includes("FAIR") &&
      typeof keeperValue(allPlayers()[0])==="number" && Array.isArray(blockToggle("zz")) && Array.isArray(blockToggle("zz")) &&
      typeof renderTrades==="function" && typeof tradeCardPng==="function" && typeof seasonDossierHtml==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Alert plumbing runs offline (#714)
  out.push("alerts:"+((()=>{try{
    localStorage.removeItem(LS_KEY+"-alertlog");
    alertFire("test","🔔 test alert","body");
    const n1 = unreadAlerts();
    markAlertsRead();
    const ok = n1===1 && unreadAlerts()===0 && typeof quietNow()==="boolean" &&
      typeof pendingActions()==="number" && alertCfg().heat!==undefined &&
      typeof seasonTicker==="function" && typeof weeklyRecap2==="function" &&
      typeof recapPng==="function" && typeof injuryDigest==="function" &&
      typeof gameDayChecks==="function" && (mnfMath()===null || typeof mnfMath()==="object");
    localStorage.removeItem(LS_KEY+"-alertlog");
    return ok;
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Season analytics run offline on fixture archives (#729)
  out.push("stats:"+((()=>{
    const steps=["c",()=>consistencySeason([10,12,11,9,10]).tag.includes("floor"),
      "c2",()=>consistencySeason([2,30,1,28]).tag.includes("boom"),
      "pw",()=>typeof playerWeekly([[{matchup_id:1,roster_id:1,points:100,starters:[],players:[],players_points:{}}]])==="object",
      "rows",()=>Array.isArray(myWeeklyRows([[{matchup_id:1,roster_id:1,points:100,starters:[],players:[],players_points:{}}]])),
      "tally",()=>typeof mvpBustTally([[]])==="object",
      "wroi",()=>Array.isArray(waiverRoi([],[[]])),
      "troi",()=>Array.isArray(tradeRoi([],[[]])),
      "ghost",()=>{const g=ghostSeason([[]]); return g===null||typeof g==="object";},
      "spark",()=>typeof sparkSvg([1,2,3],60,14)==="string",
      "strip",()=>typeof cardSeasonStrip(allPlayers()[0])==="string",
      "mon",()=>typeof hqMondayLine()==="string"];
    for(let i=0;i<steps.length;i+=2){
      try{ if(steps[i+1]()!==true) return "FAIL@"+steps[i]; }catch(e){ return "THROW@"+steps[i]+"-"+String(e).slice(0,40); }
    }
    return "OK";
  })()));
  // War room mode (#1167–#1181)
  out.push("bridge:"+((()=>{try{
    SEASON_LIVE.ids = allPlayers().slice(0,16).map(x=>x.id); SEASON_LIVE.at = Date.now();
    bridgeOpen();
    const el=document.getElementById("bridge");
    const panels=el?el.querySelectorAll("[data-brpanel]").length:0;
    const r0=BRIDGE.rot; BRIDGE.rot++; bridgeRender();
    const rotated=document.getElementById("bridge").querySelector(".brh").textContent!==null && BRIDGE.rot===r0+1;
    document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
    const gone=!document.getElementById("bridge") && !document.body.classList.contains("bridgeon");
    SEASON_LIVE.ids=null; SEASON_LIVE.at=0;
    if(BRIDGE.on) bridgeClose();
    return panels===4 && rotated && gone && typeof bridgeFullscreen==="function" && typeof bridgeOffer==="function";
  }catch(e){ if(typeof bridgeClose==="function") bridgeClose(); SEASON_LIVE.ids=null; return false; }})()?"OK":"BAD"));
  // Sim Center (#1142–#1156)
  out.push("center:"+((()=>{try{
    SEASON_LIVE.ids = allPlayers().slice(0,16).map(x=>x.id); SEASON_LIVE.at = Date.now();
    document.querySelectorAll(".snov").forEach(x=>x.remove());                    // toggle-safe: clear strays first
    renderFragility();
    let ov=document.getElementById("frOverlay");
    if(!ov){ renderFragility(); ov=document.getElementById("frOverlay"); }
    const tabs=ov?ov.querySelectorAll("[data-sctab]").length:0;
    const activeOk=ov?ov.querySelector('[data-sctab="frag"]').getAttribute("aria-selected")==="true":false;
    if(ov) ov.remove();
    SEASON_LIVE.ids=null; SEASON_LIVE.at=0;
    return tabs===4 && activeOk && typeof simCenter==="function" && typeof exportFuture==="function" &&
      seasonDeckHtml().includes("simCenter");
  }catch(e){ SEASON_LIVE.ids=null; return false; }})()?"OK":"BAD"));
  // What-if machine (#1127–#1141)
  out.push("whatif:"+((()=>{try{
    SEASON_LIVE.ids = allPlayers().slice(0,16).map(x=>x.id); SEASON_LIVE.at = Date.now();
    S.settings.sleeperRosterId = S.settings.sleeperRosterId || 12;
    const data={schedule:{5:[[12,2]],6:[[12,2]],7:[[12,2]]}, mu:{12:120,2:118}, wins0:{12:0,2:0}, pf0:{12:0,2:0},
      myRid:12, rivRid:null, spots:1, lastW:7, games:3};
    VEC.key=null;
    const vec=weeklyVectors(data);
    const base=scenarioCore(data, vec, {}, {N:150, seed:2});
    const star=allPlayers().filter(p=>!SEASON_LIVE.ids.includes(p.id) && p.pos==="RB").sort((a,b)=>b.proj-a.proj)[0];
    const boosted=scenarioCore(data, vec, {addIds:[star.id]}, {N:150, seed:2});
    const hurt=scenarioCore(data, vec, {voidWeeks:{[SEASON_LIVE.ids[0]]:[5,7]}}, {N:150, seed:2});
    const cm=clinchMath(data, vec, 300);
    const bandOk=ciBand(50,150)>5 && ciBand(50,150)<12 && ciBand(99,150)<3;
    SEASON_LIVE.ids=null; SEASON_LIVE.at=0; VEC.key=null;
    const mono = cm.rows.every((r2,i)=>i===0 || r2.pct>=cm.rows[i-1].pct-25);
    return boosted.winsAvg>=base.winsAvg && hurt.winsAvg<=base.winsAvg+0.2 && bandOk && mono &&
      typeof renderWhatIf==="function" && typeof scenGet==="function" && typeof elimWatch==="function";
  }catch(e){ SEASON_LIVE.ids=null; return false; }})()?"OK":"BAD"));
  // Opponent behavior (#1112–#1126)
  out.push("oppx:"+((()=>{try{
    const fix={schedule:{1:[[1,2]],2:[[1,2]],3:[[1,2]]}, mu:{1:110,2:110}, wins0:{1:0,2:0}, pf0:{1:0,2:0},
      myRid:1, spots:1, lastW:3, games:3};
    const even=seasonSimX(fix, {N:200, seed:4, injuries:false});
    const sloppy=seasonSimX(fix, {N:200, seed:4, injuries:false, oppEff:{2:0.85}});
    const a1=faabAggro(1, [{rid:1, faab:60, claims:4, trades:0}]);
    const a2=faabAggro(1, [{rid:1, faab:0, claims:0, trades:0}]);
    const rg=rootingGuide({schedule:{1:[[2,3]],2:[[1,2]]}, mu:{1:110,2:100,3:100}, wins0:{1:0,2:0,3:0}, pf0:{1:0,2:0,3:0},
      myRid:1, spots:1, lastW:2, games:2}, null);
    return sloppy.winsAvg>=even.winsAvg && a1===1.5 && a2===0.6 &&
      Array.isArray(rg) && typeof teamEffMult==="function" && typeof leagueFutures==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Weekly vectors: bye dents + speed (#1097–#1111)
  out.push("vec:"+((()=>{try{
    SEASON_LIVE.ids = allPlayers().slice(0,16).map(x=>x.id); SEASON_LIVE.at = Date.now();
    const byeTeam = allPlayers().slice(0,16).map(x=>x.team).find(t2=>typeof BYES!=="undefined" && BYES[t2]>=6 && BYES[t2]<=13);
    const bw = BYES[byeTeam];
    const data={schedule:{}, mu:{12:140}, wins0:{12:0}, pf0:{12:0}, myRid:12, spots:1, lastW:14, games:14};
    for(let w2=5;w2<=14;w2++) data.schedule[w2]=[[12,12]];
    S.settings.sleeperRosterId = S.settings.sleeperRosterId || 12;
    VEC.key=null;
    const v=weeklyVectors(data);
    const dip = v.mu[12][bw] < v.mu[12][bw===5?6:bw-1] - 2;
    const fix={schedule:{1:[[1,2]],2:[[1,2]],3:[[1,2]]}, mu:{1:115,2:100}, wins0:{1:0,2:0}, pf0:{1:0,2:0},
      myRid:1, rivRid:2, spots:1, lastW:3, games:3};
    const t0=performance.now();
    const r=seasonSimX(fix, {N:500, seed:3, injuries:true});
    const ms=performance.now()-t0;
    SEASON_LIVE.ids=null; SEASON_LIVE.at=0; VEC.key=null;
    return dip && r.rivalH2HPct!=null && r.lastPct!=null && r.makePct!=null && ms<700 &&
      typeof driftMult==="function";
  }catch(e){ SEASON_LIVE.ids=null; return false; }})()?"OK":"BAD"));
  // Injury engine (#1082–#1096)
  out.push("inj2:"+((()=>{try{
    const p=allPlayers().find(x=>x.pos==="RB");
    const h=hazardOf(p);
    const fix={schedule:{1:[[1,2]],2:[[1,2]],3:[[1,2]]}, mu:{1:115,2:100}, wins0:{1:0,2:0}, pf0:{1:0,2:0},
      myRid:1, spots:1, lastW:3, games:3};
    SEASON_LIVE.ids = allPlayers().slice(0,16).map(x=>x.id); SEASON_LIVE.at = Date.now();
    const clean=seasonSimX(fix, {N:150, seed:5, injuries:false});
    const hurt=seasonSimX(fix, {N:150, seed:5, injuries:true});
    const hurt2=seasonSimX(fix, {N:150, seed:5, injuries:true});
    const pack=rosterPack(1, 1, 4);
    SEASON_LIVE.ids=null; SEASON_LIVE.at=0;
    return h>0.01 && h<0.1 && ["LOW","MED","HIGH"].includes(hazardBand(p).t) &&
      clean.winsAvg>=hurt.winsAvg && JSON.stringify(hurt.recDist)===JSON.stringify(hurt2.recDist) &&
      Array.isArray(pack) && (pack.length===0 || (pack[0].dep>=0 && pack[0].haz>0)) &&
      typeof injuryDragOf(1,1,4)==="number" && typeof renderFragility==="function" && typeof depthGrade(1)==="string";
  }catch(e){ SEASON_LIVE.ids=null; return false; }})()?"OK":"BAD"));
  // Projection sources (#1067–#1081)
  out.push("src:"+((()=>{try{
    const p=allPlayers().find(x=>x.pos==="RB" && !injuryOf(x) && (typeof BYES==="undefined"||BYES[x.team]!==3));
    const baked=weekProj(p,3);
    PROJX.future[3]={map:{[p.id]: baked+8}, at:Date.now()};
    const s0=S.settings.projSrc;
    S.settings.projSrc="sleeper"; const slp=weekProj(p,3);
    S.settings.projSrc="blend"; S.settings.projBlendPct=50; const bl=weekProj(p,3);
    S.settings.projSrc="baked"; const bk=weekProj(p,3);
    S.overrides[p.id]=320; _memo={key:null};
    S.settings.projSrc="sleeper";
    const pin=weekProj(allPlayers().find(x=>x.id===p.id),3);
    S.overrides={}; _memo={key:null}; S.settings.projSrc=s0; delete PROJX.future[3];
    return slp===baked+8 && bl>baked && bl<slp+2 && Math.abs(bk-baked)<0.5 &&
      pin>16 && pin<25 && typeof projSrcLabel()==="string" && typeof projDivergence==="function" &&
      typeof fetchWeekProjections==="function";
  }catch(e){ S.overrides={}; delete PROJX.future[3]; return false; }})()?"OK":"BAD"));
  // Data correctness matrix (#1042–#1056)
  out.push("truth:"+((()=>{try{
    const p=allPlayers().find(x=>x.pos==="WR" && !injuryOf(x) && (typeof BYES==="undefined" || BYES[x.team]!==3));
    S.overrides[p.id]=320; _memo={key:null};                                     // pin at 20 ppg
    const p2=allPlayers().find(x=>x.id===p.id);
    const ppg=ppgOf(p2), wk=weekProj(p2,3);
    const line=buildSimLine(bestStartersWeek([p2.id], idIndex(), 3));
    const nv=nextWeeksValue(p2,3,3);
    const varOk=playerVariance(p2)>0;
    const consistent = ppg===20 && wk>16 && wk<24 && line.length===1 &&
      Math.abs(line[0].mu-wk)<0.01 && nv>10 && varOk &&
      String(wk).length<=5 && bakedProjOf(p2)!=null;                             // #1054 no float tails
    const exported = JSON.parse(JSON.stringify(S)).overrides[p.id]===320;        // #1051
    S.overrides={}; _memo={key:null}; commit();
    const back=ppgOf(allPlayers().find(x=>x.id===p.id))!==20 || bakedProjOf(p2)===320;
    return consistent && exported && back;
  }catch(e){ S.overrides={}; return false; }})()?"OK":"BAD"));
  // Forms & flows (#1027–#1041)
  out.push("flows:"+((()=>{try{
    localStorage.removeItem(LS_KEY+"-alertlog");
    alertTest();
    const alerted = unreadAlerts()===1;
    const g0=goalsGet().includes("title"); goalsSet("title");
    const g1=goalsGet().includes("title"); goalsSet("title");
    claimsAdd(allPlayers()[40].id, null, 5);
    const c=claimsGet(); c[0].bid=17; claimsSave(c);
    const bidOk=claimsGet()[0].bid===17;
    localStorage.removeItem(LS_KEY+"-claims"); localStorage.removeItem(LS_KEY+"-alertlog");
    return alerted && g0!==g1 && bidOk && typeof scoutPicker==="function" && typeof tradeWith==="function" &&
      typeof goalsSet==="function" && typeof alertTest==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Season sim determinism (#997–#1011)
  out.push("future:"+((()=>{try{
    const fix={schedule:{1:[[1,2],[3,4]],2:[[1,3],[2,4]],3:[[1,4],[2,3]]},
      mu:{1:120,2:100,3:95,4:90}, wins0:{1:0,2:0,3:0,4:0}, pf0:{1:0,2:0,3:0,4:0},
      myRid:1, rivRid:2, spots:2, lastW:3, games:3, N:200, seed:9, myMult:1};
    const a=seasonSimCore(fix), b=seasonSimCore(fix);
    const worse=seasonSimCore(Object.assign({},fix,{seed:9,myMult:0.7}));
    return JSON.stringify(a.recDist)===JSON.stringify(b.recDist) && a.titlePct>=0 &&
      a.winsAvg>worse.winsAvg && a.seedCount.length===3 &&
      typeof renderSeasonSim==="function" && typeof seasonSimData==="function" && typeof myEffMult()==="number";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // CSV pipeline (#982–#996)
  out.push("csv2:"+((()=>{try{
    const nl=String.fromCharCode(10), qt=String.fromCharCode(34);
    const p1=allPlayers()[5], p2=allPlayers()[6];
    const csv="name,ppg"+nl+qt+p1.name+qt+",19.5"+nl+"No Such Guy,12";
    const rows=parseProjCsv(csv);
    const res=applyProjCsv(csv, "test.csv");
    const after=allPlayers().find(x=>x.id===p1.id).proj;
    const wk=weekProj(allPlayers().find(x=>x.id===p1.id), 3);
    const seasonScale=applyProjCsv(p2.name+",250", "t2.csv");
    const ok = rows.length===2 && res.matched===1 && res.un.length===1 && res.scale==="ppg" &&
      Math.abs(after-312)<1 && wk>14 && wk<26 && seasonScale.scale==="season" &&
      typeof exportProjCsv==="function" && typeof sleeperPpgImport==="function" && typeof setMyPpg==="function";
    S.overrides={}; _memo={key:null}; commit();
    return ok;
  }catch(e){ S.overrides={}; return false; }})()?"OK":"BAD"));
  // Lineup lab: real click flow (#967–#981)
  out.push("lab:"+((()=>{try{
    localStorage.removeItem(LS_KEY+"-staged"+curWeek());
    SEASON_LIVE.ids = allPlayers().slice(0,16).map(p=>p.id); SEASON_LIVE.at = Date.now();
    const host=document.createElement("div"); host.id="labHost";
    host.innerHTML=sidebarSeasonHtml(idIndex()).list; document.body.appendChild(host);
    const swapBtn=host.querySelector("[data-swap]");
    if(!swapBtn){ host.remove(); return "NOBTN"; }
    swapBtn.click();
    const sheet=document.getElementById("swapSheet");
    const opened=!!sheet;
    let staged=false;
    if(sheet){ const pick=sheet.querySelector("[data-swapin]"); if(pick){ pick.click(); staged=stagedGet().length===1; } else sheet.remove(); }
    const chips=host.querySelectorAll("[data-slotchip]").length>0;
    stagedClear(); host.remove();
    SEASON_LIVE.ids = null; SEASON_LIVE.at = 0;
    const s2=document.getElementById("swapSheet"); if(s2) s2.remove();
    return opened && staged && chips && typeof stageOptimal==="function" && typeof stageWinProb==="function" &&
      typeof slotSheet==="function" && typeof unstageAt==="function" && lockedIds() instanceof Set;
  }catch(e){ return false; }})()===true?"OK":"BAD"));
  // CSP-safe dispatcher (#949–#955): data-act clicks call through; no inline handlers in generated html
  out.push("csp:"+((()=>{try{
    const deck=seasonDeckHtml(), rail=sidebarSeasonHtml(idIndex());
    const clean=[deck, rail.hero, rail.list, seasonPageHtml(), mobileNavHtml(), moreSheetHtml()].every(h=>!/onclick=/.test(h));
    window._poolShow=false;
    const b2=document.createElement("button"); b2.dataset.act="togglePool"; document.body.appendChild(b2);
    b2.click(); const flipped=window._poolShow===true; b2.remove(); window._poolShow=false;
    return clean && flipped && deck.includes("data-clickid");
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Mobile nav structure (#924–#938)
  out.push("mobile:"+((()=>{try{
    const nav=mobileNavHtml(), sheet=moreSheetHtml();
    return (nav.match(/data-tab=/g)||[]).length===5 && nav.includes("More") &&
      (sheet.match(/<button/g)||[]).length===8 && typeof moreSheet==="function" && typeof mountMobileNav==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Motion & calm mode (#909–#923)
  out.push("motion:"+((()=>{try{
    applyCalm(true);
    const on=document.body.classList.contains("calm");
    applyCalm(false);
    return on && !document.body.classList.contains("calm") && typeof countUp==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Chart kit (#894–#908)
  out.push("charts:"+((()=>{try{
    const a=chartArea([10,20,15,30,25],{ref:20,label:"t"});
    const b=chartBars([[10,12],[14,9],[8,11]],{label:"t"});
    const rc=chartRace([{vals:[0,1,2],big:true,color:"var(--gold)"},{vals:[1,1,2]}],{label:"t"});
    const em=chartArea([1],{empty:"nope"});
    const fake={my:new Float64Array([80,90,100,85,95]),opp:new Float64Array([70,88,92,75,99]),p10:75,p50:88,p90:99};
    const d=chartDist(fake);
    return [a,b,rc,em,d].every(x=>typeof x==="string" && x.startsWith("<svg")) &&
      a.includes("aria-label") && em.includes("nope") && typeof countUp==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Dashboard structure (#879–#893)
  out.push("dash:"+((()=>{try{
    const h=seasonPageHtml();
    return typeof h==="string" && h.includes("sphero") && h.includes("sptiles") && h.includes("spgrid") &&
      h.includes("spbar") && h.includes("spdial") && h.includes("STANDINGS") && h.includes("THE WIRE");
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Identity v2 tokens present (#864–#878)
  out.push("ident:"+((()=>{try{
    const cs=getComputedStyle(document.documentElement);
    return cs.getPropertyValue("--elev1").trim().length>0 && cs.getPropertyValue("--r-lg").trim().length>0 &&
      cs.getPropertyValue("--grad").trim().length>0 &&
      !!document.querySelector("#seasonBtn.primary") && seasonDeckHtml().includes("dlab");
  }catch(e){ return false; }})()?"OK":"BAD"));
  // The rail: sidebar structure (#849–#863)
  out.push("rail:"+((()=>{try{
    const r=sidebarSeasonHtml(idIndex());
    return typeof r.hero==="string" && typeof r.list==="string" &&
      r.hero.includes("ssbbug") && r.hero.includes("sstile") && r.hero.includes("ssquick") &&
      r.list.includes("STARTING NINE") && (r.list.includes("ssrow") || r.list.includes("skel"));
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Routes: / season, /draft draft, e2e pinned to draft (#845–#848)
  out.push("route:"+((()=>{try{
    const sp=document.getElementById("seasonPage"), pp=document.getElementById("poolPanel");
    const r=appRoute();
    renderSeasonPage();
    return r==="draft" && !!sp && sp.hidden===true && !!pp && pp.style.display==="" &&
      typeof renderSeasonPage==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // One-tap season entry (#840–#842)
  out.push("entry:"+((()=>{try{
    const b=document.getElementById("seasonBtn");
    const idsOk = DEFAULT_LEAGUE==="1357910286874464256" && DEFAULT_DRAFT==="1357910286887043072" &&
      DEFAULT_ROSTER_ID===12 && DEFAULT_SLOT2RID["12"]===12 && typeof applyDefaultIds==="function";
    // forced season render: HQ hero must appear with an EMPTY board when SEASON.on (#844)
    SEASON.on = true; renderNow();
    const hq = document.getElementById("hero").innerHTML.includes("SEASON HQ");
    SEASON.on = false; renderNow();
    return !!b && typeof enterSeasonMode==="function" && idsOk && hq;
  }catch(e){ SEASON.on=false; return false; }})()?"OK":"BAD"));
  // Season deck + shortcuts wiring (#738)
  out.push("deck:"+((()=>{try{
    const d = seasonDeckHtml();
    return typeof d==="string" && d.includes("renderScoreboard") && d.includes("analystReport") &&
      d.includes("renderTrades") && d.includes("seasonDeck") &&
      typeof applySeasonHeader==="function" && !document.getElementById("draftMenuBtn");
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Game plan math runs offline (#754)
  out.push("plan:"+((()=>{try{
    const p0=allPlayers()[0];
    const ct=confidenceTag(10,4), ct2=confidenceTag(0.5,8);
    const wm=winModeFor();
    const bs=winProbLineup("ceiling");
    const gp=gamePlanMoves();
    return ct.t==="LOCK" && ct2.t==="COIN-FLIP" && typeof playerVariance(p0)==="number" &&
      ["floor","ceiling","balanced"].includes(wm.mode) && bs.line.length>=9 &&
      Array.isArray(gp.moves) && typeof rosSos(p0)==="number" &&
      (pathToPlayoffs()===null || typeof pathToPlayoffs()==="object") &&
      typeof planTick==="function" && typeof renderGamePlan==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Hype engine runs offline (#769)
  out.push("hype:"+((()=>{try{
    const hl=hypeLine(), tt=trashTalk();
    return typeof hl==="string" && hl.length>10 && typeof tt==="string" && tt.length>10 &&
      ["mild","standard","full"].includes(hypeDial()) && typeof hypeOn("mild")==="boolean" &&
      (nicknameOf(allPlayers()[0])===null || typeof nicknameOf(allPlayers()[0])==="string") &&
      typeof hypeCard==="function" && typeof receiptsCard==="function" && typeof egoDash==="function" &&
      typeof pregameSpeech==="function" && typeof entranceSplash==="function" && typeof titleChaseHtml()==="string";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Scouting math runs offline on fixtures (#784)
  out.push("scout:"+((()=>{try{
    const hist=[[{matchup_id:1,roster_id:1,points:100,starters:["1"],players:["1"],players_points:{"1":0}},
                 {matchup_id:1,roster_id:2,points:90,starters:[],players:[],players_points:{}}]];
    const tend=leagueTendencies([{type:"waiver",rids:[1],bid:12},{type:"trade",rids:[1,2]}], hist);
    const h2h=h2hLedger(hist);
    return Array.isArray(tend) && typeof h2hLedger==="function" && typeof h2h==="object" &&
      (sloppinessOf(99,[])===null) && Array.isArray(strengthDelta(1)) &&
      (kryptonite([])===null || typeof kryptonite([])==="object") &&
      typeof scoutReport==="function" && typeof scoutCard==="function" && typeof scoutMyOpponent==="function" &&
      Array.isArray(exploitFinder(1)) && typeof benchVsBench(1)==="object";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Simulator determinism on fixtures (#799)
  out.push("sim:"+((()=>{try{
    const L1=[{name:"A",mu:20,sd:6,team:"BUF",corr:false},{name:"B",mu:15,sd:5,team:"KC",corr:true},{name:"C",mu:12,sd:8,team:"KC",corr:true}];
    const L2=[{name:"D",mu:18,sd:6,team:"SF",corr:false},{name:"E",mu:16,sd:7,team:"DAL",corr:false}];
    const r1=simSides(L1,L2,800,7), r2=simSides(L1,L2,800,7);
    const lev=simLeverage(L1,L2,300,7);
    const br=benchRegret([]);
    return r1.wp===r2.wp && r1.wp>0 && r1.wp<1 && r1.p10<r1.p90 &&
      Array.isArray(lev) && lev.length===3 && typeof simHistSvg(r1)==="string" &&
      typeof renderSim==="function" && typeof simBestLineup==="function" &&
      br.total===0 && (journalOutcomes([])===null || typeof journalOutcomes([])==="object");
  }catch(e){ return false; }})()?"OK":"BAD"));
  // Live game-state math on fixtures (#814)
  out.push("live:"+((()=>{try{
    const r1=remFrac("pre",0,"15:00"), r2=remFrac("post",4,"0:00"), r3=remFrac("in",3,"7:30");
    NFLSTATE.map={BUF:{state:"in",period:3,clock:"7:30",diff:3,rem:r3}, KCC:{state:"post",period:4,clock:"0:00",diff:-10,rem:0}};
    const b1=gsBadge("BUF"), b2=gsBadge("KCC"), b3=gsBadge("ZZZ");
    const p=allPlayers().find(x=>x.team==="BUF");
    const adj=liveAdjRemaining(p, 5);
    const ok = r1===1 && r2===0 && Math.abs(r3-((900+450)/3600))<0.01 &&
      b1.includes("Q3") && b2==="FINAL" && b3==="" && typeof adj==="number" && adj>=0 &&
      anyGameLive()===true && (scenarioLine()===null || typeof scenarioLine()==="string") &&
      (liveSim(50)===null || typeof liveSim(50).wp==="number") &&
      typeof liveWpChartHtml()==="string" && typeof liveTick==="function";
    NFLSTATE.map={};
    return ok;
  }catch(e){ NFLSTATE.map={}; return false; }})()?"OK":"BAD"));
  // Rituals & psychology offline (#829)
  out.push("ritual:"+((()=>{try{
    const cs=checklistState();
    checklistTick("scout");
    const cs2=checklistState();
    const ok1 = cs.total===5 && cs2.items.find(i=>i.k==="scout").done===true;
    checklistTick("scout");
    confSet(4);
    const gp=goalsProgress();
    return ok1 && Array.isArray(gp) && (mgmtGrade()===null || typeof mgmtGrade().letter==="string") &&
      (brightSide()===null || Array.isArray(brightSide())) && (lossAutopsy()===null || typeof lossAutopsy()==="string") &&
      typeof deathWatch()==="string" && Array.isArray(elimTracker()) &&
      typeof renderRituals==="function" && typeof ritualTick==="function" && typeof checklistStreak()==="number";
  }catch(e){ return false; }})()?"OK":"BAD"));
  // My Week math runs offline on fixtures (#654)
  out.push("week:"+((()=>{try{
    const byId=idIndex(); const ids=allPlayers().slice(0,30).map(p=>p.id);
    const fix={}; ids.forEach((id,i)=>fix[id]=30-i);
    const bw=bestStartersWeek(ids, byId, 3, fix);
    const wpOk = winProb(120,100)>0.5 && winProb(120,100)<1 && Math.abs(winProb(100,100)-0.5)<0.01;
    return bw.line.length>=9 && bw.pts>0 && typeof weekProj(allPlayers()[0],3)==="number" && wpOk && typeof myWeekHtml==="function";
  }catch(e){ return false; }})()?"OK":"BAD"));
  out.push("cine:"+((()=>{try{ markTaken(allPlayers()[9].id); storyMode(); const o=document.getElementById("storyOverlay"); const ok=!!o; if(o) o.remove(); undoLast(); return ok; }catch(e){ return false; }})()?"OK":"BAD"));
  // chunked mocks complete with progress (#312/#313)
  renderMocks();
  setTimeout(()=>{
    out.push("mocks:"+(document.querySelectorAll("#mockGrid .mock").length===5?"OK":"BAD"));
    document.getElementById("mocksOverlay").classList.remove("show");
    // report modal (#377)
    buildReport();
    out.push("report:"+(document.getElementById("reportBody").innerHTML.includes("Current lineup")||document.getElementById("reportBody").innerHTML.includes("xpected")?"OK":"BAD"));
    document.getElementById("reportOverlay").classList.remove("show");
    // palette (#378)
    openPalette();
    const pin = document.getElementById("palIn");
    pin.value = "josh"; pin.dispatchEvent(new Event("input"));
    out.push("palette:"+(document.querySelectorAll("#palList .palrow").length>1?"OK":"BAD"));
    const pw = document.getElementById("palWrap"); if(pw) pw.remove();
    // sync path against a stubbed endpoint (#412)
    const realFetch = window.fetch;
    window.fetch = (url)=>{
      if(String(url).includes("/draft/TEST/picks"))
        return Promise.resolve({ok:true, json:()=>Promise.resolve([
          {player_id:String(HEADSHOT[normName("Jahmyr Gibbs")]), picked_by:"u1"},
          {player_id:String(HEADSHOT[normName("Bijan Robinson")]), picked_by:"u2"}])});
      if(String(url).includes("/draft/TEST"))
        return Promise.resolve({ok:true, json:()=>Promise.resolve({draft_order:{}})});
      return Promise.reject(new Error("e2e: no network"));
    };
    S.settings.sleeperDraftId = "TEST";
    SYNC.on = true; SYNC.draftId = "TEST"; SYNC.seen = 0; SYNC.myRoster = "u1";
    syncPoll().then(()=>{
      const gibbs2 = allPlayers().find(p=>p.name==="Jahmyr Gibbs").id;
      out.push("sync:"+(S.mine.includes(gibbs2)?"OK":"BAD"));   // picked_by u1 = MINE (#513)
      out.push("sync2:"+(S.taken[allPlayers().find(p=>p.name==="Bijan Robinson").id]?"OK":"BAD"));
      window.fetch = realFetch; SYNC.on = false; undoLast(); undoLast();
    });
  }, 700);
} catch(e){ out.push("ERR:"+e.message); }
setTimeout(async ()=>{                                                    // 🕷 the button crawler (#1012–#1026)
  const errs=[]; let crawled=0;
  const oldErr=window.onerror; window.onerror=(m)=>{ errs.push("winerr:"+String(m).slice(0,40)); return true; };
  const rejH=e=>{ errs.push("rej:"+String(e.reason).slice(0,80)); e.preventDefault(); };
  window.addEventListener("unhandledrejection", rejH);
  const oldPrompt=window.prompt; window.prompt=()=>null;
  const realFetch2=window.fetch; window.fetch=()=>Promise.reject(new Error("crawl: no network"));
  const clickAct=n=>{ const b=document.createElement("button"); b.dataset.act=n; document.body.appendChild(b); b.click(); b.remove(); };
  const settle=()=>new Promise(r=>setTimeout(r,55));
  const consequence=()=> !!document.querySelector(".snov,#sbOverlay,#swapSheet,#slotSheet") || !!document.querySelector("#toastWrap .toast");
  const cleanup=()=>{ document.querySelectorAll(".snov,#sbOverlay,#swapSheet,#slotSheet").forEach(x=>x.remove()); const tw=document.getElementById("toastWrap"); if(tw) tw.innerHTML=""; };
  const NOASSERT=["hypeCard","receiptsCard","pregameSpeech","copyWkText"];
  const ACTS=["renderGamePlan","renderSim","renderScoreboard","renderWaivers","renderTrades","renderSeasonStats",
    "renderRituals","egoDash","weeklyRecap2","renderAlertCenter","injuryDigest","scoutMyOpponent","moreSheet",
    "analystReport","stageOptimal","stageWinProb","renderSeasonSim","togglePool","toggleDensity"].concat(NOASSERT);
  for(const name of ACTS){
    cleanup();
    const p0=window._poolShow, d0=window._density;
    try{ clickAct(name); }catch(e){ errs.push(name+":throw"); continue; }
    await settle(); await settle(); await settle();
    const ok = consequence() || window._poolShow!==p0 || window._density!==d0 || NOASSERT.includes(name);
    if(!ok) errs.push(name); else crawled++;
  }
  cleanup();
  clickAct("renderRituals"); await settle();                                    // Esc hygiene (#1016)
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  await settle();
  const escOk = !document.querySelector(".snov");
  cleanup();
  const cb=document.createElement("button"); cb.dataset.clickid="gradeBtn";     // clickid path (#1017)
  document.body.appendChild(cb); cb.click(); cb.remove(); await settle();
  const gradeOpen=document.getElementById("reportOverlay").classList.contains("show");
  document.getElementById("reportOverlay").classList.remove("show");
  let palOk=true; try{ PALETTE_ACTIONS.forEach(a=>{ if(typeof a[1]!=="function") palOk=false; }); }catch(e){ palOk=false; }   // #1018
  cleanup();
  window.onerror=oldErr; window.prompt=oldPrompt; window.fetch=realFetch2; window.removeEventListener("unhandledrejection", rejH);
  out.push("crawl:"+((errs.length===0 && escOk && gradeOpen && palOk) ? "OK("+crawled+")" : "BAD["+errs.slice(0,6).join("+")+(escOk?"":"+esc")+(gradeOpen?"":"+clickid")+(palOk?"":"+pal")+"]"));
}, 1200);
document.title = "E2E|BOOTING";   // provisional: distinguishes "timers never fired" from "page never loaded"
setTimeout(()=>{
  const verdict = "E2E|"+out.join("|");
  document.title = verdict;
  // the app rewrites document.title on every render, so the title can be
  // clobbered before dump-dom fires — a dedicated node is the durable record
  const res = document.createElement("div");
  res.id = "e2eResult"; res.style.display = "none"; res.textContent = verdict;
  document.body.appendChild(res);
}, 8000);
}, 100); });
</scr` + `ipt>`;

const i = html.lastIndexOf("</body>");
writeFileSync(new URL("../e2e.html", import.meta.url), html.slice(0, i) + test + html.slice(i));
console.log("e2e.html written");
