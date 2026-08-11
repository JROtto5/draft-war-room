/* ============================================================
   win.js — the Win Hundred (#740–#839): hype engine, opponent
   scouting, matchup simulator, live war room v2, rituals.
   Loads after season.js; definitions only at load time.
   ============================================================ */

/* ---------- R46 Hype engine (#755–#769) ---------- */
function hypeDial(){ return S.settings.hype || "standard"; }                     // #755
function humilityGuard(){                                                        // #768
  try{
    const hist = seasonArchive(); if(!hist.length) return false;
    const last = myWeeklyRows(hist).slice(-1)[0];
    if(!last || !last.opp || last.m.points>=last.opp.points) return false;
    const lastAt = +localStorage.getItem(LS_KEY+"-lastLossAt")||0;
    const wk = hist.length;
    if(+localStorage.getItem(LS_KEY+"-lastLossWk")!==wk){
      localStorage.setItem(LS_KEY+"-lastLossWk", String(wk));
      localStorage.setItem(LS_KEY+"-lastLossAt", String(Date.now()));
      return true;
    }
    return Date.now()-lastAt < 2*86400e3;
  }catch(e){ return false; }
}
function hypeOn(min){                                                            // dial gate
  const d = hypeDial();
  if(d==="mild" && min!=="mild") return false;
  if(min==="full" && d!=="full") return false;
  if(humilityGuard() && min==="full") return false;
  return true;
}
function myStandingsRow(){
  try{
    const st = standingsRows(SCOREB.rosters, SCOREB.users);
    const myRid = +S.settings.sleeperRosterId;
    const i = st.findIndex(r=>r.rid===myRid);
    return i>=0 ? {row:st[i], place:i+1, n:st.length, st} : null;
  }catch(e){ return null; }
}
function hypeLine(){                                                             // #764
  try{
    const bits = [];
    const ms = myStandingsRow();
    const pr = (typeof powerRankings==="function" && SCOREB.rosters) ? powerRankings() : [];
    const myRid = +S.settings.sleeperRosterId;
    const prIdx = pr.findIndex(r=>r.rid===myRid);
    if(ms && ms.place===1) bits.push("First place. Say it slowly. Fiiiirst plaaaace.");
    if(ms && ms.row.pf && ms.st.every(r=>r.pf<=ms.row.pf)) bits.push("League leader in points. The scoreboard is a fan.");
    if(prIdx===0) bits.push("#1 power ranking — the numbers are blushing.");
    if(prIdx===1) bits.push(ordinal(ms?ms.place:2)+" in the standings, 2nd in power, 1st in vibes.");
    const hist = seasonArchive();
    if(hist.length>=2){
      const rows = myWeeklyRows(hist);
      let streak = 0;
      for(let i=rows.length-1;i>=0;i--){ if(rows[i].opp && rows[i].m.points>rows[i].opp.points) streak++; else break; }
      if(streak>=2) bits.push(streak+" straight. The rest of Buck Breakers is in the group chat worrying about you.");
      const ap = allPlayStandings(hist, SCOREB.rosters, SCOREB.users).find(r=>r.rid===myRid);
      if(ap && ap.luck<-0.8) bits.push("Outscoring the field and STILL owed wins by the football gods. Regression is your friend.");
    }
    if(SEASON.lastOdds && SEASON.lastOdds[myRid]>=70) bits.push(SEASON.lastOdds[myRid]+"% playoff odds. Book the flights.");
    if(!bits.length) bits.push("Best total roster in the league on draft day. That didn't expire.",
      "Slot 12 built a monster. Act like it.",
      "Two starting QBs by round 3 while the league slept. Still smiling about it.");
    return bits[Math.floor(Math.random()*bits.length)];
  }catch(e){ return "Draft grade: A. Bench: deepest in the league. Proceed accordingly."; }
}
function trashTalk(){                                                            // #757
  try{
    const md = WEEKST.mate;
    if(!md || !md.opp) return "No opponent found. They may have already forfeited out of respect.";
    const lines = [];
    const hist = seasonArchive();
    const oppRid = md.opp.rid;
    if(hist.length){
      const byId = idIndex();
      const oppRows = hist.map(wm=>(wm||[]).find(x=>+x.roster_id===+oppRid)).filter(Boolean);
      const effs = oppRows.map(m=>lineupEffOf(m, byId)).filter(Boolean);
      if(effs.length){
        const avg = Math.round(effs.reduce((a,e2)=>a+e2.eff,0)/effs.length);
        if(avg<90) lines.push(esc(md.opp.name)+" has left "+avg+"% lineup efficiency on the table all season. They will find a way.");
      }
      const ap = allPlayStandings(hist, SCOREB.rosters, SCOREB.users).find(r=>+r.rid===+oppRid);
      if(ap && ap.luck>0.8) lines.push(esc(md.opp.name)+" is +"+ap.luck+" wins of pure luck. The bill comes due this week.");
      const aw = weeklyAwards(hist[hist.length-1], SCOREB);
      if(aw && +aw.lo.rid===+oppRid) lines.push("Fresh off the league-low "+aw.lo.pts+". Thoughts and prayers.");
    }
    const s2o = sleeperToOurs(), byId2 = idIndex();
    const theirHurt = (md.opp.ids||[]).map(id=>byId2[id]).filter(Boolean).filter(p=>injuryOf(p)).length;
    if(theirHurt>=2) lines.push("Their training room is fuller than their trophy case ("+theirHurt+" flagged).");
    if(!lines.length) lines.push("Projections have you winning. Projections are polite. It won't be that close.",
      "They drafted feelings. You drafted a bench that covers every bye week. Different sports.");
    return lines[Math.floor(Math.random()*lines.length)];
  }catch(e){ return "The engine refuses to even simulate them losing this badly again."; }
}
function nicknameOf(p){                                                          // #763
  try{
    const hist = seasonArchive(); if(hist.length<3) return null;
    const wk = (playerWeekly(hist)[p.id]||[]).filter(x=>x!=null);
    if(wk.length<3) return null;
    const last3 = wk.slice(-3);
    if(last3.every(x=>x>=15)) return "The Franchise";
    if(last3.every(x=>x>=10)) return "Old Reliable";
    const c = consistencySeason(wk);
    if(c && c.tag.includes("boom") && Math.max(...wk)>=25) return "The Lottery Ticket";
    if(wk[wk.length-1]>=25) return "Him";
    return null;
  }catch(e){ return null; }
}
function streakChipUpdate(){                                                     // #760
  try{
    let chip = document.getElementById("streakChip");
    const hist = seasonArchive();
    if(!hist.length){ if(chip) chip.hidden = true; return; }
    const rows = myWeeklyRows(hist);
    let streak = 0;
    for(let i=rows.length-1;i>=0;i--){ if(rows[i].opp && rows[i].m.points>rows[i].opp.points) streak++; else break; }
    if(!chip){
      chip = document.createElement("span"); chip.id = "streakChip"; chip.className = "mvpchip";
      const anchor = document.getElementById("mvpChip");
      if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(chip, anchor);
    }
    if(streak>=2){ chip.hidden = false; chip.textContent = "🔥×"+streak; chip.title = streak+"-game win streak"; }
    else chip.hidden = true;
  }catch(e){}
}
function titleChaseHtml(){                                                       // #761
  try{
    if(!SEASON.lastOdds) return "";
    const myRid = +S.settings.sleeperRosterId;
    const odds = SEASON.lastOdds[myRid]; if(odds==null) return "";
    const k = LS_KEY+"-titlehist";
    let th = []; try{ th = JSON.parse(localStorage.getItem(k)||"[]"); }catch(e){}
    const wk = curWeek();
    if(!th.length || th[th.length-1].w!==wk){ th.push({w:wk, o:odds}); localStorage.setItem(k, JSON.stringify(th.slice(-18))); }
    const toGo = Math.max(0, 17-wk);
    return '<div class="benchhead">👑 Title chase: <b class="mono">'+odds+'%</b> to the dance · '+toGo+' week'+(toGo===1?'':'s')+' to the money game</div>'+
      (th.length>=3 ? '<div style="padding:0 10px 6px">'+chartArea(th.map(x=>x.o), {h:36, min:0, max:100, ref:50,
        label:"playoff odds by week, now "+odds+" percent", fmt:v=>Math.round(v)+"%"})+'</div>' : '');
  }catch(e){ return ""; }
}
function victoryLap(){                                                           // #762
  try{
    if(!hypeOn("mild")) return;
    const hist = seasonArchive(); if(!hist.length) return;
    const wk = hist.length;
    const k = LS_KEY+"-vlap";
    if(+localStorage.getItem(k)===wk) return;
    const last = myWeeklyRows(hist).slice(-1)[0];
    if(!last || !last.opp || last.m.points<=last.opp.points) return;
    localStorage.setItem(k, String(wk));
    if(typeof confetti==="function") try{ confetti("gold"); }catch(e2){}
    if(typeof chime==="function") try{ chime(); }catch(e2){}
    toast("🏆 THAT'S A DUB — week "+wk+" goes to Otto5, "+last.m.points.toFixed(1)+"–"+last.opp.points.toFixed(1)+". 📖 Recap has your W card.");
  }catch(e){}
}
function oppCrumbleWatch(){                                                      // #767
  try{
    if(!hypeOn("full") || !SEASON.lastOdds) return;
    const rs = +S.settings.rivalSlot, s2r = S.settings.slot2rid;
    if(!rs || !s2r) return;
    const rrid = +s2r[String(rs)];
    const cur = SEASON.lastOdds[rrid]; if(cur==null) return;
    const k = LS_KEY+"-rivodds";
    const prev = +localStorage.getItem(k);
    localStorage.setItem(k, String(cur));
    if(prev && prev-cur>=10) alertFire("crumble", "😈 Rival watch: "+ridName(rrid)+" playoff odds fell "+(prev-cur)+"%", "From "+prev+"% to "+cur+"%. Nature is healing.");
  }catch(e){}
}
function hypeCard(){                                                             // #756
  const ms = myStandingsRow();
  const md = WEEKST.mate;
  const wm = (typeof winModeFor==="function") ? winModeFor() : {wp:0.5};
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1080;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0,0,0,1080);
  g.addColorStop(0,"#0b0f14"); g.addColorStop(1,"#131a24");
  x.fillStyle = g; x.fillRect(0,0,1080,1080);
  x.fillStyle = "#f0b429"; x.font = "bold 72px sans-serif"; x.fillText("OTTO5", 60, 130);
  x.fillStyle = "#e8eef5"; x.font = "bold 44px sans-serif";
  x.fillText(ms ? ms.row.w+"-"+ms.row.l+(ms.row.t?"-"+ms.row.t:"")+" · "+ordinal(ms.place)+" place" : "Buck Breakers", 60, 210);
  if(md && md.opp){
    x.fillStyle = "#8b98a9"; x.font = "36px sans-serif";
    x.fillText("WEEK "+curWeek()+" · vs "+md.opp.name, 60, 300);
    x.fillStyle = "#2fd47a"; x.font = "bold 120px sans-serif";
    x.fillText(Math.round(wm.wp*100)+"%", 60, 450);
    x.fillStyle = "#8b98a9"; x.font = "32px sans-serif"; x.fillText("to win, per the machine", 60, 500);
  }
  x.fillStyle = "#e8eef5"; x.font = "italic 38px sans-serif";
  const line = hypeLine();
  const words = line.split(" "); let ln = "", y2 = 640;
  words.forEach(w2=>{ if((ln+w2).length>42){ x.fillText(ln, 60, y2); y2 += 52; ln = ""; } ln += w2+" "; });
  if(ln.trim()) x.fillText(ln.trim(), 60, y2);
  x.fillStyle = "#f0b429"; x.font = "bold 40px sans-serif"; x.fillText("LET'S RIDE. 🏈", 60, 980);
  x.fillStyle = "#556270"; x.font = "24px sans-serif"; x.fillText("draft-war-room · Buck Breakers", 60, 1040);
  c.toBlob(b=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "hype-week-"+curWeek()+".png"; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  });
  toast("🔥 Hype card downloaded — post it before kickoff");
}
function receiptsCard(){                                                         // #765
  const hist = seasonArchive();
  const droi = hist.length>=3 ? draftRoi(hist) : null;
  const c = document.createElement("canvas"); c.width = 1000; c.height = 700;
  const x = c.getContext("2d");
  x.fillStyle = "#0b0f14"; x.fillRect(0,0,1000,700);
  x.fillStyle = "#f0b429"; x.font = "bold 52px sans-serif"; x.fillText("THE RECEIPTS 🧾", 40, 90);
  x.fillStyle = "#8b98a9"; x.font = "26px sans-serif"; x.fillText("Otto5's draft, audited by reality", 40, 130);
  x.font = "30px sans-serif";
  if(droi && droi.steals.length){
    droi.steals.slice(0,5).forEach((r,i)=>{
      x.fillStyle = "#2fd47a";
      x.fillText("💎 "+r.p.name+" — pick "+r.pick+", playing like #"+r.ptsRank, 40, 210+i*54);
    });
  } else {
    const preset = [["Rashee Rice","fell 36 past ADP — took him anyway"],["Breece Hall","fell 34 — thank you for your donation"],
      ["Jayden Reed","48 past market — patience pays"],["Herbert + Stafford","two QB1s by rd 3 in superflex"],["Rachaad White","-71 vs ADP — free real estate"]];
    preset.forEach((r,i)=>{ x.fillStyle = "#2fd47a"; x.fillText("💎 "+r[0]+" — "+r[1], 40, 210+i*54); });
  }
  x.fillStyle = "#e8eef5"; x.font = "italic 30px sans-serif";
  x.fillText("Best total roster on draft day. #2 starters. #1 bench.", 40, 550);
  x.fillStyle = "#f0b429"; x.font = "bold 32px sans-serif"; x.fillText("In the process we trust.", 40, 620);
  c.toBlob(b=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "draft-receipts.png"; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  });
  toast("🧾 Receipts downloaded — serve cold");
}
function pregameSpeech(){                                                        // #758
  if(!("speechSynthesis" in window)) return toast("No speech engine on this device", {warn:true});
  if(!hypeOn("full")) return toast("Pregame speech is a FULL SEND feature — turn the hype dial up in Settings", {warn:true});
  const md = WEEKST.mate;
  const byId = idIndex(), w = curWeek();
  const bs = bestStartersWeek(rosterIds(), byId, w);
  const stars = bs.line.filter(sl=>sl.p && sl.wp>=14).map(sl=>sl.p.name.split(" ").slice(-1)[0]).slice(0,3);
  const text = "Listen up. Week "+w+". "+(md&&md.opp ? md.opp.name+" thinks they have a chance. They do not. " : "")+
    (stars.length ? stars.join(", ")+" — you eat first. " : "")+
    "We set the lineup. We checked the injuries. We did the work while they were asleep. "+
    "Sixty minutes. Every point. Let's ride.";
  try{
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){ toast(text); }
}
function egoDash(){                                                              // #759
  const old = document.getElementById("egoOverlay"); if(old){ old.remove(); return; }
  const ms = myStandingsRow();
  const hist = seasonArchive();
  const rows = hist.length ? myWeeklyRows(hist) : [];
  const myRid = +S.settings.sleeperRosterId;
  const pr = (SCOREB.rosters) ? powerRankings() : [];
  const prIdx = pr.findIndex(r=>r.rid===myRid);
  const ap = hist.length ? allPlayStandings(hist, SCOREB.rosters, SCOREB.users).find(r=>r.rid===myRid) : null;
  const effs = rows.map(r=>r.eff?r.eff.eff:null).filter(Boolean);
  const items = [
    ["🎓 Draft grade", "A — best total roster, receipts available"],
    ms ? ["📊 Record", ms.row.w+"-"+ms.row.l+(ms.row.t?"-"+ms.row.t:"")+" · "+ordinal(ms.place)+" of "+ms.n] : null,
    prIdx>=0 ? ["⚡ Power rank", ordinal(prIdx+1)+(prIdx===0?" — the machine bows":"")] : null,
    effs.length ? ["🎯 Lineup efficiency", Math.round(effs.reduce((a,b)=>a+b,0)/effs.length)+"% — decisions, not luck"] : null,
    ap ? ["🍀 Luck ledger", ap.luck<=0 ? "earned every win (+"+(-ap.luck)+" owed)" : "+"+ap.luck+" wins charmed"] : null,
    SEASON.lastOdds && SEASON.lastOdds[myRid]!=null ? ["👑 Playoff odds", SEASON.lastOdds[myRid]+"%"] : null,
    ["🛡 Bye coverage", "weeks 7 and 11 pre-solved on draft day"],
  ].filter(Boolean);
  const ov = document.createElement("div"); ov.id = "egoOverlay"; ov.className = "snov";
  ov.innerHTML = '<div class="sbcard" role="dialog" aria-label="Ego dashboard"><button class="sbx" data-egx="1">✕</button>'+
    '<div class="tag">😤 THE EGO DASHBOARD</div>'+
    '<div class="benchhead" style="font-size:14px;color:var(--gold)">'+esc(hypeLine())+'</div>'+
    items.map(x=>'<div class="sbply"><span>'+x[0]+'</span><b>'+esc(x[1])+'</b></div>').join("")+
    '<div style="padding:10px 0;display:flex;gap:8px;flex-wrap:wrap">'+
    '<button class="hbtn" data-act="hypeCard">🔥 Hype card</button>'+
    '<button class="hbtn" data-act="receiptsCard">🧾 Receipts</button>'+
    '<button class="hbtn" data-act="pregameSpeech">🎙 Speech</button>'+
    '<button class="hbtn" id="ttBtn">🗣 Trash talk</button></div><div id="ttOut"></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-egx]")) return ov.remove();
    if(e.target.id==="ttBtn"){
      const line = trashTalk();
      document.getElementById("ttOut").innerHTML = '<div class="benchhead">'+line+' <button class="undo1" data-ttcopy="1">📋</button></div>';
    }
    if(e.target.closest("[data-ttcopy]")){
      const el = document.getElementById("ttOut");
      navigator.clipboard.writeText(el.textContent.replace("📋","").trim()).then(()=>toast("📋 Copied — deploy responsibly"));
    }
  });
}
function entranceSplash(){                                                       // #766
  try{
    if(!hypeOn("mild") || new Date().getDay()!==0) return;
    const k = LS_KEY+"-entrance";
    const stamp = new Date().toDateString();
    if(localStorage.getItem(k)===stamp) return;
    localStorage.setItem(k, stamp);
    const ms = myStandingsRow();
    const md = WEEKST.mate;
    const ov = document.createElement("div"); ov.id = "entOverlay"; ov.className = "snov";
    ov.innerHTML = '<div class="sbcard" style="text-align:center;max-width:480px" role="dialog">'+
      '<div style="font-size:40px;padding:8px">🏈</div>'+
      '<div class="tag" style="justify-content:center">SUNDAY. WEEK '+curWeek()+'.</div>'+
      (ms?'<div class="benchhead" style="font-size:16px;justify-content:center">'+ms.row.w+'-'+ms.row.l+' · '+ordinal(ms.place)+' place</div>':'')+
      (md&&md.opp?'<div class="sbply" style="justify-content:center">vs '+esc(md.opp.name)+'</div>':'')+
      '<div class="benchhead" style="color:var(--gold);justify-content:center">'+esc(hypeLine())+'</div>'+
      '<button class="hbtn" data-entgo="1" style="margin-top:12px;border-color:var(--green);color:var(--green);font-size:15px">LET\'S RIDE →</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", e=>{ if(e.target===ov || e.target.closest("[data-entgo]")) ov.remove(); });
  }catch(e){}
}
function hypeTick(){ streakChipUpdate(); victoryLap(); oppCrumbleWatch(); entranceSplash(); scoutDigest(); }

/* ---------- R47 Opponent scouting (#770–#784) ---------- */
function sloppinessOf(rid, hist){                                                // pure (#772)
  const byId = idIndex();
  const effs = (hist||[]).map(wm=>(wm||[]).find(x=>+x.roster_id===+rid)).filter(Boolean)
    .map(m=>lineupEffOf(m, byId)).filter(Boolean);
  if(!effs.length) return null;
  const avg = Math.round(effs.reduce((a,e2)=>a+e2.eff,0)/effs.length);
  const left = Math.round(effs.reduce((a,e2)=>a+(e2.opt-e2.actual),0)*10)/10;
  return {eff:avg, left, weeks:effs.length};
}
function posStrengthOf(ids, byId){
  const ps = ids.map(id=>byId[id]).filter(Boolean);
  const top = (pos,n)=>ps.filter(p=>p.pos===pos).sort((a,b)=>b.proj-a.proj).slice(0,n).reduce((a,p)=>a+p.proj,0);
  return {QB:top("QB",2), RB:top("RB",3), WR:top("WR",3), TE:top("TE",2)};
}
function strengthDelta(rid){                                                     // #778
  const byId = idIndex();
  const mine = posStrengthOf(rosterIds(), byId);
  const theirs = posStrengthOf(leagueRosterIds(rid), byId);
  return ["QB","RB","WR","TE"].map(pos=>({pos, me:Math.round(mine[pos]), them:Math.round(theirs[pos]),
    d:Math.round(mine[pos]-theirs[pos])}));
}
function benchVsBench(rid){                                                      // #779
  const byId = idIndex();
  const mineBs = bestStarters(rosterIds(), byId);
  const theirIds = leagueRosterIds(rid);
  const theirBs = bestStarters(theirIds, byId);
  const myBench = rosterIds().map(id=>byId[id]).filter(Boolean).filter(p=>!mineBs.starterIds.has(p.id)&&p.pos!=="DEF");
  const wouldStart = myBench.filter(b=>{
    const theirWorst = [...theirBs.starterIds].map(id=>byId[id]).filter(Boolean).filter(p=>p.pos===b.pos).sort((a,b2)=>a.proj-b2.proj)[0];
    return theirWorst && b.proj>theirWorst.proj;
  });
  return {myBenchN:myBench.length, wouldStart};
}
function exploitFinder(rid){                                                     // #773
  const byId = idIndex(), w = curWeek(), out = [];
  const theirIds = leagueRosterIds(rid).map(id=>byId[id]).filter(Boolean);
  for(let fw=Math.max(w,5); fw<=14; fw++){
    const outP = theirIds.filter(p=>typeof BYES!=="undefined" && BYES[p.team]===fw);
    if(outP.length>=3) out.push({w:fw, kind:"bye crunch", note:outP.length+" starters-ish on bye ("+outP.slice(0,3).map(p=>p.name.split(" ").slice(-1)[0]).join(", ")+")"});
  }
  const sd = strengthDelta(rid);
  const weakest = sd.slice().sort((a,b)=>a.them-b.them)[0];
  if(weakest) out.push({w:null, kind:"thin room", note:"weakest at "+weakest.pos+" — dangle "+weakest.pos+" depth in trades, overprice it"});
  return out.slice(0,4);
}
function leagueTendencies(txAll, hist){                                          // pure (#774)
  const byId = idIndex();
  const rows = {};
  (SCOREB.rosters||[]).forEach(r=>{ rows[r.roster_id] = {rid:r.roster_id, name:ridName(r.roster_id), faab:0, claims:0, trades:0, zeros:0}; });
  (txAll||[]).forEach(t=>{
    const rid = t.rids && t.rids[0];
    if(!rows[rid]) return;
    if(t.type==="trade") t.rids.forEach(r2=>{ if(rows[r2]) rows[r2].trades++; });
    else { rows[rid].claims++; rows[rid].faab += t.bid||0; }
  });
  const s2o = sleeperToOurs();
  (hist||[]).forEach(wm=>(wm||[]).forEach(m=>{
    if(!rows[m.roster_id] || !m.players_points) return;
    (m.starters||[]).forEach(sid=>{
      const oid = s2o[String(sid)];
      if(oid && (+m.players_points[sid]||0)===0) rows[m.roster_id].zeros++;
    });
  }));
  return Object.values(rows);
}
function h2hLedger(hist){                                                        // pure (#775)
  const myRid = +S.settings.sleeperRosterId, out = {};
  (hist||[]).forEach((wm,wi)=>{
    const m = (wm||[]).find(x=>+x.roster_id===myRid); if(!m) return;
    const opp = (wm||[]).find(x=>x.matchup_id===m.matchup_id && +x.roster_id!==myRid); if(!opp) return;
    const o = out[opp.roster_id] = out[opp.roster_id] || {rid:opp.roster_id, w:0, l:0, games:[]};
    if(m.points>opp.points) o.w++; else if(m.points<opp.points) o.l++;
    o.games.push("W"+(wi+1)+" "+(m.points>opp.points?"W":"L")+" "+m.points.toFixed(0)+"–"+opp.points.toFixed(0));
  });
  return out;
}
function kryptonite(hist){                                                       // #776
  const myRid = +S.settings.sleeperRosterId, byId = idIndex(), s2o = sleeperToOurs();
  const mine = {}, minG = {};
  (hist||[]).forEach(wm=>{
    const m = (wm||[]).find(x=>+x.roster_id===myRid); if(!m || !m.players_points) return;
    (m.starters||[]).forEach(sid=>{
      const p = byId[s2o[String(sid)]]; if(!p) return;
      mine[p.pos] = (mine[p.pos]||0) + (+m.players_points[sid]||0);
      minG[p.pos] = (minG[p.pos]||0) + 1;
    });
  });
  const rows = Object.keys(mine).filter(pos=>pos!=="DEF" && minG[pos]>=3)
    .map(pos=>({pos, avg:Math.round(mine[pos]/minG[pos]*10)/10}));
  if(!rows.length) return null;
  return rows.sort((a,b)=>a.avg-b.avg)[0];
}
async function scoutReport(rid){                                                 // #770
  const old = document.getElementById("scOverlay"); if(old){ old.remove(); return; }
  if(!SCOREB.rosters) await leagueWeekData(false);
  if(!SCOREB.rosters) return toast("Link your Sleeper league first", {warn:true});
  const byId = idIndex(), w = curWeek();
  const hist = await leagueHistory();
  const txAll = await txHistory();
  const name = ridName(rid);
  const theirIds = leagueRosterIds(rid);
  const theirBs = bestStartersWeek(theirIds, byId, w);
  const slop = sloppinessOf(rid, hist);
  const sd = strengthDelta(rid);
  const bb = benchVsBench(rid);
  const exps = exploitFinder(rid);
  const tend = leagueTendencies(txAll, hist).find(r=>+r.rid===+rid);
  const h2h = h2hLedger(hist)[rid];
  const hurt = theirIds.map(id=>byId[id]).filter(Boolean).map(p=>({p, e:injuryOf(p)})).filter(x=>x.e)
    .map(x=>({...x, sv:injSeverity(x.e.s)}));
  const kr = kryptonite(hist);
  const mx = Math.max(...sd.map(x=>Math.max(x.me, x.them)), 1);
  const ov = document.createElement("div"); ov.id = "scOverlay"; ov.className = "snov";
  let h = '<div class="sbcard" role="dialog" aria-label="Scouting report"><button class="sbx" data-scx="1">✕</button>';
  h += '<div class="tag">🕵️ SCOUTING REPORT: '+esc(name)+'</div>';
  h += '<div class="sbply"><span>week '+w+' optimal projection</span><b class="mono">'+fmt(theirBs.pts)+((typeof depthGrade==="function")?' · depth '+depthGrade(rid):'')+'</b></div>';
  if(slop) h += '<div class="sbply"><span>😴 Sloppiness index</span><b>'+slop.eff+'% efficiency · '+slop.left+' pts left on bench over '+slop.weeks+' wks</b></div>';
  if(h2h && (h2h.w+h2h.l)>0) h += '<div class="sbply"><span>📒 Head-to-head</span><b>'+h2h.w+'-'+h2h.l+' <span class="dimtxt">'+esc(h2h.games.join(" · "))+'</span></b></div>';
  h += '<div class="benchhead">⚖ Position by position (me ▲ vs them ▼)</div>'+sd.map(x=>
    '<div class="sbrow"><div class="sbteam"><span>'+x.pos+'</span><b class="mono" style="color:var(--'+(x.d>=0?'green':'red')+')">'+(x.d>=0?'+':'')+x.d+'</b></div>'+
    '<div class="sbbar"><i style="width:'+Math.round(x.me/mx*100)+'%"></i></div>'+
    '<div class="sbbar red"><i style="width:'+Math.round(x.them/mx*100)+'%"></i></div></div>').join("");
  if(bb.wouldStart.length) h += '<div class="benchhead">🪑 My bench players who would START for them: '+bb.wouldStart.map(p=>esc(p.name.split(" ").slice(-1)[0])).join(", ")+'</div>';
  if(hurt.length) h += '<div class="benchhead">🩹 Their infirmary</div><div class="scarce">'+
    hurt.map(x=>'<span class="scpill">'+esc(x.p.name)+' <span class="'+x.sv.cls+'">'+x.sv.code+'</span></span>').join("")+'</div>';
  if(exps.length) h += '<div class="benchhead">🎯 Exploits</div>'+exps.map(x=>
    '<div class="sbply"><span>'+(x.w?'W'+x.w+' — ':'')+x.kind+'</span><span class="dimtxt">'+esc(x.note)+'</span></div>').join("");
  if(tend) h += '<div class="sbply"><span>🎰 Tendencies</span><b>$'+tend.faab+' FAAB spent · '+tend.claims+' claims · '+tend.trades+' trades'+(tend.zeros?' · '+tend.zeros+' zero-point starters(!)':'')+'</b></div>';
  if(kr) h += '<div class="sbply"><span>☠ My kryptonite (self-scout)</span><b>'+kr.pos+' averaging '+kr.avg+'/start — feed it or fix it</b></div>';
  h += '<div style="padding:10px 0"><button class="hbtn" id="scPng">📤 Share the beatdown</button> <button class="hbtn" id="scTalk">🗣 Talk</button> <button class="hbtn" data-tradewith="'+rid+'">🔁 Trade with them</button></div><div id="scOut"></div></div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-scx]")) return ov.remove();
    const tw2 = e.target.closest("[data-tradewith]");
    if(tw2){ ov.remove(); tradeWith(tw2.dataset.tradewith); return; }
    if(e.target.id==="scPng") scoutCard(name, sd, slop);                          // #781
    if(e.target.id==="scTalk"){
      const line = slop && slop.eff<92 ? esc(name)+" has donated "+slop.left+" points to their own bench this season. Charity is beautiful."
        : trashTalk();
      document.getElementById("scOut").innerHTML = '<div class="benchhead">'+line+'</div>';
    }
  });
}
function scoutCard(name, sd, slop){                                              // #781
  const c = document.createElement("canvas"); c.width = 1000; c.height = 700;
  const x = c.getContext("2d");
  x.fillStyle = "#0b0f14"; x.fillRect(0,0,1000,700);
  x.fillStyle = "#e5484d"; x.font = "bold 46px sans-serif"; x.fillText("SCOUTED: "+name, 40, 80);
  x.fillStyle = "#8b98a9"; x.font = "24px sans-serif"; x.fillText("by the Otto5 war room · week "+curWeek(), 40, 118);
  const mx = Math.max(...sd.map(r=>Math.max(r.me, r.them)), 1);
  sd.forEach((r,i)=>{
    const y2 = 190+i*110;
    x.fillStyle = "#e8eef5"; x.font = "bold 30px sans-serif"; x.fillText(r.pos, 40, y2);
    x.fillStyle = "#2fd47a"; x.fillRect(130, y2-24, Math.round(r.me/mx*700), 22);
    x.fillStyle = "#e5484d"; x.fillRect(130, y2+4, Math.round(r.them/mx*700), 22);
    x.fillStyle = r.d>=0 ? "#2fd47a" : "#e5484d"; x.font = "bold 26px sans-serif";
    x.fillText((r.d>=0?"+":"")+r.d, 860, y2+4);
  });
  x.fillStyle = "#f0b429"; x.font = "bold 30px sans-serif";
  x.fillText(slop && slop.eff<92 ? "They also left "+slop.left+" pts on their bench this year. 😴" : "The bars don't lie.", 40, 660);
  c.toBlob(b=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "scout-"+name.replace(/\W+/g,"-")+".png"; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  });
  toast("📤 Scout card downloaded");
}
function scoutPicker(){                                                          // #1030
  const old = document.getElementById("spkOverlay"); if(old){ old.remove(); return; }
  if(!SCOREB.rosters) return toast("Link the league first", {warn:true});
  const myRid = +S.settings.sleeperRosterId;
  const ov = document.createElement("div"); ov.id = "spkOverlay"; ov.className = "snov";
  ov.innerHTML = '<div class="sbcard" role="dialog" style="max-width:420px"><button class="sbx" data-spkx="1">✕</button>'+
    '<div class="tag">🕵️ SCOUT WHO?</div>'+
    standingsRows(SCOREB.rosters, SCOREB.users).filter(r=>r.rid!==myRid).map(r=>
    '<div class="sbply" data-scout="'+r.rid+'" style="cursor:pointer" tabindex="0" role="button"><span>'+esc(r.name)+'</span><b class="mono">'+r.w+'-'+r.l+'</b></div>').join("")+'</div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-spkx]")) return ov.remove();
    if(e.target.closest("[data-scout]")) ov.remove();
  });
}
function tradeWith(rid){ window._tradePre = +rid; renderTrades(); }              // #1037
function alertTest(){ alertFire("test", "🔔 Test alert — the chain works", "Toast ✓ log ✓ badge ✓"+(Notification && Notification.permission==="granted" ? " notification ✓" : " (system notifications off)")); }   // #1031
function goalsSet(key){                                                          // #1035
  let g = goalsGet();
  g = g.includes(key) ? g.filter(x=>x!==key) : g.concat(key);
  try{ localStorage.setItem(LS_KEY+"-goals", JSON.stringify(g)); }catch(e){}
  const ov = document.getElementById("rtOverlay"); if(ov){ ov.remove(); renderRituals(); }
}
function scoutMyOpponent(){                                                      // #771
  const md = WEEKST.mate;
  if(!md || !md.opp) return toast("No opponent found this week", {warn:true});
  scoutReport(md.opp.rid);
}
function scoutDigest(){                                                          // #783
  try{
    if(new Date().getDay()!==3) return;
    const md = WEEKST.mate; if(!md || !md.opp) return;
    const k = LS_KEY+"-scdig"+curWeek();
    if(localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    const slop = sloppinessOf(md.opp.rid, seasonArchive());
    alertFire("scout", "🕵️ Scout ready: "+md.opp.name,
      slop ? "They run at "+slop.eff+"% lineup efficiency — the read is in the Ego deck" : "Full report in the war room");
  }catch(e){}
}

/* ---------- R48 Matchup Monte Carlo (#785–#799) ---------- */
const SIM = {cache:{}, lastKey:null};
function normSample(rng){ return (rng()+rng()+rng()+rng()-2)*1.732; }            // ~N(0,1), cheap (#797)
function buildSimLine(bs){                                                       // #786 stack correlation flags
  const teams = {};
  bs.line.filter(sl=>sl.p && sl.wp>0).forEach(sl=>{ teams[sl.p.team] = (teams[sl.p.team]||0)+1; });
  return bs.line.filter(sl=>sl.p && sl.wp>0).map(sl=>({
    name:sl.p.name, mu:sl.wp, sd:Math.min(playerVariance(sl.p), Math.max(2, sl.wp*1.1)),
    team:sl.p.team, corr:teams[sl.p.team]>1
  }));
}
function simSides(myLine, oppLine, n, seed){                                     // pure core (#785)
  const rng = (typeof mulberry32==="function") ? mulberry32(seed==null?1234:seed) : Math.random;
  const my = new Float64Array(n), opp = new Float64Array(n);
  let wins = 0;
  const mN = myLine.length, oN = oppLine.length;
  const aboveN = new Float64Array(mN), aboveW = new Float64Array(mN);
  for(let s2=0; s2<n; s2++){
    const shA = {}, shB = {};
    let a = 0, b = 0;
    for(let i=0; i<mN; i++){
      const pl = myLine[i];
      let z = normSample(rng);
      if(pl.corr){ if(shA[pl.team]==null) shA[pl.team] = normSample(rng); z = 0.75*z + 0.55*shA[pl.team]; }
      const v = Math.max(0, pl.mu + z*pl.sd);
      a += v;
      if(v>pl.mu) aboveN[i]++;
    }
    for(let i=0; i<oN; i++){
      const pl = oppLine[i];
      let z = normSample(rng);
      if(pl.corr){ if(shB[pl.team]==null) shB[pl.team] = normSample(rng); z = 0.75*z + 0.55*shB[pl.team]; }
      b += Math.max(0, pl.mu + z*pl.sd);
    }
    my[s2] = a; opp[s2] = b;
    if(a>b){ wins++; for(let i=0;i<mN;i++){ const pl=myLine[i]; /* re-derive above? cheap flag: */ } }
  }
  // second pass for leverage (#791): correlate "player beat his mean" with wins
  const wp = wins/n;
  // percentile + margins
  const sortedMy = Array.from(my).sort((x,y)=>x-y);
  let blow = 0, blown = 0, close = 0;
  for(let s2=0; s2<n; s2++){
    const d = my[s2]-opp[s2];
    if(d>=30) blow++; else if(d<=-30) blown++;
    if(Math.abs(d)<=9) close++;
  }
  return {wp, n,
    p10:Math.round(sortedMy[Math.floor(n*0.1)]*10)/10,
    p50:Math.round(sortedMy[Math.floor(n*0.5)]*10)/10,
    p90:Math.round(sortedMy[Math.floor(n*0.9)]*10)/10,
    blow:Math.round(blow/n*100), blown:Math.round(blown/n*100), close:Math.round(close/n*100),
    my, opp};
}
function simLeverage(myLine, oppLine, n, seed){                                  // #791
  const rng = (typeof mulberry32==="function") ? mulberry32((seed==null?1234:seed)+7) : Math.random;
  const mN = myLine.length;
  const upN = new Float64Array(mN), upW = new Float64Array(mN);
  let wins = 0;
  for(let s2=0; s2<n; s2++){
    const shA = {}, shB = {}, vals = new Float64Array(mN);
    let a = 0, b = 0;
    for(let i=0; i<mN; i++){
      const pl = myLine[i];
      let z = normSample(rng);
      if(pl.corr){ if(shA[pl.team]==null) shA[pl.team] = normSample(rng); z = 0.75*z + 0.55*shA[pl.team]; }
      vals[i] = Math.max(0, pl.mu + z*pl.sd); a += vals[i];
    }
    for(let i=0; i<oppLine.length; i++){
      const pl = oppLine[i];
      let z = normSample(rng);
      if(pl.corr){ if(shB[pl.team]==null) shB[pl.team] = normSample(rng); z = 0.75*z + 0.55*shB[pl.team]; }
      b += Math.max(0, pl.mu + z*pl.sd);
    }
    const won = a>b; if(won) wins++;
    for(let i=0; i<mN; i++) if(vals[i]>myLine[i].mu){ upN[i]++; if(won) upW[i]++; }
  }
  const wp = wins/n;
  return myLine.map((pl,i)=>({name:pl.name, lev:Math.round(((upN[i]?upW[i]/upN[i]:wp)-wp)*1000)/10}))
    .sort((x,y)=>y.lev-x.lev);
}
function simKey(){
  const md = WEEKST.mate;
  const ids = (md && md.opp) ? rosterIds().join(",")+"|"+md.opp.ids.join(",") : "solo";
  return curWeek()+":"+ids.length+":"+ids.slice(0,80);
}
function simMatchup(n, fresh){                                                   // #785/#796
  const md = WEEKST.mate;
  if(!md || !md.opp) return null;
  const key = simKey()+":"+n;
  if(!fresh && SIM.cache[key]) return SIM.cache[key];
  const byId = idIndex(), w = curWeek();
  const myBs = bestStartersWeek(rosterIds(), byId, w);
  const opBs = bestStartersWeek(md.opp.ids, byId, w);
  const myLine = buildSimLine(myBs), opLine = buildSimLine(opBs);
  if(!myLine.length || !opLine.length) return null;
  const seed = w*1000 + myLine.length*17 + opLine.length;
  const r = simSides(myLine, opLine, n||1000, seed);
  r.lev = simLeverage(myLine, opLine, Math.min(600, n||600), seed);
  r.myBs = myBs; r.opBs = opBs;
  SIM.cache[key] = r; SIM.lastKey = key;
  return r;
}
function simBestLineup(){                                                        // #788
  const md = WEEKST.mate;
  if(!md || !md.opp) return null;
  const byId = idIndex(), w = curWeek();
  const opLine = buildSimLine(bestStartersWeek(md.opp.ids, byId, w));
  const base = bestStartersWeek(rosterIds(), byId, w);
  const variants = [{label:"projection-optimal", bs:base}];
  ["FLEX","SFLX"].forEach(lab=>{
    const slot = base.line.find(sl=>sl.lab===lab);
    if(!slot || !slot.p) return;
    const poss = lab==="FLEX" ? ["RB","WR","TE"] : ["QB","RB","WR","TE"];
    rosterIds().map(id=>byId[id]).filter(Boolean)
      .filter(p=>poss.includes(p.pos) && !base.starterIds.has(p.id) && weekProj(p,w)>0)
      .sort((a,b)=>weekProj(b,w)-weekProj(a,w)).slice(0,2)
      .forEach(p=>{
        const fix = {};
        rosterIds().map(id=>byId[id]).filter(Boolean).forEach(q=>{ fix[q.id] = weekProj(q,w); });
        fix[slot.p.id] = 0; fix[p.id] = Math.max(fix[p.id], 0.1);
        const bs2 = bestStartersWeek(rosterIds(), byId, w, fix);
        bs2.line.forEach(sl=>{ if(sl.p) sl.wp = weekProj(sl.p, w); });
        variants.push({label:lab+": "+p.name.split(" ").slice(-1)[0]+" over "+slot.p.name.split(" ").slice(-1)[0], bs:bs2});
      });
  });
  const seed = w*991;
  return variants.map(v=>{
    const line = buildSimLine(v.bs);
    const r = simSides(line, opLine, 400, seed);
    return {label:v.label, bs:v.bs, wp:Math.round(r.wp*1000)/10, pts:Math.round(v.bs.line.reduce((a,s)=>a+(s.wp||0),0)*10)/10};
  }).sort((a,b)=>b.wp-a.wp);
}
function journalRecord(){                                                        // #792
  try{
    if(new Date().getDay()!==0) return;
    const md = WEEKST.mate; if(!md || !md.me || !md.me.starters) return;
    const w = curWeek(), k = LS_KEY+"-djournal";
    let j = []; try{ j = JSON.parse(localStorage.getItem(k)||"[]"); }catch(e){}
    if(j.some(x=>x.w===w)) return;
    const byId = idIndex();
    const bs = bestStartersWeek(rosterIds(), byId, w);
    const actual = new Set(md.me.starters.filter(Boolean));
    const diffs = [...bs.starterIds].filter(id=>!actual.has(id)).map(id=>({eng:id, mine:null}));
    const mineOnly = [...actual].filter(id=>!bs.starterIds.has(id));
    diffs.forEach((d,i)=>{ d.mine = mineOnly[i]||null; });
    j.push({w, agree:diffs.length===0, diffs:diffs.filter(d=>d.mine)});
    localStorage.setItem(k, JSON.stringify(j.slice(-18)));
  }catch(e){}
}
function journalOutcomes(hist){                                                  // #792
  let j = []; try{ j = JSON.parse(localStorage.getItem(LS_KEY+"-djournal")||"[]"); }catch(e){ return null; }
  if(!j.length) return null;
  const pw = playerWeekly(hist||seasonArchive());
  let meBetter = 0, engBetter = 0;
  j.forEach(x=>x.diffs.forEach(d=>{
    const mp = (pw[d.mine]||[])[x.w-1], ep = (pw[d.eng]||[])[x.w-1];
    if(mp==null || ep==null) return;
    if(mp>ep) meBetter++; else if(ep>mp) engBetter++;
  }));
  return {logged:j.length, meBetter, engBetter};
}
function benchRegret(hist){                                                      // pure (#793)
  const myRid = +S.settings.sleeperRosterId, s2o = sleeperToOurs(), byId = idIndex();
  let total = 0; const rows = [];
  (hist||[]).forEach((wm,wi)=>{
    const m = (wm||[]).find(x=>+x.roster_id===myRid); if(!m || !m.players_points) return;
    const st = new Set(m.starters||[]);
    const benched = (m.players||[]).filter(sid=>!st.has(sid)).map(sid=>({sid, got:+m.players_points[sid]||0, p:byId[s2o[String(sid)]]})).filter(x=>x.p && x.p.pos!=="DEF");
    const started = (m.starters||[]).map(sid=>({sid, got:+m.players_points[sid]||0, p:byId[s2o[String(sid)]]})).filter(x=>x.p && x.p.pos!=="DEF");
    if(!benched.length || !started.length) return;
    const bestB = benched.sort((a,b)=>b.got-a.got)[0];
    const worstS = started.filter(x=>["RB","WR","TE"].includes(x.p.pos)||bestB.p.pos===x.p.pos).sort((a,b)=>a.got-b.got)[0];
    if(bestB && worstS && bestB.got>worstS.got+2){
      total += bestB.got-worstS.got;
      rows.push({w:wi+1, txt:"W"+(wi+1)+": "+bestB.p.name+" ("+bestB.got.toFixed(1)+") rode pine over "+worstS.p.name+" ("+worstS.got.toFixed(1)+")"});
    }
  });
  return {total:Math.round(total*10)/10, rows:rows.slice(-4)};
}
function simHistSvg(r){                                                          // #787
  const BINS = 26;
  const all = [...r.my, ...r.opp];
  let mn = Infinity, mx = -Infinity;
  all.forEach(v=>{ if(v<mn) mn = v; if(v>mx) mx = v; });
  const span = Math.max(1, mx-mn);
  const bin = arr=>{
    const b = new Array(BINS).fill(0);
    arr.forEach(v=>{ b[Math.min(BINS-1, Math.floor((v-mn)/span*BINS))]++; });
    return b;
  };
  const bm = bin(r.my), bo = bin(r.opp);
  const peak = Math.max(...bm, ...bo, 1);
  const W = 300, H = 70, bw = W/BINS;
  const bars = (b,color,op)=>b.map((v,i)=>'<rect x="'+Math.round(i*bw)+'" y="'+Math.round(H-(v/peak*H))+'" width="'+Math.ceil(bw-1)+'" height="'+Math.round(v/peak*H)+'" fill="'+color+'" opacity="'+op+'"/>').join("");
  return '<svg width="100%" viewBox="0 0 '+W+' '+(H+16)+'" role="img" aria-label="score distributions">'+
    bars(bo,"var(--red)",0.55)+bars(bm,"var(--green)",0.6)+
    '<text x="2" y="'+(H+12)+'" fill="var(--dim)" font-size="9">'+Math.round(mn)+'</text>'+
    '<text x="'+(W-24)+'" y="'+(H+12)+'" fill="var(--dim)" font-size="9">'+Math.round(mx)+'</text></svg>';
}
async function renderSim(){                                                      // #795
  const old = document.getElementById("simOverlay"); if(old){ old.remove(); return; }
  await Promise.all([refreshWeek(), myLiveIds(), myWeekData()]);
  const r = simMatchup(1000);
  if(!r) return toast("Need a matchup to simulate — link your league", {warn:true});
  const md = WEEKST.mate;
  const hist = seasonArchive();
  const variants = simBestLineup();
  const jo = journalOutcomes(hist);
  const br = hist.length ? benchRegret(hist) : null;
  const wpPct = Math.round(r.wp*1000)/10;
  const ov = document.createElement("div"); ov.id = "simOverlay"; ov.className = "snov";
  let h = '<div class="sbcard" role="dialog" aria-label="Matchup simulator"><button class="sbx" data-smx="1">✕</button>';
  h += '<div class="tag">🎲 1,000 SIMULATED SUNDAYS — vs '+esc(md.opp.name)+'</div>';
  h += '<div class="benchhead" style="font-size:16px;color:var(--'+(wpPct>=55?'green':wpPct<=45?'red':'gold')+')">You win '+wpPct+'% of them</div>';
  h += chartDist(r);
  h += '<div class="sbply"><span>your range (p10 / median / p90)</span><b class="mono">'+r.p10+' / '+r.p50+' / '+r.p90+'</b></div>';
  h += '<div class="sbply"><span>💥 blowout W'+r.blow+'% · 😱 blowout L '+r.blown+'% · 😰 one-score '+r.close+'%</span></div>';
  if(r.lev && r.lev.length) h += '<div class="benchhead">🎯 Highest leverage: '+esc(r.lev[0].name)+' (+'+r.lev[0].lev+'% win when he beats his number)'+
    (r.lev[1]?' · '+esc(r.lev[1].name)+' +'+r.lev[1].lev+'%':'')+'</div>';
  if(variants && variants.length>1){
    window._simVariants = variants;
    h += '<div class="benchhead">🧪 Lineup variants, judged by WIN RATE not points</div>'+variants.slice(0,4).map((v,i)=>
      '<div class="sbply"'+(i===0?' style="color:var(--green)"':'')+'><span>'+(i===0?'✓ ':'')+esc(v.label)+' <span class="dimtxt">'+v.pts+' proj</span></span>'+
      '<span><button class="undo1" data-vstage="'+i+'">⇄ stage</button> <b class="mono">'+v.wp+'%</b></span></div>').join("");
    if(variants[0].label!=="projection-optimal") h += '<div class="benchhead" style="color:var(--gold)">⚡ The sim disagrees with raw projections — variance is strategy</div>';
  }
  if(jo && (jo.meBetter+jo.engBetter)>0) h += '<div class="sbply"><span>📓 Decision journal (you vs engine)</span><b class="mono">'+jo.meBetter+'–'+jo.engBetter+'</b></div>';
  if(br && br.rows.length) h += '<div class="benchhead">😭 Bench regret: '+br.total+' pts this season</div>'+
    br.rows.map(x=>'<div class="sbply"><span class="dimtxt">'+esc(x.txt)+'</span></div>').join("");
  h += '<div style="padding:10px 0"><button class="hbtn" id="simRerun">🎲 Re-run fresh</button></div></div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-smx]")) return ov.remove();
    if(e.target.id==="simRerun"){ SIM.cache = {}; ov.remove(); renderSim(); return; }
    const vs2 = e.target.closest("[data-vstage]");
    if(vs2 && window._simVariants){ const v = window._simVariants[+vs2.dataset.vstage];
      if(v){ ov.remove(); stageToLineup(v.bs, v.label); } }
  });
}

/* ---------- R49 Live war room v2: real game states (#800–#814) ---------- */
const NFLSTATE = {at:0, map:{}};
const ESPN2OURS = {WSH:"WAS", GB:"GBP", KC:"KCC", LV:"LVR", JAX:"JAC", NE:"NEP", NO:"NOS", SF:"SFO", TB:"TBB"};
function remFrac(state, period, clock){                                          // pure (#806)
  if(state==="pre") return 1;
  if(state==="post") return 0;
  const parts = String(clock||"0:00").split(":");
  const m = +parts[0]||0, s = +parts[1]||0;
  const q = Math.min(4, Math.max(1, period||1));
  const rem = ((4-q)*900 + m*60 + s)/3600;
  return Math.max(0.02, Math.min(1, rem));
}
async function nflStates(force){                                                 // #800
  if(!force && NFLSTATE.at && Date.now()-NFLSTATE.at < 2*60e3) return NFLSTATE.map;
  try{
    const j = await (await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard")).json();
    const m = {};
    (j.events||[]).forEach(ev=>{
      const comp = (ev.competitions||[])[0]; if(!comp) return;
      const st = ev.status || comp.status || {};
      const state = (st.type && st.type.state) || "pre";
      const period = st.period || 0, clock = st.displayClock || "0:00";
      (comp.competitors||[]).forEach(c=>{
        const opp = (comp.competitors||[]).find(x2=>x2!==c);
        const ab = ESPN2OURS[c.team && c.team.abbreviation] || (c.team && c.team.abbreviation);
        if(!ab) return;
        m[ab] = {state, period, clock, detail:(st.type && st.type.shortDetail)||"",
          diff:(+c.score||0)-((opp && +opp.score)||0), rem:remFrac(state, period, clock)};
      });
    });
    if(Object.keys(m).length){ NFLSTATE.map = m; NFLSTATE.at = Date.now(); }
  }catch(e){}
  return NFLSTATE.map;
}
function gameStateOf(team){ return NFLSTATE.map[team] || null; }
function anyGameLive(){ for(const t in NFLSTATE.map) if(NFLSTATE.map[t].state==="in") return true; return false; }   // #812
function gsBadge(team){                                                          // #801
  const g = gameStateOf(team); if(!g) return "";
  if(g.state==="in") return "▶Q"+g.period+" "+g.clock;
  if(g.state==="post") return "FINAL";
  return "";
}
function liveAdjRemaining(p, got){                                               // #805/#806
  const g = gameStateOf(p.team), w = curWeek();
  const base = weekProj(p, w);
  if(!g) return got>0 ? 0 : base;
  let rem = base * g.rem;
  if(g.state==="in" && g.period>=4){
    if(Math.abs(g.diff)>=28) rem *= 0.5;                                          // garbage time (#805)
    else if(Math.abs(g.diff)<=8) rem *= 1.15;
  }
  return Math.max(0, Math.round(rem*10)/10);
}
function yetToPlay(side){                                                        // #802/#809
  if(!side || !side.starters) return null;
  const byId = idIndex(), s2o = sleeperToOurs();
  const inv = {}; for(const k2 in s2o) inv[s2o[k2]] = k2;
  let played = 0, live = 0; const waiting = [];
  side.starters.filter(Boolean).forEach(id=>{
    const p = byId[id]; if(!p) return;
    const g = gameStateOf(p.team);
    if(g && g.state==="post") played++;
    else if(g && g.state==="in") live++;
    else waiting.push(p.name.split(" ").slice(-1)[0]);
  });
  return {total:side.starters.filter(Boolean).length, played, live, waiting};
}
function liveSim(n){                                                             // #811
  const md = WEEKST.mate;
  if(!md || !md.me || !md.opp) return null;
  const byId = idIndex(), s2o = sleeperToOurs(), w = curWeek();
  const inv = {}; for(const k2 in s2o) inv[s2o[k2]] = k2;
  const mkLine = side=>{
    const teams = {};
    const ps = side.starters.filter(Boolean).map(id=>byId[id]).filter(Boolean);
    ps.forEach(p=>{ teams[p.team] = (teams[p.team]||0)+1; });
    return ps.map(p=>{
      const got = +side.ppts[inv[p.id]] || 0;
      const g = gameStateOf(p.team);
      if(g && g.state==="post") return {name:p.name, mu:got, sd:0.01, team:p.team, corr:false};
      const rem = liveAdjRemaining(p, got);
      const frac = g ? g.rem : (got>0 ? 0 : 1);
      return {name:p.name, mu:got+rem, sd:Math.max(0.5, playerVariance(p)*frac), team:p.team, corr:teams[p.team]>1};
    });
  };
  const a = mkLine(md.me), b = mkLine(md.opp);
  if(!a.length || !b.length) return null;
  return simSides(a, b, n||400, Math.floor(Date.now()/6e4));
}
function liveWpSnap(){                                                           // #803
  try{
    if(!anyGameLive()) return;
    const r = liveSim(300); if(!r) return;
    const k = LS_KEY+"-wph"+curWeek();
    let h = []; try{ h = JSON.parse(localStorage.getItem(k)||"[]"); }catch(e){}
    h.push({t:Date.now(), wp:Math.round(r.wp*100)});
    localStorage.setItem(k, JSON.stringify(h.slice(-80)));
    window._liveWp = Math.round(r.wp*100);
  }catch(e){}
}
function liveWpChartHtml(){                                                      // #803
  try{
    let h = []; try{ h = JSON.parse(localStorage.getItem(LS_KEY+"-wph"+curWeek())||"[]"); }catch(e){}
    if(h.length<3) return "";
    const cur = h[h.length-1].wp;
    return '<div class="benchhead">📈 The rollercoaster: <b class="mono" style="color:var(--'+(cur>=55?'green':cur<=45?'red':'gold')+')">'+cur+'%</b> live</div>'+
      '<div style="padding:0 10px 8px">'+chartArea(h.map(x=>x.wp), {h:CHART_H.card, ref:50, min:0, max:100,
        color:cur>=50?"var(--green)":"var(--red)", label:"live win probability through the day, now "+cur+" percent", fmt:v=>Math.round(v)+"%"})+'</div>';
  }catch(e){ return ""; }
}
function scenarioLine(){                                                         // #804
  try{
    const md = WEEKST.mate; if(!md || !md.me || !md.opp) return null;
    const me = yetToPlay(md.me), op = yetToPlay(md.opp);
    if(!me || !op) return null;
    const d = Math.round((md.me.pts-md.opp.pts)*10)/10;
    if(me.played+me.live===0 && op.played+op.live===0) return null;
    let s2 = (d>=0 ? "Up "+d : "Down "+(-d));
    s2 += " · you: "+me.live+" live, "+me.waiting.length+" left · them: "+op.live+" live, "+op.waiting.length+" left";
    if(d>0 && op.live===0 && op.waiting.length===0) s2 = "🏁 CLINCHED — they're out of bullets, up "+d;
    else if(d<0 && me.live===0 && me.waiting.length===0) s2 = "😔 Out of bullets, down "+(-d);
    else if(d<0 && me.waiting.length>0) s2 += " · need "+(Math.round(-d/Math.max(1,me.waiting.length+me.live)*10)/10)+"/player";
    return s2;
  }catch(e){ return null; }
}
function twoMinuteAlert(){                                                       // #807
  try{
    if(!hypeOn("full")) return;
    const md = WEEKST.mate; if(!md || !md.me) return;
    const byId = idIndex(), s2o = sleeperToOurs(), w = curWeek();
    const inv = {}; for(const k2 in s2o) inv[s2o[k2]] = k2;
    const k = LS_KEY+"-2min"+w;
    let seen = []; try{ seen = JSON.parse(localStorage.getItem(k)||"[]"); }catch(e){}
    md.me.starters.filter(Boolean).forEach(id=>{
      const p = byId[id]; if(!p || seen.includes(id)) return;
      const g = gameStateOf(p.team);
      if(!g || g.state!=="in" || g.period<4) return;
      const parts = String(g.clock).split(":");
      if((+parts[0]||0)*60+(+parts[1]||0) > 120) return;
      if(Math.abs(g.diff)>8) return;
      const got = +md.me.ppts[inv[id]] || 0;
      if(got >= weekProj(p,w)*0.7) return;
      seen.push(id);
      alertFire("2min", "⏱ Two-minute drill: "+p.name+"'s game is one score apart", "Targets and clock stops incoming — hold on");
    });
    localStorage.setItem(k, JSON.stringify(seen));
  }catch(e){}
}
function headerPulse(){                                                          // #808
  try{
    const h2 = document.querySelector("header"); if(!h2) return;
    h2.classList.add("tdpulse");
    setTimeout(()=>h2.classList.remove("tdpulse"), 2400);
  }catch(e){}
}
function gameBreak(){                                                            // #810
  try{
    const d = new Date();
    if(d.getDay()!==0 || d.getHours()!==19) return;
    const k = LS_KEY+"-break"+curWeek();
    if(localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    const r = liveSim(400);
    const sc = scenarioLine();
    if(r && sc) alertFire("break", "🌆 Late-window check: "+Math.round(r.wp*100)+"% live", sc);
  }catch(e){}
}
function liveTick(){                                                             // hooked into game-day checks
  nflStates().then(()=>{ liveWpSnap(); twoMinuteAlert(); gameBreak(); });
}

/* ---------- R50 Psychology & rituals (#815–#829) ---------- */
function ritualCfg(){ return Object.assign({checklist:true, goals:true, grades:true, bright:true}, S.settings.rituals||{}); }
function checklistState(){                                                       // #815 auto-detect + manual ticks
  const w = curWeek();
  let manual = {}; try{ manual = JSON.parse(localStorage.getItem(LS_KEY+"-ritual"+w)||"{}"); }catch(e){}
  const md = WEEKST.mate;
  const byId = idIndex();
  let lineupOk = false;
  try{
    if(md && md.me && md.me.starters && md.me.starters.filter(Boolean).length){
      const actual = md.me.starters.filter(Boolean);
      lineupOk = !actual.map(id=>byId[id]).filter(Boolean).some(p=>weekProj(p,w)===0);
    }
  }catch(e){}
  const planDone = (()=>{ try{ const {moves} = gamePlanMoves(); const t = planTicks();
    return moves.filter(m=>m.pri>=50).every(m=>t[m.k]); }catch(e){ return false; } })();
  const items = [
    {k:"lineup", label:"Lineup clean (no byes/outs)", auto:lineupOk},
    {k:"plan", label:"Game plan moves done", auto:planDone},
    {k:"scout", label:"Scout read", auto:!!manual.scout, manual:true},
    {k:"sim", label:"Sim run", auto:SIM.lastKey!=null && SIM.lastKey.indexOf(w+":")===0},
    {k:"claims", label:"Waivers planned", auto:claimsGet().length>0 || !!manual.claims, manual:true},
  ];
  items.forEach(it=>{ it.done = it.auto || !!manual[it.k]; });
  return {items, done:items.filter(i=>i.done).length, total:items.length, manual};
}
function checklistTick(k){
  const w = curWeek();
  let m = {}; try{ m = JSON.parse(localStorage.getItem(LS_KEY+"-ritual"+w)||"{}"); }catch(e){}
  m[k] = !m[k];
  try{ localStorage.setItem(LS_KEY+"-ritual"+w, JSON.stringify(m)); }catch(e){}
}
function checklistStreak(){                                                      // #816
  try{ return +localStorage.getItem(LS_KEY+"-ritstreak")||0; }catch(e){ return 0; }
}
function checklistSweep(){                                                       // weekly: bank streak at week end
  try{
    const hist = seasonArchive(); if(!hist.length) return;
    const wk = hist.length;
    const k = LS_KEY+"-ritbank";
    if(+localStorage.getItem(k)===wk) return;
    localStorage.setItem(k, String(wk));
    let m = {}; try{ m = JSON.parse(localStorage.getItem(LS_KEY+"-ritual"+wk)||"{}"); }catch(e){}
    const full = m.lineup!==false && Object.keys(m).length>=2;                    // proxy: engaged with the ritual
    const cur = checklistStreak();
    localStorage.setItem(LS_KEY+"-ritstreak", String(full ? cur+1 : 0));
  }catch(e){}
}
function goalsGet(){                                                             // #817
  try{ return JSON.parse(localStorage.getItem(LS_KEY+"-goals")||'["playoffs","topPF","10wins"]'); }catch(e){ return ["playoffs"]; }
}
function goalsProgress(){
  const out = [];
  const ms = myStandingsRow(); if(!ms) return out;
  const myRid = +S.settings.sleeperRosterId;
  const odds = SEASON.lastOdds ? SEASON.lastOdds[myRid] : null;
  const gp = ms.row.w+ms.row.l+ms.row.t;
  goalsGet().forEach(g=>{
    if(g==="playoffs") out.push({label:"Make the playoffs", pct:odds!=null?odds:Math.round(ms.place<=6?70:30), note:odds!=null?odds+"% odds":ordinal(ms.place)});
    if(g==="topPF"){ const rank = ms.st.slice().sort((a,b)=>b.pf-a.pf).findIndex(r=>r.rid===myRid)+1;
      out.push({label:"Lead the league in points", pct:Math.max(5, 100-(rank-1)*18), note:ordinal(rank)+" in PF"}); }
    if(g==="10wins") out.push({label:"10 wins", pct:Math.min(100, Math.round(ms.row.w/10*100)), note:ms.row.w+" of 10"+(gp<14?" ("+(14-gp)+" games left)":"")});
    if(g==="title") out.push({label:"Win it all", pct:odds!=null?Math.round(odds*0.35):15, note:"the only goal that matters"});
  });
  return out;
}
function mgmtGrade(){                                                            // #818
  try{
    const hist = seasonArchive(); if(!hist.length) return null;
    const rows = myWeeklyRows(hist);
    const last = rows[rows.length-1]; if(!last) return null;
    let score = 0, parts = [];
    const eff = last.eff ? last.eff.eff : null;
    if(eff!=null){ score += Math.min(50, Math.max(0, (eff-70)/30*50)); parts.push("eff "+eff+"%"); }
    const wk = rows.length;
    let m = {}; try{ m = JSON.parse(localStorage.getItem(LS_KEY+"-ritual"+wk)||"{}"); }catch(e){}
    const engaged = Object.keys(m).length>0;
    score += engaged ? 15 : 5; parts.push(engaged?"ritual kept":"ritual skipped");
    const jo = journalOutcomes(hist);
    if(jo && (jo.meBetter+jo.engBetter)>0){ score += jo.meBetter>=jo.engBetter ? 20 : 10; parts.push("journal "+jo.meBetter+"–"+jo.engBetter); }
    else score += 12;
    const tx = claimsGet().length; score += Math.min(15, tx*5 + 5);
    const letter = score>=85 ? "A" : score>=70 ? "B" : score>=55 ? "C" : score>=40 ? "D" : "F";
    return {letter, score:Math.round(score), parts, w:wk};
  }catch(e){ return null; }
}
function gradeHistory(){                                                         // #819
  try{ return JSON.parse(localStorage.getItem(LS_KEY+"-grades")||"[]"); }catch(e){ return []; }
}
function gradeSweep(){
  try{
    const g = mgmtGrade(); if(!g) return;
    const h = gradeHistory();
    if(h.some(x=>x.w===g.w)) return;
    h.push({w:g.w, letter:g.letter, score:g.score});
    localStorage.setItem(LS_KEY+"-grades", JSON.stringify(h.slice(-18)));
  }catch(e){}
}
function brightSide(){                                                           // #820
  try{
    const hist = seasonArchive(); if(!hist.length) return null;
    const rows = myWeeklyRows(hist);
    const last = rows[rows.length-1];
    if(!last || !last.opp || last.m.points>=last.opp.points) return null;
    const bits = [];
    const myRid = +S.settings.sleeperRosterId;
    const ap = allPlayStandings(hist, SCOREB.rosters, SCOREB.users).find(r=>r.rid===myRid);
    if(ap && ap.luck<-0.5) bits.push("You're owed "+(-ap.luck)+" wins by variance — the math ALWAYS collects.");
    const med = (hist[hist.length-1]||[]).map(x=>x.points||0).sort((a,b)=>a-b)[Math.floor(hist[hist.length-1].length/2)];
    if(last.m.points>med) bits.push("You outscored more than half the league and still lost — that's a schedule loss, not a roster loss.");
    if(last.eff && last.eff.eff>=93) bits.push("You played it "+last.eff.eff+"% perfectly. Nothing to fix. Their guy had a career day — happens.");
    if(SEASON.avail && SEASON.avail.length) bits.push("Meanwhile "+SEASON.avail[0].name+" is heating on the wire and you have first shot.");
    const md = WEEKST.mate;
    if(md && md.opp){
      const slop = sloppinessOf(md.opp.rid, hist);
      if(slop && slop.eff<92) bits.push("Next up: a team running "+slop.eff+"% efficiency. They will hand you points.");
    }
    if(!bits.length) bits.push("Short memory. Best ability is availability, and your roster's still the deepest in the league.");
    return bits;
  }catch(e){ return null; }
}
function lossAutopsy(){                                                          // #827
  try{
    const hist = seasonArchive(); if(!hist.length) return null;
    const rows = myWeeklyRows(hist);
    const last = rows[rows.length-1];
    if(!last || !last.opp || last.m.points>=last.opp.points) return null;
    const gap = Math.round((last.opp.points-last.m.points)*10)/10;
    const br = benchRegret([hist[hist.length-1]]);
    if(br.total>gap) return "Autopsy: the "+br.total+" points on your bench were the whole "+gap+"-point loss. Fixable. Fixed by the sim next week.";
    const byId = idIndex(), s2o = sleeperToOurs();
    const perf = (last.m.starters||[]).map(sid=>({p:byId[s2o[String(sid)]], got:+last.m.players_points[sid]||0})).filter(x=>x.p&&x.p.pos!=="DEF");
    const bust = perf.sort((a,b)=>(a.got-a.p.proj/16)-(b.got-b.p.proj/16))[0];
    if(bust && (bust.p.proj/16-bust.got)>gap) return "Autopsy: "+bust.p.name+" ("+bust.got.toFixed(1)+" vs "+(bust.p.proj/16).toFixed(1)+" expected) was the loss by himself. Not a decision error — a variance tax.";
    return "Autopsy: they outscored the median and you didn't. No smoking gun — reload, hit waivers, next.";
  }catch(e){ return null; }
}
function deathWatch(){                                                           // #822
  try{
    const rs = +S.settings.rivalSlot, s2r = S.settings.slot2rid;
    if(!rs || !s2r || !SEASON.lastOdds) return "";
    const rrid = +s2r[String(rs)];
    const odds = SEASON.lastOdds[rrid]; if(odds==null) return "";
    const prev = +localStorage.getItem(LS_KEY+"-dwprev");
    localStorage.setItem(LS_KEY+"-dwprev", String(odds));
    const arrow = prev ? (odds<prev ? " ▼" : odds>prev ? " ▲" : "") : "";
    const vibe = odds===0 ? "☠ ELIMINATED. Pour one out (do not)." : odds<25 ? "circling the drain" : odds<50 ? "sweating" : "annoyingly alive";
    return '<div class="sbply"><span>😈 Death watch: '+esc(ridName(rrid))+'</span><b class="mono" style="color:var(--'+(odds<50?'green':'red')+')">'+odds+'%'+arrow+' <span class="dimtxt">'+vibe+'</span></b></div>';
  }catch(e){ return ""; }
}
function elimTracker(){                                                          // #825
  try{
    if(!SEASON.lastOdds || !SCOREB.rosters) return [];
    return standingsRows(SCOREB.rosters, SCOREB.users).filter(r=>SEASON.lastOdds[r.rid]===0).map(r=>r.name);
  }catch(e){ return []; }
}
function confSet(v){                                                             // #823
  const w = curWeek();
  let c = []; try{ c = JSON.parse(localStorage.getItem(LS_KEY+"-conf")||"[]"); }catch(e){}
  c = c.filter(x=>x.w!==w); c.push({w, v:+v});
  try{ localStorage.setItem(LS_KEY+"-conf", JSON.stringify(c.slice(-18))); }catch(e){}
}
function confCalibration(){
  let c = []; try{ c = JSON.parse(localStorage.getItem(LS_KEY+"-conf")||"[]"); }catch(e){ return null; }
  const hist = seasonArchive(); if(!hist.length || !c.length) return null;
  const rows = myWeeklyRows(hist);
  const pairs = c.map(x=>{ const r = rows[x.w-1]; return r && r.opp ? {v:x.v, won:r.m.points>r.opp.points} : null; }).filter(Boolean);
  if(pairs.length<2) return null;
  const hiConf = pairs.filter(p=>p.v>=4), loConf = pairs.filter(p=>p.v<=2);
  return {n:pairs.length,
    hi:hiConf.length ? Math.round(hiConf.filter(p=>p.won).length/hiConf.length*100) : null,
    lo:loConf.length ? Math.round(loConf.filter(p=>p.won).length/loConf.length*100) : null};
}
function streakSkin(){                                                           // #821
  try{
    const hist = seasonArchive();
    const rows = hist.length ? myWeeklyRows(hist) : [];
    let streak = 0;
    for(let i=rows.length-1;i>=0;i--){ if(rows[i].opp && rows[i].m.points>rows[i].opp.points) streak++; else break; }
    document.body.classList.toggle("heater", streak>=3);
  }catch(e){}
}
function routineCard(){                                                          // #824
  try{
    if(!ritualCfg().checklist) return;
    const d = new Date();
    if(d.getDay()!==0 || d.getHours()<9 || d.getHours()>=13) return;
    const k = LS_KEY+"-routine"+curWeek();
    if(localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    const cs = checklistState();
    const {moves} = gamePlanMoves();
    const top = moves[0];
    alertFire("routine", "☕ Sunday routine: "+cs.done+"/"+cs.total+" checklist done",
      top ? "Top move: "+top.txt.replace(/^[^\w]+/,"") : "All clear — enjoy the games");
  }catch(e){}
}
function renderRituals(){                                                        // overlay: checklist + goals + grades + confidence
  const old = document.getElementById("rtOverlay"); if(old){ old.remove(); return; }
  const cs = checklistState();
  const goals = ritualCfg().goals ? goalsProgress() : [];
  const g = ritualCfg().grades ? mgmtGrade() : null;
  const gh2 = gradeHistory();
  const bs2 = ritualCfg().bright ? brightSide() : null;
  const aut = lossAutopsy();
  const cal = confCalibration();
  const elim = elimTracker();
  const streak = checklistStreak();
  const w = curWeek();
  let myConf = null; try{ myConf = (JSON.parse(localStorage.getItem(LS_KEY+"-conf")||"[]").find(x=>x.w===w)||{}).v||null; }catch(e){}
  const ov = document.createElement("div"); ov.id = "rtOverlay"; ov.className = "snov";
  let h = '<div class="sbcard" role="dialog" aria-label="Rituals"><button class="sbx" data-rtx="1">✕</button>';
  h += '<div class="tag">🧘 THE RITUAL — week '+w+(streak>=2?' · 🔁 '+streak+'-week streak':'')+'</div>';
  h += '<div class="benchhead">✅ Pregame checklist ('+cs.done+'/'+cs.total+')</div>'+cs.items.map(it=>
    '<div class="sbply"'+(it.manual?' style="cursor:pointer" data-rtick="'+it.k+'"':'')+'><span>'+(it.done?'✅':'⬜')+' '+esc(it.label)+'</span>'+
    (it.manual&&!it.done?'<span class="dimtxt">tap to tick</span>':'')+'</div>').join("");
  h += '<div class="benchhead">🎚 Pregame confidence</div><div class="scarce">'+
    [1,2,3,4,5].map(v=>'<span class="scpill" data-conf="'+v+'"'+(myConf===v?' style="color:var(--gold)"':'')+' role="button">'+"🔥".repeat(v)+'</span>').join("")+'</div>';
  if(cal && (cal.hi!=null||cal.lo!=null)) h += '<div class="sbply"><span>calibration over '+cal.n+' weeks</span><b class="mono">'+
    (cal.hi!=null?'confident: '+cal.hi+'% won':'')+(cal.lo!=null?' · nervous: '+cal.lo+'% won':'')+'</b></div>';
  h += '<div class="benchhead">🎯 Chasing</div><div class="scarce">'+
    [["playoffs","Make playoffs"],["topPF","Top points"],["10wins","10 wins"],["title","Win it all"]].map(([k2,l2])=>
    '<span class="scpill'+(goalsGet().includes(k2)?' good':'')+'" data-goal="'+k2+'" role="button" tabindex="0">'+(goalsGet().includes(k2)?'✓ ':'')+l2+'</span>').join("")+'</div>';
  if(goals.length) h += '<div class="benchhead">🎯 Season goals</div>'+goals.map(x=>
    '<div class="sbply"><span>'+esc(x.label)+' <span class="dimtxt">'+esc(x.note)+'</span></span></div>'+
    '<div style="padding:0 12px 8px"><div style="height:6px;border-radius:3px;background:var(--line)"><div style="height:6px;border-radius:3px;width:'+Math.min(100,x.pct)+'%;background:var(--'+(x.pct>=60?'green':x.pct>=30?'gold':'red')+')"></div></div></div>').join("");
  if(g) h += '<div class="benchhead">🎓 Management grade: <b style="color:var(--'+(g.letter==="A"?'green':g.letter>="C"?'gold':'red')+');font-size:16px">'+g.letter+'</b> <span class="dimtxt">('+g.parts.join(" · ")+')</span></div>';
  if(gh2.length>1) h += '<div class="sbply"><span>transcript</span><b class="mono">'+gh2.map(x=>'W'+x.w+':'+x.letter).join(" ")+'</b></div>';
  if(bs2) h += '<div class="benchhead" style="color:var(--gold)">🌤 The bright side</div>'+bs2.slice(0,3).map(b=>'<div class="sbply"><span>'+esc(b)+'</span></div>').join("");
  if(aut) h += '<div class="sbply"><span class="dimtxt">'+esc(aut)+'</span></div>';
  if(elim.length) h += '<div class="benchhead">☠ Mathematically dead: '+elim.map(esc).join(", ")+'</div>';
  h += deathWatch();
  h += '</div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-rtx]")) return ov.remove();
    const rt = e.target.closest("[data-rtick]");
    if(rt){ checklistTick(rt.dataset.rtick); ov.remove(); renderRituals(); return; }
    const cf = e.target.closest("[data-conf]");
    if(cf){ confSet(cf.dataset.conf); toast("🎚 Confidence logged — we'll check the calibration later"); ov.remove(); renderRituals(); return; }
    const gl = e.target.closest("[data-goal]");
    if(gl){ goalsSet(gl.dataset.goal); }
  });
}
function ritualTick(){ checklistSweep(); gradeSweep(); streakSkin(); routineCard(); }

/* ---------- The Season Page: / is the season, /draft is the draft (#845–#848) ---------- */
function winDial(pct){                                                           // #885
  const r=26, c=2*Math.PI*r, on=Math.max(0,Math.min(100,pct))/100*c;
  const col = pct>=55?"var(--green)":pct<=45?"var(--red)":"var(--gold)";
  return '<svg class="spdial" width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="win probability '+pct+' percent">'+
    '<circle cx="36" cy="36" r="'+r+'" fill="none" stroke="var(--line)" stroke-width="7"/>'+
    '<circle cx="36" cy="36" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="7" stroke-linecap="round" '+
    'stroke-dasharray="'+on.toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 36 36)"/>'+
    '<text x="36" y="41" text-anchor="middle" font-size="16" font-weight="800" fill="'+col+'">'+pct+'</text></svg>';
}
function ssPRow(p, sub, val, dim){
  return '<div class="ssrow" data-card="'+p.id+'" tabindex="0" role="button">'+avatarImg(p,28)+
    '<div class="ssnm">'+esc(p.name)+'<span class="sssub">'+sub+'</span></div>'+
    '<b class="ssval mono'+(dim?' dim':'')+'">'+val+'</b></div>';
}
function seasonPageHtml(){                                                       // pure builder (#879–#893)
  const byId = idIndex(), w = curWeek(), md = WEEKST.mate;
  const s2o = sleeperToOurs();
  const inv = {}; for(const k2 in s2o) inv[s2o[k2]] = k2;
  const ms = (typeof myStandingsRow==="function") ? myStandingsRow() : null;
  const myRid = +S.settings.sleeperRosterId;
  // page bar (#889)
  let h = '<div class="spbar"><div class="spbt"><b>WEEK '+w+'</b>'+
    (ms?' <span class="mono">'+ms.row.w+'-'+ms.row.l+(ms.row.t?'-'+ms.row.t:'')+'</span> · '+ordinal(ms.place):'')+'</div>'+
    '<div class="spbtns">'+
    '<button class="hbtn" data-act="toggleDensity" title="Comfortable / compact">▤</button>'+
    '<button class="hbtn" data-act="togglePool">🗂 '+(window._poolShow?'Hide pool':'Pool')+'</button>'+
    '<a class="hbtn" href="/draft" style="text-decoration:none">✏️ Draft room</a></div></div>';
  try{ if(typeof hypeLine==="function" && hypeOn("mild")) h += '<div class="benchhead" style="color:var(--gold)">😤 '+esc(hypeLine())+'</div>'; }catch(e){}
  // hero (#879/#884/#885)
  h += '<div class="sphero sscard" id="spMatchup">';
  if(md && md.me){
    const myBs = bestStartersWeek(rosterIds(), byId, w);
    const opBs = md.opp ? bestStartersWeek(md.opp.ids, byId, w) : null;
    const wpPct = (window._liveWp!=null && typeof anyGameLive==="function" && anyGameLive()) ? window._liveWp
      : (opBs ? Math.round(winProb(myBs.pts, opBs.pts)*100) : 50);
    const leftPts = (()=>{ try{
      const actual = md.me.starters.filter(Boolean);
      if(!actual.length) return null;
      return Math.max(0, Math.round((myBs.pts - actual.map(id=>byId[id]).filter(Boolean).reduce((a,p)=>a+weekProj(p,w),0))*10)/10);
    }catch(e){ return null; } })();
    h += '<div class="spheroTop">'+
      '<div class="spteam"><span class="splab">OTTO5</span><b class="mono">'+md.me.pts.toFixed(1)+'</b><span class="spproj">proj '+fmt(myBs.pts)+'</span></div>'+
      winDial(wpPct)+
      '<div class="spteam away"><span class="splab">'+esc(md.opp?md.opp.name.toUpperCase():"—")+'</span><b class="mono">'+(md.opp?md.opp.pts.toFixed(1):"0.0")+'</b><span class="spproj">'+(opBs?'proj '+fmt(opBs.pts):'')+'</span></div></div>';
    // tiles (#880)
    const lev = (typeof SIM!=="undefined" && SIM.lastKey && SIM.cache[SIM.lastKey] && SIM.cache[SIM.lastKey].lev) ? SIM.cache[SIM.lastKey].lev[0] : null;
    const odds = SEASON.lastOdds ? SEASON.lastOdds[myRid] : null;
    h += '<div class="sptiles">'+
      ssTile("proj final", fmt(myBs.pts))+
      ssTile("win prob", wpPct+"%", wpPct>=55?"up":wpPct<=45?"down":"")+
      ssTile("on bench", leftPts!=null?(leftPts>1?"−"+leftPts:"0"):"—", leftPts>1?"down":"up")+
      ssTile("playoffs", odds!=null?odds+"%":"—")+
      ssTile("leverage", lev?esc(lev.name.split(" ").slice(-1)[0]):"—")+
      '</div>';
    const plist = (side, mineSide)=>side.starters.filter(Boolean).map(id=>{
      const p = byId[id]; if(!p) return "";
      const got = +side.ppts[inv[id]]||0;
      const badge = (typeof gsBadge==="function") ? gsBadge(p.team) : "";
      const row = ssPRow(p, p.pos+(badge?" · "+badge:""), got?got.toFixed(1):"~"+weekProj(p,w).toFixed(1), !got);
      return mineSide && p.pos!=="DEF" && !got ? row.replace('<b class="ssval','<button class="swapbtn" data-swap="'+p.id+'" title="Swap out" aria-label="Swap '+esc(p.name)+'">⇄</button><b class="ssval') : row;
    }).join("");
    h += '<div class="sbcols spcols"><div>'+plist(md.me,true)+'</div><div>'+(md.opp?plist(md.opp,false):'<div class="empty">no opponent</div>')+'</div></div>';
    if(typeof liveWpChartHtml==="function") h += liveWpChartHtml();
  } else {
    h += '<div class="spheroTop skel"><div class="spteam"><span class="splab">OTTO5</span><b class="mono">·&#8202;·</b></div>'+winDial(50)+
      '<div class="spteam away"><span class="splab">LOADING</span><b class="mono">·&#8202;·</b></div></div>'+
      '<div class="sptiles">'+ssTile("proj final","—")+ssTile("win prob","—")+ssTile("on bench","—")+ssTile("playoffs","—")+ssTile("leverage","—")+'</div>';
  }
  h += '</div>';
  // grid (#881)
  h += '<div class="spgrid">';
  // standings card (#887)
  h += '<div class="sscard" id="spStandings"><div class="sshead">🏆 STANDINGS</div>';
  if(SCOREB.rosters){
    const st = standingsRows(SCOREB.rosters, SCOREB.users);
    const pr = powerRankings(); const mv = {}; pr.forEach(r=>mv[r.rid]=r.move||0);
    const mxPF = Math.max(...st.map(r=>Math.max(r.pf, r.pa)), 1);
    h += '<table class="sbtab"><tr><th></th><th>team</th><th>W-L</th><th>PF</th><th>±</th><th></th></tr>'+
      st.map((r,i)=>'<tr'+(r.rid===myRid?' class="sbme"':'')+'><td>'+(i+1)+'</td><td>'+esc(r.name)+'</td><td class="mono">'+r.w+'-'+r.l+(r.t?'-'+r.t:'')+'</td><td class="mono">'+r.pf+'</td>'+
      '<td style="min-width:52px"><span class="pfbar"><i style="width:'+Math.round(r.pf/mxPF*100)+'%"></i></span><span class="pfbar pa"><i style="width:'+Math.round(r.pa/mxPF*100)+'%"></i></span></td><td>'+
      (mv[r.rid]>0?'<span style="color:var(--green)">▲</span>':mv[r.rid]<0?'<span style="color:var(--red)">▼</span>':'')+'</td></tr>').join("")+'</table>';
  } else h += '<div class="sspad"><div class="ssrow skel"><span class="skava"></span><div class="ssnm"><span class="skln"></span></div></div></div>';
  h += '</div>';
  // around the league (#886)
  h += '<div class="sscard"><div class="sshead">📊 AROUND THE LEAGUE</div><div class="sspad spminis">';
  if(SCOREB.mus){
    const rows = scoreboardRows(SCOREB, byId).filter(([a,b])=>a.rid!==myRid && b.rid!==myRid);
    h += rows.map(([a,b])=>'<div class="spmini"><span>'+esc(a.name.slice(0,9))+'</span><b class="mono">'+a.live.toFixed(0)+'–'+b.live.toFixed(0)+'</b><span class="r">'+esc(b.name.slice(0,9))+'</span></div>').join("") || '<div class="empty">quiet week</div>';
  } else h += '<div class="empty">loading league…</div>';
  h += '</div></div>';
  // chase card
  h += '<div class="sscard"><div class="sshead">👑 THE CHASE</div><div class="sspad">'+
    ((typeof titleChaseHtml==="function" && titleChaseHtml()) || '<span class="dim">odds compute after the scoreboard loads</span>')+
    ((typeof deathWatch==="function") ? deathWatch() : '')+
    ((typeof elimTracker==="function" && elimTracker().length) ? '<div class="benchhead">☠ Dead: '+elimTracker().map(esc).join(", ")+'</div>' : '')+
    '</div></div>';
  // wire card (#888)
  h += '<div class="sscard" id="spWire"><div class="sshead">🔥 THE WIRE<span><button class="undo1" data-act="renderWaivers">open →</button></span></div>';
  h += (SEASON.avail && SEASON.avail.length)
    ? SEASON.avail.slice(0,5).map(p=>ssPRow(p, p.pos+" · "+((typeof buzzOf==="function")?buzzOf(p).toLocaleString():"")+" adds", "＋", true)).join("")
    : '<div class="sspad"><div class="empty">nobody heating right now — good, nothing to panic-add</div></div>';
  h += '</div>';
  h += '</div>';                                                                 // /spgrid
  return h;
}
function renderSeasonPage(){
  const sp = document.getElementById("seasonPage"), pool = document.getElementById("poolPanel");
  if(!sp || !pool) return;
  const on = SEASON.on && (typeof appRoute!=="function" || appRoute()==="season");
  if(!on){ sp.hidden = true; pool.style.display = ""; return; }
  sp.hidden = false;
  pool.style.display = window._poolShow ? "" : "none";
  try{ if(window._density===undefined){ window._density = !!localStorage.getItem(LS_KEY+"-dense"); document.body.classList.toggle("compact", window._density); } }catch(e){}
  if(typeof mountMobileNav==="function") mountMobileNav();
  const prev = Array.from(sp.querySelectorAll(".spteam b")).map(b=>parseFloat(b.textContent)||0);
  const prevTiles = Array.from(sp.querySelectorAll(".sptiles .sstile b")).map(b=>b.textContent);
  sp.innerHTML = seasonPageHtml();
  if(!window._pageAnimated){                                                     // #909 first paint only
    window._pageAnimated = true;
    sp.classList.add("chor");
    Array.from(sp.querySelectorAll(".sscard, .spbar")).forEach((c,i)=>c.style.setProperty("--i", i));
    setTimeout(()=>sp.classList.remove("chor"), 1200);
  }
  try{
    const now2 = sp.querySelectorAll(".spteam b");
    now2.forEach((b,i)=>{ const to = parseFloat(b.textContent);
      if(!isNaN(to) && prev[i]!=null && Math.abs(to-prev[i])>0.05){
        b.classList.add(to>prev[i] ? "flashup" : "flashdown");                    // #914
        if(typeof countUp==="function"){ b.textContent = prev[i].toFixed(1); countUp(b, to); }
      } });
    sp.querySelectorAll(".sptiles .sstile b").forEach((b,i)=>{                    // #916
      if(prevTiles[i]!=null && prevTiles[i]!==b.textContent) b.classList.add("pulse");
    });
  }catch(e){}
}

/* ---------- R52 The Rail: season sidebar rebuilt (#849–#863) ---------- */
function ssTile(label, value, cls){
  return '<div class="sstile'+(cls?' '+cls:'')+'"><b class="mono">'+value+'</b><span>'+label+'</span></div>';
}
function sidebarSeasonHtml(byId){                                                // returns {hero, list}
  const w = curWeek(), md = WEEKST.mate;
  const ids = rosterIds();
  const bs = ids.length ? bestStartersWeek(ids, byId, w) : null;
  const opBs = (md && md.opp) ? bestStartersWeek(md.opp.ids, byId, w) : null;
  const ms = (typeof myStandingsRow==="function") ? myStandingsRow() : null;
  const myRid = +S.settings.sleeperRosterId;
  const odds = SEASON.lastOdds ? SEASON.lastOdds[myRid] : null;
  let streak = 0;
  try{
    const rows = myWeeklyRows(seasonArchive());
    for(let i=rows.length-1;i>=0;i--){ if(rows[i].opp && rows[i].m.points>rows[i].opp.points) streak++; else break; }
  }catch(e){}
  const wpPct = (window._liveWp!=null && typeof anyGameLive==="function" && anyGameLive()) ? window._liveWp
    : (bs && opBs ? Math.round(winProb(bs.pts, opBs.pts)*100) : null);
  // — scorebug (#850)
  let hero = '<div class="ssb">';
  if(md && md.me){
    hero += '<div class="ssbbug" role="img" aria-label="Live score">'+
      '<div class="ssbteam me"><span>OTTO5</span><b class="mono">'+md.me.pts.toFixed(1)+'</b></div>'+
      '<div class="ssbmid">'+(wpPct!=null?'<b class="mono" style="color:var(--'+(wpPct>=55?'green':wpPct<=45?'red':'gold')+')">'+wpPct+'%</b><span>WIN</span>':'<b>W'+w+'</b><span>WEEK</span>')+'</div>'+
      '<div class="ssbteam opp"><span>'+esc((md.opp?md.opp.name:"—").slice(0,12).toUpperCase())+'</span><b class="mono">'+(md.opp?md.opp.pts.toFixed(1):"0.0")+'</b></div>'+
      '</div>';
  } else {
    hero += '<div class="ssbbug skel" aria-hidden="true"><div class="ssbteam me"><span>OTTO5</span><b class="mono">·&#8202;·</b></div>'+
      '<div class="ssbmid"><b>W'+w+'</b><span>WEEK</span></div><div class="ssbteam opp"><span>LOADING</span><b class="mono">·&#8202;·</b></div></div>';
  }
  // — stat tiles (#851)
  hero += '<div class="sstiles">'+
    ssTile("record", ms ? ms.row.w+'-'+ms.row.l+(ms.row.t?'-'+ms.row.t:'') : '—')+
    ssTile("place", ms ? ordinal(ms.place) : '—')+
    ssTile("playoffs", odds!=null ? odds+'%' : '—', odds!=null ? (odds>=60?'up':odds<=30?'down':'') : '')+
    ssTile("streak", streak>=2 ? '🔥'+streak : (streak===1?'W1':'—'), streak>=3?'up':'')+
    '</div>';
  // — quick rail (#854)
  hero += '<div class="ssquick" role="navigation" aria-label="Quick actions">'+
    '<button data-act="renderGamePlan" title="Game plan — G"><span>🏆</span>Plan</button>'+
    '<button data-act="renderSim" title="Simulator — M"><span>🎲</span>Sim</button>'+
    '<button data-act="renderWaivers" title="Waiver wire — V"><span>📥</span>Wire</button>'+
    '<button data-act="scoutMyOpponent" title="Scout this week\'s opponent"><span>🕵️</span>Scout</button>'+
    '</div>';
  hero += (typeof seasonDeckHtml==="function") ? seasonDeckHtml() : '';
  hero += '</div>';
  // — lineup card (#852)
  let list = '';
  const staged = stagedGet();
  const stagedOut = new Set(staged.map(x=>x.out)), stagedIn = new Set(staged.map(x=>x.in));
  const rowOf = (p, slotLab, val, dimVal, swappable)=>{
    const e = injuryOf(p), sv = e ? injSeverity(e.s) : null;
    const bye = typeof BYES!=="undefined" && BYES[p.team]===w;
    const badge = (typeof gsBadge==="function") ? gsBadge(p.team) : "";
    const nick = (typeof nicknameOf==="function") ? nicknameOf(p) : null;
    const stCls = stagedOut.has(p.id) ? " stagedout" : stagedIn.has(p.id) ? " stagedin" : "";
    return '<div class="ssrow'+stCls+'" data-card="'+p.id+'" tabindex="0" role="button" aria-label="'+esc(p.name)+'">'+
      avatarImg(p, 30)+
      (slotLab?'<span class="ssslot '+p.pos.toLowerCase()+'" data-slotchip="'+slotLab+'" role="button" tabindex="0" title="Fill the '+slotLab+' slot">'+slotLab+'</span>':'')+
      '<div class="ssnm">'+esc(p.name)+(nick?' <span class="ssnick" title="'+esc(nick)+'">★</span>':'')+
      (S.overrides[p.id]!=null?' <span title="your custom projection">📌</span>':'')+
      (stagedOut.has(p.id)?'<span class="stagechip">OUT</span>':stagedIn.has(p.id)?'<span class="stagechip" style="background:var(--green)">IN</span>':'')+
      '<span class="sssub">'+(bye?'🚫 BYE':sv?'<span class="'+sv.cls+'">'+sv.label+'</span>':badge||p.team)+'</span></div>'+
      (swappable && p.pos!=="DEF" ? '<button class="swapbtn" data-swap="'+p.id+'" title="Swap '+esc(p.name)+' out" aria-label="Swap out">⇄</button>' : '')+
      '<b class="ssval mono'+(dimVal?' dim':'')+'">'+val+'</b></div>';
  };
  if(bs){
    const s2o = (md && md.me) ? sleeperToOurs() : null;
    const inv = {}; if(s2o) for(const k2 in s2o) inv[s2o[k2]] = k2;
    list += '<div class="sscard"><div class="sshead">STARTING NINE<span class="mono">'+((typeof projSrcLabel==="function")?projSrcLabel()+' · ':'')+fmt(bs.pts)+' proj</span></div>'+
      bs.line.filter(sl=>sl.p).map(sl=>{
        const got = (md && md.me && md.me.ppts) ? (+md.me.ppts[inv[sl.p.id]]||0) : 0;
        return rowOf(sl.p, sl.lab, got ? got.toFixed(1) : sl.wp.toFixed(1), !got, true);
      }).join("")+
      '<div class="sslegend">tap a row for the card · ⇄ to swap · plain number = projected, bold = banked</div></div>';
    {
      const delta = staged.reduce((a,x)=>{const o=byId[x.out],n=byId[x.in];return a+(o&&n?weekProj(n,w)-weekProj(o,w):0);},0);
      list += '<div class="sscard'+(staged.length?' warn':'')+'"><div class="sshead">⇄ LINEUP LAB'+
        (staged.length?'<span class="mono" style="color:var(--'+(delta>=0?'green':'red')+')">'+(delta>=0?'+':'')+delta.toFixed(1)+'</span>':'')+'</div>'+
        '<div class="sspad" style="display:flex;gap:6px;flex-wrap:wrap">'+
        '<button class="hbtn act" data-act="stageOptimal">⚡ Stage optimal</button>'+
        '<button class="hbtn" data-act="stageWinProb">🎲 Stage win-prob</button>'+
        (staged.length?'<button class="undo1" data-stagedclear="1">clear all</button>':'')+'</div>'+
        (staged.length ? staged.map((x,i)=>{const o=byId[x.out],n=byId[x.in];if(!o||!n)return '';
          const d2=weekProj(n,w)-weekProj(o,w);
          return '<div class="sbply"><span>'+esc(o.name)+' → <b>'+esc(n.name)+'</b> <span class="mono" style="color:var(--'+(d2>=0?'green':'red')+')">'+(d2>=0?'+':'')+d2.toFixed(1)+'</span></span>'+
          '<button class="undo1" data-unstage="'+i+'" aria-label="Unstage">✕</button></div>';}).join("")+
          '<div class="sspad"><a class="hbtn act" style="text-decoration:none" target="_blank" rel="noopener" href="https://sleeper.com/leagues/'+(S.settings.sleeperLeagueId||"")+'/team">Commit in Sleeper →</a></div>'
        : '')+'</div>';
    }
    const bench = ids.map(id=>byId[id]).filter(Boolean).filter(p=>!bs.starterIds.has(p.id));
    if(bench.length) list += '<details class="ssbench"><summary>BENCH <span class="mono">'+bench.length+'</span></summary>'+
      bench.sort((a,b)=>weekProj(b,w)-weekProj(a,w)).map(p=>{
        const starterAt = bs.line.filter(sl=>sl.p && sl.p.pos===p.pos).sort((a,b)=>a.wp-b.wp)[0];
        const gap = starterAt ? Math.round((starterAt.wp-weekProj(p,w))*10)/10 : null;
        const r = rowOf(p, "", weekProj(p,w).toFixed(1), true, true);
        return gap!=null && gap>0 ? r.replace("</div><button", " <span style=\'color:var(--dim)\'>"+gap+" behind "+esc(starterAt.p.name.split(" ").slice(-1)[0])+"</span></div><button") : r;
      }).join("")+'</details>';
  } else {
    list += '<div class="sscard"><div class="sshead">STARTING NINE</div>'+
      Array.from({length:5},()=>'<div class="ssrow skel"><span class="skava"></span><div class="ssnm"><span class="skln"></span></div></div>').join("")+'</div>';
  }
  // — start/sit warning carried over
  try{
    if(md && md.me && md.me.starters && md.me.starters.filter(Boolean).length && bs){
      const actual = md.me.starters.filter(Boolean);
      const actPts = actual.map(id=>byId[id]).filter(Boolean).reduce((a,p)=>a+weekProj(p,w),0);
      const left = Math.round((bs.pts-actPts)*10)/10;
      if(left > 1) list += '<div class="sscard warn"><div class="sshead">⚠ LINEUP<span class="mono">−'+left+'</span></div>'+
        '<div class="sspad">Your Sleeper lineup leaves <b>'+left+'</b> on the bench — open the <a href="#" data-act="renderGamePlan">Game Plan</a>.</div></div>';
    }
  }catch(e){}
  // — heating radar cards (#856)
  if(SEASON.avail && SEASON.avail.length){
    list += '<div class="sscard"><div class="sshead">🔥 HEATING · YOUR LEAGUE<span><button class="undo1" data-act="renderWaivers">wire →</button></span></div>'+
      SEASON.avail.slice(0,4).map(p=>'<div class="ssrow" data-card="'+p.id+'" tabindex="0" role="button">'+avatarImg(p,30)+
        '<div class="ssnm">'+esc(p.name)+'<span class="sssub">'+p.pos+' · '+((typeof buzzOf==="function")?buzzOf(p).toLocaleString():'')+' adds/24h</span></div>'+
        '<b class="ssval mono" style="color:var(--gold)">+</b></div>').join("")+'</div>';
  }
  // — byes strip (#857)
  try{
    const chips = [];
    for(let fw=w+1; fw<=Math.min(14,w+4); fw++){
      const outB = ids.map(id=>byId[id]).filter(Boolean).filter(p=>typeof BYES!=="undefined"&&BYES[p.team]===fw);
      if(outB.length) chips.push('<span class="ssbye"><b>W'+fw+'</b>'+outB.map(p=>esc(p.name.split(" ").slice(-1)[0])).join(", ")+'</span>');
    }
    if(chips.length) list += '<div class="sscard"><div class="sshead">📆 BYES AHEAD</div><div class="sspad ssbyes">'+chips.join("")+'</div></div>';
  }catch(e){}
  if(typeof titleChaseHtml==="function") list += titleChaseHtml();
  if(typeof hqMondayLine==="function") list += hqMondayLine();
  return {hero, list};
}

/* ---------- R55 Chart kit (#894–#908) ---------- */
const CHART_H = {strip:20, card:64, feature:120};                                // #906
function chartEmpty(w2, h2, msg){                                                // #902
  return '<svg width="100%" viewBox="0 0 '+w2+' '+h2+'" role="img" aria-label="'+esc(msg)+'">'+
    '<rect x="1" y="1" width="'+(w2-2)+'" height="'+(h2-2)+'" rx="6" fill="none" stroke="var(--line)" stroke-dasharray="4 4"/>'+
    '<text x="'+(w2/2)+'" y="'+(h2/2+4)+'" text-anchor="middle" font-size="10" fill="var(--dim)">'+esc(msg)+'</text></svg>';
}
function chartArea(vals, opts){                                                  // #894/#895
  opts = opts||{};
  const H = opts.h||CHART_H.card, W = opts.w||300, pad = 12;
  const a = (vals||[]).filter(v=>v!=null);
  if(a.length<3) return chartEmpty(W, H, opts.empty||"needs 3+ weeks");
  const mn = opts.min!=null?opts.min:Math.min(...a), mx = opts.max!=null?opts.max:Math.max(...a);
  const span = Math.max(0.1, mx-mn);
  const X = i=>pad + i*((W-pad*2)/(a.length-1));
  const Y = v=>H-8-((v-mn)/span)*(H-18);
  const pts = a.map((v,i)=>X(i).toFixed(1)+","+Y(v).toFixed(1));
  const col = opts.color||"var(--gold)";
  let s2 = '<svg width="100%" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(opts.label||("trend ending at "+a[a.length-1]))+'">';
  for(let g=1; g<=2; g++){ const gy = 8+(H-18)*g/3; s2 += '<line x1="'+pad+'" y1="'+gy+'" x2="'+(W-pad)+'" y2="'+gy+'" stroke="var(--line)" stroke-width="0.6"/>'; }
  if(opts.ref!=null && opts.ref>=mn && opts.ref<=mx)
    s2 += '<line x1="'+pad+'" y1="'+Y(opts.ref)+'" x2="'+(W-pad)+'" y2="'+Y(opts.ref)+'" stroke="var(--dim)" stroke-width="0.8" stroke-dasharray="3 3"/>';
  s2 += '<polygon points="'+X(0)+','+(H-8)+' '+pts.join(" ")+' '+X(a.length-1)+','+(H-8)+'" fill="'+col+'" opacity="0.14"/>';
  s2 += '<polyline points="'+pts.join(" ")+'" fill="none" stroke="'+col+'" stroke-width="1.8"/>';
  const lx = X(a.length-1), ly = Y(a[a.length-1]);
  s2 += '<circle cx="'+lx+'" cy="'+ly+'" r="3" fill="'+col+'"/>';
  s2 += '<text x="'+Math.min(lx, W-26)+'" y="'+Math.max(10, ly-6)+'" font-size="10" font-weight="700" fill="'+col+'">'+
    (opts.fmt?opts.fmt(a[a.length-1]):Math.round(a[a.length-1]*10)/10)+'</text></svg>';   // #901
  return s2;
}
function chartBars(pairs, opts){                                                 // #896/#904
  opts = opts||{};
  const H = opts.h||CHART_H.card, W = opts.w||300, pad = 10;
  const rows = (pairs||[]).filter(p2=>p2 && p2[0]!=null);
  if(rows.length<2) return chartEmpty(W, H, opts.empty||"needs 2+ weeks");
  const mx = Math.max(...rows.map(p2=>Math.max(p2[0], p2[1]||0)), 1);
  const bw = (W-pad*2)/rows.length;
  let s2 = '<svg width="100%" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(opts.label||"weekly bars")+'">';
  rows.forEach((p2,i)=>{
    const x0 = pad+i*bw;
    const h1 = (p2[0]/mx)*(H-16), h2b = ((p2[1]||0)/mx)*(H-16);
    if(p2[1]!=null) s2 += '<rect x="'+(x0+bw*0.52).toFixed(1)+'" y="'+(H-6-h2b).toFixed(1)+'" width="'+(bw*0.34).toFixed(1)+'" height="'+h2b.toFixed(1)+'" fill="var(--dim)" opacity="0.45" rx="1.5"/>';
    s2 += '<rect x="'+(x0+bw*0.10).toFixed(1)+'" y="'+(H-6-h1).toFixed(1)+'" width="'+(bw*0.34).toFixed(1)+'" height="'+h1.toFixed(1)+'" fill="'+(p2[0]>=(p2[1]||0)?"var(--green)":"var(--red)")+'" rx="1.5"/>';
  });
  const last = rows[rows.length-1];
  s2 += '<text x="'+(W-pad)+'" y="10" text-anchor="end" font-size="10" font-weight="700" fill="var(--text)">'+Math.round(last[0])+'</text></svg>';
  return s2;
}
function chartRace(series, opts){                                                // #897
  opts = opts||{};
  const H = opts.h||CHART_H.feature, W = opts.w||300, pad = 12;
  const rows = (series||[]).filter(s3=>s3.vals && s3.vals.length>=2);
  if(rows.length<2) return chartEmpty(W, H, "race unlocks after week 2");
  const n = Math.max(...rows.map(s3=>s3.vals.length));
  const mx = Math.max(...rows.flatMap(s3=>s3.vals), 1);
  const X = i=>pad+i*((W-pad*2)/(n-1));
  const Y = v=>H-10-(v/mx)*(H-22);
  let s2 = '<svg width="100%" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(opts.label||"standings race")+'">';
  rows.forEach(s3=>{
    const col = s3.color||"var(--line)";
    s2 += '<polyline points="'+s3.vals.map((v,i)=>X(i).toFixed(1)+","+Y(v).toFixed(1)).join(" ")+'" fill="none" stroke="'+col+'" stroke-width="'+(s3.big?2.4:1)+'" opacity="'+(s3.big?1:0.55)+'"/>';
    if(s3.big){ const lv = s3.vals[s3.vals.length-1];
      s2 += '<circle cx="'+X(s3.vals.length-1)+'" cy="'+Y(lv)+'" r="3" fill="'+col+'"/>'+
        '<text x="'+Math.min(X(s3.vals.length-1), W-20)+'" y="'+Math.max(10, Y(lv)-6)+'" font-size="10" font-weight="700" fill="'+col+'">'+lv+'</text>'; }
  });
  return s2+'</svg>';
}
function chartDist(r){                                                           // #898 smoothed sim curves
  const W = 300, H = CHART_H.feature, BINS = 30, pad = 10;
  const all = [...r.my, ...r.opp];
  let mn = Infinity, mx = -Infinity;
  all.forEach(v=>{ if(v<mn) mn = v; if(v>mx) mx = v; });
  const span = Math.max(1, mx-mn);
  const bin = arr=>{
    const b = new Array(BINS).fill(0);
    arr.forEach(v=>{ b[Math.min(BINS-1, Math.floor((v-mn)/span*BINS))]++; });
    for(let i=1;i<BINS-1;i++) b[i] = (b[i-1]+b[i]*2+b[i+1])/4;                    // smooth
    return b;
  };
  const bm = bin(r.my), bo = bin(r.opp);
  const peak = Math.max(...bm, ...bo, 1);
  const X = i=>pad+i*((W-pad*2)/(BINS-1));
  const Y = v=>H-14-(v/peak)*(H-30);
  const path = b=>b.map((v,i)=>X(i).toFixed(1)+","+Y(v).toFixed(1)).join(" ");
  const mark = v=>{ const x2 = pad+((v-mn)/span)*(W-pad*2); return '<line x1="'+x2+'" y1="12" x2="'+x2+'" y2="'+(H-14)+'" stroke="var(--dim)" stroke-width="0.8" stroke-dasharray="2 3"/><text x="'+x2+'" y="10" text-anchor="middle" font-size="8.5" fill="var(--dim)">'+Math.round(v)+'</text>'; };
  return '<svg width="100%" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="simulated score distributions, my median '+r.p50+'">'+
    '<polygon points="'+X(0)+','+(H-14)+' '+path(bo)+' '+X(BINS-1)+','+(H-14)+'" fill="var(--red)" opacity="0.16"/>'+
    '<polyline points="'+path(bo)+'" fill="none" stroke="var(--red)" stroke-width="1.4" opacity="0.8"/>'+
    '<polygon points="'+X(0)+','+(H-14)+' '+path(bm)+' '+X(BINS-1)+','+(H-14)+'" fill="var(--green)" opacity="0.2"/>'+
    '<polyline points="'+path(bm)+'" fill="none" stroke="var(--green)" stroke-width="1.8"/>'+
    mark(r.p10)+mark(r.p90)+
    '<text x="'+pad+'" y="'+(H-2)+'" font-size="9" fill="var(--dim)">'+Math.round(mn)+'</text>'+
    '<text x="'+(W-pad)+'" y="'+(H-2)+'" text-anchor="end" font-size="9" fill="var(--dim)">'+Math.round(mx)+'</text></svg>';
}
function applyCalm(on){                                                          // #922
  document.body.classList.toggle("calm", !!on);
}
document.addEventListener("keydown", e=>{                                         // #910 Esc closes any overlay
  if(e.key!=="Escape") return;
  const ov = document.querySelector(".snov, #sbOverlay");
  if(ov){ ov.remove(); e.stopPropagation(); }
}, true);
function countUp(el, to, ms){                                                    // #900
  try{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches){ el.textContent = to.toFixed(1); return; }
    const from = parseFloat(el.textContent)||0;
    if(Math.abs(to-from)<0.05){ el.textContent = to.toFixed(1); return; }
    const t0 = performance.now(), dur = ms||600;
    const step = t=>{
      const k = Math.min(1, (t-t0)/dur), e = 1-Math.pow(1-k, 3);
      el.textContent = (from+(to-from)*e).toFixed(1);
      if(k<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }catch(e){ el.textContent = String(to); }
}

/* ---------- P0: CSP-safe action dispatcher (#949) ---------- */
function togglePool(){ window._poolShow = !window._poolShow; renderSeasonPage(); }
function toggleDensity(){
  window._density = !window._density;
  document.body.classList.toggle("compact", window._density);
  try{ localStorage.setItem(LS_KEY+"-dense", window._density?1:""); }catch(e){}
}
function copyWkText(){ try{ navigator.clipboard.writeText(window._wkText||"").then(()=>toast("📋 Recap copied")).catch(()=>toast("Copy blocked here — select the text manually", {warn:true})); }catch(e){ toast("Copy blocked here", {warn:true}); } }
const ACT_OK = ["renderGamePlan","renderSim","renderScoreboard","renderWaivers","renderTrades","renderSeasonStats",
  "renderRituals","egoDash","weeklyRecap2","renderAlertCenter","injuryDigest","scoutMyOpponent","moreSheet",
  "hypeCard","receiptsCard","pregameSpeech","togglePool","toggleDensity","copyWkText","analystReport","stageOptimal","stageWinProb","renderSeasonSim","scoutPicker","alertTest","projDivergence","renderFragility"];
document.addEventListener("click", e=>{
  const t = e.target.closest("[data-act],[data-scout],[data-clickid]");
  if(!t) return;
  if(t.dataset.clickid){ const el = document.getElementById(t.dataset.clickid); if(el){ e.preventDefault(); el.click(); } return; }
  if(t.dataset.scout){ e.preventDefault(); scoutReport(+t.dataset.scout); return; }
  const name = t.dataset.act;
  if(!ACT_OK.includes(name)) return;
  e.preventDefault();
  const sheet = t.closest("#moreSheet"); if(sheet) sheet.remove();
  const fn = window[name];                       // top-level function declarations are window properties; eval is CSP-blocked too
  if(typeof fn==="function") fn();
});

/* ---------- R57 Mobile app feel (#924–#938) ---------- */
function mobileNavHtml(){                                                        // #924
  const tab = (fn, ico, lab)=>'<button data-tab="'+lab+'" data-act="'+fn.replace("()","")+'"><span>'+ico+'</span>'+lab+'</button>';
  return tab("renderGamePlan()","🏆","Plan")+tab("renderSim()","🎲","Sim")+
    tab("renderScoreboard()","📊","Scores")+tab("renderWaivers()","📥","Wire")+
    tab("moreSheet()","⋯","More");
}
function moreSheetHtml(){                                                        // #925
  const b = (fn, ico, lab)=>'<button data-act="'+fn.replace("()","")+'"><span>'+ico+'</span>'+lab+'</button>';
  return b("renderTrades()","🔁","Trades")+b("renderSeasonStats()","📈","Season")+
    b("renderRituals()","🧘","Ritual")+b("egoDash()","😤","Ego")+
    b("weeklyRecap2()","📖","Recap")+b("renderAlertCenter()","🔔","Alerts")+
    b("document.getElementById('gradeBtn').click()","🎓","Report")+b("injuryDigest()","🩹","Health");
}
function moreSheet(){
  const old = document.getElementById("moreSheet"); if(old){ old.remove(); return; }
  const ov = document.createElement("div"); ov.id = "moreSheet"; ov.className = "snov";
  ov.innerHTML = '<div class="mssheet" role="dialog" aria-label="More"><div class="msgrip" aria-hidden="true"></div><div class="msgrid">'+moreSheetHtml()+'</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{ if(e.target===ov) ov.remove(); });
}
function mountMobileNav(){
  if(document.getElementById("mobNav")) return;
  if(!SEASON.on || (typeof appRoute==="function" && appRoute()!=="season")) return;
  const nav = document.createElement("nav");
  nav.id = "mobNav"; nav.setAttribute("aria-label", "Season navigation");
  nav.innerHTML = mobileNavHtml();
  document.body.appendChild(nav);
}
/* pull-feel refresh (#933) */
(function(){
  let y0 = null;
  document.addEventListener("touchstart", e=>{ y0 = (window.scrollY<=0 && SEASON.on) ? e.touches[0].clientY : null; }, {passive:true});
  document.addEventListener("touchend", e=>{
    if(y0==null) return;
    const dy = (e.changedTouches[0].clientY - y0); y0 = null;
    if(dy>90 && window.scrollY<=0 && !window._pulling){
      window._pulling = true;
      toast("↻ Refreshing…");
      Promise.all([leagueWeekData(true), myWeekData(true), myLiveIds(true)])
        .then(()=>{ if(typeof renderNow==="function") renderNow(); })
        .finally(()=>{ window._pulling = false; });
    }
  }, {passive:true});
})();
/* keyboard avoidance (#936) */
document.addEventListener("focusin", e=>{
  if(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && window.innerWidth<700){
    setTimeout(()=>{ try{ e.target.scrollIntoView({block:"center", behavior:"smooth"}); }catch(e2){} }, 250);
  }
});

/* ---------- #958/#959 staged swaps, #963 analyst, #964 catch-up ---------- */
function stagedGet(){ try{ return JSON.parse(localStorage.getItem(LS_KEY+"-staged"+curWeek())||"[]"); }catch(e){ return []; } }
function stagedSave(a){ try{ localStorage.setItem(LS_KEY+"-staged"+curWeek(), JSON.stringify(a)); }catch(e){} }
function lockedIds(){                                                            // #974
  const out = new Set();
  try{
    rosterIds().forEach(id=>{
      const p = idIndex()[id]; if(!p) return;
      const g = (typeof gameStateOf==="function") ? gameStateOf(p.team) : null;
      if(g && (g.state==="in" || g.state==="post")) out.add(id);
    });
  }catch(e){}
  return out;
}
function stageSwap(outId, inId){
  const lk = lockedIds();
  if(lk.has(outId) || lk.has(inId)) return toast("🔒 That player's game already kicked off — Sleeper won't allow it either", {warn:true});
  const a = stagedGet().filter(x=>x.out!==outId && x.in!==inId);
  a.push({out:outId, in:inId});
  stagedSave(a);
  try{ alertFire("swap", "⇄ Staged: "+idIndex()[inId].name+" in for "+idIndex()[outId].name, "Commit it in Sleeper to lock it"); }catch(e){}
  renderNow();
}
function unstageAt(i){ const a = stagedGet(); a.splice(i,1); stagedSave(a); renderNow(); }   // #973
function stageToLineup(bs, label){                                               // #970/#971
  const md = WEEKST.mate;
  if(!md || !md.me || !md.me.starters || !md.me.starters.filter(Boolean).length)
    return toast("Need your live Sleeper lineup first — one refresh away", {warn:true});
  const lk = lockedIds();
  const actual = md.me.starters.filter(Boolean);
  const actualSet = new Set(actual);
  const outs = actual.filter(id=>!bs.starterIds.has(id) && !lk.has(id));
  const ins = [...bs.starterIds].filter(id=>!actualSet.has(id) && !lk.has(id));
  if(!outs.length || !ins.length) return toast("✅ Already matches — nothing to stage");
  const byId = idIndex();
  const pairs = [];
  ins.forEach(inId=>{
    const p = byId[inId]; if(!p) return;
    let idx = outs.findIndex(oId=>byId[oId] && byId[oId].pos===p.pos);
    if(idx<0) idx = 0;
    if(idx<outs.length) pairs.push({out:outs.splice(idx,1)[0], in:inId});
  });
  if(!pairs.length) return toast("✅ Already matches — nothing to stage");
  stagedSave(pairs);
  toast("⚡ Staged "+pairs.length+" swap"+(pairs.length>1?"s":"")+" → "+(label||"target lineup")+". Commit in Sleeper.");
  renderNow();
}
function stageOptimal(){ stageToLineup(bestStartersWeek(rosterIds(), idIndex(), curWeek()), "projection-optimal"); }       // #970
function stageWinProb(){ const m = winModeFor(); stageToLineup(winProbLineup(m.mode), "win-prob ("+m.mode+")"); }          // #971
function slotSheet(slotLab){                                                     // #969
  const byId = idIndex(), w = curWeek();
  const poss = slotLab==="QB" ? ["QB"] : /^RB/.test(slotLab) ? ["RB"] : /^WR/.test(slotLab) ? ["WR"] : slotLab==="TE" ? ["TE"]
    : slotLab==="FLEX" ? ["RB","WR","TE"] : slotLab==="SFLX" ? ["QB","RB","WR","TE"] : ["DEF"];
  const bs = bestStartersWeek(rosterIds(), byId, w);
  const cur = bs.line.find(sl=>sl.lab===slotLab);
  const lk = lockedIds();
  const cands = rosterIds().map(id=>byId[id]).filter(Boolean)
    .filter(p=>poss.includes(p.pos) && !lk.has(p.id) && (!cur || !cur.p || p.id!==cur.p.id))
    .map(p=>({p, wp:weekProj(p,w), starting:bs.starterIds.has(p.id)}))
    .sort((a,b)=>b.wp-a.wp).slice(0,8);
  const ov = document.createElement("div"); ov.id = "slotSheet"; ov.className = "snov";
  ov.innerHTML = '<div class="sbcard" role="dialog" aria-label="Fill '+slotLab+'"><button class="sbx" data-slx="1">✕</button>'+
    '<div class="tag">🎯 '+slotLab+' — WHO PLAYS?'+(cur&&cur.p?' <span class="mono">now '+esc(cur.p.name.split(" ").slice(-1)[0])+'</span>':'')+'</div>'+
    (cands.length ? cands.map((x,i)=>'<div class="ssrow" data-slotpick="'+x.p.id+'" tabindex="0" role="button">'+avatarImg(x.p,30)+
      '<div class="ssnm">'+esc(x.p.name)+'<span class="sssub">'+x.p.pos+(x.starting?' · currently starting elsewhere — will bump':'')+'</span></div>'+
      '<b class="ssval mono">'+x.wp.toFixed(1)+'</b></div>').join("") : '<div class="empty">Nobody eligible and unlocked</div>')+'</div>';
  document.body.appendChild(ov);
  const rowsEls = ()=>Array.from(ov.querySelectorAll("[data-slotpick]"));
  let sel = 0;
  const hi = ()=>rowsEls().forEach((r,i)=>r.style.background = i===sel ? "rgba(240,180,41,.1)" : "");
  hi(); if(rowsEls()[0]) rowsEls()[0].focus();
  ov.addEventListener("keydown", e=>{                                             // #977
    if(e.key==="ArrowDown"){ sel = Math.min(sel+1, rowsEls().length-1); hi(); e.preventDefault(); }
    else if(e.key==="ArrowUp"){ sel = Math.max(sel-1, 0); hi(); e.preventDefault(); }
    else if(e.key==="Enter" && rowsEls()[sel]){ rowsEls()[sel].click(); }
  });
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-slx]")) return ov.remove();
    const t = e.target.closest("[data-slotpick]");
    if(t){
      ov.remove();
      const pid = t.dataset.slotpick;
      const fix = {};
      rosterIds().map(id=>byId[id]).filter(Boolean).forEach(q=>{ fix[q.id] = weekProj(q, w); });
      fix[pid] = Math.max(fix[pid]||0.1, 99);                                     // force into the slot family
      if(cur && cur.p) fix[cur.p.id] = Math.max(0, (fix[cur.p.id]||0)-90);
      const target = bestStartersWeek(rosterIds(), byId, w, fix);
      target.line.forEach(sl=>{ if(sl.p) sl.wp = weekProj(sl.p, w); });
      stageToLineup(target, slotLab+" = "+byId[pid].name.split(" ").slice(-1)[0]);
    }
  });
}
function stagedClear(){ stagedSave([]); renderNow(); }
function stagedCheck(){                                                          // auto-clear when Sleeper matches
  try{
    const md = WEEKST.mate; if(!md || !md.me || !md.me.starters) return;
    const st = new Set(md.me.starters.filter(Boolean));
    const still = stagedGet().filter(x=>!(st.has(x.in) && !st.has(x.out)));
    if(still.length !== stagedGet().length){ stagedSave(still); if(!still.length) toast("✅ Sleeper matches your staged lineup — committed"); }
  }catch(e){}
}
function swapSheet(outId){                                                       // #958
  const byId = idIndex(), out = byId[outId]; if(!out) return;
  const w = curWeek();
  const flexy = ["RB","WR","TE"];
  const lk = lockedIds();
  const bsNow = bestStartersWeek(rosterIds(), byId, w);
  const cands = rosterIds().map(id=>byId[id]).filter(Boolean)
    .filter(p=>p.id!==outId && !lk.has(p.id) && (p.pos===out.pos || (flexy.includes(p.pos) && flexy.includes(out.pos))))
    .map(p=>({p, wp:weekProj(p,w), starting:bsNow.starterIds.has(p.id)})).sort((a,b)=>b.wp-a.wp).slice(0,6);
  const outWp = weekProj(out, w);
  const ov = document.createElement("div"); ov.id = "swapSheet"; ov.className = "snov";
  ov.innerHTML = '<div class="sbcard" role="dialog" aria-label="Swap '+esc(out.name)+'">'+
    '<div class="tag">⇄ REPLACE '+esc(out.name.toUpperCase())+' <span class="mono">'+outWp.toFixed(1)+' proj</span></div>'+
    (cands.length ? cands.map(x=>{
      const d = Math.round((x.wp-outWp)*10)/10;
      const e = injuryOf(x.p), sv = e ? injSeverity(e.s) : null;
      return '<div class="ssrow" data-swapin="'+x.p.id+'" tabindex="0" role="button">'+avatarImg(x.p,30)+
        '<div class="ssnm">'+esc(x.p.name)+'<span class="sssub">'+x.p.pos+(sv?' · <span class="'+sv.cls+'">'+sv.label+'</span>':'')+
        ((typeof gsBadge==="function" && gsBadge(x.p.team))?' · '+gsBadge(x.p.team):'')+
        (x.starting?' · bumps out of his current slot':'')+'</span></div>'+
        '<b class="ssval mono" style="color:var(--'+(d>0?'green':d<0?'red':'dim')+')">'+x.wp.toFixed(1)+' ('+(d>=0?'+':'')+d+')</b></div>';
    }).join("") : '<div class="empty">No eligible bench players this week</div>')+
    '<div class="sspad dim" style="font-size:11px">Staging plans the move here — Sleeper\'s public API can\'t write lineups, so commit it in the Sleeper app (one tap below).</div>'+
    '<div style="padding:6px 12px 12px"><a class="hbtn act" style="text-decoration:none" target="_blank" rel="noopener" href="https://sleeper.com/leagues/'+(S.settings.sleeperLeagueId||"")+'/team">Open my Sleeper team →</a></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov) return ov.remove();
    const t = e.target.closest("[data-swapin]");
    if(t){ ov.remove(); stageSwap(outId, t.dataset.swapin); }
  });
}
document.addEventListener("click", e=>{
  const sw2 = e.target.closest("[data-swap]");
  if(sw2){ e.preventDefault(); e.stopPropagation(); swapSheet(sw2.dataset.swap); return; }
  if(e.target.closest("[data-stagedclear]")){ e.preventDefault(); stagedClear(); return; }
  const us = e.target.closest("[data-unstage]");
  if(us){ e.preventDefault(); e.stopPropagation(); unstageAt(+us.dataset.unstage); return; }
  const sc2 = e.target.closest("[data-slotchip]");
  if(sc2){ e.preventDefault(); e.stopPropagation(); slotSheet(sc2.dataset.slotchip); }
}, true);
function analystReport(){                                                        // #963
  const old = document.getElementById("anOverlay"); if(old){ old.remove(); return; }
  const byId = idIndex(), w = curWeek(), md = WEEKST.mate;
  const wm = winModeFor();
  const bs = bestStartersWeek(rosterIds(), byId, w);
  const opBs = (md && md.opp) ? bestStartersWeek(md.opp.ids, byId, w) : null;
  const {moves} = gamePlanMoves();
  const hist = seasonArchive();
  const slop = (md && md.opp) ? sloppinessOf(md.opp.rid, hist) : null;
  const p2p = pathToPlayoffs();
  const ms = myStandingsRow();
  const soft = rosterIds().map(id=>byId[id]).filter(Boolean).filter(p=>p.pos!=="DEF")
    .map(p=>({p, sos:rosSos(p)})).sort((a,b)=>b.sos-a.sos)[0];
  const oppName = md && md.opp ? md.opp.name : "the opponent";
  const wpPct = opBs ? Math.round(winProb(bs.pts, opBs.pts)*100) : null;
  let paras = [];
  paras.push("WEEK "+w+" OUTLOOK — Otto5"+(ms?" ("+ms.row.w+"-"+ms.row.l+", "+ordinal(ms.place)+")":"")+
    (md && md.opp ? " faces "+oppName+"." : "."));
  if(wpPct!=null) paras.push("The model makes this "+(wpPct>=55?"a game Otto5 should win":wpPct<=45?"an underdog spot":"a coin flip")+
    " — "+wpPct+"% on projections of "+fmt(bs.pts)+"–"+fmt(opBs.pts)+". "+
    (wm.mode==="ceiling" ? "Recommendation: variance. Start the boom-bust profiles and the correlated stack; a safe loss is still a loss."
     : wm.mode==="floor" ? "Recommendation: protect. Floor plays over heroes; make "+oppName+" beat a full lineup." : "Play the best projections straight."));
  if(slop && slop.eff<93) paras.push("Scouting note: "+oppName+" runs at "+slop.eff+"% lineup efficiency and has left "+slop.left+
    " points on their bench this season. Expect a mistake; be positioned to punish it.");
  if(moves.length) paras.push("Action items: "+moves.slice(0,3).map(m=>m.txt.replace(/^[^\w]+\s*/,"")).join(" · ")+".");
  if(SEASON.avail && SEASON.avail.length) paras.push("Wire watch: "+SEASON.avail.slice(0,3).map(p=>p.name).join(", ")+
    " heating league-wide and unrostered in Buck Breakers.");
  if(soft) paras.push("Schedule note: "+soft.p.name+" enters the softest remaining stretch on the roster (avg defense rank "+soft.sos+").");
  if(p2p) paras.push("Season line: "+p2p.line+".");
  try{
    if(window._lastSeasonSim) paras.push("The 500-season sim says: most likely "+window._lastSeasonSim.rec+", "+window._lastSeasonSim.title+"% to win it all.");
  }catch(e){}
  const ov = document.createElement("div"); ov.id = "anOverlay"; ov.className = "snov";
  ov.innerHTML = '<div class="sbcard" role="dialog" aria-label="Analyst brief"><button class="sbx" data-anx="1">✕</button>'+
    '<div class="tag">📰 THE ANALYST — WEEK '+w+' BRIEF</div>'+
    paras.map(p2=>'<p style="max-width:64ch;font-size:13.5px;line-height:1.65;margin:0 0 12px">'+esc(p2)+'</p>').join("")+
    '<div style="padding-top:4px;display:flex;gap:6px"><button class="hbtn" data-anprint="1">🖨 Print</button><button class="hbtn" data-ancopy="1">📋 Copy</button></div></div>';
  window._anText = paras.join(String.fromCharCode(10)+String.fromCharCode(10));
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-anx]")) return ov.remove();
    if(e.target.closest("[data-anprint]")) window.print();
    if(e.target.closest("[data-ancopy]")){
      try{ navigator.clipboard.writeText(window._anText||"").then(()=>toast("📋 Brief copied")).catch(()=>toast("Copy blocked here", {warn:true})); }catch(e2){ toast("Copy blocked here", {warn:true}); }
    }
  });
}
function whileYouWereOut(){                                                      // #964
  try{
    const k = LS_KEY+"-lastseen";
    let last = null; try{ last = JSON.parse(localStorage.getItem(k)||"null"); }catch(e){}
    const ms = myStandingsRow();
    const now = {t:Date.now(), w:ms?ms.row.w:0, l:ms?ms.row.l:0, place:ms?ms.place:0};
    localStorage.setItem(k, JSON.stringify(now));
    if(!last || !ms || Date.now()-last.t < 3*86400e3) return;
    const rows = myWeeklyRows(seasonArchive());
    const lastGame = rows.slice(-1)[0];
    const dW = now.w-(last.w||0), dL = now.l-(last.l||0);
    const ov = document.createElement("div"); ov.id = "wyoOverlay"; ov.className = "snov";
    ov.innerHTML = '<div class="sbcard" role="dialog" style="max-width:520px"><button class="sbx" data-wyx="1">✕</button>'+
      '<div class="tag">👋 WHILE YOU WERE OUT</div>'+
      '<div class="sbply"><span>Since your last visit</span><b>'+(dW||dL ? dW+'W – '+dL+'L' : 'no games played')+'</b></div>'+
      (lastGame && lastGame.opp ? '<div class="sbply"><span>Last result</span><b style="color:var(--'+(lastGame.m.points>lastGame.opp.points?'green':'red')+')">'+
        (lastGame.m.points>lastGame.opp.points?'W ':'L ')+lastGame.m.points.toFixed(1)+'–'+lastGame.opp.points.toFixed(1)+'</b></div>' : '')+
      '<div class="sbply"><span>Standing now</span><b>'+ms.row.w+'-'+ms.row.l+' · '+ordinal(ms.place)+(last.place?' (was '+ordinal(last.place)+')':'')+'</b></div>'+
      '<div style="padding:10px 0;display:flex;gap:8px"><button class="hbtn primary" data-act="renderGamePlan">🏆 This week\'s plan</button>'+
      '<button class="hbtn" data-act="analystReport">📰 Analyst brief</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", e=>{ if(e.target===ov || e.target.closest("[data-wyx]") || e.target.closest("[data-act]")) ov.remove(); });
  }catch(e){}
}

/* ---------- R61 Custom data: CSV projections (#982–#996) ---------- */
function parseProjCsv(text){                                                     // pure (#983)
  const lines = String(text||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return [];
  const delim = (lines[0].match(/\t/g)||[]).length ? "\t" : (lines[0].match(/;/g)||[]).length > (lines[0].match(/,/g)||[]).length ? ";" : ",";
  const rows = [];
  lines.forEach((l,i)=>{
    const parts = l.split(delim).map(x=>x.trim().replace(/^"(.*)"$/, "$1"));
    if(parts.length<2) return;
    const val = parseFloat(parts[parts.length-1].replace(/[^0-9.\-]/g,""));
    const name = parts[0];
    if(i===0 && isNaN(val)) return;                                              // header row
    if(!name || isNaN(val)) return;
    rows.push({name, val});
  });
  return rows;
}
function applyProjCsv(text, fname){                                              // #982/#984/#993
  const rows = parseProjCsv(text);
  if(!rows.length) return {matched:0, un:[], scale:"?", empty:true};
  const avg = rows.reduce((a,r)=>a+r.val,0)/rows.length;
  const scale = avg>60 ? "season" : "ppg";                                       // #993
  const byNorm = {};
  allPlayers().forEach(p=>{ byNorm[normName(p.name)] = p.id; });
  let matched = 0; const un = [];
  rows.forEach(r=>{
    const id = byNorm[normName(r.name)];
    if(!id){ un.push(r.name); return; }
    const season = scale==="season" ? r.val : r.val*16;
    if(season<2 || season>700){ un.push(r.name+" (value "+r.val+"?)"); return; }
    S.overrides[id] = Math.round(season*10)/10;
    matched++;
  });
  if(matched){
    _memo = {key:null};
    commit();
    try{ localStorage.setItem(LS_KEY+"-csvmeta", JSON.stringify({f:fname||"pasted", t:Date.now(), matched, un:un.length, scale})); }catch(e){}
    if(typeof renderNow==="function") renderNow();
  }
  return {matched, un, scale};
}
function csvReport(res, fname){                                                  // #984
  const ov = document.createElement("div"); ov.className = "snov"; ov.id = "csvOverlay";
  ov.innerHTML = '<div class="sbcard" role="dialog"><button class="sbx" data-cvx="1">✕</button>'+
    '<div class="tag">📄 IMPORT: '+esc(fname||"projections")+'</div>'+
    (res.empty ? '<div class="empty">No usable rows found — need name,number lines</div>' :
    '<div class="sbply"><span>Matched (read as '+res.scale+')</span><b class="mono" style="color:var(--green)">'+res.matched+'</b></div>'+
    (res.un.length ? '<div class="benchhead">Unmatched — fix the spelling and re-import</div><div class="sspad dim" style="font-size:12px">'+
      res.un.slice(0,25).map(esc).join(" · ")+(res.un.length>25?' … +'+(res.un.length-25):'')+'</div>' :
      '<div class="benchhead" style="color:var(--green)">Every row matched. Clean sheet.</div>'))+
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{ if(e.target===ov || e.target.closest("[data-cvx]")) ov.remove(); });
}
function exportProjCsv(){                                                        // #989
  const csv = "name,ppg\n" + allPlayers().filter(p=>p.pos!=="DEF")
    .map(p=>'"'+p.name.replace(/"/g,"")+'",'+ppgOf(p)).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
  a.download = "war-room-projections.csv"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  toast("⇩ Template downloaded — edit the ppg column and re-import");
}
function clearOverrides(){                                                       // #990
  const n = Object.keys(S.overrides).length;
  if(!n) return toast("No custom numbers set");
  if(!confirm("Clear "+n+" custom projection"+(n>1?"s":"")+" and return to baked data?")) return;
  S.overrides = {}; _memo = {key:null}; commit();
  try{ localStorage.removeItem(LS_KEY+"-csvmeta"); }catch(e){}
  if(typeof renderNow==="function") renderNow();
  toast("↩ Back to baked projections");
}
async function sleeperPpgImport(){                                               // #992
  try{
    toast("📡 Pulling real season PPG from Sleeper…");
    const yr = new Date().getFullYear();
    const stats = await (await fetch("https://api.sleeper.app/v1/stats/nfl/regular/"+yr)).json();
    const inv = {}; if(typeof HEADSHOT!=="undefined") for(const k in HEADSHOT) inv[HEADSHOT[k]] = k;
    const byNorm = {}; allPlayers().forEach(p=>{ byNorm[normName(p.name)] = p.id; });
    let matched = 0;
    for(const sid in stats){
      const st = stats[sid]; if(!st || !st.gp || !st.pts_ppr || st.gp<1) continue;
      const key = inv[+sid]; if(!key) continue;
      const id = byNorm[key]; if(!id) continue;
      S.overrides[id] = Math.round(st.pts_ppr/st.gp*16*10)/10;
      matched++;
    }
    if(!matched) return toast("No season stats yet — try after week 1 finals", {warn:true});
    _memo = {key:null}; commit();
    try{ localStorage.setItem(LS_KEY+"-csvmeta", JSON.stringify({f:"Sleeper "+yr+" PPG", t:Date.now(), matched, un:0, scale:"ppg"})); }catch(e){}
    if(typeof renderNow==="function") renderNow();
    toast("📡 "+matched+" players now projected from REAL "+yr+" PPG");
  }catch(e){ toast("Sleeper stats fetch failed — try again later", {warn:true}); }
}
function setMyPpg(id){                                                           // #986
  const p = idIndex()[id]; if(!p) return;
  const cur = ppgOf(p);
  const v = prompt("Your PPG for "+p.name+" (now "+cur+"):", cur);
  if(v==null) return;
  const ppg = parseFloat(v);
  if(isNaN(ppg) || ppg<0 || ppg>60) return toast("That's not a PPG", {warn:true});
  S.overrides[id] = Math.round(ppg*16*10)/10;
  _memo = {key:null}; commit(); renderNow();
  toast("📌 "+p.name+" pinned at "+ppg+"/wk");
}
function boostFadePlayer(id, dir){                                               // #987
  const p = idIndex()[id]; if(!p) return;
  S.overrides[id] = Math.round(p.proj*(dir>0?1.1:0.9)*10)/10;
  _memo = {key:null}; commit(); renderNow();
  toast((dir>0?"📈 +10% ":"📉 −10% ")+p.name+" → "+ppgOf(idIndex()[id])+"/wk");
}
(function(){
  const t1=document.getElementById("csvTplBtn"), t2=document.getElementById("csvClearBtn"), t3=document.getElementById("csvSleeperBtn");
  if(t1) t1.addEventListener("click", exportProjCsv);
  if(t2) t2.addEventListener("click", clearOverrides);
  if(t3) t3.addEventListener("click", sleeperPpgImport);
})();
document.addEventListener("change", e=>{                                         // file input (#982)
  if(e.target && e.target.id==="csvIn" && e.target.files && e.target.files[0]){
    const f = e.target.files[0];
    const rd = new FileReader();
    rd.onload = ()=>{ csvReport(applyProjCsv(String(rd.result), f.name), f.name); };
    rd.readAsText(f);
    e.target.value = "";
  }
});
document.addEventListener("click", e=>{                                          // card actions (#986/#987)
  const sp2 = e.target.closest("[data-setppg]");
  if(sp2){ e.preventDefault(); setMyPpg(sp2.dataset.setppg); return; }
  const bf = e.target.closest("[data-boostf]");
  if(bf){ e.preventDefault(); boostFadePlayer(bf.dataset.boostf, +bf.dataset.dir); return; }
  const cc = e.target.closest("[data-cardclaim]");
  if(cc){ e.preventDefault();
    const id = cc.dataset.cardclaim, p = idIndex()[id];
    const b2 = bidSuggest(p, null);
    claimsAdd(id, null, b2.bid);
    toast("📋 Claim planned: "+p.name+" at $"+b2.bid+" — tune it in 📥 Waivers");
  }
});

/* ---------- R62 Season simulator (#997–#1011) ---------- */
function seasonSimCore(opts){                                                    // pure (#997/#1011)
  const {schedule, mu, wins0, pf0, myRid, rivRid, N, seed, myMult, spots, lastW} = opts;
  const rng = mulberry32(seed==null?77:seed);
  const rids = Object.keys(mu).map(Number);
  const recDist = {}, rivalDist = {}, seedCount = new Array((spots||6)+1).fill(0);   // last bucket = miss
  let titles = 0, winsSum = 0;
  const weeks = Object.keys(schedule).map(Number).sort((a,b)=>a-b).filter(w2=>w2<=lastW);
  const noise = ()=> (rng()+rng()+rng()-1.5)*28;
  for(let s2=0; s2<N; s2++){
    const wins = {}, pf = {};
    rids.forEach(r=>{ wins[r] = wins0[r]||0; pf[r] = pf0[r]||0; });
    weeks.forEach(w2=>{
      (schedule[w2]||[]).forEach(pair=>{
        const a = pair[0], b = pair[1];
        const sa = (a===myRid ? mu[a]*(myMult||1) : mu[a]) + noise();
        const sb = (b===myRid ? mu[b]*(myMult||1) : mu[b]) + noise();
        pf[a]+=sa; pf[b]+=sb;
        if(sa>=sb) wins[a]++; else wins[b]++;
      });
    });
    const order = rids.slice().sort((x,y)=> wins[y]-wins[x] || pf[y]-pf[x]);
    const mySeed = order.indexOf(myRid);
    winsSum += wins[myRid];
    const rk = wins[myRid]+"-"+(weeks.length + Object.values(wins0).length? (opts.games - wins[myRid]) : 0);
    const key = wins[myRid]+"-"+(opts.games - wins[myRid]);
    recDist[key] = (recDist[key]||0)+1;
    if(rivRid!=null){ const rk2 = wins[rivRid]+"-"+(opts.games - wins[rivRid]); rivalDist[rk2]=(rivalDist[rk2]||0)+1; }
    if(mySeed < (spots||6)){
      seedCount[mySeed]++;
      // bracket: seeds 0,1 bye; (2 v 5), (3 v 4); winners meet byes; final (#1000)
      const seeds = order.slice(0, spots||6);
      const g = (x,y)=> (mu[x]+noise()) >= (mu[y]+noise()) ? x : y;
      const w1 = g(seeds[2], seeds[5]), w2 = g(seeds[3], seeds[4]);
      const f1 = g(seeds[0], w2), f2 = g(seeds[1], w1);
      if(g(f1, f2)===myRid) titles++;
    } else seedCount[spots||6]++;
  }
  return {recDist, rivalDist, seedCount, titlePct:Math.round(titles/N*1000)/10, winsAvg:Math.round(winsSum/N*10)/10, N};
}
async function seasonSimData(){                                                  // schedule + inputs from live league
  if(!SCOREB.rosters) await leagueWeekData(false);
  if(!SCOREB.rosters) return null;
  await playoffOdds(10);                                                         // warms SCOREB.future + lastOdds
  const w = curWeek(), LAST = 14;
  const schedule = {};
  const addWeek = (wk, mus)=>{ const pairs = {}; (mus||[]).forEach(m=>{ (pairs[m.matchup_id]=pairs[m.matchup_id]||[]).push(m.roster_id); });
    schedule[wk] = Object.values(pairs).filter(p2=>p2.length===2); };
  addWeek(w, SCOREB.mus);
  for(let fw=w+1; fw<=LAST; fw++) addWeek(fw, (SCOREB.future||{})[fw]);
  const st = standingsRows(SCOREB.rosters, SCOREB.users);
  const mu = {}, wins0 = {}, pf0 = {};
  st.forEach(r=>{ mu[r.rid] = Math.max(80, rosterStrengthOf(r.rid)/16); wins0[r.rid] = r.w; pf0[r.rid] = r.pf; });
  const rivRid = (S.settings.slot2rid && S.settings.rivalSlot) ? +S.settings.slot2rid[String(S.settings.rivalSlot)] : null;
  return {schedule, mu, wins0, pf0, myRid:+S.settings.sleeperRosterId, rivRid, spots:6, lastW:LAST, games:14};
}
function myEffMult(){                                                            // #1002
  try{
    const rows = myWeeklyRows(seasonArchive());
    const effs = rows.map(r=>r.eff?r.eff.eff:null).filter(Boolean);
    if(!effs.length) return 0.97;
    return Math.max(0.85, Math.min(1, effs.reduce((a,b)=>a+b,0)/effs.length/100));
  }catch(e){ return 0.97; }
}
async function renderSeasonSim(){                                                // #997
  const old = document.getElementById("fsOverlay"); if(old){ old.remove(); return; }
  toast("🔮 Simulating the rest of the season…");
  const data = await seasonSimData();
  if(!data) return toast("Link the league first", {warn:true});
  const seed = curWeek()*31 + (window._simReroll||0);                             // #1004
  const injOn = S.settings.simInjuries!==false && typeof seasonSimX==="function"; // #1092
  const vectors = (typeof weeklyVectors==="function" && SCOREB.rosters) ? weeklyVectors(data) : null;   // #1097
  const CORE2 = (typeof seasonSimX==="function") ? seasonSimX : (d2,o2)=>seasonSimCore(Object.assign({},d2,o2));
  const t0 = performance.now();
  const opt = CORE2(data, {N:500, seed, myMult:1, injuries:injOn, vectors});
  const act = CORE2(data, {N:500, seed:seed+1, myMult:myEffMult(), injuries:injOn, vectors});  // #1002
  const simMs = Math.round(performance.now()-t0);
  const w = curWeek(), byId = idIndex();
  // week-by-week win prob strip (#1001)
  const myBs = bestStartersWeek(rosterIds(), byId, w);
  const strip = [];
  Object.keys(data.schedule).map(Number).sort((a,b)=>a-b).forEach(wk=>{
    (data.schedule[wk]||[]).forEach(pair=>{
      if(!pair.includes(data.myRid)) return;
      const opp = pair[0]===data.myRid ? pair[1] : pair[0];
      const myMu = vectors ? vectors.mu[data.myRid][wk] : data.mu[data.myRid];
      const opMu = vectors ? vectors.mu[opp][wk] : data.mu[opp];
      strip.push({w:wk, opp:ridName(opp), wp:Math.round(winProb(myMu, opMu)*100), rival:opp===data.rivRid,
        dip: vectors && myMu < data.mu[data.myRid]*0.92});
    });
  });
  const topRec = Object.entries(opt.recDist).sort((a,b)=>b[1]-a[1])[0];
  window._lastSeasonSim = {rec:topRec[0], title:opt.titlePct};                    // #1009
  const recBars = Object.entries(opt.recDist).sort((a,b)=>(+b[0].split("-")[0])-(+a[0].split("-")[0]));
  const mxRec = Math.max(...recBars.map(x=>x[1]), 1);
  const seedLabels = ["1st seed","2nd seed","3rd","4th","5th","6th","MISS"];
  const effCost = Math.round((opt.winsAvg-act.winsAvg)*10)/10;
  const ov = document.createElement("div"); ov.id = "fsOverlay"; ov.className = "snov";
  let h = '<div class="sbcard" role="dialog" aria-label="Season simulator"><button class="sbx" data-fsx="1">✕</button>';
  h += '<div class="tag">🔮 500 SIMULATED SEASONS — from week '+w+(injOn?' · 🩹 injury world ('+(opt.injPerSeason||0)+'/roster)':' · clean world')+'</div>'+
    '<div class="sspad" style="font-size:11px"><label><input type="checkbox" id="fsInj"'+(injOn?' checked':'')+'> simulate injuries (hazard model)</label> <button class="undo1" data-act="renderFragility">🩹 fragility report</button></div>';
  h += '<div class="benchhead" style="font-size:15px">Most likely: <b class="mono" style="color:var(--gold)">'+topRec[0]+'</b> ('+Math.round(topRec[1]/opt.N*100)+'% of sims) · avg <b class="mono">'+opt.winsAvg+'</b> wins</div>';
  h += '<div class="benchhead">📊 Final record</div>'+recBars.map(([k,n])=>
    '<div class="bar" style="display:grid;grid-template-columns:44px 1fr 44px;gap:8px;align-items:center;font-size:12px;padding:1px 12px">'+
    '<span class="mono">'+k+'</span><span style="height:9px;background:var(--line);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:'+Math.round(n/mxRec*100)+'%;background:var(--green);border-radius:5px"></i></span>'+
    '<span class="mono dim">'+Math.round(n/opt.N*100)+'%</span></div>').join("");
  h += '<div class="benchhead">🎫 Where you land</div><div class="scarce" style="padding:0 12px 6px">'+
    opt.seedCount.map((n,i)=>'<span class="scpill'+(i<2?' good':i===6?' warn':'')+'">'+seedLabels[i]+' <b class="mono">'+Math.round(n/opt.N*100)+'%</b></span>').join("")+'</div>';
  h += '<div class="sbply"><span>👑 Championship chain</span><b class="mono">make '+(opt.makePct!=null?opt.makePct:Math.round((1-opt.seedCount[6]/opt.N)*100))+'%'+
    (opt.finalPct!=null?' → final '+opt.finalPct+'%':'')+' → title <span style="color:var(--gold)">'+opt.titlePct+'%</span></b></div>';
  if(opt.lastPct!=null && opt.lastPct>0) h += '<div class="sbply"><span>🚽 Toilet-bowl risk</span><b class="mono" style="color:var(--'+(opt.lastPct>15?'red':'dim')+')">'+opt.lastPct+'%</b></div>';
  if(opt.rivalH2HPct!=null) h += '<div class="sbply"><span>😈 vs rival across sims</span><b class="mono">'+opt.rivalH2HPct+'% H2H</b></div>';
  if(effCost>=0.2) h += '<div class="sbply"><span>🎯 Lineup discipline is worth</span><b style="color:var(--red)">'+effCost+' wins</b><span class="dimtxt">optimal vs your '+Math.round(myEffMult()*100)+'% efficiency</span></div>';
  h += '<div class="benchhead">🗓 The road (win prob by week)</div><div class="scarce" style="padding:0 12px 8px">'+
    strip.map(x=>'<span class="scpill'+(x.rival?' warn':'')+'" title="week '+x.w+' vs '+esc(x.opp)+(x.dip?' — bye-week dent':'')+'">W'+x.w+(x.dip?'🕳':'')+' '+esc(x.opp.slice(0,8))+' <b class="mono" style="color:var(--'+(x.wp>=55?'green':x.wp<=45?'red':'gold')+')">'+x.wp+'%</b></span>').join("")+'</div>'+
    (simMs!=null?'<div class="sspad dimtxt" style="font-size:10px">'+opt.N*2+' seasons in '+simMs+'ms · '+(vectors?'weekly-lineup vectors':'flat strength')+'</div>':'');
  if(data.rivRid!=null){
    const rTop = Object.entries(act.rivalDist).sort((a,b)=>b[1]-a[1])[0];
    if(rTop) h += '<div class="sbply"><span>😈 Rival most likely lands</span><b class="mono">'+rTop[0]+'</b></div>';
  }
  h += '<div style="padding:10px 0"><button class="hbtn" data-fsroll="1">🎲 Re-roll</button></div></div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-fsx]")) return ov.remove();
    if(e.target.closest("[data-fsroll]")){ window._simReroll = (window._simReroll||0)+1; ov.remove(); renderSeasonSim(); return; }
    if(e.target.id==="fsInj"){ S.settings.simInjuries = e.target.checked; commit(); ov.remove(); renderSeasonSim(); }
  });
}

window.__mod = window.__mod || []; window.__mod.push("win.js");
