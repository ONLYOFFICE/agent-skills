#!/usr/bin/env node
/**
 * Keeps every external link and pinned version in the repository traceable to its sources.
 *
 *   node tools/sync-sources.mjs [--skill <name>] --check
 *       every URL in a skill must be built on one of its sources or point at a placeholder
 *       host; every versionPattern must match the manifest version. Exit 1 otherwise.
 *   node tools/sync-sources.mjs [--skill <name>] --verify [--fallback]
 *       --check plus one request per distinct source URL; non-2xx answers exit 1. With
 *       --fallback every URL built on a host that has a "<host>Fallback" twin in the root
 *       manifest (apiSite → apiSiteFallback) is requested from the twin instead — the way to
 *       check links against the docs stand before production serves the pages.
 *   node tools/sync-sources.mjs --host <name>=<url>
 *       point a host at another site for the whole plugin: rewrite it in the root
 *       sources.json and every link built on it in every skill, then re-run --check.
 *       Use it for the staging site or a local docs build, and again to switch back.
 *   node tools/sync-sources.mjs --skill <name> --set-version <x.y.z>
 *       change the pinned SDK version: manifest, every versionPattern, every link built on
 *       a source whose path contains {version}.
 *
 * sources.json at the repository root:
 *   hosts     name → origin (or origin plus a fixed prefix), the only place a site is named.
 *             A host named "<name>Fallback" is the stand-in for <name> (never a link base):
 *             --verify --fallback and the internal .claude/skills/onlyoffice-docs script read
 *             from it when the primary host does not serve a page.
 *   sources   name → { host, path?, verify? } for the links of the repository README
 *
 * sources.json next to a SKILL.md:
 *   version            the SDK version the skill targets (absent for skills that pin none)
 *   sources            name → { host, path?, verify? }; the link base is hosts[host] + path,
 *                      and path may contain {version}
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
const ROOT_MANIFEST = path.join(ROOT, "sources.json");
const URL_RE = /https?:\/\/[^\s)>\]"'`]+/g;
const TIMEOUT_MS = 8000;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const has = (name) => args.includes(name);
const onlySkill = flag("--skill");
const hostArg = flag("--host");
const setVersion = flag("--set-version");
const verify = has("--verify");
const useFallback = has("--fallback");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}

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

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

if (!existsSync(ROOT_MANIFEST)) fail("sources.json not found at the repository root");
const root = readJson(ROOT_MANIFEST);
const hosts = root.hosts ?? {};

function readManifest(dir) {
  const file = path.join(dir, "sources.json");
  const m = readJson(file);
  m.__file = file;
  m.__dir = dir;
  m.__files = skillFiles(dir);
  m.__name = path.basename(dir);
  for (const [name, src] of Object.entries(m.sources)) {
    if (!src.host) fail(`${rel(file)}: source "${name}" has no host — name one from ${rel(ROOT_MANIFEST)}`);
    if (!hosts[src.host]) fail(`${rel(file)}: source "${name}" names host "${src.host}", which ${rel(ROOT_MANIFEST)} does not declare`);
  }
  return m;
}

/** The link base of a source under the current hosts, with {version} still unexpanded. */
function baseOf(src) {
  return hosts[src.host] + (src.path ?? "");
}

function expand(base, version) {
  return base.replaceAll("{version}", version ?? "");
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
      const template = baseOf(src);
      const base = expand(template, m.version);
      if (url === base || url.startsWith(base + "/") || url.startsWith(base + "#") || url.startsWith(base + "?")) {
        return { kind: "source", source: name, manifest: m };
      }
      if (template.includes("{version}") && url.startsWith(template.split("{version}")[0])) {
        return { kind: "stale-version", source: name, manifest: m };
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
    const lines = readFileSync(file, "utf8").split("\n");
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
  if (!m.version) {
    if (m.versionPatterns?.length) problems.push(`versionPatterns given but the manifest has no "version"`);
    return problems;
  }
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

/** With --fallback: the same URL on the host's "<name>Fallback" twin, or the URL itself when the host has none. */
function fallbackUrl(url, hostName) {
  const twin = hosts[`${hostName}Fallback`];
  const from = hosts[hostName];
  if (!useFallback || !twin || !from || !url.startsWith(from)) return url;
  return twin + url.slice(from.length);
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

/** One line per host, source and pattern: the manifests are read by people more often than by this script. */
function formatManifest(m) {
  const lines = ["{"];
  const entries = Object.entries(m);
  entries.forEach(([key, value], i) => {
    const comma = i < entries.length - 1 ? "," : "";
    if ((key === "sources" || key === "hosts") && value && typeof value === "object") {
      const inner = Object.entries(value).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v).replaceAll('":', '": ').replaceAll(',"', ', "')}`);
      lines.push(`  ${JSON.stringify(key)}: {`, inner.join(",\n"), `  }${comma}`);
    } else if (key === "versionPatterns" && Array.isArray(value)) {
      const inner = value.map((v) => `    ${JSON.stringify(v).replaceAll('":', '": ').replaceAll(',"', ', "')}`);
      lines.push(`  ${JSON.stringify(key)}: [`, inner.join(",\n"), `  ]${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}${comma}`);
    }
  });
  lines.push("}");
  return lines.join("\n") + "\n";
}

function writeManifest(m) {
  const { __file, __dir, __files, __name, ...clean } = m;
  writeFileSync(__file, formatManifest(clean));
}

const rootManifest = { ...root, sources: root.sources ?? {}, __dir: ROOT, __file: ROOT_MANIFEST, __files: [path.join(ROOT, "README.md")].filter(existsSync), __name: "README.md" };
for (const [name, src] of Object.entries(rootManifest.sources)) {
  if (!src.host || !hosts[src.host]) fail(`${rel(ROOT_MANIFEST)}: source "${name}" names an undeclared host`);
}

const manifests = skillDirs().map(readManifest);
if (!manifests.length) fail(onlySkill ? `skills/${onlySkill}/sources.json not found` : "no skills/*/sources.json found");

if (hostArg) {
  if (onlySkill) fail("--host applies to the whole plugin; drop --skill");
  const eq = hostArg.indexOf("=");
  const name = eq > 0 ? hostArg.slice(0, eq) : "";
  const to = eq > 0 ? hostArg.slice(eq + 1).replace(/\/+$/, "") : "";
  if (!name || !to) fail("--host expects <name>=<url>");
  if (!hosts[name]) fail(`host "${name}" is not declared in ${rel(ROOT_MANIFEST)} (known: ${Object.keys(hosts).join(", ")})`);
  if (!/^https?:\/\//.test(to)) fail(`"${to}" is not an http(s) URL`);
  const from = hosts[name];
  if (from === to) {
    console.log(`${name} already points at ${to}`);
  } else {
    let total = 0;
    for (const m of [...manifests, rootManifest]) {
      let n = 0;
      for (const src of Object.values(m.sources)) {
        if (src.host !== name) continue;
        const suffix = src.path ?? "";
        n += rewrite(m.__files, expand(from + suffix, m.version), expand(to + suffix, m.version));
      }
      if (n) console.log(`${m.__name}: ${n} link(s) moved`);
      total += n;
    }
    hosts[name] = to;
    root.hosts = hosts;
    writeFileSync(ROOT_MANIFEST, formatManifest(root));
    console.log(`host ${name}: ${from} → ${to}, ${total} link(s) rewritten`);
  }
}

if (setVersion) {
  if (manifests.length !== 1) fail("--set-version needs exactly one skill (--skill <name>)");
  const m = manifests[0];
  if (!m.version) fail(`${m.__name}/sources.json pins no version — nothing to set`);
  const old = m.version;
  for (const vp of m.versionPatterns ?? []) {
    const file = path.join(m.__dir, vp.file);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    const re = new RegExp(vp.pattern.replaceAll("{v}", "([0-9]+\\.[0-9]+\\.[0-9]+)"), "g");
    writeFileSync(file, text.replace(re, (whole, v) => whole.replace(v, setVersion)));
  }
  for (const src of Object.values(m.sources)) {
    const template = baseOf(src);
    if (template.includes("{version}")) rewrite(m.__files, expand(template, old), expand(template, setVersion));
  }
  m.version = setVersion;
  writeManifest(m);
  console.log(`version ${old} → ${setVersion} in ${m.__name}`);
}

let problems = 0;
const toVerify = new Map();
for (const m of manifests) {
  const findings = scan(m.__files, [m]);
  for (const f of findings) {
    if (f.kind === "foreign") {
      problems++;
      console.log(`FOREIGN  ${rel(f.file)}:${f.line}  ${f.url}  — not built on a source of ${m.__name}/sources.json (add a source or a placeholder host)`);
    } else if (f.kind === "stale-version") {
      problems++;
      console.log(`STALE    ${rel(f.file)}:${f.line}  ${f.url}  — built on "${f.source}" with a version other than ${m.version}`);
    } else if (f.kind === "source" && verify && m.sources[f.source].verify !== false) {
      toVerify.set(fallbackUrl(f.url, m.sources[f.source].host), `${rel(f.file)}:${f.line}`);
    }
  }
  for (const p of checkVersions(m)) {
    problems++;
    console.log(`VERSION  ${m.__name}/${p}`);
  }
  console.log(`${m.__name}: ${findings.length} link(s) scanned${m.version ? `, version ${m.version}` : ""}`);
}

if (!onlySkill) {
  for (const f of scan(rootManifest.__files, [...manifests, rootManifest])) {
    if (f.kind === "foreign") {
      problems++;
      console.log(`FOREIGN  README.md:${f.line}  ${f.url}  — not built on any source`);
    } else if (f.kind === "source" && verify && f.manifest.sources[f.source].verify !== false) {
      toVerify.set(fallbackUrl(f.url, f.manifest.sources[f.source].host), `README.md:${f.line}`);
    }
  }
}

if (verify) {
  if (useFallback) {
    const twins = Object.keys(hosts).filter((h) => hosts[`${h}Fallback`]);
    console.log(twins.length ? `verifying on the fallback host(s): ${twins.map((h) => `${h} → ${hosts[`${h}Fallback`]}`).join(", ")}` : "no host has a fallback twin; --fallback changes nothing");
  }
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
console.log("OK: every link is built on a declared host and every pinned version matches");
