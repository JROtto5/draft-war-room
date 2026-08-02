import { readFileSync, statSync } from "node:fs";
const fail = m => { console.error("LINT FAIL: " + m); process.exit(1); };
const app = readFileSync("app.js", "utf8");
const html = readFileSync("index.html", "utf8");
if (/\bdebugger\b/.test(app)) fail("debugger statement in app.js");
if (/console\.log\(/.test(app)) fail("console.log left in app.js (use warn/error)");
if (/\b(TODO|FIXME)\b/.test(app)) fail("TODO/FIXME left in app.js");
const overlays = (html.match(/class="overlay"/g) || []).length;
const modals = (html.match(/class="modal[" ]/g) || []).length;
if (overlays !== modals) fail(`overlay/modal mismatch: ${overlays} vs ${modals}`);
if (!html.includes("Content-Security-Policy")) fail("CSP meta missing");
if ((html.match(/<script src=/g) || []).length !== 3) fail("index.html must load data.js + engine.js + app.js");
if (!html.includes('rel="stylesheet" href="styles.css"')) fail("styles.css link missing");
// Re-baselined after the v6 personalization data (LAST3 histories, hometowns,
// college map): app 215K, data 450K leave ~20% headroom over current sizes.
const budgets = { "app.js": 220000, "engine.js": 40000, "data.js": 450000, "styles.css": 70000, "index.html": 34000 };
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
console.log("lint OK");
