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
  manifestFor,
  multiScopePlugin,
  multiScopeSource,
  scopeSource,
} from "../fixtures.mjs";

export const title = "items, filters and messages";

export default ({ workspace, check }) => {
  // --- filter fields, payloads and a scope that registers nothing ---------------
  //
  // The manifest suite's broken bundle, registered under the right name: the defects the
  // mismatch masked become visible, which is why an audit fixes the name first.

  const items = workspace.validateProject(
    "filter",
    {
      pkg: manifestFor("filter", "FixtureFilter", {
        scopes: ["ContextMenu", "MainButton", "InfoPanel"],
      }),
      bundle: multiScopePlugin({ registerAs: "FixtureFilter" }),
      src: multiScopeSource({ registerAs: "FixtureFilter" }),
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
      pluginName: "FixtureValues",
      filters: `usersTypes: ["admin"], devices: ["phone"]`,
    }),
    src: contextMenuSource({ pluginName: "FixtureValues" }),
  });

  check(
    "a usersTypes value outside the enum is an error",
    values.mentions('usersTypes contains "admin"'),
    "the enum keys are camelCase but the host matches the PascalCase values",
  );
  check("a devices value outside the enum is an error", values.mentions('contains "phone"'));

  // --- callbacks get the argument the host would pass --------------------------
  //
  // Handing every callback a bare id made correct File plugins look like they throw,
  // which trains people to ignore the warnings.

  const file = workspace.validateProject(
    "file",
    {
      pkg: manifestFor("file", "FixtureFile", { scopes: ["File"] }),
      bundle: filePlugin({ pluginName: "FixtureFile" }),
      src: scopeSource({ pluginName: "FixtureFile", adder: "addFileItem", getter: "getFileItems" }),
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
        pluginName: "FixtureAction",
        click: `return { actions: ["showToast"], toastProps: [{ type: "success", title: "done" }] };`,
      }),
      src: contextMenuSource({ pluginName: "FixtureAction" }),
    },
    "--invoke",
  );

  check(
    "an action given as the enum key is an error",
    !action.ok && action.hasFindingMentioning('"showToast"', 'the value is "show-toast"'),
    action.messageSummary,
  );
};
