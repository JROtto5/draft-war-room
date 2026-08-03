// Marathon: drive a complete 192-pick draft in the browser and audit the wreckage.
import { readFileSync, writeFileSync } from "node:fs";
let html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, "");
const test = `
<script>
window.addEventListener("DOMContentLoaded", ()=>{ setTimeout(()=>{
const out=[];
try {
  setLive(true);
  const t0 = performance.now();
  let guard = 0;
  while(myIds().length < S.settings.roster && guard < 400){
    guard++;
    const h = nextPickHorizon();
    if(!h) break;
    if(h.onClock){
      const {scored} = scoreBoard();
      if(!scored.length) break;
      pickMine(scored[0].p.id);
    } else {
      simToMyPick();
    }
  }
  if(S.log.length < S.settings.teams*S.settings.roster) simToMyPick();   // 🏁 finish the room
  const dt = Math.round(performance.now()-t0);
  out.push("full:"+(S.log.length>=S.settings.teams*S.settings.roster-1?"OK":"BAD(log="+S.log.length+")"));
  out.push("mine:"+(myIds().length===S.settings.roster?"OK":"BAD("+myIds().length+")"));
  const c={QB:0,RB:0,WR:0,TE:0,DEF:0};
  myIds().forEach(id=>{const p=idIndex()[id]; if(p)c[p.pos]++;});
  out.push("legal:"+((c.QB>=2&&c.RB>=3&&c.WR>=3&&c.TE>=1&&c.DEF>=1)?"OK":"BAD("+JSON.stringify(c)+")"));
  out.push("time:"+(dt<25000?"OK("+dt+"ms)":"SLOW("+dt+"ms)"));
  renderNow();
  out.push("hq:"+(document.getElementById("hero").innerHTML.includes("SEASON HQ")?"OK":"BAD"));
  out.push("confetti:"+(window._celebrated?"OK":"BAD"));

  renderBoard();
  out.push("board:"+(document.querySelectorAll("#boardGrid td[data-cellpick]").length>=190?"OK":"BAD("+document.querySelectorAll("#boardGrid td[data-cellpick]").length+")"));
  const st = quickStandings();
  out.push("standings:"+(st.rows.length===12 && st.rows.every(r=>r.pts>0)?"OK":"BAD"));
} catch(e){ out.push("ERR:"+e.message); }
setTimeout(()=>{
  out.push("report:"+(document.getElementById("reportBody").innerHTML.includes("Draft awards")?"OK":"BAD"));
  const errs = (window._errLog||[]).length;
  out.push("errors:"+(errs===0?"OK":"BAD("+errs+":"+(window._errLog[0]||{}).m+")"));
  document.title = "MARA|"+out.join("|");
}, 1600);
}, 150); });
</scr`+`ipt>`;
const i = html.lastIndexOf("</body>");
writeFileSync(new URL("../marathon.html", import.meta.url), html.slice(0, i) + test + html.slice(i));
console.log("marathon.html written");
