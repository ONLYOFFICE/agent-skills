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
 * Bundles are the shape Vite emits - an ES module with a default export importing what a
 * React plugin imports - and stay close to a real plugin, since a fixture that cheats proves nothing.
 */

/** A manifest that satisfies every static check. */
export const manifestFor = (slug, pluginName, overrides = {}) => ({
  name: `fixture-${slug}`,
  pluginName,
  version: "1.0.0",
  runtime: "module",
  logo: "logo.svg",
  scopes: ["ContextMenu"],
  scripts: { build: "vite build && npx build-docspace-plugin" },
  ...overrides,
});

/** A vite.config.ts that keeps every host-provided package external. */
export const VITE_CONFIG = `
export default {
  build: {
    lib: { entry: "src/index.ts", formats: ["es"] },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "@onlyoffice/docspace-plugin-sdk/react", /^@docspace\\/ui-kit(\\/.*)?$/],
    },
  },
};
`;

const TOAST_MESSAGE = `return { actions: ["show-toast"], toastProps: [{ type: "success", title: "done" }] };`;

/** The IPlugin members every fixture class carries. */
const pluginMembers = `
  status: "active",
  updateStatus(s) { this.status = s; },
  getStatus() { return this.status; },
  setOnLoadCallback(cb) { this.onLoadCallback = cb; },`;

/**
 * A one-map plugin - the skeleton every map-scope fixture varies: which map, what
 * onLoadCallback does, and whether it is handed over by `export default` or the SDK 2 way.
 */
const mapScopePlugin = ({
  field = "items",
  adder = "addContextMenuItem",
  getter = "getContextMenuItems",
  onLoadBody = "",
  exportDefault = true,
  windowPlugins,
  imports = "",
  prelude = "",
}) => `${imports}${prelude}
const plugin = {${pluginMembers}
  ${field}: new Map(),
  async onLoadCallback() { ${onLoadBody} },
  ${adder}(i) { this.${field}.set(i.key, i); },
  ${getter}() { return this.${field}; },
};
${windowPlugins ? `window.Plugins = window.Plugins || {};\nwindow.Plugins.${windowPlugins} = plugin;\n` : ""}${exportDefault ? "export default plugin;\n" : ""}`;

/**
 * A one-item ContextMenu plugin - the baseline. It imports what a Vite build of a React
 * plugin imports, so the loader's rewriting is exercised. `filters` and `click` are source
 * text, since what is under test is often a literal the SDK would type away: "owner" for
 * "Owner", "showToast" for "show-toast".
 */
export const contextMenuPlugin = ({
  itemKey = "fixture-good-item",
  filters = `usersTypes: ["Owner"]`,
  click = TOAST_MESSAGE,
  imports = `import { jsx } from "react/jsx-runtime";\nimport { useState } from "react";\nimport { Button, ButtonSize } from "@docspace/ui-kit";\nimport { usePluginActions } from "@onlyoffice/docspace-plugin-sdk/react";`,
}) =>
  mapScopePlugin({
    imports,
    prelude: `\nconst Panel = () => jsx("div", { children: "panel" });`,
    onLoadBody: `
    this.items.set("${itemKey}", {
      key: "${itemKey}",
      label: "Do the thing",
      icon: "logo.svg",
      ${filters},
      async onItemClick() {
        ${click}
      },
    });
  `,
  });

/**
 * A ContextMenu plugin registering one bulk item. `isGroupAction` decides which of the two
 * forms it is; the item never carries onItemClick - the shape the host expects from a group
 * action and refuses from a plain one.
 */
export const groupActionPlugin = ({ isGroupAction = true }) =>
  mapScopePlugin({
    onLoadBody: `
    this.items.set("fixture-bulk", {
      key: "fixture-bulk",
      label: "Push all of them",
      icon: "logo.svg",
      isGroupAction: ${isGroupAction},
      async onGroupClick() {
        ${TOAST_MESSAGE}
      },
    });
  `,
  });

/** A plugin whose onLoadCallback runs arbitrary code - for the throwing cases. */
export const onLoadPlugin = ({ onLoadBody = "" }) => mapScopePlugin({ onLoadBody });

/** A bundle with no default export - the SDK 2 shape, registering on window.Plugins. */
export const noDefaultExportPlugin = () =>
  mapScopePlugin({ exportDefault: false, windowPlugins: "FixtureNoDefault" });

/** An ArticleButton plugin that registers nothing at load time. */
export const articleButtonPlugin = () =>
  mapScopePlugin({ field: "ab", adder: "addArticleButtonItem", getter: "getArticleButtonItems" });

/**
 * Three scopes at once with a defect in each: wrong filter fields, actions without their
 * payloads, a missing icon, an InfoPanel getter that never receives an item.
 */
export const multiScopePlugin = () => `
const plugin = {${pluginMembers}
  contextItems: new Map(),
  mainItems: new Map(),
  async onLoadCallback() {
    this.contextItems.set("k", { key: "k", label: "l", icon: "nope.svg", usersType: ["owner"],
      async onItemClick() { return { actions: ["show-toast"] }; } });
    this.mainItems.set("m", { key: "m", label: "l", icon: "logo.svg", usersTypes: ["owner"],
      async onClick() { return { actions: ["show-modal"] }; } });
  },
  getContextMenuItems() { return this.contextItems; },
  getMainButtonItems() { return this.mainItems; },
  getInfoPanelItems() { return new Map(); },
};
export default plugin;
`;

/**
 * React-surface scopes: an InfoPanel tab with a component, one with a JSX element by mistake,
 * one with the deprecated body, one with nothing, and an ArticleNavigation item with a wrong section.
 */
export const reactItemsPlugin = () => `
import { jsx } from "react/jsx-runtime";
const Tab = () => jsx("p", { children: "tab" });
const Page = () => jsx("p", { children: "page" });
const plugin = {${pluginMembers}
  tabs: new Map(),
  nav: new Map(),
  async onLoadCallback() {
    this.tabs.set("fixture-react-good", { key: "fixture-react-good", subMenu: { name: "Good" }, component: Tab });
    this.tabs.set("fixture-react-element", { key: "fixture-react-element", subMenu: { name: "Element" }, component: jsx(Tab, {}) });
    this.tabs.set("fixture-react-legacy", { key: "fixture-react-legacy", subMenu: { name: "Legacy" },
      body: { children: [] }, onLoad: async () => ({ body: { children: [] } }) });
    this.tabs.set("fixture-react-empty", { key: "fixture-react-empty", subMenu: { name: "Empty" } });
    this.nav.set("fixture-react-page", { key: "fixture-react-page", label: "Page", icon: "logo.svg", component: Page, appears: ["Dashboard"] });
  },
  getInfoPanelItems() { return this.tabs; },
  getArticleNavigationItems() { return this.nav; },
};
export default plugin;
`;

/** A File plugin whose onClick reads the file object the host passes it. */
export const filePlugin = () => `
const plugin = {${pluginMembers}
  files: new Map(),
  async onLoadCallback() {
    this.files.set(".thing", { extension: ".thing", fileTypeName: "Thing",
      async onClick(file) {
        return { actions: ["show-toast"], toastProps: [{ type: "info", title: file.title.toUpperCase() }] };
      } });
  },
  addFileItem(i) { this.files.set(i.extension, i); },
  getFileItems() { return this.files; },
};
export default plugin;
`;

/** A Settings plugin: `settings` is source text for the ISettings object it registers. */
export const settingsPlugin = ({ settings }) => `
import { jsx } from "react/jsx-runtime";
const SettingsPage = () => jsx("p", { children: "settings" });
const plugin = {${pluginMembers}
  adminPluginSettings: null,
  async onLoadCallback() { this.adminPluginSettings = ${settings}; },
  setAdminPluginSettings(s) { this.adminPluginSettings = s; },
  setAdminPluginSettingsValue() {},
  getAdminPluginSettings() { return this.adminPluginSettings; },
};
export default plugin;
`;

// --- sources ----------------------------------------------------------------
//
// The validator reads src/ separately from the bundle, so a fixture's source has to mention
// the same members its bundle defines - otherwise static checks fire for reasons the suite
// is not testing.

/** A source naming the given members, with an icon reference and optional extra lines. */
export const pluginSource = ({
  adders = [],
  getters = [],
  members = [],
  icon = "logo.svg",
  windowPlugins,
  exportDefault = true,
  extra = "",
}) =>
  [
    windowPlugins ? `window.Plugins.${windowPlugins} = plugin || {};` : "const plugin = {};",
    ...adders.map((adder) => `${adder}(item);`),
    ...getters.map((getter) => `${getter}();`),
    ...members.map((member) => `${member}();`),
    icon ? `const item = { icon: "${icon}" };` : "",
    extra,
    exportDefault ? "export default plugin;" : "",
  ]
    .filter(Boolean)
    .join("\n") + "\n";

export const contextMenuSource = () => pluginSource({ adders: ["addContextMenuItem"], getters: ["getContextMenuItems"] });

/** The SDK 2 registration, with no default export. */
export const windowPluginsSource = ({ pluginName }) =>
  pluginSource({ adders: ["addContextMenuItem"], getters: ["getContextMenuItems"], windowPlugins: pluginName, exportDefault: false });

/** Exports the plugin and still assigns window.Plugins - harmless, worth a word. */
export const sourceWithWindowPlugins = ({ pluginName }) =>
  pluginSource({ adders: ["addContextMenuItem"], getters: ["getContextMenuItems"], windowPlugins: pluginName });

/** Carries a commented-out icon: comments must be stripped before scanning. */
export const multiScopeSource = () =>
  pluginSource({
    getters: ["getContextMenuItems", "getMainButtonItems", "getInfoPanelItems"],
    icon: "nope.svg",
    extra: `// const commented = { icon: "also-missing.svg" };`,
  });

/** Minimal source for a scope other than ContextMenu. */
export const scopeSource = ({ adder, getter, members = [] }) =>
  pluginSource({ adders: adder ? [adder] : [], getters: getter ? [getter] : [], members, icon: null });

/**
 * Two React surfaces from the opposite ends of the current-file table: an info panel tab,
 * which the portal renders over a selection, and a sidebar page, which never has one. Each
 * body is source text so a suite can decide what the component does with the hook.
 * `kit` adds the UI kit import, for the bodies that render through the stubbed kit; `memo`
 * registers the page as a memo object rather than a function, which the portal renders too.
 */
export const renderSurfacesPlugin = ({ tabBody, pageBody, kit = "", memo = false }) => `
import { jsx } from "react/jsx-runtime";
import { useCurrentFile } from "@onlyoffice/docspace-plugin-sdk/react";
${kit ? `import { ${kit} } from "@docspace/ui-kit";` : ""}

const Tab = () => { ${tabBody} };
const PageBody = () => { ${pageBody} };
const Page = ${memo ? `{ $$typeof: Symbol.for("react.memo"), type: PageBody }` : "PageBody"};

const plugin = {${pluginMembers}
  tabs: new Map(),
  nav: new Map(),
  async onLoadCallback() {
    this.tabs.set("fixture-tab", { key: "fixture-tab", subMenu: { name: "Tab" }, component: Tab });
    this.nav.set("fixture-page", { key: "fixture-page", label: "Page", icon: "logo.svg", component: Page });
  },
  addInfoPanelItem(i) { this.tabs.set(i.key, i); },
  addArticleNavigationItem(i) { this.nav.set(i.key, i); },
  getInfoPanelItems() { return this.tabs; },
  getArticleNavigationItems() { return this.nav; },
};
export default plugin;
`;

/** A ContextMenu click that opens a dialog whose body is rendered - the modal-side surface. */
export const modalSurfacePlugin = ({ dialogBody }) => `
import { jsx } from "react/jsx-runtime";
import { useCurrentFile } from "@onlyoffice/docspace-plugin-sdk/react";

const Dialog = () => { ${dialogBody} };

const plugin = {${pluginMembers}
  items: new Map(),
  async onLoadCallback() {
    this.items.set("fixture-modal", {
      key: "fixture-modal", label: "Open", icon: "logo.svg",
      async onItemClick() {
        return { actions: ["show-modal"], modalDialogProps: { dialogHeader: "Hi", dialogBodyComponent: Dialog } };
      },
    });
  },
  addContextMenuItem(i) { this.items.set(i.key, i); },
  getContextMenuItems() { return this.items; },
};
export default plugin;
`;

/** The source a render fixture needs: the getters its declared scopes require. */
export const renderSurfacesSource = () =>
  pluginSource({
    adders: ["addInfoPanelItem", "addArticleNavigationItem"],
    getters: ["getInfoPanelItems", "getArticleNavigationItems"],
    icon: null,
  });

/** The common project shape: a ContextMenu plugin under a fresh manifest. */
export const contextMenuProject = (slug, pluginName, { bundle, click, src } = {}) => ({
  pkg: manifestFor(slug, pluginName),
  bundle: bundle ?? contextMenuPlugin(click === undefined ? {} : { click }),
  src: src ?? contextMenuSource(),
});
