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
 * Modals. A React modal is a component handed over as dialogBodyComponent; the SDK 2
 * declarative form still renders but is deprecated, so it is recognised and warned about
 * rather than walked.
 */

import { contextMenuProject, contextMenuSource } from "../fixtures.mjs";

export const title = "modals";

export default ({ workspace, check }) => {
  const modalProject = (slug, pluginName, click) => contextMenuProject(slug, pluginName, { click });

  const reactModal = workspace.validateProject(
    "react-modal",
    modalProject("rm", "FixtureRm", `return { actions: ["show-modal"], modalDialogProps: { dialogHeader: "Hi", dialogBodyComponent: Panel } };`),
    "--invoke",
  );

  check(
    "a modal with dialogBodyComponent and no onLoad or onClose passes",
    reactModal.ok && !reactModal.warningCodes.includes("deprecated"),
    reactModal.messageSummary,
  );

  const elementModal = workspace.validateProject(
    "element-modal",
    modalProject("em", "FixtureEm", `return { actions: ["show-modal"], modalDialogProps: { dialogBodyComponent: jsx(Panel, {}), dialogFooter: { children: [] } } };`),
    "--invoke",
  );

  check(
    "a JSX element as dialogBodyComponent is an error",
    elementModal.errorsMention("component is a JSX element"),
    elementModal.messageSummary,
  );
  check(
    "a declarative footer on a React modal is a deprecation warning",
    elementModal.warningsMention("has no footer slot"),
  );

  const emptyModal = workspace.validateProject(
    "empty-modal",
    modalProject("empty", "FixtureEmpty", `return { actions: ["show-modal"], modalDialogProps: { dialogHeader: "Hi" } };`),
    "--invoke",
  );

  check(
    "a modal with neither body nor component is an error",
    emptyModal.errorsMention("neither dialogBodyComponent nor dialogBody"),
  );

  const legacyModal = workspace.validateProject(
    "legacy-modal",
    modalProject("lm", "FixtureLm", `return { actions: ["show-modal"], modalDialogProps: { displayType: "modal", dialogBody: { children: [] } } };`),
    "--invoke",
  );

  check(
    "a declarative dialogBody is a deprecation warning",
    legacyModal.warningCodes.includes("deprecated") && legacyModal.warningsMention("dialogBody"),
  );
  check(
    "a declarative modal without onClose is an error",
    legacyModal.errorsMention("declarative modal without onClose"),
  );

  // The label a form is written to show, and does not.

  const formProject = (slug, pluginName, field) =>
    contextMenuProject(slug, pluginName, {
      src: `${contextMenuSource()}\nconst Form = () => <FieldContainer ${field}><TextInput /></FieldContainer>;\n`,
    });

  const unlabelled = workspace.validateProject(
    "field-no-label",
    formProject("fnl", "FixtureFnl", `isVertical labelText={t("url")}`),
  );

  check(
    "a FieldContainer with labelText and no labelVisible is warned about",
    unlabelled.warningCodes.includes("ui-kit") && unlabelled.warningsMention("labelVisible"),
    unlabelled.messageSummary,
  );

  const labelled = workspace.validateProject(
    "field-labelled",
    formProject("fl", "FixtureFl", `isVertical labelVisible labelText={t("url")}`),
  );

  check(
    "the same field with labelVisible is quiet",
    !labelled.warningCodes.includes("ui-kit"),
    labelled.messageSummary,
  );

  const errorOnly = workspace.validateProject(
    "field-error-only",
    formProject("feo", "FixtureFeo", `hasError errorMessage={t("httpsOnly")}`),
  );

  check(
    "a FieldContainer with no labelText at all is not a finding",
    !errorOnly.warningCodes.includes("ui-kit"),
    errorOnly.messageSummary,
  );
};
