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
 * The built artifacts: dist/plugin.js, dist/plugin.zip and its config.json, plus SDK
 * drift. config.json is where a stale build shows up - the portal reads the archive, not
 * the project - and drift is always a warning, because it is this tool that has aged.
 */

import { PORTAL_LIMITS, SDK_PACKAGE, checkSdkDrift } from "../contract.mjs";
import { Check } from "./findings.mjs";

const megabytes = (bytes) => (bytes / 1e6).toFixed(1);

export class ArchiveChecks extends Check {
  async run() {
    this.#checkBundle();
    this.#checkSdkDrift();
    await this.#checkArchive();
  }

  #checkBundle() {
    const { project } = this;

    if (!project.isBuilt) {
      this.warn("dist", "dist/plugin.js is missing - run the build before validating the archive");
      return;
    }

    const bytes = project.fileSize(project.bundlePath);
    if (bytes > PORTAL_LIMITS.maxFileBytes)
      this.error("dist", `dist/plugin.js is ${megabytes(bytes)} MB, limit is 5 MB`);
  }

  #checkSdkDrift() {
    const { project } = this;

    if (project.sdk) {
      for (const { code, message } of checkSdkDrift(project.sdk, project.sdkVersion))
        this.warn(code, message);
    } else if (project.hasNodeModules) {
      this.warn(
        "sdk-drift",
        `${SDK_PACKAGE} is not resolvable from the project - the contract tables could not be checked against the SDK it builds with`,
      );
    }
  }

  async #checkArchive() {
    const { project } = this;

    if (!project.exists(project.zipPath)) {
      if (project.isBuilt)
        this.warn("zip", "dist/plugin.zip is missing - webpack ran but the packer did not");
      return;
    }

    const bytes = project.fileSize(project.zipPath);
    if (bytes > PORTAL_LIMITS.maxFileBytes)
      this.error("zip", `dist/plugin.zip is ${megabytes(bytes)} MB, limit is 5 MB`);

    const JSZip = await project.loadJsZip();

    if (!JSZip) {
      this.warn("zip", "jszip not resolvable from the project - archive contents not inspected");
      return;
    }

    const zip = await JSZip.loadAsync(project.readFile(project.zipPath));
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

    if (!names.includes("plugin.js")) this.error("zip", "plugin.js is missing from the archive");
    if (!names.includes("config.json")) this.error("zip", "config.json is missing from the archive");

    const packedAssets = names.filter((name) => name.startsWith("assets/"));
    if (packedAssets.length > PORTAL_LIMITS.maxAssets)
      this.error(
        "zip",
        `${packedAssets.length} assets in the archive, limit is ${PORTAL_LIMITS.maxAssets}`,
      );

    if (names.includes("config.json"))
      this.#checkPackedConfig(JSON.parse(await zip.file("config.json").async("string")));
  }

  /** The packer renames fields on the way in, which is why these pairs look odd. */
  #checkPackedConfig(config) {
    const { manifest, scopes } = this.project;

    const expect = (field, actual, wanted) => {
      if (actual !== wanted)
        this.error(
          "config",
          `config.json ${field} is "${actual}", expected "${wanted}" - rebuild after editing package.json`,
        );
    };

    expect("name", config.name, String(manifest.name ?? "").toLowerCase());
    expect("pluginName", config.pluginName, manifest.pluginName ?? "");
    expect("version", config.version, manifest.version ?? "");
    expect("scopes", config.scopes, scopes.join(","));
    expect("image", config.image, manifest.logo ?? "");

    if (!config.minDocSpaceVersion)
      this.error(
        "config",
        "config.json has no minDocSpaceVersion - the SDK package could not be read",
      );
    else this.info("config", `minDocSpaceVersion from the SDK: ${config.minDocSpaceVersion}`);
  }
}
