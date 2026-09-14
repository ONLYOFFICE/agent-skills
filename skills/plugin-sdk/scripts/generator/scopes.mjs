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
 * What each scope adds to the generated code beyond what contract.mjs expresses. Adding a
 * scope means an entry in both. Per scope, all optional: `types` extra SDK type imports,
 * `members` class members for the scopes that keep no item map, `extraMethods` methods
 * beyond adder/getter/updater, `icons` asset file names, `note` the surprise written into
 * the registration TODO. The `note` strings are generated output - keep them stable.
 */

import { SCOPE_CONTRACT } from "../contract.mjs";

const BASE_SDK_TYPES = ["IPlugin", "PluginStatus", "PluginLocale"];

export const SCOPE_SPECS = {
  // The portal's base URLs for class-side callbacks; a component has usePluginAPI() instead.
  API: {
    members: `  origin = "";

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

  Settings: {
    types: ["ISettings"],

    members: `  adminPluginSettings: ISettings | null = null;

  setAdminPluginSettings = (settings: ISettings | null): void => {
    this.adminPluginSettings = settings;
  };

  // The portal hands the stored settings back as the raw string the plugin saved, and
  // it arrives *after* installation. A component reads them with usePluginSettings()
  // instead; this exists for class-side callbacks that need them, so parse defensively.
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

    note: "call this.setAdminPluginSettings({ component: SettingsPage }) here, where SettingsPage loads with settings.load() in a useEffect and saves through settings.setSaveButton(...) - whose isDisabled, like any field's hasError, is gated on what the user changed and not on validity alone, or the aside opens with Save lit over a form nobody edited; its onClick catches the save and returns a showToast IMessage on both branches, since the aside closes on a failed save exactly as on a stored one and nothing else reports it",
  },

  ContextMenu: {
    // The only scope whose loader interface also exposes the keys of its map.
    extraMethods: ({ field }) => `  getContextMenuItemsKeys = (): string[] => Array.from(this.${field}.keys());
`,

    icons: ["icon-16.svg"],

    note: "the host reads usersTypes (plural) here, and fileExt/fileType decide which rows the item appears on; a modal opened from onItemClick gets no current file, so capture the id in the closure",
  },

  InfoPanel: {
    note: "component is a React component rendered as the tab; it reads the selected file with useCurrentFile() and fetches in a useEffect, so no onLoad and no body",
  },

  MainButton: {
    icons: ["icon-16.svg"],

    note: "the host reads usersType (singular) here - the plural spelling is silently ignored",
  },

  ProfileMenu: {
    icons: ["icon-16.svg"],

    note: "onClick is mandatory here and takes no arguments; the host reads usersType (singular)",
  },

  EventListener: {
    note: "eventHandler takes no arguments, and once an event has fired the host honours only item updates and toasts - other actions are ignored",
  },

  File: {
    icons: ["icon-32.svg", "icon-96.svg"],

    note: "the map is keyed by extension, so claiming one that another plugin also claims means the last plugin loaded wins",
  },

  PostMessage: {
    types: ["IPostMessageCallbackMessage"],

    members: `  postMessageCallback: (message: IPostMessageCallbackMessage) => void = () => {};

  setPostMessageCallback = (callback: (message: IPostMessageCallbackMessage) => void): void => {
    this.postMessageCallback = callback;
  };

  getPostMessageCallback = (): ((message: IPostMessageCallbackMessage) => void) =>
    this.postMessageCallback;
`,
  },

  ArticleButton: {
    note: "component renders into a hard 32x32 slot with overflow hidden - an IconButton from the kit, nothing wider; the whole portal shows at most five across all plugins",
  },

  ArticleNavigation: {
    icons: ["icon-20.svg"],

    note: "key becomes the page URL (/p/<key>) so it must be unique across every installed plugin; appears pins the entry to Section.Files / Accounts / Settings; the component is a whole page - lay it out with the kit's Heading and Text",
  },
};

/** camelCased scope name, for where a scope has to appear inside an identifier. */
export const camelCase = (name) => `${name.charAt(0).toLowerCase()}${name.slice(1)}`;

/** The scopes one plugin declares, paired with their contract and spec, plus the derived lists. */
export const selectScopes = (scopeNames) => {
  const all = scopeNames.map((name) => ({ name, contract: SCOPE_CONTRACT[name], spec: SCOPE_SPECS[name] }));
  const itemMapScopes = all.filter(({ contract }) => contract.field);

  const sdkTypes = new Set(BASE_SDK_TYPES);
  for (const { contract, spec } of all) {
    sdkTypes.add(contract.iface);
    if (contract.item) sdkTypes.add(contract.item);
    for (const type of spec.types ?? []) sdkTypes.add(type);
  }

  return {
    all,
    itemMapScopes,
    implementedInterfaces: ["IPlugin", ...all.map(({ contract }) => contract.iface)],
    sdkTypes: [...sdkTypes].sort(),
    itemIconFiles: [...new Set(all.flatMap(({ spec }) => spec.icons ?? []))],
  };
};
