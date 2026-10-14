#!/usr/bin/env node
// Guards the local SQLite migrations in src-tauri/migrations.
//
// tauri-plugin-sql checksums each migration's exact bytes and refuses to open
// a database whose recorded checksum differs ("migration N was previously
// applied but has been modified"). So once a migration has shipped, editing
// even one byte of it bricks every existing install. This script:
//
//   1. fails if any migration recorded in migrations.lock.json has changed,
//   2. fails if a migration file is not registered in src-tauri/src/lib.rs
//      (or lib.rs references one that doesn't exist / is out of order),
//   3. with --update, records NEW migrations in the lock (never rewrites old ones).
//
// Add a schema change = add a new 000N_*.sql file, register it in lib.rs,
// then run `npm run migrations:lock`.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src-tauri/migrations");
const lockPath = join(dir, "migrations.lock.json");
const libRs = readFileSync(join(root, "src-tauri/src/lib.rs"), "utf8");
const update = process.argv.includes("--update");

const sha = (f) => createHash("sha256").update(readFileSync(join(dir, f))).digest("hex");
const sqlFiles = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : {};
const errors = [];

// 1. shipped migrations are immutable
for (const [f, hash] of Object.entries(lock)) {
  if (!sqlFiles.includes(f)) errors.push(`${f} is locked but was deleted`);
  else if (sha(f) !== hash) {
    errors.push(
      `${f} was modified after being locked — existing installs will refuse to open their database. ` +
        `Revert it and put the change in a new migration file instead.`,
    );
  }
}

// 2. lib.rs registers every file, in order, with matching version numbers
const registered = [...libRs.matchAll(/version:\s*(\d+)[\s\S]*?include_str!\("\.\.\/migrations\/([^"]+)"\)/g)].map(
  (m) => ({ version: Number(m[1]), file: m[2] }),
);
for (const f of sqlFiles) {
  if (!registered.some((r) => r.file === f)) errors.push(`${f} exists but is not registered in src-tauri/src/lib.rs`);
}
registered.forEach((r, i) => {
  const fileNum = Number(r.file.match(/^(\d+)/)?.[1]);
  if (r.version !== i + 1) errors.push(`lib.rs: ${r.file} has version ${r.version}, expected ${i + 1} (versions must be 1..N with no gaps)`);
  if (fileNum !== r.version) errors.push(`lib.rs: ${r.file} is registered as version ${r.version} but its filename says ${fileNum}`);
});

if (errors.length) {
  for (const e of errors) console.error(`✖ ${e}`);
  process.exit(1);
}

const unlocked = sqlFiles.filter((f) => !(f in lock));
if (update && unlocked.length) {
  for (const f of unlocked) lock[f] = sha(f);
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  console.log(`✔ locked ${unlocked.join(", ")}`);
} else if (unlocked.length) {
  console.error(`✖ not yet locked: ${unlocked.join(", ")} — run "npm run migrations:lock" once the migration is final`);
  process.exit(1);
} else {
  console.log(`✔ ${sqlFiles.length} migrations unchanged and registered`);
}
