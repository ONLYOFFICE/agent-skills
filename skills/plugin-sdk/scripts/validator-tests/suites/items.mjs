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
};
