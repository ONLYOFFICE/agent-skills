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
 * The manifest, the assets it points at, and how the bundle hands the plugin over - the
 * cheapest half of the validator, catching the most expensive defect: a bundle without a
 * default export, or without `runtime: "module"`, uploads and never becomes a plugin.
 */

import {
  contextMenuPlugin,
  contextMenuProject,
  contextMenuSource,
  manifestFor,
  multiScopePlugin,
  multiScopeSource,
  noDefaultExportPlugin,
  sourceWithWindowPlugins,
  windowPluginsSource,
} from "../fixtures.mjs";

export const title = "manifest, assets and registration";

export default ({ workspace, check }) => {
  // --- a plugin that satisfies the contract -----------------------------------

  const good = workspace.validateProject(
    "good",
    {
      pkg: manifestFor("good", "FixtureGood"),
      bundle: contextMenuPlugin({}),
      src: contextMenuSource(),
    },
    "--invoke",
  );

  check("valid plugin passes", good.ok, good.errorSummary);
  check("valid plugin loads through its default export", good.runtime.loaded);
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
      bundle: multiScopePlugin(),
      src: multiScopeSource(),
    },
    "--invoke",
  );

  check("broken plugin fails", !bad.ok);
  check("upper case name is an error", bad.errorCodes.includes("pkg.name"));
  check("unknown scope is an error", bad.mentions('unknown scope "NotAScope"'));
  check("dead createZip build script is an error", bad.errorCodes.includes("pkg.scripts"));
  check("missing logo asset is an error", bad.errorCodes.includes("pkg.logo"));
  check(
    "a runtime other than module is an error",
    bad.errorCodes.includes("pkg.runtime") && bad.mentions('"runtime": "react"'),
    'only "module" is a value the loader knows',
  );
  check("missing icon asset is an error", bad.errorCodes.includes("icon"));
  check(
    "commented-out icon is ignored",
    !bad.mentions("also-missing.svg"),
    "comments must be stripped before scanning for references",
  );

  // --- the SDK 2 shape: window.Plugins, no default export, no runtime ---------------
  //
  // The portal imports the bundle and reads `default`. A plugin written against SDK 2
  // hands nothing over, and without the runtime field its ES module never runs at all.

  const { runtime, ...withoutRuntime } = manifestFor("nodefault", "FixtureNoDefault");

  const sdkTwo = workspace.validateProject("sdk-two", {
    pkg: withoutRuntime,
    bundle: noDefaultExportPlugin(),
    src: windowPluginsSource({ pluginName: "FixtureNoDefault" }),
  });

  check(
    "a manifest without runtime is an error that names the fix",
    sdkTwo.errorCodes.includes("pkg.runtime") && sdkTwo.mentions('"runtime": "module"'),
    sdkTwo.errorSummary,
  );
  check(
    "a source without export default is an error",
    sdkTwo.errorCodes.includes("registration") && sdkTwo.mentions("export default"),
    sdkTwo.errorSummary,
  );
  check(
    "a bundle without a default export is an error",
    sdkTwo.errorCodes.includes("runtime") && sdkTwo.mentions("no default export"),
    sdkTwo.messageSummary,
  );

  const withWindow = workspace.validateProject("with-window", {
    pkg: manifestFor("window", "FixtureWindow"),
    bundle: contextMenuPlugin({}),
    src: sourceWithWindowPlugins({ pluginName: "FixtureWindow" }),
  });

  check(
    "window.Plugins next to a default export is a warning, not an error",
    withWindow.ok && withWindow.warningCodes.includes("registration"),
    withWindow.errorSummary,
  );

  // --- a scope the portal does not know ---------------------------------------
  //
  // A scope the installed SDK exports but the portal cannot host compiles, packs and
  // uploads without complaint, then renders nothing. A build error is kinder.

  const unknownScope = workspace.validateProject("nav", {
    pkg: manifestFor("nav", "FixtureNav", { scopes: ["ContextMenu", "Dashboard"] }),
    bundle: contextMenuPlugin({}),
    src: contextMenuSource(),
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
    unknownScope.mentions("ContextMenu") && unknownScope.mentions("ArticleNavigation"),
  );

  // --- stylesheets ------------------------------------------------------------
  //
  // Nothing reads the CSS: what is checkable without doing that is how the stylesheet is
  // imported and built, which is what decides whether it can collide with the portal at all.

  const styled = (slug, importLine) =>
    workspace.validateProject(slug, {
      pkg: manifestFor(slug, "FixtureStyled"),
      bundle: contextMenuPlugin({}),
      src: `${importLine}\n${contextMenuSource()}`,
    });

  const plainCss = styled("css-plain", `import "./styles.css";`);

  check(
    "a plain .css import is a warning that says nothing scopes it",
    plainCss.warningCodes.includes("css") && plainCss.hasFindingMentioning("plain stylesheet", "restyles ONLYOFFICE Apps"),
    plainCss.messagesFor("css"),
  );
  check(
    "an imported stylesheet the build did not emit is reported as not loaded",
    plainCss.hasFindingMentioning("no dist/plugin.css"),
    plainCss.messagesFor("css"),
  );

  const moduleCss = styled("css-module", `import styles from "./styles.module.css";`);

  check(
    "a CSS module built without generateScopedName is a warning naming the config",
    moduleCss.hasFindingMentioning("generateScopedName", "vite.config.ts"),
    moduleCss.messagesFor("css"),
  );
  check(
    "a CSS module is not also told to scope itself by hand",
    !moduleCss.mentions("plain stylesheet"),
    moduleCss.messagesFor("css"),
  );

  const noCss = workspace.validateProject("css-none", contextMenuProject("css-none", "FixtureNoCss"));

  check(
    "a plugin that imports no stylesheet is not asked about one",
    !noCss.warningCodes.includes("css"),
    noCss.messagesFor("css"),
  );
};
