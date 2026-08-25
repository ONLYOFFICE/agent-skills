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
 * What the bundle actually does: load it, await onLoadCallback, read the maps the loader
 * would read, and with --invoke call the item callbacks. This is the pass that catches a
 * mismatched name or an unfilled scope - invisible by reading. Shapes live in shapes.mjs.
 */

import { SCOPE_CONTRACT } from "../contract.mjs";
import { Check } from "./findings.mjs";
import {
  CALLBACK_TIMEOUT_MS,
  createSandbox,
  isMissingHostApi,
  runBundle,
  withTimeout,
} from "./sandbox.mjs";
import { ShapeChecks } from "./shapes.mjs";

/** Members of IPlugin the loader uses on every plugin, whatever it declares. */
const REQUIRED_PLUGIN_MEMBERS = [
  "status",
  "getStatus",
  "updateStatus",
  "onLoadCallback",
  "setOnLoadCallback",
];

/**
 * A file as the host passes it to IFileItem.onClick - handing it a bare id instead
 * would make a correct File plugin look like it throws.
 */
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

const GROUP_STUB = [{ id: 1, itemType: "file" }];

const isFn = (value) => typeof value === "function";

/**
 * Which callbacks a scope's item exposes and what the host calls each with. `kind` says
 * how to read the result: an IMessage, or the {body} the async loaders resolve to.
 */
const invocationsFor = (scope, item) => {
  const calls = [];
  const message = (name, run) => calls.push({ name, run, kind: "message" });
  const body = (name, run) => calls.push({ name, run, kind: "body" });

  if (scope === "File") {
    if (isFn(item.onClick)) message("onClick", () => item.onClick(FILE_STUB));
    return calls;
  }

  if (scope === "ProfileMenu") {
    if (isFn(item.onClick)) message("onClick", () => item.onClick());
    return calls;
  }

  if (scope === "EventListener") {
    if (isFn(item.eventHandler))
      message("eventHandler", () => item.eventHandler());
    return calls;
  }

  if (scope === "InfoPanel") {
    if (isFn(item.subMenu?.onClick))
      message("subMenu.onClick", () => item.subMenu.onClick(1));
    if (isFn(item.onLoad)) body("onLoad", () => item.onLoad());
    return calls;
  }

  if (scope === "ArticleButton") {
    if (isFn(item.onLoad)) body("onLoad", () => item.onLoad());
    return calls;
  }

  // ContextMenu and MainButton: onItemClick supersedes onClick, and a group
  // action is a separate entry point the host calls with the selection.
  if (isFn(item.onItemClick)) message("onItemClick", () => item.onItemClick(1));
  else if (isFn(item.onClick)) message("onClick", () => item.onClick(1));

  if (isFn(item.onGroupClick))
    message("onGroupClick", () => item.onGroupClick(GROUP_STUB));

  return calls;
};

export class RuntimeChecks extends Check {
  constructor(context) {
    super(context);

    this.shapes = new ShapeChecks(context);

    /*
     * `keys` names what `items` only counts, so a caller reading the report need not
     * guess which `key:` literals in the source were the registered ones.
     */
    this.report = { loaded: false, items: {}, keys: {} };
  }

  async run() {
    if (!this.project.isBuilt || !this.options.runtime) return;

    const sandbox = createSandbox();
    const plugin = this.#loadPlugin(sandbox);
    if (!plugin) return;

    this.report.loaded = true;

    this.#checkPluginMembers(plugin);

    const onLoadFailed = await this.#runOnLoadCallback(plugin);

    this.#checkStatus(plugin);

    for (const scope of this.project.scopes)
      await this.#checkScope(plugin, scope, onLoadFailed);
  }

  /** @returns the registered plugin object, or null when there is nothing to check. */
  #loadPlugin(sandbox) {
    try {
      runBundle(sandbox, this.project.readText(this.project.bundlePath));
    } catch (e) {
      if (isMissingHostApi(e))
        this.warn(
          "runtime",
          `the bundle needs a browser API the validator does not stub (${e.message}) - the runtime checks were skipped, so verify this one on a portal`,
        );
      else
        this.error(
          "runtime",
          `the bundle threw while loading: ${e.message}. Top-level code runs as soon as the portal injects the script, so nothing after that point is ever registered`,
        );

      return null;
    }

    const plugin = sandbox.Plugins?.[this.project.pluginName];

    if (!plugin) {
      const registered = Object.keys(sandbox.Plugins ?? {});

      this.error(
        "runtime",
        `the bundle did not register window.Plugins.${this.project.pluginName}${
          registered.length ? ` (it registered: ${registered.join(", ")})` : ""
        }`,
      );
    }

    return plugin ?? null;
  }

  #checkPluginMembers(plugin) {
    for (const member of REQUIRED_PLUGIN_MEMBERS)
      if (plugin[member] === undefined)
        this.error(
          "runtime",
          `IPlugin member ${member} is missing on the registered plugin`,
        );
  }

  /**
   * The portal awaits this during installation, so a throw aborts the plugin with no
   * CSS, no items and nothing in the console.
   *
   * @returns {Promise<boolean>} whether it failed
   */
  async #runOnLoadCallback(plugin) {
    try {
      await withTimeout(
        plugin.onLoadCallback?.(),
        CALLBACK_TIMEOUT_MS,
        "onLoadCallback",
      );
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
          `onLoadCallback threw: ${e.message}. The portal awaits it during installation, so a throw there aborts the plugin with no CSS, no items and nothing in the console`,
        );

      return true;
    }
  }

  #checkStatus(plugin) {
    const status = plugin.getStatus?.();

    if (status === "hide")
      this.warn(
        "runtime",
        "getStatus() is hide after onLoadCallback - the host stops here and renders nothing. Intentional only if the plugin hides itself until it is configured",
      );
    else if (status !== "active")
      this.error(
        "runtime",
        `getStatus() returned "${status}", expected "active" or "hide"`,
      );
  }

  async #checkScope(plugin, scope, onLoadFailed) {
    const contract = SCOPE_CONTRACT[scope];
    if (!contract) return;

    // The scopes that keep no map are satisfied by having their members.
    if (contract.members) {
      for (const member of contract.members)
        if (typeof plugin[member] !== "function")
          this.error(
            "runtime",
            `scope "${scope}" requires ${member}() on the plugin instance`,
          );
      return;
    }

    const items = this.#readItemMap(plugin, contract);
    if (!items) return;

    const entries = [...items];
    this.report.items[scope] = entries.length;
    this.report.keys[scope] = entries.map(([key]) => key);

    // With a failed onLoadCallback an empty map is a consequence, not a separate defect.
    if (entries.length === 0 && !onLoadFailed)
      this.#reportEmptyMap(scope, contract);

    for (const [key, item] of entries) {
      this.shapes.item(scope, contract, key, item);

      if (this.options.invoke)
        await this.#invokeItemCallbacks(scope, key, item);
    }
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

    if (
      !(items instanceof Map) &&
      !(items && typeof items.forEach === "function")
    ) {
      this.error("runtime", `${contract.getter}() did not return a Map`);
      return null;
    }

    return items;
  }

  /**
   * An empty map at load time is legitimate only if the plugin registers items later and
   * an update*Items action exists to re-read them. ArticleButton has none.
   */
  #reportEmptyMap(scope, contract) {
    const registersSomewhere = new RegExp(`\\b${contract.adder}\\s*\\(`).test(
      this.project.sourceText,
    );
    const { refresh } = contract;

    if (registersSomewhere && refresh)
      this.warn(
        "runtime",
        `${contract.getter}() is empty after onLoadCallback - fine only if the plugin registers items later and then sends Actions.${refresh}`,
      );
    else if (registersSomewhere)
      this.error(
        "runtime",
        `${contract.getter}() is empty after onLoadCallback and the SDK has no update${scope}Items action to refresh it - an item registered later never reaches the portal`,
      );
    else
      this.error(
        "runtime",
        `scope "${scope}" is declared but ${contract.adder}() is never called - register at least one item, or drop "${scope}" from scopes in package.json; as it stands the portal has nothing to render for it (a freshly scaffolded project reports this until its TODOs become items)`,
      );
  }

  async #invokeItemCallbacks(scope, key, item) {
    for (const call of invocationsFor(scope, item)) {
      const where = `${scope} item "${key}" ${call.name}`;

      try {
        const result = await withTimeout(
          call.run(),
          CALLBACK_TIMEOUT_MS,
          where,
        );

        if (call.kind === "body")
          this.shapes.componentTree(`${where} body`, result?.body);
        else this.shapes.message(`${scope} item "${key}"`, result);
      } catch (e) {
        this.warn("message", `${where} threw: ${e.message}`);
      }
    }
  }
}
