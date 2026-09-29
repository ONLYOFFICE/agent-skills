/*
 * (c) Copyright Ascensio System SIA 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * The harness the browser pass loads: a page that mounts the plugin's own built bundle with
 * the real UI kit, the real theme variables and a real layout engine.
 *
 * It is the mirror image of the plugin's build. There the five host-provided specifiers are
 * external, because the portal rewrites them to its own copies; here they must be bundled
 * out of the project's node_modules, because there is no portal. That is also what makes the
 * pass worth running: importing a kit component injects the component's real stylesheet
 * (the kit ships each one inlined next to it, through style-inject), so the surface is laid
 * out by the CSS that will lay it out on the portal - which no offline check can see.
 *
 * Two things the ONLYOFFICE Apps client provides and the kit does not, so the harness provides them
 * and says so rather than pretending the page is the portal:
 *
 *   - the stylesheet that *defines* the theme variables. The kit's ThemeProvider sets the
 *     .light/.dark classes on <body>, but the barrel does not pull the sheet those classes
 *     carry, so it is imported by path for its side effect. Without it every var() in the
 *     plugin's CSS silently falls back and a colour finding would be noise.
 *   - the base typography. The provider sets --font-family as a variable; the rule that
 *     applies it to the document lives in the client's own stylesheet.
 */

import { SCOPE_CONTRACT } from "../contract.mjs";

/** The scopes whose items carry a component the portal renders, with the surface each gets. */
const COMPONENT_SCOPES = {
  ContextMenu: { width: 400, hasCurrentFile: false },
  InfoPanel: { width: 337, hasCurrentFile: true },
  MainButton: { width: 400, hasCurrentFile: false },
  ProfileMenu: { width: 400, hasCurrentFile: false },
  File: { width: 400, hasCurrentFile: false },
  ArticleButton: { width: 32, hasCurrentFile: false },
  // A page is the section body, which is the viewport *minus the sidebar* - measuring it at
  // the full viewport width is what lets a table the portal cannot fit pass unreported. The
  // section's own guard (max-width: 100vw) does not subtract the sidebar either, which is
  // exactly why content sized against the window drags a scrollbar across the whole page.
  //
  // hostPadding is the padding the section body already puts around a page, reproduced so a
  // page starts here where it starts on the portal. Without it a plugin that sets an outer
  // padding of its own looks right in the preview and ships a doubled gutter; with it, the
  // doubling is in the screenshot. The inline-end is nearly bare because the scrollbar is
  // there, which is why a symmetric padding of your own also reads as lopsided.
  //
  // These are the desktop values. From 1023.9px down the section drops the top padding
  // (padding-block 0 16px, sides 24px/0) - not reproduced here, since every surface is
  // measured at a 1280px viewport; styles.md says what a page has to add below that width.
  ArticleNavigation: {
    width: 1030,
    hasCurrentFile: false,
    hostPadding: { paddingBlock: "19px 16px", paddingInline: "20px 3px" },
  },
  EventListener: { width: 400, hasCurrentFile: false },
};

/** Widths the portal actually gives each surface, in px. */
const surfaceTable = () =>
  Object.entries(COMPONENT_SCOPES)
    .filter(([scope]) => SCOPE_CONTRACT[scope])
    .map(([scope, { width, hasCurrentFile, hostPadding }]) => ({
      scope,
      getter: SCOPE_CONTRACT[scope].getter,
      width,
      hasCurrentFile,
      hostPadding: hostPadding ?? null,
    }));

export const harnessHtml = () => `<!doctype html>
<meta charset="utf-8" />
<title>plugin preview</title>
<style>
  /* The portal's own global typography - in the ONLYOFFICE Apps client's stylesheet, not the kit. */
  html, body { margin: 0; padding: 0; }
  body {
    font-family: var(--font-family, "Open Sans", sans-serif);
    font-size: 13px;
    line-height: 20px;
    color: var(--text-color);
    background: var(--background-color);
  }
  /* Each surface is measured inside its own box at the width the portal gives it. */
  [data-surface] { box-sizing: border-box; overflow: visible; }
  /* Where the host pads the surface itself, the dashed line is the plugin's own box: what
     lies between it and the label belongs to the portal, not to the plugin. */
  [data-host-padded] > [data-surface] { outline: 1px dashed var(--border-service-color); }
  #surfaces { display: flex; flex-direction: column; gap: 24px; padding: 20px; align-items: flex-start; }
  .preview-label { font: 11px/16px monospace; color: var(--text-color); opacity: .6; }
  /* Portal-shaped markup planted beside the plugin, to catch a stylesheet that leaks. */
  #leak-probe { position: absolute; left: -10000px; top: 0; }
</style>
<div id="surfaces"></div>
<div id="leak-probe">
  <pre>pre</pre><p>p</p><ul><li>li</li></ul><button>button</button><input value="input" />
  <a href="#">a</a><h1>h1</h1><table><tr><td>td</td></tr></table>
  <div class="card">card</div><div class="row">row</div><div class="title">title</div>
  <div class="header">header</div><div class="body">body</div><div class="panel">panel</div>
</div>
<script type="module" src="./harness.jsx"></script>
`;

export const harnessEntry = () => `import { createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProviderComponent, Base, Dark } from "@docspace/ui-kit";
// The sheet that defines the variables the .light/.dark classes carry - see harness-files.mjs.
// ThemeProviderComponent, never the barrel's default ThemeProvider: that one ignores the theme
// object it is handed and leaves the document on light, which would make every dark run a
// second light run - measured, not assumed.
import "@docspace/ui-kit/dist/esm/components/theme-provider/ThemeProvider.scss.js";
import { withPluginRuntime } from "@onlyoffice/docspace-plugin-sdk/react";

import plugin from "../dist/plugin.js";

const SURFACE_TABLE = ${JSON.stringify(surfaceTable(), null, 2)};

const CURRENT_FILE = {
  id: 1,
  title: "example.docx",
  fileExst: ".docx",
  isFolder: false,
  isRoom: false,
};

const CURRENT_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  displayName: "Preview User",
  email: "preview@localhost",
  isOwner: false,
  isAdmin: true,
  isRoomAdmin: false,
};

/* Actions and requests are recorded, not performed: there is no portal to draw a modal and
 * no session to authenticate a call. A surface that needs data from the API renders its
 * loading or empty branch here, which is itself worth seeing - it is what a user with a slow
 * connection sees. */
const calls = [];
const record = (label) => (...args) => {
  calls.push({ label, args: args.map((a) => (typeof a === "object" ? "[object]" : String(a))) });
  return undefined;
};
const asyncRecord = (label) => async (...args) => {
  record(label)(...args);
  throw new Error("the preview harness has no portal API - fetch from an effect and handle the failure");
};

const runtime = (hasCurrentFile) => ({
  currentFile: hasCurrentFile ? CURRENT_FILE : null,
  currentUser: CURRENT_USER,
  actions: new Proxy({}, { get: (_t, p) => record("actions." + String(p)) }),
  api: new Proxy({}, { get: (_t, p) => asyncRecord("api." + String(p)) }),
  settings: {
    load: async () => null,
    save: async () => {},
    setSaveButton: record("settings.setSaveButton"),
  },
});

const surfaces = [];
const seen = new Set();

const add = (where, component, hasCurrentFile, width, hostPadding = null) => {
  if (!component || typeof component !== "function") return;
  const key = where;
  if (seen.has(key)) return;
  seen.add(key);
  surfaces.push({ where, component, hasCurrentFile, width, hostPadding });
};

const readMap = (value) => {
  if (!value) return [];
  if (value instanceof Map) return [...value];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.entries(value);
  return [];
};

/* The class-side callbacks the portal calls on an item of this scope - submenu children
 * included - each with the argument the portal passes, on its own object, and named by where
 * it sits so two children's dialogs stay two surfaces. The same set validate-plugin.mjs runs. */
const clicksOf = (scope, item, path = "") => {
  if (!item) return [];
  const calls = [];
  const push = (owner, name, arg, label = "") => {
    if (typeof owner?.[name] === "function") calls.push([owner, name, arg, path + label]);
  };

  if (scope === "File") push(item, "onClick", CURRENT_FILE);
  else if (scope === "ProfileMenu") push(item, "onClick", undefined);
  else if (scope === "EventListener") push(item, "eventHandler", undefined);
  else if (scope === "InfoPanel") push(item.subMenu, "onClick", 1);
  else if (scope === "ContextMenu" || scope === "MainButton") {
    if (typeof item.onItemClick === "function") push(item, "onItemClick", 1);
    else push(item, "onClick", 1);
    push(item, "onGroupClick", [{ id: 1, itemType: "file" }], " (group)");
    for (const child of Array.isArray(item.items) ? item.items : [])
      calls.push(...clicksOf(scope, child, path + " > " + (child?.key ?? "?")));
  }
  return calls;
};

const boot = async () => {
  try {
    await plugin.onLoadCallback?.();
  } catch (e) {
    window.__previewBootError = String(e?.message ?? e);
  }

  for (const { scope, getter, width, hasCurrentFile, hostPadding } of SURFACE_TABLE) {
    for (const [key, item] of readMap(plugin[getter]?.())) {
      add(scope + "/" + key, item?.component, hasCurrentFile, width, hostPadding);

      // What a class-side click asks the portal to draw. The message is the only way to
      // reach a dialog or a viewer that no item carries directly.
      for (const [owner, handler, arg, at] of clicksOf(scope, item)) {
        let message;
        try {
          message = await owner[handler](arg);
        } catch {
          continue;
        }
        const dialog = message?.modalDialogProps;
        if (dialog?.dialogBodyComponent) {
          // A dialog opened from a click has no current file; its box is the display type's -
          // except that autoMaxWidth hands sizing to the body, which is how a large dialog is
          // built, and fullScreen swaps the dialog for a full-viewport box
          // (components/modal-dialog.md). Measuring either inside the 400px box reports an
          // overflow the portal never draws, so it is given the width it asks for. The height is not reproduced for any dialog: the modal's
          // 280px cap and an aside's full height are both absent, so nothing here can show a
          // body that would need to scroll.
          const aside = String(dialog.displayType) === "aside";
          let width = 400;
          if (aside) width = 480;
          else if (dialog.autoMaxWidth || dialog.fullScreen) width = 0;
          add((aside ? "aside from " : "modal from ") + scope + "/" + key + at, dialog.dialogBodyComponent, false, width);
        }
        add("viewer from " + scope + "/" + key + at, message?.mediaViewerProps?.component, true, 0);
      }
    }
  }

  const settings = plugin.getAdminPluginSettings?.();
  add("Settings", settings?.component, false, 480);

  const params = new URLSearchParams(location.search);
  const theme = params.get("theme") === "dark" ? Dark : Base;
  const only = params.get("surface");

  const shown = only ? surfaces.filter((s) => s.where === only) : surfaces;

  createRoot(document.getElementById("surfaces")).render(
    createElement(
      ThemeProviderComponent,
      { theme },
      shown.map(({ where, component, hasCurrentFile, width, hostPadding }) => {
        const surface = createElement(
          "div",
          {
            key: "s",
            "data-surface": where,
            "data-surface-width": String(width),
            style: { width: "100%", maxWidth: "100%" },
          },
          createElement(withPluginRuntime(component), { runtime: runtime(hasCurrentFile) }),
        );

        return createElement("div", { key: where, style: { width: width || "100%", maxWidth: "100%" } }, [
          createElement(
            "div",
            { key: "l", className: "preview-label" },
            hostPadding ? where + "  -  dashed: your box; outside it, the section's own padding" : where,
          ),
          // The host pads some surfaces itself. Reproducing that padding is what makes the
          // surface start where it starts on the portal, so an outer padding of the plugin's
          // own is measured and photographed as the doubled gutter it is.
          hostPadding
            ? createElement(
                "div",
                {
                  key: "h",
                  "data-host-padded": "",
                  style: { width: "100%", boxSizing: "border-box", ...hostPadding },
                },
                surface,
              )
            : surface,
        ]);
      }),
    ),
  );

  window.__previewSurfaces = surfaces.map((s) => ({ where: s.where, width: s.width }));
  window.__previewCalls = calls;
  window.__previewReady = true;
};

boot();
`;

/** The plugin's own stylesheet, linked the way the portal links it: into this document's head. */
export const harnessStylesheetImport = (relativeCssPath) =>
  `import "${relativeCssPath}";\n`;

export const harnessViteConfig = (projectDir) => `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

// The plugin's own build keeps these five external because the portal supplies them. Here
// they are bundled from the project's node_modules: the point of this page is to run the
// bundle against the real kit and the real React, which is what the portal does too.
export default defineConfig({
  root: here,
  configFile: false,
  plugins: [react()],
  logLevel: "warn",
  server: {
    fs: { allow: [${JSON.stringify(projectDir)}] },
    watch: { ignored: ["**/shots/**"] },
    // Vite turns console forwarding on by itself when it detects an agent, and the kit talks
    // to the console about every translation the portal would have supplied - dozens of lines
    // that bury this pass's own findings. The harness already collects the browser console
    // through page.on("console") and filters that noise, so forwarding only duplicates it
    // unfiltered.
    forwardConsole: false,
  },
  optimizeDeps: { include: ["@docspace/ui-kit", "react", "react-dom/client"] },
});
`;
