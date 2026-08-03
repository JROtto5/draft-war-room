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
  // keyboard drafting (#167)
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"m",bubbles:true}));
  out.push("kbd:"+(S.mine.length===1?"OK":"BAD"));
  undoLast();
  // queue + live + panic (#168)
  toggleQueue(allPlayers()[3].id); renderQueue();
  out.push("queue:"+(document.getElementById("queueBox").style.display!=="none"?"OK":"BAD"));
  S.ui.live = true; S.pickOffset = 11; renderNow();
  out.push("panic:"+(document.getElementById("panicBar")?"OK":"BAD"));
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
setTimeout(()=>{ document.title="E2E|"+out.join("|"); }, 900);
}, 100); });
</scr` + `ipt>`;

const i = html.lastIndexOf("</body>");
writeFileSync(new URL("../e2e.html", import.meta.url), html.slice(0, i) + test + html.slice(i));
console.log("e2e.html written");
