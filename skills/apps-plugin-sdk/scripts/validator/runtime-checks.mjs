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
 * What the bundle actually does: import it the way the portal would, await onLoadCallback,
 * read the maps the loader would read, and with --invoke call the class-side callbacks.
 * Shapes live in shapes.mjs.
 */

import * as fs from "node:fs";

import { MODULE_RUNTIME, SCOPE_CONTRACT } from "../contract.mjs";
import { Check } from "./findings.mjs";
import {
  CALLBACK_TIMEOUT_MS,
  NETWORK_REFUSED,
  importModuleBundle,
  isMissingHostApi,
  network,
  resolveHostModules,
  withTimeout,
} from "./sandbox.mjs";
import { ShapeChecks } from "./shapes.mjs";

/** Members of IPlugin the loader uses on every plugin, whatever it declares. */
const REQUIRED_PLUGIN_MEMBERS = ["status", "getStatus", "updateStatus", "onLoadCallback", "setOnLoadCallback"];

/** A file as the host passes it to IFileItem.onClick. */
const FILE_STUB = {
  id: 1,
  title: "example.txt",
  fileExst: ".txt",
  folderId: 2,
  rootFolderId: 2,
  rootFolderType: 0,
  viewUrl: "https://localhost/view/1",
  webUrl: "https://localhost/doceditor/1",
  security: {},
  fileSecurity: {},
};

const isFn = (value) => typeof value === "function";

/** What a click that opens a surface says in the source - only those plugins hide one behind a fetch. */
const OPENS_A_SURFACE = /dialogBodyComponent|mediaViewerProps/;

/**
 * Which callbacks a scope's item exposes and what the host calls each with. A React
 * `component` has nothing to invoke. ContextMenu and MainButton: onItemClick supersedes
 * onClick, and a group action is a separate entry point called with the selection.
 */
const INVOCATIONS = {
  File: (item) => (isFn(item.onClick) ? [["onClick", () => item.onClick(FILE_STUB)]] : []),
  ProfileMenu: (item) => (isFn(item.onClick) ? [["onClick", () => item.onClick()]] : []),
  EventListener: (item) => (isFn(item.eventHandler) ? [["eventHandler", () => item.eventHandler()]] : []),
  InfoPanel: (item) => (isFn(item.subMenu?.onClick) ? [["subMenu.onClick", () => item.subMenu.onClick(1)]] : []),
  ArticleButton: () => [],
  ArticleNavigation: () => [],
};

const invocationsFor = (scope, item) => {
  if (INVOCATIONS[scope]) return INVOCATIONS[scope](item);

  const calls = [];
  if (isFn(item.onItemClick)) calls.push(["onItemClick", () => item.onItemClick(1)]);
  else if (isFn(item.onClick)) calls.push(["onClick", () => item.onClick(1)]);
  if (isFn(item.onGroupClick)) calls.push(["onGroupClick", () => item.onGroupClick([{ id: 1, itemType: "file" }])]);

  // A submenu child is clicked by the same host code as its parent.
  for (const child of Array.isArray(item.items) ? item.items : [])
    for (const [name, run] of invocationsFor(scope, child ?? {}))
      calls.push([`> "${child?.key ?? child?.label ?? "?"}" ${name}`, run]);

  return calls;
};

export class RuntimeChecks extends Check {
  /** @param {{ bundleImportsResolvable: boolean }} archive - what the archive pass found */
  constructor(context, archive) {
    super(context);

    this.archive = archive;
    this.shapes = new ShapeChecks(context);
    this.report = { loaded: false, items: {}, networkTruncated: 0 };

    /** Every component the portal would render, with the selection its surface receives. */
    this.surfaces = [];
  }

  /** Deduplicated - the same component registered twice is one render. */
  #collectSurface(where, component, hasCurrentFile) {
    if (!component) return;
    if (this.surfaces.some((surface) => surface.component === component && surface.hasCurrentFile === hasCurrentFile))
      return;

    this.surfaces.push({ where, component, hasCurrentFile });
  }

  async run() {
    if (!this.project.isBuilt) return;

    const plugin = await this.#loadModulePlugin();
    if (!plugin) return;

    this.report.loaded = true;

    for (const member of REQUIRED_PLUGIN_MEMBERS)
      if (plugin[member] === undefined)
        this.error("runtime", `IPlugin member ${member} is missing on the registered plugin`);

    const onLoadFailed = await this.#runOnLoadCallback(plugin);

    this.#checkStatus(plugin);

    for (const scope of this.project.scopes)
      await this.#checkScope(plugin, scope, onLoadFailed);
  }

  /** @returns the module's default export, or null when there is nothing to check. */
  async #loadModulePlugin() {
    if (!this.archive.bundleImportsResolvable) {
      this.warn(
        "runtime",
        "the bundle imports a package the portal does not provide (reported above), so it cannot be loaded here either - the runtime checks were skipped",
      );
      return null;
    }

    const hostModules = resolveHostModules(this.project);

    if (hostModules.missing.length) {
      this.warn(
        "runtime",
        `${hostModules.missing.join(", ")} ${hostModules.missing.length > 1 ? "are" : "is"} not installed in the project, so the bundle cannot be imported here - run npm install and validate again; the runtime checks were skipped`,
      );
      return null;
    }

    let plugin;

    try {
      plugin = await withTimeout(
        importModuleBundle(fs.readFileSync(this.project.bundlePath, "utf8"), hostModules),
        CALLBACK_TIMEOUT_MS,
        "importing dist/plugin.js",
      );
    } catch (e) {
      this.#reportLoadFailure(e);
      return null;
    }

    if (!plugin || typeof plugin !== "object") {
      this.error(
        "runtime",
        `dist/plugin.js has no default export - with "runtime": "${MODULE_RUNTIME}" the portal imports the bundle and reads \`default\`; export the plugin instance (export default plugin)`,
      );
      return null;
    }

    return plugin;
  }

  #reportLoadFailure(e) {
    const message = e?.message ?? "";

    if (isMissingHostApi(e))
      this.warn(
        "runtime",
        `the bundle needs a browser API the validator does not stub (${e.message}) - the runtime checks were skipped, so verify this one on a portal`,
      );
    else if (/inside a plugin component/.test(message))
      this.error(
        "runtime",
        `the bundle threw while loading: ${e.message}. Hooks only work inside the component ONLYOFFICE Apps renders; at module scope or inside a plain callback they throw, and the plugin never registers`,
      );
    else if (/Cannot find module 'react'/.test(message) && /docspace-plugin-sdk/.test(message))
      this.warn(
        "runtime",
        `the SDK could not find react from where it is installed (${message.split("\n")[0]}) - this happens when the SDK is linked from a checkout rather than installed from a tarball or npm, so its peer dependency resolves outside the project. Install it from a packed tarball (npm pack) to run the runtime checks; the portal itself is unaffected`,
      );
    else
      this.error(
        "runtime",
        `the bundle threw while loading: ${e.message}. Top-level code runs as soon as the portal loads the bundle, so nothing after that point is ever registered - the administrator's plugin card reads "Failed to load" with this message, users see nothing`,
      );
  }

  /** The portal awaits this during installation, so a throw aborts the plugin; only the administrator's plugin card shows it. */
  async #runOnLoadCallback(plugin) {
    try {
      await withTimeout(plugin.onLoadCallback?.(), CALLBACK_TIMEOUT_MS, "onLoadCallback");
      return false;
    } catch (e) {
      if (isMissingHostApi(e))
        this.warn(
          "runtime",
          `onLoadCallback needs a browser API the validator does not stub (${e.message}) - verify this one on a portal`,
        );
      else
        this.error(
          "runtime",
          `onLoadCallback threw: ${e.message}. The portal awaits it during installation, so a throw there aborts the plugin - no CSS, no items, nothing for users; the administrator's plugin card reads "Failed to initialize" with this message`,
        );

      return true;
    }
  }

  #checkStatus(plugin) {
    const status = plugin.getStatus?.();

    if (status === "hide")
      this.warn(
        "runtime",
        "getStatus() is hide after onLoadCallback - the portal registers no items and loads no CSS until it reads active again (after the stored settings arrive, after a settings save, or on Actions.updateStatus). Intentional only if the plugin hides itself until it is configured",
      );
    else if (status !== "active")
      this.error("runtime", `getStatus() returned "${status}", expected "active" or "hide"`);
  }

  async #checkScope(plugin, scope, onLoadFailed) {
    const contract = SCOPE_CONTRACT[scope];
    if (!contract) return;

    // The scopes that keep no map are satisfied by having their members.
    if (contract.members) {
      for (const member of contract.members)
        if (typeof plugin[member] !== "function")
          this.error("runtime", `scope "${scope}" requires ${member}() on the plugin instance`);

      if (scope === "Settings") this.#checkSettings(plugin);
      return;
    }

    const items = this.#readItemMap(plugin, contract);
    if (!items) return;

    const entries = [...items];
    this.report.items[scope] = entries.length;

    // With a failed onLoadCallback an empty map is a consequence, not a separate defect.
    if (entries.length === 0 && !onLoadFailed) this.#reportEmptyMap(scope, contract);

    for (const [key, item] of entries) {
      this.shapes.item(scope, contract, key, item);

      // An info panel tab is the one item surface the portal renders over a selection.
      this.#collectSurface(`${scope} item "${key}" component`, item.component, scope === "InfoPanel");

      if (this.options.invoke) await this.#invokeItemCallbacks(scope, key, item);
    }
  }

  #checkSettings(plugin) {
    let settings;

    try {
      settings = plugin.getAdminPluginSettings?.();
    } catch (e) {
      this.error("runtime", `getAdminPluginSettings() threw: ${e.message}`);
      return;
    }

    if (!settings) {
      this.error(
        "runtime",
        'scope "Settings" is declared but getAdminPluginSettings() returns nothing after onLoadCallback - call setAdminPluginSettings({ component: SettingsPage }) there, or the settings aside stays empty',
      );
      return;
    }

    this.shapes.settings(settings);
    this.#collectSurface("the settings component", settings.component, false);
  }

  /** @returns the map, or null when the getter is unusable (already reported). */
  #readItemMap(plugin, contract) {
    let items;

    try {
      items = plugin[contract.getter]?.();
    } catch (e) {
      this.error("runtime", `${contract.getter}() threw: ${e.message}`);
      return null;
    }

    if (!(items instanceof Map) && !(items && typeof items.forEach === "function")) {
      this.error("runtime", `${contract.getter}() did not return a Map`);
      return null;
    }

    return items;
  }

  /** An empty map at load time is legitimate only if items are registered later and refreshed. */
  #reportEmptyMap(scope, contract) {
    const registersSomewhere = new RegExp(`\\b${contract.adder}\\s*\\(`).test(this.project.sourceText);

    if (registersSomewhere)
      this.warn(
        "runtime",
        `${contract.getter}() is empty after onLoadCallback - fine only if the plugin registers items later and then sends Actions.${contract.refresh}`,
      );
    else
      this.error(
        "runtime",
        `scope "${scope}" is declared but ${contract.adder}() is never called - register at least one item, or drop "${scope}" from scopes in package.json; as it stands the portal has nothing to render for it (a freshly scaffolded project reports this until its TODOs become items)`,
      );
  }

  /**
   * The surfaces a class-side click asks the portal to draw. A dialog opened this way has no
   * selection - the message carries none - while the media viewer is always about a file.
   */
  #collectMessageSurfaces(where, message) {
    if (!message || typeof message !== "object") return;

    this.#collectSurface(`${where} -> dialogBodyComponent`, message.modalDialogProps?.dialogBodyComponent, false);
    this.#collectSurface(`${where} -> mediaViewerProps.component`, message.mediaViewerProps?.component, true);
  }

  async #invokeItemCallbacks(scope, key, item) {
    for (const [name, run] of invocationsFor(scope, item)) {
      const where = `${scope} item "${key}" ${name}`;
      const fetchesBefore = network.attempts;
      let openedSurface = false;
      let threw = false;

      try {
        const result = await withTimeout(run(), CALLBACK_TIMEOUT_MS, where);
        this.shapes.message(where, result);
        this.#collectMessageSurfaces(where, result);
        // Read from the message, not from this.surfaces - a component collected once already
        // does not grow the list, and that is not the same as the click opening nothing.
        openedSurface = Boolean(
          result?.modalDialogProps?.dialogBodyComponent ?? result?.mediaViewerProps?.component,
        );
      } catch (e) {
        threw = true;

        if (/inside a plugin component/.test(e?.message ?? ""))
          this.error(
            "message",
            `${where} threw: ${e.message}. A class-side callback has no runtime context - read the id it is given, open a modal or a toast through the returned IMessage, and use the hooks inside the component instead`,
          );
        else if (network.attempts > fetchesBefore && (e?.message ?? "").includes(NETWORK_REFUSED))
          // The sandbox's own refusal escaped the callback, so on the portal any failed request
          // does the same: nothing wraps a class-side callback.
          this.error(
            "message",
            `${where} threw after its request failed: ${e.message}. Nothing catches a class-side callback, so on the portal this click does nothing and tells the user nothing whenever the request fails - catch it and return an error toast`,
          );
        else
          this.warn(
            "message",
            `${where} threw: ${e.message}. If it throws on the portal too, the click does nothing and tells the user nothing - nothing catches a class-side callback`,
          );
      }

      // A callback that threw took no failure path; its error above is the whole story.
      if (!threw) this.#reportNetworkTruncation(where, network.attempts - fetchesBefore, openedSurface);
    }
  }

  /**
   * A callback that reaches the network stops there and returns a toast, so a surface the real
   * click would have opened is never collected. Silence would read as "this click is covered".
   */
  #reportNetworkTruncation(where, fetches, openedSurface) {
    // A plugin whose clicks only ever toast has nothing hidden here, so it is not warned at.
    if (!fetches || openedSurface || !OPENS_A_SURFACE.test(this.project.sourceText)) return;

    this.report.networkTruncated += 1;

    this.warn(
      "runtime",
      `${where} called fetch ${fetches === 1 ? "once" : `${fetches} times`} and returned no surface - the sandbox has no network, so the callback took its failure path. If the real click opens a modal or the media viewer from that request, nothing of it was collected or rendered here: check that surface on a portal, or open it from the click and fetch from the component's effect instead`,
    );
  }
}
