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
 * The project as written: manifest, assets, sources - all readable without building or
 * running anything. Most of it catches a name, field or file the portal looks for and
 * does not find, none of which produces a console error on a real portal.
 */

import { PORTAL_LIMITS, SCOPES, SCOPE_CONTRACT } from "../contract.mjs";
import { Check } from "./findings.mjs";

const megabytes = (bytes) => (bytes / 1e6).toFixed(1);

export class ProjectChecks extends Check {
  async run() {
    this.#checkManifest();
    this.#checkAssets();
    this.#checkSources();
  }

  // --- package.json ---------------------------------------------------------

  #checkManifest() {
    const { manifest } = this.project;

    this.#checkNames(manifest);

    if (!/^\d+\.\d+\.\d+/.test(manifest.version ?? ""))
      this.warn("pkg.version", `version "${manifest.version}" is not semver-like`);

    this.#checkScopes(manifest);

    if (manifest.cspDomains && !Array.isArray(manifest.cspDomains))
      this.error("pkg.cspDomains", "cspDomains must be an array of origins");

    if (manifest.minDocSpaceVersion)
      this.warn(
        "pkg.minDocSpaceVersion",
        "minDocSpaceVersion in package.json is ignored - the packer reads it from the installed SDK",
      );

    const buildScript = manifest.scripts?.build ?? "";
    if (!buildScript.includes("build-docspace-plugin"))
      this.error(
        "pkg.scripts",
        `build script "${buildScript}" must end with "npx build-docspace-plugin" (SDK 1.1.1 createZip scripts are dead)`,
      );

    if (manifest.runtime)
      this.warn(
        "pkg.runtime",
        `"runtime": "${manifest.runtime}" is not supported by the portal loader - the bundle will load and render nothing`,
      );
  }

  #checkNames(manifest) {
    if (!manifest.name) this.error("pkg.name", "package.json has no name");
    else if (/[A-Z]/.test(manifest.name))
      this.error(
        "pkg.name",
        `name "${manifest.name}" has upper case letters - the packer lower-cases it in config.json, so every name lookup against the portal has to use the lower case form`,
      );
    else if (!/^[a-z_-]+$/.test(manifest.name))
      this.warn(
        "pkg.name",
        `name "${manifest.name}" contains characters the scaffold dialog rejects (it allows a-z, - and _); existing plugins such as draw.io do use dots`,
      );

    if (!manifest.pluginName) this.error("pkg.pluginName", "package.json has no pluginName");
    else if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(manifest.pluginName))
      this.error(
        "pkg.pluginName",
        `pluginName "${manifest.pluginName}" must be a valid JS identifier - it is used as window.Plugins.<pluginName>`,
      );
  }

  #checkScopes(manifest) {
    if (!Array.isArray(manifest.scopes))
      this.error("pkg.scopes", "scopes must be an array in package.json");
    else if (this.project.scopes.length === 0)
      this.error("pkg.scopes", "scopes is empty - the plugin cannot be activated");

    // A scope outside this list is a typo or one no shipped portal hosts; both install
    // cleanly and render nothing, so both are errors.
    for (const scope of this.project.scopes)
      if (!SCOPES.includes(scope))
        this.error("pkg.scopes", `unknown scope "${scope}" (known: ${SCOPES.join(", ")})`);
  }

  // --- assets ---------------------------------------------------------------

  #checkAssets() {
    const { project } = this;
    const { manifest, assetNames } = project;

    if (project.hasAssetsDir) {
      let fileCount = 0;

      for (const entry of project.assetEntries) {
        if (entry.isDirectory) {
          this.error("assets", `assets/${entry.name}/ - nested folders are not packed`);
          continue;
        }

        fileCount += 1;

        if (!PORTAL_LIMITS.assetExtensions.includes(entry.extension))
          this.error(
            "assets",
            `assets/${entry.name} - only ${PORTAL_LIMITS.assetExtensions.join("/")} are accepted`,
          );

        if (entry.bytes > PORTAL_LIMITS.maxFileBytes)
          this.error(
            "assets",
            `assets/${entry.name} is ${megabytes(entry.bytes)} MB, limit is 5 MB`,
          );
      }

      if (fileCount > PORTAL_LIMITS.maxAssets)
        this.error(
          "assets",
          `${fileCount} assets, the portal accepts at most ${PORTAL_LIMITS.maxAssets}`,
        );
    } else if (project.scopes.some((scope) => scope !== "API" && scope !== "PostMessage")) {
      this.warn(
        "assets",
        "no assets/ folder - the plugin card and every item icon will be broken",
      );
    }

    if (!manifest.logo)
      this.warn("pkg.logo", "no logo - the plugin card shows a placeholder (48x48 expected)");
    else if (!assetNames.includes(manifest.logo))
      this.error("pkg.logo", `logo "${manifest.logo}" is not in assets/`);
  }

  // --- src ------------------------------------------------------------------

  #checkSources() {
    const { project } = this;

    if (!project.hasSrcDir) {
      this.error("src", "no src/ folder");
      return;
    }

    if (project.sourceFiles.length === 0)
      this.error("src", "src/ has no TypeScript/JavaScript files");

    if (!project.entryFile) this.error("src", "src/ has no index.ts entry point");

    const sourceText = project.sourceText;

    this.#checkRegistration(sourceText);
    this.#checkDeclaredScopesAreImplemented(sourceText);
    this.#checkIconReferences(sourceText);
  }

  /**
   * Three legitimate spellings: dotted, bracketed with a literal, bracketed with a
   * constant. The last is common enough that missing it would reject working plugins.
   */
  #checkRegistration(sourceText) {
    const { pluginName } = this.project;
    if (!pluginName) return;

    const direct = new RegExp(
      `window\\.Plugins\\.${pluginName}\\s*=|window\\.Plugins\\[["']${pluginName}["']\\]\\s*=`,
    );

    const viaConstant = () => {
      const identifier = sourceText.match(/window\.Plugins\[\s*([A-Za-z_$][\w$]*)\s*\]\s*=/)?.[1];
      if (!identifier) return false;

      const bound = new RegExp(`\\b${identifier}\\s*(?::[^=]+)?=\\s*["\`']${pluginName}["\`']`);

      return bound.test(sourceText);
    };

    if (!direct.test(sourceText) && !viaConstant())
      this.error(
        "registration",
        `no "window.Plugins.${pluginName} = ..." in src/ - the portal merges window.Plugins[pluginName] and silently gets an empty plugin when the names differ`,
      );
  }

  /** A declared scope whose getter is nowhere in the source is never called at all. */
  #checkDeclaredScopesAreImplemented(sourceText) {
    for (const scope of this.project.scopes) {
      const contract = SCOPE_CONTRACT[scope];
      if (!contract) continue;

      const members = contract.getter ? [contract.getter] : (contract.members ?? []);

      for (const member of members)
        if (!sourceText.includes(member))
          this.error("scope", `scope "${scope}" is declared but src/ never defines ${member}`);
    }
  }

  #checkIconReferences(sourceText) {
    const references = sourceText.matchAll(
      /(?:icon|fileRowIcon|fileTileIcon)\s*:\s*["']([^"']+)["']/g,
    );

    for (const [, icon] of references)
      if (!this.project.assetNames.includes(icon))
        this.error("icon", `icon "${icon}" referenced in src/ is not in assets/`);
  }
}
