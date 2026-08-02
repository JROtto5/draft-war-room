// Prints the latest CHANGELOG section — used by tools/release.sh for gh releases.
import { readFileSync } from "node:fs";
const md = readFileSync("CHANGELOG.md", "utf8");
const m = md.match(/## (v[\d.]+[^\n]*)\n([\s\S]*?)(?=\n## |$)/);
if (!m) { console.error("no changelog section"); process.exit(1); }
console.log(m[2].trim());
