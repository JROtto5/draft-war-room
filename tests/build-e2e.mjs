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
  out.push("mods:"+((window.__mod||[]).length===6?"OK":"BAD("+(window.__mod||[]).join("/")+")"));
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
  // Season deck + shortcuts wiring (#738)
  out.push("deck:"+((()=>{try{
    const d = seasonDeckHtml();
    return typeof d==="string" && d.includes("renderScoreboard") && d.includes("renderWaivers") &&
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
document.title = "E2E|BOOTING";   // provisional: distinguishes "timers never fired" from "page never loaded"
setTimeout(()=>{
  const verdict = "E2E|"+out.join("|");
  document.title = verdict;
  // the app rewrites document.title on every render, so the title can be
  // clobbered before dump-dom fires — a dedicated node is the durable record
  const res = document.createElement("div");
  res.id = "e2eResult"; res.style.display = "none"; res.textContent = verdict;
  document.body.appendChild(res);
}, 900);
}, 100); });
</scr` + `ipt>`;

const i = html.lastIndexOf("</body>");
writeFileSync(new URL("../e2e.html", import.meta.url), html.slice(0, i) + test + html.slice(i));
console.log("e2e.html written");
