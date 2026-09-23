#!/usr/bin/env node

/*
 * Collect literal signals from an eval run's outputs.
 *
 * This is evidence for a grader, not a verdict. A signal is a regex that a
 * correct answer almost certainly contains and an incorrect one almost
 * certainly does not -- but a comment mentioning `endConvert` matches the
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
    ["HS256 named", /HS256/],
    ["Accept: application/json", /[Aa]ccept['"]?\s*[:=]\s*['"]application\/json/],
  ],
  conversion: [
    ["async flag sent", /"?async"?\s*[:=]\s*[Tt]rue/],
    ["endConvert read", /endConvert/],
    ["percent read", /\bpercent\b/],
    ["error -7", /-\s*7\b/],
    ["error -5", /-\s*5\b/],
    ["error -8", /-\s*8\b/],
    ["lowercasing types", /\.toLowerCase\(\)|ToLower/],
    ["same key on repoll", /same key|identical request|reuse the key|cache key/],
    ["bounded polling", /max_attempts|maxAttempts|max_retries|maxRetries|timeout|deadline|attempts\s*[<>]/],
    ["document-formats vendored", /document-formats|onlyoffice-docs-formats/],
  ],
  sync_batch: [
    ["password option used", /options\.password|password['"]?\s*:/],
    ["per-file outcome tracking", /per[- ]file|for each file|results\.push|results\[/i],
  ],
  audit: [
    ["fresh key per poll named as cause", /new key|fresh key|different key each|key.{0,20}(Date\.now|random|uuid)/i],
    ["error field unchecked named as cause", /error.{0,40}(never checked|not checked|unchecked|ignored)|only endConvert/i],
    ["unbounded loop named as cause", /no timeout|no attempt cap|unbounded|while\s*\(\s*true\s*\)/i],
    ["hardcoded format list named as cause", /hardcoded|SUPPORTED_FORMATS|never updated/i],
    ["silent unsupported-format return named as cause", /returns? null|silent(ly)? (no-?op|fail)/i],
    ["generic catch-all message named as cause", /generic|catch-all|one (string|message)|collapsed/i],
    ["Authorization header vs body token named as cause", /Authorization.{0,40}header|header.{0,40}(not|instead of).{0,20}body/i],
    ["lowercasing pinned as correct, not flagged", /lowercasing.{0,40}(correct|not (a )?(fault|issue|problem))/i],
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
