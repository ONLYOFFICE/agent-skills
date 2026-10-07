#!/usr/bin/env node
/**
 * Derives skills/ui-kit/scripts/data/kit-manifest.json from the UI kit's own metadata: the
 * ui-kit-doc block of every component README, the portal-internal modules of
 * docs/public-api.md and the root-barrel snapshot in docs/plugin-surface.json.
 *
 *   node tools/sync-ui-kit.mjs --from <dir> --write   rewrite the manifest
 *   node tools/sync-ui-kit.mjs --from <dir> --check   exit 1 when the manifest differs from the kit
 *   node tools/sync-ui-kit.mjs --from <dir> --dump    print the derived manifest and stop
 *
 * <dir> is a checkout of docspace-ui-kit-react, or an installed
 * node_modules/@onlyoffice/apps-ui-kit: the package ships the READMEs and the docs pages.
 *
 * Exit: 0 ok, 1 drift or a missing metadata block under --strict, 2 usage or a source tree
 * that cannot be read.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.join(ROOT, "skills", "ui-kit");
const MANIFEST = path.join(SKILL, "scripts", "data", "kit-manifest.json");
const SKILL_SOURCES = path.join(SKILL, "sources.json");
const ROOT_SOURCES = path.join(ROOT, "sources.json");

const PACKAGE = "@onlyoffice/apps-ui-kit";
const PROVIDER_PAGES = ["theme", "translation", "error-boundary"];
const PUBLIC_TOP_LEVEL = ["assets", "constants", "context", "enums", "errors", "hooks", "locales", "styles", "types", "utils"];
const LEGACY_NAMES = {
  ThemeProviderComponent: "the older theme provider; use ThemeProvider from providers/theme",
};

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const has = (name) => args.includes(name);

// A typo (`--wirte`) used to fall through to check mode and read as a successful write.
const KNOWN = new Set(["--from", "--write", "--check", "--dump", "--strict"]);
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--from") i += 1;
  else if (!KNOWN.has(args[i])) {
    console.error(`ERROR: unknown argument ${args[i]}`);
    process.exit(2);
  }
}

const from = flag("--from");
const mode = has("--write") ? "write" : has("--dump") ? "dump" : "check";
const strict = has("--strict");

let problems = 0;
const say = (...parts) => (mode === "dump" ? console.error : console.log)(parts.join(""));
const note = (kind, where, message) => say(`${kind.padEnd(12)} ${where}  - ${message}`);
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

function openSource(dir) {
  if (!dir) fail("--from <dir> is required: a checkout of docspace-ui-kit-react or an installed node_modules/@onlyoffice/apps-ui-kit");
  if (!existsSync(dir)) fail(`no such directory: ${dir}`);

  const read = (rel) => {
    const file = path.join(dir, ...rel.split("/"));
    return existsSync(file) && statSync(file).isFile() ? readFileSync(file, "utf8") : null;
  };

  const pkgText = read("package.json");
  if (!pkgText) fail(`${dir} has no package.json: expected a checkout of docspace-ui-kit-react or an installed ${PACKAGE}`);
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
  const hasModule = (name) =>
    [name, `dist/esm/${name}`, `dist/types/${name}`].some((rel) => existsSync(path.join(dir, ...rel.split("/"))));

  return { dir, kind, version: pkg.version, read, listDirs, hasModule };
}

function componentReadmes(src) {
  const found = [];
  for (const folder of src.listDirs("components")) {
    if (src.read(`components/${folder}/README.md`) !== null) found.push(`components/${folder}/README.md`);
    for (const child of src.listDirs(`components/${folder}`)) {
      if (src.read(`components/${folder}/${child}/README.md`) !== null) found.push(`components/${folder}/${child}/README.md`);
    }
  }
  return found;
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

function modulesUnder(publicApi, heading) {
  if (!publicApi) return [];
  const start = publicApi.indexOf(heading);
  if (start < 0) return [];
  const next = publicApi.indexOf("\n## ", start + heading.length);
  const section = publicApi.slice(start, next < 0 ? undefined : next);
  const rows = [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]);
  return [...new Set(rows)];
}

function readModule(src, rel) {
  for (const candidate of [`${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`, `${rel}/index.tsx`]) {
    const text = src.read(candidate) ?? src.read(`dist/types/${candidate.replace(/\.tsx?$/, ".d.ts")}`);
    if (text) return { rel: candidate.replace(/\.tsx?$/, ""), text };
  }
  return null;
}

function exportedNames(src, module) {
  const seen = new Set();
  const visited = new Set();
  const collect = (rel) => {
    const found = readModule(src, rel);
    if (!found || visited.has(found.rel)) return;
    visited.add(found.rel);
    const text = found.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const match of text.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
      for (const part of match[1].split(",")) {
        const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
        if (name && name !== "default") seen.add(name);
      }
    }
    const declaration =
      /export\s+(?:declare\s+)?(?:abstract\s+)?(?:const\s+enum|const|let|var|function\*?|class|enum|type|interface|namespace)\s+([A-Za-z_$][\w$]*)/g;
    for (const match of text.matchAll(declaration)) seen.add(match[1]);
    for (const match of text.matchAll(/export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from/g)) seen.add(match[1]);
    const base = path.posix.dirname(found.rel);
    for (const match of text.matchAll(/export\s+(?:type\s+)?\*\s+from\s+["'](\.[^"']+)["']/g)) {
      collect(path.posix.join(base, match[1]));
    }
  };
  collect(module);
  return [...seen].sort();
}

function portalInternalBarrelNames(src, portalInternal) {
  const text = src.read("docs/plugin-surface.json");
  if (text) {
    const surface = JSON.parse(text);
    if (surface.package !== PACKAGE) fail(`docs/plugin-surface.json describes ${surface.package}, not ${PACKAGE}`);
    const inside = (origin) => portalInternal.some((module) => origin === module || origin.startsWith(`${module}/`));
    return Object.entries(surface.exports ?? {})
      .filter(([, entry]) => inside(entry.origin))
      .map(([name]) => name)
      .sort();
  }
  note("NO-SURFACE", "docs/plugin-surface.json", "not shipped by this kit; the portal-internal barrel names are read from uploader and billing by pattern");
  return [...new Set([...exportedNames(src, "uploader"), ...exportedNames(src, "billing")])].sort();
}

function buildManifest(src, metas, repoUrl) {
  const publicApi = src.read("docs/public-api.md");
  const portalInternal = modulesUnder(publicApi, "## Portal-internal");

  const components = {};
  const barrelNames = new Set();

  for (const [upstream, meta] of metas) {
    const folder = meta.folder?.replace(/^components\//, "") ?? upstream.replace(/^components\//, "").replace(/\/README\.md$/, "");
    components[folder] = {
      name: meta.name,
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

  const missingTopLevel = PUBLIC_TOP_LEVEL.filter((name) => !src.hasModule(name));
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
    repo: repoUrl,
    publicSubpaths,
    portalInternalSubpaths: portalInternal,
    barrelNames: [...barrelNames].sort(),
    portalInternalBarrelNames: portalInternalBarrelNames(src, portalInternal),
    legacyNames: LEGACY_NAMES,
    components,
  };
}

const rootSources = readJson(ROOT_SOURCES);
const skillSources = readJson(SKILL_SOURCES);
const repoSource = skillSources.sources?.repo;
if (!repoSource) fail(`${posix(path.relative(ROOT, SKILL_SOURCES))} declares no "repo" source`);
const repoUrl = rootSources.hosts[repoSource.host] + (repoSource.path ?? "");

const src = openSource(from);
const readmes = componentReadmes(src);
if (!readmes.length) fail(`${src.dir} ships no component READMEs: is this the right tree?`);

const metas = new Map();
for (const upstream of readmes) {
  const meta = metadataOf(src.read(upstream), upstream);
  if (meta) metas.set(upstream, meta);
  else note("META-MISSING", upstream, "no ui-kit-doc block; this component is missing from the manifest");
}

const manifest = buildManifest(src, metas, repoUrl);
const serialised = `${JSON.stringify(manifest, null, 2)}\n`;

if (mode === "dump") {
  process.stdout.write(serialised);
  process.exit(0);
}

if (mode === "write") {
  mkdirSync(path.dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, serialised);
  if (manifest.kitVersion !== skillSources.version) {
    say(`version ${skillSources.version} -> ${manifest.kitVersion}: run \`node tools/sync-sources.mjs --skill ui-kit --set-version ${manifest.kitVersion}\``);
  }
} else if (!existsSync(MANIFEST)) {
  report("MISSING", posix(path.relative(ROOT, MANIFEST)), "no manifest; run --write");
} else if (readFileSync(MANIFEST, "utf8") !== serialised) {
  report("DRIFT", posix(path.relative(ROOT, MANIFEST)), "the manifest differs from what the kit now says; run --write");
}
if (mode === "check" && manifest.kitVersion !== skillSources.version) {
  report(
    "VERSION",
    posix(path.relative(ROOT, SKILL_SOURCES)),
    `says ${skillSources.version}, the kit is ${manifest.kitVersion}: run \`node tools/sync-sources.mjs --skill ui-kit --set-version ${manifest.kitVersion}\``,
  );
}

const missingMeta = readmes.length - metas.size;
say(
  `${readmes.length} README(s) read from ${src.kind} ${src.version}, ` +
    `${Object.keys(manifest.components).length} component(s) in the manifest, ${missingMeta} without a metadata block`,
);
if (strict && missingMeta) report("STRICT", "metadata", `${missingMeta} README(s) have no ui-kit-doc block`);

process.exit(problems ? 1 : 0);
