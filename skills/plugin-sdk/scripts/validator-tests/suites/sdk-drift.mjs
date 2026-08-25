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
 * Drift between this tool and the SDK the project installed. contract.mjs describes a
 * released portal, so it cannot be generated from the SDK - only compared to it. The third
 * claim matters as much as the first two: agreement must stay quiet, or the warning is noise.
 */

import { contextMenuPlugin, contextMenuSource, manifestFor } from "../fixtures.mjs";

export const title = "SDK drift";

export default ({ workspace, check }) => {
  /** A good project with a fake SDK planted in its node_modules. */
  const withSdk = (slug, pluginName, sdk) => {
    const dir = workspace.write(slug, {
      pkg: manifestFor(slug, pluginName),
      bundle: contextMenuPlugin({ pluginName }),
      src: contextMenuSource({ pluginName }),
    });

    workspace.installFakeSdk(dir, sdk);

    return workspace.validate(dir);
  };

  const driftReport = (report) =>
    report.findings
      .filter((finding) => finding.code === "sdk-drift")
      .map((finding) => finding.message)
      .join("\n");

  const added = withSdk("drift", "FixtureDrift", {
    version: "2.1.0",
    extraAction: "show-settings-modal",
    extraUserType: "Guest",
  });

  check(
    "a value the installed SDK added is reported",
    driftReport(added).includes("Guest") && driftReport(added).includes("show-settings-modal"),
    driftReport(added) || "no sdk-drift findings",
  );
  check(
    "drift does not fail the plugin, which is not at fault",
    added.ok,
    added.errorSummary,
  );

  const newMajor = withSdk("drift-major", "FixtureMajor", { version: "3.0.0" });

  check(
    "an SDK major this tool was not written against is reported",
    newMajor.hasFindingMentioning("3.0.0") && driftReport(newMajor).includes("3.0.0"),
    driftReport(newMajor) || "no sdk-drift findings",
  );

  const agreeing = withSdk("drift-agree", "FixtureAgree", { version: "2.1.0" });

  check(
    "an SDK that matches the contract produces no drift noise",
    driftReport(agreeing) === "",
    driftReport(agreeing),
  );
};
