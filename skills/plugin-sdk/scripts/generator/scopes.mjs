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
 * The scopes a plugin can declare, from the generator's point of view: contract.mjs
 * says what the loader calls, SCOPE_SPECS below adds only what it cannot express.
 * See README.md - adding a scope means an entry in both.
 */

import { SCOPES, SCOPE_CONTRACT } from "../contract.mjs";

/** Types every generated plugin imports, whatever it declares. */
const BASE_SDK_TYPES = ["IPlugin", "PluginStatus", "PluginLocale"];

/**
 * Per scope, all optional:
 *
 *   types        extra SDK type imports the emitted code needs
 *   members      class members, for the scopes that keep no item map
 *   extraMethods methods beyond the adder/getter/updater, given the contract
 *   icons        asset file names its items reference
 *   note         the surprise, written into the registration TODO
 */
export const SCOPE_SPECS = {
  /*
   * API: lets the plugin call the DocSpace REST API. Not a map scope - setAPI runs
   * after the bundle executes, so reading these at module scope captures empty strings.
   */
  API: {
    members: () => `  origin = "";

  proxy = "";

  prefix = "";

  setOrigin = (origin: string): void => {
    this.origin = origin;
  };

  getOrigin = (): string => this.origin;

  setProxy = (proxy: string): void => {
    this.proxy = proxy;
  };

  getProxy = (): string => this.proxy;

  setPrefix = (prefix: string): void => {
    this.prefix = prefix;
  };

  getPrefix = (): string => this.prefix;

  setAPI = (origin: string, proxy: string, prefix: string): void => {
    this.origin = origin;
    this.proxy = proxy;
    this.prefix = prefix;
  };

  getAPI = (): { origin: string; proxy: string; prefix: string } => ({
    origin: this.origin,
    proxy: this.proxy,
    prefix: this.prefix,
  });
`,
  },

  /*
   * Settings: an admin-facing settings page. Not a map scope - the stored settings come
   * back as a raw string, *after* installation, so nothing may assume them in onLoadCallback.
   */
  Settings: {
    types: ["ISettings"],

    members: () => `  adminPluginSettings: ISettings | null = null;

  setAdminPluginSettings = (settings: ISettings | null): void => {
    this.adminPluginSettings = settings;
  };

  // The portal hands settings back as the raw string the plugin saved earlier,
  // and it arrives *after* installation - so parse defensively.
  setAdminPluginSettingsValue = (settings: string | null): void => {
    if (!settings) return;

    try {
      JSON.parse(settings);
    } catch {
      // Ignore malformed stored settings rather than breaking installation.
    }
  };

  getAdminPluginSettings = (): ISettings | null => this.adminPluginSettings;
`,
  },

  /* ContextMenu: an item in the right-click menu of a file, folder or room. */
  ContextMenu: {
    // The only scope whose loader interface also exposes the keys of its map.
    extraMethods: ({ field }) => `  getContextMenuItemsKeys = (): string[] => Array.from(this.${field}.keys());
`,

    icons: ["icon-16.svg"],

    note: "the host reads usersTypes (plural) here, and fileExt/fileType decide which rows the item appears on",
  },

  /* InfoPanel: a tab in the info panel of a file or room. */
  InfoPanel: {
    note: "body is a declarative component tree, and subMenu names the tab; fetch in the item's own onLoad rather than in onLoadCallback",
  },

  /* MainButton: an entry under the portal's main "Actions" button. */
  MainButton: {
    icons: ["icon-16.svg"],

    note: "the host reads usersType (singular) here - the plural spelling is silently ignored",
  },

  /* ProfileMenu: an entry in the current user's profile menu. */
  ProfileMenu: {
    icons: ["icon-16.svg"],

    note: "onClick is mandatory here and takes no arguments; the host reads usersType (singular)",
  },

  /*
   * EventListener: reacts to something happening in the portal. The one scope the SDK
   * gives no updater for - re-adding by the same key overwrites, which is the rebuild path.
   */
  EventListener: {
    note: "eventHandler takes no arguments, and once an event has fired the host honours only item updates and toasts - other actions are ignored",
  },

  /*
   * File: claims a file extension - custom row and tile icons, custom open action.
   * Its map is keyed by extension rather than by a key field.
   */
  File: {
    icons: ["icon-32.svg", "icon-96.svg"],

    note: "the map is keyed by extension, so claiming one that another plugin also claims means the last plugin loaded wins",
  },

  /*
   * PostMessage: two-way messaging with a page embedded in an iFrame. Not a map scope -
   * the portal forwards the page's messages to the callback stored here, so set it first.
   */
  PostMessage: {
    types: ["IPostMessageCallbackMessage"],

    members: () => `  postMessageCallback: (message: IPostMessageCallbackMessage) => void = () => {};

  setPostMessageCallback = (callback: (message: IPostMessageCallbackMessage) => void): void => {
    this.postMessageCallback = callback;
  };

  getPostMessageCallback = (): ((message: IPostMessageCallbackMessage) => void) =>
    this.postMessageCallback;
`,
  },

  /*
   * ArticleButton: a persistent entry point in the sidebar. No updateArticleButtonItems
   * exists, so an item registered after installation never arrives - an empty map is terminal.
   */
  ArticleButton: {
    note: "the whole portal shows at most five article buttons across all plugins, and nothing can refresh this map after installation",
  },
};

// A scope in the contract but not in this table would generate a class that cannot
// satisfy the interface it claims. Fail on any run rather than in someone's build.
const unspecified = SCOPES.filter((scopeName) => !SCOPE_SPECS[scopeName]);

if (unspecified.length > 0)
  throw new Error(`scripts/generator/scopes.mjs has no spec for ${unspecified.join(", ")}`);

/** One declared scope: its portal contract paired with its generation spec. */
class SelectedScope {
  constructor(name) {
    this.name = name;
    this.contract = SCOPE_CONTRACT[name];
    this.spec = SCOPE_SPECS[name];
  }

  /** True for scopes the loader reads through a Map; API, Settings and PostMessage
   * are plain members on the class instead. */
  get keepsItemMap() {
    return Boolean(this.contract.field);
  }

  /** camelCased scope name, used where a scope has to appear inside an identifier. */
  get camelCaseName() {
    return `${this.name.charAt(0).toLowerCase()}${this.name.slice(1)}`;
  }
}

/** The scopes one plugin declares, as the rest of the generator wants to ask about them. */
export class ScopeSelection {
  constructor(scopeNames) {
    this.names = [...scopeNames];
    this.scopes = this.names.map((name) => new SelectedScope(name));
  }

  /** Only these register items, so only these get a map, an adder and a TODO. */
  get itemMapScopes() {
    return this.scopes.filter((scope) => scope.keepsItemMap);
  }

  get registersItems() {
    return this.itemMapScopes.length > 0;
  }

  /** Interfaces the generated class declares, base contract first. */
  get implementedInterfaces() {
    return ["IPlugin", ...this.scopes.map((scope) => scope.contract.iface)];
  }

  /** Everything the generated class imports from the SDK, deduplicated and sorted. */
  get sdkTypes() {
    const types = new Set(BASE_SDK_TYPES);

    for (const { contract, spec } of this.scopes) {
      types.add(contract.iface);
      if (contract.item) types.add(contract.item);
      for (const extraType of spec.types ?? []) types.add(extraType);
    }

    return [...types].sort();
  }

  /** Icon files the declared scopes reference, in declaration order, deduplicated. */
  get itemIconFiles() {
    return [...new Set(this.scopes.flatMap((scope) => scope.spec.icons ?? []))];
  }
}
