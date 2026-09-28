#!/usr/bin/env node

/*
 * Collect literal signals from an eval run's outputs.
 *
 * This is evidence for a grader, not a verdict. A signal is a regex that a
 * correct answer almost certainly contains and an incorrect one almost
 * certainly does not -- but a comment mentioning `Argument` matches the same
 * pattern as a script reading it, so every hit still has to be looked at. The
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
    ["docbuilder endpoint", /\/docbuilder\b/],
    ["converter endpoint (wrong service)", /\/converter\b/],
    ["script reads Argument", /\bArgument\s*\[|\bArgument\./],
    ["argument sent in request", /["']?argument["']?\s*[:=]/],
    ["builder script structure", /(builderJS|builder)\.(CreateFile|OpenFile)[\s\S]{0,4000}\.SaveFile[\s\S]{0,400}\.CloseFile/],
    ["error checked", /\.error\b|\[["']error["']\]|get\(["']error["']\)/],
    ["error -3", /-\s*3\b/],
    ["error -4", /-\s*4\b/],
    ["error -8", /-\s*8\b/],
    ["reads urls", /\burls\b/],
  ],
  async: [
    ["async flag sent", /"?async"?\s*[:=]\s*[Tt]rue/],
    ["end read", /\.end\b|\[["']end["']\]/],
    ["endConvert read (converter habit)", /endConvert/],
    ["percent read (field does not exist)", /\.percent\b|\[["']percent["']\]/],
    ["key from response", /(result|res|response|data|json|body)\??\.key\b|\[["']key["']\]/],
    ["bounded polling", /max_attempts|maxAttempts|max_retries|maxRetries|timeout|deadline|attempts\s*[<>]/i],
    ["downloads result", /s3|putObject|PutObject|upload|writeFile|pipeline\(/i],
  ],
  sync_batch: [
    ["per-row outcome tracking", /per[- ]row|for each row|results\.append|results\.push|failed\.append|failures/i],
    ["utf-8 named", /utf-?8/i],
  ],
  diagnosis: [
    ["payload replaces params named", /(inside|within|in)\s+the\s+(token|payload)|tokenRequiredParams|ignor\w+.{0,40}outside|dropped/i],
    ["keep jwt on", /keep\s+(jwt|token)|(don't|do not|shouldn't)\s+(turn|switch|disable).{0,20}(jwt|token)/i],
  ],
  audit: [
    ["unchecked error named as cause", /error.{0,40}(never checked|not checked|unchecked|ignored)|only.{0,20}\.?end\b/i],
    ["unbounded loop named as cause", /no timeout|no attempt cap|unbounded|forever|infinite/i],
    ["splicing into script named as cause", /inject|interpolat|concatenat|splic|escap/i],
    ["synthetic progress named as cause", /setInterval|synthetic|fake|no percent|doesn't (return|send) (a )?percent/i],
    ["temporary urls named as cause", /temporar|expir|signed (link|url)/i],
    ["generic catch-all named as cause", /generic|catch-all|one (string|message)|returns? null/i],
    ["public leftover scripts named", /public.{0,40}(director|folder|generated)|never (deleted|removed|cleaned)/i],
    ["token handling pinned as correct", /token.{0,60}(correct|fine|not (a )?(fault|issue|problem))/i],
  ],
};

const TEXT_SUFFIXES = new Set([
  ".md", ".go", ".js", ".mjs", ".cjs", ".ts", ".py", ".java", ".kt", ".json", ".html",
  ".css", ".yaml", ".yml", ".txt", ".sh", ".toml", ".xml", ".gradle",
]);
const SKIP_DIRS = new Set(["node_modules", ".git", "vendor", "inputs", "__pycache__", ".venv"]);

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
      // unreadable file - skip
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
