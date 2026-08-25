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
 * The declarative tree the host renders without a net, and the line between two severities:
 * a missing required prop is an ERROR because the nearest error boundary is the application
 * shell; a value with no host styles is a WARN, since the control merely renders wrong.
 */

import { contextMenuPlugin, contextMenuSource, manifestFor } from "../fixtures.mjs";

export const title = "component trees and modals";

export default ({ workspace, check }) => {
  // A modal with no onLoad (the SDK marks it required) holding a button with
  // neither size nor onClick. Both throw during render.
  const missingProps = workspace.validateProject(
    "ui",
    {
      pkg: manifestFor("ui", "FixtureUi"),
      bundle: contextMenuPlugin({
        pluginName: "FixtureUi",
        click: `return { actions: ["show-modal"], modalDialogProps: {
         displayType: "modal",
         dialogBody: { children: [{ component: "button", props: { label: "Go" } }] },
         onClose: function () { return { actions: ["close-modal"] }; },
       } };`,
      }),
      src: contextMenuSource({ pluginName: "FixtureUi" }),
    },
    "--invoke",
  );

  check("a modal without onLoad is an error", missingProps.mentions("onLoad is not a function"));
  check(
    "a component missing a required prop is an error",
    missingProps.mentions("button without size") && missingProps.mentions("button without onClick"),
  );

  // --- values that compile against the SDK and render wrong on the portal ------
  //
  // ButtonSize.extraSmall emits "extra-small" where the host has "extraSmall";
  // InputSize.big/huge have no styles; a comboBox matches by label; borderProp is ignored.

  const deadValues = workspace.validateProject(
    "visual",
    {
      pkg: manifestFor("visual", "FixtureVisual"),
      bundle: contextMenuPlugin({
        pluginName: "FixtureVisual",
        click: `return { actions: ["show-modal"], modalDialogProps: {
         displayType: "modal",
         dialogBody: { borderProp: "1px solid red", children: [
           { component: "button", props: { label: "Go", size: "extra-small", onClick: function () {} } },
           { component: "input", props: { value: "", size: "big", onChange: function () {} } },
           { component: "comboBox", props: {
             options: [{ key: "a", label: "Same" }, { key: "b", label: "Same" }],
             selectedOption: { key: "a", label: "Same" },
           } },
           { component: "comboBox", props: {
             options: [{ label: "No key" }],
             selectedOption: { key: "x", label: "No key" },
           } },
         ] },
         onClose: function () { return { actions: ["close-modal"] }; },
         onLoad: async function () { return { newDialogBody: { children: [] } }; },
       } };`,
      }),
      src: contextMenuSource({ pluginName: "FixtureVisual" }),
    },
    "--invoke",
  );

  check(
    'the dead "extra-small" button size is a warning',
    deadValues.warningsMention('button size "extra-small"'),
  );
  check('the dead "big" input size is a warning', deadValues.warningsMention('input size "big"'));
  check(
    "duplicate comboBox labels are a warning",
    deadValues.warningsMention("duplicate option labels"),
  );
  check("a comboBox option without key is an error", deadValues.errorsMention("has no key"));
  check("a string borderProp is a warning", deadValues.warningsMention("borderProp is a CSS string"));
};
