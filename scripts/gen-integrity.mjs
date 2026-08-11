// Generate (or verify with --verify) integrity.json: sha256 of every shipped file.
// MIT License — see LICENSE. © 2026 JROtto5 / Draft War Room.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const SHIPPED = [
  "index.html", "styles.css", "engine.js", "core.js", "season.js", "win.js", "simx.js", "ultra.js", "views.js", "wire.js",
  "boot.js", "data.js", "sw.js", "manifest.json", "404.html",
];

const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const manifest = Object.fromEntries(SHIPPED.map((f) => [f, sha(f)]));

if (process.argv.includes("--verify")) {
  const disk = JSON.parse(readFileSync("integrity.json", "utf8"));
  const bad = SHIPPED.filter((f) => disk.files?.[f] !== manifest[f]);
  if (bad.length) {
    console.error("❌ integrity mismatch: " + bad.join(", "));
    process.exit(1);
  }
  console.log("✅ integrity.json matches the working tree");
} else {
  writeFileSync("integrity.json", JSON.stringify({ generated: new Date().toISOString(), files: manifest }, null, 2) + "\n");
  console.log("integrity.json written (" + SHIPPED.length + " files)");
}
