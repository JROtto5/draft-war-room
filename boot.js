/* Draft War Room · boot: lock screen, boot sequence, service worker, sentinels. */
/* ---------- Lock screen ---------- */
const LOCK_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // sha256("1234")
async function sha256hex(s){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
const LOCK_QUIPS = [
  "Buck Breakers War Room. Let's get this done.",
  "12 teams enter. One Otto leaves happy.",
  "The Schindlers are already nervous.",
  "Value doesn't draft itself.",
  "Trust the board. Fear the turn.",
];
function initLock(){
  const q = document.querySelector("#lockScreen .lockbox h1 + p");
  if(q){
    const m = new Date().getMonth();
    const seasonal = m===7 ? "It's draft szn. " : m>=8&&m<=11 ? "Season's live. " : "";
    q.textContent = seasonal + LOCK_QUIPS[Math.floor(Math.random()*LOCK_QUIPS.length)];
  }
  const scr = document.getElementById("lockScreen");
  const e2e = location.search.indexOf("e2e") >= 0;
  if(e2e || !window.crypto || !crypto.subtle){ scr.remove(); return; }
  try{ if(localStorage.getItem(LS_KEY+"-auth")===LOCK_HASH){ scr.remove(); return; } }catch(e){}
  scr.style.display = "flex";
  document.getElementById("lockPass").focus();
  document.getElementById("lockForm").addEventListener("submit", async ev=>{
    ev.preventDefault();
    const v = document.getElementById("lockPass").value;
    if((await sha256hex(v)) === LOCK_HASH){
      try{ localStorage.setItem(LS_KEY+"-auth", LOCK_HASH); }catch(e){}
      scr.classList.add("unlocking");
      setTimeout(()=>scr.remove(), 450);
      toast("🏈 Welcome back, Otto — let's get this done.");
    } else {
      const box = scr.querySelector(".lockbox");
      box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
      document.getElementById("lockNote").textContent = "nope — try the classic";
      document.getElementById("lockPass").value = "";
    }
  });
}
initLock();

/* ---------- Boot ---------- */
load();
if(location.search.indexOf("wall")>=0){
  document.addEventListener("DOMContentLoaded", ()=>{});
  setTimeout(()=>{
    document.body.innerHTML = '<div id="wallWrap"><h1 style="color:var(--green);letter-spacing:2px">'+esc(S.settings.name||"DRAFT")+' — LIVE BOARD</h1><div id="boardGrid"></div></div>';
    document.body.className = "wall";
    const draw = ()=>{ try{ renderBoard(); }catch(e){} };
    draw();
    window.addEventListener("storage", e2=>{ if(e2.key===LS_KEY && e2.newValue){ try{ S = Object.assign(defaultState(), migrate(JSON.parse(e2.newValue))); _memo={key:null}; draw(); }catch(err){} } });
    setInterval(draw, 30000);
  }, 400);
}
if(location.search.indexOf("demo")>=0 && location.search.indexOf("e2e")<0){
  window._spectate = true;
  document.body.classList.add("spectate");
  setTimeout(()=>{
    const byAdp = allPlayers().filter(p=>p.adp>0).sort((a,b)=>a.adp-b.adp);
    S.taken={}; S.mine=[]; S.log=[]; S.keepers={}; S.queue=[];
    byAdp.slice(0,11).forEach(p=>{ S.taken[p.id]=true; S.log.push({id:p.id, who:"other", t:Date.now()}); });
    _memo={key:null};
    render();
    toast("🎮 Demo mode — a live board at your pick, nothing is saved");
  }, 700);
}
setTimeout(()=>{
  const mo = (location.hash.match(/#open=(\w+)/)||[])[1];
  if(mo){
    history.replaceState(null, "", location.pathname);
    const map = {inj:"injBtn", mocks:"mocksBtn", board:"boardBtn", report:"gradeBtn"};
    const btn = document.getElementById(map[mo]||"");
    if(btn) btn.click();
  }
  refreshProfiles();
}, 600);
if(location.hash.indexOf("#b=")===0){ loadSharedBoard().then(ok=>{ if(ok){ initInjuries(); render(); } }); }
initInjuries();
const E2E_MODE = location.search.indexOf("e2e") >= 0;   // deterministic test runs: no network side-effects
if(!E2E_MODE && location.protocol.indexOf("http")===0){
  // idle connection warm-up (#424): a HEAD-ish ping opens TLS early
  if(window.requestIdleCallback) requestIdleCallback(()=>{
    ["https://api.sleeper.app/v1/state/nfl"].forEach(u=>{ try{ fetch(u, {mode:"cors"}).catch(()=>{}); }catch(e){} });
  }, {timeout:4000});
  setTimeout(()=>{ refreshInjuries(true); refreshTrending(); }, 1500);
  setInterval(()=>{ if(document.visibilityState==="visible") refreshInjuries(true); }, Math.max(2, S.settings.pollMins||5)*60e3);
  setInterval(()=>{ if(document.visibilityState==="visible") refreshTrending(); }, 15*60e3);
  setInterval(()=>{
    if(S.ui.live && S.settings.timerSecs && document.visibilityState==="visible"){
      const h2 = nextPickHorizon();
      if(h2 && h2.onClock) renderBest();
    }
  }, 1000);
}
document.querySelectorAll(".modal").forEach((m,i)=>{
  m.setAttribute("role","dialog"); m.setAttribute("aria-modal","true");
  const h3 = m.querySelector("h3");
  if(h3){ if(!h3.id) h3.id = "dlg"+i; m.setAttribute("aria-labelledby", h3.id); }
});
const BUILD = "7.0";
let _installEvt = null;
window.addEventListener("beforeinstallprompt", e=>{
  e.preventDefault();
  _installEvt = e;
  const b = document.getElementById("installBtn");
  if(b) b.style.display = "";
});
document.addEventListener("click", e=>{
  if(e.target && e.target.id==="installBtn" && _installEvt){
    _installEvt.prompt();
    _installEvt = null;
    e.target.style.display = "none";
  }
});
/* Theme: auto follows the OS, or force dark/light */
function applyTheme(){
  const pref = S.settings.theme || "auto";
  const dark = pref==="auto" ? !window.matchMedia("(prefers-color-scheme: light)").matches : pref==="dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.content = dark ? "#0b0f14" : "#eef2f7";
  const b = document.getElementById("themeBtn");
  if(b) b.textContent = pref==="auto" ? "🌓" : (pref==="dark" ? "🌙" : "☀️");
  document.documentElement.classList.toggle("terminal", S.settings.accent==="terminal");
  document.documentElement.dataset.font = S.settings.fontSize || "m";
  document.documentElement.classList.toggle("cb-safe", !!S.settings.cbSafe);
  const ACCENTS = {green:["#2fd47a","#1d8a50"], blue:["#5aa9ff","#2f6fc0"], gold:["#ffc94d","#b98a1a"], terminal:["#33ff33","#1f9922"]};
  const acc = ACCENTS[S.settings.accent] || null;
  if(acc){ document.documentElement.style.setProperty("--green", acc[0]); document.documentElement.style.setProperty("--green-dim", acc[1]); }
  else { document.documentElement.style.removeProperty("--green"); document.documentElement.style.removeProperty("--green-dim"); }
  document.body.classList.toggle("compact", !!S.settings.compact);
  document.body.classList.toggle("live", !!S.ui.live);
  const cols = S.settings.cols || {};
  document.body.classList.toggle("hidecol-adp", cols.adp===false);
  document.body.classList.toggle("hidecol-edge", cols.edge===false);
  document.body.classList.toggle("hidecol-rd", cols.rd===false);
}
let _wakeLock = null;
async function holdWake(on){
  try{
    if(on && "wakeLock" in navigator){ _wakeLock = await navigator.wakeLock.request("screen"); }
    else if(_wakeLock){ _wakeLock.release(); _wakeLock = null; }
  }catch(e){}
}
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && S.ui.live) holdWake(true); });
function setLive(on){
  S.ui.live = on;
  holdWake(on);
  if(on){ S.ui.liveStart = Date.now(); S.ui.liveLen0 = S.log.length; }
  document.body.classList.toggle("live", on);
  const b = document.getElementById("liveBtn");
  b.classList.toggle("liveon", on);
  b.textContent = on ? "🔴 LIVE" : "⚪ Live";
  save(); render();
  toast(on ? "🔴 Draft Day mode ON — chime + panic button armed" : "Live mode off");
}
document.getElementById("liveBtn").addEventListener("click", ()=>setLive(!S.ui.live));
function srAnnounce(text){
  let el = document.getElementById("srLive");
  if(!el){
    el = document.createElement("div");
    el.id = "srLive"; el.className = "visually-hidden";
    el.setAttribute("aria-live","polite");
    document.body.appendChild(el);
  }
  el.textContent = text;
}
function announce(text){
  srAnnounce(text);
  if(!S.settings.speak || !S.ui.live || !("speechSynthesis" in window)) return;
  try{
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.15; u.volume = 0.85;
    speechSynthesis.speak(u);
  }catch(e){}
}
function blip(){
  if(S.settings.sound===false || !S.ui.live) return;
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const o = ac.createOscillator(), g2 = ac.createGain();
    o.type = "square"; o.frequency.value = 520;
    o.connect(g2); g2.connect(ac.destination);
    g2.gain.setValueAtTime(0.05, ac.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+0.07);
    o.start(); o.stop(ac.currentTime+0.08);
  }catch(e){}
}
function stinger(kind){
  if(S.settings.sound===false) return;
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    if(kind==="horn"){
      [0,0.12,0.24].forEach(at=>{
        const o=ac.createOscillator(), g2=ac.createGain();
        o.type="sawtooth"; o.frequency.setValueAtTime(220, ac.currentTime+at);
        o.frequency.linearRampToValueAtTime(440, ac.currentTime+at+0.25);
        o.connect(g2); g2.connect(ac.destination);
        g2.gain.setValueAtTime(0.12, ac.currentTime+at);
        g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+at+0.3);
        o.start(ac.currentTime+at); o.stop(ac.currentTime+at+0.32);
      });
    } else {
      const o=ac.createOscillator(), g2=ac.createGain();
      o.type="triangle"; o.connect(g2); g2.connect(ac.destination);
      g2.gain.value=0.1;
      for(let i=0;i<6;i++){
        o.frequency.setValueAtTime(i%2?880:660, ac.currentTime+i*0.15);
      }
      g2.gain.setValueAtTime(0.1, ac.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+0.9);
      o.start(); o.stop(ac.currentTime+0.95);
    }
  }catch(e){}
}
function chime(){
  if(S.settings.sound===false) return;
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    [[880,0],[1174.7,0.18]].forEach(([f,at])=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.frequency.value=f; o.type="sine"; o.connect(g); g.connect(ac.destination);
      const vol = (S.settings.vol!=null?S.settings.vol:1);
      g.gain.setValueAtTime(0.001, ac.currentTime+at);
      g.gain.exponentialRampToValueAtTime(0.22*vol+0.001, ac.currentTime+at+0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+at+0.5);
      o.start(ac.currentTime+at); o.stop(ac.currentTime+at+0.55);
    });
  }catch(e){}
}
function toggleQueue(id){
  const i = S.queue.indexOf(id);
  if(i>=0) S.queue.splice(i,1); else S.queue.push(id);
  commit();
}
function pruneQueue(){ S.queue = (S.queue||[]).filter(id=>!offBoard(id)); }
function myRoundNow(){
  const mine = myOverallPicks(), cur = pickNow();
  const next = mine.find(x=>x>=cur);
  return next ? Math.ceil(next/S.settings.teams) : S.settings.roster+1;
}
function renderPlan(){
  const box = document.getElementById("planBox");
  if(!box) return;
  const entries = Object.keys(S.plan||{});
  const collapsed = window._planCollapsed;
  if(!entries.length){ box.innerHTML=""; box.style.display="none"; return; }
  box.style.display = "";
  const byId = idIndex(), rNow = myRoundNow();
  const keeperRounds = new Set(Object.values(S.keepers||{}).map(k=>k.r).filter(Boolean));
  let rows = "";
  if(!collapsed){
    rows = Array.from({length:S.settings.roster},(_,i)=>i+1).filter(r=>S.plan[r]||keeperRounds.has(r)).map(r=>{
      if(keeperRounds.has(r) && !S.plan[r]) return '<div class="barow"><span class="rk mono">R'+r+'</span><span class="dimtxt">🔒 keeper cost</span></div>';
      const p = byId[S.plan[r]];
      if(!p) return "";
      const gone = offBoard(p.id) && !S.mine.includes(p.id);
      const got = S.mine.includes(p.id);
      return '<div class="barow" data-card="'+p.id+'"><span class="rk mono">R'+r+'</span>'+avatarImg(p,20)+
        '<div class="info"><div class="nm" style="'+(gone?'text-decoration:line-through;opacity:.5':'')+'">'+p.name+
        (got?' <b class="ok">✓ GOT HIM</b>':gone?' <span class="low">sniped</span>':r<rNow?' <span class="mid">⏰ round passed</span>':'')+'</div></div>'+
        '<button class="kill" data-unplan="'+r+'" aria-label="Remove from plan">✕</button></div>';
    }).join("");
  }
  box.innerHTML = '<h2 style="cursor:pointer" data-plantoggle="1"><span class="dot" style="background:var(--wr);box-shadow:0 0 8px var(--wr)"></span> My Plan '+(collapsed?"▸":"▾")+
    '<button class="hbtn" data-planqueue="1" style="margin-left:auto;padding:2px 8px;font-size:10px" title="Seed the plan from your queue order">from queue</button></h2>'+
    (collapsed?"":'<div style="padding:6px 8px 10px">'+rows+'</div>');
}
function renderQueue(){
  pruneQueue();
  const box = document.getElementById("queueBox");
  if(!box) return;
  const byId = idIndex();
  if(!S.queue.length){ box.innerHTML=""; box.style.display="none"; return; }
  box.style.display = "";
  const oddsQ = survivalOdds();
  box.innerHTML = '<h2><span class="dot" style="background:var(--gold);box-shadow:0 0 8px var(--gold)"></span> My Queue'+
    '<button class="hbtn" data-qfill="1" style="margin-left:auto;padding:2px 8px;font-size:10px" title="Fill with the engine top needs">autofill</button></h2>'+
    '<div style="padding:6px 8px 10px">'+S.queue.map((id,i)=>{
      const p = byId[id]; if(!p) return "";
      const wantR = (S.queueRounds||{})[id];
      const lateQ = wantR && myRoundNow() > wantR;
      return '<div class="barow" data-card="'+id+'">'+avatarImg(p,22)+posBadge(p.pos)+
        '<div class="info"><div class="nm">'+p.name+(oddsQ&&oddsQ.h1[id]!=null&&oddsQ.h1[id]<60?' <span class="ib bear" title="Under 60% to survive to your pick — snipe risk">🎯</span>':'')+
        (wantR?' <span class="'+(lateQ?"low":"dimtxt")+'" style="font-size:9px" data-qround="'+id+'" title="Target round — click to change">R'+wantR+(lateQ?" ⏰":"")+'</span>':' <span class="dimtxt" style="font-size:9px;cursor:pointer" data-qround="'+id+'" title="Set a target round">+R?</span>')+'</div></div>'+
        '<button class="undo1" data-qup="'+i+'" aria-label="Move up"'+(i===0?' disabled':'')+'>↑</button>'+
        '<button class="undo1" data-qdn="'+i+'" aria-label="Move down"'+(i===S.queue.length-1?' disabled':'')+'>↓</button>'+
        '<button class="pick" data-pick="'+id+'">✓</button>'+
        '<button class="kill" data-queue="'+id+'" aria-label="Remove from queue">✕</button></div>';
    }).join("")+'</div>';
}
function updatePanic(hz, top){
  let bar = document.getElementById("panicBar");
  const want = hz && hz.onClock && S.ui.live && window._panicDismissed!==hz.cur && top;
  if(!want){ if(bar) bar.remove(); return; }
  if(!bar){ bar = document.createElement("div"); bar.id="panicBar"; document.body.appendChild(bar); }
  pruneQueue();
  const qTop = S.queue.length ? idIndex()[S.queue[0]] : null;
  const pickP = qTop || top.p;
  bar.innerHTML = '<span>🚨 PICK #'+hz.cur+' — YOU ARE ON THE CLOCK</span>'+
    '<button class="pick" data-pick="'+pickP.id+'" style="font-size:15px;padding:10px 18px">✓ TAKE '+esc(pickP.name.toUpperCase())+(qTop?" (QUEUED)":"")+'</button>'+
    '<button class="undo1" id="panicDismiss">✕</button>';
  bar.querySelector("#panicDismiss").addEventListener("click", ()=>{ window._panicDismissed=hz.cur; bar.remove(); });
}

document.getElementById("themeBtn").addEventListener("click", ()=>{
  const order = ["auto","dark","light"];
  S.settings.theme = order[(order.indexOf(S.settings.theme||"auto")+1)%3];
  save(); applyTheme();
  toast("Theme: "+S.settings.theme);
});
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyTheme);
let _konami = [];
document.addEventListener("keydown", e=>{
  _konami.push(e.key); _konami = _konami.slice(-10);
  if(_konami.join(",")==="ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a"){
    confetti(); stinger("horn");
    toast("🕹 <b>SUPER OTTO MODE</b> — nothing changes, but you feel unstoppable.");
  }
});

(function(){
  const av=document.getElementById("aboutVer");
  if(av) av.textContent = "v"+BUILD;
  const el=document.getElementById("buildStamp");
  if(el) el.textContent = "build v"+BUILD+" · projections "+(typeof DATA_STAMP!=="undefined"?DATA_STAMP:"?")+" · press ? for help";
  if(window._recovered) setTimeout(()=>toast("♻️ Save was corrupt — restored backup from "+esc(window._recovered), {warn:true}), 400);
  if(navigator.connection && navigator.connection.saveData && !S.settings.lowData){
    S.settings.lowData = true;
    toast("📶 Data-saver detected — photos off (Settings to re-enable)");
  }
  applyTheme();
  if(!S.seenTour && (typeof E2E_MODE==="undefined" || !E2E_MODE)){
    S.seenTour = true; save();
    setTimeout(()=>{ document.getElementById("helpOverlay").classList.add("show"); }, 900);
  }
  // stale projections hint (#58)
  try{
    const age = (Date.now() - new Date(DATA_STAMP).getTime())/86400000;
    if(age > 45 && !(S.dataRows&&S.dataRows.length)) setTimeout(()=>toast("📅 Built-in projections are "+Math.round(age)+" days old — Settings → import a fresh CSV", {warn:true}), 900);
  }catch(e){}
})();
function setOnlineUI(){
  const b = document.getElementById("saveBadge");
  document.body.classList.toggle("offline", navigator.onLine===false);
  if(navigator.onLine===false){ b.textContent = "📡 offline — cached data"; b.style.color = "var(--gold)"; }
  else { b.textContent = "Autosave on"; b.style.color = ""; }
}
window.addEventListener("storage", e=>{
  if(e.key !== LS_KEY || !e.newValue) return;
  try{
    S = Object.assign(defaultState(), migrate(JSON.parse(e.newValue)));
    _memo = {key:null};
    render();
    toast("🔄 Board updated in another tab");
  }catch(err){}
});
window.addEventListener("online", ()=>{ setOnlineUI(); refreshInjuries(true); });
window.addEventListener("offline", setOnlineUI);
let _hiddenAt = 0;
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState==="hidden") _hiddenAt = Date.now();
  else if(_hiddenAt && S.ui.live){ S.ui.hiddenMs = (S.ui.hiddenMs||0) + (Date.now()-_hiddenAt); _hiddenAt = 0; save(); }
});

let _lastErrToast = 0;
window._errLog = [];
function surfaceError(msg){
  window._errLog.push({t:new Date().toISOString(), m:String(msg).slice(0,200)});
  if(window._errLog.length>20) window._errLog.shift();
  const now = Date.now();
  if(now - _lastErrToast < 10000) return;
  _lastErrToast = now;
  toast("⚠️ Something broke: "+esc(String(msg).slice(0,120))+" — try a refresh; your board is saved.", {warn:true});
}
window.addEventListener("error", e=>surfaceError(e.message||"script error"));
window.addEventListener("unhandledrejection", e=>surfaceError((e.reason&&e.reason.message)||e.reason||"async error"));

/* #53: tell open sessions when a new version takes over */
if(typeof E2E_MODE!=="undefined" && !E2E_MODE && "serviceWorker" in navigator && location.protocol.indexOf("http")===0){
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{
    if(hadController) toast("⬆️ New version deployed", {action:{label:"RELOAD", fn:()=>location.reload()}});
  });
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
$("#showTaken").checked = S.ui.showTaken;
$("#roundFilter").value = S.ui.round || "ALL";
$("#fTargets").checked = !!S.ui.targetsOnly;
$("#fStacks").checked = !!S.ui.stacksOnly;
$("#fSurvive").checked = !!S.ui.survivors;
$("#fFallers").checked = !!S.ui.fallers;
$("#fHideHurt").checked = !!S.ui.hideHurt;
render();

window.__mod = window.__mod || []; window.__mod.push("boot.js");
