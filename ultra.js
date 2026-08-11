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
  if(S.settings.voxBridge!==false && !VOX.on && (window.SpeechRecognition||window.webkitSpeechRecognition)) { try{ voxStart(); }catch(e){} }
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

/* ---------- R75 THE VOICE (#1182–#1196) ---------- */
const VOX = {rec:null, on:false, last:""};
function voxSay(text){                                                           // #1183/#1193
  try{
    if(S.settings.voxSpeak===false || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    const want = S.settings.voxVoice;
    if(want){ const v = speechSynthesis.getVoices().find(x=>x.name===want); if(v) u.voice = v; }
    u.rate = 1.02; u.pitch = 1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){}
}
function voxSwagger(base, swag){                                                 // #1193
  return (typeof hypeOn==="function" && hypeOn("full") && swag) ? base+" "+swag : base;
}
function voxAnswer(q){                                                           // pure-ish intent → answer (#1184–#1189)
  const t = String(q||"").toLowerCase().trim().replace(/^war ?room[,\s]*/,"");
  const byId = idIndex(), w = curWeek(), md = WEEKST.mate;
  const bs = rosterIds().length ? bestStartersWeek(rosterIds(), byId, w) : null;
  const nameHit = txt=>{
    const ids = rosterIds().concat((typeof freeAgents==="function" ? freeAgents().slice(0,120).map(p=>p.id) : []));
    let best = null;
    ids.map(id=>byId[id]).filter(Boolean).forEach(p=>{
      const last = p.name.split(" ").slice(-1)[0].toLowerCase();
      if(txt.includes(p.name.toLowerCase()) || (last.length>3 && txt.includes(last))) best = best||p;
    });
    return best;
  };
  if(/^(open |show |go to )?(war ?room|bridge)$/.test(t) || t.includes("war room mode")){ bridgeOpen(); return {say:"War room mode.", act:1}; }
  if(/(open|show)\s+(the\s+)?plan|read me the plan|what.s the plan/.test(t)){
    try{
      const {moves} = gamePlanMoves();
      if(!moves.length) return {say:voxSwagger("No moves needed. The lineup is already optimal.","Sit back.")};
      return {say:"Week "+w+" plan. "+moves.slice(0,3).map((m,i)=>(i+1)+". "+m.txt.replace(/^[^\w]+\s*/,"")+", "+m.tag.t.toLowerCase()).join(". ")+"."};
    }catch(e){ return {say:"The plan isn't ready yet."}; }
  }
  if(/brief|analyst|report/.test(t)){ if(typeof analystReport==="function") analystReport(); return {say:"Opening the analyst brief.", act:1}; }
  if(/(score|winning|losing|how.s it going)/.test(t)){
    if(!md || !md.me) return {say:"No live matchup loaded yet."};
    const mine = md.me.pts, theirs = md.opp ? md.opp.pts : 0;
    const ytp = (typeof yetToPlay==="function") ? yetToPlay(md.me) : null;
    const wp = window._liveWp!=null ? window._liveWp : (bs && md.opp ? Math.round(winProb(bs.pts, bestStartersWeek(md.opp.ids, byId, w).pts)*100) : null);
    const lead = mine-theirs;
    return {say:voxSwagger("You have "+mine.toFixed(1)+", "+(md.opp?md.opp.name:"they")+" "+theirs.toFixed(1)+". "+
      (lead>=0?"Up "+lead.toFixed(1)+".":"Down "+(-lead).toFixed(1)+".")+
      (ytp?" "+ytp.waiting.length+" of yours left to play.":"")+(wp!=null?" Win probability "+wp+" percent.":""),
      lead>=0?"Keep your foot down.":"Not over yet.")};
  }
  if(/playoff|odds|chances/.test(t)){
    const odds = SEASON.lastOdds ? SEASON.lastOdds[+S.settings.sleeperRosterId] : null;
    return {say: odds!=null ? voxSwagger("Playoff odds "+odds+" percent.","Book it.") : "Playoff odds haven't computed yet."};
  }
  if(/should i start|start or sit|who should i start/.test(t)){
    const p = nameHit(t);
    if(p && bs){
      const starting = bs.starterIds.has(p.id);
      const wp2 = weekProj(p, w);
      const alt = (typeof benchSwapFor==="function") ? benchSwapFor(p) : null;
      return {say: starting ? p.name+" is in the optimal lineup at "+wp2.toFixed(1)+" projected. Start him."
        : p.name+" projects "+wp2.toFixed(1)+", below your starter"+(alt?" "+alt.name:"")+". Bench him."};
    }
    if(bs) return {say:"Your optimal nine is "+bs.line.filter(sl=>sl.p).slice(0,3).map(sl=>sl.p.name).join(", ")+" and six more. Say a name for a verdict."};
  }
  if(/^(start|swap|play)\s/.test(t) && /\bfor\b|\bover\b|\binstead\b/.test(t)){   // #1188
    const parts = t.split(/\bfor\b|\bover\b|\binstead of\b/);
    const inn = nameHit(parts[0]||""), out = nameHit(parts[1]||"");
    if(inn && out && typeof stageSwap==="function"){ stageSwap(out.id, inn.id); return {say:"Staged "+inn.name+" in for "+out.name+". Commit it in Sleeper.", act:1}; }
    return {say:"I couldn't match both names."};
  }
  if(/open sim|simulate|sim center/.test(t)){ if(typeof simCenter==="function") simCenter(); return {say:"Sim center.", act:1}; }
  if(/waiver|wire|pick ?up/.test(t)){ if(typeof renderWaivers==="function") renderWaivers(); return {say:"Waiver wire.", act:1}; }
  if(/scout|opponent/.test(t)){ if(typeof scoutMyOpponent==="function") scoutMyOpponent(); return {say:"Scouting them now.", act:1}; }
  if(/hype|talk|trash/.test(t)){ const line = (typeof trashTalk==="function") ? trashTalk() : hypeLine(); return {say:String(line).replace(/<[^>]+>/g,"")}; }
  return {say:"Say: score, plan, brief me, playoff odds, should I start a name, or war room."};
}
function voxAsk(q){                                                              // shared by voice + typed box (#1195)
  const r = voxAnswer(q);
  const chip = document.getElementById("voxChip");
  if(chip){ chip.textContent = "“"+q+"” → "+r.say; chip.hidden = false; setTimeout(()=>{ if(chip) chip.hidden = true; }, 9000); }
  toast("🎙 "+r.say);
  voxSay(r.say);
  return r;
}
function voxStart(){                                                             // #1182
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return toast("This browser has no speech recognition — use the ask box", {warn:true});
  if(VOX.on){ try{ VOX.rec.stop(); }catch(e){} VOX.on = false; document.body.classList.remove("voxon"); return toast("🎙 off"); }
  const rec = new SR();
  rec.continuous = true; rec.interimResults = false; rec.lang = "en-US";
  rec.onresult = ev=>{
    const txt = ev.results[ev.results.length-1][0].transcript.trim();
    VOX.last = txt;
    if(S.settings.voxWake && !/^war ?room/i.test(txt)) return;                    // #1190
    voxAsk(txt);
  };
  rec.onend = ()=>{ if(VOX.on){ try{ rec.start(); }catch(e){} } };
  rec.onerror = ()=>{};
  VOX.rec = rec; VOX.on = true; document.body.classList.add("voxon");
  try{ rec.start(); }catch(e){}
  toast("🎙 Listening — ask me anything. Say 'score' or 'read me the plan'.");
}
function voxUi(){                                                                // mount chip + ask box (#1191/#1195)
  if(!document.getElementById("voxChip")){
    const chip = document.createElement("div"); chip.id = "voxChip"; chip.hidden = true; chip.setAttribute("role","status");
    document.body.appendChild(chip);
  }
  const btn = document.getElementById("voxAskBtn"), inp = document.getElementById("voxAsk");
  if(btn && !btn.dataset.wired){
    btn.dataset.wired = "1";
    btn.addEventListener("click", ()=>{ if(inp && inp.value.trim()){ voxAsk(inp.value.trim()); inp.value=""; } });
    if(inp) inp.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); btn.click(); } });
  }
}

/* ---------- R76 THE ARSENAL (#1197–#1211) ---------- */
function arsSafe(){ return !!S.settings.arsSafe; }                               // #1203
function arsHeat(){ return arsSafe() ? "mild" : ((typeof hypeDial==="function") ? hypeDial() : "standard"); }
function roastFor(rid, ctx){                                                     // #1202/#1214 data-backed only
  const lines = [];
  const slop = ctx.slop[rid], ap = ctx.ap.find(x=>+x.rid===+rid), tend = ctx.tend.find(x=>+x.rid===+rid);
  const st = ctx.st.find(x=>+x.rid===+rid);
  const heat = arsHeat();
  if(slop && slop.eff<92) lines.push(heat==="full" ? "has donated "+slop.left+" points to their own bench — a charitable organization"
    : "leaves points on the bench ("+slop.eff+"% lineup efficiency)");
  if(ap && ap.luck>1) lines.push(heat==="full" ? "is "+ap.luck+" wins of pure luck away from being honest" : "is running "+ap.luck+" wins above expected");
  if(ap && ap.luck<-1) lines.push("is owed "+(-ap.luck)+" wins by the schedule — genuinely unlucky");
  if(tend && tend.faab===0 && tend.claims===0) lines.push(heat==="full" ? "hasn't touched the waiver wire. Set and forget, emphasis on forget" : "has made no waiver moves");
  if(tend && tend.zeros>2) lines.push(heat==="full" ? "started "+tend.zeros+" players who scored zero. Zero. Nothing." : "has started "+tend.zeros+" zero-point players");
  if(st && ctx.st[0] && +ctx.st[0].rid===+rid) lines.push(heat==="full" ? "is in first and won't shut up about it (relatable)" : "leads the league");
  if(!lines.length && st) lines.push(st.w+"-"+st.l+", "+st.pf+" points for — quietly going about it");
  return lines[0];
}
async function arsenalCtx(){
  if(!SCOREB.rosters) await leagueWeekData(false);
  const hist = await leagueHistory();
  const tx = await txHistory();
  const st = standingsRows(SCOREB.rosters, SCOREB.users);
  const slop = {}; st.forEach(r=>{ slop[r.rid] = (typeof sloppinessOf==="function") ? sloppinessOf(r.rid, hist) : null; });
  return {hist, st, slop, ap:allPlayStandings(hist, SCOREB.rosters, SCOREB.users), tend:leagueTendencies(tx, hist),
    pr:(typeof powerRankings==="function")?powerRankings():[], aw:hist.length?weeklyAwards(hist[hist.length-1], SCOREB):null};
}
function powerRankingsText(ctx){                                                 // #1198
  const w = curWeek();
  const rows = ctx.pr.length ? ctx.pr : ctx.st;
  let t = "🏈 BUCK BREAKERS POWER RANKINGS — WEEK "+w+"\n\n";
  rows.forEach((r,i)=>{
    const mv = r.move>0 ? " ▲"+r.move : r.move<0 ? " ▼"+(-r.move) : "";
    t += (i+1)+". "+r.name+" ("+r.w+"-"+r.l+")"+mv+"\n   "+roastFor(r.rid, ctx)+"\n";
  });
  t += "\n— compiled by the Draft War Room";
  return t;
}
function newsletterText(ctx){                                                    // #1200
  const w = curWeek(), hist = ctx.hist;
  const last = hist.length ? hist[hist.length-1] : null;
  let t = "📰 THE BUCK BREAKERS WEEKLY — after week "+(hist.length||w)+"\n\n";
  if(last){
    const pairs = {}; last.forEach(m=>{ (pairs[m.matchup_id]=pairs[m.matchup_id]||[]).push(m); });
    t += "SCORES\n";
    Object.values(pairs).forEach(pr=>{ if(pr.length!==2) return;
      const [a,b] = pr[0].points>=pr[1].points ? pr : [pr[1],pr[0]];
      t += "  "+ridName(a.roster_id)+" "+(a.points||0).toFixed(1)+" def. "+ridName(b.roster_id)+" "+(b.points||0).toFixed(1)+"\n"; });
    if(ctx.aw) t += "\nAWARDS\n  🥇 High: "+ctx.aw.hi.name+" ("+ctx.aw.hi.pts+")\n  🥶 Low: "+ctx.aw.lo.name+" ("+ctx.aw.lo.pts+")\n"+
      (ctx.aw.blow?"  🔨 Blowout: "+ctx.aw.blow.name+" by "+ctx.aw.blow.d+"\n":"")+
      (ctx.aw.nail?"  😅 Nail-biter: "+ctx.aw.nail.name+" by "+ctx.aw.nail.d+"\n":"");
  }
  const worst = Object.entries(ctx.slop).filter(([,v])=>v).sort((a,b)=>a[1].eff-b[1].eff)[0];
  if(worst) t += "\nBIGGEST SELF-OWN\n  "+ridName(worst[0])+" — "+worst[1].left+" points left on the bench this season ("+worst[1].eff+"% efficiency)\n";
  const moves = (WAIV.tx||[]).slice(0,5);
  if(moves.length){ t += "\nTRANSACTION WIRE\n"; moves.forEach(m=>{ t += "  "+ridName(m.rid)+(m.adds.length?" ➕"+m.adds.join(", "):"")+(m.drops.length?" ➖"+m.drops.join(", "):"")+(m.bid?" ($"+m.bid+")":"")+"\n"; }); }
  t += "\nNEXT WEEK\n";
  if(SCOREB.mus){ const rows = scoreboardRows(SCOREB, idIndex());
    rows.forEach(([a,b])=>{ t += "  "+a.name+" vs "+b.name+"\n"; }); }
  t += "\n— The Draft War Room";
  return t;
}
function smackText(ctx){                                                         // #1199
  const md = WEEKST.mate;
  if(!md || !md.opp) return "No opponent this week.";
  const byId = idIndex(), w = curWeek();
  const mine = bestStartersWeek(rosterIds(), byId, w).pts;
  const theirs = bestStartersWeek(md.opp.ids, byId, w).pts;
  const wp = Math.round(winProb(mine, theirs)*100);
  const slop = ctx.slop[md.opp.rid];
  const heat = arsHeat();
  let t = "WEEK "+w+": Otto5 vs "+md.opp.name+"\n";
  t += "Projected: "+fmt(mine)+" — "+fmt(theirs)+" ("+wp+"% Otto5)\n";
  if(slop && slop.eff<92) t += (heat==="full" ? "They've left "+slop.left+" points on their own bench this year. I'll take the ones they leave out.\n"
    : "They run "+slop.eff+"% lineup efficiency.\n");
  if(heat==="full") t += (typeof trashTalk==="function" ? String(trashTalk()).replace(/<[^>]+>/g,"")+"\n" : "");
  return t;
}
function arsLog(line){                                                           // #1205
  try{
    const k = LS_KEY+"-arslog";
    const a = JSON.parse(localStorage.getItem(k)||"[]");
    a.unshift({t:Date.now(), w:curWeek(), line:String(line).slice(0,180)});
    localStorage.setItem(k, JSON.stringify(a.slice(0,60)));
  }catch(e){}
}
function arsCopy(text){                                                          // #1204
  try{
    navigator.clipboard.writeText(text).then(()=>{ toast("📋 Copied — go ruin their week"); arsLog(text.split("\n")[0]); })
      .catch(()=>arsFallback(text));
  }catch(e){ arsFallback(text); }
}
function arsFallback(text){
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:500;width:min(92vw,680px);height:60vh";
  document.body.appendChild(ta); ta.select();
  toast("Select-all shown — copy manually, then click away", {warn:true});
  ta.addEventListener("blur", ()=>ta.remove());
}
function rankingsPng(ctx){                                                       // #1206
  const rows = (ctx.pr.length ? ctx.pr : ctx.st).slice(0, 12);
  const H = 140 + rows.length*62;
  const c = document.createElement("canvas"); c.width = 1000; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#0b0f14"; x.fillRect(0,0,1000,H);
  x.fillStyle = "#f0b429"; x.font = "bold 44px sans-serif"; x.fillText("POWER RANKINGS", 40, 66);
  x.fillStyle = "#8b98a9"; x.font = "24px sans-serif"; x.fillText("Buck Breakers · week "+curWeek(), 40, 102);
  rows.forEach((r,i)=>{
    const y = 150+i*62;
    x.fillStyle = "#e8eef5"; x.font = "bold 28px sans-serif";
    x.fillText((i+1)+". "+r.name, 40, y);
    x.fillStyle = "#8b98a9"; x.font = "20px sans-serif";
    x.fillText(r.w+"-"+r.l, 620, y);
    const line = roastFor(r.rid, ctx)||"";
    x.fillStyle = "#556270"; x.font = "17px sans-serif";
    x.fillText(line.length>62?line.slice(0,60)+"…":line, 40, y+24);
  });
  c.toBlob(b=>{ const a = document.createElement("a"); a.href = URL.createObjectURL(b);
    a.download = "power-rankings-wk"+curWeek()+".png"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 5000); });
  toast("⇩ Rankings image downloaded");
}
async function renderArsenal(){                                                  // #1197
  const old = document.getElementById("arOverlay"); if(old){ old.remove(); return; }
  toast("📢 Loading the arsenal…");
  const ctx = await arsenalCtx();
  if(!ctx.st.length) return toast("Link the league first", {warn:true});
  window._arsCtx = ctx;
  const pr = powerRankingsText(ctx), nl = newsletterText(ctx), sm = smackText(ctx);
  window._arsTexts = {pr, nl, sm};
  const ov = document.createElement("div"); ov.id = "arOverlay"; ov.className = "snov";
  ov.innerHTML = '<div class="sbcard" role="dialog" aria-label="The arsenal"><button class="sbx" data-arx="1">✕</button>'+
    '<div class="tag">📢 THE ARSENAL — week '+curWeek()+(arsSafe()?' · commissioner-safe':'')+'</div>'+
    '<div class="sspad" style="display:flex;gap:6px;flex-wrap:wrap">'+
      '<button class="hbtn act" data-arscopy="pr">📋 Power rankings</button>'+
      '<button class="hbtn" data-arspng="1">🖼 Rankings PNG</button>'+
      '<button class="hbtn act" data-arscopy="nl">📋 Newsletter</button>'+
      '<button class="hbtn" data-arscopy="sm">📋 Smack (this week)</button>'+
      '<button class="hbtn" data-act="scoutMyOpponent">📤 Smack card PNG</button>'+
      '<label class="dimtxt" style="display:flex;align-items:center;gap:5px;font-size:11px"><input type="checkbox" data-arssafe="1"'+(arsSafe()?" checked":"")+'> commissioner-safe</label>'+
    '</div>'+
    '<div class="benchhead">Preview — power rankings</div>'+
    '<pre class="arspre">'+esc(pr)+'</pre>'+
    '<div class="benchhead">Preview — newsletter</div>'+
    '<pre class="arspre">'+esc(nl)+'</pre></div>';
  document.body.appendChild(ov);
  ov.addEventListener("change", e=>{
    if(e.target.closest("[data-arssafe]")){ S.settings.arsSafe = e.target.checked; commit(); ov.remove(); renderArsenal(); }
  });
  ov.addEventListener("click", e=>{
    if(e.target===ov || e.target.closest("[data-arx]")) return ov.remove();
    const cp = e.target.closest("[data-arscopy]");
    if(cp) arsCopy(window._arsTexts[cp.dataset.arscopy]||"");
    if(e.target.closest("[data-arspng]")) rankingsPng(window._arsCtx);
  });
}
function arsenalAutoFire(){                                                      // #1207
  try{
    if(S.settings.arsAuto===false) return;
    if(new Date().getDay()!==2) return;                                          // Tuesday
    const k = LS_KEY+"-arsauto"+curWeek();
    if(localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    alertFire("arsenal", "📢 This week's artillery is ready", "Power rankings + newsletter waiting in the Arsenal");
  }catch(e){}
}

window.__mod = window.__mod || []; window.__mod.push("ultra.js");
