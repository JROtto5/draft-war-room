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
    return '<div class="benchhead">👑 Title chase: <b class="mono">'+odds+'%</b> to the dance '+
      sparkSvg(th.map(x=>x.o), 70, 16)+' · '+toGo+' week'+(toGo===1?'':'s')+' to the money game</div>';
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
    '<button class="hbtn" onclick="hypeCard()">🔥 Hype card</button>'+
    '<button class="hbtn" onclick="receiptsCard()">🧾 Receipts</button>'+
    '<button class="hbtn" onclick="pregameSpeech()">🎙 Speech</button>'+
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
  h += '<div class="sbply"><span>week '+w+' optimal projection</span><b class="mono">'+fmt(theirBs.pts)+'</b></div>';
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
  h += '<div style="padding:10px 0"><button class="hbtn" id="scPng">📤 Share the beatdown</button> <button class="hbtn" id="scTalk">🗣 Talk</button></div><div id="scOut"></div></div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-scx]")) return ov.remove();
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

window.__mod = window.__mod || []; window.__mod.push("win.js");
