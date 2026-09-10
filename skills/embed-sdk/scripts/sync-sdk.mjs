#!/usr/bin/env node
/**
 * Keeps validate-config.mjs in step with the SDK's own types. Reads the type declarations of
 * an SDK checkout or an installed package and derives every dictionary the validator uses:
 * modes, enum values, config keys, filter keys, editorCustomization keys, event names and
 * the boolean fields. No network, no dependencies.
 *
 * Usage:
 *   node sync-sdk.mjs --from <dir> --check    # report differences, exit 1 when any
 *   node sync-sdk.mjs --from <dir> --write    # rewrite the dictionaries in validate-config.mjs
 *   node sync-sdk.mjs --from <dir> --dump     # print the derived dictionaries as JSON
 *
 * <dir> is either the SDK repository root (src/types/index.ts, src/enums/index.ts) or the
 * installed package (dist/types/types/index.d.ts, dist/types/enums/index.d.ts), e.g.
 * node_modules/@onlyoffice/docspace-sdk-js. Without --from the script looks for the package
 * under the current directory's node_modules. The package version is read from package.json
 * next to the types and written into the validator's header and its "targets" message.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "validate-config.mjs");

const args = process.argv.slice(2);
const mode = ["--check", "--write", "--dump"].find((m) => args.includes(m)) ?? "--check";
const fromIdx = args.indexOf("--from");
const from = fromIdx >= 0 ? args[fromIdx + 1] : path.join(process.cwd(), "node_modules", "@onlyoffice", "docspace-sdk-js");

function locate(dir) {
  const candidates = [
    { types: "src/types/index.ts", enums: "src/enums/index.ts" },
    { types: "dist/types/types/index.d.ts", enums: "dist/types/enums/index.d.ts" },
  ];
  for (const c of candidates) {
    const types = path.join(dir, c.types);
    const enums = path.join(dir, c.enums);
    if (existsSync(types) && existsSync(enums)) return { types, enums };
  }
  return null;
}

const located = locate(from);
if (!located) {
  console.error(`ERROR: no SDK types under "${from}" — expected src/types/index.ts + src/enums/index.ts or dist/types/types/index.d.ts + dist/types/enums/index.d.ts`);
  process.exit(2);
}
const typesSrc = readFileSync(located.types, "utf8");
const enumsSrc = readFileSync(located.enums, "utf8");
let version = null;
const pkg = path.join(from, "package.json");
if (existsSync(pkg)) {
  try {
    version = JSON.parse(readFileSync(pkg, "utf8")).version ?? null;
  } catch {
    version = null;
  }
}

function typeBlock(name) {
  const m = typesSrc.match(new RegExp(`export type ${name} = \\{\\n([\\s\\S]*?)\\n\\};`));
  if (!m) throw new Error(`type ${name} not found in ${located.types}`);
  return m[1];
}

function fields(block) {
  const lines = block.split("\n");
  const fieldLine = /^(\s*)([a-zA-Z][a-zA-Z0-9]*)\??:\s*(.*)$/;
  let indent = null;
  const out = [];
  for (const line of lines) {
    const m = line.match(fieldLine);
    if (!m) continue;
    if (indent === null) indent = m[1].length;
    if (m[1].length !== indent) continue;
    out.push({ name: m[2], type: m[3].replace(/;\s*$/, "").trim() });
  }
  return out;
}

function enumValues(name) {
  const m = enumsSrc.match(new RegExp(`export (?:declare )?(?:const )?enum ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`enum ${name} not found in ${located.enums}`);
  return [...m[1].matchAll(/=\s*"([^"]+)"/g)].map((x) => x[1]);
}

function union(name) {
  const m = typesSrc.match(new RegExp(`export type ${name} = ([^;]+);`));
  if (!m) throw new Error(`type ${name} not found in ${located.types}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const config = fields(typeBlock("TFrameConfig"));
const derived = {
  MODES: enumValues("SDKMode"),
  ENUMS: {
    theme: enumValues("Theme"),
    viewAs: enumValues("ManagerViewMode"),
    selectorType: enumValues("SelectorFilterType"),
    editorType: enumValues("EditorType"),
    type: enumValues("EditorType"),
    showHeaderBanner: enumValues("HeaderBannerDisplaying"),
    destination: union("TFormsSection"),
    personalDestination: union("TPersonalSection"),
  },
  FILTER_ENUMS: {
    sortBy: enumValues("FilterSortBy"),
    sortOrder: enumValues("FilterSortOrder"),
  },
  BOOLEAN_FIELDS: config.filter((f) => /\bboolean\b/.test(f.type) && !/\bstring\b/.test(f.type)).map((f) => f.name),
  KNOWN_KEYS: config.map((f) => f.name),
  KNOWN_FILTER_KEYS: fields(typeBlock("TFrameFilter")).map((f) => f.name),
  KNOWN_CUSTOMIZATION_KEYS: fields(typeBlock("TEditorCustomization")).map((f) => f.name),
  KNOWN_EVENTS: fields(typeBlock("TFrameEvents")).map((f) => f.name),
};

if (mode === "--dump") {
  console.log(JSON.stringify({ version, source: located, ...derived }, null, 2));
  process.exit(0);
}

let validator = readFileSync(VALIDATOR, "utf8");

function arrayLiteral(text, name) {
  const m = text.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
}

function objectArrays(text, name) {
  const m = text.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`));
  if (!m) return null;
  const out = {};
  for (const e of m[1].matchAll(/^\s*([a-zA-Z]+):\s*\[([\s\S]*?)\]/gm)) {
    out[e[1]] = [...e[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  return out;
}

const current = {
  MODES: arrayLiteral(validator, "MODES"),
  ENUMS: objectArrays(validator, "ENUMS"),
  FILTER_ENUMS: objectArrays(validator, "FILTER_ENUMS"),
  BOOLEAN_FIELDS: arrayLiteral(validator, "BOOLEAN_FIELDS"),
  KNOWN_KEYS: arrayLiteral(validator, "KNOWN_KEYS"),
  KNOWN_FILTER_KEYS: arrayLiteral(validator, "KNOWN_FILTER_KEYS"),
  KNOWN_CUSTOMIZATION_KEYS: arrayLiteral(validator, "KNOWN_CUSTOMIZATION_KEYS"),
  KNOWN_EVENTS: arrayLiteral(validator, "KNOWN_EVENTS"),
};

function diff(label, want, have) {
  const w = new Set(want);
  const h = new Set(have ?? []);
  const missing = want.filter((x) => !h.has(x));
  const stale = (have ?? []).filter((x) => !w.has(x));
  if (!missing.length && !stale.length) return null;
  return `${label}: ${missing.length ? `missing ${missing.join(", ")}` : ""}${missing.length && stale.length ? "; " : ""}${stale.length ? `stale ${stale.join(", ")}` : ""}`;
}

const problems = [];
for (const key of ["MODES", "BOOLEAN_FIELDS", "KNOWN_KEYS", "KNOWN_FILTER_KEYS", "KNOWN_CUSTOMIZATION_KEYS", "KNOWN_EVENTS"]) {
  const d = diff(key, derived[key], current[key]);
  if (d) problems.push(d);
}
for (const group of ["ENUMS", "FILTER_ENUMS"]) {
  for (const [k, want] of Object.entries(derived[group])) {
    const d = diff(`${group}.${k}`, want, current[group]?.[k]);
    if (d) problems.push(d);
  }
}
const versionInHeader = validator.match(/@onlyoffice\/docspace-sdk-js \(([0-9.]+)\)/)?.[1] ?? null;
if (version && versionInHeader && version !== versionInHeader) {
  problems.push(`version: validator says ${versionInHeader}, types say ${version}`);
}

if (mode === "--check") {
  if (!problems.length) {
    console.log(`OK: validate-config.mjs matches the SDK types${version ? ` (${version})` : ""}`);
    process.exit(0);
  }
  for (const p of problems) console.log(`DIFF: ${p}`);
  console.log(`${problems.length} difference(s) — run with --write to update the validator`);
  process.exit(1);
}

function formatArray(values) {
  const lines = [];
  let line = " ";
  for (const v of values) {
    const item = ` "${v}",`;
    if ((line + item).length > 92) {
      lines.push(line);
      line = " " + item;
    } else {
      line += item;
    }
  }
  lines.push(line);
  return `\n${lines.join("\n")}\n`;
}

function replaceArray(text, name, values) {
  return text.replace(new RegExp(`(const ${name} = \\[)[\\s\\S]*?(\\];)`), (_, a, b) => `${a}${formatArray(values)}${b}`);
}

function replaceObjectArrays(text, name, obj) {
  return text.replace(new RegExp(`(const ${name} = \\{)[\\s\\S]*?(\\n\\};)`), (_, a, b) => {
    const body = Object.entries(obj).map(([k, v]) => `  ${k}: [${v.map((x) => `"${x}"`).join(", ")}],`).join("\n");
    return `${a}\n${body}${b}`;
  });
}

for (const key of ["MODES", "BOOLEAN_FIELDS", "KNOWN_KEYS", "KNOWN_FILTER_KEYS", "KNOWN_CUSTOMIZATION_KEYS", "KNOWN_EVENTS"]) {
  validator = replaceArray(validator, key, derived[key]);
}
validator = replaceObjectArrays(validator, "ENUMS", derived.ENUMS);
validator = replaceObjectArrays(validator, "FILTER_ENUMS", derived.FILTER_ENUMS);
if (version) {
  validator = validator.replace(/(@onlyoffice\/docspace-sdk-js \()[0-9.]+(\))/, `$1${version}$2`);
  validator = validator.replace(/(this dictionary targets )[0-9.]+/, `$1${version}`);
  validator = validator.replace(/(silently ignored by SDK )[0-9.]+/, `$1${version}`);
}
writeFileSync(VALIDATOR, validator);
console.log(`validate-config.mjs rewritten from ${located.types}${version ? ` (${version})` : ""}: ${problems.length ? problems.join("; ") : "no dictionary changes"}`);
