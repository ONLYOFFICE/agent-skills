#!/usr/bin/env node
/**
 * Offline TFrameConfig validator for @onlyoffice/docspace-sdk-js (2.2.0).
 *
 * Usage:
 *   node validate-config.mjs '<json>'      # inline JSON
 *   node validate-config.mjs config.json   # path to a JSON file
 *   cat config.json | node validate-config.mjs
 *
 * Exit code 0 = OK (warnings allowed), 1 = errors found or input unreadable.
 *
 * The dictionary below is hand-synced with src/types + src/enums of the SDK.
 * Regenerate on every SDK release.
 */

import { readFileSync } from "node:fs";

const MODES = [
  "manager", "editor", "viewer", "room-selector", "file-selector",
  "system", "public-room", "uploader", "forms", "chat", "personal",
];

const ENUMS = {
  theme: ["Base", "Dark", "System"],
  viewAs: ["row", "table", "tile"],
  selectorType: ["all", "roomsOnly", "userFolderOnly"],
  editorType: ["desktop", "embedded", "mobile"],
  type: ["desktop", "embedded", "mobile"],
  showHeaderBanner: ["all", "info", "none"],
  destination: ["my-forms", "in-progress", "completed-forms", "library", "settings"],
  personalDestination: ["my-documents", "favorites", "recent", "trash", "settings"],
};

const FILTER_ENUMS = {
  sortBy: [
    "AZ", "DateAndTime", "DateAndTimeCreation", "LastOpened", "Author",
    "Room", "roomType", "Size", "Tags", "Type", "usedspace",
  ],
  sortOrder: ["ascending", "descending"],
};

// Common wrong sortBy spellings → the API value the author probably meant.
const SORTBY_HINTS = {
  name: "AZ", title: "AZ", az: "AZ",
  modified: "DateAndTime", dateandtime: "DateAndTime", updated: "DateAndTime",
  created: "DateAndTimeCreation", creationdate: "DateAndTimeCreation",
  size: "Size", author: "Author", type: "Type", tags: "Tags",
};

const BOOLEAN_FIELDS = [
  "noLoader", "checkCSP", "disableActionButton", "downloadToEvent",
  "infoPanelVisible", "init", "showFilter", "showHeader", "showMenu",
  "showSelectorCancel", "showSelectorHeader", "showSettings", "showSignOut",
  "showTitle", "waiting", "withBreadCrumbs", "withSearch", "withSubtitle",
  "isFolderUpload", "isMultipleUpload",
];

const KNOWN_KEYS = [
  // required
  "frameId", "mode", "src",
  // general
  "width", "height", "theme", "locale", "type", "name", "noLoader", "waiting",
  "checkCSP", "destroyText", "methodTimeout", "events", "stylesUrl",
  "integrationUrl", "init",
  // entity / auth
  "id", "requestToken", "getToken", "accessToken", "tokenExpiresAt",
  "providerName", "inviteKey", "emplType", "uid",
  // manager
  "rootPath", "viewAs", "viewTableColumns", "showMenu", "showFilter",
  "showTitle", "showHeader", "showHeaderBanner", "showSettings", "showSignOut",
  "infoPanelVisible", "disableActionButton", "filter",
  // selectors
  "selectorType", "filterParam", "roomType", "acceptButtonLabel",
  "cancelButtonLabel", "buttonColor", "showSelectorCancel", "showSelectorHeader",
  "withBreadCrumbs", "withSearch", "withSubtitle",
  // editor / viewer
  "editorType", "editorGoBack", "editorCustomization", "downloadToEvent",
  // uploader
  "linkMainText", "secondaryText", "extensionsText", "acceptExtensions",
  "isFolderUpload", "isMultipleUpload", "maxPerUploadSize", "maxTotalUploadSize",
  // forms
  "destination", "libraryId", "headerOffset", "headerHeight",
  // chat
  "agentId", "fileId", "chatId",
  // personal
  "personalDestination",
];

const KNOWN_FILTER_KEYS = [
  "count", "page", "sortBy", "sortOrder", "search", "withSubfolders", "folder",
];

const KNOWN_CUSTOMIZATION_KEYS = [
  "anonymous", "autosave", "comments", "compactHeader", "compactToolbar",
  "compatibleFeatures", "forcesave", "help", "hideRightMenu", "hideRulers",
  "integrationMode", "macros", "macrosMode", "mentionShare", "mobileForceView",
  "plugins", "toolbarHideFileName", "toolbarNoTabs", "uiTheme", "unit", "zoom",
];

const KNOWN_EVENTS = [
  "onAppError", "onAuthError", "onAppReady", "onAuthSuccess", "onCloseCallback",
  "onContentReady", "onDownload", "onEditorCloseCallback", "onNoAccess",
  "onNotFound", "onSelectCallback", "onSignOut", "onEditorOpen",
  "onFileManagerClick", "onUploadSuccess", "onUploadError", "onUploadProgress",
  "onCustomAction", "onNavigate", "onGetExternalData", "onSetExternalData",
];

// mode → { errors: required fields, warnings: strongly recommended fields }
const MODE_REQUIREMENTS = {
  editor: { errors: ["id"] },
  viewer: { errors: ["id"] },
  chat: { errors: ["agentId"] },
  "public-room": { errors: ["requestToken"] },
  uploader: { warnings: ["id"] },
  forms: { warnings: ["id"] },
};

// ---------------------------------------------------------------------------

function readInput() {
  const arg = process.argv[2];
  if (arg && arg.trim().startsWith("{")) return arg;
  if (arg) return readFileSync(arg, "utf8");
  return readFileSync(0, "utf8"); // stdin
}

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

let config;
try {
  config = JSON.parse(readInput());
} catch (e) {
  console.error(`ERROR: cannot parse input as JSON: ${e.message}`);
  process.exit(1);
}
if (typeof config !== "object" || config === null || Array.isArray(config)) {
  console.error("ERROR: config must be a JSON object");
  process.exit(1);
}

// --- required trio ---------------------------------------------------------

if (!config.frameId) {
  warn(`frameId: missing — the SDK falls back to "ds-frame"; set it explicitly and make sure a DOM element with that id exists`);
}
if (!config.mode) {
  err(`mode: missing — one of ${MODES.join(", ")}`);
} else if (!MODES.includes(config.mode)) {
  err(`mode: "${config.mode}" is not a known mode (${MODES.join(", ")})`);
}
if (!config.src) {
  err("src: missing — the DocSpace portal origin is required");
} else {
  try {
    const u = new URL(config.src);
    if (!/^https?:$/.test(u.protocol)) err(`src: "${config.src}" must be http(s)`);
  } catch {
    err(`src: "${config.src}" is not a valid URL`);
  }
}

// --- per-mode requirements --------------------------------------------------

const req = MODE_REQUIREMENTS[config.mode];
if (req) {
  for (const f of req.errors ?? []) {
    if (config[f] === undefined || config[f] === null || config[f] === "") {
      err(`${f}: required in "${config.mode}" mode`);
    }
  }
  for (const f of req.warnings ?? []) {
    if (config[f] === undefined || config[f] === null || config[f] === "") {
      warn(`${f}: strongly recommended in "${config.mode}" mode`);
    }
  }
}

// --- enum values -------------------------------------------------------------

for (const [field, allowed] of Object.entries(ENUMS)) {
  const v = config[field];
  if (v !== undefined && v !== null && !allowed.includes(v)) {
    err(`${field}: "${v}" is invalid — expected one of: ${allowed.join(", ")}`);
  }
}

// --- boolean-as-string (script-tag transfer bug) ------------------------------

for (const f of BOOLEAN_FIELDS) {
  const v = config[f];
  if (v === "true" || v === "false") {
    err(`${f}: string "${v}" instead of boolean ${v} — script-tag params arrive as strings; convert before use`);
  }
}

// --- unknown top-level keys ---------------------------------------------------

for (const key of Object.keys(config)) {
  if (!KNOWN_KEYS.includes(key)) {
    warn(`unknown config key "${key}" — a typo, or a field from a different SDK version (this dictionary targets 2.2.0)`);
  }
}

// --- filter --------------------------------------------------------------------

if (config.filter !== undefined) {
  if (typeof config.filter !== "object" || config.filter === null) {
    err("filter: must be an object");
  } else {
    for (const key of Object.keys(config.filter)) {
      if (!KNOWN_FILTER_KEYS.includes(key)) {
        warn(`filter.${key}: unknown key — known: ${KNOWN_FILTER_KEYS.join(", ")} (bracket/lowercase forms like "sortorder" are not recognized by the SDK parser)`);
      }
    }
    for (const [field, allowed] of Object.entries(FILTER_ENUMS)) {
      const v = config.filter[field];
      if (v !== undefined && !allowed.includes(v)) {
        const hint = field === "sortBy" ? SORTBY_HINTS[String(v).toLowerCase()] : undefined;
        err(`filter.${field}: "${v}" is invalid — expected one of: ${allowed.join(", ")}${hint ? `; did you mean "${hint}"?` : ""}`);
      }
    }
    if (config.filter.withSubfolders === "true" || config.filter.withSubfolders === "false") {
      err(`filter.withSubfolders: string instead of boolean`);
    }
    if (config.filter.folder !== undefined) {
      warn("filter.folder: set automatically from `id` in manager mode — do not set manually");
    }
  }
}

// --- editorCustomization ---------------------------------------------------------

if (config.editorCustomization !== undefined) {
  if (typeof config.editorCustomization !== "object" || config.editorCustomization === null) {
    err("editorCustomization: must be an object");
  } else {
    if (!["editor", "viewer"].includes(config.mode)) {
      warn(`editorCustomization: only applies to editor/viewer modes (mode is "${config.mode}")`);
    }
    for (const key of Object.keys(config.editorCustomization)) {
      if (!KNOWN_CUSTOMIZATION_KEYS.includes(key)) {
        warn(`editorCustomization.${key}: unknown key — silently ignored by SDK 2.2.0`);
      }
    }
  }
}

// --- events ------------------------------------------------------------------------

if (config.events !== undefined) {
  if (typeof config.events !== "object" || config.events === null) {
    err("events: must be an object");
  } else {
    for (const key of Object.keys(config.events)) {
      if (!KNOWN_EVENTS.includes(key)) {
        warn(`events.${key}: unknown event — known: ${KNOWN_EVENTS.join(", ")}`);
      }
    }
  }
}

// --- cross-field sanity ----------------------------------------------------------

if (config.accessToken !== undefined && config.getToken !== undefined) {
  warn("accessToken and getToken both set — getToken wins; drop accessToken");
}
if (config.mode !== "public-room" && config.requestToken) {
  warn(`requestToken set in "${config.mode}" mode — only meaningful for public-room and shared-file access`);
}

// --- report -----------------------------------------------------------------------

for (const w of warnings) console.log(`WARN:  ${w}`);
for (const e of errors) console.log(`ERROR: ${e}`);
if (errors.length === 0) {
  console.log(`OK${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? "s" : ""})` : ""}`);
  process.exit(0);
}
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(1);
