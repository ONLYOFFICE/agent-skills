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
 * are about that severity. A global *we* failed to stub must stay a warning.
 */

import {
  articleButtonPlugin,
  contextMenuPlugin,
  contextMenuSource,
  manifestFor,
  onLoadPlugin,
  scopeSource,
} from "../fixtures.mjs";

export const title = "the bundle at runtime";

export default ({ workspace, check }) => {
  /** Same project throughout; only what the bundle does at load time changes. */
  const throwProject = (bundle) => ({
    pkg: manifestFor("throw", "FixtureThrow"),
    bundle,
    src: contextMenuSource({ pluginName: "FixtureThrow" }),
  });

  const onLoadThrows = workspace.validateProject(
    "throws",
    throwProject(
      onLoadPlugin({
        pluginName: "FixtureThrow",
        onLoadBody: `throw new Error("settings fetch failed");`,
      }),
    ),
  );

  check(
    "a throwing onLoadCallback is an error",
    !onLoadThrows.ok && onLoadThrows.errorCodes.includes("runtime"),
    onLoadThrows.errorSummary,
  );

  const topLevelThrows = workspace.validateProject(
    "throws-top",
    throwProject(
      `throw new Error("bad top-level work");\n${onLoadPlugin({ pluginName: "FixtureThrow" })}`,
    ),
  );

  check(
    "a bundle that throws at module scope is an error",
    !topLevelThrows.ok && topLevelThrows.errorCodes.includes("runtime"),
    topLevelThrows.errorSummary,
  );

  const missingApi = workspace.validateProject(
    "missing-api",
    throwProject(
      onLoadPlugin({
        pluginName: "FixtureThrow",
        onLoadBody: `IntersectionObserver.observe();`,
      }),
    ),
  );

  check(
    "an unstubbed browser API stays a warning",
    missingApi.ok && missingApi.warningCodes.includes("runtime"),
    missingApi.errorSummary,
  );

  // --- a scope with no way to refresh itself -----------------------------------
  //
  // Every other scope can be filled after installation with an update*Items action;
  // ArticleButton has none, so "register later" is impossible and an empty map terminal.

  const emptyArticleButtons = workspace.validateProject("article-button", {
    pkg: manifestFor("ab", "FixtureAb", { scopes: ["ArticleButton"] }),
    bundle: articleButtonPlugin({ pluginName: "FixtureAb" }),
    src: scopeSource({
      pluginName: "FixtureAb",
      adder: "addArticleButtonItem",
      getter: "getArticleButtonItems",
    }),
  });

  check(
    "an empty ArticleButton map is an error, not a warning",
    !emptyArticleButtons.ok &&
      emptyArticleButtons.mentions("no updateArticleButtonItems action to refresh it"),
    emptyArticleButtons.errorSummary,
  );

  // --- unbuilt project ---------------------------------------------------------
  //
  // Nothing to run is not a defect: the runtime pass is skipped and the report says why.

  const unbuiltDir = workspace.write("unbuilt", {
    pkg: manifestFor("good", "FixtureGood"),
    bundle: contextMenuPlugin({ pluginName: "FixtureGood" }),
    src: contextMenuSource({ pluginName: "FixtureGood" }),
  });

  workspace.remove(unbuiltDir, "dist");

  const unbuilt = workspace.validate(unbuiltDir);

  check(
    "unbuilt project warns instead of failing",
    unbuilt.ok && unbuilt.warningCodes.includes("dist"),
    unbuilt.errorSummary,
  );
};
