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
 * The render pass: every component is rendered once with the runtime its surface really
 * gets, because a component that throws on first render is a blank page on the portal and
 * nothing else here would notice. The same code is a defect on a page and correct in an
 * info panel tab - which is the whole point of rendering each surface with its own runtime.
 */

import {
  contextMenuProject,
  contextMenuSource,
  FETCH_THEN_MODAL_ANYWAY_CLICK,
  FETCH_THEN_MODAL_CLICK,
  FETCH_THEN_TOAST_CLICK,
  manifestFor,
  modalSurfacePlugin,
  opensModalSource,
  renderSurfacesPlugin,
  renderSurfacesSource,
} from "../fixtures.mjs";

export const title = "render";

const READS_FILE = `const file = useCurrentFile(); return jsx("p", { children: file.title });`;
const GUARDED = `const file = useCurrentFile(); return jsx("p", { children: file ? file.title : "nothing selected" });`;
const KIT_THEME = `const { isBase, currentColorScheme } = useTheme();
  return jsx(Text, { color: currentColorScheme.main.accent, children: isBase ? "light" : "dark" });`;
// load() is a synchronous read the SDK's examples make in a lazy useState initialiser - during
// render; save() is a write, and from render it would run on every re-render.
const SETTINGS_READ = `const saved = usePluginSettings().load(); return jsx("p", { children: saved ? "saved" : "nothing saved" });`;
const SETTINGS_WRITE = `usePluginSettings().save({ apiKey: "" }); return jsx("p", { children: "saved" });`;

export default ({ workspace, check }) => {
  const surfaces = (dirName, bodies) => {
    const dir = workspace.write(dirName, {
      pkg: manifestFor(dirName, "FixtureRender", { scopes: ["InfoPanel", "ArticleNavigation"] }),
      bundle: renderSurfacesPlugin(bodies),
      src: renderSurfacesSource(),
    });

    workspace.installRenderer(dir);
    return workspace.validate(dir);
  };

  const unguarded = surfaces("render-unguarded", { tabBody: READS_FILE, pageBody: READS_FILE });

  check(
    "a page that reads useCurrentFile() without a guard is a render error",
    unguarded.hasFindingMentioning("ArticleNavigation", "threw while rendering", "useCurrentFile() null"),
    unguarded.messageSummary,
  );
  check(
    "the same code in an info panel tab is not reported - that surface has a selection",
    !unguarded.messagesFor("render").includes("InfoPanel"),
    unguarded.messagesFor("render"),
  );
  check(
    "the error says what the user would see",
    unguarded.errorsMention("renders as nothing at all"),
    unguarded.messageSummary,
  );

  const guarded = surfaces("render-guarded", { tabBody: GUARDED, pageBody: GUARDED });

  check(
    "guarded components render clean",
    guarded.ok && !guarded.errorCodes.includes("render"),
    guarded.messageSummary,
  );
  check(
    "both surfaces were actually rendered",
    guarded.runtime.render?.rendered === 2,
    JSON.stringify(guarded.runtime.render),
  );

  const memo = surfaces("render-memo", { tabBody: GUARDED, pageBody: GUARDED, memo: true });

  check(
    "a page registered as a memo object is rendered, not skipped",
    memo.runtime.render?.rendered === 2,
    JSON.stringify(memo.runtime.render),
  );

  // The kit's own hooks return values; a stub that answered undefined would report the
  // component that destructures one - correct code - as a component that throws.
  const kitHook = surfaces("render-kit-hook", {
    kit: "useTheme, Text",
    tabBody: KIT_THEME,
    pageBody: KIT_THEME,
  });

  check(
    "a component reading the kit's useTheme() renders clean",
    !kitHook.errorCodes.includes("render") && kitHook.runtime.render?.rendered === 2,
    kitHook.messageSummary,
  );

  const settingsRead = surfaces("render-settings-read", { tabBody: SETTINGS_READ, pageBody: SETTINGS_READ });

  check(
    "reading settings.load() while rendering renders clean - the SDK reads them synchronously",
    !settingsRead.errorCodes.includes("render") && settingsRead.runtime.render?.rendered === 2,
    settingsRead.messageSummary,
  );

  const settingsWrite = surfaces("render-settings-write", { tabBody: SETTINGS_WRITE, pageBody: SETTINGS_WRITE });

  check(
    "calling settings.save() while rendering is still a render error",
    settingsWrite.hasFindingMentioning("settings.save() was called while the component was rendering"),
    settingsWrite.messageSummary,
  );

  const modalDir = workspace.write("render-modal", {
    pkg: manifestFor("render-modal", "FixtureRenderModal"),
    bundle: modalSurfacePlugin({ dialogBody: READS_FILE }),
    src: contextMenuSource(),
  });

  workspace.installRenderer(modalDir);
  const modal = workspace.validate(modalDir, "--invoke");

  check(
    "a dialog opened from a class-side click is rendered with no current file",
    modal.hasFindingMentioning("dialogBodyComponent", "useCurrentFile() null"),
    modal.messageSummary,
  );

  const noRenderer = workspace.validateProject(
    "render-no-renderer",
    contextMenuProject("no-renderer", "FixtureNoRenderer"),
    "--invoke",
  );

  check(
    "a project the renderer cannot be loaded from is not blamed for it",
    !noRenderer.errorCodes.includes("render"),
    noRenderer.messageSummary,
  );

  // --- what the sandbox could not reach -------------------------------------------
  // A click that fetches first ends in its own catch here, so the modal behind the request never
  // becomes a surface - and reporting nothing would claim the click was covered.

  const fetchFirst = workspace.validateProject(
    "invoke-fetch-first",
    contextMenuProject("fetch-first", "FixtureFetchFirst", {
      click: FETCH_THEN_MODAL_CLICK,
      src: opensModalSource(),
    }),
    "--invoke",
  );

  check(
    "a click that fetches before opening its modal is reported as uncovered, not as clean",
    fetchFirst.warningsMention("called fetch once and returned no surface") &&
      fetchFirst.runtime.networkTruncated === 1,
    fetchFirst.messageSummary,
  );
  check(
    "the uncovered click says what to do about it",
    fetchFirst.hasFindingMentioning("took its failure path", "fetch from the component's effect"),
    fetchFirst.messageSummary,
  );

  const fetchThenOpens = workspace.validateProject(
    "invoke-fetch-then-opens",
    contextMenuProject("fetch-opens", "FixtureFetchOpens", {
      click: FETCH_THEN_MODAL_ANYWAY_CLICK,
      src: opensModalSource(),
    }),
    "--invoke",
  );

  check(
    "a click that fetches and still returns its surface is not reported",
    fetchThenOpens.runtime.networkTruncated === 0 && !fetchThenOpens.mentions("returned no surface"),
    fetchThenOpens.messageSummary,
  );

  // The common shape - fetch, then toast - hides nothing, and warning at it would be noise.
  const fetchThenToast = workspace.validateProject(
    "invoke-fetch-then-toast",
    contextMenuProject("fetch-toast", "FixtureFetchToast", { click: FETCH_THEN_TOAST_CLICK }),
    "--invoke",
  );

  check(
    "a plugin whose clicks only toast is not warned at for fetching",
    fetchThenToast.runtime.networkTruncated === 0 && !fetchThenToast.mentions("returned no surface"),
    fetchThenToast.messageSummary,
  );
};
