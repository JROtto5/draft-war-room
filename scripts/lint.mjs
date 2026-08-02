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
if ((html.match(/<script src=/g) || []).length !== 2) fail("index.html must load exactly data.js + app.js");
if (!html.includes('rel="stylesheet" href="styles.css"')) fail("styles.css link missing");
const budgets = { "app.js": 220000, "data.js": 450000, "styles.css": 70000, "index.html": 30000 };
for (const [f, cap] of Object.entries(budgets)) {
  const size = statSync(f).size;
  if (size > cap) fail(`${f} is ${size}B > budget ${cap}B`);
  console.log(`${f}: ${(size/1024).toFixed(1)}KB (budget ${(cap/1024).toFixed(0)}KB)`);
}
console.log("lint OK");
