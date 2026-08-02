import { readFileSync, statSync } from "node:fs";
const fail = m => { console.error("LINT FAIL: " + m); process.exit(1); };
const app = ["core.js","views.js","wire.js","boot.js"].map(f=>readFileSync(f,"utf8")).join("\n");
const html = readFileSync("index.html", "utf8");
if (/\bdebugger\b/.test(app)) fail("debugger statement in app.js");
if (/console\.log\(/.test(app)) fail("console.log left in modules (use warn/error)");
// contrast audit (#423): key text/bg pairs must clear 4.5:1
const cssTxt = readFileSync("styles.css","utf8");
const getVar = n => { const m = cssTxt.match(new RegExp("--"+n+":(#[0-9a-fA-F]{6})")); return m && m[1]; };
const lum = hex => { const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const ratio = (a,b)=>{ const l1=lum(a), l2=lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
const bg = getVar("bg"), text = getVar("text"), dim = getVar("dim");
if (bg && text && ratio(text,bg) < 4.5) fail("text/bg contrast "+ratio(text,bg).toFixed(2));
if (bg && dim && ratio(dim,bg) < 3.5) fail("dim/bg contrast "+ratio(dim,bg).toFixed(2));
if (/\b(TODO|FIXME)\b/.test(app)) fail("TODO/FIXME left in app.js");
const overlays = (html.match(/class="overlay"/g) || []).length;
const modals = (html.match(/class="modal[" ]/g) || []).length;
if (overlays !== modals) fail(`overlay/modal mismatch: ${overlays} vs ${modals}`);
if (!html.includes("Content-Security-Policy")) fail("CSP meta missing");
const order = [...html.matchAll(/<script src="([^"]+)" defer>/g)].map(m=>m[1]);
if (JSON.stringify(order) !== JSON.stringify(["data.js","engine.js","core.js","views.js","wire.js","boot.js"]))
  fail("script load order wrong: " + order.join(","));
if (!html.includes('rel="stylesheet" href="styles.css"')) fail("styles.css link missing");
// Re-baselined after the v6 personalization data (LAST3 histories, hometowns,
// college map): app 215K, data 450K leave ~20% headroom over current sizes.
const budgets = { "core.js": 110000, "views.js": 90000, "wire.js": 95000,   // rebased post-R29: sync+board tools live here "boot.js": 30000,
  "engine.js": 40000, "data.js": 450000, "styles.css": 70000, "index.html": 37000 };  // rebased: settings grew 5 sections across R24-R29
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
