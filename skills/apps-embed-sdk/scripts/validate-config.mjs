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
 * The dictionaries below are generated from the SDK types by sync-sdk.mjs:
 *   node sync-sdk.mjs --from <sdk checkout or node_modules/@onlyoffice/docspace-sdk-js> --write
 * Run it with --check on every SDK release; edit MODE_REQUIREMENTS and SORTBY_HINTS by hand.
 */

import { readFileSync } from "node:fs";

const MODES = [
  "manager", "editor", "viewer", "room-selector", "file-selector", "system", "public-room",
  "uploader", "forms", "chat", "personal",
];

const ENUMS = {
  theme: ["Base", "Dark", "System"],
  viewAs: ["row", "table", "tile"],
  selectorType: ["all", "roomsOnly", "userFolderOnly"],
  editorType: ["desktop", "embedded", "mobile"],
  type: ["desktop", "embedded", "mobile"],
  showHeaderBanner: ["all", "info", "none"],
  destination: ["my-forms", "in-progress", "completed-forms", "library", "settings"],
  personalDestination: ["my-documents", "favorites", "recent", "shared-with-me", "trash", "settings"],
};

const FILTER_ENUMS = {
  sortBy: ["Author", "DateAndTimeCreation", "LastOpened", "DateAndTime", "AZ", "Room", "roomType", "Size", "Tags", "Type", "usedspace"],
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
  "noLoader", "checkCSP", "disableActionButton", "downloadToEvent", "editorGoBack",
  "openEditorInSameTab", "infoPanelVisible", "init", "showFilter", "showHeader", "showMenu",
  "showSelectorCancel", "showSelectorHeader", "showSettings", "showSignOut", "showTitle",
  "waiting", "withBreadCrumbs", "withSearch", "withSubtitle", "isFolderUpload",
  "isMultipleUpload",
];

const KNOWN_KEYS = [
  "noLoader", "roomType", "acceptButtonLabel", "cancelButtonLabel", "buttonColor",
  "checkCSP", "customActions", "destroyText", "methodTimeout", "disableActionButton",
  "downloadToEvent", "editorCustomization", "editorGoBack", "editorType",
  "openEditorInSameTab", "events", "filter", "filterParam", "frameId", "height", "id",
  "infoPanelVisible", "init", "integrationUrl", "locale", "mode", "name", "requestToken",
  "getToken", "accessToken", "tokenExpiresAt", "rootPath", "selectorType", "showFilter",
  "showHeader", "showHeaderBanner", "showMenu", "headerOffset", "headerHeight",
  "providerName", "inviteKey", "emplType", "uid", "showSelectorCancel",
  "showSelectorHeader", "showSettings", "showSignOut", "showTitle", "src", "stylesUrl",
  "theme", "type", "viewAs", "viewTableColumns", "waiting", "width", "withBreadCrumbs",
  "withSearch", "withSubtitle", "destination", "personalDestination", "libraryId",
  "linkMainText", "secondaryText", "extensionsText", "acceptExtensions", "isFolderUpload",
  "isMultipleUpload", "maxPerUploadSize", "maxTotalUploadSize", "agentId", "entityId",
  "fileId", "threadId",
];

const KNOWN_FILTER_KEYS = [
  "count", "folder", "groupId", "page", "search", "sortBy", "sortOrder", "withSubfolders",
];

const KNOWN_CUSTOMIZATION_KEYS = [
  "anonymous", "autosave", "comments", "compactHeader", "compactToolbar",
  "compatibleFeatures", "forcesave", "help", "hideRightMenu", "hideRulers",
  "integrationMode", "macros", "macrosMode", "mentionShare", "mobileForceView", "plugins",
  "toolbarHideFileName", "toolbarNoTabs", "uiTheme", "unit", "zoom",
];

const KNOWN_EVENTS = [
  "onAppError", "onAuthError", "onAppReady", "onAuthSuccess", "onCloseCallback",
  "onContentReady", "onDownload", "onEditorCloseCallback", "onNoAccess", "onNotFound",
  "onSelectCallback", "onSignOut", "onEditorOpen", "onFileManagerClick", "onUploadSuccess",
  "onUploadError", "onUploadProgress", "onCustomAction", "onNavigate", "onFilterSearch",
  "onGetExternalData", "onSetExternalData",
];

// mode → { errors: required fields, warnings: strongly recommended fields }
const MODE_REQUIREMENTS = {
  editor: { errors: ["id"] },
  viewer: { errors: ["id"] },
  chat: {},
  // id → ?folder=; the portal page getFolder()s it during SSR and white-screens without it
  "public-room": { errors: ["id", "requestToken"] },
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
  err("src: missing — the ONLYOFFICE Apps portal origin is required");
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
  if (KNOWN_KEYS.includes(key)) continue;
  if (KNOWN_FILTER_KEYS.includes(key)) {
    err(`${key}: belongs inside "filter" (filter.${key}) — at the top level the SDK ignores it and the list keeps its defaults`);
  } else {
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
        warn(`editorCustomization.${key}: not in TEditorCustomization (SDK 2.2.0) — the portal passes it to Document Server unchecked`);
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
const sharedRoomManager = config.mode === "manager" && /\/rooms\/share\b/.test(String(config.rootPath ?? ""));
const tokenModes = ["public-room", "editor", "viewer"];
if (config.requestToken && !tokenModes.includes(config.mode) && !sharedRoomManager) {
  warn(`requestToken set in "${config.mode}" mode — read only by public-room, editor and viewer (sent as share= on /doceditor), or manager with rootPath "/rooms/share"`);
}
if (sharedRoomManager && !config.requestToken) {
  err(`requestToken: required when manager mode uses rootPath "/rooms/share"`);
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
