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
 * The plugin material the suites are built from: manifests, hand-written bundles, sources.
 * Every builder takes the plugin name as a parameter and stays close to the shape a real
 * plugin has - the loader is not fussy, and a fixture that cheats would prove nothing.
 */

/** A manifest that satisfies every static check. */
export const manifestFor = (slug, pluginName, overrides = {}) => ({
  name: `fixture-${slug}`,
  pluginName,
  version: "1.0.0",
  logo: "logo.svg",
  scopes: ["ContextMenu"],
  scripts: { build: "webpack && npx build-docspace-plugin" },
  ...overrides,
});

/** What a well-behaved click returns. */
export const TOAST_MESSAGE = `return { actions: ["show-toast"], toastProps: [{ type: "success", title: "done" }] };`;

/**
 * A one-item ContextMenu plugin - the baseline every other fixture varies. `filters` and
 * `click` are source text, since what is under test is often a literal the SDK would type
 * away: "owner" for "Owner", "showToast" for "show-toast".
 */
export const contextMenuPlugin = ({
  pluginName,
  itemKey = "fixture-good-item",
  // "Owner" is the UsersType *value*; "owner" is the enum key and matches nobody.
  filters = `usersTypes: ["Owner"]`,
  click = TOAST_MESSAGE,
}) => `
window.Plugins.${pluginName} = {
  status: "active",
  items: new Map(),
  onLoadCallback: async function () {
    this.items.set("${itemKey}", {
      key: "${itemKey}",
      label: "Do the thing",
      icon: "logo.svg",
      ${filters},
      onItemClick: async function () {
        ${click}
      },
    });
  },
  updateStatus: function (s) { this.status = s; },
  getStatus: function () { return this.status; },
  setOnLoadCallback: function (cb) { this.onLoadCallback = cb; },
  addContextMenuItem: function (item) { this.items.set(item.key, item); },
  getContextMenuItems: function () { return this.items; },
};
`;

/** A plugin whose onLoadCallback runs arbitrary code - used for the throwing cases. */
export const onLoadPlugin = ({ pluginName, onLoadBody = "" }) => `
window.Plugins.${pluginName} = {
  status: "active", items: new Map(),
  onLoadCallback: async function () { ${onLoadBody} },
  updateStatus: function (s) { this.status = s; },
  getStatus: function () { return this.status; },
  setOnLoadCallback: function (cb) { this.onLoadCallback = cb; },
  addContextMenuItem: function (i) { this.items.set(i.key, i); },
  getContextMenuItems: function () { return this.items; },
};
`;

/**
 * Three scopes at once with a defect in each: wrong filter fields, actions without their
 * payloads, a missing icon, an InfoPanel getter that never receives an item. `registerAs`
 * is separate from `pluginName` so the bundle can register under the wrong global.
 */
export const multiScopePlugin = ({ registerAs }) => `
window.Plugins.${registerAs} = {
  status: "active",
  contextItems: new Map(),
  mainItems: new Map(),
  onLoadCallback: async function () {
    this.contextItems.set("k", { key: "k", label: "l", icon: "nope.svg", usersType: ["owner"],
      onItemClick: async function () { return { actions: ["show-toast"] }; } });
    this.mainItems.set("m", { key: "m", label: "l", icon: "logo.svg", usersTypes: ["owner"],
      onClick: async function () { return { actions: ["show-modal"] }; } });
  },
  updateStatus: function (s) { this.status = s; },
  getStatus: function () { return this.status; },
  setOnLoadCallback: function (cb) { this.onLoadCallback = cb; },
  getContextMenuItems: function () { return this.contextItems; },
  getMainButtonItems: function () { return this.mainItems; },
  getInfoPanelItems: function () { return new Map(); },
};
`;

/** An ArticleButton plugin that registers nothing - the map it cannot refresh later. */
export const articleButtonPlugin = ({ pluginName }) => `
window.Plugins.${pluginName} = {
  status: "active", ab: new Map(),
  onLoadCallback: async function () {},
  updateStatus: function (s) { this.status = s; },
  getStatus: function () { return this.status; },
  setOnLoadCallback: function (cb) { this.onLoadCallback = cb; },
  addArticleButtonItem: function (i) { this.ab.set(i.key, i); },
  getArticleButtonItems: function () { return this.ab; },
};
`;

/** A File plugin whose onClick reads the file object the host passes it. */
export const filePlugin = ({ pluginName }) => `
window.Plugins.${pluginName} = {
  status: "active", files: new Map(),
  onLoadCallback: async function () {
    this.files.set(".thing", { extension: ".thing", fileTypeName: "Thing",
      onClick: async function (file) {
        return { actions: ["show-toast"], toastProps: [{ type: "info", title: file.title.toUpperCase() }] };
      } });
  },
  updateStatus: function (s) { this.status = s; },
  getStatus: function () { return this.status; },
  setOnLoadCallback: function (cb) { this.onLoadCallback = cb; },
  addFileItem: function (i) { this.files.set(i.extension, i); },
  getFileItems: function () { return this.files; },
};
`;

// --- sources ----------------------------------------------------------------
//
// The validator reads src/ separately from the bundle, so a fixture's source has to
// mention the same members its bundle defines - otherwise static checks fire for reasons
// the suite is not testing.

export const contextMenuSource = ({ pluginName }) => `
window.Plugins.${pluginName} = plugin || {};
addContextMenuItem(item);
getContextMenuItems();
const item = { icon: "logo.svg" };
`;

/**
 * Plugins often lift the global name into a constant, and reading only the dotted form
 * would reject a working plugin - worse than missing a broken one.
 */
export const sourceRegisteringViaConstant = ({ pluginName }) => `
const PLUGIN_GLOBAL_NAME = "${pluginName}";
window.Plugins = window.Plugins || {};
window.Plugins[PLUGIN_GLOBAL_NAME] = plugin;
addContextMenuItem(item);
getContextMenuItems();
const item = { icon: "logo.svg" };
`;

/** Carries a commented-out icon: comments must be stripped before scanning. */
export const multiScopeSource = ({ registerAs }) => `
window.Plugins.${registerAs} = plugin || {};
getContextMenuItems();
getMainButtonItems();
getInfoPanelItems();
const item = { icon: "nope.svg" };
// const commented = { icon: "also-missing.svg" };
`;

/** Minimal source for a scope other than ContextMenu. */
export const scopeSource = ({ pluginName, adder, getter }) =>
  `window.Plugins.${pluginName} = plugin || {};\n${adder}(item);\n${getter}();\n`;
