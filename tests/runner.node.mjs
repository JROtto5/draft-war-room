// node:test wrapper so --experimental-test-coverage emits a report (#421).
import { test } from "node:test";
import { execFileSync } from "node:child_process";
for (const suite of ["engine", "data", "golden", "logic"]) {
  test(suite + " suite", () => { execFileSync("node", ["tests/" + suite + ".test.mjs"], {stdio: "pipe"}); });
}
