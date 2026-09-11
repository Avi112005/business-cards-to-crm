// Dev-only syntax check for all source files (no globbing issues on Windows).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "bin/cards-crm.js",
  ...readdirSync(join(root, "src"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => join("src", f)),
];

let failed = false;
for (const file of files) {
  const res = spawnSync(process.execPath, ["--check", join(root, file)], { stdio: "inherit" });
  if (res.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
