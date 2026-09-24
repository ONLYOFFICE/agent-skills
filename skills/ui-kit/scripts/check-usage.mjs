#!/usr/bin/env node
/**
 * Reads a project that uses @onlyoffice/apps-ui-kit and reports the mistakes the kit itself
 * never reports: a visibility prop the component does not read, a portal-internal module
 * imported outside the portal, a form nobody can reach with the keyboard, a provider that was
 * never mounted. Everything it knows about the kit comes from `data/kit-manifest.json`, which
 * `tools/sync-ui-kit.mjs` derives from the kit's own sources.
 *
 *   node check-usage.mjs <project-dir> [--json] [--manifest <path>] [--kit <dir>]
 *
 * No network, no dependencies, and nothing is executed: the project is read as text.
 *
 * Exit: 0 clean (warnings allowed) · 1 at least one error · 2 the project or the manifest
 * could not be read.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST = path.join(HERE, "data", "kit-manifest.json");

const PACKAGE = "@onlyoffice/apps-ui-kit";
const LEGACY_PACKAGE = "@docspace/ui-kit";
const VISIBILITY_NAMES = ["visible", "isVisible", "isOpen", "opened", "open"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", "coverage", ".next", ".git", ".turbo", ".cache"]);
const SOURCE_FILE = /\.(?:m|c)?[jt]sx?$/;

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : null;
};
const asJson = args.includes("--json");

// The first argument that is neither a flag nor a flag's value.
const projectDir = (() => {
  const takesValue = new Set(["--manifest", "--kit"]);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith("--")) {
      if (takesValue.has(args[i])) i += 1;
      continue;
    }
    return args[i];
  }
  return null;
})();

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}

if (!projectDir) fail("usage: node check-usage.mjs <project-dir> [--json] [--manifest <path>] [--kit <dir>]");
if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) fail(`no such directory: ${projectDir}`);

const manifestPath = flag("--manifest") ?? DEFAULT_MANIFEST;
if (!existsSync(manifestPath)) fail(`no manifest at ${manifestPath} — run tools/sync-ui-kit.mjs --from <kit> --write`);
const kit = JSON.parse(readFileSync(manifestPath, "utf8"));

const byName = new Map(Object.values(kit.components).map((component) => [component.name, component]));
const publicSubpaths = new Set(kit.publicSubpaths);
const portalInternalNames = new Set(kit.portalInternalBarrelNames);
const defaultOnly = new Map(
  Object.entries(kit.components)
    .filter(([, component]) => component.default && component.import === "subpath only")
    .map(([, component]) => [component.name, component.subpath]),
);

/** The installed copy, when the project has one: its version and which subpaths it really has. */
const installed = (() => {
  const dir = flag("--kit") ?? path.join(projectDir, "node_modules", "@onlyoffice", "apps-ui-kit");
  const pkg = path.join(dir, "package.json");
  if (!existsSync(pkg)) return null;
  try {
    return { dir, version: JSON.parse(readFileSync(pkg, "utf8")).version ?? null };
  } catch {
    return null;
  }
})();

const findings = [];
const add = (severity, code, file, line, message, fix) => findings.push({ severity, code, file, line, message, fix });

// --- reading the project ---------------------------------------------------------------------

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sourceFiles(path.join(dir, entry.name), out);
    } else if (SOURCE_FILE.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Class names the project's own stylesheets declare something for, mapped to the declarations.
 *
 * Two of the checks below ask whether an element has been given a size, and the answer lives in
 * a stylesheet as often as in an inline `style`. A wrapper written `<div className="toggle-row">`
 * with `height: 20px` in `app.css` is correct, and an eval grader caught this reporting it — the
 * reader is sent to fix something that is not broken, which is worse than saying nothing.
 */
function styleRules(dir, out = new Map()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const at = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) styleRules(at, out);
    } else if (/\.(css|scss|sass|less)$/.test(entry.name)) {
      const sheet = readFileSync(at, "utf8");
      for (const [, selector, body] of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        for (const [, name] of selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
          out.set(name, `${out.get(name) ?? ""};${body}`);
        }
      }
    }
  }
  return out;
}

const cssRules = styleRules(projectDir);

/** Every identifier appearing in a `className` inside the fragment — CSS modules included. */
const classesIn = (fragment) => {
  const names = [];
  for (const match of fragment.matchAll(/(?:wrapperClassName|className)=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g)) {
    for (const token of (match[1] ?? match[2] ?? match[3] ?? "").match(/[A-Za-z_][\w-]*/g) ?? []) {
      names.push(token);
    }
  }
  return names;
};

const declaresIn = (fragment, property) =>
  classesIn(fragment).some((name) => property.test(cssRules.get(name) ?? ""));

/**
 * The attributes of a JSX tag, from the character after its name to the `>` that closes it.
 * Walked rather than matched: `onChange={(e) => …}` puts a `>` inside the attributes, and a
 * regex that stops at the first one truncates every handler in the file.
 */
function tagAttributes(text, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return text.slice(from, i);
  }
  return text.slice(from);
}

const IMPORT_FROM = /import\s+([\s\S]*?)\s+from\s*["']([^"']+)["']/g;
const IMPORT_BARE = /import\s*["']([^"']+)["']/g;
const REQUIRE_CALL = /(?:require|import)\(\s*["']([^"']+)["']\s*\)/g;

/** `{ A, B as C }` and a leading default binding, as imported-name → local-name. */
function bindingsOf(clause) {
  const bindings = [];
  const braces = /\{([\s\S]*?)\}/.exec(clause);
  const head = clause.slice(0, braces ? braces.index : clause.length).replace(/\btype\b/g, "").trim();
  const defaultName = /^[A-Za-z_$][\w$]*/.exec(head.split(",")[0]?.trim() ?? "");
  if (defaultName) bindings.push({ imported: "default", local: defaultName[0] });
  for (const part of braces ? braces[1].split(",") : []) {
    const clean = part.replace(/\btype\b/g, "").trim();
    if (!clean) continue;
    const [imported, local] = clean.split(/\s+as\s+/).map((s) => s.trim());
    bindings.push({ imported, local: local ?? imported });
  }
  return bindings;
}

// --- the checks ------------------------------------------------------------------------------

/** Which subpath of the kit a specifier names, or null when it is not the kit. */
function subpathOf(specifier) {
  if (specifier === PACKAGE) return "";
  if (specifier.startsWith(`${PACKAGE}/`)) return specifier.slice(PACKAGE.length + 1);
  return null;
}

function checkSpecifier(file, line, specifier, bindings) {
  if (specifier.includes("PUBLIC_DIR")) {
    add("error", "E-public-dir", file, line, `\`${specifier}\` uses PUBLIC_DIR`, "PUBLIC_DIR is a DocSpace client webpack alias and resolves nowhere else; import your own asset, or one of the kit's under assets/");
    return;
  }
  if (specifier === LEGACY_PACKAGE || specifier.startsWith(`${LEGACY_PACKAGE}/`)) {
    add("warning", "W-docspace-ui-kit", file, line, `\`${specifier}\` is the portal's name for this package`, `outside the portal it is ${PACKAGE}; inside a plugin, this is the plugin-sdk skill's job`);
    return;
  }

  const subpath = subpathOf(specifier);
  if (subpath === null) return;

  if (specifier.includes("/dist/")) {
    add("error", "E-dist-import", file, line, `\`${specifier}\` reaches into the build output`, "the exports map is the public surface; import the subpath instead");
    return;
  }
  if (subpath === "styles.css") {
    add("warning", "W-whole-library-css", file, line, "the whole library's stylesheet is imported", "every component imports its own CSS; this file is 727 KB and is only for bundlers that cannot follow those imports");
    return;
  }
  if (subpath === "providers/Providers" || bindings.some((b) => b.imported === "Providers")) {
    add("error", "E-composite-providers", file, line, "`Providers` is the portal's composed root", "it fetches portal settings through the REST API; compose ThemeProvider and TranslationProvider yourself");
    return;
  }
  if (subpath === "components/theme-provider" || bindings.some((b) => b.imported === "ThemeProviderComponent")) {
    add("error", "E-legacy-theme-provider", file, line, "`ThemeProviderComponent` is the layer underneath the provider", "it expects a resolved theme object; mount ThemeProvider from providers/theme");
    return;
  }

  const internal = kit.portalInternalSubpaths.find((mod) => subpath === mod || subpath.startsWith(`${mod}/`));
  if (internal) {
    add("error", "E-internal-subpath", file, line, `\`${subpath}\` is portal-internal`, "it reads the DocSpace REST client or a portal store and does nothing outside the portal");
    return;
  }

  if (subpath === "") {
    for (const binding of bindings) {
      if (portalInternalNames.has(binding.imported)) {
        add("error", "E-internal-subpath", file, line, `\`${binding.imported}\` is portal-internal, reached through the root barrel`, "the root index re-exports uploader and billing, so these names resolve with no warning");
      }
      const subpathOnly = defaultOnly.get(binding.imported);
      if (subpathOnly) {
        add("error", "E-default-import", file, line, `\`${binding.imported}\` is not exported from the root barrel`, `it is a default export and \`export *\` does not carry one: import ${binding.imported} from "${PACKAGE}/${subpathOnly}"`);
      }
    }
    return;
  }

  for (const binding of bindings) {
    const subpathOnly = defaultOnly.get(binding.imported);
    if (subpathOnly && binding.imported !== "default") {
      add("error", "E-default-import", file, line, `\`${binding.imported}\` is a default export of ${subpathOnly}`, `a named import of it resolves to nothing: import ${binding.imported} from "${PACKAGE}/${subpathOnly}"`);
    }
  }

  const known = publicSubpaths.has(subpath) || [...publicSubpaths].some((pub) => subpath.startsWith(`${pub}/`));
  const reallyThere = installed && existsSync(path.join(installed.dir, "dist", "esm", ...subpath.split("/"), "index.js"));
  if (!known && !reallyThere) {
    add("error", "E-unknown-subpath", file, line, `\`${subpath}\` is not a subpath of this package`, "check the component's folder name; every component resolves at components/<folder>");
  }
}

function checkTag(file, text, name, index, component) {
  const attributes = tagAttributes(text, index + name.length + 1);
  const line = lineOf(text, index);
  const has = (prop) => new RegExp(`(^|\\s)${prop}(\\s|=|/|$)`).test(attributes);

  if (component?.visibilityProp) {
    for (const wrong of VISIBILITY_NAMES) {
      if (wrong !== component.visibilityProp && has(wrong)) {
        add("error", "E-visibility-prop", file, line, `<${name} ${wrong}> — the prop it reads is \`${component.visibilityProp}\``, "a visibility prop it does not read is ignored in silence and the component never appears");
      }
    }
  }

  if (name === "FieldContainer" && !has("labelVisible")) {
    add("warning", "W-fieldcontainer-label", file, line, "<FieldContainer> without `labelVisible`", "the default is false and the whole label block is behind it, so labelText renders nothing");
  }
  if (name === "Loader" && !has("type")) {
    add("warning", "W-loader-type", file, line, "<Loader> without `type`", "the fallback renders the label as plain text with no animation; pass oval, dualRing, rombs or track");
  }
  if (name === "TextInput" && (!has("type") || !has("value"))) {
    add("warning", "W-textinput-required", file, line, "<TextInput> without `type` or `value`", "both are required props");
  }
  if ((name === "TextInput" || name === "Checkbox") && !has("tabIndex")) {
    add("warning", "W-tabindex", file, line, `<${name}> without \`tabIndex\``, "it defaults to -1, so the field cannot be reached from the keyboard");
  }
  if (name === "Textarea" && !declaresIn(attributes, /(^|[\s;{])(width|flex)\s*:/)) {
    add("warning", "W-textarea-width", file, line, "<Textarea> whose wrapper is given no width", "it has a max-width and no width of its own, and only `wrapperClassName` reaches the element that carries it — a `style` is spread onto the inner scroller, which is already full width, so it reads as though it worked and changes nothing");
  }
  if (name === "SearchInput" && /\.target\.value/.test(attributes)) {
    add("error", "E-searchinput-event", file, line, "<SearchInput> handler reads `.target.value`", "its onChange receives the string itself, unlike every other input in the kit, so this is undefined");
  }
  if (name === "ToggleButton") {
    const above = text.slice(Math.max(0, index - 300), index);
    const sized = /height/.test(above) || declaresIn(above, /(^|[\s;{])(min-)?height\s*:/);
    if (!sized) {
      add("warning", "W-toggle-wrapper", file, line, "<ToggleButton> with no sized wrapper above it", "it occupies no space of its own and overlaps whatever follows; wrap it in an element at least 16px tall");
    }
  }
}

// --- running ---------------------------------------------------------------------------------

const files = sourceFiles(projectDir);
if (!files.length) fail(`no source files under ${projectDir}`);

const usedComponents = new Set();
let usesKit = false;
const mounted = new Set();

/**
 * Comments blanked out, newlines kept so every line number still lands. A file that
 * documents what it does — `<button>` in a JSDoc line explaining why the kit's Button is
 * used instead — was being reported for the thing it was explaining.
 */
function withoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (line, before) => before + " ".repeat(line.length - before.length));
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const text = withoutComments(source);
  const shown = path.relative(projectDir, file).split(path.sep).join("/");
  const local = new Map();

  for (const [regex, specifierGroup, clauseGroup] of [[IMPORT_FROM, 2, 1], [IMPORT_BARE, 1, null], [REQUIRE_CALL, 1, null]]) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const specifier = match[specifierGroup];
      const bindings = clauseGroup ? bindingsOf(match[clauseGroup]) : [];
      checkSpecifier(shown, lineOf(text, match.index), specifier, bindings);
      if (subpathOf(specifier) === null) continue;
      usesKit = true;
      for (const binding of bindings) {
        const name = binding.imported === "default" ? binding.local : binding.imported;
        local.set(binding.local, name);
        if (name === "ThemeProvider" && subpathOf(specifier) !== "components/theme-provider") mounted.add("ThemeProvider");
        if (name === "TranslationProvider") mounted.add("TranslationProvider");
      }
    }
  }

  for (const [localName, kitName] of local) {
    const component = byName.get(kitName);
    if (component) usedComponents.add(kitName);
    for (const match of text.matchAll(new RegExp(`<${localName}(?=[\\s/>])`, "g"))) {
      checkTag(shown, text, localName, match.index, component);
    }
  }

  if (local.size) {
    const raw = /<(?:button|input|select|textarea)\b/.exec(text);
    if (raw) {
      add("warning", "W-raw-controls", shown, lineOf(text, raw.index), `a bare <${raw[0].slice(1)}> in a file that uses the kit`, "the kit's own Button, TextInput and Checkbox carry the theme; a bare one does not");
    }
  }

  if (/<FieldContainer/.test(text)) {
    const column = /style=\{\{[^}]*flexDirection:\s*["']column["'][^}]*\}\}/g;
    for (const match of text.matchAll(column)) {
      if (/\bgap\s*:/.test(match[0])) {
        add("warning", "W-fieldcontainer-gap", shown, lineOf(text, match.index), "a column with a `gap` around FieldContainer fields", "each field already carries margin: 0 0 16px, and the gap adds to it — drop the gap, or pass removeMargin");
      }
    }
  }
}

if (usesKit) {
  const needs = (provider) => [...usedComponents].some((name) => (byName.get(name)?.providers ?? []).includes(provider));
  if (needs("ThemeProvider") && !mounted.has("ThemeProvider")) {
    add("error", "E-no-theme-provider", "", 0, "no ThemeProvider from providers/theme is mounted", "without it the document carries no theme class and none of the components' CSS variables are declared");
  }
  if (needs("TranslationProvider") && !mounted.has("TranslationProvider")) {
    add("error", "E-no-translation-provider", "", 0, "a component that translates itself is used and no TranslationProvider is mounted", "its labels come back as empty strings, with one console error per key");
  }
}

if (installed?.version && installed.version !== kit.kitVersion) {
  add("warning", "W-version-skew", "", 0, `the project has ${PACKAGE} ${installed.version}, this skill describes ${kit.kitVersion}`, "prefer the installed package's own READMEs and types where they differ");
}

const errors = findings.filter((f) => f.severity === "error");

if (asJson) {
  console.log(JSON.stringify({ version: { installed: installed?.version ?? null, manifest: kit.kitVersion }, findings }, null, 2));
} else {
  for (const finding of findings) {
    const where = finding.file ? `${finding.file}:${finding.line}` : "(project)";
    console.log(`${finding.severity === "error" ? "ERROR  " : "WARNING"}  ${where}  ${finding.message}`);
    console.log(`         ${finding.code} — ${finding.fix}`);
  }
  console.log(
    `${files.length} file(s) read, ${usedComponents.size} kit component(s) used: ${errors.length} error(s), ${findings.length - errors.length} warning(s)`,
  );
}

process.exit(errors.length ? 1 : 0);
