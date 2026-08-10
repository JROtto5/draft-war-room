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
  out.push("mods:"+((window.__mod||[]).length===4?"OK":"BAD("+(window.__mod||[]).join("/")+")"));
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
