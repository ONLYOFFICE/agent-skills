#!/usr/bin/env node
// Validates an ONLYOFFICE Docs editor plugin folder: config.json, the files it names, how its pages
// load the plugin runtime, and whether the events its scripts listen for can reach them.
//
//   node validate-plugin.mjs <plugin-dir> [--json]
//
// Levels: `error` - the editor will not load or show the plugin as written, or a listener never
// fires; `warning` - works, probably not as meant; `marketplace` - runs, but a marketplace listing
// needs it. Exit code 1 when there is an error. Node only, no dependencies, no network.

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EDITORS = new Set(["word", "cell", "slide", "pdf"]);
const KINDS = new Set(["window", "panel", "panelRight", "background", "system", "invisible", "unvisible"]);
const KINDS_FROM_8_1 = new Set(["panelRight", "background"]);
const RUNTIME_URL = "https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js";
// Fields something reads: the config.json schema of @onlyoffice/doceditor-plugin-types, sdkjs
// common/apiCommon.js (CPlugin and CPluginVariation deserialize) and web-apps' Plugins controller.
// Anything else is ignored by the editor - usually a typo or an invented field.
const KNOWN_ROOT = new Set([
  "$schema", "baseUrl", "group", "groupName", "groupRank", "guid", "help", "isConnector", "loader",
  "minVersion", "name", "nameLocale", "offered", "onlyofficeScheme", "variations", "version",
]);
const KNOWN_VARIATION = new Set([
  "autostart", "buttons", "cryptoDisabledForExternalCloud", "cryptoDisabledForInternalCloud", "cryptoDisabledOnStart",
  "cryptoMode", "description", "descriptionLocale", "disableReasons", "dockedPlace", "EditorsSupport", "events",
  "fixedSize", "help", "hiddenHeaderButtons", "icons", "icons2", "index", "initData", "initDataType",
  "initOnSelectionChanged", "isActivated", "isCanDocked", "isCustomWindow", "isDisplayedInViewer", "isInsideMode",
  "isModal", "isSystem", "isTargeted", "isUpdateOleOnResize", "isViewer", "isVisual", "menu", "methods", "name",
  "nameLocale", "positionX", "positionY", "screens", "size", "store", "transparent", "type", "url",
]);
const SCALES = ["100%", "125%", "150%", "175%", "200%"];

// Events the editor itself sends, which reach a handler stored by attachEvent only when declared in
// "events". From the plugin-window events and the per-editor events of @onlyoffice/doceditor-plugin-types.
const EDITOR_EVENTS = new Set([
  "onContextMenuShow", "onContextMenuClick", "onToolbarMenuClick", "onWindowHeaderMenuClick",
  "onTargetPositionChanged", "onDocumentContentReady", "onClick", "onChangeRestrictions",
  "onFloatActionButtonClick", "onChangeToolbarDisableReasons", "onInputHelperInput", "onInputHelperClear",
  "onAddComment", "onChangeCommentData", "onRemoveComment", "onChangeCurrentPage", "onChangeCurrentSheet",
  "onChangeCurrentSlide", "onFocusContentControl", "onBlurContentControl", "onChangeContentControl",
  "onShowContentControlTrack", "onHideContentControlTrack", "onInsertOleObjects", "onSubmitForm",
  "onParagraphText", "onFocusAnnotation", "onBlurAnnotation", "onClickAnnotation",
  "onSlideShowBegin", "onSlideShowEnd", "onSlideShowNextSlide", "onSlideShowSlideChanged",
  "onSelectionEnd", "onSelectionCancel",
]);
const LIBRARY_PATH = /(^|\/)(vendor|vendors|lib|libs|third[-_]?party|node_modules|dist)\/|\.min\.js$|(^|\/)v1\/plugins(-ui)?\.js$/i;

/**
 * @typedef {{ level: "error" | "warning" | "marketplace", code: string, where: string, message: string }} Finding
 * @param {string} dir
 * @returns {Finding[]}
 */
export function validatePlugin(dir) {
  /** @type {Finding[]} */
  const out = [];
  const add = (level, code, where, message) => out.push({ level, code, where, message });

  const configPath = path.join(dir, "config.json");
  if (!existsSync(configPath)) {
    add("error", "no-config", "config.json", "missing - a plugin folder needs config.json at its root");
    return out;
  }
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8").replace(/^﻿/, ""));
  } catch (e) {
    add("error", "bad-json", "config.json", `not valid JSON: ${e.message}`);
    return out;
  }

  // Root fields.
  for (const field of ["name", "guid"]) {
    if (typeof config[field] !== "string" || !config[field]) add("error", "missing-field", "config.json", `missing "${field}"`);
  }
  if (typeof config.guid === "string" && !/^asc\.\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/i.test(config.guid)) {
    add("warning", "guid-format", "guid", "expected asc.{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}");
  }
  for (const field of ["version", "minVersion", "offered"]) {
    if (config[field] === undefined) add("marketplace", "listing-field", "config.json", `missing "${field}" - the editor runs without it, a marketplace listing needs it`);
  }
  for (const field of ["version", "minVersion"]) {
    if (typeof config[field] === "string" && !/^\d+\.\d+\.\d+$/.test(config[field])) add("warning", "version-format", field, 'expected three numbers, e.g. "1.0.0"');
  }
  for (const key of Object.keys(config)) {
    if (!KNOWN_ROOT.has(key)) add("warning", "unknown-field", "config.json", `"${key}" is not a field the editor reads; it is ignored${hint(key, KNOWN_ROOT)}`);
  }

  // What the plugin manager shows besides config.json.
  const langsPath = path.join(dir, "translations", "langs.json");
  if (!existsSync(langsPath)) {
    add("marketplace", "no-langs", "translations/langs.json", 'missing - the plugin manager reads the languages from it; [] when the plugin ships English only (English is always listed, "en-EN" need not be)');
  } else {
    try {
      if (!Array.isArray(JSON.parse(readFileSync(langsPath, "utf8").replace(/^﻿/, "")))) throw new Error("not an array");
    } catch (e) {
      add("marketplace", "bad-langs", "translations/langs.json", `must be a JSON array of codes such as "de-DE" (${e.message})`);
    }
  }
  if (!existsSync(path.join(dir, "README.md"))) add("marketplace", "no-readme", "README.md", "missing - the plugin manager shows it to users deciding whether to install");
  if (!existsSync(path.join(dir, "CHANGELOG.md"))) add("marketplace", "no-changelog", "CHANGELOG.md", "missing - the plugin manager shows what changed before an update");

  const variations = Array.isArray(config.variations) ? config.variations : [];
  if (!variations.length) {
    add("error", "no-variations", "variations", "missing or empty - the plugin has nothing to start");
    return out;
  }
  const withStore = variations.filter((v) => v && typeof v === "object" && v.store);
  if (withStore.length !== 1) add("marketplace", "store-count", "variations", `${withStore.length} variations carry "store"; a marketplace listing reads exactly one`);

  const events = new Set(variations.flatMap((v) => (Array.isArray(v?.events) ? v.events : [])));
  const minVersion = typeof config.minVersion === "string" ? config.minVersion : null;

  variations.forEach((v, i) => {
    const at = `variations[${i}]`;
    if (!v || typeof v !== "object") return add("error", "bad-variation", at, "must be an object");
    for (const key of Object.keys(v)) {
      if (!KNOWN_VARIATION.has(key)) add("warning", "unknown-field", at, `"${key}" is not a field the editor reads; it is ignored${hint(key, KNOWN_VARIATION)}`);
    }
    for (const field of ["description", "url"]) if (typeof v[field] !== "string") add("error", "missing-field", at, `missing "${field}"`);
    if (!Array.isArray(v.EditorsSupport) || !v.EditorsSupport.length) {
      add("error", "missing-field", at, 'missing "EditorsSupport" - the editors the button exists in');
    } else {
      for (const e of v.EditorsSupport) if (!EDITORS.has(e)) add("error", "unknown-editor", `${at}.EditorsSupport`, `"${e}" is not one of word, cell, slide, pdf`);
    }

    // Kind: "type" from 8.1.0, the flags before.
    if (v.type !== undefined && !KINDS.has(v.type)) add("error", "unknown-type", `${at}.type`, `"${v.type}" is not a plugin type`);
    if (v.type === undefined && v.isVisual === undefined && v.isSystem !== true) {
      add("error", "invisible", at, 'neither "type" nor "isVisual" is set, so the editor starts it as an invisible plugin with no window');
    }
    if (KINDS_FROM_8_1.has(v.type) && (!minVersion || compareVersions(minVersion, "8.1.0") < 0)) {
      add("warning", "type-needs-8.1", `${at}.type`, `"${v.type}" is read from 8.1.0; older editors place the plugin by its isVisual/isInsideMode flags. Set minVersion to "8.1.0" or later`);
    }
    if (["panel", "window", "panelRight"].includes(v.type) && v.isVisual === undefined && (!minVersion || compareVersions(minVersion, "8.1.0") < 0)) {
      add("warning", "type-without-flags", at, `"type" alone is ignored before 8.1.0, where this plugin then runs invisible; also set isVisual/isInsideMode/isModal`);
    }

    // Files the variation names.
    const iconLevel = i === 0 ? "error" : "warning";
    const missing = (where, rel, what, level = "error") => {
      if (typeof rel !== "string" || /^(https?:)?\/\//.test(rel)) return;
      if (!existsSync(path.join(dir, filePart(rel)))) add(level, "missing-file", where, `${what} "${rel}" does not exist`);
    };
    missing(`${at}.url`, v.url, "page");
    for (const [where, rel] of iconPaths(v.icons, `${at}.icons`)) missing(where, rel, "icon", iconLevel);
    for (const [where, rel] of iconPaths(v.icons2, `${at}.icons2`)) missing(where, rel, "icon", iconLevel);
    if (i === 0) {
      const coverage = iconCoverage(v);
      for (const theme of ["light", "dark"]) {
        const have = coverage.get(theme);
        if (!have || !have.size) {
          add("marketplace", "icon-coverage", `${at}.icons2`, `no ${theme}-theme toolbar icons - the button needs both themes at every scale (${SCALES.join(", ")})`);
          continue;
        }
        const absent = SCALES.filter((s) => !have.has(s));
        if (absent.length) add("marketplace", "icon-coverage", `${at}.icons2`, `${theme}-theme toolbar icons lack ${absent.join(", ")}`);
      }
    }
    if (v.store && typeof v.store === "object") {
      for (const field of ["background", "icons", "screenshots"]) {
        if (v.store[field] === undefined) add("marketplace", "listing-field", `${at}.store`, `missing "${field}"`);
      }
      for (const theme of ["light", "dark"]) {
        const folder = v.store.icons?.[theme];
        missing(`${at}.store.icons.${theme}`, folder, "store icon folder", "marketplace");
        if (typeof folder === "string" && existsSync(path.join(dir, folder))) {
          const absent = SCALES.map(scaleFile).filter((f) => !existsSync(path.join(dir, folder, f)));
          if (absent.length) add("marketplace", "store-icon-scales", `${at}.store.icons.${theme}`, `"${folder}" lacks ${absent.join(", ")} - the plugin manager card needs every scale`);
        }
      }
      (Array.isArray(v.store.screenshots) ? v.store.screenshots : []).forEach((s, n) => missing(`${at}.store.screenshots[${n}]`, s, "screenshot", "marketplace"));
    }

    // How the page loads the runtime.
    if (typeof v.url === "string" && !/^(https?:)?\/\//.test(v.url) && existsSync(path.join(dir, filePart(v.url)))) {
      const sources = scriptSources(readFileSync(path.join(dir, filePart(v.url)), "utf8"));
      const runtime = sources.filter((s) => /(^|\/)plugins\.js(\?|$)/.test(s));
      if (!runtime.length) add("error", "no-runtime", `${at}.url`, `the page does not load plugins.js, so window.Asc.plugin never exists; load ${RUNTIME_URL}`);
      for (const s of runtime.filter((s) => !/^(https?:)?\/\//.test(s))) {
        add("error", "relative-runtime", `${at}.url`, `loads plugins.js from "${s}", which exists only inside the marketplace repository; load ${RUNTIME_URL}`);
      }
    }
  });

  // What the plugin's own scripts listen for. A page a variation names is the plugin; any other page
  // is a window the plugin opens, whose Asc.plugin.attachEvent hears the plugin, not the editor.
  const mainPages = new Set(variations.map((v) => v?.url).filter((u) => typeof u === "string").map((u) => path.posix.normalize(filePart(u))));
  for (const { file, main } of pluginScripts(dir, mainPages)) {
    const code = readFileSync(path.join(dir, file), "utf8");
    const line = (index) => code.slice(0, index).split("\n").length;
    const at = (index) => `${file}:${line(index)}`;

    for (const m of code.matchAll(/attachEditorEvent\(\s*["'](onContextMenuClick|onToolbarMenuClick)["']/g)) {
      add("error", "router-replaced", at(m.index), `attachEditorEvent("${m[1]}") replaces the runtime's click router; per-item handlers never run again. List "${m[1]}" in "events" and use attach${m[1] === "onContextMenuClick" ? "ContextMenu" : "ToolbarMenu"}ClickEvent only`);
    }
    for (const [method, event] of [["attachContextMenuClickEvent", "onContextMenuClick"], ["attachToolbarMenuClickEvent", "onToolbarMenuClick"]]) {
      const m = code.match(new RegExp(`${method}\\s*\\(`));
      if (m && !events.has(event)) add("error", "click-event-undeclared", at(m.index), `${method} is used, but "${event}" is not in any variation's "events" - the editor never sends the click`);
    }
    // Only the plugin's own attachEvent: a PluginWindow's attachEvent ("onWindowReady", ...) is the
    // message channel with a window the plugin opened, not an editor event.
    // Any other name is the plugin's own message from a window it opened (sendToPlugin), which
    // needs no declaration.
    for (const m of main ? code.matchAll(/Asc\.plugin\.attachEvent\(\s*["'](on\w+)["']/g) : []) {
      if (!EDITOR_EVENTS.has(m[1])) continue;
      if (!events.has(m[1]) && !new RegExp(`attachEditorEvent\\(\\s*["']${m[1]}["']`).test(code)) {
        add("warning", "event-undeclared", at(m.index), `attachEvent("${m[1]}") registers nothing with the editor; list "${m[1]}" in "events" or use attachEditorEvent`);
      }
    }
    for (const m of code.matchAll(/executeMethod\(\s*["']((?:Add|Update)(?:ContextMenu|ToolbarMenu)Item)["']\s*,\s*\[\s*\[/g)) {
      add("error", "menu-array", at(m.index), `${m[1]} takes one object ({ guid, ${m[1].includes("Toolbar") ? "tabs" : "items"} }) inside the argument array, not an array of them`);
    }
  }

  return out;
}

// A page or icon path as the editor fetches it: a cache-busting ?query or #hash names no file.
const filePart = (rel) => rel.replace(/[?#].*$/, "");

/**
 * Local scripts the plugin's pages load, minus libraries; `main` when a page a variation names loads it.
 * @returns {{ file: string, main: boolean }[]}
 */
function pluginScripts(dir, mainPages) {
  const found = new Map();
  for (const page of walk(dir).filter((f) => f.endsWith(".html"))) {
    for (const src of scriptSources(readFileSync(path.join(dir, page), "utf8"))) {
      if (/^(https?:)?\/\//.test(src) || src.startsWith("data:")) continue;
      const rel = path.posix.normalize(path.posix.join(path.posix.dirname(page), src.split(/[?#]/)[0]));
      if (rel.startsWith("..") || LIBRARY_PATH.test(rel) || !/\.m?js$/.test(rel)) continue;
      const abs = path.join(dir, rel);
      if (existsSync(abs) && statSync(abs).size <= 300 * 1024) found.set(rel, found.get(rel) || mainPages.has(page));
    }
  }
  return [...found].sort(([a], [b]) => a.localeCompare(b)).map(([file, main]) => ({ file, main }));
}

function scriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1].replace(/\\\//g, "/"));
}

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(dir, rel));
    else out.push(rel);
  }
  return out;
}

/** Every icon path in `icons`/`icons2`; string templates expanded the way the editor expands them. */
function iconPaths(value, where) {
  const out = [];
  const visit = (node, at) => {
    if (typeof node === "string") for (const file of expandIconTemplate(node)) out.push([at, file]);
    else if (Array.isArray(node)) node.forEach((item, i) => visit(item, `${at}[${i}]`));
    else if (node && typeof node === "object") {
      for (const [key, item] of Object.entries(node)) if (key !== "style" && key !== "theme") visit(item, /^\w+$/.test(key) ? `${at}.${key}` : `${at}["${key}"]`);
    }
  };
  visit(value, where);
  return out;
}

/**
 * `resources/%theme-type%(light|dark)/icon%scale%(default).%extension%(png)` -> the files it stands
 * for: each `%name%(a|b)` takes every value, `default` scales are 100-200%, 100% adds nothing and
 * the others `@1.25x`..., the `normal` state adds nothing and the others `_hover`. A `*` scale names
 * no single file.
 */
export function expandIconTemplate(template) {
  if (!template.includes("%")) return [template];
  const param = (name, fallback) => {
    const m = new RegExp(`%${name}%\\(([^)]*)\\)`).exec(template);
    return m ? { token: m[0], at: m.index, values: m[1].split("|") } : { token: "", at: -1, values: fallback };
  };
  const themeName = param("theme-name", [""]);
  const themeType = param("theme-type", [""]);
  const state = param("state", ["normal"]);
  const scale = param("scale", ["100"]);
  const extension = param("extension", []);
  const scales = scale.values.flatMap((v) => (v === "default" ? ["100", "125", "150", "175", "200"] : [v.replace(/%$/, "")]));
  const raster = extension.values.filter((v) => v !== "svg");
  const ext = raster.length ? raster[raster.length - 1] : extension.values.includes("svg") ? "svg" : "";
  const scaleBase = scale.at > 0 && template[scale.at - 1] === "/" ? "icon" : "";
  const out = [];
  for (const name of themeName.values) {
    for (const type of themeType.values) {
      for (const s of scales) {
        if (s === "*" || s === "") continue;
        const n = Number.parseInt(s, 10);
        const suffix = n === 100 ? "" : `@${String(n / 100).replace(/0+$/, "").replace(/\.$/, "")}x`;
        let url = template;
        if (themeName.token) url = url.split(themeName.token).join(name);
        if (themeType.token) url = url.split(themeType.token).join(type);
        if (scale.token) url = url.split(scale.token).join(scaleBase + suffix);
        if (extension.token) url = url.split(extension.token).join(ext);
        for (const st of state.values) {
          if (!state.token) out.push(url);
          else if (st === "normal") out.push(url.replace(state.token, "").replace("//", "/"));
          else out.push(url.replace(state.token, `_${st}`));
        }
      }
    }
  }
  return [...new Set(out)];
}

/**
 * Which theme has toolbar icons at which scale, from `icons2` (objects or templates) and an `icons`
 * template. A plain `icons` array is the legacy light set and counts for nothing here.
 * @returns {Map<string, Set<string>>}
 */
function iconCoverage(v) {
  const coverage = new Map([["light", new Set()], ["dark", new Set()]]);
  const addScales = (themes, scales) => {
    for (const t of themes) for (const s of scales) coverage.get(t)?.add(s);
  };
  // A vector icon serves every scale, so an SVG counts for all of them.
  const isSvg = (p) => typeof p === "string" && /\.svg$|%extension%\([^)]*\bsvg\b/i.test(p);
  const fromTemplate = (template) => {
    const values = (name) => new RegExp(`%${name}%\\(([^)]*)\\)`).exec(template)?.[1].split("|");
    const themes = values("theme-type") ?? ["light", "dark"];
    const raw = values("scale") ?? (isSvg(template) ? ["*"] : ["100"]);
    const scales = raw.flatMap((s) => (s === "default" || s === "*" || isSvg(template) ? SCALES : [`${s.replace(/%$/, "")}%`]));
    addScales(themes, scales);
  };
  if (typeof v.icons === "string") fromTemplate(v.icons);
  for (const entry of Array.isArray(v.icons2) ? v.icons2 : []) {
    if (typeof entry === "string") fromTemplate(entry);
    else if (entry && typeof entry === "object") {
      const themes = entry.style ? [entry.style] : ["light", "dark"];
      const sets = Object.entries(entry).filter(([k, val]) => (k === "default" || SCALES.includes(k)) && val?.normal);
      const scales = sets.some(([k, val]) => k === "default" || isSvg(val.normal)) ? SCALES : sets.map(([k]) => k);
      addScales(themes, scales);
    }
  }
  return coverage;
}

/** The file name a scale uses: icon.png at 100%, icon@1.25x.png and so on. */
function scaleFile(scale) {
  const n = Number.parseInt(scale, 10);
  return n === 100 ? "icon.png" : `icon@${String(n / 100).replace(/0+$/, "").replace(/\.$/, "")}x.png`;
}

/** "; did you mean X?" for a known name that differs only in case. */
function hint(key, known) {
  const match = [...known].find((k) => k.toLowerCase() === key.toLowerCase());
  return match ? `; did you mean "${match}"?` : "";
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir || dir.startsWith("--")) {
    console.error("usage: node validate-plugin.mjs <plugin-dir> [--json]");
    process.exit(2);
  }
  const findings = validatePlugin(path.resolve(dir));
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(findings, null, 2));
  } else if (!findings.length) {
    console.log("ok: no findings");
  } else {
    const order = { error: 0, warning: 1, marketplace: 2 };
    for (const f of findings.sort((a, b) => order[a.level] - order[b.level])) console.log(`${f.level.padEnd(11)} ${f.where}: ${f.message}`);
  }
  process.exit(findings.some((f) => f.level === "error") ? 1 : 0);
}
