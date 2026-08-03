/* Draft War Room · wire: delegated events, buttons, settings, palette, sync, IO. */
/* ---------- Events (delegated) ---------- */
document.addEventListener("click", e=>{
  window._acts = window._acts || [];
  const t = e.target.closest("[data-pick],[data-take],[data-drop],[data-untake],[data-edit],[data-pos],[data-undoentry],[data-picksync],[data-note],[data-dnd],[data-clearfilters],[data-preset],[data-presetsave],[data-tiersort],[data-runseed],[data-abseed],[data-card],[data-cardtab],[data-boost],[data-fade],[data-adpedit],[data-tierup],[data-tierdn],[data-onepager],[data-cardpng],[data-unpickpre],[data-cmpfrom],[data-pin],[data-slotname],[data-cellpick],[data-voicenote],[data-notetpl],[data-keeper],[data-queue],[data-qup],[data-qfill],[data-plan],[data-unplan],[data-plantoggle],[data-planqueue],[data-qround],[data-qdn],[data-showall],[data-simto],[data-horn],[data-siren],#tradeGo,#matrixCopy,#nickGen,#logMineBtn,#logCsvBtn,#undo5Btn,th[data-sort]");
  if(!t){
    const rowEl = e.target.closest("#poolBody tr[data-pid]");
    if(rowEl){
      const all2 = [...document.querySelectorAll("#poolBody tr[data-pid]")];
      const idx2 = all2.indexOf(rowEl);
      if(e.shiftKey && kbSel>=0 && idx2!==kbSel){
        const [a2,b2] = [Math.min(kbSel,idx2), Math.max(kbSel,idx2)];
        const ids2 = all2.slice(a2,b2+1).map(x=>x.dataset.pid).filter(id2=>!offBoard(id2));
        if(ids2.length && confirm("Mark "+ids2.length+" players as TAKEN?")){
          ids2.forEach(id2=>{ redoStack.length=0; S.taken[id2]=true; S.log.push({id:id2, who:"other", t:Date.now()}); });
          pruneQueue(); _memo={key:null}; commit();
          toast("✕ Bulk: "+ids2.length+" marked taken");
        }
        return;
      }
      kbSel = idx2;
      applyKbSel();
    }
    return;
  }
  {
    const dk = Object.keys(t.dataset||{})[0] || t.id || "";
    if(dk){ window._acts.push(dk+"@"+new Date().toISOString().slice(11,19)); if(window._acts.length>50) window._acts.shift(); }
  }
  if(t.dataset.picksync){
    const v = prompt("Which overall pick is on the clock right now? (board thinks it's #"+pickNow()+")", pickNow());
    if(v===null) return;
    const n = parseInt(v,10);
    if(!isNaN(n) && n>=1){ S.pickOffset = n - 1 - S.log.length; commit(); }
    return;
  }
  if(t.dataset.slotname){
    const s = t.dataset.slotname;
    const v = prompt("Team name for draft slot "+s+":", slotName(s));
    if(v===null) return;
    S.slotNames[s] = v.trim() || ("T"+s);
    save(); renderBoard(); return;
  }
  if(t.id==="tradeGo"){ return tradeEval(); }
  if(t.id==="matrixCopy"){ navigator.clipboard.writeText(window._matrixTxt||"").then(()=>toast("📋 Matrix copied")); return; }
  if(t.dataset.teampage){ return openTeamPage(+t.dataset.teampage); }
  if(t.dataset.cellpick){
    const n = +t.dataset.cellpick, li = n-1-(S.pickOffset||0);
    const e2 = S.log[li]; if(!e2) return;
    const cur = idIndex()[e2.id];
    const v = prompt("Pick "+n+" is "+(cur?cur.name:"?")+".\nType the correct player (or 'trade 5' to give this pick to slot 5):", "");
    if(!v) return;
    const tm2 = v.match(/^trade\s+(\d+)$/i);
    if(tm2){ S.pickOwner[n] = +tm2[1]; commit(); renderBoard(); return toast("Pick "+n+" now belongs to "+esc(slotName(+tm2[1]))); }
    const found = allPlayers().find(p2=>nq(p2.name)===nq(v)) || (v.length>=4 ? allPlayers().find(p2=>nq(p2.name).includes(nq(v))) : null);
    if(!found) return toast("No match for '"+esc(v)+"'", {warn:true});
    if(offBoard(found.id) && found.id!==e2.id) return toast(esc(found.name)+" is already on the board", {warn:true});
    if(e2.who==="me"){ S.mine = S.mine.map(x=>x===e2.id?found.id:x); }
    else { delete S.taken[e2.id]; S.taken[found.id]=true; }
    e2.id = found.id;
    _memo={key:null}; commit(); renderBoard();
    return toast("Pick "+n+" corrected to "+esc(found.name));
  }
  if(t.id==="nickGen"){
    const adj = ["Iron","Turbo","Cosmic","Grumpy","Electric","Sneaky","Mighty","Haunted","Golden","Feral","Quantum","Soggy"];
    const noun = ["Bison","Wizards","Goblins","Freight Train","Spreadsheet","Tailgate","Vandals","Casserole","Monarchs","Stampede","Syndicate","Waffles"];
    const hash = s => { let x=7; for(const ch of s) x = (x*31 + ch.charCodeAt(0))>>>0; return x; };
    const out = document.getElementById("randOut");
    out.innerHTML = Array.from({length:S.settings.teams},(_,i)=>i+1).map(s2=>{
      const hsh = hash(slotName(s2)+Date.now().toString().slice(-3));
      return '<div>'+esc(slotName(s2))+' → <b>'+adj[hsh%adj.length]+' '+noun[(hsh>>4)%noun.length]+'</b></div>';
    }).join("");
    return;
  }
  if(t.id==="randOrder"){
    const t2 = S.settings.teams;
    const order = Array.from({length:t2},(_,i)=>i+1).sort(()=>Math.random()-0.5);
    const out = document.getElementById("randOut");
    out.innerHTML = "";
    order.forEach((s2,i)=>setTimeout(()=>{
      out.innerHTML += (i+1)+". <b>"+esc(slotName(s2))+"</b>"+(i<order.length-1?" &nbsp;·&nbsp; ":"");
    }, i*350));
    return;
  }
  if(t.id==="copyResults"){
    const byId2 = idIndex(), t2 = S.settings.teams;
    let txt = "🏈 "+(S.settings.name||"Draft")+" results\n";
    S.log.forEach((e,i)=>{
      const p2 = byId2[e.id]; if(!p2) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/t2), idx = n-(r2-1)*t2, slot = (r2%2===1)?idx:t2+1-idx;
      if(idx===1) txt += "\n— Round "+r2+" —\n";
      txt += r2+"."+String(idx).padStart(2,"0")+" "+slotName(slot)+": "+p2.name+" ("+p2.pos+" "+p2.team+")\n";
    });
    navigator.clipboard.writeText(txt).then(()=>toast("📋 Results copied ("+S.log.length+" picks)"));
    return;
  }
  if(t.dataset.card){ if(t.dataset.tabpre) window._cardTab = t.dataset.tabpre; return openCard(t.dataset.card); }
  if(t.dataset.keeper){
    const id = t.dataset.keeper;
    if(S.keepers[id]) delete S.keepers[id];
    else {
      const v = prompt("Keeper for which draft slot? (1-"+S.settings.teams+", you are "+S.settings.slot+")", S.settings.slot);
      if(v===null) return;
      const s2 = parseInt(v,10);
      if(isNaN(s2) || s2<1 || s2>S.settings.teams) return toast("Bad slot", {warn:true});
      const rc = prompt("Which round does this keeper cost? (0 = free)", "0");
      S.keepers[id] = {s:s2, r:Math.max(0, parseInt(rc,10)||0)};
    }
    $("#cardOverlay").classList.remove("show");
    return commit();
  }
  if(t.dataset.queue){ $("#cardOverlay").classList.remove("show"); return toggleQueue(t.dataset.queue); }
  if(t.dataset.qfill){
    const {scored} = scoreBoard();
    scored.slice(0,8).forEach(s=>{ if(!S.queue.includes(s.p.id)) S.queue.push(s.p.id); });
    commit(); return;
  }
  if(t.dataset.qround){
    const id = t.dataset.qround;
    const v = prompt("Want him by which round? (blank clears)", (S.queueRounds||{})[id]||"");
    if(v===null) return;
    if(v.trim()==="") delete S.queueRounds[id];
    else S.queueRounds[id] = Math.max(1, Math.min(S.settings.roster, parseInt(v,10)||1));
    return commit();
  }
  if(t.dataset.qup!=null){ const i=+t.dataset.qup; if(i>0){ [S.queue[i-1],S.queue[i]]=[S.queue[i],S.queue[i-1]]; commit(); } return; }
  if(t.dataset.qdn!=null){ const i=+t.dataset.qdn; if(i<S.queue.length-1){ [S.queue[i+1],S.queue[i]]=[S.queue[i],S.queue[i+1]]; commit(); } return; }
  if(t.dataset.showall){ window._showAllRows = true; renderPool(); return; }
  // (scroll listener also extends the window)
  if(t.dataset.simto){ return simToMyPick(); }
  if(t.dataset.horn){ return stinger("horn"); }
  if(t.dataset.siren){ return stinger("siren"); }
  if(t.id==="undo5Btn"){ undoLastN(5); return; }
  if(t.id==="logMineBtn"){ logMineOnly = !logMineOnly; t.classList.toggle("on", logMineOnly); renderLog(); return; }
  if(t.id==="logCsvBtn"){ return exportLogCsv(); }
  if(t.dataset.cardtab){ window._cardTab = t.dataset.cardtab; return openCard(t.dataset.cardid); }
  if(t.dataset.boost){
    const id = t.dataset.boost;
    const prev = S.boost[id]||0;
    S.boost[id] = prev===1 ? 0 : 1;
    commit(); toast((S.boost[id]?"▲ boosted":"boost cleared"), {undo:()=>{ S.boost[id]=prev; commit(); }});
    window._cardTab="intel"; return openCard(id);
  }
  if(t.dataset.fade){
    const id = t.dataset.fade;
    const prev = S.boost[id]||0;
    S.boost[id] = prev===-1 ? 0 : -1;
    commit(); toast((S.boost[id]?"▼ faded":"fade cleared"), {undo:()=>{ S.boost[id]=prev; commit(); }});
    window._cardTab="intel"; return openCard(id);
  }
  if(t.dataset.adpedit){
    const id = t.dataset.adpedit, p = idIndex()[id];
    const v = prompt("Manual ADP for "+p.name+" (blank = restore source):", p.adp||"");
    if(v===null) return;
    if(v.trim()==="") delete S.adpOverride[id]; else S.adpOverride[id] = Math.max(1, parseInt(v,10)||p.adp);
    commit(); window._cardTab="intel"; return openCard(id);
  }
  if(t.dataset.tierup){ const id=t.dataset.tierup; S.tierBump[id]=(S.tierBump[id]||0)+1; commit(); window._cardTab="intel"; return openCard(id); }
  if(t.dataset.tierdn){ const id=t.dataset.tierdn; S.tierBump[id]=(S.tierBump[id]||0)-1; commit(); window._cardTab="intel"; return openCard(id); }
  if(t.dataset.plan){
    const id = t.dataset.plan;
    const v = prompt("Pin to which of YOUR rounds? (1-"+S.settings.roster+", blank clears)", "");
    if(v===null) return;
    for(const r in S.plan) if(S.plan[r]===id) delete S.plan[r];
    const r2 = parseInt(v,10);
    if(!isNaN(r2) && r2>=1 && r2<=S.settings.roster) S.plan[r2] = id;
    $("#cardOverlay").classList.remove("show");
    return commit();
  }
  if(t.dataset.unplan){ delete S.plan[t.dataset.unplan]; return commit(); }
  if(t.dataset.plantoggle){ window._planCollapsed = !window._planCollapsed; renderPlan(); return; }
  if(t.dataset.planqueue){
    pruneQueue();
    const mine = myOverallPicks(), cur = pickNow();
    const rounds = mine.filter(x=>x>=cur).map(x=>Math.ceil(x/S.settings.teams));
    S.plan = {};
    S.queue.forEach((id,i)=>{ if(rounds[i]) S.plan[rounds[i]] = id; });
    return commit();
  }
  if(t.dataset.cardpng){
    const p = idIndex()[t.dataset.cardpng]; if(!p) return;
    const c = document.createElement("canvas");
    c.width = 640; c.height = 360;
    const x = c.getContext("2d");
    x.fillStyle = "#0b0f14"; x.fillRect(0,0,640,360);
    x.fillStyle = "#2fd47a"; x.font = "bold 30px sans-serif"; x.fillText(p.name, 28, 54);
    x.fillStyle = "#8ba0bc"; x.font = "15px sans-serif";
    x.fillText(p.pos+" · "+p.team+" · proj "+p.proj+" · ADP "+(p.adp||"—"), 28, 84);
    x.fillStyle = "#e8eef7"; x.font = "14px sans-serif";
    const words = storyOf(p).split(" ");
    let line = "", yy = 130;
    words.forEach(w=>{
      if((line+w).length > 62){ x.fillText(line, 28, yy); yy += 24; line = ""; }
      line += w+" ";
    });
    x.fillText(line, 28, yy);
    hist3For(p).forEach((hrow,i)=>{
      x.fillStyle = "#2fd47a";
      x.fillRect(28, 250+i*26, Math.min(560, hrow[2]*1.2), 14);
      x.fillStyle = "#8ba0bc"; x.fillText(hrow[0]+"  "+hrow[2], 30+Math.min(560, hrow[2]*1.2)+8, 262+i*26);
    });
    c.toBlob(b=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=p.name.replace(/\s+/g,"-")+".png"; a.click(); URL.revokeObjectURL(a.href); });
    return;
  }
  if(t.dataset.onepager){
    const id = t.dataset.onepager, p = idIndex()[id];
    const h3 = hist3For(p);
    const txt = p.name+" ("+p.pos+" "+p.team+")\n"+storyOf(p)+"\n"+
      (h3.length?"Seasons: "+h3.map(x=>x[0]+": "+x[2]+" pts ("+p.pos+x[3]+")").join(" · ")+"\n":"")+
      "2026 projection: "+p.proj+" · ADP "+(p.adp||"—");
    navigator.clipboard.writeText(txt).then(()=>toast("📋 One-pager copied"));
    return;
  }
  if(t.dataset.unpickpre){
    const id = t.dataset.unpickpre, byId2 = idIndex();
    const with2 = bestStarters(myIds(), byId2).pts;
    const without = bestStarters(myIds().filter(x=>x!==id), byId2).pts;
    toast("Without "+esc(byId2[id].name)+": lineup drops <b>"+Math.round(with2-without)+"</b> pts");
    return;
  }
  if(t.dataset.pin){
    window._pinned = window._pinned===t.dataset.pin ? null : t.dataset.pin;
    toast(window._pinned ? "📌 Pinned "+esc(idIndex()[window._pinned].name)+" — hover any player for the delta" : "Pin cleared");
    $("#cardOverlay").classList.remove("show");
    return;
  }
  if(t.dataset.cmpfrom){
    const p = idIndex()[t.dataset.cmpfrom]; if(!p) return;
    $("#cardOverlay").classList.remove("show");
    if(!$("#playersDL").children.length) fillPlayersDL();
    $("#cmpA").value = p.name; $("#cmpB").value = "";
    $("#cmpOverlay").classList.add("show");
    renderCompare(); $("#cmpB").focus();
    return;
  }
  if(t.dataset.voicenote){
    try{
      const R = new webkitSpeechRecognition();
      R.lang = "en-US";
      toast("🎤 Listening…");
      R.onresult = ev=>{
        const txt = ev.results[0][0].transcript;
        S.notes[t.dataset.voicenote] = ((S.notes[t.dataset.voicenote]||"")+" "+txt).trim();
        commit(); toast("📝 Heard: "+esc(txt));
      };
      R.onerror = ()=>toast("Mic unavailable", {warn:true});
      R.start();
    }catch(e){ toast("Voice notes unsupported here", {warn:true}); }
    return;
  }
  if(t.dataset.notetpl){
    const pickT = prompt("Template: 1=🔗 handcuff  2=🎲 injury flier  3=😴 sleeper  4=🧊 avoid in first half", "1");
    const map = {1:"🔗 handcuff priority", 2:"🎲 injury flier — monitor camp", 3:"😴 sleeper — market is late", 4:"🧊 only after round 8"};
    if(pickT && map[pickT]){ S.notes[t.dataset.notetpl] = map[pickT]; commit(); }
    return;
  }
  if(t.dataset.note){
    editNote(t.dataset.note);
    if($("#cardOverlay").classList.contains("show")) openCard(t.dataset.note);
    return;
  }
  if(t.dataset.dnd){ S.dnd[t.dataset.dnd] ? delete S.dnd[t.dataset.dnd] : S.dnd[t.dataset.dnd]=true; return commit(); }
  if(t.dataset.presetsave){
    const nm2 = prompt("Preset name:", "my view");
    if(!nm2) return;
    S.filterPresets = S.filterPresets || {};
    S.filterPresets[nm2] = {pos:S.ui.pos, round:S.ui.round, targetsOnly:S.ui.targetsOnly, stacksOnly:S.ui.stacksOnly,
      survivors:S.ui.survivors, fallers:S.ui.fallers, hideHurt:S.ui.hideHurt, q:$("#search").value};
    return commit();
  }
  if(t.dataset.preset){
    const pz = (S.filterPresets||{})[t.dataset.preset];
    if(!pz) return;
    Object.assign(S.ui, {pos:pz.pos, round:pz.round, targetsOnly:pz.targetsOnly, stacksOnly:pz.stacksOnly,
      survivors:pz.survivors, fallers:pz.fallers, hideHurt:pz.hideHurt});
    $("#search").value = pz.q||"";
    $("#roundFilter").value = pz.round||"ALL";
    $("#fTargets").checked=!!pz.targetsOnly; $("#fStacks").checked=!!pz.stacksOnly;
    $("#fSurvive").checked=!!pz.survivors; $("#fFallers").checked=!!pz.fallers; $("#fHideHurt").checked=!!pz.hideHurt;
    save(); renderTabs(); renderPool(); return;
  }
  if(t.dataset.runseed){
    const v2 = document.getElementById("mockSeedIn").value.trim();
    renderMocks(v2 ? +v2 : window._mockSeed);
    return;
  }
  if(t.dataset.abseed){
    const v2 = +document.getElementById("mockSeedIn").value.trim();
    if(!v2) return toast("Enter a seed to compare against", {warn:true});
    const A2 = runMock(STRATS[0], window._mockSeed), B2 = runMock(STRATS[0], v2);
    const diff = A2.picks.filter((pk,i2)=>!B2.picks[i2] || B2.picks[i2].p.id!==pk.p.id).length;
    toast("🧪 A/B: seed "+window._mockSeed+" → "+A2.startPts+" pts vs seed "+v2+" → "+B2.startPts+" pts · "+diff+" picks differ");
    return;
  }
  if(t.dataset.tiersort){ S.ui.sort="tiergroup"; S.ui.dir=1; save(); renderPool(); return; }
  if(t.dataset.clearfilters){
    S.ui.pos="ALL"; S.ui.round="ALL"; S.ui.targetsOnly=false; S.ui.stacksOnly=false; S.ui.survivors=false; S.ui.fallers=false; S.ui.showTaken=false;
    $("#search").value=""; $("#roundFilter").value="ALL";
    S.ui.hideHurt=false;
    ["fTargets","fStacks","fSurvive","fFallers","fHideHurt","showTaken"].forEach(id=>$("#"+id).checked=false);
    save(); renderTabs(); renderPool(); return;
  }
  if(t.dataset.pick){ $("#cardOverlay").classList.remove("show"); return pickMine(t.dataset.pick); }
  if(t.dataset.take){ $("#cardOverlay").classList.remove("show"); return markTaken(t.dataset.take); }
  if(t.dataset.untake){ delete S.taken[t.dataset.untake]; for(let i=S.log.length-1;i>=0;i--){if(S.log[i].id===t.dataset.untake&&S.log[i].who==="other"){S.log.splice(i,1);break;}} return commit(); }
  if(t.dataset.drop) return dropMine(t.dataset.drop);
  if(t.dataset.edit) return editProj(t.dataset.edit);
  if(t.dataset.undoentry!=null) return undoEntry(+t.dataset.undoentry);
  if(t.dataset.pos){
    S.ui.sortByTab = S.ui.sortByTab || {};
    S.ui.sortByTab[S.ui.pos] = {key:S.ui.sort, dir:S.ui.dir};
    S.ui.pos = t.dataset.pos;
    const remembered = S.ui.sortByTab[S.ui.pos];
    if(remembered){ S.ui.sort = remembered.key; S.ui.dir = remembered.dir; }
    save(); renderTabs(); renderPool(); return;
  }
  if(t.dataset.sort){
    if(S.ui.sort===t.dataset.sort) S.ui.dir*=-1; else { S.ui.sort=t.dataset.sort; S.ui.dir = (["name","team","pos","adp"].includes(t.dataset.sort))?1:-1; }
    save(); renderPool();
  }
});
/* interval/listener registry (#426): every timer registered for leak sweeps */
window.__timers = window.__timers || [];
const _origSetInterval = window.setInterval;
window.setInterval = function(fn, ms){ const id = _origSetInterval(fn, ms); window.__timers.push({id, ms}); return id; };

document.addEventListener("input", e=>{
  if(e.target && e.target.id==="logSearch"){ window._logQ = e.target.value; renderLog(); }
});
let searchTimer=null;
$("#search").addEventListener("input", ()=>{ clearTimeout(searchTimer); searchTimer=setTimeout(renderPool, 120); });
$("#showTaken").addEventListener("change", e=>{ S.ui.showTaken=e.target.checked; save(); renderPool(); });
$("#roundFilter").addEventListener("change", e=>{ S.ui.round=e.target.value; save(); renderPool(); });
$("#fTargets").addEventListener("change", e=>{ S.ui.targetsOnly=e.target.checked; save(); renderPool(); });
$("#fStacks").addEventListener("change", e=>{ S.ui.stacksOnly=e.target.checked; save(); renderPool(); });
$("#fSurvive").addEventListener("change", e=>{ S.ui.survivors=e.target.checked; save(); renderPool(); });
$("#fFallers").addEventListener("change", e=>{ S.ui.fallers=e.target.checked; save(); renderPool(); });
$("#fHideHurt").addEventListener("change", e=>{ S.ui.hideHurt=e.target.checked; save(); renderPool(); });
$("#undoBtn").addEventListener("click", undoLast);
$("#redoBtn").addEventListener("click", redoLast);
document.addEventListener("keydown", e=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){ e.preventDefault(); openPalette(); return; }
  if((e.ctrlKey||e.metaKey) && (e.key==="y" || (e.shiftKey && e.key.toLowerCase()==="z"))){ e.preventDefault(); redoLast(); return; }
  if((e.ctrlKey||e.metaKey) && e.key==="z"){ e.preventDefault(); undoLast(); return; }
  if(e.key==="Enter"){
    const ae = document.activeElement;
    if(ae && ae.dataset && (ae.dataset.drop!=null || ae.dataset.undoentry!=null || ae.dataset.cellpick!=null || (ae.tagName==="TH" && ae.dataset.sort))){ e.preventDefault(); ae.click(); return; }
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if(e.key==="/" && !typing){ e.preventDefault(); $("#search").focus(); return; }
  if(e.key==="?" && !typing){ e.preventDefault(); $("#helpOverlay").classList.toggle("show"); return; }
  if(e.key==="Tab"){
    const ov = document.querySelector(".overlay.show");
    if(ov){
      const f = [...ov.querySelectorAll("button,input,select,textarea,a[href],[tabindex='0']")].filter(x=>!x.disabled && x.offsetParent!==null);
      if(f.length){
        const first = f[0], last = f[f.length-1];
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      }
    }
  }
  if(e.key==="Escape"){
    const ov = document.querySelector(".overlay.show");
    if(ov){
      ov.classList.remove("show");
      if(window._modalOpener && window._modalOpener.focus){ window._modalOpener.focus(); window._modalOpener = null; }
      return;
    }
    if(typing) document.activeElement.blur();
    else { kbSel=-1; applyKbSel(); }
    return;
  }
  if(typing || document.querySelector(".overlay.show")) return;
  const trs = document.querySelectorAll("#poolBody tr[data-pid]");
  if(e.key==="ArrowDown"){ e.preventDefault(); kbSel=Math.min(kbSel+1, trs.length-1); applyKbSel(); return; }
  if(e.key==="ArrowUp"){ e.preventDefault(); kbSel=Math.max(kbSel-1, 0); applyKbSel(); return; }
  if(kbSel>=0 && trs[kbSel]){
    const id = trs[kbSel].dataset.pid;
    if(!id) return;
    const k = e.key.toLowerCase();
    const KB = S.settings.keys||{mine:"m",taken:"t",queue:"q"};
    if(k===KB.mine){ e.preventDefault(); if(!S.mine.includes(id)) pickMine(id); }
    if(k===KB.taken||k==="x"){ e.preventDefault(); if(!S.taken[id] && !S.mine.includes(id)) markTaken(id); }
    if(k==="d"){ e.preventDefault(); S.dnd[id] ? delete S.dnd[id] : S.dnd[id]=true; commit(); }
    if(k==="n"){ e.preventDefault(); editNote(id); }
    if(k===(S.settings.keys||{}).queue || k==="q"){ e.preventDefault(); toggleQueue(id); return; }
  }
  if(e.key.toLowerCase()==="p" && S.ui.live && !e.ctrlKey && !e.metaKey){
    const h3 = nextPickHorizon();
    if(h3 && h3.onClock){
      const {scored} = scoreBoard();
      pruneQueue();
      const qTop = S.queue.length ? S.queue[0] : null;
      const pk2 = qTop || (scored[0] && scored[0].p.id);
      if(pk2){ e.preventDefault(); pickMine(pk2); return; }
    }
  }
  if(/^[1-9]$/.test(e.key) && S.ui.live){
    const {scored} = scoreBoard();
    const s = scored[+e.key-1];
    if(s){ e.preventDefault(); pickMine(s.p.id); }
    return;
  }
  if(kbSel>=0 && trs[kbSel]){
    const id = trs[kbSel].dataset.pid;
    if(!id) return;
    const k = e.key.toLowerCase();
    if(k==="c"){
      e.preventDefault();
      const p = idIndex()[id]; if(!p) return;
      if(!document.getElementById("playersDL").children.length) fillPlayersDL();
      const a = document.getElementById("cmpA"), b = document.getElementById("cmpB");
      if(!a.value || (a.value && b.value)) { a.value = p.name; b.value = ""; } else b.value = p.name;
      document.getElementById("cmpOverlay").classList.add("show");
      renderCompare();
    }
  }
});

/* Compare modal */
function fillPlayersDL(){
  $("#playersDL").innerHTML = allPlayers().map(p=>'<option value="'+esc(p.name)+'">'+p.pos+' · '+p.team+'</option>').join("");
}
$("#cmpBtn").addEventListener("click", ()=>{
  if(!$("#playersDL").children.length) fillPlayersDL();
  $("#cmpOverlay").classList.add("show"); $("#cmpA").focus();
});
$("#cmpClose").addEventListener("click", ()=>$("#cmpOverlay").classList.remove("show"));
$("#cmpA").addEventListener("input", renderCompare);
$("#cmpB").addEventListener("input", renderCompare);

/* Roster recap to clipboard */
$("#recapBtn").addEventListener("click", ()=>{
  const byId = idIndex();
  if(!S.mine.length) return toast("Nothing drafted yet", {warn:true});
  const bs = bestStarters(S.mine, byId);
  let txt = "🏈 "+(S.settings.name||"My league")+" — my draft (slot "+S.settings.slot+")\n";
  bs.line.forEach(sl=>{ txt += sl.lab.padEnd(5)+" "+(sl.p ? sl.p.name+" ("+sl.p.team+", "+sl.p.proj+")" : "—")+"\n"; });
  const bench = S.mine.filter(id=>!bs.starterIds.has(id)).map(id=>byId[id]).filter(Boolean);
  if(bench.length) txt += "BENCH "+bench.map(p=>p.name).join(", ")+"\n";
  txt += "Projected starters: "+Math.round(bs.pts)+" pts";
  navigator.clipboard.writeText(txt).then(()=>toast("📤 Roster copied — paste it in the chat"), ()=>toast("Copy failed", {warn:true}));
});

/* Draft grade + full report (#51) */
let _reportText = "";
function buildReport(){
  const g = gradeDraft();
  const byId = idIndex();
  const col = g.letter[0]==="A" ? "var(--green)" : g.letter[0]==="B" ? "var(--gold)" : "var(--red)";
  const bs = S.mine.length ? bestStarters(S.mine, byId) : null;
  // steals: my picks made 10+ past ADP
  const steals = [];
  S.log.forEach((e,i)=>{
    if(e.who!=="me") return;
    const p = byId[e.id]; if(!p || !p.adp) return;
    const overall = i+1+(S.pickOffset||0);
    if(overall - p.adp >= 10) steals.push({p, fall: overall - p.adp});
  });
  // stacks
  const teams = {};
  S.mine.forEach(id=>{ const p=byId[id]; if(p) (teams[p.team]=teams[p.team]||[]).push(p); });
  const stacks = Object.entries(teams).filter(([,ps])=>ps.some(x=>x.pos==="QB") && ps.some(x=>x.pos==="WR"||x.pos==="TE"));
  let h = '<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">'+
    '<span style="font-size:44px;font-weight:800;color:'+col+'">'+g.letter+'</span>'+
    '<span style="font-size:12.5px;line-height:1.6">Projected optimal starters if you finish on autopilot: <b class="mono">'+g.myPts+'</b><br>'+
    'Expected from slot '+S.settings.slot+': <b class="mono">'+g.basePts+'</b> → <b style="color:'+col+'">'+(g.diff>=0?'+':'')+g.diff+' pts</b></span></div>';
  let txt = "🎓 "+(S.settings.name||"League")+" draft report — grade "+g.letter+" ("+(g.diff>=0?"+":"")+g.diff+" vs expected)\n";
  if(bs){
    h += '<div class="sechead">Current lineup</div>' + bs.line.map(sl=> sl.p ?
      '<div class="mkrow strt"><span class="rp mono">'+sl.lab+'</span>'+(logoUrl(sl.p.team)?'<img class="tlogo" src="'+logoUrl(sl.p.team)+'" width="12" height="12" alt=""> ':'')+'<span class="mpos pos '+sl.p.pos+'">'+sl.p.pos+'</span><span class="mn">'+sl.p.name+' <span class="dimtxt mono">'+sl.p.proj+'</span></span></div>'
      : '<div class="mkrow bench"><span class="rp mono">'+sl.lab+'</span><span class="mn dimtxt">— open</span></div>').join("");
    bs.line.forEach(sl=>{ if(sl.p) txt += sl.lab.padEnd(5)+" "+sl.p.name+" ("+sl.p.team+")\n"; });
  }
  {
    const bench2 = myIds().filter(id2=>bs && !bs.starterIds.has(id2)).map(id2=>byId[id2]).filter(Boolean);
    if(bench2.length){
      h += '<div class="sechead">Bench upside</div>'+bench2.map(p2=>{
        const m2 = metaFor(p2), tags = [];
        if(m2 && m2[1]===0) tags.push("🎓 rookie");
        if(p2.intel && p2.intel.t!=null) tags.push("⭐ target");
        if(buzzOf(p2)>1000) tags.push("📈 trending");
        return '<div class="mkrow"><span class="mpos pos '+p2.pos+'">'+p2.pos+'</span><span class="mn">'+esc(p2.name)+(tags.length?' <span class="dimtxt">'+tags.join(" · ")+'</span>':'')+'</span></div>';
      }).join("");
    }
  }
  // analyst target capture (#247)
  {
    const got = myIds().map(id2=>byId[id2]).filter(Boolean).filter(p2=>p2.intel && p2.intel.t!=null);
    {
    const planned = Object.entries(S.plan||{});
    if(planned.length){
      const hits = planned.filter(([,id2])=>S.mine.includes(id2)).length;
      h += '<div class="sechead">Plan execution</div><div class="mkrow"><span class="mn">📌 '+hits+' of '+planned.length+' pinned targets landed ('+Math.round(100*hits/planned.length)+'%)</span></div>';
    }
  }
  h += '<div class="sechead">Analyst targets landed</div><div class="mkrow" style="white-space:normal"><span class="mn">'+
      (got.length? '⭐ '+got.length+' — '+got.map(p2=>p2.name.split(" ").slice(-1)[0]).join(", ") : "None yet — the board disagreed with the experts.")+'</span></div>';
  }
  // roster age + volatility (#280/#281)
  if(bs){
    const ages = bs.line.filter(sl=>sl.p).map(sl=>({p:sl.p, a:(metaFor(sl.p)||[])[0]||0})).filter(x=>x.a);
    if(ages.length){
      const avg2 = ages.reduce((a,x)=>a+x.a,0)/ages.length;
      const old = ages.sort((a,b)=>b.a-a.a)[0], young = ages[ages.length-1];
      const vols = bs.line.filter(sl=>sl.p).map(sl=>consistencyOf(sl.p)).filter(Boolean);
      const boomy = vols.filter(v=>v.label==="boom-bust").length;
      h += '<div class="sechead">Roster profile</div><div class="mkrow" style="white-space:normal"><span class="mn">'+
        'Avg starter age <b>'+avg2.toFixed(1)+'</b> · oldest '+esc(old.p.name.split(" ").slice(-1)[0])+' ('+old.a+') · youngest '+esc(young.p.name.split(" ").slice(-1)[0])+' ('+young.a+')'+
        (vols.length?' · volatility: '+boomy+'/'+vols.length+' boom-bust starters':'')+'</span></div>';
    }
    // archetype (#287)
    const first4 = S.log.filter(e=>e.who==="me").slice(0,4).map(e=>byId[e.id]).filter(Boolean);
    if(first4.length>=3){
      const rb = first4.filter(p2=>p2.pos==="RB").length;
      const arch = rb===0 ? "Zero-RB" : rb===1 ? "Hero-RB" : rb>=3 ? "Robust-RB" : "Balanced";
      h += '<div class="mkrow"><span class="mn">🏗 Build archetype: <b>'+arch+'</b> ('+first4.map(p2=>p2.pos).join("-")+' open)</span></div>';
    }
  }
  // keeper surplus (#235)
  {
    const ks = Object.keys(S.keepers||{}).filter(id2=>byId[id2]);
    if(ks.length){
      const curve = pickValueCurve(), t2 = S.settings.teams;
      h += '<div class="sechead">Keeper value</div>'+ks.map(id2=>{
        const p2 = byId[id2], k2 = S.keepers[id2];
        const rr = k2.r||0;
        const cost = rr>0 ? (curve[Math.min(curve.length-1,(rr-1)*t2+Math.floor(t2/2))]||0) : 0;
        const repl2 = replacementLevels(allPlayers());
        const surplus = Math.round((p2.proj-(repl2[p2.pos]||0)) - cost);
        return '<div class="mkrow"><span class="mn">👑 '+esc(p2.name)+' ('+esc(slotName(k2.s!=null?k2.s:k2))+(rr?', costs R'+rr:', free')+') → surplus <b style="color:'+(surplus>=0?'var(--green)':'var(--red)')+'">'+(surplus>0?'+':'')+surplus+'</b></span></div>';
      }).join("");
    }
  }
  // hindsight (#245) — replay the log, greedy-pick at each of my slots
  if(S.log.length >= S.settings.teams){
    const players2 = allPlayers(), repl2 = replacementLevels(players2);
    const vorpOf = p2 => p2.proj-(repl2[p2.pos]||0);
    const myPicksSet = new Set(myOverallPicks());
    const gone = new Set();
    let ideal = 0, actual = 0;
    S.log.forEach((e,i)=>{
      const n = i+1+(S.pickOffset||0);
      if(myPicksSet.has(n)){
        const bestNow = players2.filter(p2=>!gone.has(p2.id)).sort((a,b)=>vorpOf(b)-vorpOf(a))[0];
        if(bestNow) ideal += Math.max(0, vorpOf(bestNow));
        const mineP = byId[e.id];
        if(mineP) actual += Math.max(0, vorpOf(mineP));
      }
      gone.add(e.id);
    });
    if(ideal>0){
      const eff = Math.round(actual/ideal*100);
      h += '<div class="sechead">Hindsight</div><div class="mkrow"><span class="mn">🔭 You captured <b>'+eff+'%</b> of the perfect-hindsight value at your picks ('+Math.round(actual)+' of '+Math.round(ideal)+').</span></div>';
    }
  }
  // exposure across saved boards (#282)
  {
    const all2 = profAll(), names = Object.keys(all2);
    if(names.length>=2){
      const cnt2 = {};
      names.forEach(nm2=>{ (all2[nm2].mine||[]).forEach(id2=>cnt2[id2]=(cnt2[id2]||0)+1); });
      const multi = Object.entries(cnt2).filter(([,c2])=>c2>=2).map(([id2,c2])=>({p:byId[id2], c:c2})).filter(x=>x.p)
        .sort((a,b)=>b.c-a.c).slice(0,6);
      if(multi.length) h += '<div class="sechead">Exposure ('+names.length+' boards)</div><div class="mkrow" style="white-space:normal"><span class="mn">'+
        multi.map(x=>esc(x.p.name.split(" ").slice(-1)[0])+' ×'+x.c).join(" · ")+'</span></div>';
    }
  }
  h += '<div class="sechead">Stacks</div>' + (stacks.length
    ? stacks.map(([t,ps])=>{
        const pcs = ps.filter(x=>x.pos==="WR"||x.pos==="TE").length;
        return '<div class="mkrow">'+(logoUrl(t)?'<img class="tlogo" src="'+logoUrl(t)+'" width="13" height="13" alt=""> ':'')+'<span class="mn">🔗 '+t+' — '+ps.map(x=>x.name.split(" ").slice(-1)[0]).join(" + ")+(pcs>=2?' <b style="color:var(--gold)">DOUBLE STACK</b>':'')+'</span></div>';
      }).join("")
    : '<div class="dimtxt">None yet — pair a WR/TE with one of your QBs.</div>');
  if(stacks.length) txt += "Stacks: "+stacks.map(([t,ps])=>t+" ("+ps.map(x=>x.name.split(" ").slice(-1)[0]).join("+")+")").join(", ")+"\n";
  // round-by-round value captured
  const rv = {};
  let rvTotal = 0;
  {
    const players2 = allPlayers(), repl2 = replacementLevels(players2);
    S.log.forEach((e,i)=>{
      if(e.who!=="me") return;
      const p2 = byId[e.id]; if(!p2) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/S.settings.teams);
      const v = Math.round(p2.proj-(repl2[p2.pos]||0));
      rv[r2] = (rv[r2]||0)+v; rvTotal += v;
    });
  }
  if(Object.keys(rv).length){
    h += '<div class="sechead">Value by round</div><div class="mkrow" style="flex-wrap:wrap;white-space:normal">'+
      (()=>{ const bestR = Object.keys(rv).sort((a,b)=>rv[b]-rv[a])[0];
        return Object.keys(rv).sort((a,b)=>a-b).map(r2=>'<span class="mono" style="margin-right:10px">'+(r2===bestR?'🔥':'')+'R'+r2+' <b style="color:'+(rv[r2]>=60?'var(--green)':rv[r2]>=0?'var(--dim)':'var(--red)')+'">'+(rv[r2]>0?'+':'')+rv[r2]+'</b></span>').join(""); })()+
      ' <span class="mono">Σ <b>'+(rvTotal>0?'+':'')+rvTotal+'</b></span></div>';
  }
  // per-position delta vs sim baseline
  if(window._gradeBase && window._gradeBase.pos && S.mine.length){
    const bsNow = bestStarters(myIds(), byId);
    const mineByPos = {};
    bsNow.line.forEach(sl=>{ if(sl.p) mineByPos[sl.p.pos]=(mineByPos[sl.p.pos]||0)+sl.p.proj; });
    h += '<div class="sechead">Vs expected, by position</div><div class="mkrow" style="flex-wrap:wrap;white-space:normal">'+
      POSITIONS.map(pos=>{
        const d2 = Math.round((mineByPos[pos]||0)-(window._gradeBase.pos[pos]||0));
        return '<span class="mono" style="margin-right:10px">'+pos+' <b style="color:'+(d2>=15?'var(--green)':d2<=-15?'var(--red)':'var(--dim)')+'">'+(d2>0?'+':'')+d2+'</b></span>';
      }).join("")+'</div>';
  }
  // league-wide reaches & steals
  {
    const moves = [];
    S.log.forEach((e,i)=>{
      const p2 = byId[e.id]; if(!p2 || !p2.adp) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/S.settings.teams), idx = n-(r2-1)*S.settings.teams;
      const slot = (r2%2===1)?idx:S.settings.teams+1-idx;
      moves.push({p:p2, slot, d: n - p2.adp});
    });
    const reaches = moves.filter(m2=>m2.d<=-8).sort((a,b)=>a.d-b.d).slice(0,3);
    const steals2 = moves.filter(m2=>m2.d>=8).sort((a,b)=>b.d-a.d).slice(0,3);
    if(reaches.length || steals2.length){
      h += '<div class="sechead">League reaches & steals</div>'+
        reaches.map(m2=>'<div class="mkrow"><span class="mn">📈 '+esc(slotName(m2.slot))+' reached '+(-m2.d)+' for '+esc(m2.p.name)+'</span></div>').join("")+
        steals2.map(m2=>'<div class="mkrow"><span class="mn">💎 '+esc(slotName(m2.slot))+' stole '+esc(m2.p.name)+' ('+m2.d+' late)</span></div>').join("");
    }
  }
  // end-of-draft awards (#346)
  {
    const moves2 = [];
    S.log.forEach((e,i)=>{
      const p2 = byId[e.id]; if(!p2 || !p2.adp) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/S.settings.teams), idx = n-(r2-1)*S.settings.teams;
      const slot = (r2%2===1)?idx:S.settings.teams+1-idx;
      moves2.push({p:p2, slot, d:n-p2.adp, n});
    });
    if(moves2.length >= S.settings.teams*3){
      const bestVal = moves2.slice().sort((a,b)=>b.d-a.d)[0];
      const reach = moves2.slice().sort((a,b)=>a.d-b.d)[0];
      const lastPick = moves2[moves2.length-1];
      const dbl = stacks.find(([,ps2])=>ps2.filter(x=>x.pos==="WR"||x.pos==="TE").length>=2);
      h += '<div class="sechead">🏅 Draft awards</div>'+
        '<div class="mkrow"><span class="mn">💎 <b>Best Value</b>: '+esc(slotName(bestVal.slot))+' — '+esc(bestVal.p.name)+' ('+bestVal.d+' past ADP)</span></div>'+
        '<div class="mkrow"><span class="mn">🙈 <b>The Reach</b>: '+esc(slotName(reach.slot))+' — '+esc(reach.p.name)+' ('+(-reach.d)+' early)</span></div>'+
        '<div class="mkrow"><span class="mn">🎉 <b>Mr. Irrelevant</b>: '+esc(lastPick.p.name)+' (pick '+lastPick.n+')</span></div>'+
        (dbl?'<div class="mkrow"><span class="mn">🏗 <b>Stack Architect</b>: you, for the '+dbl[0]+' double stack</span></div>':'');
    }
  }
  // hometown map + favorite-state pride (#354/#355)
  {
    const states = {};
    myIds().map(id2=>byId[id2]).filter(Boolean).forEach(p2=>{
      const hw2 = hometownOf(p2); if(hw2 && hw2.st) states[hw2.st] = (states[hw2.st]||0)+1;
    });
    const fs = (S.settings.favState||"").toUpperCase();
    if(Object.keys(states).length){
      h += '<div class="sechead">🗺 Roster roots</div><div class="mkrow" style="white-space:normal"><span class="mn">'+
        Object.entries(states).sort((a,b)=>b[1]-a[1]).map(([st2,c2])=>(st2===fs?"💖":"")+st2+" ×"+c2).join(" · ")+
        (fs && states[fs] ? ' — <b style="color:#ff7bac">'+states[fs]+' '+fs+' kid'+(states[fs]>1?"s":"")+' on YOUR team</b>' : '')+'</span></div>';
    }
  }
  h += '<div class="sechead">Steals</div>' + (steals.length
    ? steals.map(s=>'<div class="mkrow"><span class="mn">💎 '+s.p.name+' — '+s.fall+' picks past ADP</span></div>').join("")
    : '<div class="dimtxt">No 10+ pick discounts landed (yet).</div>');
  if(steals.length) txt += "Steals: "+steals.map(s=>s.p.name+" (-"+s.fall+")").join(", ")+"\n";
  if(bs){
    const slates = [...new Set(bs.line.filter(sl=>sl.p).map(sl=>sl.p.team))].map(t=>({t, ps:psosFor(t)})).filter(x=>x.ps);
    h += '<div class="sechead">Playoff weeks (15–17)</div>' + slates.map(x=>'<div class="mkrow"><span class="rp mono">'+x.t+'</span><span class="mn dimtxt">'+x.ps.short+'</span></div>').join("");
  }
  txt += "Projected starters: "+g.myPts+" pts";
  _reportText = txt.replace(/\\n/g, "\n");
  $("#reportBody").innerHTML = h;
  $("#reportOverlay").classList.add("show");
}
function quickStandings(){
  const byId = idIndex(), t = S.settings.teams, mySlot = Math.min(S.settings.slot,t);
  const ros = teamRosters();
  const rows = [];
  for(let s2=1;s2<=t;s2++){
    const ids = s2===mySlot ? myIds() : ros[s2];
    rows.push({s:s2, pts: ids.length?bestStarters(ids, byId).pts:0});
  }
  rows.sort((a,b)=>b.pts-a.pts);
  return {rows, mySlot};
}
document.getElementById("bundleBtn").addEventListener("click", ()=>{
  const give = prompt("Trade analyzer — players YOU GIVE (comma-separated):", "");
  if(give===null) return;
  const get = prompt("Players YOU GET:", "");
  if(get===null) return;
  const find = s => s.split(",").map(x=>x.trim()).filter(Boolean)
    .map(nm2 => allPlayers().find(p2=>nq(p2.name)===nq(nm2)) || allPlayers().find(p2=>nm2.length>=4 && nq(p2.name).includes(nq(nm2))))
    .filter(Boolean);
  const gv = find(give), gt = find(get);
  if(!gv.length || !gt.length) return toast("Couldn't match those names", {warn:true});
  const repl = replacementLevels(allPlayers());
  const val = ps => ps.reduce((a,p2)=>a+Math.max(0, p2.proj-(repl[p2.pos]||0)), 0);
  const d2 = Math.round(val(gt)-val(gv));
  toast("⇄ "+gv.map(p2=>p2.name.split(" ").slice(-1)[0]).join("+")+" for "+gt.map(p2=>p2.name.split(" ").slice(-1)[0]).join("+")+
    " → <b style='color:"+(d2>=0?"var(--green)":"var(--red)")+"'>"+(d2>=0?"ACCEPT +":"DECLINE ")+d2+"</b> value");
});
$("#tauntBtn").addEventListener("click", ()=>{
  const {rows, mySlot} = quickStandings();
  const my = rows.findIndex(r=>r.s===mySlot)+1;
  const last = rows[rows.length-1], top = rows[0];
  const lines = [
    "Projections have me "+ordinal(my)+" of "+rows.length+". "+(my===1?"Start engraving the trophy. 🏆":"And I drafted half-asleep."),
    esc(slotName(last.s))+" projects dead last at "+Math.round(last.pts)+" pts. Thoughts and prayers. 🙏",
    my===1 ? "Otto "+Math.round(rows[0].pts)+" — the field: cope." : esc(slotName(top.s))+" leads at "+Math.round(top.pts)+" — enjoy it while the injuries settle. 😈",
    "My optimal starters project "+Math.round(rows[my-1].pts)+". The math is not on your side, "+esc(slotName(last.s))+".",
  ];
  const line = lines[Math.floor(Math.random()*lines.length)];
  navigator.clipboard.writeText(line.replace(/<[^>]+>/g,"")).then(()=>toast("😈 Taunt copied: "+line));
});
$("#reportPng").addEventListener("click", ()=>{
  const c = document.createElement("canvas");
  const lines = _reportText.split("\n");
  c.width = 820; c.height = 120 + lines.length*30;
  const x = c.getContext("2d");
  x.fillStyle = "#0b0f14"; x.fillRect(0,0,c.width,c.height);
  x.fillStyle = "#2fd47a"; x.font = "bold 30px sans-serif";
  x.fillText("DRAFT WAR ROOM", 30, 52);
  x.fillStyle = "#8ba0bc"; x.font = "14px sans-serif";
  x.fillText(new Date().toLocaleDateString(), 30, 78);
  x.fillStyle = "#e8eef7"; x.font = "16px monospace";
  lines.forEach((ln,i)=>x.fillText(ln.slice(0,80), 30, 116+i*30));
  c.toBlob(b=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "draft-report.png"; a.click(); URL.revokeObjectURL(a.href);
  });
});
$("#gradeBtn").addEventListener("click", buildReport);
$("#reportClose").addEventListener("click", ()=>$("#reportOverlay").classList.remove("show"));
$("#reportCopy").addEventListener("click", ()=>{
  navigator.clipboard.writeText(_reportText).then(()=>toast("📤 Report copied"), ()=>toast("Copy failed", {warn:true}));
});
if(navigator.share){
  $("#reportShare").style.display = "";
  $("#reportShare").addEventListener("click", ()=>navigator.share({title:"My draft", text:_reportText}).catch(()=>{}));
}

/* Draft board grid */
function renderBoard(limit){
  const byId = idIndex(), t = S.settings.teams, mySlot = Math.min(S.settings.slot,t);
  const upto = limit==null ? S.log.length : Math.min(limit, S.log.length);
  const cells = {}; let maxR = 1;
  S.log.slice(0, upto).forEach((e,i)=>{
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t);
    const slot = slotOfPick(n);
    const p = byId[e.id];
    if(p){ cells[r+"-"+slot] = {p, mine:e.who==="me", n}; maxR = Math.max(maxR, r); }
  });
  let h = '<table style="border-collapse:collapse;font-size:10.5px;min-width:'+(t*92)+'px"><tr><th style="padding:4px 6px"></th>';
  for(let s2=1;s2<=t;s2++) h += '<th data-slotname="'+s2+'" title="Click to rename" style="cursor:pointer;padding:4px 6px;color:'+(s2===mySlot?'var(--green)':'var(--faint)')+';font-size:9px;max-width:90px;overflow:hidden;text-overflow:ellipsis">'+esc(slotName(s2))+(s2===mySlot?' ★':'')+'</th>';
  h += '</tr>';
  for(let r=1;r<=Math.min(maxR+1,S.settings.roster);r++){
    h += '<tr><td class="mono" style="color:var(--faint);padding:3px 6px">R'+r+'</td>';
    for(let s2=1;s2<=t;s2++){
      const c = cells[r+"-"+s2];
      h += '<td '+(c?'data-cellpick="'+c.n+'" tabindex="0" style="cursor:pointer;':'style="')+'padding:3px 5px;border:1px solid var(--line);'+(s2===mySlot?'background:rgba(47,212,122,.06);':'')+'" title="'+(c?'Pick '+c.n+' — click to correct or trade':'')+'">'+
        (c ? (logoUrl(c.p.team)?'<img class="tlogo" src="'+logoUrl(c.p.team)+'" width="12" height="12" loading="lazy" alt=""> ':'')+'<span class="pos '+c.p.pos+'" style="width:26px;font-size:8px;padding:2px 0">'+c.p.pos+'</span> '+c.p.name.split(" ").slice(-1)[0] : '<span style="color:var(--line)">·</span>')+'</td>';
    }
    h += '</tr>';
  }
  h += '</table>';
  if(S.log.length) h += '<div style="margin-top:8px;display:flex;gap:10px;align-items:center"><span class="dimtxt">⏪ replay</span>'+
    '<input type="range" id="boardScrub" min="0" max="'+S.log.length+'" value="'+upto+'" style="flex:1">'+
    '<span class="mono dimtxt">'+upto+'/'+S.log.length+'</span></div>';
  // projected standings from tracked rosters
  const ros = teamRosters();
  if(S.log.length >= t){
    const curve = pickValueCurve();
    const pv = n => curve[Math.min(curve.length-1, Math.max(0,n-1))]||0;
    const now = pickNow();
    const tendency = {}, timing = {};
    S.log.forEach((e,i)=>{
      const p2 = byId[e.id]; if(!p2) return;
      const n = i+1+(S.pickOffset||0), r2 = Math.ceil(n/t), idx = n-(r2-1)*t, slot = (r2%2===1)?idx:t+1-idx;
      if(p2.adp) (tendency[slot]=tendency[slot]||[]).push(n - p2.adp);
      if(e.t && i>0 && S.log[i-1].t) (timing[slot]=timing[slot]||[]).push((e.t-S.log[i-1].t)/1000);
    });
    const avg = a => a && a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
    const slowest = Object.entries(timing).filter(([,a])=>a.length>=3).sort((a,b)=>avg(b[1])-avg(a[1]))[0];
    const rows = [];
    for(let s2=1;s2<=t;s2++){
      const ids = s2===mySlot ? myIds() : ros[s2];
      const future = [];
      for(let r2=1;r2<=S.settings.roster;r2++){
        const n = (r2-1)*t + ((r2%2===1)?s2:t+1-s2);
        if(n>=now) future.push(n);
      }
      rows.push({s:s2, pts: ids.length ? bestStarters(ids, byId).pts : 0, n: ids.length,
                 cap: Math.round(future.reduce((a,n)=>a+pv(n),0)),
                 tend: avg(tendency[s2])});
    }
    rows.sort((a,b)=>b.pts-a.pts);
    h += '<div class="sechead" style="margin-top:16px">🏆 Projected standings</div><table class="stattbl" style="max-width:560px">'+
      '<tr><th style="text-align:left">#</th><th style="text-align:left">Team</th><th>Starters</th><th>Picks</th><th title="Value of remaining picks">Capital</th><th title="Avg picks vs ADP: negative = reaches early">Style</th></tr>'+
      rows.map((r2,i)=>'<tr'+(r2.s===mySlot?' style="color:var(--green);font-weight:700"':'')+'><td style="text-align:left">'+(i+1)+'</td><td style="text-align:left">'+esc(slotName(r2.s))+
        (slowest&&+slowest[0]===r2.s?' 🐢':'')+'</td><td>'+Math.round(r2.pts)+'</td><td>'+r2.n+'</td><td>'+r2.cap+'</td><td>'+
        (r2.tend==null?'—':(r2.tend<-3?'reaches '+r2.tend.toFixed(1):r2.tend>3?'value +'+r2.tend.toFixed(1):'neutral'))+'</td></tr>').join("")+
      '</table>'+(slowest?'<div class="dimtxt" style="margin-top:4px">🐢 slowest on the clock: '+esc(slotName(+slowest[0]))+' ('+Math.round(avg(slowest[1]))+'s avg)</div>':'');
  } else {
    h += '<div class="dimtxt" style="margin-top:12px">Standings appear after round 1 is fully logged.</div>';
  }
  // needs matrix: positions × teams
  {
    const need = (ids, pos, lim) => { let c=0; ids.forEach(id2=>{const p2=byId[id2]; if(p2&&p2.pos===pos)c++;}); return Math.max(0, lim-c); };
    const lims = {QB:2,RB:2,WR:2,TE:1,DEF:1};
    h += '<div class="sechead" style="margin-top:16px">🗺 Needs matrix (starters still owed)</div><table class="stattbl" style="max-width:560px"><tr><th style="text-align:left">Team</th>'+
      ["QB","RB","WR","TE","DEF"].map(p2=>'<th>'+p2+'</th>').join("")+'</tr>'+
      Array.from({length:t},(_,i)=>i+1).map(s2=>{
        const ids = s2===mySlot ? myIds() : ros[s2];
        return '<tr'+(s2===mySlot?' style="color:var(--green)"':'')+'><td style="text-align:left;cursor:pointer" data-teampage="'+s2+'" title="Open team page">'+esc(slotName(s2))+'</td>'+
          ["QB","RB","WR","TE","DEF"].map(p2=>{
            const n2 = need(ids, p2, lims[p2]);
            return '<td style="color:'+(n2>=2?'var(--red)':n2===1?'var(--gold)':'var(--faint)')+'">'+(n2||"·")+'</td>';
          }).join("")+'</tr>';
      }).join("")+'</table>';
  }
  // order randomizer + results copy
  h += '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+
    '<button class="hbtn" id="randOrder">🎲 Randomize order</button>'+
    '<button class="hbtn" id="nickGen">🎭 Nicknames</button>'+
    '<button class="hbtn" id="copyResults">📋 Copy results text</button></div><div class="note" id="randOut" style="margin-top:8px"></div>';
  // trade calculator
  h += '<div class="sechead" style="margin-top:16px">⇄ Pick trade calculator</div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      '<input class="search" id="tradeGive" style="flex:1;min-width:130px" placeholder="You give: 1.12, 6.01">'+
      '<input class="search" id="tradeGet" style="flex:1;min-width:130px" placeholder="You get: 2.01, 3.12">'+
      '<button class="hbtn" id="tradeGo">Evaluate</button>'+
    '</div><div class="note" id="tradeOut" style="margin-top:8px"></div>';
  $("#boardGrid").innerHTML = h;
}
/* value of an overall pick = VORP of the nth-best player on the full board */
function auctionOf(p){
  const pool = cached("aucpool", ()=>{
    const players = allPlayers(), repl = replacementLevels(players);
    const pos = players.map(x=>Math.max(0, x.proj-(repl[x.pos]||0)));
    const sum = pos.reduce((a,b)=>a+b,0);
    const budget = (S.settings.budget||200)*S.settings.teams;
    const spendable = budget - S.settings.teams*S.settings.roster;
    return {sum, spendable};
  });
  const repl = replacementLevels(allPlayers());
  const v = Math.max(0, p.proj-(repl[p.pos]||0));
  return Math.max(1, Math.round(1 + (pool.sum ? v/pool.sum*pool.spendable : 0)));
}
function pickValueCurve(){
  return cached("pvc", ()=>{
    const players = allPlayers(), repl = replacementLevels(players);
    return players.map(p=>Math.max(0, p.proj-(repl[p.pos]||0))).sort((a,b)=>b-a);
  });
}
function tradeEval(){
  const curve = pickValueCurve();
  const v = n => curve[Math.min(curve.length-1, Math.max(0, n-1))] || 0;
  const give = parsePicks($("#tradeGive").value, S.settings.teams), get = parsePicks($("#tradeGet").value, S.settings.teams);
  if(!give.length || !get.length){ $("#tradeOut").textContent = "Enter picks on both sides (1.12 or overall numbers)."; return; }
  const gv = give.reduce((a,n)=>a+v(n),0), rv = get.reduce((a,n)=>a+v(n),0);
  const d = Math.round(rv-gv);
  $("#tradeOut").innerHTML = 'Give #'+give.join(", #")+' ('+Math.round(gv)+' pts of value) for #'+get.join(", #")+' ('+Math.round(rv)+') → '+
    '<b style="color:'+(d>=0?"var(--green)":"var(--red)")+'">'+(d>=0?"ACCEPT — you gain ~"+d:"DECLINE — you lose ~"+(-d))+' pts</b>'+
    '<span class="dimtxt"> (value = nth-best player remaining on a full board)</span>';
}
$("#boardPrint").addEventListener("click", ()=>{
  const byId = idIndex(), t = S.settings.teams, mySlot = Math.min(S.settings.slot,t);
  const ros = teamRosters();
  const rows = [];
  for(let s2=1;s2<=t;s2++){
    const ids = s2===mySlot ? myIds() : ros[s2];
    rows.push({s:s2, pts: ids.length?Math.round(bestStarters(ids, byId).pts):0});
  }
  rows.sort((a,b)=>b.pts-a.pts);
  let h = '<!DOCTYPE html><html><head><title>'+esc(S.settings.name||"Draft")+' — Results</title><style>'+
    'body{font-family:Arial;font-size:11px;margin:18px} h1{font-size:16px;margin:0 0 4px} h2{font-size:12px;margin:14px 0 6px}'+
    'table{border-collapse:collapse;width:100%} th,td{border:1px solid #bbb;padding:3px 6px;text-align:left} th{background:#eee}'+
    '.me{font-weight:bold} @media print{body{margin:8px}}</style></head><body>'+
    '<h1>'+esc(S.settings.name||"Draft")+' — '+new Date().toLocaleDateString()+'</h1>'+
    '<h2>Projected standings</h2><table><tr><th>#</th><th>Team</th><th>Proj starters</th></tr>'+
    rows.map((r,i)=>'<tr class="'+(r.s===mySlot?'me':'')+'"><td>'+(i+1)+'</td><td>'+esc(slotName(r.s))+'</td><td>'+r.pts+'</td></tr>').join("")+'</table>'+
    '<h2>Full board</h2><table><tr><th>Pick</th><th>Team</th><th>Player</th><th>Pos</th></tr>'+
    S.log.map((e,i)=>{
      const p = byId[e.id]; if(!p) return "";
      const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), idx = n-(r-1)*t, slot = (r%2===1)?idx:t+1-idx;
      return '<tr class="'+(slot===mySlot?'me':'')+'"><td>'+r+'.'+String(idx).padStart(2,"0")+'</td><td>'+esc(slotName(slot))+'</td><td>'+esc(p.name)+'</td><td>'+p.pos+' · '+p.team+'</td></tr>';
    }).join("")+'</table></body></html>';
  const w = window.open("about:blank");
  if(w){ w.document.write(h); w.document.close(); }
});
document.addEventListener("input", e=>{
  if(e.target && e.target.id==="boardScrub"){
    const v = +e.target.value;
    const grid = document.querySelector("#boardGrid table");
    renderBoard(v);
  }
});
$("#boardBtn").addEventListener("click", ()=>{ renderBoard(); $("#boardOverlay").classList.add("show"); });
$("#boardClose").addEventListener("click", ()=>$("#boardOverlay").classList.remove("show"));

/* Paste picks modal */
$("#pasteBtn").addEventListener("click", ()=>{ $("#pasteResult").textContent=""; $("#pasteOverlay").classList.add("show"); $("#pasteText").focus(); });
$("#pasteCancel").addEventListener("click", ()=>$("#pasteOverlay").classList.remove("show"));
$("#pasteGo").addEventListener("click", ()=>{
  const players = allPlayers();
  const lines = $("#pasteText").value.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  let marked=0, skipped=0; const missed=[];
  for(const line of lines){
    const ln = nq(line);
    let best=null;
    for(const p of players){
      const pn = normName(p.name);
      if(ln===pn || ln.includes(pn) || (pn.includes(ln) && ln.length>=5)){
        if(!best || p.name.length>best.name.length) best=p;
      }
    }
    if(!best){ missed.push(line); continue; }
    if(S.taken[best.id] || S.mine.includes(best.id)){ skipped++; continue; }
    S.taken[best.id]=true; S.log.push({id:best.id, who:"other"}); marked++;
  }
  if(marked) commit();
  $("#pasteResult").innerHTML = '✅ Marked <b>'+marked+'</b> taken'+(skipped?' · '+skipped+' already off the board':'')+
    (missed.length ? '<br>⚠️ No match: '+missed.map(esc).join(", ") : '');
});

/* Mocks modal */
$("#mocksBtn").addEventListener("click", ()=>{ $("#mocksOverlay").classList.add("show"); renderMocks(); });
$("#mocksReroll").addEventListener("click", renderMocks);
$("#scenarioBtn").addEventListener("click", ()=>{
  $("#mockGrid").innerHTML = '<div class="empty" id="mockProg">Testing openings… 0/'+SCENARIOS.length+'</div>';
  const base = Math.floor(Math.random()*1e9);
  const res = [];
  const step2 = i => {
    if(i < SCENARIOS.length){
      const strat = {name:SCENARIOS[i].name, icon:"🧪", mod:()=>1, force:SCENARIOS[i].force};
      res.push({sc:SCENARIOS[i], m:runMock(strat, base + i*104729)});
      const pr = document.getElementById("mockProg");
      if(pr) pr.textContent = "Testing openings… "+res.length+"/"+SCENARIOS.length;
      setTimeout(()=>step2(i+1), 10);
      return;
    }
    res.sort((a,b)=>b.m.startPts-a.m.startPts);
    let txt = "🧪 Opening scenarios ("+(S.settings.name||"league")+", slot "+S.settings.slot+"):\n";
    $("#mockGrid").innerHTML = '<table class="stattbl" style="max-width:520px"><tr><th style="text-align:left">Opening</th><th>Starters</th><th>vs best</th><th>First 3</th></tr>'+
      res.map((x,i2)=>{
        const first3 = x.m.picks.slice(0,3).map(pk=>pk.p.name.split(" ").slice(-1)[0]).join(", ");
        txt += (i2+1)+". "+x.sc.name+" — "+x.m.startPts+" pts ("+first3+")\n";
        return '<tr'+(i2===0?' style="color:var(--green);font-weight:700"':'')+'><td style="text-align:left">'+esc(x.sc.name)+'</td><td>'+x.m.startPts+'</td><td>'+(i2===0?"—":"-"+(res[0].m.startPts-x.m.startPts))+'</td><td style="font-size:10px">'+esc(first3)+'</td></tr>';
      }).join("")+'</table>'+
      '<button class="hbtn" id="matrixCopy" style="margin-top:10px">📋 Copy matrix</button>';
    window._matrixTxt = txt;
    $("#mockConsensus").innerHTML = "Best projected opening from your seat is highlighted. Re-run for different room randomness.";
  };
  step2(0);
});
$("#mocksClose").addEventListener("click", ()=>$("#mocksOverlay").classList.remove("show"));

/* Settings modal */
document.querySelectorAll("#settingsOverlay .sechead").forEach(sh=>{
  sh.style.cursor = "pointer";
  sh.addEventListener("click", ()=>{
    let el = sh.nextElementSibling;
    const hide = !sh.classList.contains("folded");
    sh.classList.toggle("folded", hide);
    while(el && !el.classList.contains("sechead")){
      el.style.display = hide ? "none" : "";
      el = el.nextElementSibling;
    }
  });
});
$("#settingsBtn").addEventListener("click", ()=>{
  $("#setTeams").value=S.settings.teams; $("#setRoster").value=S.settings.roster;
  $("#setSlot").value=S.settings.slot; $("#setScoring").value=S.settings.scoring;
  $("#setName").value=S.settings.name||"Buck Breakers";
  $("#setDensity").value = S.settings.compact==="ultra" ? "ultra" : S.settings.compact ? "compact" : "normal";
  $("#setShowBye").checked=!!S.settings.showBye;
  const cols=S.settings.cols||{};
  $("#colADP").checked=cols.adp!==false; $("#colEdge").checked=cols.edge!==false; $("#colRd").checked=cols.rd!==false;
  $("#setSound").checked=S.settings.sound!==false;
  $("#setFont").value=S.settings.fontSize||"m";
  $("#setCbSafe").checked=!!S.settings.cbSafe;
  $("#setSpeak").checked=!!S.settings.speak;
  $("#setDraftDate").value=S.settings.draftDate||"";
  $("#setFlair").value=S.settings.flair||"";
  $("#setAccent").value=S.settings.accent||"green";
  $("#setFavState").value=S.settings.favState||"";
  $("#setFavCollege").value=S.settings.favCollege||"";
  $("#setTimer").value=S.settings.timerSecs||0;
  $("#setLowData").checked=!!S.settings.lowData;
  $("#setVol").value=S.settings.vol!=null?S.settings.vol:1;
  const kk = S.settings.keys||{};
  $("#keyMine").value=kk.mine||"m"; $("#keyTaken").value=kk.taken||"t"; $("#keyQueue").value=kk.queue||"q";
  $("#setTierSense").value=S.settings.tierSense||0.045;
  $("#setContagion").value=S.settings.contagion||0.92;
  $("#setNotify").checked=!!S.settings.notifyInj;
  $("#setPoll").value=S.settings.pollMins||5;
  const hw = S.settings.hqWidgets||{radar:true,news:true,ir:true,drops:true};
  $("#hqRadar").checked=hw.radar!==false; $("#hqNews").checked=hw.news!==false;
  $("#hqIr").checked=hw.ir!==false; $("#hqDrops").checked=hw.drops!==false;
  $("#setSleeperDraft").value=S.settings.sleeperDraftId||"";
  $("#setSleeperLeague").value=S.settings.sleeperLeagueId||"";
  const rs=$("#setRival");
  rs.innerHTML='<option value="">none</option>'+Array.from({length:S.settings.teams},(_,i)=>i+1)
    .filter(s2=>s2!==S.settings.slot).map(s2=>'<option value="'+s2+'"'+(+S.settings.rivalSlot===s2?' selected':'')+'>'+esc(slotName(s2))+'</option>').join("");
  renderTrophies(); renderAchievements();
  $("#setBaCount").value=S.settings.baCount||15;
  $("#setSimN").value=S.settings.simN||30;
  $("#setRisk").value=S.settings.risk||"balanced";
  $("#setSheetCount").value=S.settings.sheetCount||200;
  $("#setSheetNotes").checked=!!S.settings.sheetNotes;
  refreshProfiles(); refreshProjStatus();
  const su = document.getElementById("storageUse");
  if(su && navigator.storage && navigator.storage.estimate){
    navigator.storage.estimate().then(e2=>{
      su.textContent = "Storage: "+((e2.usage||0)/1048576).toFixed(1)+" MB used of "+((e2.quota||0)/1073741824).toFixed(1)+" GB available.";
    }).catch(()=>{});
  }
  $("#setPtd").value=String(S.settings.ptd||6);
  const sl0 = slotCfg();
  ["QB","RB","WR","TE","FLEX","SF","DEF","K","BN"].forEach(k=>{ const el=$("#sl"+k); if(el) el.value = sl0[k]; });
  $("#setAuction").checked=!!S.settings.auctionMode;
  $("#setBudget").value=S.settings.budget||200;
  $("#setRecPts").value = S.settings.recPts==null ? "" : S.settings.recPts;
  $("#setTePrem").value = S.settings.tePrem||0;
  for(const pos of POSITIONS) $("#min"+pos).value=S.settings.min[pos]||0;
  $("#settingsOverlay").classList.add("show");
});
$("#setPreset").addEventListener("change", e=>{
  const p2 = e.target.value;
  const map = {
    buck:  {QB:1,RB:2,WR:2,TE:1,FLEX:1,SF:1,DEF:1,K:0,BN:7},
    espn:  {QB:1,RB:2,WR:2,TE:1,FLEX:1,SF:0,DEF:1,K:1,BN:7},
    yahoo: {QB:1,RB:2,WR:3,TE:1,FLEX:1,SF:0,DEF:1,K:1,BN:6},
  };
  if(map[p2]) ["QB","RB","WR","TE","FLEX","SF","DEF","K","BN"].forEach(k=>{ $("#sl"+k).value = map[p2][k]; });
  e.target.value = "";
});
$("#settingsCancel").addEventListener("click", ()=>$("#settingsOverlay").classList.remove("show"));
$("#settingsSave").addEventListener("click", ()=>{
  S.settings.teams = Math.max(4, +$("#setTeams").value||12);
  S.settings.roster = Math.max(8, +$("#setRoster").value||16);
  S.settings.slot = Math.max(1, +$("#setSlot").value||12);
  S.settings.scoring = $("#setScoring").value==="half" ? "half" : "ppr";
  S.settings.ptd = +$("#setPtd").value===4 ? 4 : 6;
  const slN = {};
  ["QB","RB","WR","TE","FLEX","SF","DEF","K","BN"].forEach(k=>{ slN[k] = Math.max(0, +$("#sl"+k).value||0); });
  S.settings.slots = slN;
  S.settings.auctionMode = $("#setAuction").checked;
  S.settings.budget = Math.max(100, +$("#setBudget").value||200);
  // guardrails (#455): roster must hold the starters
  const startersN = slN.QB+slN.RB+slN.WR+slN.TE+slN.FLEX+slN.SF+slN.DEF+slN.K;
  const rosterN = startersN + slN.BN;
  if(S.settings.roster !== rosterN){ S.settings.roster = rosterN; toast("Roster size set to "+rosterN+" (starters + bench)"); }
  S.settings.min = {QB:slN.QB+slN.SF, RB:slN.RB, WR:slN.WR, TE:slN.TE, DEF:slN.DEF, K:slN.K};
  if(slN.K>0 && !allPlayers().some(p=>p.pos==="K"))
    toast("⚠️ No kickers in the dataset — add via + Player or refresh with --keep-kickers", {warn:true});
  const rp = $("#setRecPts").value.trim();
  S.settings.recPts = rp==="" ? null : Math.min(2, Math.max(0, parseFloat(rp)||0));
  S.settings.tePrem = Math.min(1, Math.max(0, parseFloat($("#setTePrem").value)||0));
  S.settings.name = $("#setName").value.trim() || "Buck Breakers";
  const dens = $("#setDensity").value;
  S.settings.compact = dens==="normal" ? false : dens;
  S.settings.showBye = $("#setShowBye").checked;
  S.settings.sound = $("#setSound").checked;
  S.settings.speak = $("#setSpeak").checked;
  S.settings.draftDate = $("#setDraftDate").value || null;
  S.settings.flair = $("#setFlair").value.trim();
  S.settings.accent = $("#setAccent").value;
  S.settings.favState = $("#setFavState").value.trim().toUpperCase().slice(0,2);
  S.settings.favCollege = $("#setFavCollege").value.trim();
  S.settings.timerSecs = Math.max(0, +$("#setTimer").value||0);
  S.settings.lowData = $("#setLowData").checked;
  S.settings.vol = +$("#setVol").value;
  S.settings.keys = {mine:($("#keyMine").value||"m").toLowerCase(), taken:($("#keyTaken").value||"t").toLowerCase(), queue:($("#keyQueue").value||"q").toLowerCase()};
  S.settings.tierSense = +$("#setTierSense").value || 0.045;
  S.settings.contagion = +$("#setContagion").value || 0.92;
  const wantNotify = $("#setNotify").checked;
  if(wantNotify && !S.settings.notifyInj && "Notification" in window && Notification.permission==="default"){
    Notification.requestPermission();
  }
  S.settings.notifyInj = wantNotify;
  S.settings.pollMins = Math.min(30, Math.max(2, +$("#setPoll").value||5));
  S.settings.hqWidgets = {radar:$("#hqRadar").checked, news:$("#hqNews").checked, ir:$("#hqIr").checked, drops:$("#hqDrops").checked};
  S.settings.rivalSlot = $("#setRival").value ? +$("#setRival").value : null;
  S.settings.sleeperDraftId = $("#setSleeperDraft").value.trim();
  const lg = $("#setSleeperLeague").value.trim();
  if(lg && lg!==S.settings.sleeperLeagueId){ S.settings.sleeperLeagueId = lg; syncImportLeague(lg); }
  S.settings.cols = {adp:$("#colADP").checked, edge:$("#colEdge").checked, rd:$("#colRd").checked};
  S.settings.fontSize = $("#setFont").value;
  S.settings.cbSafe = $("#setCbSafe").checked;
  S.settings.baCount = Math.min(30, Math.max(5, +$("#setBaCount").value||15));
  S.settings.simN = Math.min(100, Math.max(20, +$("#setSimN").value||30));
  S.settings.risk = $("#setRisk").value;
  S.settings.sheetCount = Math.min(390, Math.max(50, +$("#setSheetCount").value||200));
  S.settings.sheetNotes = $("#setSheetNotes").checked;
  applyTheme();
  for(const pos of POSITIONS) S.settings.min[pos] = Math.max(0, +$("#min"+pos).value||0);
  $("#settingsOverlay").classList.remove("show");
  commit();
});

document.getElementById("drillBtn").addEventListener("click", ()=>{
  window._drill = !window._drill;
  if(window._drill){
    window._realFetch = window.fetch;
    window.fetch = ()=>Promise.reject(new Error("offline drill"));
    setOnlineUI(); document.body.classList.add("offline");
    toast("🧯 OFFLINE DRILL — all network blocked. Everything should still work. Click again to restore.", {warn:true});
  } else {
    if(window._realFetch) window.fetch = window._realFetch;
    document.body.classList.remove("offline"); setOnlineUI();
    toast("📡 Drill over — network restored");
  }
});
$("#debugBtn").addEventListener("click", ()=>{
  const info = {
    build: BUILD, data: typeof DATA_STAMP!=="undefined"?DATA_STAMP:"?",
    stateBytes: JSON.stringify(S).length,
    players: allPlayers().length, log: S.log.length, mine: S.mine.length,
    settings: S.settings, errors: window._errLog, recentActions: window._acts,
    ua: navigator.userAgent,
  };
  navigator.clipboard.writeText("Draft War Room debug\n"+JSON.stringify(info,null,2)).then(()=>toast("🐞 Debug info copied"));
});
$("#defaultsBtn").addEventListener("click", ()=>{
  if(!confirm("Reset all settings to Buck Breakers defaults? Board, notes and names are untouched.")) return;
  S.settings = defaultState().settings;
  $("#settingsOverlay").classList.remove("show");
  applyTheme(); commit();
  toast("Settings restored to defaults");
});
$("#restoreBtn").addEventListener("click", ()=>{
  const raw = localStorage.getItem(LS_KEY+"-backup");
  if(!raw) return alert("No backup found. One is saved automatically before every import or reset.");
  try{
    const b = JSON.parse(raw);
    if(!confirm("Restore the board from the backup saved "+b.when+"? Current state will be backed up first.")) return;
    const cur = JSON.stringify({when:new Date().toLocaleString(), state:S});
    S = Object.assign(defaultState(), b.state);
    localStorage.setItem(LS_KEY+"-backup", cur);   // swap, so restore is reversible
    $("#settingsOverlay").classList.remove("show");
    commit();
  }catch(e){ alert("Backup is corrupted."); }
});

/* Add player modal */
$("#addBtn").addEventListener("click", ()=>{ $("#addName").value=""; $("#addTeam").value=""; $("#addProj").value=""; $("#addOverlay").classList.add("show"); $("#addName").focus(); });
$("#addCancel").addEventListener("click", ()=>$("#addOverlay").classList.remove("show"));
$("#addSave").addEventListener("click", ()=>{
  const name=$("#addName").value.trim(), team=$("#addTeam").value.trim().toUpperCase()||"FA",
        pos=$("#addPos").value, proj=parseFloat($("#addProj").value)||0;
  if(!name) return alert("Name required");
  S.custom.push([name,team,pos,proj,"c"+Date.now()]);
  $("#addOverlay").classList.remove("show");
  commit();
});
document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click", e=>{ if(e.target===o) o.classList.remove("show"); }));
new MutationObserver(muts=>{
  for(const m of muts){
    const el = m.target;
    if(el.classList.contains("show") && el.classList.contains("overlay")){
      if(document.activeElement && !el.contains(document.activeElement)) window._modalOpener = document.activeElement;
      const f = el.querySelector("input:not([type=hidden]),select,textarea") || el.querySelector("button");
      if(f && !el.contains(document.activeElement)) setTimeout(()=>f.focus(), 60);
    }
  }
}).observe(document.body, {attributes:true, attributeFilter:["class"], subtree:true});

/* Printable cheat sheet */
$("#sheetBtn").addEventListener("click", ()=>{
  const players=allPlayers(), repl=replacementLevels(players), tm=tierMap(players), rinfo=roundInfo(players);
  const rows=players.map(p=>({p, vorp:p.proj-(repl[p.pos]||0)})).sort((a,b)=>b.vorp-a.vorp).slice(0, S.settings.sheetCount||200);
  let html='<!DOCTYPE html><html><head><title>Buck Breakers Cheat Sheet</title><style>'+
    'body{font-family:Arial,sans-serif;font-size:10px;margin:18px} h1{font-size:15px;margin:0 0 2px} p{margin:0 0 10px;color:#555;font-size:9px}'+
    'table{border-collapse:collapse;width:100%} th,td{border:1px solid #bbb;padding:2px 5px;text-align:left} th{background:#eee}'+
    'tr:nth-child(even){background:#f6f6f6} .t1{font-weight:bold} @media print{body{margin:8px}}'+
    '</style></head><body><h1>Draft War Room — Cheat Sheet</h1>'+
    '<p>Buck Breakers · superflex · 6pt pass TD · slot '+S.settings.slot+' · top 200 by value over replacement · ★=analyst target ▲▼=prop lean</p>'+
    '<table><tr><th>#</th><th>Player</th><th>Pos</th><th>Tm</th><th>Tier</th><th>Proj</th><th>Value</th><th>ADP</th><th>Rd</th><th></th>'+(S.settings.sheetNotes?'<th>Notes</th>':'')+'</tr>';
  rows.forEach((r,i)=>{
    const p=r.p, badges=(p.intel&&p.intel.t!=null?"★":"")+(p.intel&&p.intel.lean>0?"▲":p.intel&&p.intel.lean<0?"▼":"")+
      ((S.boost||{})[p.id]===1?" MY-GUY":(S.boost||{})[p.id]===-1?" FADE":"")+((S.tierBump||{})[p.id]?" T-adj":"");
    html+='<tr class="'+(tm[p.id]===1?'t1':'')+'"><td>'+(i+1)+'</td><td>'+p.name+'</td><td>'+p.pos+'</td><td>'+p.team+'</td><td>T'+tm[p.id]+'</td><td>'+p.proj+'</td><td>'+Math.round(r.vorp)+'</td><td>'+(p.adp||"")+'</td><td>'+(rinfo[p.id]?rinfo[p.id].label:"")+'</td><td>'+badges+'</td>'+(S.settings.sheetNotes?'<td>'+((S.notes[p.id]||"").slice(0,40))+'</td>':'')+'</tr>';
  });
  html+='</table></body></html>';
  const w=window.open("about:blank");
  if(w){ w.document.write(html); w.document.close(); }
});

/* CSV export of the evaluated board */
$("#csvBtn").addEventListener("click", ()=>{
  const players=allPlayers(), repl=replacementLevels(players), tm=tierMap(players), rinfo=roundInfo(players);
  const q = s => '"'+String(s).replace(/"/g,'""')+'"';
  let csv = "Rank,Player,Pos,Team,Tier,Proj,ValueOverRepl,ADP,ExpectedRound,Status,Note\n";
  players.map(p=>({p, vorp:p.proj-(repl[p.pos]||0)})).sort((a,b)=>b.vorp-a.vorp).forEach((r,i)=>{
    const p=r.p, st = S.mine.includes(p.id)?"mine":(S.taken[p.id]?"taken":(S.dnd[p.id]?"do-not-draft":"available"));
    csv += [i+1, q(p.name), p.pos, p.team, tm[p.id], p.proj, Math.round(r.vorp), p.adp||"", rinfo[p.id]?rinfo[p.id].label:"", st, q(S.notes[p.id]||"")].join(",")+"\n";
  });
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="draft-war-room-board.csv"; a.click(); URL.revokeObjectURL(a.href);
});

/* Help modal */
document.getElementById("fabSearch").addEventListener("click", ()=>{ $("#search").focus(); $("#search").scrollIntoView({block:"center"}); });
document.getElementById("fabInj").addEventListener("click", ()=>document.getElementById("injBtn").click());
document.getElementById("fabUndo").addEventListener("click", undoLast);
document.getElementById("changelogBtn").addEventListener("click", async ()=>{
  try{
    const r = await fetch("CHANGELOG.md");
    const txt = await r.text();
    $("#cardBody").innerHTML = '<div class="chead"><div class="cid"><div class="cname">📜 Changelog</div></div></div>'+
      '<div class="cintel" style="white-space:pre-wrap;font-size:12px;line-height:1.6;max-height:55vh;overflow-y:auto">'+esc(txt)+'</div><div class="cacts"></div>';
    document.getElementById("helpOverlay").classList.remove("show");
    $("#cardOverlay").classList.add("show");
  }catch(e){ toast("Changelog needs a network/HTTP context", {warn:true}); }
});
function renderPrepCheck(){
  const el = document.getElementById("prepCheck");
  if(!el) return;
  const ck = (ok, label) => (ok?"✅":"⬜")+" "+label+"<br>";
  el.innerHTML =
    ck(S.settings.slot===12 || S.settings.slot>0, "Draft slot set (you: "+S.settings.slot+")")+
    ck(Object.keys(S.slotNames||{}).length>0, "League names on the board")+
    ck(!!(S.settings.favState||S.settings.favCollege), "💖 favorites set"+(S.settings.favState?" ("+S.settings.favState+")":""))+
    ck(S.queue.length>0, "Queue seeded ("+S.queue.length+" players)")+
    ck(Object.keys(S.plan||{}).length>0, "Plan pinned ("+Object.keys(S.plan||{}).length+" rounds)")+
    ck(Object.keys(S.boost||{}).length>0, "Boost/fade list started")+
    ck(!!S.settings.draftDate, "Draft date set");
}
$("#helpBtn").addEventListener("click", ()=>{ renderPrepCheck(); $("#helpOverlay").classList.add("show"); });
$("#helpClose").addEventListener("click", ()=>$("#helpOverlay").classList.remove("show"));

/* Runtime projections import */
function parseCsvLine(line){
  const out=[]; let cur="", q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(q){ if(ch==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else if(ch==='"') q=true;
    else if(ch===','){ out.push(cur); cur=""; }
    else cur+=ch;
  }
  out.push(cur);
  return out;
}
function refreshProjStatus(){
  const el=$("#projStatus"); if(!el) return;
  el.textContent = S.dataRows && S.dataRows.length
    ? "Using imported dataset: "+S.dataRows.length+" players (rev "+(S.dataRev||1)+"). ADP and intel merged by name."
    : "Using built-in dataset ("+RAW.length+" players, "+DATA_STAMP+").";
  const ao = Object.keys(S.adpOverride||{}).length;
  if(ao) el.textContent += " Manual ADP overrides: "+ao+".";
}
$("#projImportBtn").addEventListener("click", ()=>$("#projFile").click());
document.getElementById("cdCardBtn").addEventListener("click", ()=>{
  const days = S.settings.draftDate ? Math.ceil((new Date(S.settings.draftDate+"T20:00")-Date.now())/86400000) : null;
  const c = document.createElement("canvas"); c.width=600; c.height=315;
  const x = c.getContext("2d");
  x.fillStyle="#0b0f14"; x.fillRect(0,0,600,315);
  x.fillStyle="#2fd47a"; x.font="bold 26px sans-serif"; x.fillText((S.settings.name||"DRAFT").toUpperCase(), 40, 70);
  x.fillStyle="#e8eef7"; x.font="bold 88px sans-serif"; x.fillText(days!=null?days+" DAYS":"SOON", 40, 190);
  x.fillStyle="#8ba0bc"; x.font="18px sans-serif"; x.fillText("until the war room opens · slot "+S.settings.slot, 40, 240);
  c.toBlob(b=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="countdown.png"; a.click(); URL.revokeObjectURL(a.href); });
});
document.getElementById("icsBtn").addEventListener("click", ()=>{
  if(!S.settings.draftDate) return toast("Set the draft date first", {warn:true});
  const dt = S.settings.draftDate.replace(/-/g,"");
  const ics = "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:"+dt+"T190000\nDTEND:"+dt+"T230000\nSUMMARY:"+(S.settings.name||"Fantasy")+" draft — War Room ready\nDESCRIPTION:Lock in. https://github.com/JROtto5/draft-war-room\nEND:VEVENT\nEND:VCALENDAR";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));
  a.download = "draft-day.ics"; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById("blurbBtn").addEventListener("click", ()=>{
  const days = S.settings.draftDate ? Math.ceil((new Date(S.settings.draftDate+"T20:00")-Date.now())/86400000) : null;
  const txt = "🏈 "+(S.settings.name||"League")+" DRAFT"+(days!=null?" in "+days+" days":"")+
    (S.settings.draftDate?" — "+S.settings.draftDate:"")+"\n"+
    Array.from({length:S.settings.teams},(_,i)=>i+1).map(s2=>(s2===S.settings.slot?"➡️ ":"")+s2+". "+slotName(s2)).join("\n")+
    "\nBring snacks. Bring excuses.";
  navigator.clipboard.writeText(txt).then(()=>toast("📣 Commissioner blurb copied"));
});
$("#projTemplateBtn").addEventListener("click", ()=>{
  const t = "PLAYER,TEAM,POS,PPR,HALF,PATD\nJosh Allen,BUF,QB,365.8,352,25.6\nBijan Robinson,ATL,RB,339.3,283.1,0\nJa'Marr Chase,CIN,WR,331.6,256,0\nBrock Bowers,LVR,TE,249.4,190.7,0\nBroncos D/ST,DEN,DEF,135,135,0\n";
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([t],{type:"text/csv"}));
  a.download="projections-template.csv"; a.click(); URL.revokeObjectURL(a.href);
});
$("#projRevertBtn").addEventListener("click", ()=>{ S.dataRows=null; S.dataRev=(S.dataRev||0)+1; commit(); refreshProjStatus(); toast("Reverted to built-in projections"); });
$("#projFile").addEventListener("change", e=>{
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    const lines=String(rd.result).split(/\r?\n/).filter(l=>l.trim());
    const head=parseCsvLine(lines[0]).map(s=>s.trim().toUpperCase());
    const ix=n=>head.indexOf(n);
    const iN=ix("PLAYER")<0?ix("NAME"):ix("PLAYER"), iT=ix("TEAM"), iP=ix("POS"), iPPR=ix("PPR"), iH=ix("HALF"), iTD=ix("PATD");
    if(iN<0||iT<0||iP<0||iPPR<0){ toast("CSV needs PLAYER/NAME, TEAM, POS, PPR columns", {warn:true}); e.target.value=""; return; }
    const adpBy={}, patdBy={};
    RAW.forEach(r=>{ const k=normName(r[0]); if(r[5]) adpBy[k]=r[5]; if(r[6]) patdBy[k]=r[6]; });
    const rows=[];
    for(let i=1;i<lines.length;i++){
      const c=parseCsvLine(lines[i]);
      const name=(c[iN]||"").trim(); if(!name) continue;
      let pos=(c[iP]||"").trim().toUpperCase(); if(pos==="DST"||pos==="D/ST") pos="DEF";
      if(!POSITIONS.includes(pos)) continue;
      let ppr=parseFloat(c[iPPR]); if(isNaN(ppr)) continue;
      let half=iH>=0?parseFloat(c[iH]):ppr; if(isNaN(half)) half=ppr;
      const k=normName(name);
      let patd=iTD>=0?(parseFloat(c[iTD])||0):(patdBy[k]||0);
      if(iTD>=0 || patdBy[k]==null){ ppr+=2*patd; half+=2*patd; }  // normalize to 6pt storage
      else { ppr+=0; half+=0; }
      if(pos!=="DEF" && ppr<25) continue;
      rows.push([name,(c[iT]||"").trim().toUpperCase(),pos,Math.round(ppr*10)/10,Math.round(half*10)/10,adpBy[k]||0,patd]);
    }
    if(rows.length<50){ toast("Only parsed "+rows.length+" players — import aborted", {warn:true}); e.target.value=""; return; }
    const curNames = new Set(allPlayers().map(p=>normName(p.name)));
    const fresh = rows.filter(r2=>!curNames.has(normName(r2[0]))).length;
    const noHist = rows.filter(r2=>typeof PLAYERMETA==="undefined" || !PLAYERMETA[normName(r2[0])]).length;
    if(!confirm("Import preview:\n• "+rows.length+" players parsed\n• "+fresh+" names not on the current board\n• "+noHist+" new faces without history data (rookies/moves)\n• current dataset will be replaced (backup saved)\n\nApply?")){ e.target.value=""; return; }
    backupState();
    S.dataRows=rows; S.dataRev=(S.dataRev||0)+1;
    commit(); refreshProjStatus();
    toast("Loaded "+rows.length+" players from CSV");
  };
  rd.readAsText(f);
  e.target.value="";
});

/* Personal prep export/import (#319) */
document.getElementById("prepExportBtn").addEventListener("click", ()=>{
  const prep = {__warRoomPrep:1, notes:S.notes, boost:S.boost, tierBump:S.tierBump, adpOverride:S.adpOverride,
                dnd:S.dnd, queue:S.queue, queueRounds:S.queueRounds, plan:S.plan};
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(prep,null,2)],{type:"application/json"}));
  a.download = "war-room-prep.json"; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById("prepImportBtn").addEventListener("click", ()=>document.getElementById("prepFile").click());
document.getElementById("prepFile").addEventListener("change", e=>{
  const f = e.target.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = ()=>{
    try{
      const j = JSON.parse(rd.result);
      if(!j.__warRoomPrep) throw 0;
      ["notes","boost","tierBump","adpOverride","dnd","queueRounds","plan"].forEach(k=>Object.assign(S[k], j[k]||{}));
      (j.queue||[]).forEach(id=>{ if(!S.queue.includes(id)) S.queue.push(id); });
      commit(); toast("📥 Prep merged (notes, boosts, plan, queue)");
    }catch(err){ toast("Not a prep file", {warn:true}); }
  };
  rd.readAsText(f); e.target.value = "";
});

/* Board profiles */
const PROF_KEY = LS_KEY+"-profiles";
function renderAchievements(){
  const box = document.getElementById("achCase");
  if(!box) return;
  let got = {};
  try{ got = JSON.parse(localStorage.getItem(LS_KEY+"-ach")||"{}"); }catch(e){}
  box.innerHTML = ACHIEVEMENTS.map(([id,label,desc])=>
    '<span class="chip" style="'+(got[id]?'color:var(--gold);border-color:rgba(255,201,77,.5)':'opacity:.45')+'" title="'+esc(desc)+(got[id]?' — earned '+new Date(got[id]).toLocaleDateString():' — locked')+'">'+label+'</span> ').join("");
}
function renderTrophies(){
  const box = document.getElementById("trophyCase");
  if(!box) return;
  const all = profAll();
  const finals = Object.keys(all).filter(n=>n.startsWith("🏁"));
  if(!finals.length){ box.innerHTML = '<span class="dimtxt">No finished drafts yet — finish one and it lands here automatically.</span>'; return; }
  const byId = idIndex();
  box.innerHTML = finals.map(n=>{
    let pts = "";
    try{
      const st2 = all[n];
      const ids = (st2.mine||[]).concat(Object.keys(st2.keepers||{}).filter(id=>+st2.keepers[id]===+(st2.settings||{}).slot));
      if(ids.length) pts = fmt(bestStarters(ids, byId).pts)+" pts";
    }catch(e){}
    return '<div class="mkrow">🏆 <span class="mn">'+esc(n)+'</span> <span class="mono dimtxt">'+pts+'</span></div>';
  }).join("");
}
function profAll(){ try{ return JSON.parse(localStorage.getItem(PROF_KEY))||{}; }catch(e){ return {}; } }
function refreshProfiles(){
  const sel=$("#profileSel"); if(!sel) return;
  const names=Object.keys(profAll());
  sel.innerHTML = names.length ? names.map(n=>'<option>'+esc(n)+'</option>').join("") : '<option value="">(none saved)</option>';
  const q = document.getElementById("profQuick");
  if(q){
    q.style.display = names.length ? "" : "none";
    q.innerHTML = '<option value="">'+esc((S.settings.flair||"boards")+"…")+'</option>'+names.map(n=>'<option>'+esc(n)+'</option>').join("");
  }
}
document.getElementById("profQuick").addEventListener("change", e=>{
  const name = e.target.value; if(!name) return;
  const all = profAll();
  if(!all[name]) return;
  if(!confirm("Switch to board '"+name+"'? Current board is backed up.")) { e.target.value=""; return; }
  backupState();
  S = Object.assign(defaultState(), migrate(all[name]));
  e.target.value = "";
  commit(); toast("Loaded: "+esc(name));
});
$("#profSnap").addEventListener("click", ()=>{
  const all = profAll();
  const name = "📸 "+new Date().toLocaleString([], {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});
  all[name] = JSON.parse(JSON.stringify(S));
  localStorage.setItem(PROF_KEY, JSON.stringify(all));
  refreshProfiles(); toast("Snapshot saved: "+esc(name));
});
$("#profSave").addEventListener("click", ()=>{
  const name=prompt("Save current board as:", S.settings.name||"Board 1");
  if(!name) return;
  const all=profAll(); all[name]=JSON.parse(JSON.stringify(S));
  localStorage.setItem(PROF_KEY, JSON.stringify(all));
  refreshProfiles(); toast("Saved profile: "+esc(name));
});
$("#profLoad").addEventListener("click", ()=>{
  const name=$("#profileSel").value; const all=profAll();
  if(!name || !all[name]) return toast("No profile selected", {warn:true});
  if(!confirm("Load '"+name+"'? Current board is backed up first.")) return;
  backupState();
  S = Object.assign(defaultState(), all[name]);
  $("#settingsOverlay").classList.remove("show");
  commit(); toast("Loaded profile: "+esc(name));
});
$("#profDel").addEventListener("click", ()=>{
  const name=$("#profileSel").value; const all=profAll();
  if(!name || !all[name]) return;
  if(!confirm("Delete profile '"+name+"'?")) return;
  delete all[name];
  localStorage.setItem(PROF_KEY, JSON.stringify(all));
  refreshProfiles();
});

async function copyShareLink(){
  try{
    const cs = new Blob([JSON.stringify(S)]).stream().pipeThrough(new CompressionStream("gzip"));
    const buf = new Uint8Array(await new Response(cs).arrayBuffer());
    let bin = ""; buf.forEach(b=>bin+=String.fromCharCode(b));
    const b64 = btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    const url = location.origin+location.pathname+"#b="+b64+(window._shareRO?"~ro":"");
    await navigator.clipboard.writeText(url);
    toast((window._shareRO?"👁 Spectator":"🔗 Board")+" link copied ("+(url.length/1024).toFixed(1)+" KB)");
    window._shareRO = false;
  }catch(e){ toast("Share link failed: "+esc(e.message), {warn:true}); }
}
async function loadSharedBoard(){
  const m = location.hash.match(/#b=([A-Za-z0-9_-]+)(~ro)?/);
  if(!m) return false;
  if(m[2]){ window._spectate = true; document.body.classList.add("spectate"); }
  try{
    const bin = Uint8Array.from(atob(m[1].replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
    const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"));
    const j = JSON.parse(await new Response(ds).text());
    if(!window._spectate) backupState();
    S = Object.assign(defaultState(), migrate(j));
    S.slotNames = Object.assign(defaultState().slotNames, j.slotNames||{});
    history.replaceState(null, "", location.pathname);
    if(window._spectate) toast("👁 Spectating a shared board — nothing is saved");
    else { save(); toast("📥 Shared board loaded — your previous board is in Settings → Restore backup"); }
    return true;
  }catch(e){ toast("Share link unreadable", {warn:true}); return false; }
}
document.getElementById("shareBtn").addEventListener("click", copyShareLink);
document.getElementById("roShareBtn").addEventListener("click", ()=>{ window._shareRO = true; copyShareLink(); });

/* Auto-backup before destructive actions */
let _idb = null;
try{
  const req = indexedDB.open("war-room", 1);
  req.onupgradeneeded = ()=>req.result.createObjectStore("kv");
  req.onsuccess = ()=>{ _idb = req.result; };
}catch(e){}
function idbMirror(payload){
  if(!_idb) return;
  try{
    const tx = _idb.transaction("kv","readwrite");
    tx.objectStore("kv").put(payload, "state");
    tx.objectStore("kv").put(Date.now(), "when");
  }catch(e){}
}
function backupState(){
  try{ localStorage.setItem(LS_KEY+"-backup", JSON.stringify({when:new Date().toLocaleString(), state:S})); }catch(e){}
}

/* Export / Import / Reset */
$("#exportBtn").addEventListener("click", ()=>{
  const full = {__warRoomBackup:1, build:BUILD, when:new Date().toISOString(), state:S, profiles:profAll()};
  try{ full.injuries = JSON.parse(localStorage.getItem(LS_KEY+"-inj")); }catch(e2){}
  const blob = new Blob([JSON.stringify(full,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "draft-war-room-save.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
$("#importBtn").addEventListener("click", ()=>$("#importFile").click());
$("#importFile").addEventListener("change", e=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      const parsed = JSON.parse(r.result);
      backupState();
      if(parsed.__warRoomBackup){
        S = Object.assign(defaultState(), migrate(parsed.state||{}));
        if(parsed.profiles) localStorage.setItem(PROF_KEY, JSON.stringify(parsed.profiles));
        if(parsed.injuries) localStorage.setItem(LS_KEY+"-inj", JSON.stringify(parsed.injuries));
        initInjuries();
        toast("📥 Full backup restored ("+(parsed.when||"").slice(0,10)+")");
      } else {
        S = Object.assign(defaultState(), migrate(parsed));
      }
      commit();
    }catch(err){ alert("Invalid save file"); }
  };
  r.readAsText(f);
  e.target.value="";
});
$("#resetBtn").addEventListener("click", ()=>{
  if(confirm("Reset the whole board? This clears your roster, taken players, and log. (Settings & custom players are kept. A backup is saved — restore it from ⚙ Settings.)")){
    backupState();
    const keep = {settings:S.settings, custom:S.custom, overrides:S.overrides, notes:S.notes, dnd:S.dnd};
    S = Object.assign(defaultState(), keep);
    commit();
  }
});


window.__mod = window.__mod || []; window.__mod.push("wire.js");
