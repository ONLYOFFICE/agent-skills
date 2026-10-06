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
  LEGACY_UI_KIT_PACKAGE,
  LOCALE_TAGS,
  MODULE_RUNTIME,
  PORTAL_LIMITS,
  REQUIRED_EXTERNALS,
  SCOPES,
  SCOPE_CONTRACT,
  SDK_PACKAGE,
  UI_KIT_PACKAGE,
  localeMember,
  localeSuggestions,
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
    this.#checkManifestLocales(manifest);

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
        else if (!entry.name.endsWith(entry.extension))
          this.error(
            "assets",
            `assets/${entry.name} - the server compares the extension as written and accepts only ${PORTAL_LIMITS.assetExtensions.join("/")} in lower case, so this file is dropped from the upload without a word; rename it`,
          );

        if (entry.bytes > PORTAL_LIMITS.maxFileBytes)
          this.error(
            "assets",
            `assets/${entry.name} is ${megabytes(entry.bytes)} MB, limit is ${PORTAL_LIMITS.maxFileLabel}`,
          );
      }

      // plugin.css travels beside the assets and takes one of their places in the archive. Before
      // the first build only the sources can say whether there will be one.
      const willPackStylesheet = project.isBuilt
        ? project.packsStylesheet
        : /(?:from\s+|import\s+)["'][^"']+\.css["']/.test(project.sourceText);
      const room = willPackStylesheet ? PORTAL_LIMITS.maxAssets - 1 : PORTAL_LIMITS.maxAssets;

      if (fileCount > room)
        this.error(
          "assets",
          `${fileCount} assets, the portal accepts at most ${room}${willPackStylesheet ? ` beside plugin.css, which takes one of the ${PORTAL_LIMITS.maxAssets} places` : ""}`,
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
    this.#checkLocaleKeys();
    this.#checkStylesheets();
  }

  /**
   * Whether the stylesheet can be scoped at all, which is decided by how it is imported and
   * built - not by reading the CSS, which nothing in this pass does. `plugin.css` is injected
   * into the portal's own document, so a class the build did not hash is a class shared with
   * ONLYOFFICE Apps: a CSS module makes that impossible by construction, and a plain .css file
   * leaves it to the browser pass, which does read the rules, plus whoever reads the rest.
   */
  #checkStylesheets() {
    const { project } = this;

    const imports = [
      ...project.sourceText.matchAll(/(?:from\s+|import\s+)["']([^"']+\.css)["']/g),
    ].map(([, file]) => file);

    if (imports.length === 0) return;

    if (project.isBuilt && !project.hasStylesheet)
      this.warn(
        "css",
        `${imports[0]} is imported but the build emitted no dist/plugin.css - the packer picks up that name and no other, so none of the styling reaches the portal. Vite writes it beside plugin.js; a renamed build.lib output is the usual cause`,
      );

    const modules = imports.filter((file) => file.endsWith(".module.css"));
    const plain = imports.filter((file) => !file.endsWith(".module.css"));
    const configText = project.buildConfigFile?.startsWith("vite") ? project.buildConfigText : "";

    if (modules.length && configText && !configText.includes("generateScopedName"))
      this.warn(
        "css",
        `${project.buildConfigFile} sets no css.modules.generateScopedName, so the hashed class names carry no plugin identity - build them out of the manifest name (\`${project.manifest.name}__[local]__[hash:hex:6]\`, as the scaffold does), or a class in the portal's DOM cannot be traced back to this plugin`,
      );

    if (plain.length)
      this.warn(
        "css",
        `${plain.join(", ")} ${plain.length === 1 ? "is" : "are"} imported as a plain stylesheet, which nothing scopes and this pass cannot read: plugin.css is appended to the portal's head after its own stylesheets, so any rule whose leftmost selector is not a class of yours restyles ONLYOFFICE Apps itself. Import it as *.module.css and the build hashes every class, or run preview-plugin.mjs, which reports the rules that escape, and read the rest against references/styles.md#scoped-css - the leftmost selector must be "${project.manifest.name}-…", never a bare element, "*" or ":root"`,
      );
  }

  /** PluginLocale as the project's SDK spells it, or this tool's copy when it could not be read. */
  get #knownLocales() {
    return this.project.sdkLocales.length ? this.project.sdkLocales : LOCALE_TAGS;
  }

  /** The tags a plausible-but-wrong one was meant to be, out of what the SDK has. */
  #localeSuggestions(tag) {
    return localeSuggestions(tag).filter((candidate) => this.#knownLocales.includes(candidate));
  }

  /**
   * A locale table keyed by a hand-written tag that is not a PluginLocale value: the portal
   * calls setLanguage with the enum's own value, so the table is never found and that
   * language silently reads English. Nothing else reports it - it compiles and it installs.
   *
   * Only a tag the enum *nearly* has is a finding ("ja" for ja-JP, "en" for en-US), which is
   * what a hand-written table gets wrong; an unrelated short string key is left alone. The
   * file has to look like it holds one: a plugin that imports the enum, calls setLanguage or
   * keeps its strings in a file named for them - a foreign plugin often does only the last.
   */
  #checkLocaleKeys() {
    const holdsLocales = ({ file, text }) =>
      text.includes("PluginLocale") || text.includes("setLanguage") || /locale|i18n|lang|translat/i.test(file);

    for (const { file, text } of this.project.sourceFileTexts.filter(holdsLocales)) {
      const keys = text.matchAll(/(?:^|[{,[]\s*)\[?\s*["']([A-Za-z]{2,3}(?:[-_][A-Za-z]{2,4})*)["']\s*\]?\s*:/gm);

      for (const [, tag] of keys) {
        if (this.#knownLocales.includes(tag)) continue;

        const suggestions = this.#localeSuggestions(tag);
        if (!suggestions.length) continue;

        this.error(
          "locale",
          `${file} keys a locale table with "${tag}", which is not a PluginLocale value - use ${suggestions
            .map((candidate) => `PluginLocale.${localeMember(candidate) ?? candidate}`)
            .join(" or ")}. The portal passes the enum's value to setLanguage, so a table under "${tag}" is never read and that language falls back to English`,
        );
      }
    }
  }

  /**
   * `nameLocale` and `descriptionLocale` are the same trap one level out: the portal reads
   * them for the plugin list, keyed by the same tags, and a near-miss is simply not shown.
   */
  #checkManifestLocales(manifest) {
    for (const field of ["nameLocale", "descriptionLocale"]) {
      const table = manifest[field];
      if (!table || typeof table !== "object") continue;

      for (const tag of Object.keys(table)) {
        if (this.#knownLocales.includes(tag)) continue;

        const suggestions = this.#localeSuggestions(tag);

        this.warn(
          `pkg.${field}`,
          `${field} has a "${tag}" entry, which is not a PluginLocale value${
            suggestions.length ? ` - use ${suggestions.map((candidate) => `"${candidate}"`).join(" or ")}` : ""
          }. The portal looks the plugin list up by the enum's own tags, so this entry is never shown`,
        );
      }
    }
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
      [/Components\.(box|text|label|input|textArea|checkbox|toggleButton|comboBox|iFrame|img|skeleton|link|iconButton)/, "the declarative component tree", "a React component built from @onlyoffice/apps-ui-kit"],
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

    // A regex external (/^@onlyoffice\/apps-ui-kit(\/.*)?$/) counts as naming the package.
    const mentions = (specifier) =>
      text.includes(`"${specifier}"`) ||
      text.includes(`'${specifier}'`) ||
      text.includes(specifier.replace(/\//g, "\\/"));

    // The kit under its old name is still resolved by the portal: warned about, not missing.
    const keepsLegacyKit = mentions(LEGACY_UI_KIT_PACKAGE) && !mentions(UI_KIT_PACKAGE);
    const missing = REQUIRED_EXTERNALS.filter(
      (specifier) => !mentions(specifier) && !(specifier === UI_KIT_PACKAGE && keepsLegacyKit),
    );

    if (!/external/.test(text))
      this.error(
        "build",
        `${file} declares no rolldownOptions.external - ${REQUIRED_EXTERNALS.join(", ")} have to stay external so the portal's copies are used`,
      );
    else if (missing.length)
      this.error(
        "build",
        `${file} does not list ${missing.join(", ")} in rolldownOptions.external - a bundled copy means a second React or a second ui-kit at runtime, and every SDK hook then throws`,
      );

    if (keepsLegacyKit)
      this.warn(
        "build",
        `${file} keeps "${LEGACY_UI_KIT_PACKAGE}" external, the kit's name before it became "${UI_KIT_PACKAGE}" - the portal still resolves it; rename the external and the imports together, or the renamed imports are bundled`,
      );

    if (new RegExp(`["']${SDK_PACKAGE}["']`).test(text))
      this.error(
        "build",
        `${file} marks the SDK root ${SDK_PACKAGE} external - the portal provides only its React entry, so the bundle's import of the root can never resolve and the plugin is refused at load`,
      );
  }
}
