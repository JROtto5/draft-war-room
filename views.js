/* Draft War Room · views: every render function, cards, modals content.
   MIT License — see LICENSE. © 2026 JROtto5 / Draft War Room. */
/* ---------- Rendering ---------- */
const $ = s => document.querySelector(s);

function posBadge(pos){ return '<span class="pos '+pos+'">'+pos+'</span>'; }

/* Fuzzy player search: punctuation-insensitive, multi-token AND with
   word-prefix matching, plus initials/subsequence for shorthand
   ("jsn" → Jaxon Smith-Njigba, "cmc" → Christian McCaffrey). */
function matchesQuery(p, q){
  const toks = nq(q).split(/\s+/).filter(Boolean);
  if(!toks.length) return true;
  const hay = nq(p.name+" "+p.team);
  const words = nq(p.name).split(/\s+/);
  const ok = toks.every(tok => hay.includes(tok) || words.some(w=>w.startsWith(tok)));
  if(ok) return true;
  if(toks.length===1 && toks[0].length>=2){
    const tok = toks[0];
    if(words.map(w=>w[0]).join("").includes(tok)) return true;
    if(tok.length>=3 && isSubseq(tok, words.join(""))) return true;
  }
  return false;
}
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
/* ---------- Injury intelligence (live ESPN + baked Sleeper/ESPN) ---------- */
let INJ = {map:{}, at:0, src:"baked snapshot"};
function initInjuries(){
  const m = {};
  if(typeof PLAYERMETA!=="undefined")
    for(const k in PLAYERMETA){
      const v = PLAYERMETA[k];
      if(v[6]) m[k] = {s:v[6], c:(v[10]||"") || (v[9] ? "("+v[9]+")" : ""), d:"", src:"Sleeper"};
    }
  if(typeof INJBASE!=="undefined")
    for(const k in INJBASE) m[k] = {s:INJBASE[k][0], c:INJBASE[k][1], d:INJBASE[k][2], src:"ESPN"};
  INJ.map = m;
  try{
    const c = JSON.parse(localStorage.getItem(LS_KEY+"-inj"));
    if(c && Date.now()-c.at < 6*3600e3) INJ = {map:c.map, at:c.at, src:"ESPN (cached)"};
  }catch(e){}
}
function injuryOf(p){
  const e = INJ.map[normName(p.name)];
  return e && injSeverity(e.s) ? e : null;
}
function injAdpFactor(p){
  const e = injuryOf(p); if(!e) return 1;
  const sv = injSeverity(e.s);
  return {Q:1.02, D:1.08, O:1.2, IR:1.8, "?":1.04}[sv.code] || 1;
}
let _injFails = 0, _injLastTry = 0;
async function refreshInjuries(silent){
  if(navigator.onLine===false){ if(!silent) toast("📡 Offline — showing "+INJ.src, {warn:true}); return; }
  if(silent && _injFails && Date.now()-_injLastTry < Math.min(30, 5*Math.pow(2,_injFails))*60e3) return;
  _injLastTry = Date.now();
  try{
    const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries");
    if(!r.ok) throw 0;
    const j = await r.json();
    const m = {}, changes = [];
    const known = {}; allPlayers().forEach(p=>known[normName(p.name)]=p);
    (j.injuries||[]).forEach(t=>(t.injuries||[]).forEach(i=>{
      const a = i.athlete||{}, k = normName(a.displayName||"");
      const st = i.status||"";
      if(!k || /^active/i.test(st)) return;
      m[k] = {s:st, c:(i.shortComment||i.longComment||"").slice(0,240), d:(i.date||"").slice(0,10), src:"ESPN"};
    }));
    for(const k in m){
      const p = known[k];
      if(!p || S.taken[p.id]) continue;
      const oldE = INJ.map[k];
      if(!oldE || oldE.s!==m[k].s) changes.push({p, s:m[k].s, mine:S.mine.includes(p.id)});
    }
    for(const k in INJ.map){ if(!m[k] && INJ.map[k].src==="Sleeper") m[k]=INJ.map[k]; }
    INJ = {map:m, at:Date.now(), src:"ESPN live"};
    try{ localStorage.setItem(LS_KEY+"-inj", JSON.stringify({at:INJ.at, map:m})); }catch(e){}
    _memo = {key:null};
    if(S.log.length > 0) changes.slice(0,3).forEach(c=>
      toast((c.mine?"🚨 YOUR PLAYER — ":"🩹 ")+esc(c.p.name)+": "+esc(c.s), {warn:true}));
    if(S.settings.notifyInj && "Notification" in window && Notification.permission==="granted" && document.visibilityState==="hidden"){
      const mineCh = changes.filter(c=>c.mine);
      if(mineCh.length===1){
        try{ new Notification("🩹 "+mineCh[0].p.name, {body:mineCh[0].s, icon:"icon-192.png", tag:"inj"}); }catch(e2){}
      } else if(mineCh.length>1){
        try{ new Notification("🩹 "+mineCh.length+" of your players changed status",
          {body:mineCh.map(c=>c.p.name.split(" ").slice(-1)[0]+": "+c.s).join(" · ").slice(0,180), icon:"icon-192.png", tag:"inj"}); }catch(e2){}
      }
    }
    render();
    if(document.getElementById("injOverlay").classList.contains("show")) renderInjCenter();
    _injFails = 0;
    if(!silent) toast("🩺 Injuries refreshed — "+Object.keys(m).length+" league-wide reports");
  }catch(e){
    _injFails++;
    if(!silent) toast("Injury refresh failed — using "+INJ.src, {warn:true});
  }
}
/* market buzz: Sleeper trending adds (24h) */
let TREND = {map:{}, at:0};
async function refreshTrending(){
  try{
    const r = await fetch("https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=100");
    if(!r.ok) throw 0;
    const arr = await r.json();
    const inv = {};
    if(typeof HEADSHOT!=="undefined") for(const k in HEADSHOT) inv[HEADSHOT[k]] = k;
    const m = {};
    arr.forEach(x=>{ const k = inv[+x.player_id]; if(k) m[k] = x.count; });
    TREND = {map:m, at:Date.now()};
  }catch(e){}
}
function buzzOf(p){ return TREND.map[normName(p.name)] || 0; }
/* ESPN news headlines */
let NEWS = {list:[], at:0};
async function refreshNews(){
  if(Date.now()-NEWS.at < 10*60e3) return;
  try{
    const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=20");
    if(!r.ok) throw 0;
    const j = await r.json();
    NEWS = {list:(j.articles||[]).map(a=>({h:a.headline||"", d:(a.published||"").slice(0,10), u:(a.links&&a.links.web&&a.links.web.href)||""})), at:Date.now()};
  }catch(e){}
}
function newsFor(p){
  const last = p.name.split(" ").slice(-1)[0];
  return NEWS.list.find(n=>n.h.includes(p.name) || (last.length>4 && n.h.includes(last)));
}

function physFor(p){ return (typeof PHYS!=="undefined" && PHYS[normName(p.name)]) || null; }
function tshareOf(p){ return (typeof TSHARE!=="undefined" && TSHARE[normName(p.name)]) || 0; }
function snapTrendOf(p){ return (typeof SNAPTREND!=="undefined" && SNAPTREND[normName(p.name)]) || null; }
function weatherRisk(team){
  if(typeof STADIUM==="undefined") return false;
  return STADIUM.cold.includes(team) && !STADIUM.dome.includes(team);
}
function usageFor(p){ return (typeof USAGE!=="undefined" && USAGE[normName(p.name)]) || null; }
function spikeRate(p){
  const u = usageFor(p);
  return u && u[5] >= 6 ? u[4]/u[5] : 0;
}
function usageProfile(p){
  const u = usageFor(p); if(!u || p.pos==="QB" || p.pos==="DEF") return "";
  const L2 = lastFor(p);
  if(!L2 || !L2[0]) return "";
  const oppG = u[2]/Math.max(1,L2[0]);
  const tdShare = ((L2[5]||0)+(L2[9]||0))*6 / Math.max(1, L2[10]);
  if(oppG >= (p.pos==="RB"?18:8) && u[1] >= 70) return "volume hog";
  if(tdShare > 0.42) return "TD-dependent";
  if(u[1] >= 55 && oppG < (p.pos==="RB"?13:6.5)) return "efficient on thin usage";
  return "";
}
function hist3For(p){ return (typeof LAST3!=="undefined" && LAST3[normName(p.name)]) || []; }
function hometownOf(p){
  const m = metaFor(p); if(!m || !m[11]) return null;
  const mm = String(m[11]).match(/^(.*?)\s*\(([A-Z]{2})\)\s*$/);
  return mm ? {town:mm[1], st:mm[2]} : {town:String(m[11]), st:""};
}
function collegeInfo(p){
  const m = metaFor(p);
  if(!m || !m[2]) return null;
  const c = (typeof COLLEGE!=="undefined" && COLLEGE[m[2]]) || null;
  return {name:m[2], conf:c?c[0]:"", color:c?c[1]:""};
}
function isFav(p){
  const st = (S.settings.favState||"").toUpperCase().trim();
  const col = (S.settings.favCollege||"").toLowerCase().trim();
  const hw = hometownOf(p), ci = collegeInfo(p);
  const stHit = st && hw && hw.st===st;
  const colHit = col && ci && ci.name.toLowerCase().includes(col);
  return stHit || colHit ? {st:stHit, col:colHit} : null;
}
function consistencyOf(p){
  const h = hist3For(p).filter(x=>x[1]>=8);
  if(h.length<2) return null;
  const ppg = h.map(x=>x[2]/x[1]);
  const mean = ppg.reduce((a,b)=>a+b,0)/ppg.length;
  if(mean<=0) return null;
  const sd = Math.sqrt(ppg.reduce((a,b)=>a+(b-mean)*(b-mean),0)/ppg.length);
  const cv = sd/mean;
  return {mean, lo:Math.min(...ppg), hi:Math.max(...ppg),
          label: cv<0.12 ? "metronome" : cv<0.25 ? "steady" : "boom-bust"};
}
function breakoutTag(p){
  const m = metaFor(p);
  if(!m || !(p.pos==="WR"||p.pos==="TE"||p.pos==="RB")) return false;
  if(m[1]<1 || m[1]>2) return false;
  const h = hist3For(p);
  const u2 = usageFor(p);
  if(u2 && u2[1] >= 60 && m[1]<=2 && h.length){
    const lastH = h[h.length-1], prevH = h.length>1 ? h[h.length-2] : null;
    if(prevH && prevH[4]>0 && lastH[4]/prevH[4] >= 1.25) return true;
  }
  if(!h.length) return m[1]>=1;                       // year-2 with thin data still qualifies
  const last = h[h.length-1], prev = h.length>1 ? h[h.length-2] : null;
  const tgtGrowth = prev && prev[4]>0 ? last[4]/prev[4] : 2;
  return tgtGrowth >= 1.15 || (PROJ26[normName(p.name)] && PROJ26[normName(p.name)][6] > (last[4]||0)*1.15);
}
function tdRegressTag(p){
  const L = lastFor(p), PR = projFor(p);
  if(!L || !PR) return false;
  const lastTD = (L[5]||0)+(L[9]||0)+(p.pos==="QB"?(L[2]||0):0);
  const projTD = (PR[5]||0)+(PR[9]||0)+(p.pos==="QB"?(PR[2]||0):0);
  return lastTD >= 8 && projTD > 0 && lastTD > projTD*1.35;
}
function bustTag(p){
  return !!(p.adp && p.adp<=70 && (ageCliff(p) || tdRegressTag(p)));
}
function winnerIndex(p){
  const m = metaFor(p);
  let sc = 0;
  if(m && m[0] && m[0]<=25) sc++;
  if(breakoutTag(p)) sc++;
  if(p.intel && p.intel.t!=null) sc++;
  if(buzzOf(p)>1000) sc++;
  const c = consistencyOf(p);
  if(c && c.hi>=15) sc++;
  return sc;
}
function byeOf(team){ return (typeof BYES!=="undefined" && BYES[team]) || 0; }
function sosOf(team){
  // season SOS = avg offense-environment rank of opponents (higher avg rank = softer slate)
  const r = cached("sos", ()=>{
    const m = {};
    if(typeof SCHED==="undefined") return m;
    // opponents come as ESPN abbreviations — map back to our codes
    const espn2us = {}; for(const us in TEAMLOGO) espn2us[TEAMLOGO[us].toUpperCase()] = us;
    espn2us["WSH"] = "WAS";
    for(const team in SCHED){
      const opps = Object.values(SCHED[team]).map(ab=>espn2us[ab]).filter(Boolean);
      if(!opps.length) continue;
      const avg = opps.reduce((a,t2)=>a+(envRank(t2)||16), 0)/opps.length;
      m[team] = avg;
    }
    const order = Object.keys(m).sort((a,b)=>m[b]-m[a]);  // softest first
    const rank = {}; order.forEach((t2,i)=>rank[t2] = i+1);
    return rank;
  });
  return r[team] || 0;
}
function nextOpp(team){
  if(typeof SCHED==="undefined" || !SCHED[team]) return null;
  const wk = Math.max(1, Math.min(18, window._nflWeek || 1));
  for(let w=wk; w<=18; w++) if(SCHED[team][w]) return {w, opp:SCHED[team][w]};
  return null;
}
function envRank(team){
  const r = cached("env", ()=>{
    const totals = {};
    allPlayers().forEach(p=>{ if(p.pos!=="DEF") totals[p.team]=(totals[p.team]||0)+p.proj; });
    const order = Object.keys(totals).sort((a,b)=>totals[b]-totals[a]);
    const m = {}; order.forEach((t2,i)=>m[t2]=i+1);
    return m;
  });
  return r[team] || 0;
}
function playoffStars(team){
  const s = typeof PSOS!=="undefined" ? PSOS[team] : null;
  if(!s) return 0;
  return Math.max(1, Math.min(5, Math.round((s.r[0]+s.r[1]+s.r[2])/3/32*5)));
}
function primeNote(p){
  const m = metaFor(p);
  if(!m || !m[0] || !PRIME[p.pos]) return "";
  const [lo,hi] = PRIME[p.pos], a = m[0];
  return a<lo ? "pre-prime ("+p.pos+" prime "+lo+"–"+hi+")" : a<=hi ? "in his prime years" : "past the typical "+p.pos+" prime";
}
function storyOf(p){
  const m = metaFor(p), hw = hometownOf(p), ci = collegeInfo(p), h = hist3For(p);
  const bits = [];
  if(hw) bits.push((hw.town?hw.town+", ":"")+(hw.st||"")+" kid");
  if(ci) bits.push(ci.name+(ci.conf?" ("+ci.conf+")":"")+" product");
  if(m && m[12]) bits.push(m[1]===0 ? "arrives in the "+m[12]+" class" : "in the league since "+m[12]);
  let arc = "";
  if(h.length>=2){
    const pts = h.map(x=>Math.round(x[2]));
    const dir = pts[pts.length-1] > pts[0]*1.15 ? "climbing" : pts[pts.length-1] < pts[0]*0.85 ? "sliding" : "holding steady";
    arc = "Fantasy arc: "+pts.join(" → ")+" — "+dir+".";
  } else if(m && m[1]===0){
    arc = "No NFL tape yet — the projection is the bet.";
  }
  const pn = primeNote(p);
  const inj = injuryOf(p);
  let out = bits.length ? bits.join(", ")+". " : "";
  out += arc ? arc+" " : "";
  if(pn) out += pn.charAt(0).toUpperCase()+pn.slice(1)+". ";
  const er = typeof envRank==="function" ? envRank(p.team) : 0;
  if(er && er<=5) out += "Lands in a top-5 projected offense. ";
  else if(er && er>=28) out += "Buried in a bottom-5 projected offense. ";
  if(inj) out += "Currently "+injSeverity(inj.s).label.toLowerCase()+". ";
  const fav = isFav(p);
  if(fav) out += "And yes — one of yours"+(fav.st?" ("+(S.settings.favState||"").toUpperCase()+" roots)":"")+". 💖";
  return out.trim();
}
function metaFor(p){ return (typeof PLAYERMETA!=="undefined" && PLAYERMETA[normName(p.name)]) || null; }
function lastFor(p){ return (typeof LASTSZN!=="undefined" && LASTSZN[normName(p.name)]) || null; }
function projFor(p){ return (typeof PROJ26!=="undefined" && PROJ26[normName(p.name)]) || null; }
function ageCliff(p){
  const m = metaFor(p); if(!m || !m[0]) return 0;
  const lim = {RB:28, WR:30, TE:30, QB:37}[p.pos];
  return lim && m[0] >= lim ? m[0] : 0;
}
function badInjury(p){
  const e = injuryOf(p); if(!e) return "";
  const sv = injSeverity(e.s);
  return sv && (sv.code==="O"||sv.code==="IR") ? sv.label : "";
}
function headshotUrl(p){
  if(p.pos==="DEF") return logoUrl(p.team);
  const id = typeof HEADSHOT!=="undefined" ? HEADSHOT[normName(p.name)] : null;
  return id ? "https://sleepercdn.com/content/nfl/players/thumb/"+id+".jpg" : null;
}
function logoUrl(team){
  if(S.settings && S.settings.lowData) return null;
  const s = typeof TEAMLOGO!=="undefined" ? TEAMLOGO[team] : null;
  return s ? "https://a.espncdn.com/i/teamlogos/nfl/500/"+s+".png" : null;
}
window._noimg = window._noimg || new Set();
document.addEventListener("error", e=>{
  const img = e.target;
  if(!(img instanceof HTMLImageElement) || !img.classList.contains("avatar")) return;
  window._noimg.add(img.src);
  const ph = document.createElement("span");
  ph.className = "avatar ph";
  ph.style.width = img.getAttribute("width")+"px"; ph.style.height = img.getAttribute("height")+"px";
  ph.textContent = "•";
  img.replaceWith(ph);
}, true);
function avatarImg(p, size){
  if(S.settings && S.settings.lowData){
    const init = p.name.split(" ").map(w=>w[0]).slice(0,2).join("");
    return '<span class="avatar ph pos'+p.pos+'" style="width:'+size+'px;height:'+size+'px">'+esc(init)+'</span>';
  }
  const u = headshotUrl(p);
  const init2 = p.name.split(" ").map(w=>w[0]).slice(0,2).join("");
  if(u && window._noimg.has(u)) return '<span class="avatar ph pos'+p.pos+'" style="width:'+size+'px;height:'+size+'px">'+esc(init2)+'</span>';
  if(!u) return '<span class="avatar ph pos'+p.pos+'" style="width:'+size+'px;height:'+size+'px">'+esc(init2)+'</span>';
  return '<img class="avatar" src="'+u+'" width="'+size+'" height="'+size+'"'+(size>=56?' fetchpriority="high"':' loading="lazy"')+' decoding="async" alt="">';
}
function psosFor(team){
  const s = typeof PSOS!=="undefined" ? PSOS[team] : null;
  if(!s) return null;
  return {txt:"Playoff weeks: W15 "+s.o[0]+" · W16 "+s.o[1]+" · W17 "+s.o[2]+" (matchup ranks "+s.r.join("/")+")",
          short:"W15 "+s.o[0]+" · W16 "+s.o[1]+" · W17 "+s.o[2]};
}
function intelBadges(p){
  if(!p.intel) return "";
  let h="";
  if(p.intel.t!=null) h += '<span class="ib gold" title="Analyst target: '+esc(p.intel.t||"flagged as a value pick")+'">⭐</span>';
  if(p.intel.lean>0) h += '<span class="ib bull" title="'+esc(p.intel.p)+'">▲</span>';
  if(p.intel.lean<0) h += '<span class="ib bear" title="'+esc(p.intel.p)+'">▼</span>';
  return h;
}

function renderTabs(){
  const tabs = ["ALL","QB","RB","WR","TE","FLEX","DEF","MINE"];
  const players = allPlayers();
  const cnt = {};
  players.forEach(p=>{ if(!offBoard(p.id) && !S.dnd[p.id]) cnt[p.pos]=(cnt[p.pos]||0)+1; });
  cnt.ALL = Object.values(cnt).reduce((a,b)=>a+b,0);
  cnt.FLEX = (cnt.RB||0)+(cnt.WR||0)+(cnt.TE||0);
  cnt.MINE = myIds().length;
  $("#posTabs").innerHTML = tabs.map(t=>
    '<button class="ptab'+(S.ui.pos===t?" on":"")+'" data-pos="'+t+'">'+t+(cnt[t]!=null?'<sup>'+cnt[t]+'</sup>':'')+'</button>').join("");
}

function renderPool(){
  const {scored} = scoreBoard();
  const vorpMap = {};
  for(const s of scored) vorpMap[s.p.id]=s;
  const players = allPlayers();
  const repl = replacementLevels(players);
  const rinfo = roundInfo(players);
  const tm = tierMap(players);
  const rawQ = $("#search").value.trim().toLowerCase();
  const ops = {};
  const q = rawQ.replace(/\b(pos|team|bye|tier|rookie):(\S+)/g, (m2,k2,v2)=>{ ops[k2]=v2; return ""; }).trim();

  let rows = players.map(p=>({
    p, vorp: p.proj-(repl[p.pos]||0),
    taken: !!S.taken[p.id], mine: S.mine.includes(p.id),
    score: vorpMap[p.id] ? vorpMap[p.id].score : -Infinity,
    stack: vorpMap[p.id] ? vorpMap[p.id].stack : null,
    backRisk: vorpMap[p.id] ? vorpMap[p.id].backRisk : null,
    rd: rinfo[p.id]
  }));
  const vRank = {}; players.slice().sort((a,b)=>{
    const va=a.proj-(repl[a.pos]||0), vb=b.proj-(repl[b.pos]||0); return vb-va;
  }).forEach((p,i)=>vRank[p.id]=i+1);
  rows.forEach(r=>{ r.edge = r.p.adp ? r.p.adp - vRank[r.p.id] : null; });

  if(S.ui.pos==="MINE") rows = rows.filter(r=> r.mine || myKeeperIds().includes(r.p.id));
  else if(S.ui.pos==="FLEX") rows = rows.filter(r=>["RB","WR","TE"].includes(r.p.pos));
  else if(S.ui.pos!=="ALL") rows = rows.filter(r=>r.p.pos===S.ui.pos);
  if(q) rows = rows.filter(r=> matchesQuery(r.p, q));
  if(ops.pos) rows = rows.filter(r=> r.p.pos.toLowerCase()===ops.pos);
  if(ops.team) rows = rows.filter(r=> r.p.team.toLowerCase()===ops.team || (TEAMLOGO[r.p.team]||"").toLowerCase()===ops.team);
  if(ops.bye) rows = rows.filter(r=> String(byeOf(r.p.team))===ops.bye);
  if(ops.tier) rows = rows.filter(r=> String(tm[r.p.id])===ops.tier);
  if(ops.rookie) rows = rows.filter(r=> ((metaFor(r.p)||[])[1]===0) === (ops.rookie!=="no"));
  if(!S.ui.showTaken && S.ui.pos!=="MINE") rows = rows.filter(r=> !r.taken && !(S.keepers[r.p.id] && !r.mine));
  if(S.ui.round!=="ALL"){
    let lo, hi;
    if(S.ui.round==="NEXT"){
      const h = nextPickHorizon();
      const t = S.settings.teams;
      lo = h ? Math.ceil(h.mine0/t) : 1; hi = Math.min(lo+1, S.settings.roster);
    } else { [lo,hi] = S.ui.round.split("-").map(Number); }
    rows = rows.filter(r=> !r.rd.ud && r.rd.rd>=lo && r.rd.rd<=hi);
  }
  if(S.ui.targetsOnly) rows = rows.filter(r=> r.p.intel && r.p.intel.t!=null);
  if(S.ui.stacksOnly) rows = rows.filter(r=> r.stack);
  if(S.ui.survivors) rows = rows.filter(r=> r.backRisk!=="gone" && !r.taken && !r.mine);
  if(S.ui.fallers) rows = rows.filter(r=> !r.taken && !r.mine && r.p.adp && (pickNow()-r.p.adp)>=10);
  if(S.ui.hideHurt) rows = rows.filter(r=> !badInjury(r.p));
  const filtersOn = S.ui.pos!=="ALL" || S.ui.round!=="ALL" || S.ui.targetsOnly || S.ui.stacksOnly || S.ui.survivors || S.ui.fallers || S.ui.hideHurt || S.ui.showTaken || q;
  const cfb = document.getElementById("clearFiltersBtn");
  if(cfb) cfb.style.display = filtersOn ? "" : "none";

  const dir = S.ui.dir, key = S.ui.sort;
  rows.sort((a,b)=>{
    let av,bv;
    switch(key){
      case "name": av=a.p.name; bv=b.p.name; return dir*av.localeCompare(bv);
      case "team": av=a.p.team; bv=b.p.team; return dir*av.localeCompare(bv);
      case "pos": av=a.p.pos; bv=b.p.pos; return dir*av.localeCompare(bv) || b.vorp-a.vorp;
      case "proj": return dir*(a.p.proj-b.p.proj);
      case "adp": return dir*((a.p.adp||999)-(b.p.adp||999));
      case "rd": return dir*(a.rd.rd-b.rd.rd) || (a.p.adp||999)-(b.p.adp||999);
      case "edge": return dir*((a.edge==null?-999:a.edge)-(b.edge==null?-999:b.edge));
      case "tiergroup": return (tm[a.p.id]-tm[b.p.id]) || (b.vorp-a.vorp);
      case "rank": case "vorp": default: return dir*(a.vorp-b.vorp);
    }
  });

  document.querySelectorAll("thead th").forEach(th=>{
    const on = th.dataset.sort===key;
    th.classList.toggle("sorton", on);
    if(th.dataset.sort) th.setAttribute("aria-sort", on ? (dir===-1?"descending":"ascending") : "none");
  });

  const curRd = Math.min(Math.ceil(pickNow()/S.settings.teams), S.settings.roster);
  const CAP = 250;
  const truncated = !window._showAllRows && rows.length > CAP;
  const fullLen = rows.length;
  if(truncated) rows = rows.slice(0, CAP);
  const hl = nm => {
    if(!q || q.length<2) return nm;
    const i = nm.toLowerCase().indexOf(q);
    return i<0 ? nm : nm.slice(0,i)+"<mark>"+nm.slice(i,i+q.length)+"</mark>"+nm.slice(i+q.length);
  };

  const showTierDividers = (["QB","RB","WR","TE","DEF"].includes(S.ui.pos) && (key==="vorp"||key==="rank"||key==="proj") && dir===-1) || key==="tiergroup";
  let prevTier = null;
  const tw = document.querySelector(".tablewrap");
  const scrollSave = tw ? tw.scrollTop : 0;
  window._rowCache = window._rowCache || {key:null, m:{}};
  const rcKey = stateKey()+"|"+key+dir+q+(S.ui.pos||"");
  if(window._rowCache.key !== rcKey){ window._rowCache = {key:rcKey, m:{}}; }
  const rowCache = window._rowCache.m;
  $("#poolBody").innerHTML = rows.map((r,i)=>{
    const ck = r.p.id+"|"+i;
    if(rowCache[ck]) return rowCache[ck];
    const cls = r.mine ? "mine-row" : (r.taken ? "taken" : (S.dnd[r.p.id] ? "dndrow" : ""));
    const act = r.mine
      ? '<button class="undo1" data-drop="'+r.p.id+'">↩ un-pick</button>'
      : r.taken
        ? '<button class="undo1" data-untake="'+r.p.id+'">↩ restore</button>'
        : '<button class="pick" data-pick="'+r.p.id+'">✓ MINE</button><button class="kill" data-take="'+r.p.id+'">✕ taken</button>'+
          '<button class="undo1" data-dnd="'+r.p.id+'" title="'+(S.dnd[r.p.id]?"Allow drafting again":"Do not draft — hide from recommendations")+'" aria-label="Toggle do-not-draft">'+(S.dnd[r.p.id]?"↩":"🚫")+'</button>';
    let div = "";
    if(showTierDividers && tm[r.p.id]!==prevTier){
      div = '<tr class="tdiv"><td colspan="10">Tier '+tm[r.p.id]+'</td></tr>';
      prevTier = tm[r.p.id];
    }
    const rowHtml = '<tr class="'+cls+'" data-pid="'+r.p.id+'" title="M mine · T taken · Q queue · D never · N note · C compare">'+
      '<td class="mono" style="color:var(--faint)">'+(i+1)+'</td>'+
      '<td><span class="pcell" data-card="'+r.p.id+'" title="Open player card">'+avatarImg(r.p,24)+'<span class="pname">'+hl(r.p.name)+'</span></span>'+(S.notes[r.p.id]?'<span class="ib gold" title="'+esc(S.notes[r.p.id])+'">📝</span>':'')+(S.dnd[r.p.id]&&!r.taken&&!r.mine?'<span class="ib bear" title="On your do-not-draft list">🚫</span>':'')+((()=>{const e=injuryOf(r.p); if(!e) return ""; const sv=injSeverity(e.s); return '<span class="ib '+sv.cls+'" title="'+esc(sv.label+(e.c?" — "+e.c:"")+(e.d?" ("+e.d+" · "+e.src+")":""))+'">●</span>';})())+(buzzOf(r.p)>3000?'<span class="ib bull" title="'+buzzOf(r.p).toLocaleString()+' Sleeper adds in 24h">📈</span>':'')+((metaFor(r.p)||[])[1]===0?'<span class="ib" title="Rookie">🎓</span>':'')+(isFav(r.p)?'<span class="ib" style="color:#ff7bac" title="Your favorite state/college">💖</span>':'')+((S.boost||{})[r.p.id]===1?'<span class="ib bull" title="On your boost list">▲</span>':(S.boost||{})[r.p.id]===-1?'<span class="ib bear" title="On your fade list">▼</span>':'')+((()=>{const n=newsFor(r.p); return n && (Date.now()-new Date(n.d).getTime())<3*86400e3 ? '<span class="ib" title="'+esc(n.h)+'">📰</span>' : "";})())+intelBadges(r.p)+(r.stack?'<span class="stackchip">🔗 stack</span>':'')+(!r.taken&&!r.mine&&r.p.adp&&(pickNow()-r.p.adp)>=10?'<span class="ib" title="Falling: '+(pickNow()-r.p.adp)+' picks past ADP '+r.p.adp+'">💎</span>':'')+(r.backRisk==="gone"?'<span class="ib" title="Won\'t make it back to your next pick">🔥</span>':r.backRisk==="risky"?'<span class="ib" title="Coin-flip to survive to your next pick">⏳</span>':'')+'</td>'+
      '<td>'+posBadge(r.p.pos)+'<span class="tier t'+Math.min(tm[r.p.id],5)+'">T'+tm[r.p.id]+'</span></td>'+
      '<td class="mono" style="color:var(--dim)'+(psosFor(r.p.team)?';cursor:help':'')+'"'+(psosFor(r.p.team)?' title="'+esc(psosFor(r.p.team).txt+(byeOf(r.p.team)?" · bye W"+byeOf(r.p.team):""))+'"':'')+'>'+(logoUrl(r.p.team)?'<img class="tlogo" src="'+logoUrl(r.p.team)+'" width="14" height="14" loading="lazy" decoding="async" alt=""> ':'')+r.p.team+'</td>'+
      '<td><span class="proj mono" data-edit="'+r.p.id+'">'+r.p.proj+'</span></td>'+
      '<td class="mono" style="color:'+(r.vorp>=0?'var(--green)':'var(--faint)')+(r.vorp>0?';background:rgba(47,212,122,'+Math.min(0.22, r.vorp/700).toFixed(3)+')':'')+'">'+(r.vorp>0?"+":"")+Math.round(r.vorp)+'</td>'+
      '<td class="mono" style="color:var(--dim)">'+(r.p.adp||"—")+'</td>'+
      '<td class="mono" style="font-size:12px;color:'+(r.edge>0?'var(--green)':r.edge<0?'var(--red)':'var(--faint)')+'" title="ADP minus value rank: positive = market prices him later than his value">'+(r.edge==null?"—":(r.edge>0?"+":"")+r.edge)+'</td>'+
      '<td><span class="rd'+(curRd && !r.rd.ud && r.rd.rd<=curRd?" now":"")+'" title="'+(r.rd.est?"Estimated from projection rank (no market ADP)":"Expected round window from ADP")+'">'+r.rd.label+(S.settings.showBye && byeOf(r.p.team) ? ' <span class="dimtxt">B'+byeOf(r.p.team)+'</span>' : '')+'</span></td>'+
      '<td><div class="act">'+act+'</div></td></tr>';
    return rowCache[ck] = div + rowHtml;
  }).join("") + (truncated ? '<tr><td colspan="10" style="text-align:center;padding:12px"><button class="undo1" data-showall="1">▾ show all '+fullLen+' players</button></td></tr>' : "") || '<tr><td colspan="10" class="empty">No players match the current filters.<br><br><button class="undo1" data-clearfilters="1">✕ Clear all filters</button></td></tr>';
  if(tw) tw.scrollTop = scrollSave;
  $("#poolCount").textContent = (truncated ? rows.length+" of "+fullLen : rows.length) + " players";
  const pc = document.getElementById("presetChips");
  if(pc){
    const names = Object.keys(S.filterPresets||{});
    pc.innerHTML = names.map(n2=>'<span class="scpill" style="cursor:pointer" data-preset="'+esc(n2)+'">'+esc(n2)+'</span>').join("")+
      '<span class="scpill" style="cursor:pointer" data-presetsave="1" title="Save current filters as a preset">💾</span>'+
      (key==="tiergroup"?'':'<span class="scpill" style="cursor:pointer" data-tiersort="1" title="Group the whole board by tier">🏔</span>');
  }
  $("#poolCount").setAttribute("aria-live","polite");
  window._poolIds = rows.filter(r=>!r.taken && !r.mine).length ? rows.map(r=>r.p.id) : [];
  applyKbSel();
}

/* Command palette (Ctrl+K) */
const PALETTE_ACTIONS = [
  ["🩺 Injury Center", ()=>document.getElementById("injBtn").click()],
  ["🎲 Mock drafts", ()=>document.getElementById("mocksBtn").click()],
  ["🗂 Draft board", ()=>document.getElementById("boardBtn").click()],
  ["🎓 Draft report", ()=>document.getElementById("gradeBtn").click()],
  ["⚖ Compare players", ()=>document.getElementById("cmpBtn").click()],
  ["📋 Paste picks", ()=>document.getElementById("pasteBtn").click()],
  ["⚙ Settings", ()=>document.getElementById("settingsBtn").click()],
  ["🔴 Toggle Live mode", ()=>document.getElementById("liveBtn").click()],
  ["🖨 Cheat sheet", ()=>document.getElementById("sheetBtn").click()],
  ["🔗 Copy share link", ()=>document.getElementById("shareBtn").click()],
  ["? Help & shortcuts", ()=>document.getElementById("helpBtn").click()],
];
function openPalette(){
  let w = document.getElementById("palWrap");
  if(w){ w.remove(); return; }
  w = document.createElement("div");
  w.id = "palWrap";
  w.innerHTML = '<div id="pal"><input id="palIn" placeholder="Type a player or command…" aria-label="Command palette"><div id="palList"></div></div>';
  document.body.appendChild(w);
  w.addEventListener("click", e=>{ if(e.target===w) w.remove(); });
  const inp = document.getElementById("palIn"), list = document.getElementById("palList");
  let sel = 0, items = [];
  const draw = ()=>{
    const q2 = inp.value.trim();
    const acts = PALETTE_ACTIONS.filter(a=>!q2 || a[0].toLowerCase().includes(q2.toLowerCase())).slice(0,4)
      .map(a=>({label:a[0], run:a[1], kind:"act"}));
    const recent = !q2 && window._recent ? window._recent.map(id=>idIndex()[id]).filter(Boolean).slice(0,5)
      .map(p=>({label:"🕘 "+p.name+" · "+p.pos+" "+p.team, p, kind:"player"})) : [];
    const ps = q2.length>=2 ? allPlayers().filter(p=>matchesQuery(p,q2)).slice(0,7)
      .map(p=>({label:p.name+" · "+p.pos+" "+p.team+(offBoard(p.id)?" · off board":""), p, kind:"player"})) : [];
    items = acts.concat(recent, ps);
    sel = Math.min(sel, Math.max(0, items.length-1));
    list.innerHTML = items.map((it,i)=>'<div class="palrow'+(i===sel?" on":"")+'" data-pi="'+i+'">'+
      (it.kind==="player" ? avatarImg(it.p,20)+" " : "")+esc(it.label)+
      (it.kind==="player" ? '<span class="palbtns"><button data-pick="'+it.p.id+'">✓</button><button data-take="'+it.p.id+'">✕</button></span>' : "")+
      '</div>').join("") || '<div class="palrow dimtxt">No matches</div>';
  };
  const runSel = ()=>{
    const it = items[sel]; if(!it) return;
    w.remove();
    if(it.kind==="act") it.run(); else openCard(it.p.id);
  };
  inp.addEventListener("input", ()=>{ sel=0; draw(); });
  inp.addEventListener("keydown", e=>{
    if(e.key==="ArrowDown"){ e.preventDefault(); sel=Math.min(sel+1, items.length-1); draw(); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); sel=Math.max(sel-1,0); draw(); }
    else if(e.key==="Enter"){ e.preventDefault(); runSel(); }
    else if(e.key==="Escape"){ w.remove(); }
  });
  list.addEventListener("click", e=>{
    const b = e.target.closest("[data-pick],[data-take]");
    if(b){ w.remove(); return; }   // delegated global handler does the action
    const r = e.target.closest("[data-pi]");
    if(r){ sel = +r.dataset.pi; runSel(); }
  });
  draw();
  inp.focus();
}

/* Hover mini-card preview (#225) */
let _hovT = null;
document.addEventListener("mouseover", e=>{
  const cell = e.target.closest && e.target.closest(".pcell[data-card]");
  const hc = document.getElementById("hoverCard");
  if(!cell){ if(hc && !e.target.closest("#hoverCard")) hc.remove(); clearTimeout(_hovT); return; }
  clearTimeout(_hovT);
  _hovT = setTimeout(()=>{
    const p = idIndex()[cell.dataset.card]; if(!p) return;
    let el = document.getElementById("hoverCard");
    if(!el){ el = document.createElement("div"); el.id = "hoverCard"; document.body.appendChild(el); }
    const h3 = hist3For(p), hw = hometownOf(p), ci = collegeInfo(p);
    el.innerHTML = '<div style="display:flex;gap:10px;align-items:center">'+avatarImg(p,44)+
      '<div><b>'+esc(p.name)+'</b> '+(isFav(p)?"💖":"")+'<br><span class="dimtxt">'+p.pos+' '+p.team+
      (ci?' · '+esc(ci.name):'')+(hw&&hw.st?' · '+hw.st:'')+'</span></div></div>'+
      (h3.length?'<div class="dimtxt" style="margin-top:6px">'+h3.map(x=>x[0]+": <b>"+Math.round(x[2])+"</b>"+(x[3]?" ("+p.pos+x[3]+")":"")).join(" · ")+'</div>':'')+
      '<div class="dimtxt" style="margin-top:4px">proj <b style="color:var(--green)">'+p.proj+'</b> · ADP '+(p.adp||"—")+
      ((()=>{const u5=usageFor(p); return u5&&u5[5]>=6?' · '+u5[4]+'/'+u5[5]+' spike wks':'';})())+
      ((()=>{ const pin = window._pinned && idIndex()[window._pinned];
        if(!pin || pin.id===p.id) return "";
        const d5 = Math.round(p.proj - pin.proj);
        return '<div style="margin-top:4px;border-top:1px dashed var(--line);padding-top:4px">vs 📌 '+esc(pin.name.split(" ").slice(-1)[0])+': <b style="color:'+(d5>=0?'var(--green)':'var(--red)')+'">'+(d5>0?'+':'')+d5+' proj</b></div>'; })())+'</div>';
    const r2 = cell.getBoundingClientRect();
    el.style.left = Math.min(r2.left, innerWidth-300)+"px";
    el.style.top = (r2.bottom+6)+"px";
  }, 350);
});

let _dragIdx = null;
document.addEventListener("dragstart", e=>{
  const r2 = e.target.closest && e.target.closest(".qrow");
  if(r2){ _dragIdx = +r2.dataset.qidx; e.dataTransfer.effectAllowed = "move"; }
});
document.addEventListener("dragover", e=>{
  if(_dragIdx!=null && e.target.closest && e.target.closest(".qrow")) e.preventDefault();
});
document.addEventListener("drop", e=>{
  const r2 = e.target.closest && e.target.closest(".qrow");
  if(_dragIdx==null || !r2) return;
  e.preventDefault();
  const to = +r2.dataset.qidx;
  if(to!==_dragIdx){
    const [moved] = S.queue.splice(_dragIdx, 1);
    S.queue.splice(to, 0, moved);
    commit();
  }
  _dragIdx = null;
});

/* Right-click context menu on pool rows */
document.addEventListener("contextmenu", e=>{
  const tr = e.target.closest("#poolBody tr[data-pid]");
  const old = document.getElementById("ctxMenu");
  if(old) old.remove();
  if(!tr) return;
  e.preventDefault();
  const id = tr.dataset.pid;
  const m = document.createElement("div");
  m.id = "ctxMenu";
  m.innerHTML = ['<button data-pick="'+id+'">✓ Mine</button>',
    '<button data-take="'+id+'">✕ Taken</button>',
    '<button data-queue="'+id+'">'+(S.queue.includes(id)?"★ Unqueue":"☆ Queue")+'</button>',
    '<button data-dnd="'+id+'">🚫 Never</button>',
    '<button data-note="'+id+'">📝 Note</button>',
    '<button data-card="'+id+'">👤 Card</button>'].join("");
  m.style.left = Math.min(e.clientX, innerWidth-160)+"px";
  m.style.top = Math.min(e.clientY, innerHeight-220)+"px";
  document.body.appendChild(m);
});
document.addEventListener("click", ()=>{ const m=document.getElementById("ctxMenu"); if(m) m.remove(); }, true);

// #364: extend the render window as you approach the bottom
document.addEventListener("DOMContentLoaded", ()=>{
  const tw = document.querySelector(".tablewrap");
  if(tw) tw.addEventListener("scroll", ()=>{
    if(window._showAllRows) return;
    if(tw.scrollTop + tw.clientHeight > tw.scrollHeight - 300){
      window._showAllRows = true;
      renderPool();
    }
  }, {passive:true});
});

/* Keyboard drafting: arrows move the highlight, M = my pick, T/X = taken */
let kbSel = -1;
function applyKbSel(){
  const trs = document.querySelectorAll("#poolBody tr[data-pid]");
  trs.forEach((tr,i)=>{ tr.classList.toggle("kbsel", i===kbSel); if(i===kbSel) tr.setAttribute("aria-selected","true"); else tr.removeAttribute("aria-selected"); });
  if(kbSel>=0 && trs[kbSel]) trs[kbSel].scrollIntoView({block:"nearest"});
}

function renderBest(){
  const {scored} = scoreBoard();
  const rinfo = roundInfo(allPlayers());
  const odds = survivalOdds();
  const hz = nextPickHorizon();
  const top = scored[0];
  const hero = $("#hero");
  const doneN = myIds().length;
  if(doneN >= S.settings.roster && doneN > 0){
    const byIdH = idIndex();
    const bsH = bestStarters(myIds(), byIdH);
    const hurtN = myIds().map(id=>byIdH[id]).filter(Boolean).filter(p2=>injuryOf(p2)).length;
    const st = quickStandings();
    const myRank = st.rows.findIndex(r=>r.s===st.mySlot)+1;
    const kick = new Date((S.settings.seasonStart||"2026-09-10")+"T20:20");
    const kd = Math.ceil((kick.getTime()-Date.now())/86400000);
    hero.innerHTML = '<div class="toppick">'+
      '<div class="tag">🏟 SEASON HQ'+(kd>0?' · 🏈 kickoff in '+kd+'d':'')+'</div>'+
      '<div class="name">'+esc(S.settings.flair||slotName(S.settings.slot))+'</div>'+
      '<div class="meta">Draft complete · optimal starters <b class="mono" style="color:var(--green)">'+fmt(bsH.pts)+'</b> · projected <b>'+ordinal(myRank)+'</b> of '+st.rows.length+
      (hurtN?' · 🩹 '+hurtN+' with injury flags':' · roster healthy ✓')+
      ((()=>{ // title odds: softmax over projected starters, with draft-long history (#564)
        const temps = st.rows.map(r2=>Math.exp(r2.pts/120));
        const z = temps.reduce((a,b)=>a+b,0);
        const mine2 = temps[st.rows.findIndex(r2=>r2.s===st.mySlot)]/z;
        let spark = "";
        try{
          const hk = LS_KEY+"-oddshist";
          const hist = JSON.parse(localStorage.getItem(hk)||"[]");
          if(!hist.length || hist[hist.length-1].n !== S.log.length){
            hist.push({n:S.log.length, o:Math.round(mine2*1000)/10});
            localStorage.setItem(hk, JSON.stringify(hist.slice(-60)));
          }
          if(hist.length>=3){
            const os = hist.map(x2=>x2.o), mx = Math.max(...os, 1), mn = Math.min(...os);
            const pts2 = os.map((o2,i2)=>Math.round(i2*(64/(os.length-1)))+","+Math.round(13-11*((o2-mn)/Math.max(0.1,mx-mn)))).join(" ");
            spark = ' <svg width="66" height="15" viewBox="0 0 66 15" style="vertical-align:-2px" aria-label="title odds trend"><polyline points="'+pts2+'" fill="none" stroke="var(--gold)" stroke-width="1.5"/></svg>';
          }
        }catch(e){}
        return ' · 🏆 title odds ~<b>'+Math.round(mine2*100)+'%</b>'+spark;
      })())+'</div>'+
      '<div class="actions">'+
        '<button class="hbtn" onclick="document.getElementById(\'gradeBtn\').click()">🎓 Report</button>'+
        '<button class="hbtn" onclick="document.getElementById(\'injBtn\').click()">🩺 Injuries</button>'+
        '<button class="hbtn" onclick="document.getElementById(\'recapBtn\').click()">📤 Share</button>'+
        '<button class="hbtn" id="weekRecapBtn">📅 Week recap</button>'+
        '<button class="hbtn" id="healthDigestBtn">🩹 Health digest</button>'+
      '</div></div>';
    // waiver radar: hot adds that nobody in this league rosters
    const rostered = new Set();
    Object.values(teamRosters()).forEach(ids=>ids.forEach(id2=>rostered.add(id2)));
    myIds().forEach(id2=>rostered.add(id2));
    const radar = allPlayers()
      .filter(p2=>!rostered.has(p2.id) && buzzOf(p2)>500)
      .sort((a,b)=>buzzOf(b)-buzzOf(a)).slice(0,5);
    // my-player headlines
    const myNews = myIds().map(id2=>byIdH[id2]).filter(Boolean)
      .map(p2=>({p:p2, n:newsFor(p2)})).filter(x=>x.n).slice(0,4);
    // drop candidates + IR stashes
    const bench2 = myIds().filter(id2=>!bsH.starterIds.has(id2)).map(id2=>byIdH[id2]).filter(Boolean);
    const drops = bench2.slice().sort((a,b)=>a.proj-b.proj).slice(0,2);
    const irs = myIds().map(id2=>byIdH[id2]).filter(Boolean)
      .filter(p2=>{ const e2=injuryOf(p2); return e2 && injSeverity(e2.s).code==="IR"; });
    let hq = "";
    {
      const nx = bsH.line.filter(sl=>sl.p).map(sl=>({p:sl.p, n:nextOpp(sl.p.team)})).filter(x=>x.n).slice(0,9);
      if(nx.length) hq += '<div class="benchhead">🗓 Next up</div><div class="scarce">'+
        nx.map(x=>'<span class="scpill" title="'+esc(x.p.name)+'">'+esc(x.p.name.split(" ").slice(-1)[0])+' W'+x.n.w+' vs '+esc(x.n.opp)+'</span>').join("")+'</div>';
    }
    const hqCfg = S.settings.hqWidgets || {};
    if(hqCfg.radar!==false && radar.length) hq += '<div class="benchhead">📡 Waiver radar (unrostered, trending)</div>'+
      radar.map(p2=>'<div class="barow" data-card="'+p2.id+'">'+avatarImg(p2,22)+posBadge(p2.pos)+
        '<div class="info"><div class="nm">'+p2.name+'</div><div class="sm">📈 '+buzzOf(p2).toLocaleString()+' adds/24h · FAAB ~'+
        Math.min(40, Math.max(1, Math.round((p2.proj-(replacementLevels(allPlayers())[p2.pos]||0))/4)))+'%</div></div></div>').join("");
    if(hqCfg.news && myNews.length) hq += '<div class="benchhead">📰 Your players in the news</div>'+
      myNews.map(x=>'<div class="barow" data-card="'+x.p.id+'">'+avatarImg(x.p,22)+
        '<div class="info"><div class="nm" style="font-size:11.5px">'+esc(x.n.h.slice(0,70))+'</div><div class="sm">'+esc(x.p.name)+' · '+x.n.d+'</div></div></div>').join("");
    if(hqCfg.ir && irs.length) hq += '<div class="benchhead">🏥 IR-eligible (league has 3 IR slots)</div>'+
      irs.map(p2=>'<div class="barow" data-card="'+p2.id+'">'+avatarImg(p2,22)+'<div class="info"><div class="nm">'+p2.name+'</div><div class="sm">stash him, open a bench spot</div></div></div>').join("");
    if(hqCfg.drops && drops.length) hq += '<div class="benchhead">🪓 Thinnest bench spots</div>'+
      drops.map(p2=>'<div class="barow" data-card="'+p2.id+'">'+avatarImg(p2,22)+'<div class="info"><div class="nm">'+p2.name+'</div><div class="sm mono">'+p2.proj+' proj</div></div></div>').join("");
    hq += '<div class="benchhead">League rosters</div><div class="scarce">'+
      Array.from({length:S.settings.teams},(_,i2)=>i2+1).map(s2=>'<span class="scpill" data-teampage="'+s2+'" style="cursor:pointer">'+esc(slotName(s2))+'</span>').join("")+'</div>';
    $("#baList").innerHTML = hq;
    document.title = "Draft War Room — 2QB";
    updatePanic(null, null);
    return;
  }
  if(!top){ hero.innerHTML = '<div class="empty">Board is empty — nice draft!</div>'; $("#baList").innerHTML=""; return; }
  const p = top.p;
  const why = top.why.length ? "▸ " + top.why.join("<br>▸ ") : "▸ best raw value on the board";
  const h = nextPickHorizon();
  let pickline = "";
  if(h){
    pickline = '<div class="pickline'+(h.onClock?' onclock':'')+'" data-picksync="1" title="Click to correct the current overall pick if the board drifted" style="cursor:pointer">Pick <b class="mono">#'+h.cur+'</b> on the clock'+
      (h.onClock ? ' — <b style="color:var(--green)">THAT\'S YOU, DRAFT NOW</b>' : '') +
      ' · your next: <b class="mono">#'+h.mine0+'</b>'+(h.mine1?' then <b class="mono">#'+h.mine1+'</b>':'')+
      (!h.onClock?' · <button class="undo1" data-simto="1" title="Let the engine make every CPU pick until your turn">⏩ sim to my pick</button>':'')+
      (S.ui.live?' · <button class="undo1" data-horn="1" title="Airhorn">📢</button><button class="undo1" data-siren="1" title="Steal siren">🚨</button>':'')+'</div>';
  }
  if(h && h.onClock && S.plan){
    const rNow2 = Math.ceil(h.cur/S.settings.teams);
    const planned = idIndex()[S.plan[rNow2]];
    if(planned && !offBoard(planned.id)){
      pickline += '<div class="pickline onclock" style="margin-top:-4px">📌 Your R'+rNow2+' plan is on the board: <b>'+esc(planned.name)+'</b> <button class="pick" data-pick="'+planned.id+'" style="margin-left:6px">✓ TAKE HIM</button></div>';
    }
  }
  const pred = predictNextPicks();
  if(pred){
    pickline += '<div class="pickline" style="margin-top:-4px;font-size:10.5px">🔮 '+slotEmoji(pred.slot)+' '+esc(slotName(pred.slot))+' likely takes: '+
      pred.cand.map(x=>'<b>'+esc(x.p.name.split(" ").slice(-1)[0])+'</b> ('+x.p.pos+')').join(" or ")+'</div>';
  }
  { // MVP belt (#569): biggest positive ADP delta so far holds the belt during live drafts
    const chipEl = document.getElementById("mvpChip");
    if(chipEl){
      let belt=null, bd=9;
      const byIdM = idIndex();
      S.log.forEach((e2,i2)=>{ const p2=byIdM[e2.id]; const d2=p2&&p2.adp ? (i2+1+(S.pickOffset||0))-p2.adp : 0; if(d2>bd){ bd=d2; belt={p:p2, who:e2.who, d:d2}; } });
      if(S.ui.live && belt){
        chipEl.hidden = false;
        chipEl.innerHTML = '🏆 '+esc(belt.p.name.split(" ").slice(-1)[0])+' +'+Math.round(belt.d);
        if(window._mvpId && window._mvpId!==belt.p.id) toast("🏆 MVP belt changes hands: <b>"+esc(belt.p.name)+"</b> at +"+Math.round(belt.d)+" past ADP");
        window._mvpId = belt.p.id;
      } else chipEl.hidden = true;
    }
  }
  document.title = (h && h.onClock ? "🟢 YOUR PICK — " : "") + "Draft War Room — 2QB";
  if(h && h.onClock && !window._wasOnClock && S.ui.live) chime();
  window._wasOnClock = !!(h && h.onClock);
  if(navigator.setAppBadge){
    try{
      if(S.ui.live && h && !h.onClock) navigator.setAppBadge(Math.max(1, h.mine0-h.cur));
      else if(navigator.clearAppBadge) navigator.clearAppBadge();
    }catch(e){}
  }
  updatePanic(h, top);
  if(S.ui.live && h && h.onClock && S.settings.timerSecs){
    if(!window._clockT0) window._clockT0 = Date.now();
    const left2 = Math.max(0, S.settings.timerSecs - (Date.now()-window._clockT0)/1000);
    pickline += '<div class="pickline'+(left2<=30?' onclock':'')+'" style="margin-top:-4px">⏲ <b class="mono" style="font-size:14px;color:'+(left2<=30?'var(--red)':'var(--text)')+'">'+Math.floor(left2/60)+':'+String(Math.floor(left2%60)).padStart(2,"0")+'</b> on your clock</div>';
    if(left2<=30 && !window._clockWarned){ window._clockWarned = true; chime(); toast("⏲ 30 seconds!", {warn:true}); }
  }
  if(h && !h.onClock){ window._clockT0 = 0; window._clockWarned = false; }
  if(S.ui.live && h && S.ui.liveStart){
    const el = (Date.now()-S.ui.liveStart-(S.ui.hiddenMs||0))/1000;
    const made = Math.max(0, S.log.length-(S.ui.liveLen0||0));
    const pace = made>2 ? el/made : 0;
    const left = S.settings.teams*S.settings.roster - h.cur + 1;
    const eta = pace ? new Date(Date.now()+left*pace*1000).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : "—";
    pickline += '<div class="pickline" style="margin-top:-4px">⏱ <b class="mono">'+Math.floor(el/60)+'m</b> · '+made+' picks · '+(pace?Math.round(pace)+'s/pick · draft ends ~<b class="mono">'+eta+'</b>':'measuring pace…')+'</div>';
  }
  // Startable players (VORP > 0) left per position
  const scLeft = {}; POSITIONS.forEach(pos=>scLeft[pos]=0);
  scored.forEach(s=>{ if(s.vorp>0) scLeft[s.p.pos]++; });
  const scarce = '<div class="scarce"><span class="striptag">LEFT</span>'+POSITIONS.map(pos=>{
    const g = odds && odds.posGone ? odds.posGone[pos] : 0;
    const runRisk = g>=2.5 && scLeft[pos]<=6;
    return '<span class="scpill'+(scLeft[pos]<=3?' dry':'')+'" title="Available '+pos+'s above replacement'+(g?'; sims expect ~'+g+' more gone before your pick #'+odds.at1:'')+(runRisk?'; RUN RISK':'')+'">'+
      pos+' <b>'+scLeft[pos]+'</b>'+(g>=1?' <span style="color:var(--red)">−'+Math.round(g)+'</span>':'')+(runRisk?' <b style="color:var(--red)">🔥</b>':'')+'</span>';
  }).join("")+'</div>';
  // If you take him: engine's projected plan for your next picks
  const plan = cached("plan", ()=>{
    S.mine.push(p.id); S.log.push({id:p.id, who:"me"});
    const saveMemo = _memo; _memo = {key:null};
    let m;
    try{ m = runMock(STRATS[0], 424243); } finally {
      S.log.pop(); S.mine.pop(); _memo = saveMemo;
    }
    return m.picks.slice(0,3).map(pk=>pk.round+"."+String(pk.idx).padStart(2,"0")+" "+pk.p.name+" ("+pk.p.pos+")");
  });
  const heroGain = S.mine.length ? Math.max(0, Math.round(bestStarters(S.mine.concat([p.id]), idIndex()).pts - bestStarters(S.mine, idIndex()).pts)) : 0;
  // VONA: cost of waiting at the top pick's position
  let vona = "";
  if(odds && odds.h1){
    const alt = scored.find(s=>s!==top && s.p.pos===p.pos && odds.h1[s.p.id]!=null && odds.h1[s.p.id]>=60);
    if(alt){
      const cost = Math.round(top.vorp - alt.vorp);
      if(cost>0) vona = '<div class="planline">⏭ waiting at '+p.pos+' costs ~<b style="color:'+(cost>40?'var(--red)':'var(--gold)')+'">'+cost+' pts</b> — likely still there: '+esc(alt.p.name)+' ('+odds.h1[alt.p.id]+'%)</div>';
    }
  }
  const freshTop = window._lastTopId !== p.id;
  window._lastTopId = p.id;
  // Elite shelf: T1/T2 supply per position
  const tmB = tierMap(allPlayers());
  const shelf = {};
  scored.forEach(s=>{ const tr2=tmB[s.p.id]; if(tr2<=2) shelf[s.p.pos]=(shelf[s.p.pos]||0)+1; });
  const shelfLine = '<div class="scarce" title="Players left in Tier 1–2 at each position"><span class="striptag">🏔 SHELF</span>'+
    POSITIONS.map(pos=>'<span class="scpill'+((shelf[pos]||0)===0?' dry':'')+'">'+pos+' <b>'+(shelf[pos]||0)+'</b></span>').join("")+'</div>';
  // Momentum: last five picks
  let momentum = "";
  const last5 = S.log.slice(-5);
  if(last5.length===5){
    const byIdM = idIndex(), mc = {};
    last5.forEach(e2=>{ const pp=byIdM[e2.id]; if(pp) mc[pp.pos]=(mc[pp.pos]||0)+1; });
    const hot = Object.entries(mc).sort((a,b)=>b[1]-a[1])[0];
    momentum = '<div class="scarce"><span class="striptag">〰 LAST 5</span><span class="scpill" style="border:none;background:none">'+
      Object.entries(mc).map(([k,v])=>k+"×"+v).join(" · ")+(hot[1]>=3?' — <b style="color:var(--gold)">'+hot[0]+' heating</b>':'')+'</span></div>';
  }
  // Threats: what teams picking before my next turn still need
  let threats = "";
  if(h && h.next > h.cur){
    const ros = teamRosters(), byIdT = idIndex(), t2 = S.settings.teams;
    const myPicksSet = new Set(myOverallPicks());
    const needBy = {QB:new Set(), RB:new Set(), WR:new Set(), TE:new Set(), DEF:new Set()};
    for(let pk=h.cur; pk<h.next; pk++){
      if(myPicksSet.has(pk)) continue;
      const r2 = Math.ceil(pk/t2), idx2 = pk-(r2-1)*t2, slot2 = (r2%2===1)?idx2:t2+1-idx2;
      const c = {QB:0,RB:0,WR:0,TE:0,DEF:0};
      (ros[slot2]||[]).forEach(id2=>{ const pp=byIdT[id2]; if(pp) c[pp.pos]++; });
      if(c.QB<2) needBy.QB.add(slot2); if(c.RB<2) needBy.RB.add(slot2);
      if(c.WR<2) needBy.WR.add(slot2); if(c.TE<1) needBy.TE.add(slot2); if(c.DEF<1) needBy.DEF.add(slot2);
    }
    const parts = POSITIONS.map(pos=>{
      const n = needBy[pos].size;
      return n ? '<span class="scpill" title="'+esc([...needBy[pos]].map(slotName).join(", "))+'" style="cursor:help">'+pos+'-needy <b'+(n>=3?' style="color:var(--red)"':'')+'>'+n+'</b></span>' : "";
    }).filter(Boolean);
    if(parts.length && S.log.length>=S.settings.teams)
      threats = '<div class="scarce"><span class="striptag">🎯 BY #'+h.next+'</span>'+parts.join("")+'</div>';
  }
  hero.innerHTML = pickline + scarce + shelfLine + momentum + threats +
    '<div class="toppick'+(freshTop?' fresh':'')+'">'+
      '<div class="tag">⭐ Top Pick Right Now'+((()=>{const e=injuryOf(p); if(!e) return ""; const sv=injSeverity(e.s); return ' &nbsp;<span class="sevchip '+sv.cls+'">🩹 '+esc(sv.code==="?"?e.s:sv.label)+'</span>';})())+'</div>'+
      '<div class="heroline" data-card="'+p.id+'" title="Open player card">'+avatarImg(p,56)+'<div><div class="name">'+p.name+'</div>'+
      '<div class="meta">'+posBadge(p.pos)+' &nbsp;'+p.team+' &nbsp;·&nbsp; <span class="mono">'+p.proj+' proj</span> &nbsp;·&nbsp; <span class="mono" style="color:var(--green)">+'+Math.round(top.vorp)+' vs replacement</span>'+(heroGain?' &nbsp;·&nbsp; <span class="mono ok">+'+heroGain+' lineup</span>':'')+(rinfo[p.id]&&!rinfo[p.id].ud?' &nbsp;·&nbsp; <span class="rd">'+rinfo[p.id].label+'</span>':'')+(odds&&odds.h1[p.id]!=null?' &nbsp;·&nbsp; <b class="'+oddsClass(odds.h1[p.id])+'" title="Simulated survival odds at your next two picks (30 sims, ±9% at mid-range)">'+odds.h1[p.id]+'% at #'+odds.at1+(odds.h2?' · '+odds.h2[p.id]+'% at #'+odds.at2:'')+'</b>':'')+'</div></div></div>'+
      '<div class="why">'+why+'</div>'+
      vona +
      (plan.length?'<div class="planline" title="Continuation sim: what the engine would do with your following picks">▸ then likely: '+plan.join(" · ")+'</div>':'')+
      '<div class="actions">'+
        '<button class="pick" data-pick="'+p.id+'">✓ DRAFT HIM</button>'+
        '<button class="kill" data-take="'+p.id+'">✕ someone took him</button>'+
      '</div>'+
    '</div>';
  const bl = document.querySelector(".balist"); const blScroll = bl ? bl.scrollTop : 0;
  const byIdL = idIndex();
  const baseLineup = S.mine.length ? bestStarters(S.mine, byIdL).pts : 0;
  const lineupGain = pp => {
    const g = bestStarters(S.mine.concat([pp.id]), byIdL).pts - baseLineup;
    return g > 0.5 ? Math.round(g) : 0;
  };
  $("#baList").innerHTML = scored.slice(1, 1+(S.settings.baCount||15)).map((s,i)=>
    '<div class="barow" data-card="'+s.p.id+'">'+
      '<div class="rk mono">'+(i+2)+'</div>'+
      avatarImg(s.p,26)+
      posBadge(s.p.pos)+
      '<div class="info"><div class="nm">'+s.p.name+intelBadges(s.p)+(s.stack?'<span class="stackchip">🔗</span>':'')+(s.steal?' 💎':'')+(s.backRisk==="gone"?' 🔥':s.backRisk==="risky"?' ⏳':'')+'</div>'+
      '<div class="sm">'+s.p.team+' · '+s.p.proj+' pts'+(s.p.adp?' · ADP '+s.p.adp:'')+(odds&&odds.h1[s.p.id]!=null?' · <b class="'+oddsClass(odds.h1[s.p.id])+'">'+odds.h1[s.p.id]+'% back</b>':'')+(lineupGain(s.p)?' · <b class="ok">+'+lineupGain(s.p)+' lineup</b>':'')+'</div></div>'+
      '<div class="val mono">+'+Math.round(s.vorp)+'</div>'+
      '<button class="pick" data-pick="'+s.p.id+'">✓</button>'+
      '<button class="kill" data-take="'+s.p.id+'">✕</button>'+
      '<button class="undo1" data-queue="'+s.p.id+'" title="Queue">'+(S.queue.includes(s.p.id)?"★":"☆")+'</button>'+
    '</div>'
  ).join("");
  // Stack opportunities: available partners for YOUR QBs / pass-catchers
  const stacks = scored.filter(s=>s.stack).slice(0,4);
  if(stacks.length){
    const byId2 = idIndex();
    const partnerOf = sp => {
      const mates = S.mine.map(id=>byId2[id]).filter(Boolean).filter(m=>m.team===sp.team &&
        ((sp.pos==="QB" && (m.pos==="WR"||m.pos==="TE")) || ((sp.pos==="WR"||sp.pos==="TE") && m.pos==="QB")));
      return mates.length ? mates[0].name.split(" ").slice(-1)[0] : "";
    };
    $("#baList").innerHTML += '<div class="benchhead" style="border-top:1px solid var(--line);margin-top:8px">🔗 Stack opportunities</div>' +
      stacks.map(s=>'<div class="barow stackrow" data-card="'+s.p.id+'">'+
        avatarImg(s.p,26)+posBadge(s.p.pos)+
        '<div class="info"><div class="nm">'+s.p.name+' <span class="stackchip">🔗 '+esc(partnerOf(s.p))+'</span></div>'+
        '<div class="sm">'+(logoUrl(s.p.team)?'<img class="tlogo" src="'+logoUrl(s.p.team)+'" width="12" height="12" alt=""> ':'')+s.p.team+' · '+s.p.proj+' pts'+(odds&&odds.h1[s.p.id]!=null?' · <b class="'+oddsClass(odds.h1[s.p.id])+'">'+odds.h1[s.p.id]+'% back</b>':'')+'</div></div>'+
        '<div class="val mono">+'+Math.round(s.vorp)+'</div>'+
        '<button class="pick" data-pick="'+s.p.id+'">✓</button></div>').join("");
    // shout when the turn is coming and a stack is at risk
    const risky = stacks.find(s=>odds && odds.h1[s.p.id]!=null && odds.h1[s.p.id]<50);
    if(risky) $("#baList").innerHTML = '<div class="warn" style="border-radius:9px;margin:4px 2px 8px">🔗 <b>'+risky.p.name+'</b> stacks with your roster and is only <b>'+odds.h1[risky.p.id]+'%</b> to last until #'+odds.at1+'.</div>' + $("#baList").innerHTML;
  }
  // Best available at each position
  const bypos = {};
  for(const s of scored){ if(!bypos[s.p.pos]) bypos[s.p.pos] = s; }
  $("#baList").innerHTML += '<div class="benchhead" style="border-top:1px solid var(--line);margin-top:8px">Best at position</div>' +
    POSITIONS.map(pos=>{
      const s = bypos[pos];
      if(!s) return '<div class="barow"><div class="rk"></div>'+posBadge(pos)+'<div class="info"><div class="sm">— none left</div></div></div>';
      const stash = pos==="QB" && myCounts().QB>=2
        ? (()=>{ const st2 = scored.filter(x=>x.p.pos==="QB" && x.p.adp>100).slice(0,1)[0];
                 return st2 ? ' · stash: '+esc(st2.p.name.split(" ").slice(-1)[0]) : ""; })()
        : "";
      return '<div class="barow"><div class="rk"></div>'+posBadge(pos)+
        '<div class="info"><div class="nm">'+s.p.name+'</div><div class="sm">'+s.p.proj+' pts'+stash+(odds&&odds.h1[s.p.id]!=null?' · <b class="'+oddsClass(odds.h1[s.p.id])+'">'+odds.h1[s.p.id]+'%</b>':'')+'</div></div>'+
        '<div class="val mono">'+(s.vorp>0?"+":"")+Math.round(s.vorp)+'</div>'+
        '<button class="pick" data-pick="'+s.p.id+'">✓</button>'+
        '<button class="kill" data-take="'+s.p.id+'">✕</button></div>';
    }).join("");
  if(bl) bl.scrollTop = blScroll;
}

function renderRoster(){
  const {counts, needs, totalNeeded, picksLeft} = needInfo();
  const min = S.settings.min;
  const byId = idIndex();

  $("#rosCount").textContent = S.mine.length + " / " + S.settings.roster +
    (S.settings.auctionMode ? " · $"+((S.settings.budget||200) - Object.values(S.prices||{}).reduce((a,b)=>a+b,0))+" left" : "");

  $("#reqBar").innerHTML = POSITIONS.filter(pos=>min[pos]>0 || counts[pos]>0).map(pos=>{
    const have=counts[pos], need=min[pos]||0;
    let pips="";
    for(let i=0;i<Math.max(need,have);i++){
      pips += '<span class="pip '+(i<Math.min(have,need)?"full":(i<have?"extra":""))+'"></span>';
    }
    return '<div class="reqrow"><span class="lbl" style="color:var(--'+pos.toLowerCase()+')">'+pos+'</span>'+
      '<div class="pips">'+pips+'</div><span class="cnt mono">'+have+' / '+need+'</span></div>';
  }).join("");

  const warn = $("#warnBox");
  if(picksLeft===0){
    warn.innerHTML = '<div class="warn">Roster full. Good luck this season! 🏆</div>';
    if(!window._celebrated && S.mine.length >= S.settings.roster){
      window._celebrated = true;
      confetti();
      try{
        const all = profAll();
        const nm = "🏁 "+(S.settings.name||"Draft")+" "+new Date().getFullYear()+" final";
        // archive schema for next-summer hindsight (#477)
        all["📦 archive "+new Date().getFullYear()] = all["📦 archive "+new Date().getFullYear()] ||
          {kind:"season-archive", year:new Date().getFullYear(), stamp:(typeof DATA_STAMP!=="undefined"?DATA_STAMP:""),
           roster:myIds(), projections:Object.fromEntries(myIds().map(id2=>{const p2=idIndex()[id2]; return [id2, p2?p2.proj:0];}))};
        if(!all[nm]){ all[nm] = JSON.parse(JSON.stringify(S)); localStorage.setItem(PROF_KEY, JSON.stringify(all)); }
      }catch(e){}
      setTimeout(buildReport, 900);
    }
  } else if(totalNeeded > picksLeft){
    warn.innerHTML = '<div class="warn crit">⚠️ You owe '+totalNeeded+' required starters but only have '+picksLeft+' picks left. Fill requirements NOW.</div>';
  } else if(totalNeeded === picksLeft && totalNeeded>0){
    warn.innerHTML = '<div class="warn crit">🔒 Every remaining pick must fill a requirement ('+Object.entries(needs).filter(([,v])=>v>0).map(([k,v])=>v+" "+k).join(", ")+'). Recommendations are locked to those.</div>';
  } else if(totalNeeded>0){
    warn.innerHTML = '<div class="warn">Still required: '+Object.entries(needs).filter(([,v])=>v>0).map(([k,v])=>v+" "+k).join(", ")+' · '+picksLeft+' picks left ('+(picksLeft-totalNeeded)+' flex).</div>';
  } else {
    warn.innerHTML = '<div class="warn" style="color:var(--green)">✓ All requirements met — draft best value / upside.</div>';
  }

  let bs = null;
  const mineAll = myIds();
  if(!mineAll.length){
    $("#myRoster").innerHTML = '<div class="empty">No picks yet.<br>Hit <b style="color:var(--green)">✓ MINE</b> on a player when you draft them.</div>';
  } else {
    bs = bestStarters(mineAll, byId);
    const orderOf = {}; S.mine.forEach((id,i)=>orderOf[id]=i+1);
    myKeeperIds().forEach(id=>orderOf[id]="K");
    const posBase = (()=>{
      const players2 = allPlayers(), t2 = S.settings.teams;
      const starters = {QB:t2*2, RB:t2*2.5, WR:t2*2.5, TE:t2, DEF:t2};
      const b = {};
      POSITIONS.forEach(pos=>{
        const list2 = players2.filter(x=>x.pos===pos).sort((a,b)=>b.proj-a.proj).slice(0, Math.round(starters[pos]));
        b[pos] = list2.length ? list2.reduce((a,x)=>a+x.proj,0)/list2.length : 0;
      });
      return b;
    })();
    const seasonDone = myIds().length >= S.settings.roster;
    const rowFor = (p, lab) => '<div class="myp"><span class="slotlab">'+lab+'</span>'+avatarImg(p,22)+posBadge(p.pos)+
      (seasonDone && nextOpp(p.team) ? '<span class="dimtxt" style="font-size:8.5px" title="Next game">W'+nextOpp(p.team).w+' '+esc(nextOpp(p.team).opp)+'</span>' : '')+((()=>{const e=injuryOf(p); if(!e) return ""; const sv=injSeverity(e.s); return '<span class="ib '+sv.cls+'" title="'+esc(sv.label+(e.c?" — "+e.c:""))+'">●</span>';})())+
      '<div class="n">'+p.name+' <span class="t">'+(logoUrl(p.team)?'<img class="tlogo" src="'+logoUrl(p.team)+'" width="12" height="12" loading="lazy" alt=""> ':'')+p.team+' · <span class="mono">'+p.proj+'</span></span></div>'+
      (function(){const d3=Math.round(p.proj-posBase[p.pos]); return '<span class="mono" style="font-size:9.5px;color:'+(d3>=0?'var(--green)':'var(--red)')+'" title="vs average starter at position">'+(d3>0?'+':'')+d3+'</span>';})()+
      '<span class="t mono">'+(orderOf[p.id]==="K"?"👑":"R"+orderOf[p.id])+'</span>'+
      '<span class="x" data-drop="'+p.id+'" role="button" tabindex="0" aria-label="Remove '+esc(p.name)+' from my roster" title="Remove from my roster">✕</span></div>';
    let html = bs.line.map(sl => sl.p ? rowFor(sl.p, sl.lab) :
      '<div class="myp" style="opacity:.45"><span class="slotlab">'+sl.lab+'</span><span class="t">— open</span></div>').join("");
    const bench = mineAll.filter(id=>!bs.starterIds.has(id)).map(id=>byId[id]).filter(Boolean);
    if(bench.length) html += '<div class="benchhead">Bench</div>' + bench.map(p=>rowFor(p,"BN")).join("");
    $("#myRoster").innerHTML = html;
  }

  // Stacks summary
  const teams={};
  for(const id of S.mine){ const p=byId[id]; if(!p) continue; (teams[p.team]=teams[p.team]||[]).push(p); }
  const stacks = Object.entries(teams).filter(([,ps])=>ps.length>1 && ps.some(x=>x.pos==="QB") && ps.some(x=>x.pos==="WR"||x.pos==="TE"));
  const multis = Object.entries(teams).filter(([,ps])=>ps.length>1);
  let html="";
  if($("#stackBox").dataset.byeNote){ html += $("#stackBox").dataset.byeNote+"<br>"; delete $("#stackBox").dataset.byeNote; }
  if(stacks.length) html += "🔗 <b>Live stacks:</b> " + stacks.map(([t,ps])=>t+" ("+ps.map(x=>x.name.split(" ").pop()).join(" + ")+")").join(" · ");
  else if(multis.length) html += "Same-team pairs: " + multis.map(([t,ps])=>t+" ×"+ps.length).join(" · ");
  else if(S.mine.length) html += "No stacks yet — pairing a WR/TE with your QB adds a boost to recommendations.";
  $("#stackBox").innerHTML = html;

  const total = S.mine.reduce((a,id)=>a+((byId[id]||{}).proj||0),0);
  if(S.mine.length) $("#stackBox").innerHTML += '<br>Starters proj: <b class="mono">'+Math.round(bs?bs.pts:0)+'</b> · full roster: <span class="mono">'+Math.round(total)+'</span>';

  // FLEX advice late
  if(bs && picksLeft>0 && picksLeft<=5){
    const flexSlot = bs.line.find(sl=>sl.lab==="FLEX");
    if(flexSlot && !flexSlot.p){
      const bestFlex = scoreBoard().scored.find(s=>["RB","WR","TE"].includes(s.p.pos));
      if(bestFlex) warn.innerHTML += '<div class="warn">🎯 Your FLEX is open — best fit now: <b>'+esc(bestFlex.p.name)+'</b> ('+bestFlex.p.pos+', +'+Math.round(bestFlex.vorp)+')</div>';
    }
  }
  // Superflex musical chairs
  {
    const ros2 = teamRosters(), t2 = S.settings.teams;
    let needQb = 0;
    for(let s2=1;s2<=t2;s2++){
      const ids2 = s2===Math.min(S.settings.slot,t2) ? myIds() : ros2[s2];
      const qb2 = ids2.map(id2=>byId[id2]).filter(Boolean).filter(p2=>p2.pos==="QB").length;
      if(qb2<2) needQb++;
    }
    const seats = allPlayers().filter(p2=>p2.pos==="QB" && !offBoard(p2.id) && !S.dnd[p2.id] && (p2.proj-(replacementLevels(allPlayers()).QB||0))>0).length;
    if(needQb>0 && seats <= needQb && counts.QB<2 && picksLeft>0){
      warn.innerHTML += '<div class="warn crit">🎵 Musical chairs: <b>'+needQb+'</b> teams (incl. you) still need a QB2 and only <b>'+seats+'</b> startable QBs remain.</div>';
    }
  }
  // Bye clashes among starters (#406) + stack bye alignment (#411)
  if(bs){
    const byWeek = {};
    bs.line.forEach(sl=>{ if(sl.p){ const b2=byeOf(sl.p.team); if(b2) (byWeek[b2]=byWeek[b2]||[]).push(sl.p); } });
    Object.entries(byWeek).filter(([,ps2])=>ps2.length>=3).forEach(([w2,ps2])=>{
      warn.innerHTML += '<div class="warn">📅 Week '+w2+' bye pile-up: '+ps2.map(p2=>esc(p2.name.split(" ").slice(-1)[0])).join(", ")+' all sit together.</div>';
    });
    const stacksB = {};
    myIds().map(id2=>byId[id2]).filter(Boolean).forEach(p2=>{ (stacksB[p2.team]=stacksB[p2.team]||[]).push(p2); });
    Object.entries(stacksB).filter(([,ps2])=>ps2.some(x=>x.pos==="QB") && ps2.some(x=>x.pos==="WR"||x.pos==="TE")).forEach(([t2])=>{
      if(byeOf(t2)) $("#stackBox").dataset.byeNote = "🔗 "+t2+" stack shares the W"+byeOf(t2)+" bye — one hole, not two.";
    });
  }
  // My roster health warning
  const hurtMine = S.mine.map(id=>byId[id]).filter(Boolean).filter(p=>badInjury(p));
  if(hurtMine.length){
    warn.innerHTML += '<div class="warn crit">🩹 On your roster: '+hurtMine.map(p=>'<b>'+esc(p.name)+'</b> ('+esc(badInjury(p))+')').join(", ")+'</div>';
  }
  // Handcuff finder for my RBs
  {
    const myRbs = myIds().map(id2=>byId[id2]).filter(Boolean).filter(p2=>p2.pos==="RB");
    if(myRbs.length){
      const avail2 = allPlayers().filter(p2=>p2.pos==="RB" && !offBoard(p2.id));
      const cuffs = [];
      myRbs.forEach(rb=>{
        const c2 = avail2.filter(p2=>p2.team===rb.team).sort((a,b)=>b.proj-a.proj)[0];
        if(c2) cuffs.push(rb.name.split(" ").slice(-1)[0]+" → <b data-card=\""+c2.id+"\" style=\"cursor:pointer\">"+esc(c2.name)+"</b>");
      });
      if(cuffs.length) $("#stackBox").innerHTML += '<br>🔗 Handcuffs available: '+cuffs.join(" · ");
    }
  }
  // Positional run detector — 4+ of the last 10 picks at one position
  const recent = S.log.slice(-10);
  const rc = {};
  recent.forEach(e=>{ const p=byId[e.id]; if(p) rc[p.pos]=(rc[p.pos]||0)+1; });
  const runs = Object.entries(rc).filter(([pos,v])=>v>=4 && pos!=="DEF");
  if(runs.length && picksLeft>0 && recent.length>=6){
    warn.innerHTML += '<div class="warn crit">🚨 '+runs.map(([pos,v])=>'<b>'+pos+' RUN</b> — '+v+' of the last '+recent.length+' picks').join(' · ')+'. If you need one, move now.</div>';
  }
}

let logMineOnly = false;
function undoLastN(n){ for(let i=0;i<n;i++) undoLast(); }
function exportLogCsv(){
  const byId = idIndex(), t = S.settings.teams;
  let csv = "Pick,Round,Team,Player,Pos,NFLTeam,Who,Time\n";
  S.log.forEach((e,i)=>{
    const p = byId[e.id]; if(!p) return;
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), idx = n-(r-1)*t;
    const slot = (r%2===1)?idx:t+1-idx;
    csv += [n, r+"."+String(idx).padStart(2,"0"), '"'+slotName(slot).replace(/"/g,'""')+'"', '"'+p.name.replace(/"/g,'""')+'"', p.pos, p.team, e.who, e.t?new Date(e.t).toISOString():""].join(",")+"\n";
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = "draft-log.csv"; a.click(); URL.revokeObjectURL(a.href);
}
function renderLog(){
  const byId = idIndex();
  const t = S.settings.teams;
  const players = allPlayers(), repl = replacementLevels(players);
  $("#logList").innerHTML = S.log.length ? S.log.map((e,i)=>{
    const p = byId[e.id]; if(!p) return "";
    if(logMineOnly && e.who!=="me") return "";
    if(window._logQ && !nq(p.name).includes(nq(window._logQ))) return "";
    const n = i+1+(S.pickOffset||0), r = Math.ceil(n/t), ri = n-(r-1)*t;
    return '<div class="logrow"><span class="pickno mono">'+r+'.'+String(ri).padStart(2,"0")+'</span>'+avatarImg(p,18)+
      '<span class="who '+(e.who==="me"?"me":"")+'">'+(e.who==="me"?"MY PICK":"taken")+'</span>'+
      '<span class="n">'+(logoUrl(p.team)?'<img class="tlogo" src="'+logoUrl(p.team)+'" width="13" height="13" loading="lazy" alt=""> ':'')+p.name+' <span style="color:var(--faint)">'+p.pos+' · '+p.team+'</span></span>'+
      (function(){const v=Math.round(p.proj-(repl[p.pos]||0)); return '<span class="mono" style="font-size:10px;color:'+(v>25?'var(--green)':v>0?'var(--dim)':'var(--faint)')+'">'+(v>0?'+':'')+v+'</span>';})()+
      '<span class="x undo1" data-undoentry="'+i+'" role="button" tabindex="0" aria-label="Undo this pick" style="font-size:10.5px">undo</span></div>';
  }).reverse().join("") : '<div class="empty">Nothing yet. Mark players as they come off the board.</div>';
}

let _rafPending = false;
function render(){
  if(_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(()=>{ _rafPending = false; renderNow(); });
}
function renderNow(){
  try{ performance.mark("render-start"); }catch(e){}
  _idx = null;
  if(!window._firstPaintDone){
    window._firstPaintDone = true;
    [renderHeader, renderTabs, renderPool].forEach(fn=>{ try{ fn(); }catch(e){} });
    requestAnimationFrame(()=>{ [renderBest, renderRoster, renderLog, renderQueue, renderPlan].forEach(fn=>{ try{ fn(); }catch(e){} }); });
    return;
  }
  [renderHeader, renderTabs, renderPool, renderBest, renderRoster, renderLog, renderQueue, renderPlan].forEach(fn=>{
    try{ fn(); }catch(e){ console.error(fn.name, e); if(typeof surfaceError==="function") surfaceError(fn.name+": "+e.message); }
  });
  try{ performance.mark("render-end"); performance.measure("war-room-render", "render-start", "render-end"); }catch(e){}
}
function renderHeader(){
  const el = document.querySelector(".logo .sub");
  if(!el) return;
  let txt = (S.settings.name||"Buck Breakers")+" · Superflex · "+(S.settings.ptd||6)+"pt Pass TD · Slot "+S.settings.slot;
  if(S.settings.draftDate){
    const days = Math.ceil((new Date(S.settings.draftDate+"T20:00").getTime()-Date.now())/86400000);
    if(days>1) txt += " · ⏳ "+days+"d to draft";
    else if(days===1) txt += " · ⏳ TOMORROW";
    else if(days===0) txt += " · 🏈 DRAFT DAY";
  }
  el.textContent = txt;
  const fl = document.getElementById("rosFlair");
  if(fl) fl.textContent = S.settings.flair || "";
}


window.__mod = window.__mod || []; window.__mod.push("views.js");
