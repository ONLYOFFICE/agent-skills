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
 * The built artifacts: dist/plugin.js - what it imports and what it bundled -, dist/plugin.zip
 * and its config.json (where a stale build shows up - the portal reads the archive, not the
 * project), plus SDK drift, which is always a warning because it is this tool that has aged.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  HOST_PROVIDED_SPECIFIERS,
  PORTAL_LIMITS,
  SDK_PACKAGE,
  UI_KIT_PACKAGE,
  checkSdkDrift,
  megabytes,
} from "../contract.mjs";
import { Check } from "./findings.mjs";
import { bareImportsOf, isHostProvided } from "./sandbox.mjs";

/** Text a bundled React leaves in the output, whichever build produced it. */
const BUNDLED_REACT_MARKERS = [
  "react.transitional.element",
  "Symbol.for(\"react.element\")",
  "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE",
  "Minified React error",
];

export class ArchiveChecks extends Check {
  /** @returns {Promise<{ bundleImportsResolvable: boolean }>} what the runtime pass needs to know */
  async run() {
    const bundleImportsResolvable = this.#checkBundle();
    this.#checkSdkDrift();
    await this.#checkArchive();
    return { bundleImportsResolvable };
  }

  #checkBundle() {
    const { project } = this;

    if (!project.isBuilt) {
      this.warn("dist", "dist/plugin.js is missing - run the build before validating the archive");
      return true;
    }

    const bytes = fs.statSync(project.bundlePath).size;
    if (bytes > PORTAL_LIMITS.maxFileBytes)
      this.error("dist", `dist/plugin.js is ${megabytes(bytes)} MB, limit is ${PORTAL_LIMITS.maxFileLabel}`);

    const code = fs.readFileSync(project.bundlePath, "utf8");
    this.#checkSplitBundle(code);
    return this.#checkBundleImports(code);
  }

  /**
   * A code-split build. The packer zips plugin.js alone and the portal imports it from a
   * blob URL, where a relative import() has nothing to resolve against - so a chunk is
   * unreachable whether or not it sits in dist/, and the surface that first needs it renders
   * blank. Libraries that lazy-load their own parts (diagram renderers, per-format parsers)
   * produce dozens of chunks without the plugin author writing a single import().
   */
  #checkSplitBundle(code) {
    const chunks = this.project.distChunks;
    const dynamicImports = code.match(/\bimport\(\s*["']\.{1,2}\//g)?.length ?? 0;

    if (!chunks.length && !dynamicImports) return;

    const shown = chunks.slice(0, 3).join(", ");
    const more = chunks.length > 3 ? ` and ${chunks.length - 3} more` : "";
    const where = chunks.length
      ? `dist/ holds ${chunks.length} JavaScript file(s) beside plugin.js (${shown}${more})`
      : `dist/plugin.js has ${dynamicImports} relative import() call(s)`;

    this.error(
      "dist",
      `${where} - the build split the bundle into chunks. The packer zips plugin.js alone and the portal imports it from a blob URL, where a relative import() cannot resolve, so the first surface that needs a chunk renders blank (the preview, which serves dist/ whole, would show it working). Set build.rollupOptions.output.inlineDynamicImports: true - the generator's vite.config does - and build again`,
    );
  }

  /** The same judgement the portal makes, so the finding matches what its console would say. */
  #checkBundleImports(code) {
    const imports = bareImportsOf(code);
    const unresolvable = imports.filter((specifier) => !isHostProvided(specifier));

    for (const specifier of unresolvable) {
      if (specifier.startsWith(`${UI_KIT_PACKAGE}/`))
        this.error(
          "dist",
          `dist/plugin.js imports "${specifier}" - the portal provides the kit as a single entry point and refuses a subpath; import from "${UI_KIT_PACKAGE}" instead`,
        );
      else if (specifier === SDK_PACKAGE)
        this.error(
          "dist",
          `dist/plugin.js imports "${SDK_PACKAGE}" - the SDK root has to be bundled (only its /react entry is host-provided); remove it from rollupOptions.external`,
        );
      else
        this.error(
          "dist",
          `dist/plugin.js imports "${specifier}", which DocSpace does not provide - drop it from "external" in the build config so it is bundled into plugin.js. DocSpace provides: ${HOST_PROVIDED_SPECIFIERS.map((s) => `"${s}"`).join(", ")}`,
        );
    }

    if (BUNDLED_REACT_MARKERS.some((marker) => code.includes(marker)))
      this.error(
        "dist",
        `dist/plugin.js contains a copy of React - a second React instance has its own contexts, so every SDK hook throws inside the portal's error boundary and the plugin's panels render blank; keep react, react-dom and react/jsx-runtime in rollupOptions.external`,
      );

    if (!imports.includes("react/jsx-runtime") && !imports.includes("react") && /\bcomponent\s*:/.test(code) === false)
      this.info(
        "dist",
        "dist/plugin.js imports neither react nor react/jsx-runtime - fine for a plugin with no visible surface, unexpected for one that renders components",
      );

    return unresolvable.length === 0;
  }

  #checkSdkDrift() {
    const { project } = this;

    if (project.sdk) {
      for (const message of checkSdkDrift(project.sdk, project.sdkVersion))
        this.warn("sdk-drift", message);
    } else if (project.hasNodeModules) {
      this.warn(
        "sdk-drift",
        `${SDK_PACKAGE} is not resolvable from the project - the contract tables could not be checked against the SDK it builds with`,
      );
    }
  }

  async #checkArchive() {
    const { project } = this;

    if (!fs.existsSync(project.zipPath)) {
      if (project.isBuilt)
        this.warn("zip", "dist/plugin.zip is missing - the bundler ran but the packer did not");
      return;
    }

    this.#checkArchiveIsCurrent();

    const bytes = fs.statSync(project.zipPath).size;
    if (bytes > PORTAL_LIMITS.maxFileBytes)
      this.error("zip", `dist/plugin.zip is ${megabytes(bytes)} MB, limit is ${PORTAL_LIMITS.maxFileLabel}`);

    const JSZip = await project.loadJsZip();

    if (!JSZip) {
      this.warn("zip", "jszip not resolvable from the project - archive contents not inspected");
      return;
    }

    const zip = await JSZip.loadAsync(fs.readFileSync(project.zipPath));
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
  /*
   * The archive against the mtimes of what went into it. An upload only replaces what is
   * installed if the archive is newer than the last edit - a zip packed before it carries the
   * previous build, and the portal has no way to say so: it installs cleanly and the change
   * is simply not there. Cheap to check and unrelated to whether the version moved.
   */
  #checkArchiveIsCurrent() {
    const { project } = this;
    const packedAt = fs.statSync(project.zipPath).mtimeMs;

    const inputs = [
      ...project.sourceFiles,
      ...(project.buildConfigFile ? [path.join(project.dir, project.buildConfigFile)] : []),
      project.packageJsonPath,
    ];

    const newer = inputs
      .filter((file) => {
        try {
          // A second of slack: the packer runs right after the build touches these.
          return fs.statSync(file).mtimeMs > packedAt + 1000;
        } catch {
          return false;
        }
      })
      .map((file) => path.relative(project.dir, file).split(path.sep).join("/"));

    if (!newer.length) return;

    const shown = newer.slice(0, 3).join(", ");
    const more = newer.length > 3 ? ` and ${newer.length - 3} more` : "";

    this.warn(
      "zip",
      `dist/plugin.zip is older than ${shown}${more} - the archive does not contain the latest edit, so uploading it ships the previous build. Run the build again`,
    );
  }

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
    // The loader reads runtime from config.json, so a packer that predates the field
    // silently turns the module into a classic script.
    expect("runtime", config.runtime, manifest.runtime);

    if (!config.minDocSpaceVersion)
      this.error(
        "config",
        "config.json has no minDocSpaceVersion - the SDK package could not be read",
      );
    else this.info("config", `minDocSpaceVersion from the SDK: ${config.minDocSpaceVersion}`);
  }
}
