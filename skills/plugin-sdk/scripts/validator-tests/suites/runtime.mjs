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
 * What happens when the bundle runs. The portal awaits onLoadCallback during installation,
 * so a throw there leaves no CSS, no items and an empty console - the first expectations
 * are about that severity. A global *we* failed to stub must stay a warning. Then the
 * imports: the portal provides exactly five packages and refuses a bundle importing
 * anything else, and a bundled React breaks every hook.
 */

import {
  articleButtonPlugin,
  contextMenuPlugin,
  contextMenuProject,
  contextMenuSource,
  manifestFor,
  onLoadPlugin,
  scopeSource,
  settingsPlugin,
} from "../fixtures.mjs";

export const title = "the bundle at runtime";

export default ({ workspace, check }) => {
  /** Same project throughout; only what the bundle does at load time changes. */
  const throwProject = (bundle) => contextMenuProject("throw", "FixtureThrow", { bundle });

  const onLoadThrows = workspace.validateProject(
    "throws",
    throwProject(onLoadPlugin({ onLoadBody: `throw new Error("settings fetch failed");` })),
  );

  check(
    "a throwing onLoadCallback is an error",
    !onLoadThrows.ok && onLoadThrows.errorCodes.includes("runtime"),
    onLoadThrows.errorSummary,
  );

  const topLevelThrows = workspace.validateProject(
    "throws-top",
    throwProject(`throw new Error("bad top-level work");\n${onLoadPlugin({})}`),
  );

  check(
    "a bundle that throws at module scope is an error",
    !topLevelThrows.ok && topLevelThrows.errorCodes.includes("runtime"),
    topLevelThrows.errorSummary,
  );

  const hookAtTopLevel = workspace.validateProject(
    "hook-top",
    throwProject(`import { useCurrentFile } from "@onlyoffice/docspace-plugin-sdk/react";\nconst file = useCurrentFile();\n${onLoadPlugin({})}`),
  );

  check(
    "a hook called at module scope is an error that names the cause",
    !hookAtTopLevel.ok && hookAtTopLevel.mentions("Hooks only work inside the component DocSpace renders"),
    hookAtTopLevel.messageSummary,
  );

  const missingApi = workspace.validateProject(
    "missing-api",
    throwProject(onLoadPlugin({ onLoadBody: `IntersectionObserver.observe();` })),
  );

  check(
    "an unstubbed browser API stays a warning",
    missingApi.ok && missingApi.warningCodes.includes("runtime"),
    missingApi.errorSummary,
  );

  // --- what the bundle imports ---------------------------------------------------

  const foreignImport = workspace.validateProject(
    "foreign-import",
    throwProject(contextMenuPlugin({ imports: `import { debounce } from "lodash-es";\nimport { jsx } from "react/jsx-runtime";` })),
  );

  check(
    "a bare import the portal does not provide is an error naming it",
    !foreignImport.ok &&
      foreignImport.errorCodes.includes("dist") &&
      foreignImport.hasFindingMentioning('"lodash-es"', "which DocSpace does not provide"),
    foreignImport.messageSummary,
  );
  check(
    "the runtime pass is skipped when the bundle cannot load",
    !foreignImport.runtime.loaded && foreignImport.warningCodes.includes("runtime"),
  );

  const sdkRootExternal = workspace.validateProject(
    "sdk-root",
    throwProject(contextMenuPlugin({ imports: `import { Actions } from "@onlyoffice/docspace-plugin-sdk";\nimport { jsx } from "react/jsx-runtime";` })),
  );

  check(
    "an external SDK root is an error that says to bundle it",
    sdkRootExternal.errorsMention("the SDK root has to be bundled"),
    sdkRootExternal.messageSummary,
  );

  const kitSubpath = workspace.validateProject(
    "kit-subpath",
    throwProject(contextMenuPlugin({ imports: `import { Button } from "@docspace/ui-kit/components/button";\nimport { jsx } from "react/jsx-runtime";` })),
  );

  check(
    "a ui-kit subpath import is an error",
    kitSubpath.errorsMention("refuses a subpath"),
    kitSubpath.messageSummary,
  );

  const bundledReact = workspace.validateProject(
    "bundled-react",
    throwProject(`var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");\n${contextMenuPlugin({ imports: "" })}`),
  );

  check(
    "a bundled copy of React is an error",
    bundledReact.errorsMention("contains a copy of React"),
    bundledReact.messageSummary,
  );

  // --- the build config --------------------------------------------------------

  const noExternals = workspace.validateProject("no-externals", {
    pkg: manifestFor("ext", "FixtureExt"),
    bundle: contextMenuPlugin({}),
    src: contextMenuSource(),
    viteConfig: `export default { build: { lib: { entry: "src/index.ts" } } };`,
  });

  check(
    "a vite config without externals is an error",
    noExternals.errorCodes.includes("build") && noExternals.mentions("declares no rollupOptions.external"),
    noExternals.errorSummary,
  );

  const partialExternals = workspace.validateProject("partial-externals", {
    pkg: manifestFor("ext2", "FixtureExt2"),
    bundle: contextMenuPlugin({}),
    src: contextMenuSource(),
    viteConfig: `export default { build: { rollupOptions: { external: ["react", "react-dom", "@onlyoffice/docspace-plugin-sdk"] } } };`,
  });

  check(
    "a vite config missing an external names what is missing",
    partialExternals.errorsMention("does not list react/jsx-runtime") &&
      partialExternals.errorsMention("marks the SDK root"),
    partialExternals.messageSummary,
  );

  // --- a scope that registers nothing at load time -------------------------------

  const emptyArticleButtons = workspace.validateProject("article-button", {
    pkg: manifestFor("ab", "FixtureAb", { scopes: ["ArticleButton"] }),
    bundle: articleButtonPlugin(),
    src: scopeSource({ adder: "addArticleButtonItem", getter: "getArticleButtonItems" }),
  });

  check(
    "an empty map with an adder in the source is a warning naming the refresh action",
    emptyArticleButtons.ok &&
      emptyArticleButtons.warningsMention("Actions.updateArticleButtonItems"),
    emptyArticleButtons.messageSummary,
  );

  // --- the settings page -------------------------------------------------------

  const settingsSource = scopeSource({
    members: ["setAdminPluginSettingsValue", "getAdminPluginSettings"],
  });

  const settingsGood = workspace.validateProject("settings-good", {
    pkg: manifestFor("sg", "FixtureSg", { scopes: ["Settings"] }),
    bundle: settingsPlugin({ settings: `{ component: SettingsPage }` }),
    src: settingsSource,
  });

  check("a settings page given as a component passes", settingsGood.ok, settingsGood.errorSummary);

  const settingsEmpty = workspace.validateProject("settings-empty", {
    pkg: manifestFor("se", "FixtureSe", { scopes: ["Settings"] }),
    bundle: settingsPlugin({ settings: `null` }),
    src: settingsSource,
  });

  check(
    "a Settings scope with nothing registered is an error",
    settingsEmpty.errorsMention("getAdminPluginSettings() returns nothing"),
    settingsEmpty.messageSummary,
  );

  const settingsLegacy = workspace.validateProject("settings-legacy", {
    pkg: manifestFor("sl", "FixtureSl", { scopes: ["Settings"] }),
    bundle: settingsPlugin({ settings: `{ settings: { children: [] } }` }),
    src: settingsSource,
  });

  check(
    "a declarative settings tree is a deprecation warning",
    settingsLegacy.ok && settingsLegacy.warningCodes.includes("deprecated") && settingsLegacy.warningsMention("settings"),
    settingsLegacy.messageSummary,
  );

  // --- unbuilt project ---------------------------------------------------------
  //
  // Nothing to run is not a defect: the runtime pass is skipped and the report says why.

  const unbuiltDir = workspace.write("unbuilt", {
    pkg: manifestFor("good", "FixtureGood"),
    bundle: contextMenuPlugin({}),
    src: contextMenuSource(),
  });

  workspace.remove(unbuiltDir, "dist");

  const unbuilt = workspace.validate(unbuiltDir);

  check(
    "unbuilt project warns instead of failing",
    unbuilt.ok && unbuilt.warningCodes.includes("dist"),
    unbuilt.errorSummary,
  );
};
