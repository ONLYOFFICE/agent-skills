#!/usr/bin/env node

/*
 * Collect literal signals from an eval run's outputs.
 *
 * This is evidence for a grader, not a verdict. A signal is a regex that a
 * correct answer almost certainly contains and an incorrect one almost
 * certainly does not -- but a comment mentioning `destroyEditor` matches the
 * same pattern as a call to it, so every hit still has to be looked at. The
 * point is to hand the grader line-anchored places to look instead of making
 * it re-read a whole project per assertion.
 *
 *   node signals.mjs <run-dir> [<run-dir> ...]        # human-readable
 *   node signals.mjs --json <run-dir> [...]           # machine-readable
 */

import * as fs from "node:fs";
import * as path from "node:path";

// eval group -> [name, regex]
const SIGNALS = {
  common: [
    ["callback returns exactly error 0", /"error"\s*:\s*0|error:\s*0|\{\s*"error"\s*:\s*0\s*\}/],
    ["editorConfig key used", /\beditorConfig\b/],
    ["events key used", /\bevents\b\s*[:=]/],
    ["documentType word/cell/slide", /"?(word|cell|slide)"?\s*[,:}]/],
    ["HS256 named", /HS256/],
    ["status 6 handled", /\b(case\s+6|status\s*==\s*6|status\s*===\s*6|==\s*6\b)/],
    ["forcesave mentioned", /forcesave|force-save|force save/i],
    ["destroyEditor", /destroyEditor/],
    ["key rotation vocabulary", /content hash|sha256|mtime|revision|version counter|rotate|new key/i],
  ],
  audit: [
    ["stale key named as cause", /stale|cach\w+ revision|same key|never changes|key is the filename/i],
    ["documentType text flagged", /documentType.{0,40}text|"text".{0,40}not (one of|valid)/],
    ["secret reaches browser", /secret.{0,60}(browser|client|bundle|page)|\/api\/session.{0,60}secret/i],
    ["placeholder replaced by iframe", /replace\w*.{0,40}iframe|iframe.{0,40}replace|placeholder.{0,60}(replaced|stripped|dropped)/i],
    ["download endpoint unverified", /\/download.{0,120}(no token|without.{0,20}(token|verif)|unauthenticated)/i],
  ],
};

const TEXT_SUFFIXES = new Set([
  ".md", ".go", ".js", ".mjs", ".cjs", ".ts", ".json", ".html",
  ".css", ".yaml", ".yml", ".txt", ".sh", ".mod", ".sum", ".toml",
]);
const SKIP_DIRS = new Set(["node_modules", ".git", "vendor", "inputs"]);

/** Every file under `dir`, recursively, skipping SKIP_DIRS at any depth. */
function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function gather(runDir) {
  const outputs = path.join(runDir, "outputs");
  if (!fs.existsSync(outputs) || !fs.statSync(outputs).isDirectory()) return "";

  const parts = [];
  for (const file of walk(outputs)) {
    if (!TEXT_SUFFIXES.has(path.extname(file).toLowerCase())) continue;
    try {
      const rel = path.relative(outputs, file);
      parts.push(`\n===== ${rel} =====\n${fs.readFileSync(file, "utf8")}`);
    } catch {
      // unreadable file - skip, same as the original's `except OSError`
    }
  }
  return parts.join("");
}

function scan(runDir) {
  const blob = gather(runDir);
  const result = {};
  for (const [group, signals] of Object.entries(SIGNALS)) {
    for (const [name, pattern] of signals) {
      const hits = blob.match(new RegExp(pattern, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"));
      result[`${group}: ${name}`] = hits ? hits.length : 0;
    }
  }
  result._chars = blob.length;
  return result;
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const dirs = argv.filter((a) => a !== "--json");

  if (dirs.length === 0) {
    console.log(
      "Collect literal signals from an eval run's outputs.\n\n" +
        "  node signals.mjs <run-dir> [<run-dir> ...]        # human-readable\n" +
        "  node signals.mjs --json <run-dir> [...]           # machine-readable",
    );
    return 1;
  }

  const report = Object.fromEntries(dirs.map((d) => [path.normalize(d), scan(d)]));

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }

  for (const [run, signals] of Object.entries(report)) {
    const { _chars, ...rest } = signals;
    console.log(`\n### ${run}  (${_chars} chars of text output)`);
    for (const [name, count] of Object.entries(rest)) {
      console.log(`  ${count ? "HIT " : "  - "} ${name}${count > 1 ? `  x${count}` : ""}`);
    }
  }
  return 0;
}

process.exit(main());
