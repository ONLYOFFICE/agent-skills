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
 * The manifest, the assets it points at, and the global the bundle registers under - the
 * cheapest half of the validator, catching the most expensive defect: a name mismatch
 * installs, enables and does nothing, with an empty console.
 */

import {
  contextMenuPlugin,
  contextMenuSource,
  manifestFor,
  multiScopePlugin,
  multiScopeSource,
  sourceRegisteringViaConstant,
} from "../fixtures.mjs";

export const title = "manifest, assets and registration";

export default ({ workspace, check }) => {
  // --- a plugin that satisfies the contract -----------------------------------

  const good = workspace.validateProject(
    "good",
    {
      pkg: manifestFor("good", "FixtureGood"),
      bundle: contextMenuPlugin({ pluginName: "FixtureGood" }),
      src: contextMenuSource({ pluginName: "FixtureGood" }),
    },
    "--invoke",
  );

  check("valid plugin passes", good.ok, good.errorSummary);
  check("valid plugin loads in the sandbox", good.runtime.loaded);
  check(
    "valid plugin reports its item count",
    good.runtime.items.ContextMenu === 1,
    JSON.stringify(good.runtime.items),
  );

  // --- every manifest-level silent failure at once -----------------------------

  const bad = workspace.validateProject(
    "bad",
    {
      pkg: manifestFor("bad", "FixtureBad", {
        name: "Fixture-Bad",
        logo: "missing-logo.svg",
        runtime: "react",
        scopes: ["ContextMenu", "MainButton", "InfoPanel", "NotAScope"],
        scripts: { build: "webpack && node ./createZip.js" },
      }),
      // Registers under the wrong name, which masks everything behind it.
      bundle: multiScopePlugin({ registerAs: "SomethingElse" }),
      src: multiScopeSource({ registerAs: "SomethingElse" }),
    },
    "--invoke",
  );

  check("broken plugin fails", !bad.ok);
  check("upper case name is an error", bad.errorCodes.includes("pkg.name"));
  check("unknown scope is an error", bad.mentions('unknown scope "NotAScope"'));
  check("dead createZip build script is an error", bad.errorCodes.includes("pkg.scripts"));
  check("missing logo asset is an error", bad.errorCodes.includes("pkg.logo"));
  check("react runtime is a warning", bad.warningCodes.includes("pkg.runtime"));
  check(
    "pluginName mismatch is reported",
    bad.mentions("window.Plugins.FixtureBad"),
    "the host merges window.Plugins[pluginName] and silently gets nothing",
  );
  check("missing icon asset is an error", bad.errorCodes.includes("icon"));
  check(
    "commented-out icon is ignored",
    !bad.mentions("also-missing.svg"),
    "comments must be stripped before scanning for references",
  );

  // --- registration through a constant ----------------------------------------

  const viaConstant = workspace.validateProject("const", {
    pkg: manifestFor("const", "FixtureConst"),
    bundle: contextMenuPlugin({ pluginName: "FixtureConst" }),
    src: sourceRegisteringViaConstant({ pluginName: "FixtureConst" }),
  });

  check(
    "registration through a constant is accepted",
    !viaConstant.errorCodes.includes("registration"),
    viaConstant.errorSummary,
  );

  // --- a scope the portal does not know ---------------------------------------
  //
  // A scope the installed SDK exports but the portal cannot host compiles, packs and
  // uploads without complaint, then renders nothing. A build error is kinder.

  const unknownScope = workspace.validateProject("nav", {
    pkg: manifestFor("nav", "FixtureNav", { scopes: ["ContextMenu", "Dashboard"] }),
    bundle: contextMenuPlugin({ pluginName: "FixtureNav" }),
    src: contextMenuSource({ pluginName: "FixtureNav" }),
  });

  check(
    "a scope outside the contract is rejected",
    !unknownScope.ok &&
      unknownScope.errorCodes.includes("pkg.scopes") &&
      unknownScope.mentions("Dashboard"),
    unknownScope.errorSummary,
  );
  check(
    "the rejection lists the scopes that are supported",
    unknownScope.mentions("ContextMenu") && unknownScope.mentions("ArticleButton"),
  );
};
