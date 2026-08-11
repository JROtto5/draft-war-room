import { readFileSync, statSync } from "node:fs";
const fail = m => { console.error("LINT FAIL: " + m); process.exit(1); };
const app = ["core.js","views.js","wire.js","boot.js"].map(f=>readFileSync(f,"utf8")).join("\n");
// inline event handlers are dead in production — CSP script-src 'self' blocks them (#950)
{
  const mods = ["core.js","season.js","win.js","simx.js","ultra.js","views.js","wire.js","boot.js"];
  for (const f of mods){
    const src = readFileSync(f,"utf8");
    const m = src.match(/on(click|input|change|submit|mouseover)=\\?"/);
    if (m) fail("inline on"+m[1]+"= handler in "+f+" — CSP blocks these; use data-act + the dispatcher");
  }
}
// duplicate top-level function names across modules shadow each other silently (#835)
{
  const mods = ["engine.js","core.js","season.js","win.js","simx.js","ultra.js","views.js","wire.js","boot.js"];
  const seen = {};
  for (const f of mods)
    for (const m of readFileSync(f,"utf8").matchAll(/^function (\w+)/gm)) {
      if (seen[m[1]] && seen[m[1]] !== f) fail("duplicate global function '"+m[1]+"' in "+seen[m[1]]+" and "+f);
      seen[m[1]] = f;
    }
}
const html = readFileSync("index.html", "utf8");
if (/\bdebugger\b/.test(app)) fail("debugger statement in app.js");
if (/console\.log\(/.test(app)) fail("console.log left in modules (use warn/error)");
// contrast audit (#423): key text/bg pairs must clear 4.5:1
const cssTxt = readFileSync("styles.css","utf8");
const getVar = (n, i=0) => { const ms = [...cssTxt.matchAll(new RegExp("--"+n+":(#[0-9a-fA-F]{6})","g"))]; return ms[i] && ms[i][1]; };
const lum = hex => { const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const ratio = (a,b)=>{ const l1=lum(a), l2=lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
const bg = getVar("bg"), text = getVar("text"), dim = getVar("dim");
if (bg && text && ratio(text,bg) < 4.5) fail("text/bg contrast "+ratio(text,bg).toFixed(2));
if (bg && dim && ratio(dim,bg) < 3.5) fail("dim/bg contrast "+ratio(dim,bg).toFixed(2));
const lbg = getVar("bg",1), ltext = getVar("text",1), ldim = getVar("dim",1), lpanel = getVar("panel",1);
if (lbg && ltext && ratio(ltext,lbg) < 4.5) fail("LIGHT text/bg contrast "+ratio(ltext,lbg).toFixed(2));
if (lbg && ldim && ratio(ldim,lbg) < 3.5) fail("LIGHT dim/bg contrast "+ratio(ldim,lbg).toFixed(2));
if (lpanel && ldim && ratio(ldim,lpanel) < 3.5) fail("LIGHT dim/panel contrast "+ratio(ldim,lpanel).toFixed(2));
if (/\b(TODO|FIXME)\b/.test(app)) fail("TODO/FIXME left in app.js");
const overlays = (html.match(/class="overlay"/g) || []).length;
const modals = (html.match(/class="modal[" ]/g) || []).length;
if (overlays !== modals) fail(`overlay/modal mismatch: ${overlays} vs ${modals}`);
if (!html.includes("Content-Security-Policy")) fail("CSP meta missing");
const order = [...html.matchAll(/<script src="([^"]+)" defer>/g)].map(m=>m[1]);
if (JSON.stringify(order) !== JSON.stringify(["data.js","engine.js","core.js","season.js","win.js","simx.js","ultra.js","views.js","wire.js","boot.js"]))
  fail("script load order wrong: " + order.join(","));
if (!html.includes('rel="stylesheet" href="styles.css"')) fail("styles.css link missing");
// Re-baselined after the v6 personalization data (LAST3 histories, hometowns,
// college map): app 215K, data 450K leave ~20% headroom over current sizes.
// rebased post-R37: wire/index got ~25% fresh headroom; boot budget was
// silently dead (swallowed by a line comment) — restored.
const budgets = { "core.js": 110000, "season.js": 145000, "win.js": 150000, "simx.js": 120000, "ultra.js": 120000, "views.js": 95000, "wire.js": 110000, "boot.js": 32000,
  "engine.js": 40000, "data.js": 450000, "styles.css": 82000, "index.html": 42000 };
for (const [f, cap] of Object.entries(budgets)) {
  const size = statSync(f).size;
  if (size > cap) fail(`${f} is ${size}B > budget ${cap}B`);
  const pct = size/cap;
  console.log(`${f}: ${(size/1024).toFixed(1)}KB (budget ${(cap/1024).toFixed(0)}KB${pct>0.9?" ⚠ >90%":""})`);
}
// SW CORE files must exist on disk (#386)
const sw = readFileSync("sw.js", "utf8");
const core = sw.match(/const CORE = \[([^\]]+)\]/)[1].match(/"\.\/[^"]+"/g).map(s=>s.slice(3,-1));
for (const f of core) { try{ statSync(f); }catch(e){ fail("SW CORE file missing on disk: "+f); } }
// sw cache must be bumped whenever module set changes; loosely tie to git history depth is overkill —
// enforce monotonic style: name matches war-room-vN with N >= 10 after modularization
const swv = +sw.match(/war-room-v(\d+)/)[1];
if (swv < 10) fail("sw cache version regressed: v"+swv);
console.log("lint OK");
