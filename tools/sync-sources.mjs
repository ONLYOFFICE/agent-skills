#!/usr/bin/env node
/**
 * Keeps every external link and pinned version in a skill traceable to its sources.json.
 *
 *   node tools/sync-sources.mjs [--skill <name>] --check
 *       every URL in the skill must come from a manifest source or a placeholder host;
 *       every versionPattern must match the manifest version. Exit 1 otherwise.
 *   node tools/sync-sources.mjs [--skill <name>] --verify
 *       --check plus one request per distinct source URL; non-2xx answers exit 1.
 *   node tools/sync-sources.mjs --skill <name> --map <old base>=<new base>
 *       move a source to another site: rewrite the base in the manifest and every link
 *       built on it, then re-run --check. Use it for staging hosts, a local docs build or a
 *       renamed docs section.
 *   node tools/sync-sources.mjs --skill <name> --set-version <x.y.z>
 *       change the pinned SDK version: manifest, every versionPattern, every link built on
 *       a source whose base contains {version}.
 *
 * sources.json, next to SKILL.md:
 *   version            the SDK version the skill targets
 *   sources            name → { base, verify? }; base may contain {version}
 *   placeholderHosts   hosts that are examples, not sources (portal.example.com, localhost)
 *   versionPatterns    { file, pattern } — regex with {v} for the version, one match each
 *
 * Scanned: SKILL.md, README.md, references/**, scripts/**, evals/** of the skill, plus the
 * repository README.md against the union of all manifests. No dependencies; the network is
 * touched only by --verify.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = path.join(ROOT, "skills");
const URL_RE = /https?:\/\/[^\s)>\]"'`]+/g;
const TIMEOUT_MS = 8000;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const has = (name) => args.includes(name);
const onlySkill = flag("--skill");
const mapArg = flag("--map");
const setVersion = flag("--set-version");
const verify = has("--verify");

function skillDirs() {
  return readdirSync(SKILLS)
    .map((d) => path.join(SKILLS, d))
    .filter((d) => statSync(d).isDirectory() && existsSync(path.join(d, "sources.json")))
    .filter((d) => !onlySkill || path.basename(d) === onlySkill);
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "vendor", "fixtures"].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(md|mjs|json|txt)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function skillFiles(dir) {
  const files = ["SKILL.md", "README.md"].map((f) => path.join(dir, f)).filter(existsSync);
  for (const sub of ["references", "scripts", "evals"]) walk(path.join(dir, sub), files);
  return files.filter((f) => path.basename(f) !== "sources.json");
}

function readManifest(dir) {
  const file = path.join(dir, "sources.json");
  const m = JSON.parse(readFileSync(file, "utf8"));
  m.__file = file;
  m.__dir = dir;
  return m;
}

function expand(base, version) {
  return base.replaceAll("{version}", version);
}

function trimUrl(u) {
  return u.replace(/…+$/, "").replace(/[.,;:!?]+$/, "").replace(/[)\]]+$/, "");
}

function classify(url, manifests) {
  if (/[${}]/.test(url)) return { kind: "placeholder" };
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  })();
  for (const m of manifests) {
    for (const [name, src] of Object.entries(m.sources)) {
      const base = expand(src.base, m.version);
      if (url === base || url.startsWith(base + "/") || url.startsWith(base + "#") || url.startsWith(base + "?")) {
        return { kind: "source", source: name, manifest: m };
      }
      if (src.base.includes("{version}")) {
        const prefix = src.base.split("{version}")[0];
        if (url.startsWith(prefix)) return { kind: "stale-version", source: name, manifest: m };
      }
    }
    if (m.placeholderHosts?.some((h) => host === h || host.startsWith(h + ":"))) return { kind: "placeholder" };
  }
  if (/(^|\.)example\.(com|org|net)$|\.example$|^localhost(:|$)/.test(host)) return { kind: "placeholder" };
  return { kind: "foreign", host };
}

function scan(files, manifests) {
  const findings = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      for (const raw of line.match(URL_RE) ?? []) {
        const url = trimUrl(raw);
        findings.push({ file, line: i + 1, url, ...classify(url, manifests) });
      }
    });
  }
  return findings;
}

function checkVersions(m) {
  const problems = [];
  for (const vp of m.versionPatterns ?? []) {
    const file = path.join(m.__dir, vp.file);
    if (!existsSync(file)) {
      problems.push(`${vp.file}: missing file for pattern "${vp.pattern}"`);
      continue;
    }
    const text = readFileSync(file, "utf8");
    const re = new RegExp(vp.pattern.replaceAll("{v}", m.version.replaceAll(".", "\\.")));
    if (!re.test(text)) {
      const loose = new RegExp(vp.pattern.replaceAll("{v}", "([0-9]+\\.[0-9]+\\.[0-9]+)"));
      const found = text.match(loose);
      problems.push(`${vp.file}: pattern "${vp.pattern}" ${found ? `says ${found[1]}, manifest says ${m.version}` : "not found"}`);
    }
  }
  return problems;
}

async function head(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (res.status === 405 || res.status === 403) res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    return res.status;
  } catch (e) {
    return `error: ${e.name === "AbortError" ? "timeout" : e.message}`;
  } finally {
    clearTimeout(timer);
  }
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

function rewrite(files, from, to) {
  let count = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(from)) continue;
    count += text.split(from).length - 1;
    writeFileSync(file, text.replaceAll(from, to));
  }
  return count;
}

const manifests = skillDirs().map(readManifest);
if (!manifests.length) {
  console.error(onlySkill ? `ERROR: skills/${onlySkill}/sources.json not found` : "ERROR: no skills/*/sources.json found");
  process.exit(2);
}

if (mapArg || setVersion) {
  if (manifests.length !== 1) {
    console.error("ERROR: --map and --set-version need exactly one skill (--skill <name>)");
    process.exit(2);
  }
  const m = manifests[0];
  const files = skillFiles(m.__dir);
  if (mapArg) {
    const [from, to] = mapArg.split("=");
    if (!from || !to) {
      console.error("ERROR: --map expects <old base>=<new base>");
      process.exit(2);
    }
    let touched = false;
    for (const src of Object.values(m.sources)) {
      if (src.base.startsWith(from)) {
        src.base = to + src.base.slice(from.length);
        touched = true;
      }
    }
    if (!touched) {
      console.error(`ERROR: no source base in ${rel(m.__file)} starts with ${from}`);
      process.exit(2);
    }
    const n = rewrite(files, expand(from, m.version), expand(to, m.version));
    console.log(`mapped ${from} → ${to}: ${n} link(s) rewritten in ${path.basename(m.__dir)}`);
  }
  if (setVersion) {
    const old = m.version;
    for (const vp of m.versionPatterns ?? []) {
      const file = path.join(m.__dir, vp.file);
      if (!existsSync(file)) continue;
      const text = readFileSync(file, "utf8");
      const re = new RegExp(vp.pattern.replaceAll("{v}", "([0-9]+\\.[0-9]+\\.[0-9]+)"), "g");
      writeFileSync(file, text.replace(re, (whole, v) => whole.replace(v, setVersion)));
    }
    for (const src of Object.values(m.sources)) {
      if (src.base.includes("{version}")) rewrite(files, expand(src.base, old), expand(src.base, setVersion));
    }
    m.version = setVersion;
    console.log(`version ${old} → ${setVersion} in ${path.basename(m.__dir)}`);
  }
  const { __file, __dir, ...clean } = m;
  writeFileSync(__file, JSON.stringify(clean, null, 2) + "\n");
}

let problems = 0;
const toVerify = new Map();
for (const m of manifests) {
  const name = path.basename(m.__dir);
  const findings = scan(skillFiles(m.__dir), [m]);
  for (const f of findings) {
    if (f.kind === "foreign") {
      problems++;
      console.log(`FOREIGN  ${rel(f.file)}:${f.line}  ${f.url}  — not in ${name}/sources.json (add a source or a placeholder host)`);
    } else if (f.kind === "stale-version") {
      problems++;
      console.log(`STALE    ${rel(f.file)}:${f.line}  ${f.url}  — built on "${f.source}" with a version other than ${m.version}`);
    } else if (f.kind === "source" && verify && m.sources[f.source].verify !== false) {
      toVerify.set(f.url, `${rel(f.file)}:${f.line}`);
    }
  }
  for (const p of checkVersions(m)) {
    problems++;
    console.log(`VERSION  ${name}/${p}`);
  }
  console.log(`${name}: ${findings.length} link(s) scanned, version ${m.version}`);
}

const rootReadme = path.join(ROOT, "README.md");
const rootManifest = path.join(ROOT, "tools", "sources.json");
if (!onlySkill && existsSync(rootReadme)) {
  const rootManifests = existsSync(rootManifest)
    ? [...manifests, { ...JSON.parse(readFileSync(rootManifest, "utf8")), __dir: ROOT, __file: rootManifest }]
    : manifests;
  for (const f of scan([rootReadme], rootManifests)) {
    if (f.kind === "foreign") {
      problems++;
      console.log(`FOREIGN  README.md:${f.line}  ${f.url}  — not in any sources.json`);
    } else if (f.kind === "source" && verify) {
      toVerify.set(f.url, `README.md:${f.line}`);
    }
  }
}

if (verify) {
  for (const [url, where] of toVerify) {
    const status = await head(url);
    const ok = typeof status === "number" && status >= 200 && status < 300;
    if (!ok) problems++;
    console.log(`${ok ? "ok      " : "DEAD    "} ${status}  ${url}  (${where})`);
  }
}

if (problems) {
  console.log(`${problems} problem(s)`);
  process.exit(1);
}
console.log("OK: every link comes from a manifest and every pinned version matches");
