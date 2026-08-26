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
 * The project as written: manifest, assets, sources, build config - all readable without
 * building or running anything.
 */

import {
  MODULE_RUNTIME,
  PORTAL_LIMITS,
  REQUIRED_EXTERNALS,
  SCOPES,
  SCOPE_CONTRACT,
  SDK_PACKAGE,
  megabytes,
} from "../contract.mjs";
import { Check } from "./findings.mjs";

export class ProjectChecks extends Check {
  async run() {
    this.#checkManifest();
    this.#checkAssets();
    this.#checkSources();
    this.#checkBuildConfig();
  }

  #checkManifest() {
    const { manifest } = this.project;

    this.#checkNames(manifest);

    if (!/^\d+\.\d+\.\d+/.test(manifest.version ?? ""))
      this.warn("pkg.version", `version "${manifest.version}" is not semver-like`);

    this.#checkScopes(manifest);
    this.#checkRuntime(manifest);

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
        `pluginName "${manifest.pluginName}" must be a valid JS identifier - it is the plugin's identity in the manifest and the class name in the scaffold`,
      );
  }

  #checkScopes(manifest) {
    if (!Array.isArray(manifest.scopes))
      this.error("pkg.scopes", "scopes must be an array in package.json");
    else if (this.project.scopes.length === 0)
      this.error("pkg.scopes", "scopes is empty - the plugin cannot be activated");

    // A typo or a scope no shipped portal hosts: both install cleanly and render nothing.
    for (const scope of this.project.scopes)
      if (!SCOPES.includes(scope))
        this.error("pkg.scopes", `unknown scope "${scope}" (known: ${SCOPES.join(", ")})`);
  }

  #checkRuntime(manifest) {
    const { runtime } = manifest;

    if (runtime === undefined)
      this.error(
        "pkg.runtime",
        `no "runtime" in package.json - add "runtime": "${MODULE_RUNTIME}", or the portal injects dist/plugin.js as a classic script and the ES module never runs (a plugin built against SDK 2 with webpack is outside what this tool checks)`,
      );
    else if (runtime !== MODULE_RUNTIME)
      this.error(
        "pkg.runtime",
        `"runtime": "${runtime}" is not a value the portal loader knows - only "${MODULE_RUNTIME}" is; anything else is loaded as a classic script and an ES module bundle then registers nothing`,
      );
  }

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
            `assets/${entry.name} is ${megabytes(entry.bytes)} MB, limit is ${PORTAL_LIMITS.maxFileLabel}`,
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
    this.#checkDeprecatedUsage(sourceText);
    this.#checkUiKitDefaults(sourceText);
  }

  #checkRegistration(sourceText) {
    const { pluginName } = this.project;

    if (!/\bexport\s+default\b/.test(sourceText))
      this.error(
        "registration",
        `no "export default plugin" in src/ - the portal imports the bundle and reads its default export; without one the plugin loads and registers nothing`,
      );

    if (/window\.Plugins\b/.test(sourceText))
      this.warn(
        "registration",
        `src/ assigns window.Plugins${pluginName ? `.${pluginName}` : ""} - that was SDK 2's registration; a module plugin is registered by its default export and the assignment is never read. Drop it, and the global declaration with it`,
      );
  }

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

  /** Only unmistakable names are matched - a bare `body:` is too common a word. */
  #checkDeprecatedUsage(sourceText) {
    const deprecated = [
      ["dialogBody:", "IModalDialog.dialogBody", "dialogBodyComponent"],
      ["dialogFooter:", "IModalDialog.dialogFooter", "the footer rendered inside dialogBodyComponent"],
      ["newDialogBody", "IModalDialog.onLoad", "state inside dialogBodyComponent"],
      // Components.button is legitimate - the settings Save button is still a ButtonGroup.
      [/Components\.(box|text|label|input|textArea|checkbox|toggleButton|comboBox|iFrame|img|skeleton|link|iconButton)/, "the declarative component tree", "a React component built from @docspace/ui-kit"],
    ];

    for (const [needle, what, instead] of deprecated)
      if (typeof needle === "string" ? sourceText.includes(needle) : needle.test(sourceText))
        this.warn(
          "deprecated",
          `src/ uses ${what}, which SDK 3 deprecates - it still renders, but new code should use ${instead}`,
        );
  }

  /**
   * `FieldContainer.labelVisible` defaults to false and the whole label block sits behind
   * it, so a form written with `labelText` on every field ships with no labels at all.
   */
  #checkUiKitDefaults(sourceText) {
    const openings = sourceText.matchAll(/<FieldContainer\b[^>]*/g);

    for (const [tag] of openings)
      if (/\blabelText\b/.test(tag) && !/\blabelVisible\b/.test(tag)) {
        this.warn(
          "ui-kit",
          "src/ renders a FieldContainer with labelText but no labelVisible - the prop defaults to false and the label block is behind it, so the field ships without its label. Add labelVisible",
        );

        return;
      }
  }

  #checkBuildConfig() {
    const { project } = this;
    const file = project.buildConfigFile;

    if (!file) {
      this.warn("build", "no vite.config.* found - the externals the portal requires could not be checked");
      return;
    }

    if (file.startsWith("webpack")) {
      this.warn(
        "build",
        `${file} - the SDK template builds plugins with Vite; make sure the output is an ES module that keeps ${REQUIRED_EXTERNALS.join(", ")} external`,
      );
      return;
    }

    const text = project.buildConfigText;

    // A regex external (/^@docspace\/ui-kit(\/.*)?$/) counts as naming the package.
    const mentions = (specifier) =>
      text.includes(`"${specifier}"`) ||
      text.includes(`'${specifier}'`) ||
      text.includes(specifier.replace(/\//g, "\\/"));

    const missing = REQUIRED_EXTERNALS.filter((specifier) => !mentions(specifier));

    if (!/external/.test(text))
      this.error(
        "build",
        `${file} declares no rollupOptions.external - ${REQUIRED_EXTERNALS.join(", ")} have to stay external so the portal's copies are used`,
      );
    else if (missing.length)
      this.error(
        "build",
        `${file} does not list ${missing.join(", ")} in rollupOptions.external - a bundled copy means a second React or a second ui-kit at runtime, and every SDK hook then throws`,
      );

    if (new RegExp(`["']${SDK_PACKAGE}["']`).test(text))
      this.error(
        "build",
        `${file} marks the SDK root ${SDK_PACKAGE} external - the portal provides only its React entry, so the bundle's import of the root can never resolve and the plugin is refused at load`,
      );
  }
}
