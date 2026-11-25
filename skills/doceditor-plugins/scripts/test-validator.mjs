#!/usr/bin/env node
/**
 * Self-test for validate-plugin.mjs: writes a known-good plugin folder and one broken variant per
 * rule into a temporary directory, runs the validator over each, and asserts the exit code and the
 * finding codes that matter. Also checks the icon-template expansion. No network. Exit code 1 when
 * any expectation fails.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { expandIconTemplate } from "./validate-plugin.mjs";

const VALIDATOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "validate-plugin.mjs");
const RUNTIME = "https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js";

const SCALE_FILES = { "100%": "icon.png", "125%": "icon@1.25x.png", "150%": "icon@1.5x.png", "175%": "icon@1.75x.png", "200%": "icon@2x.png" };

const ICONS2 = ["light", "dark"].map((style) => ({
  style,
  ...Object.fromEntries(Object.entries(SCALE_FILES).map(([scale, file]) => [scale, { normal: `resources/${style}/${file}` }])),
}));

/** Every icon file the good config names, as empty files - the validator checks existence only. */
const ICON_FILES = Object.fromEntries(
  ["resources/light", "resources/dark", "resources/store/icons"].flatMap((folder) => Object.values(SCALE_FILES).map((file) => [`${folder}/${file}`, ""])),
);

function goodConfig() {
  return {
    name: "Signature block",
    guid: "asc.{2F1C3B8E-6D0A-4C59-9E2B-7A1D5F3C8B40}",
    version: "1.0.0",
    minVersion: "8.1.0",
    offered: "Example Ltd",
    variations: [
      {
        description: "Adds our signature block from the context menu.",
        url: "index.html",
        icons: ["resources/light/icon.png", "resources/light/icon@2x.png"],
        icons2: structuredClone(ICONS2), // a fresh copy: cases edit it
        EditorsSupport: ["word"],
        type: "background",
        isVisual: false,
        isModal: false,
        isInsideMode: false,
        initDataType: "none",
        events: ["onContextMenuShow", "onContextMenuClick"],
        store: {
          background: { light: "#F5F5F5", dark: "#444444" },
          icons: { light: "resources/store/icons", dark: "resources/store/icons" },
          screenshots: ["resources/store/screenshots/screen_1.png"],
        },
      },
    ],
  };
}

const GOOD_HTML = `<!DOCTYPE html><html><head><script src="${RUNTIME}"></script><script src="scripts/code.js"></script></head><body></body></html>`;

const GOOD_CODE = `
window.Asc.plugin.attachEvent("onContextMenuShow", function (options) {
  const items = options.type === "Selection" ? [{ id: "sign", text: "Insert signature" }] : [];
  window.Asc.plugin.executeMethod("AddContextMenuItem", [{ guid: window.Asc.plugin.info.guid, items: items }]);
});
window.Asc.plugin.attachContextMenuClickEvent("sign", function () {});
`;

/** Writes a plugin folder; `change` edits the config, the page or the code before writing. */
function plugin(change = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "docs-plugin-"));
  const config = goodConfig();
  change.config?.(config);
  const files = {
    "config.json": JSON.stringify(config, null, 2),
    "index.html": change.html ?? GOOD_HTML,
    "scripts/code.js": change.code ?? GOOD_CODE,
    "translations/langs.json": '["de-DE"]',
    "README.md": "# Signature block\n",
    "CHANGELOG.md": "# Change Log\n",
    ...ICON_FILES,
    "resources/store/screenshots/screen_1.png": "",
    ...(change.files ?? {}),
  };
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

function run(dir) {
  const r = spawnSync(process.execPath, [VALIDATOR, dir, "--json"], { encoding: "utf8" });
  let findings = [];
  try {
    findings = JSON.parse(r.stdout);
  } catch {
    findings = [{ level: "error", code: "unparsable-output", where: "", message: `${r.stdout}${r.stderr}` }];
  }
  return { code: r.status, findings };
}

const CASES = [
  // --- should pass --------------------------------------------------------------------------
  { name: "a complete background plugin has no findings", change: {}, exit: 0, codes: [] },
  {
    name: "attachEditorEvent registers onContextMenuShow without \"events\"",
    change: {
      config: (c) => { c.variations[0].events = ["onContextMenuClick"]; },
      code: GOOD_CODE.replace('attachEvent("onContextMenuShow"', 'attachEditorEvent("onContextMenuShow"'),
    },
    exit: 0,
    codes: [],
  },
  {
    name: "an icon template expands to files that exist",
    change: { config: (c) => { c.variations[0].icons = "resources/%theme-type%(light|dark)/icon%scale%(100|200).%extension%(png)"; } },
    exit: 0,
    codes: [],
  },
  // --- config.json ----------------------------------------------------------------------------
  { name: "invalid JSON", change: { files: { "config.json": "{ \"name\": " } }, exit: 1, codes: ["bad-json"] },
  { name: "no type and no isVisual runs invisible", change: { config: (c) => { delete c.variations[0].type; delete c.variations[0].isVisual; } }, exit: 1, codes: ["invisible"] },
  { name: "unknown editor", change: { config: (c) => { c.variations[0].EditorsSupport = ["docx"]; } }, exit: 1, codes: ["unknown-editor"] },
  { name: "background below 8.1.0 warns", change: { config: (c) => { c.minVersion = "7.4.0"; } }, exit: 0, codes: ["type-needs-8.1"] },
  {
    name: "a panel with \"type\" only warns on old editors",
    change: { config: (c) => { const v = c.variations[0]; c.minVersion = "7.0.0"; v.type = "panel"; delete v.isVisual; delete v.isModal; delete v.isInsideMode; } },
    exit: 0,
    codes: ["type-without-flags"],
  },
  { name: "malformed guid warns", change: { config: (c) => { c.guid = "my-plugin"; } }, exit: 0, codes: ["guid-format"] },
  { name: "missing listing fields are marketplace findings", change: { config: (c) => { delete c.offered; delete c.version; } }, exit: 0, codes: ["listing-field"] },
  { name: "an unknown field warns and names the field it likely meant", change: { config: (c) => { c.variations[0].isviewer = true; c.author = "x"; } }, exit: 0, codes: ["unknown-field"] },
  { name: "fields the editor reads but the schema lacks are known", change: { config: (c) => { c.variations[0].autostart = true; c.variations[0].hiddenHeaderButtons = []; c.groupName = "x"; } }, exit: 0, codes: [] },
  // --- what the plugin manager shows ----------------------------------------------------------
  { name: "missing langs.json", change: { files: { "translations/langs.json": null } }, exit: 0, codes: ["no-langs"] },
  { name: "langs.json without en-EN is fine - English is always listed", change: { files: { "translations/langs.json": "[]" } }, exit: 0, codes: [] },
  { name: "langs.json that is not an array", change: { files: { "translations/langs.json": "{}" } }, exit: 0, codes: ["bad-langs"] },
  { name: "missing README.md and CHANGELOG.md", change: { files: { "README.md": null, "CHANGELOG.md": null } }, exit: 0, codes: ["no-readme", "no-changelog"] },
  {
    name: "no dark-theme toolbar icons",
    change: { config: (c) => { c.variations[0].icons2 = c.variations[0].icons2.filter((s) => s.style === "light"); } },
    exit: 0,
    codes: ["icon-coverage"],
  },
  {
    name: "toolbar icons missing a scale",
    change: { config: (c) => { for (const s of c.variations[0].icons2) delete s["175%"]; } },
    exit: 0,
    codes: ["icon-coverage"],
  },
  {
    name: "one SVG per theme covers every scale",
    change: {
      config: (c) => { const v = c.variations[0]; v.icons = "resources/%theme-type%(light|dark)/icon.svg"; delete v.icons2; },
      files: { "resources/light/icon.svg": "", "resources/dark/icon.svg": "" },
    },
    exit: 0,
    codes: [],
  },
  { name: "store icons missing a scale", change: { files: { "resources/store/icons/icon@1.75x.png": null } }, exit: 0, codes: ["store-icon-scales"] },
  // --- files ------------------------------------------------------------------------------------
  { name: "missing toolbar icon of the first variation", change: { files: { "resources/dark/icon@2x.png": null } }, exit: 1, codes: ["missing-file"] },
  { name: "missing page", change: { files: { "index.html": null } }, exit: 1, codes: ["missing-file"] },
  // --- the page ---------------------------------------------------------------------------------
  {
    name: "a page url with a ?query names the file before it",
    change: { config: (c) => { c.variations[0].url = "index.html?v=1.0.0"; } },
    exit: 0,
    codes: [],
  },
  { name: "relative plugins.js", change: { html: GOOD_HTML.replace(RUNTIME, "../v1/plugins.js") }, exit: 1, codes: ["relative-runtime"] },
  { name: "no plugins.js at all", change: { html: '<html><head><script src="scripts/code.js"></script></head></html>' }, exit: 1, codes: ["no-runtime"] },
  // --- the scripts ------------------------------------------------------------------------------
  { name: "click handler without onContextMenuClick in events", change: { config: (c) => { c.variations[0].events = ["onContextMenuShow"]; } }, exit: 1, codes: ["click-event-undeclared"] },
  {
    name: "attachEditorEvent replaces the click router",
    change: { code: `${GOOD_CODE}\nwindow.Asc.plugin.attachEditorEvent("onContextMenuClick", function (id) {});` },
    exit: 1,
    codes: ["router-replaced"],
  },
  { name: "attachEvent for an undeclared event warns", change: { config: (c) => { c.variations[0].events = ["onContextMenuClick"]; } }, exit: 0, codes: ["event-undeclared"] },
  {
    name: "a message from the plugin's own window needs no declaration",
    change: { code: `${GOOD_CODE}\nwindow.Asc.plugin.attachEvent("onApiKey", function (key) {});` },
    exit: 0,
    codes: [],
  },
  {
    name: "a plugin window's attachEvent is not an editor event",
    change: { code: `${GOOD_CODE}\nconst win = new window.Asc.PluginWindow();\nwin.attachEvent("onWindowReady", function () {});` },
    exit: 0,
    codes: [],
  },
  {
    name: "toolbar items wrapped in an extra array",
    change: { code: `${GOOD_CODE}\nwindow.Asc.plugin.executeMethod("AddToolbarMenuItem", [[{ guid: "x", tabs: [] }]]);` },
    exit: 1,
    codes: ["menu-array"],
  },
  {
    name: "toolbar click handler without onToolbarMenuClick in events",
    change: { code: `${GOOD_CODE}\nwindow.Asc.plugin.attachToolbarMenuClickEvent("footer", function () {});` },
    exit: 1,
    codes: ["click-event-undeclared"],
  },
];

let failed = 0;
const created = [];
for (const c of CASES) {
  const dir = plugin(c.change);
  created.push(dir);
  const { code, findings } = run(dir);
  const got = [...new Set(findings.map((f) => f.code))].sort();
  const want = [...new Set(c.codes)].sort();
  const ok = code === c.exit && JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failed++;
    console.log(`FAIL ${c.name}\n     exit ${code} (want ${c.exit}), codes ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
    for (const f of findings) console.log(`     ${f.level} ${f.where}: ${f.message}`);
  } else {
    console.log(`ok   ${c.name}`);
  }
}
for (const dir of created) rmSync(dir, { recursive: true, force: true });

const EXPANSIONS = [
  ["resources/%theme-type%(light|dark)/icon%scale%(100|150).%extension%(png)", ["resources/light/icon.png", "resources/light/icon@1.5x.png", "resources/dark/icon.png", "resources/dark/icon@1.5x.png"]],
  ["img/%scale%(100|200).%extension%(png)", ["img/icon.png", "img/icon@2x.png"]],
  ["icon%state%(normal|hover).png", ["icon.png", "icon_hover.png"]],
  ["plain/path.png", ["plain/path.png"]],
];
for (const [template, want] of EXPANSIONS) {
  const got = expandIconTemplate(template);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.log(`FAIL expand ${template}\n     got ${JSON.stringify(got)}`);
  } else {
    console.log(`ok   expand ${template}`);
  }
}

console.log(failed ? `\n${failed} failed` : `\nall ${CASES.length + EXPANSIONS.length} passed`);
process.exit(failed ? 1 : 0);
