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
 * Registered items and the messages their callbacks return. One mistake runs through most
 * of it: the enum key where the host compares the value. `UsersType.owner` is "Owner",
 * `Actions.showModal` is "show-modal", and a wrong spelling is not a type error.
 */

import {
  contextMenuPlugin,
  contextMenuSource,
  filePlugin,
  groupActionPlugin,
  manifestFor,
  mapScopePlugin,
  multiScopePlugin,
  multiScopeSource,
  reactItemsPlugin,
  scopeSource,
} from "../fixtures.mjs";

export const title = "items, filters and messages";

export default ({ workspace, check }) => {
  // --- filter fields, payloads and a scope that registers nothing ---------------

  const items = workspace.validateProject(
    "filter",
    {
      pkg: manifestFor("filter", "FixtureFilter", {
        scopes: ["ContextMenu", "MainButton", "InfoPanel"],
      }),
      bundle: multiScopePlugin(),
      src: multiScopeSource(),
    },
    "--invoke",
  );

  check(
    "usersType on a ContextMenu item is an error",
    items.mentions("ContextMenu") && items.mentions("host reads usersTypes"),
  );
  check(
    "usersTypes on a MainButton item is an error",
    items.mentions("MainButton") && items.mentions("host reads usersType for"),
  );
  check(
    "show-toast without toastProps is an error",
    items.mentions('action "show-toast" without toastProps'),
  );
  check(
    "show-modal without modalDialogProps is an error",
    items.mentions('action "show-modal" without modalDialogProps'),
  );
  check(
    "a scope whose items are never registered is an error",
    items.mentions('scope "InfoPanel" is declared but addInfoPanelItem'),
  );

  // --- values the host compares exactly ----------------------------------------

  const values = workspace.validateProject("values", {
    pkg: manifestFor("values", "FixtureValues"),
    bundle: contextMenuPlugin({
      filters: `usersTypes: ["admin"], devices: ["phone"]`,
    }),
    src: contextMenuSource(),
  });

  check(
    "a usersTypes value outside the enum is an error",
    values.mentions('usersTypes contains "admin"'),
    "the enum keys are camelCase but the host matches the PascalCase values",
  );
  check("a devices value outside the enum is an error", values.mentions('contains "phone"'));

  // --- bulk actions: the group form is a different item ------------------------

  const groupOnly = workspace.validateProject(
    "group-action",
    {
      pkg: manifestFor("group-action", "FixtureGroup", { scopes: ["ContextMenu"] }),
      bundle: groupActionPlugin({ isGroupAction: true }),
      src: contextMenuSource(),
    },
    "--invoke",
  );

  check(
    "a group action with only onGroupClick is accepted",
    !groupOnly.errorsMention("onItemClick"),
    groupOnly.errorSummary,
  );

  const groupUnmarked = workspace.validateProject(
    "group-unmarked",
    {
      pkg: manifestFor("group-unmarked", "FixtureUnmarked", { scopes: ["ContextMenu"] }),
      bundle: groupActionPlugin({ isGroupAction: false }),
      src: contextMenuSource(),
    },
    "--invoke",
  );

  check(
    "onGroupClick without isGroupAction is an error, since the host calls onItemClick",
    groupUnmarked.errorsMention("not marked isGroupAction"),
    groupUnmarked.errorSummary,
  );

  // --- React surfaces: component or body, never neither --------------------------

  const react = workspace.validateProject("react-items", {
    pkg: manifestFor("react", "FixtureReact", { scopes: ["InfoPanel", "ArticleNavigation"] }),
    bundle: reactItemsPlugin(),
    src: `getInfoPanelItems(); getArticleNavigationItems(); const item = { icon: "logo.svg" }; export default plugin;`,
  });

  check(
    "an item with a React component and no body passes the shape check",
    !react.hasFindingMentioning('"fixture-react-good"'),
    react.messageSummary,
  );
  check(
    "a JSX element where a component is expected is an error",
    react.errorsMention('"fixture-react-element" component is a JSX element'),
    react.messageSummary,
  );
  check(
    "the deprecated body and onLoad are warnings, and the tree is not walked",
    react.warningCodes.includes("deprecated") &&
      react.hasFindingMentioning('"fixture-react-legacy"', "body") &&
      react.hasFindingMentioning('"fixture-react-legacy"', "onLoad"),
    react.messageSummary,
  );
  check(
    "an item with neither component nor body is an error",
    react.errorsMention('"fixture-react-empty" has neither component nor body'),
  );
  check(
    "an appears value outside Section is an error",
    react.errorsMention('appears contains "Dashboard"'),
    react.messageSummary,
  );

  // --- callbacks get the argument the host would pass --------------------------
  //
  // Handing every callback a bare id made correct File plugins look like they throw,
  // which trains people to ignore the warnings.

  const file = workspace.validateProject(
    "file",
    {
      pkg: manifestFor("file", "FixtureFile", { scopes: ["File"] }),
      bundle: filePlugin(),
      src: scopeSource({ adder: "addFileItem", getter: "getFileItems" }),
    },
    "--invoke",
  );

  check(
    "a File onClick reading its file argument does not look like a throw",
    file.ok && !file.mentions("threw"),
    `findings: ${file.messageSummary}`,
  );

  // --- action strings the host will not match ----------------------------------

  const action = workspace.validateProject(
    "action",
    {
      pkg: manifestFor("action", "FixtureAction"),
      bundle: contextMenuPlugin({
        click: `return { actions: ["showToast"], toastProps: [{ type: "success", title: "done" }] };`,
      }),
      src: contextMenuSource(),
    },
    "--invoke",
  );

  check(
    "an action given as the enum key is an error",
    !action.ok && action.hasFindingMentioning('"showToast"', 'the value is "show-toast"'),
    action.messageSummary,
  );

  // --- a hook called from a class-side callback ---------------------------------
  //
  // A context menu click has no runtime context; the hooks only work inside the component
  // ONLYOFFICE Apps renders. The finding has to say that rather than "threw".

  const hookInCallback = workspace.validateProject(
    "hook-in-callback",
    {
      pkg: manifestFor("hook", "FixtureHook"),
      bundle: contextMenuPlugin({
        click: `const { showToast } = usePluginActions(); showToast({ type: "success", title: "x" });`,
      }),
      src: contextMenuSource(),
    },
    "--invoke",
  );

  check(
    "a hook called from a callback is an error that names the fix",
    hookInCallback.errorCodes.includes("message") &&
      hookInCallback.mentions("A class-side callback has no runtime context"),
    hookInCallback.messageSummary,
  );

  // --- a click whose request fails and nothing catches it -----------------------
  //
  // The sandbox refuses every request, which is exactly the portal's case whenever the
  // request fails: the rejection escapes and the click does nothing.

  const uncaught = workspace.validateProject(
    "uncaught-fetch",
    {
      pkg: manifestFor("uncaught-fetch", "FixtureUncaught"),
      bundle: contextMenuPlugin({
        click: `await fetch("https://portal.example.com/api/2.0/files/file/1", { credentials: "include" });
        return { actions: ["show-toast"], toastProps: [{ type: "success", title: "done" }] };`,
      }),
      src: contextMenuSource(),
    },
    "--invoke",
  );

  check(
    "a click that fetches with no catch is an error, not a warning",
    uncaught.errorsMention("threw after its request failed") && !uncaught.mentions("took its failure path"),
    uncaught.messageSummary,
  );

  const caughtThenThrew = workspace.validateProject(
    "caught-then-threw",
    {
      pkg: manifestFor("caught-then-threw", "FixtureCaughtThenThrew"),
      bundle: contextMenuPlugin({
        click: `try { await fetch("https://portal.example.com/api/2.0/files/file/1"); } catch {}
        return null.actions;`,
      }),
      src: contextMenuSource(),
    },
    "--invoke",
  );

  check(
    "a click that caught its request and then threw something else stays a warning",
    !caughtThenThrew.errorsMention("threw after its request failed") && caughtThenThrew.warningsMention("threw"),
    caughtThenThrew.messageSummary,
  );

  // --- submenu children carry their parent's mistakes ----------------------------

  const submenu = workspace.validateProject(
    "submenu",
    {
      pkg: manifestFor("submenu", "FixtureSubmenu"),
      bundle: mapScopePlugin({
        field: "items",
        adder: "addContextMenuItem",
        getter: "getContextMenuItems",
        onLoadBody: `
    this.items.set("fixture-submenu-parent", {
      key: "fixture-submenu-parent", label: "Parent", icon: "logo.svg",
      items: [
        { key: "fixture-submenu-a", label: "A", icon: "logo.svg", usersType: ["Owner"],
          async onItemClick() { return { actions: ["show-toast"] }; } },
        { key: "fixture-submenu-b", label: "B", icon: "logo.svg" },
        { key: "fixture-submenu-c", label: "C", icon: "logo.svg",
          async onClick() { return { actions: ["open-info-panel", "update-create-dialog-modal"], createDialogProps: {} }; } },
        { key: "fixture-submenu-d", label: "D", icon: "logo.svg",
          async onGroupClick() { return { actions: [] }; } },
      ],
    });`,
      }),
      src: contextMenuSource(),
    },
    "--invoke",
  );

  check(
    "the wrong filter field on a submenu child is an error",
    submenu.errorsMention('> "fixture-submenu-a" uses usersType'),
    submenu.messageSummary,
  );
  check(
    "a submenu child's click is invoked and its message is reported against the child",
    submenu.errorsMention('> "fixture-submenu-a" onItemClick returns action "show-toast" without toastProps'),
    submenu.messageSummary,
  );
  check(
    "a submenu child with only onGroupClick and no isGroupAction is an error",
    submenu.errorsMention('> "fixture-submenu-d" has only onGroupClick but is not marked isGroupAction'),
    submenu.messageSummary,
  );
  check(
    "a submenu child with no click is an error",
    submenu.errorsMention('> "fixture-submenu-b" has neither onItemClick nor nested items'),
    submenu.messageSummary,
  );
  check(
    "a deprecated onClick on a context menu item is a warning",
    submenu.warningCodes.includes("deprecated") && submenu.warningsMention("name it onItemClick"),
    submenu.messageSummary,
  );
  check(
    "open-info-panel without a tab is a warning",
    submenu.warningsMention('"open-info-panel" without infoPanelTab'),
    submenu.messageSummary,
  );
  check(
    "update-create-dialog-modal from a menu click is a warning",
    submenu.warningsMention('"update-create-dialog-modal", which the portal ignores from this callback'),
    submenu.messageSummary,
  );

  // --- scope-specific shapes ---------------------------------------------------

  const mainButton = workspace.validateProject("main-button-dead", {
    pkg: manifestFor("main-button-dead", "FixtureMainDead", { scopes: ["MainButton"] }),
    bundle: mapScopePlugin({
      field: "items",
      adder: "addMainButtonItem",
      getter: "getMainButtonItems",
      onLoadBody: `this.items.set("fixture-main-button-dead-new", { key: "fixture-main-button-dead-new", label: "New thing", icon: "logo.svg" });`,
    }),
    src: scopeSource({ adder: "addMainButtonItem", getter: "getMainButtonItems" }),
  });

  check(
    "a main button item with no click and no children is an error",
    mainButton.errorsMention("has neither onItemClick nor nested items"),
    mainButton.messageSummary,
  );

  const extension = workspace.validateProject("file-no-dot", {
    pkg: manifestFor("file-no-dot", "FixtureNoDot", { scopes: ["File"] }),
    bundle: mapScopePlugin({
      field: "files",
      adder: "addFileItem",
      getter: "getFileItems",
      onLoadBody: `this.files.set("thing", { extension: "thing", fileTypeName: "Thing", async onClick() {} });`,
    }),
    src: scopeSource({ adder: "addFileItem", getter: "getFileItems" }),
  });

  check(
    "a File extension without its dot is an error",
    extension.errorsMention('extension "thing" has no leading dot'),
    extension.messageSummary,
  );

  const navIcon = workspace.validateProject("nav-png", {
    pkg: manifestFor("nav-png", "FixtureNavPng", { scopes: ["ArticleNavigation"] }),
    bundle: mapScopePlugin({
      field: "pages",
      adder: "addArticleNavigationItem",
      getter: "getArticleNavigationItems",
      onLoadBody: `this.pages.set("fixture-nav-png-page", { key: "fixture-nav-png-page", label: "Page", icon: "logo.png", component: () => null });`,
    }),
    src: scopeSource({ adder: "addArticleNavigationItem", getter: "getArticleNavigationItems" }),
    assets: ["logo.svg", "logo.png"],
  });

  check(
    "an ArticleNavigation icon that is not an SVG is an error",
    navIcon.errorsMention('icon "logo.png" is not an SVG'),
    navIcon.messageSummary,
  );

  const roles = workspace.validateProject("user-role", {
    pkg: manifestFor("user-role", "FixtureUserRole"),
    bundle: contextMenuPlugin({ filters: `usersTypes: ["FullAdmin", "PortalUser"]` }),
    src: contextMenuSource(),
  });

  check(
    "UserRole values are accepted as the portal accepts them",
    !roles.errorsMention("is not a valid value"),
    roles.messageSummary,
  );
};
