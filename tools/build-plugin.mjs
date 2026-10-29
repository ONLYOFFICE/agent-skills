#!/usr/bin/env node
/**
 * Builds the plugin as it ships: the files an agent or a directory reads, and nothing that only
 * maintains them. The repository is the plugin's source; this is what an install receives, what
 * goes to the `plugin` branch and, zipped by the release workflow, to OpenAI's directory.
 *
 *   node tools/build-plugin.mjs              # from HEAD
 *   node tools/build-plugin.mjs --ref v0.2.0 # from a tag or any other revision
 *
 * Writes dist/, emptied first, from the committed files of the revision (never the working tree),
 * so a build is the same on every OS and for every checkout. Uncommitted changes are reported and
 * left out.
 *
 * What ships:
 *   - .claude-plugin/plugin.json and plugin.json, the two manifests; assets/icon.png; LICENSE
 *   - README.md, made from the root README: skill links point at SKILL.md, the line for
 *     contributors is dropped
 *   - per skill: SKILL.md, references/, templates/ and scripts/, less the maintainers' part of
 *     scripts/ (READMEs, self-tests, the SDK sync)
 * Every tracked file under skills/ must match a rule below, shipped or dropped: a new file fails
 * the build until it is given one. Before writing, tools/check-manifests.mjs must pass on the same
 * revision, and every relative link in a shipped Markdown file must reach a shipped file (and its
 * heading, when the link names one).
 *
 * Exit: 0 built, 1 a check failed, 2 the build could not run. No dependencies, no network.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

const ROOT_FILES = [".claude-plugin/plugin.json", "plugin.json", "assets/icon.png", "LICENSE"];

// First match wins. Paths are relative to skills/<name>/.
const SKILL_RULES = [
  [false, /^scripts\/(.+\/)?README\.md$/, "how the scripts are maintained"],
  [false, /^scripts\/test-validator\.mjs$/, "self-test"],
  [false, /^scripts\/validator-tests\//, "self-test fixtures"],
  [false, /^scripts\/sync-sdk\.mjs$/, "regenerates the validator from the SDK"],
  [true, /^SKILL\.md$/],
  [true, /^references\//],
  [true, /^templates\//],
  [true, /^scripts\//],
  [false, /^README\.md$/, "the skill's page in the repository"],
  [false, /^sources\.json$/, "read by tools/sync-sources.mjs"],
  [false, /^evals\//, "eval cases and fixtures"],
];

// The root README is the repository's page; these turn it into the plugin's.
const README_EDITS = [
  [/\]\(skills\/([a-z0-9-]+)\/README\.md\)/g, "](skills/$1/SKILL.md)"],
  [/^- Changing or adding a skill:.*\n(?: {2}.*\n)*/m, ""],
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}

function git(args, input) {
  try {
    return execFileSync("git", args, { cwd: ROOT, input, maxBuffer: 256 * 1024 * 1024 });
  } catch (error) {
    fail(`git ${args.join(" ")}: ${String(error.stderr ?? error.message).trim()}`);
  }
}

// The blobs of `files` at `ref`, through one `git cat-file --batch`.
function readBlobs(ref, files) {
  const out = git(["cat-file", "--batch"], files.map((f) => `${ref}:${f}`).join("\n") + "\n");
  const blobs = new Map();
  let at = 0;
  for (const file of files) {
    const end = out.indexOf(10, at);
    const header = out.toString("utf8", at, end).split(" ");
    if (header[1] !== "blob") fail(`${file} is not a file at ${ref}`);
    const size = Number(header[2]);
    blobs.set(file, out.subarray(end + 1, end + 1 + size));
    at = end + 1 + size + 1;
  }
  return blobs;
}

// GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens.
function anchors(markdown) {
  const found = new Set();
  for (const [, heading] of markdown.replace(/^```[\s\S]*?^```/gm, "").matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    found.add(heading.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-"));
  }
  return found;
}

function brokenLinks(files) {
  const broken = [];
  for (const [file, content] of files) {
    if (!file.endsWith(".md")) continue;
    const text = content.toString("utf8").replace(/^```[\s\S]*?^```/gm, "").replace(/`[^`\n]*`/g, "");
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const [where, hash] = target.split("#");
      const resolved = where ? path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURI(where))) : file;
      if (!files.has(resolved) && ![...files.keys()].some((f) => f.startsWith(`${resolved.replace(/\/$/, "")}/`))) {
        broken.push(`${file}: ${target} is not in the plugin`);
      } else if (hash && resolved.endsWith(".md") && files.has(resolved) && !anchors(files.get(resolved).toString("utf8")).has(hash)) {
        broken.push(`${file}: ${target} names a heading ${resolved} does not have`);
      }
    }
  }
  return broken;
}

const args = process.argv.slice(2);
const refAt = args.indexOf("--ref");
const ref = refAt === -1 ? "HEAD" : args[refAt + 1];
if (!ref) fail("--ref needs a revision");

try {
  execFileSync(process.execPath, [path.join(ROOT, "tools", "check-manifests.mjs"), "--ref", ref], { cwd: ROOT, stdio: "inherit" });
} catch {
  process.exit(1);
}

const tracked = git(["ls-tree", "-r", "-z", "--name-only", ref]).toString("utf8").split("\0").filter(Boolean);
const ship = [];
const problems = [];
const dropped = new Map();

// A missing file is a problem to report with the rest, not a blob to read.
for (const file of [...ROOT_FILES, "README.md"]) {
  if (tracked.includes(file)) ship.push(file);
  else problems.push(`${file} is not committed at ${ref}`);
}
for (const file of tracked) {
  const match = file.match(/^skills\/([^/]+)\/(.+)$/);
  if (!match) continue;
  const rule = SKILL_RULES.find(([, pattern]) => pattern.test(match[2]));
  if (!rule) problems.push(`${file} matches no rule in tools/build-plugin.mjs: say whether it ships`);
  else if (rule[0]) ship.push(file);
  else dropped.set(rule[2], (dropped.get(rule[2]) ?? 0) + 1);
}

const blobs = readBlobs(ref, ship);
if (blobs.has("README.md")) {
  let readme = blobs.get("README.md").toString("utf8");
  for (const [pattern, replacement] of README_EDITS) {
    if (!pattern.test(readme)) problems.push(`README.md: ${pattern} no longer matches; update README_EDITS`);
    pattern.lastIndex = 0;
    readme = readme.replace(pattern, replacement);
  }
  blobs.set("README.md", Buffer.from(readme, "utf8"));
}
problems.push(...brokenLinks(blobs));

for (const p of problems) console.log(`FAIL  ${p}`);
if (problems.length) process.exit(1);

const manifest = JSON.parse(blobs.get(".claude-plugin/plugin.json").toString("utf8"));
const files = new Map([...blobs].sort(([a], [b]) => (a < b ? -1 : 1)));

try {
  rmSync(DIST, { recursive: true, force: true, maxRetries: 3 });
} catch (error) {
  fail(`cannot clear dist/ (${error.code}): a shell or an editor may hold it open`);
}
for (const [file, data] of files) {
  mkdirSync(path.dirname(path.join(DIST, file)), { recursive: true });
  writeFileSync(path.join(DIST, file), data);
}

const changed = git(["status", "--porcelain", "--untracked-files=no"]).toString().trim();
if (ref === "HEAD" && changed) console.log(`NOTE  uncommitted changes are not in the build:\n${changed}`);
for (const [why, count] of dropped) console.log(`left out  ${count} file(s): ${why}`);
const bytes = [...files.values()].reduce((n, b) => n + b.length, 0);
console.log(`OK: ${manifest.name} ${manifest.version} from ${ref}, ${files.size} files, ${bytes} bytes, in dist/`);
