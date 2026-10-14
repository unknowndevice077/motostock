#!/usr/bin/env node
// Keeps the app version in sync across every file that carries it.
//
//   node scripts/version.mjs check          -> fail if any file disagrees
//   node scripts/version.mjs check v3.2.1   -> also fail if it isn't 3.2.1 (CI tag guard)
//   node scripts/version.mjs bump 3.2.2     -> rewrite all four files
//   node scripts/version.mjs bump patch     -> (or minor / major)
//
// package.json drives NEXT_PUBLIC_APP_VERSION, tauri.conf.json drives the
// installer/updater version, and Cargo.toml/Cargo.lock drive the binary.
// The updater compares against tauri.conf.json, so a missed file means
// installed copies either never see the update or re-download it forever.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => join(root, rel);

const files = {
  "package.json": {
    read: (s) => JSON.parse(s).version,
    write: (s, v) => s.replace(/("version":\s*")[^"]+(")/, `$1${v}$2`),
  },
  "src-tauri/tauri.conf.json": {
    read: (s) => JSON.parse(s).version,
    write: (s, v) => s.replace(/("version":\s*")[^"]+(")/, `$1${v}$2`),
  },
  "src-tauri/Cargo.toml": {
    read: (s) => s.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1],
    write: (s, v) => s.replace(/(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m, `$1${v}$2`),
  },
  "src-tauri/Cargo.lock": {
    read: (s) => s.match(/^name = "app"\r?\nversion = "([^"]+)"/m)?.[1],
    write: (s, v) => s.replace(/(^name = "app"\r?\nversion = ")[^"]+(")/m, `$1${v}$2`),
  },
};

function readAll() {
  return Object.fromEntries(
    Object.entries(files).map(([f, h]) => [f, h.read(readFileSync(p(f), "utf8"))]),
  );
}

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

const [cmd, arg] = process.argv.slice(2);
const versions = readAll();
const current = versions["package.json"];

if (cmd === "check") {
  const bad = Object.entries(versions).filter(([, v]) => v !== current);
  if (bad.length) {
    fail(
      "version mismatch:\n" +
        Object.entries(versions).map(([f, v]) => `    ${f}: ${v}`).join("\n"),
    );
  }
  if (arg && arg.replace(/^v/, "") !== current) {
    fail(`tag ${arg} does not match app version ${current} — run "npm run version:bump ${arg.replace(/^v/, "")}" and commit first`);
  }
  console.log(`✔ all files at ${current}`);
} else if (cmd === "bump") {
  if (!arg) fail("usage: version.mjs bump <x.y.z|patch|minor|major>");
  let next = arg.replace(/^v/, "");
  if (["patch", "minor", "major"].includes(arg)) {
    const [ma, mi, pa] = current.split(".").map(Number);
    next = arg === "major" ? `${ma + 1}.0.0` : arg === "minor" ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;
  }
  if (!/^\d+\.\d+\.\d+$/.test(next)) fail(`"${next}" is not a x.y.z version`);
  for (const [f, h] of Object.entries(files)) {
    const src = readFileSync(p(f), "utf8");
    const out = h.write(src, next);
    if (h.read(out) !== next) fail(`could not update ${f}`);
    writeFileSync(p(f), out);
  }
  console.log(`✔ ${current} -> ${next}\n  next: git commit -am "v${next}: ..." && git tag v${next} && git push origin main v${next}`);
} else {
  fail("usage: version.mjs <check [tag]|bump <version>>");
}
