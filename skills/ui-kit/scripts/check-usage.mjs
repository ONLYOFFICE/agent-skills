#!/usr/bin/env node
/**
 * Reads a project that uses @onlyoffice/apps-ui-kit and reports the mistakes the kit itself
 * never reports: a visibility prop the component does not read, a portal-internal module or
 * component imported outside the portal, a caption attached to no control, a provider that was
 * never mounted. What it knows about the components comes from `data/kit-manifest.json`, which
 * `tools/sync-ui-kit.mjs` derives from the kit's own sources; the form traps below are written
 * here, each with the reason beside it.
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
// Controls that are in the tab order by default, so a `tabIndex={0}` on one is
// left over from when they were not. `AddButton` is deliberately absent: it has
// no default and genuinely needs one.
const TAB_INDEX_UNNEEDED = new Set([
  "TextInput",
  "Textarea",
  "Checkbox",
  "ComboBox",
]);
// InputBlock kept the -1 default the four above lost, and SearchInput and PasswordInput are
// built on it. InputBlock is public and in the barrel, so it is used directly too.
const TAB_INDEX_NEEDED = new Set(["InputBlock", "SearchInput", "PasswordInput"]);
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
// A manifest that does not parse is a manifest that could not be read, which the header
// promises is exit 2. Left to throw, it was exit 1 -- the code for "your project has errors" --
// so a broken sync read as a broken project.
const kit = (() => {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`the manifest at ${manifestPath} is not valid JSON (${error.message.split("\n")[0]}) — run tools/sync-ui-kit.mjs --from <kit> --write`);
  }
})();

const byName = new Map(Object.values(kit.components).map((component) => [component.name, component]));
const bySubpath = new Map(Object.values(kit.components).map((component) => [component.subpath, component]));
const publicSubpaths = new Set(kit.publicSubpaths);
const portalInternalNames = new Set(kit.portalInternalBarrelNames);
// Two questions that used to share one list, and so went silent together once its answer
// changed. Whether the root barrel carries a component is `import.barrel`, which the kit's
// validator derives from the TypeScript checker; today it carries all of them, because
// `components/index.ts` re-exports the default-only ones by name. Whether the component's own
// subpath has a *named* export of it is a property of that folder alone, and a folder that
// exports only a default has none: `import { Section } from ".../components/section"` resolves
// to nothing however the barrel is arranged.
const notInBarrel = new Map(
  Object.values(kit.components)
    .filter((component) => component.import === "subpath only")
    .map((component) => [component.name, component.subpath]),
);
const defaultOnlyOnSubpath = new Map(
  Object.values(kit.components)
    .filter((component) => component.default && !(component.exports ?? []).includes(component.name))
    .map((component) => [component.name, component.subpath]),
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

/**
 * A line-number lookup for one file. It used to slice and split the whole file for every match,
 * which made a large project quadratic -- 1500 files took 14 seconds. The line starts are found
 * once, and each lookup is a binary search.
 */
function lineIndex(text) {
  const starts = [0];
  for (let at = text.indexOf("\n"); at !== -1; at = text.indexOf("\n", at + 1)) starts.push(at + 1);
  return (index) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= index) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
}

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

/** The index just past the `}` that closes the `{` at `at`, stepping over strings inside. */
function skipBraces(text, at) {
  let depth = 0;
  let quote = null;
  for (let i = at; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote || (char === "\n" && quote !== "`")) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

/**
 * The attributes of one tag, name → the raw text of its value, or `true` for a bare flag.
 *
 * Parsed, because searching the raw text reported names that are not this tag's attributes at
 * all: `title="click to open it"` read as `open`, and `header={<Tooltip isOpen />}` handed the
 * nested Tooltip's prop to the Aside around it — both as errors, on correct code. A string value
 * and a `{…}` expression are stepped over whole, so only a name at the top level counts.
 */
function parseAttributes(fragment) {
  const attributes = new Map();
  let i = 0;
  while (i < fragment.length) {
    const char = fragment[i];
    if (/[\s/]/.test(char)) {
      i += 1;
      continue;
    }
    if (char === "{") {
      i = skipBraces(fragment, i); // a spread: `{...props}`
      continue;
    }
    const name = /^[A-Za-z_$][\w$:.-]*/.exec(fragment.slice(i))?.[0];
    if (!name) {
      i += 1;
      continue;
    }
    i += name.length;
    let at = i;
    while (/\s/.test(fragment[at] ?? "")) at += 1;
    if (fragment[at] !== "=") {
      attributes.set(name, true);
      continue;
    }
    at += 1;
    while (/\s/.test(fragment[at] ?? "")) at += 1;
    const start = at;
    const opener = fragment[at];
    if (opener === '"' || opener === "'") {
      at = fragment.indexOf(opener, at + 1);
      at = at === -1 ? fragment.length : at + 1;
    } else if (opener === "{") {
      at = skipBraces(fragment, at);
    } else {
      while (at < fragment.length && !/\s/.test(fragment[at])) at += 1;
    }
    attributes.set(name, fragment.slice(start, at));
    i = at;
  }
  return attributes;
}

// A clause never holds a quote or a semicolon. Without that bound the lazy match ran from a
// side-effect `import "./a.css"` to the `from` of whatever statement came next.
const IMPORT_FROM = /import\s+([^;"'`]*?)\s+from\s*["']([^"']+)["']/g;
const EXPORT_FROM = /export\s+(?:type\s+)?(\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/g;
const IMPORT_BARE = /import\s*["']([^"']+)["']/g;
const REQUIRE_CALL = /(?:require|import)\(\s*["']([^"']+)["']\s*\)/g;

/**
 * `{ A, B as C }`, a leading default binding and `* as Kit`, as imported-name → local-name. A
 * namespace is recorded as imported `*`: its members are only known where they are used, as
 * `<Kit.FieldContainer>`, and an import of it used to yield no binding at all, so nothing under
 * it was checked.
 */
function bindingsOf(clause) {
  const bindings = [];
  const namespace = /\*\s*as\s+([A-Za-z_$][\w$]*)/.exec(clause);
  if (namespace) bindings.push({ imported: "*", local: namespace[1] });
  const braces = /\{([\s\S]*?)\}/.exec(clause);
  const head = clause.slice(0, braces ? braces.index : clause.length).replace(/\btype\b/g, "").trim();
  const defaultName = /^[A-Za-z_$][\w$]*/.exec(head.split(",")[0]?.trim() ?? "");
  if (defaultName) bindings.push({ imported: "default", local: defaultName[0] });
  for (const part of braces ? braces[1].split(",") : []) {
    const type = /^\s*type\s/.test(part);
    const clean = part.replace(/\btype\b/g, "").trim();
    if (!clean) continue;
    const [imported, local] = clean.split(/\s+as\s+/).map((s) => s.trim());
    bindings.push({ imported, local: local ?? imported, type });
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

function checkSpecifier(file, line, specifier, bindings, typeOnly = false) {
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

  // Rule 5 names components as well as modules, and the manifest carries each one's `status`,
  // but nothing read it: `import Section from ".../components/section"` passed in silence. A
  // component is reached either through its own subpath or by name from the root barrel.
  const internalComponents =
    subpath === ""
      ? bindings.map((binding) => byName.get(binding.imported)).filter(Boolean)
      : [bySubpath.get(subpath)].filter(Boolean);
  for (const component of internalComponents.filter((c) => c.status === "portal-internal")) {
    add("error", "E-internal-component", file, line, `\`${component.name}\` is portal-internal`, "it needs portal context — a MobX store, the portal's translations or its device detection — and renders nothing useful outside the portal");
  }

  if (subpath === "") {
    if (!typeOnly && !(bindings.length && bindings.every((b) => b.type))) {
      add("warning", "W-root-barrel", file, line, `a value import from the root barrel \`${PACKAGE}\``, "the barrel re-exports billing and uploader, which import mobx, mobx-react, react-router and axios; a bundler resolves those before it drops what is unused, so the build fails without them. Import each component from its subpath");
    }
    for (const binding of bindings) {
      if (portalInternalNames.has(binding.imported)) {
        add("error", "E-internal-subpath", file, line, `\`${binding.imported}\` is portal-internal, reached through the root barrel`, "the root index re-exports uploader and billing, so these names resolve with no warning");
      }
      const subpathOnly = notInBarrel.get(binding.imported);
      if (subpathOnly) {
        add("error", "E-default-import", file, line, `\`${binding.imported}\` is not exported from the root barrel`, `the barrel does not re-export it by name: import ${binding.imported} from "${PACKAGE}/${subpathOnly}"`);
      }
    }
    return;
  }

  for (const binding of bindings) {
    const subpathOnly = defaultOnlyOnSubpath.get(binding.imported);
    if (subpathOnly === subpath && binding.imported !== "default") {
      add("error", "E-default-import", file, line, `\`${binding.imported}\` is a default export of ${subpathOnly}`, `a named import of it resolves to nothing: import ${binding.imported} from "${PACKAGE}/${subpathOnly}"`);
    }
  }

  const known = publicSubpaths.has(subpath) || [...publicSubpaths].some((pub) => subpath.startsWith(`${pub}/`));
  const reallyThere = installed && existsSync(path.join(installed.dir, "dist", "esm", ...subpath.split("/"), "index.js"));
  if (!known && !reallyThere) {
    add("error", "E-unknown-subpath", file, line, `\`${subpath}\` is not a subpath of this package`, "check the component's folder name; every component resolves at components/<folder>");
  }
}

/**
 * One tag of a kit component. `tag` is how the file spells it — `FC` for an alias,
 * `Kit.FieldContainer` under a namespace — and only locates the attributes; `name` is the kit's
 * own name, and every check below is keyed on that. It used to be keyed on the spelling, so
 * `FieldContainer as FC` switched off every form check at once.
 */
function checkTag(file, text, lineAt, tag, name, index, component, inString) {
  const attributes = tagAttributes(text, index + tag.length + 1);
  const parsed = parseAttributes(attributes);
  const line = lineAt(index);
  const has = (prop) => parsed.has(prop);
  const value = (prop) => (typeof parsed.get(prop) === "string" ? parsed.get(prop) : "");
  // Only the attributes that name classes, so a class on a nested element is not credited here.
  const classAttributes = ["className", "wrapperClassName"]
    .filter((prop) => value(prop))
    .map((prop) => `${prop}=${value(prop)}`)
    .join(" ");

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
  if (name === "FieldContainer" && has("labelVisible") && !has("labelFor")) {
    add("warning", "W-label-unattached", file, line, "<FieldContainer labelVisible> without `labelFor`", "the caption then captions nothing: clicking it focuses no field and a screen reader announces the control unnamed. Pass the control's id as `labelFor` and the same string as its `id`");
  }
  if (name === "Loader" && !has("type")) {
    add("warning", "W-loader-type", file, line, "<Loader> without `type`", "the fallback renders the label as plain text with no animation; pass oval, dualRing, rombs or track");
  }
  if (name === "TextInput" && (!has("type") || !has("value"))) {
    add("warning", "W-textinput-required", file, line, "<TextInput> without `type` or `value`", "both are required props");
  }
  // The kit's controls used to default `tabIndex` to -1, and this check used to
  // warn when one was missing. They default to 0 now, so a `tabIndex={0}` is at
  // best noise and at worst a habit that spreads to a listbox option, where -1
  // is the correct value and 0 breaks the active-descendant pattern.
  if (TAB_INDEX_UNNEEDED.has(name) && /^(\{\s*0\s*\}|"0"|'0')$/.test(value("tabIndex"))) {
    add("warning", "W-tabindex-noise", file, line, `<${name} tabIndex={0}>`, "every control in the kit is in the tab order already; `tabIndex` is for taking one out, not for putting it in");
  }
  // The other half: these two pass their `tabIndex` to InputBlock, whose own default is still -1.
  if (TAB_INDEX_NEEDED.has(name) && !has("tabIndex")) {
    add("warning", "W-tabindex-missing", file, line, `<${name}> without \`tabIndex\``, `${name === "InputBlock" ? "its" : "it is built on InputBlock, whose"} tabIndex defaults to -1, so the field cannot be reached from the keyboard; pass tabIndex={0}`);
  }
  // A Textarea's `id` lands on the `<textarea>` itself, so a container's `labelFor` names it
  // exactly as it names any other control. What its closed props type costs is the ability to
  // pass arbitrary attributes -- hence the three `aria-*` it declares as props of its own. This
  // check used to ignore the pair and warn about every captioned textarea in the repository.
  if (name === "Textarea" && !has("aria-label") && !has("aria-labelledby")) {
    const token = value("id").replace(/^["'{]\s*|\s*["'}]$/g, "").trim();
    const quoted = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const captioned =
      token !== "" && new RegExp(`labelFor=(?:"${quoted}"|\\{\\s*${quoted}\\s*\\})`).test(text);
    if (!captioned) {
      add("warning", "W-textarea-unnamed", file, line, "<Textarea> named by nothing", "it carries no `aria-label` or `aria-labelledby`, and no FieldContainer's `labelFor` points at an `id` on it, so it is announced unnamed");
    }
  }
  if (name === "Textarea" && !declaresIn(classAttributes, /(^|[\s;{])(width|flex)\s*:/)) {
    add("warning", "W-textarea-width", file, line, "<Textarea> whose wrapper is given no width", "it has a max-width and no width of its own, and only `wrapperClassName` reaches the element that carries it — a `style` is spread onto the inner scroller, which is already full width, so it reads as though it worked and changes nothing");
  }
  if (name === "SearchInput" && /\.target\.value/.test(value("onChange"))) {
    add("error", "E-searchinput-event", file, line, "<SearchInput> handler reads `.target.value`", "its onChange receives the string itself, unlike every other input in the kit, so this is undefined");
  }
  if (name === "ToggleButton") {
    const parent = parentElement(text, index, inString);
    // A component of the application's own is opaque from here, and a toggle at the root of
    // what a component returns is sized by whoever renders it: neither is reported. A DOM
    // element, or a kit component, is read.
    const readable = parent && (/^[a-z]/.test(parent.name) || byName.has(parent.name.split(".")[0]));
    if (readable && !sizedElement(text, parent.attributes)) {
      add("warning", "W-toggle-wrapper", file, line, "<ToggleButton> with no sized wrapper above it", "it occupies no space of its own and overlaps whatever follows; wrap it in an element at least 16px tall");
    }
  }
}

/**
 * The JSX element a tag at `index` sits directly inside, as `{ name, attributes }`, or null
 * at the root. Read by walking every tag from the top of the file with a stack. It used to be
 * the word `height` anywhere in the 300 characters above the toggle, so an unrelated
 * `const header = { height: 40 }` passed an unsized wrapper, and a `className="h-5"` wrapper
 * that really is sized was reported.
 *
 * A `<` straight after an identifier, `.` or `)` is a type argument -- `useState<Member[]>` --
 * not an element.
 */
function parentElement(text, index, inString) {
  const stack = [];
  const tag = /<(\/?)([A-Za-z][\w.$-]*)?/g;
  for (let match = tag.exec(text); match && match.index < index; match = tag.exec(text)) {
    if (inString(match.index) || /[\w$.)\]]/.test(text[match.index - 1] ?? "")) continue;
    const [, closing, name = ""] = match;
    // With no name, only `<>` and `</>` are elements; `i < n` is a comparison.
    if (!name && text[match.index + match[0].length] !== ">") continue;
    const attributes = tagAttributes(text, match.index + match[0].length);
    if (closing) {
      const at = stack.map((open) => open.name).lastIndexOf(name);
      if (at >= 0) stack.length = at;
    } else if (!attributes.trimEnd().endsWith("/")) {
      stack.push({ name, attributes });
    }
  }
  return stack.at(-1) ?? null;
}

// Tailwind's height utilities: `h-5`, `h-[20px]`, `min-h-4`, `h-px`.
const HEIGHT_UTILITY = /(^|[\s"'`{])(min-)?h-(\d|\[|px\b)/;

/** Whether an element's own attributes give it a height, inline, by utility class or by stylesheet. */
function sizedElement(text, attributes) {
  const style = /\bstyle=\{([\s\S]*)\}/.exec(attributes)?.[1] ?? "";
  if (/\b(min)?[hH]eight\s*:/.test(style)) return true;
  // `style={row}` names an object written elsewhere in the file; read that object.
  const named = /^\s*\{?\s*([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\s*\}?\s*$/.exec(style);
  if (named) {
    const key = named[2] ?? named[1];
    const definition = new RegExp(`\\b${key}\\s*[:=]\\s*\\{([^}]*)\\}`).exec(text);
    if (definition && /\b(min)?[hH]eight\s*:/.test(definition[1])) return true;
  }
  const classes = /\b(?:className)=(?:"[^"]*"|'[^']*'|\{[^}]*\})/.exec(attributes)?.[0] ?? "";
  if (HEIGHT_UTILITY.test(classes)) return true;
  return declaresIn(classes, /(^|[\s;{])(min-)?height\s*:/);
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
 *
 * One pass, in reading order, stepping over strings. It used to be two regexes, block comments
 * first: a line comment ending in `assets/` plus a star opened a "block" that ran to the next
 * block comment's close anywhere in the file and blanked every line between, real imports
 * included — a portal-internal `selectors` import below it went unreported. A string ends at its newline unless it is a template, so an apostrophe in
 * JSX text costs at most the rest of its own line.
 */
// Words after which a quote opens a string even though a letter precedes it.
const BEFORE_EXPRESSION = new Set(["return", "case", "from", "import", "in", "of", "typeof", "void", "throw", "yield", "await", "else", "default", "extends"]);

/**
 * Whether the quote at `at` opens a string literal, or is a character of JSX text. JSX text is
 * not a string -- `<p>It's here</p>` -- and treating its apostrophe as one would hide the rest
 * of the line. A string stands where an expression can: after an operator or an opening
 * bracket, after `=>`, or after a keyword. After a letter, `)`, `]`, `}` or a bare `>` the
 * quote is text: `{name}'s`, `</b>"quoted"`.
 */
function opensString(text, at) {
  if (text[at] === "`") return true;
  let i = at - 1;
  while (i >= 0 && /\s/.test(text[i])) i -= 1;
  if (i < 0) return true;
  const before = text[i];
  if (before === ">") return text[i - 1] === "=";
  if (")]}".includes(before)) return false;
  if (!/[\w$]/.test(before)) return true;
  let start = i;
  while (start > 0 && /[\w$]/.test(text[start - 1])) start -= 1;
  return BEFORE_EXPRESSION.has(text.slice(start, i + 1));
}

/**
 * Comments blanked out, newlines kept so every line number still lands, and where every
 * string literal lies. A file that documents what it does — `<button>` in a JSDoc line
 * explaining why the kit's Button is used instead — was being reported for the thing it was
 * explaining; a file holding a help text that *mentions* a portal-internal import was reported
 * for importing it. Both are matches inside something that is not code.
 *
 * One pass, in reading order. It used to be two regexes, block comments first: a line comment
 * ending in `assets/` plus a star opened a "block" that ran to the next block comment's close
 * anywhere in the file and blanked every line between, real imports included. A string ends at
 * its newline unless it is a template, so a misread quote costs at most the rest of its line.
 */
function scan(text) {
  const out = [];
  const strings = [];
  let copied = 0;
  let quote = null;
  let opened = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote || (char === "\n" && quote !== "`")) {
        strings.push([opened, i]);
        quote = null;
      }
      continue;
    }
    const next = text[i + 1];
    // `:` before `//` is the scheme of a URL written as JSX text, not a comment.
    const lineComment = char === "/" && next === "/" && text[i - 1] !== ":";
    // After a word character or a backslash, `/*` is part of something else -- the `\/*` of a
    // regex, the `image/*` of an accept list in JSX text -- and taking it for a comment hid
    // the rest of the file.
    const blockComment = char === "/" && next === "*" && !/[\w\\]/.test(text[i - 1] ?? "");
    if (lineComment || blockComment) {
      const close = lineComment ? text.indexOf("\n", i) : text.indexOf("*/", i + 2);
      const end = close === -1 ? text.length : lineComment ? close : close + 2;
      out.push(text.slice(copied, i), text.slice(i, end).replace(/[^\n]/g, " "));
      copied = end;
      i = end - 1;
      continue;
    }
    if ((char === '"' || char === "'" || char === "`") && opensString(text, i)) {
      quote = char;
      opened = i;
    }
  }
  if (quote) strings.push([opened, text.length]);
  out.push(text.slice(copied));

  /** Whether `index` falls inside a string literal -- its quotes included. */
  const inString = (index) => {
    let low = 0;
    let high = strings.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const [from, to] = strings[middle];
      if (index < from) high = middle - 1;
      else if (index > to) low = middle + 1;
      else return true;
    }
    return false;
  };
  return { text: out.join(""), inString };
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const { text, inString } = scan(source);
  const lineAt = lineIndex(text);
  const shown = path.relative(projectDir, file).split(path.sep).join("/");
  // How this file spells each kit component it imports (local name → kit name, and the subpath
  // it came from), and the namespaces it imports the kit under (local name → subpath).
  const local = new Map();
  const localSubpath = new Map();
  const namespaces = new Map();
  // A provider counts once its tag is rendered, not once it is imported: an import alone mounts
  // nothing, and a file that imports both and renders neither used to pass as fully provided.
  // TranslationProvider without `translations` installs no i18n context at all, so it mounts
  // nothing; a spread may carry the prop, and is given the benefit of the doubt.
  const noteProvider = (name, subpath, tag, index) => {
    if (name === "ThemeProvider" && subpath !== "components/theme-provider") mounted.add("ThemeProvider");
    if (name === "TranslationProvider") {
      const attributes = tagAttributes(text, index + tag.length + 1);
      if (parseAttributes(attributes).has("translations") || attributes.includes("{...")) mounted.add("TranslationProvider");
    }
  };

  // A re-export — `export { X } from "…"` — is checked like an import: a portal-internal module
  // forwarded from a file of the application's own reaches every file that imports it.
  const statements = [
    [IMPORT_FROM, 2, 1, true],
    [EXPORT_FROM, 2, 1, false],
    [IMPORT_BARE, 1, null, false],
    [REQUIRE_CALL, 1, null, false],
  ];
  for (const [regex, specifierGroup, clauseGroup, binds] of statements) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      if (inString(match.index)) continue;
      const specifier = match[specifierGroup];
      const bindings = clauseGroup ? bindingsOf(match[clauseGroup]) : [];
      checkSpecifier(shown, lineAt(match.index), specifier, bindings, /^(?:import|export)\s+type\s/.test(match[0]));
      const subpath = subpathOf(specifier);
      if (subpath === null) continue;
      usesKit = true;
      if (!binds) continue;
      for (const binding of bindings) {
        if (binding.imported === "*") {
          namespaces.set(binding.local, subpath);
          continue;
        }
        // A default binding is named by the importer, so the component is found by the subpath
        // it came from, not by what the file chose to call it.
        const name =
          binding.imported === "default" ? (bySubpath.get(subpath)?.name ?? binding.local) : binding.imported;
        local.set(binding.local, name);
        localSubpath.set(binding.local, subpath);
      }
    }
  }

  const escape = (name) => name.replace(/[$.]/g, "\\$&");
  const tags = [];
  for (const [localName, kitName] of local) {
    for (const match of text.matchAll(new RegExp(`<${escape(localName)}(?=[\\s/>])`, "g"))) {
      if (inString(match.index)) continue;
      tags.push({ tag: localName, name: kitName, index: match.index });
      noteProvider(kitName, localSubpath.get(localName), localName, match.index);
    }
  }
  for (const [namespace, subpath] of namespaces) {
    for (const match of text.matchAll(new RegExp(`<${escape(namespace)}\\.([A-Za-z_$][\\w$]*)(?=[\\s/>])`, "g"))) {
      if (inString(match.index)) continue;
      tags.push({ tag: `${namespace}.${match[1]}`, name: match[1], index: match.index });
      noteProvider(match[1], subpath, `${namespace}.${match[1]}`, match.index);
    }
  }

  for (const { tag, name, index } of tags) {
    const component = byName.get(name);
    if (component) usedComponents.add(name);
    checkTag(shown, text, lineAt, tag, name, index, component, inString);
  }

  if (local.size || namespaces.size) {
    const raw = [...text.matchAll(/<(?:button|input|select|textarea)\b/g)].find((match) => !inString(match.index));
    if (raw) {
      add("warning", "W-raw-controls", shown, lineAt(raw.index), `a bare <${raw[0].slice(1)}> in a file that uses the kit`, "the kit's own Button, TextInput and Checkbox carry the theme; a bare one does not");
    }
  }

  if (tags.some((found) => found.name === "FieldContainer")) {
    const column = /style=\{\{[^}]*flexDirection:\s*["']column["'][^}]*\}\}/g;
    for (const match of text.matchAll(column)) {
      if (/\bgap\s*:/.test(match[0])) {
        add("warning", "W-fieldcontainer-gap", shown, lineAt(match.index), "a column with a `gap` around FieldContainer fields", "each field already carries margin: 0 0 16px, and the gap adds to it — drop the gap, or pass removeMargin");
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
