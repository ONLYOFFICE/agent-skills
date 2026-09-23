#!/usr/bin/env node
/**
 * Copies the UI kit's own documentation into skills/ui-kit/references/components/ and derives
 * the skill's component manifest from it. The kit is where a fact about a component is
 * written; every page under references/components/ is a mechanical copy of one, and nothing
 * there is edited by hand.
 *
 *   node tools/sync-ui-kit.mjs --from <dir> --write   copy the pages and rewrite the manifest
 *   node tools/sync-ui-kit.mjs --from <dir> --check   exit 1 when a copy differs from the source
 *   node tools/sync-ui-kit.mjs --check                offline: exit 1 when a page was hand-edited
 *   node tools/sync-ui-kit.mjs --from <dir> --dump    print the derived manifest and stop
 *
 * <dir> is a checkout of docspace-ui-kit-react, or an installed
 * node_modules/@onlyoffice/apps-ui-kit — the package's `files` ships the READMEs and the
 * cross-cutting docs pages at their source paths, so both trees look the same from here.
 *
 * What travels, and where it lands:
 *   components/<name>/README.md          → <name>.md
 *   components/<parent>/<child>/README.md → <parent>/<child>.md
 *   providers/<name>/README.md           → providers/<name>.md
 *   docs/getting-started.md              → _getting-started.md
 *   docs/known-defects.md                → _known-defects.md
 *   docs/components.md                   → README.md (the catalogue)
 *
 * Every page keeps a provenance header and a hash of its own body, so a hand edit here is
 * caught offline by --check rather than silently reverted by the next sync.
 *
 * Exit: 0 ok · 1 drift, a hand-edited page, or a missing metadata block under --strict ·
 * 2 usage, or a source tree that cannot be read.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.join(ROOT, "skills", "ui-kit");
const PAGES = path.join(SKILL, "references", "components");
const MANIFEST = path.join(SKILL, "scripts", "data", "kit-manifest.json");
const SKILL_SOURCES = path.join(SKILL, "sources.json");
const ROOT_SOURCES = path.join(ROOT, "sources.json");

const PACKAGE = "@onlyoffice/apps-ui-kit";
const PROVIDER_PAGES = ["theme", "translation", "error-boundary"];
const DOC_PAGES = {
  "docs/components.md": "README.md",
  "docs/getting-started.md": "_getting-started.md",
  "docs/known-defects.md": "_known-defects.md",
};

/**
 * Top-level modules a consumer may import. Listed rather than derived: the kit's folder
 * tree says nothing about tiering, and `docs/public-api.md` is the decision. Checked
 * against the source tree on every run, so a rename here is loud.
 */
const PUBLIC_TOP_LEVEL = ["assets", "constants", "context", "enums", "errors", "hooks", "locales", "styles", "types", "utils"];

/** Names the barrel exports that no application outside the portal should be reaching for. */
const LEGACY_NAMES = {
  ThemeProviderComponent: "the older theme provider; use ThemeProvider from providers/theme",
};

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const has = (name) => args.includes(name);

const from = flag("--from");
const mode = has("--write") ? "write" : has("--dump") ? "dump" : "check";
const strict = has("--strict");

let problems = 0;
const say = (...parts) => console.log(parts.join(""));
/** Said aloud but not fatal: the run still describes the kit as it is. */
const note = (kind, where, message) => say(`${kind.padEnd(12)} ${where}  — ${message}`);
const report = (kind, where, message) => {
  problems++;
  note(kind, where, message);
};

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}

const posix = (p) => p.split(path.sep).join("/");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

// --- where the source tree is, and what it says about itself -------------------------------

function openSource(dir) {
  if (!dir) fail("--from <dir> is required for --write, --check against a source, and --dump");
  if (!existsSync(dir)) fail(`no such directory: ${dir}`);

  const read = (rel) => {
    const file = path.join(dir, ...rel.split("/"));
    return existsSync(file) && statSync(file).isFile() ? readFileSync(file, "utf8") : null;
  };

  const pkgText = read("package.json");
  if (!pkgText) fail(`${dir} has no package.json — expected a checkout of docspace-ui-kit-react or an installed ${PACKAGE}`);
  const pkg = JSON.parse(pkgText);
  if (pkg.name !== PACKAGE) fail(`${dir} is ${pkg.name}, not ${PACKAGE}`);

  const kind = existsSync(path.join(dir, "components", "index.ts")) ? "checkout" : "package";
  const listDirs = (rel) => {
    const at = path.join(dir, ...rel.split("/"));
    if (!existsSync(at)) return [];
    return readdirSync(at, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  };

  return { dir, kind, version: pkg.version, read, listDirs };
}

/** The commit and branch the pages came from, when the source is a git checkout. */
function revisionOf(dir) {
  if (!existsSync(path.join(dir, ".git"))) return { commit: null, branch: null };
  try {
    const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();
    return { commit: git("rev-parse", "--short=8", "HEAD"), branch: git("rev-parse", "--abbrev-ref", "HEAD") };
  } catch {
    return { commit: null, branch: null };
  }
}

// --- the pages ------------------------------------------------------------------------------

/** Every README the kit ships that this skill copies, as upstream path → page path. */
function pageMap(src) {
  const map = new Map();

  for (const folder of src.listDirs("components")) {
    if (src.read(`components/${folder}/README.md`) !== null) map.set(`components/${folder}/README.md`, `${folder}.md`);
    for (const child of src.listDirs(`components/${folder}`)) {
      if (src.read(`components/${folder}/${child}/README.md`) !== null) {
        map.set(`components/${folder}/${child}/README.md`, `${folder}/${child}.md`);
      }
    }
  }

  for (const name of PROVIDER_PAGES) {
    if (src.read(`providers/${name}/README.md`) !== null) map.set(`providers/${name}/README.md`, `providers/${name}.md`);
  }

  for (const [upstream, page] of Object.entries(DOC_PAGES)) {
    if (src.read(upstream) !== null) map.set(upstream, page);
  }

  return map;
}

const META_RE = /<!--\s*ui-kit-doc\s*([\s\S]*?)-->/;

function metadataOf(text, where) {
  const match = META_RE.exec(text);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    report("META-BAD", where, `the metadata block is not JSON: ${error.message}`);
    return null;
  }
}

/** `](target)` and `](target "title")`, skipping absolute, anchor-only and mail links. */
const LINK_RE = /\]\((?!https?:|#|mailto:)([^)\s]+)((?:\s+"[^"]*")?)\)/g;

function rewriteLinks(text, upstream, page, map, repoUrl, commit, unmapped) {
  const fromDir = path.posix.dirname(upstream);
  const pageDir = path.posix.dirname(page);

  return text.replace(LINK_RE, (whole, target, title) => {
    const hash = target.indexOf("#");
    const file = hash >= 0 ? target.slice(0, hash) : target;
    const anchor = hash >= 0 ? target.slice(hash) : "";
    if (!file) return whole;

    const resolved = path.posix.normalize(path.posix.join(fromDir, file));
    const landing = map.get(resolved);

    if (landing) {
      const relative = path.posix.relative(pageDir === "." ? "" : pageDir, landing);
      return `](${relative}${anchor}${title})`;
    }

    unmapped.add(`${upstream} → ${resolved}`);
    return `](${repoUrl}/blob/${commit ?? "HEAD"}/${resolved}${anchor}${title})`;
  });
}

const HASH_MARK = "<!-- body-sha256: ";

function hashOf(body) {
  return createHash("sha256").update(body).digest("hex");
}

/** Everything a page claims about itself, plus the body the hash covers. */
function splitPage(text) {
  const at = text.indexOf(HASH_MARK);
  if (at < 0) return null;
  const end = text.indexOf("\n", at);
  if (end < 0) return null;
  const line = text.slice(at, end);
  const stated = line.slice(HASH_MARK.length).replace(/\s*-->\s*$/, "").trim();
  return { stated, body: text.slice(end + 1) };
}

function renderPage({ upstream, page, text, map, version, commit, repoUrl, unmapped }) {
  const source = text.replace(/\r\n/g, "\n");
  const rewritten = rewriteLinks(source, upstream, page, map, repoUrl, commit, unmapped);
  const depth = page.split("/").length - 1;
  const toSkill = "../".repeat(depth + 2);

  const notice = `> Synced from the kit's own \`${upstream}\` at ${version}. Where this page and [SKILL.md](${toSkill}SKILL.md) disagree, the skill's rule wins until the kit is corrected.`;
  const body = `\n${notice}\n\n${rewritten.replace(/\n*$/, "\n")}`;

  const header = [
    `<!-- synced-from: docspace-ui-kit-react ${version}${commit ? ` (${commit})` : ""} ${upstream} -->`,
    "<!-- do-not-edit: regenerate with `node tools/sync-ui-kit.mjs --from <kit> --write`; correct the text in the kit -->",
    `${HASH_MARK}${hashOf(body)} -->`,
  ].join("\n");

  return `${header}\n${body}`;
}

// --- the manifest ---------------------------------------------------------------------------

/** The `| \`module\` |` first column of the table under a heading of `docs/public-api.md`. */
function modulesUnder(publicApi, heading) {
  if (!publicApi) return [];
  const start = publicApi.indexOf(heading);
  if (start < 0) return [];
  const next = publicApi.indexOf("\n## ", start + heading.length);
  const section = publicApi.slice(start, next < 0 ? undefined : next);
  const rows = [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]);
  return [...new Set(rows)];
}

/** Named exports of a module's index, following one level of `export * from "./x"`. */
function exportedNames(src, module) {
  const seen = new Set();
  const collect = (rel, depth) => {
    const text =
      src.read(`${rel}/index.ts`) ??
      src.read(`${rel}/index.tsx`) ??
      src.read(`dist/types/${rel}/index.d.ts`);
    if (!text) return;
    for (const match of text.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
      for (const part of match[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name && name !== "default") seen.add(name);
      }
    }
    if (depth > 0) {
      for (const match of text.matchAll(/export\s+\*\s+from\s+"\.\/([^"]+)"/g)) collect(`${rel}/${match[1]}`, depth - 1);
    }
  };
  collect(module, 1);
  return [...seen].sort();
}

function buildManifest(src, pages, metas, revision, repoUrl) {
  const publicApi = src.read("docs/public-api.md");
  const portalInternal = modulesUnder(publicApi, "## Portal-internal");

  const components = {};
  const barrelNames = new Set();

  for (const [upstream, page] of pages) {
    const meta = metas.get(upstream);
    if (!meta) continue;
    const folder = meta.folder?.replace(/^components\//, "") ?? page.replace(/\.md$/, "");
    components[folder] = {
      name: meta.name,
      page: `references/components/${page}`,
      category: meta.category ?? null,
      status: meta.status ?? null,
      subpath: meta.import?.subpath ?? `components/${folder}`,
      import: meta.import?.barrel ? "barrel or subpath" : "subpath only",
      default: Boolean(meta.import?.default),
      visibilityProp: meta.state?.visibility ?? null,
      providers: meta.providers ?? [],
      exports: (meta.exports ?? []).filter((name) => name !== "default"),
      testIds: meta.testIds ?? [],
    };
    if (meta.import?.barrel) for (const name of components[folder].exports) barrelNames.add(name);
  }

  const missingTopLevel = PUBLIC_TOP_LEVEL.filter((name) => src.listDirs(".").indexOf(name) < 0);
  for (const name of missingTopLevel) report("TREE", name, "listed as a public top-level module, but the kit has no such directory");

  const publicSubpaths = [
    ...Object.values(components).map((c) => c.subpath),
    ...PROVIDER_PAGES.map((name) => `providers/${name}`),
    ...PUBLIC_TOP_LEVEL.filter((name) => !missingTopLevel.includes(name)),
    "styles.css",
  ].sort();

  return {
    package: PACKAGE,
    kitVersion: src.version,
    syncedCommit: revision.commit,
    syncedBranch: revision.branch,
    syncedFrom: src.kind,
    repo: repoUrl,
    publicSubpaths,
    portalInternalSubpaths: portalInternal,
    barrelNames: [...barrelNames].sort(),
    portalInternalBarrelNames: [...new Set([...exportedNames(src, "uploader"), ...exportedNames(src, "billing")])].sort(),
    legacyNames: LEGACY_NAMES,
    components,
  };
}

// --- running it -----------------------------------------------------------------------------

const rootSources = readJson(ROOT_SOURCES);
const skillSources = readJson(SKILL_SOURCES);
const repoSource = skillSources.sources?.repo;
if (!repoSource) fail(`${posix(path.relative(ROOT, SKILL_SOURCES))} declares no "repo" source`);
const repoUrl = rootSources.hosts[repoSource.host] + (repoSource.path ?? "");

function existingPages() {
  const out = new Map();
  const walk = (dir, prefix) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (entry.name.endsWith(".md")) out.set(rel, readFileSync(path.join(dir, entry.name), "utf8"));
    }
  };
  walk(PAGES, "");
  return out;
}

/** Offline: every page must still hash to what its own header says. */
function checkHashes() {
  const pages = existingPages();
  if (!pages.size) fail(`no pages under ${posix(path.relative(ROOT, PAGES))} — run --from <kit> --write first`);
  for (const [page, text] of pages) {
    const split = splitPage(text);
    if (!split) {
      report("NO-HASH", page, "the page carries no body-sha256 header; it did not come from this tool");
      continue;
    }
    if (hashOf(split.body) !== split.stated) {
      report("EDITED", page, "the body no longer matches its hash — re-sync, or move the correction into the kit");
    }
  }
  say(`${pages.size} page(s) checked offline`);
}

if (mode === "check" && !from) {
  checkHashes();
  process.exit(problems ? 1 : 0);
}

const src = openSource(from);
const revision = revisionOf(src.dir);
const pages = pageMap(src);
if (!pages.size) fail(`${src.dir} ships no component READMEs — is this the right tree?`);

const metas = new Map();
for (const [upstream] of pages) {
  if (!upstream.startsWith("components/")) continue;
  const meta = metadataOf(src.read(upstream), upstream);
  if (meta) metas.set(upstream, meta);
  else note("META-MISSING", upstream, "no ui-kit-doc block; this component is missing from the manifest");
}

const unmapped = new Set();
const rendered = new Map();
for (const [upstream, page] of pages) {
  rendered.set(
    page,
    renderPage({ upstream, page, text: src.read(upstream), map: pages, version: src.version, commit: revision.commit, repoUrl, unmapped }),
  );
}

const manifest = buildManifest(src, pages, metas, revision, repoUrl);

if (mode === "dump") {
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

if (mode === "write") {
  rmSync(PAGES, { recursive: true, force: true });
  for (const [page, text] of rendered) {
    const file = path.join(PAGES, ...page.split("/"));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  mkdirSync(path.dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  if (manifest.kitVersion !== skillSources.version) {
    say(`version ${skillSources.version} → ${manifest.kitVersion}: run \`node tools/sync-sources.mjs --skill ui-kit --set-version ${manifest.kitVersion}\``);
  }

  // Edited as text, not re-serialised: sync-sources.mjs writes this file in a
  // layout of its own -- one line per source and per version pattern -- and a
  // round trip through JSON.stringify would reformat the whole thing.
  let sourcesText = readFileSync(SKILL_SOURCES, "utf8");
  for (const [key, value] of [["syncedCommit", revision.commit], ["syncedBranch", revision.branch]]) {
    if (!value) continue;
    const line = `"${key}": ${JSON.stringify(value)}`;
    sourcesText = new RegExp(`"${key}":\\s*"[^"]*"`).test(sourcesText)
      ? sourcesText.replace(new RegExp(`"${key}":\\s*"[^"]*"`), line)
      : sourcesText.replace(/("version":\s*"[^"]*",)/, `$1\n  ${line},`);
  }
  writeFileSync(SKILL_SOURCES, sourcesText);
} else {
  const onDisk = existingPages();
  for (const [page, text] of rendered) {
    if (!onDisk.has(page)) report("MISSING", page, "the kit ships this page and the skill does not carry it");
    else if (onDisk.get(page) !== text) report("DRIFT", page, "the copy differs from a fresh transformation of the kit's page");
  }
  for (const page of onDisk.keys()) {
    if (!rendered.has(page)) report("STALE", page, "no page in the kit renders to this file any more");
  }
  if (existsSync(MANIFEST) && readFileSync(MANIFEST, "utf8") !== `${JSON.stringify(manifest, null, 2)}\n`) {
    report("DRIFT", posix(path.relative(ROOT, MANIFEST)), "the manifest differs from what the kit now says");
  }
}

for (const link of unmapped) say(`LINK?    ${link}  — no page of this skill lands there; rewritten to the kit on ${repoUrl.split("/").pop()}`);

const missingMeta = [...pages.keys()].filter((u) => u.startsWith("components/") && !metas.has(u)).length;
say(
  `${pages.size} page(s) ${mode === "write" ? "written" : "compared"} from ${src.kind} ${src.version}${revision.commit ? ` (${revision.commit})` : ""}, ` +
    `${Object.keys(manifest.components).length} component(s) in the manifest, ${missingMeta} without a metadata block`,
);

if (strict && missingMeta) {
  report("STRICT", "metadata", `${missingMeta} page(s) have no ui-kit-doc block`);
}

process.exit(problems ? 1 : 0);
