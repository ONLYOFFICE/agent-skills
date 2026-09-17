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
 * The project under audit, as facts rather than judgements. Comments are stripped from the
 * source text, and the SDK is imported from the audited project rather than from this repository.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { SDK_PACKAGE } from "../contract.mjs";

/** Not-a-plugin-project: reported on its own, without a findings report. */
export class FatalProjectError extends Error {}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const walkFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });

const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const BUILD_CONFIG_FILES = [
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.js",
  "vite.config.mjs",
  "webpack.config.js",
  "webpack.config.cjs",
];

export class PluginProject {
  #assetEntries;
  #sourceText;
  #sourceFileTexts;
  #assetsDir;
  #srcDir;

  /** @throws {FatalProjectError} when there is no readable manifest to audit */
  static async load(dir) {
    const packageJsonPath = path.join(dir, "package.json");

    if (!fs.existsSync(packageJsonPath))
      throw new FatalProjectError(`Not a plugin project: ${packageJsonPath} does not exist`);

    let manifest;
    try {
      manifest = readJson(packageJsonPath);
    } catch (e) {
      throw new FatalProjectError(`package.json is not valid JSON: ${e.message}`);
    }

    const project = new PluginProject(dir, manifest);
    await project.#resolveSdk();

    return project;
  }

  constructor(dir, manifest) {
    this.dir = dir;
    this.manifest = manifest;

    this.packageJsonPath = path.join(dir, "package.json");
    this.#assetsDir = path.join(dir, "assets");
    this.#srcDir = path.join(dir, "src");
    this.bundlePath = path.join(dir, "dist", "plugin.js");
    this.zipPath = path.join(dir, "dist", "plugin.zip");
    this.stylesheetPath = path.join(dir, "dist", "plugin.css");

    /** The SDK the project installed, and its version. */
    this.sdk = null;
    this.sdkVersion = undefined;
  }

  /** Declared scopes, or an empty list when the field is missing or malformed. */
  get scopes() {
    return Array.isArray(this.manifest.scopes) ? this.manifest.scopes : [];
  }

  get pluginName() {
    return this.manifest.pluginName;
  }

  get isBuilt() {
    return fs.existsSync(this.bundlePath);
  }

  /** JavaScript emitted beside plugin.js - the chunks of a code-split build, which the packer never ships. */
  get distChunks() {
    const dist = path.dirname(this.bundlePath);
    if (!fs.existsSync(dist)) return [];

    return fs
      .readdirSync(dist)
      .filter((name) => /\.(m?js|cjs)$/.test(name) && name !== "plugin.js")
      .sort();
  }

  /** Only some plugins emit one - a project styled entirely with the kit and inline styles does not. */
  get hasStylesheet() {
    return fs.existsSync(this.stylesheetPath);
  }

  get hasNodeModules() {
    return fs.existsSync(path.join(this.dir, "node_modules"));
  }

  /** The SDK's own action list - the authority on which strings exist. */
  get sdkActions() {
    return this.sdk ? Object.values(this.sdk.Actions ?? {}) : [];
  }

  /** PluginLocale as the installed SDK spells it; empty when the SDK could not be imported. */
  get sdkLocales() {
    return this.sdk ? Object.values(this.sdk.PluginLocale ?? {}) : [];
  }

  get hasAssetsDir() {
    return fs.existsSync(this.#assetsDir);
  }

  /** One entry per thing directly inside assets/, read once. */
  get assetEntries() {
    if (!this.hasAssetsDir) return [];

    this.#assetEntries ??= fs.readdirSync(this.#assetsDir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      extension: path.extname(entry.name).toLowerCase(),
      bytes: entry.isDirectory() ? 0 : fs.statSync(path.join(this.#assetsDir, entry.name)).size,
    }));

    return this.#assetEntries;
  }

  /** File names the portal can resolve an icon reference against. */
  get assetNames() {
    return this.assetEntries.filter((entry) => !entry.isDirectory).map((entry) => entry.name);
  }

  get hasSrcDir() {
    return fs.existsSync(this.#srcDir);
  }

  get sourceFiles() {
    if (!this.hasSrcDir) return [];

    return walkFiles(this.#srcDir).filter((file) => /\.(ts|tsx|js|jsx)$/.test(file) && !file.endsWith(".d.ts"));
  }

  /** One entry per source file, comments removed, path relative to the project. Read once. */
  get sourceFileTexts() {
    this.#sourceFileTexts ??= this.sourceFiles.map((file) => ({
      file: path.relative(this.dir, file).split(path.sep).join("/"),
      text: stripComments(fs.readFileSync(file, "utf8")),
    }));

    return this.#sourceFileTexts;
  }

  /** Every source file, concatenated with comments removed. Read once, with the above. */
  get sourceText() {
    if (!this.hasSrcDir) return "";

    this.#sourceText ??= this.sourceFileTexts.map(({ text }) => text).join("\n");

    return this.#sourceText;
  }

  get entryFile() {
    return ["index.ts", "index.tsx", "index.js"].find((file) =>
      fs.existsSync(path.join(this.#srcDir, file)),
    );
  }

  get buildConfigFile() {
    return BUILD_CONFIG_FILES.find((file) => fs.existsSync(path.join(this.dir, file)));
  }

  get buildConfigText() {
    const file = this.buildConfigFile;
    return file ? stripComments(fs.readFileSync(path.join(this.dir, file), "utf8")) : "";
  }

  /** The roots a dependency is resolved from - the project, then its node_modules. */
  get #resolutionRoots() {
    return [this.packageJsonPath, path.join(this.dir, "node_modules")];
  }

  #resolve(name, from = this.#resolutionRoots) {
    for (const root of from) {
      try {
        return createRequire(root).resolve(name);
      } catch {
        /* try the next resolution root */
      }
    }
    return null;
  }

  async #import(name, from) {
    const resolved = this.#resolve(name, from);
    return resolved ? import(pathToFileURL(resolved).href) : null;
  }

  /**
   * A package as the *project* installed it - the same copy the bundle was built against, so
   * a React context created in one is the context the other reads. Null when it is not there.
   */
  async importFromProject(name) {
    try {
      return await this.#import(name);
    } catch {
      return null;
    }
  }

  /**
   * jszip ships with the SDK, not with the plugin. Installed from npm it is hoisted next to
   * the project; from a tarball or a checkout it stays under the SDK's own node_modules.
   */
  async loadJsZip() {
    const sdkDir = this.#sdkDir();
    const roots = sdkDir ? [...this.#resolutionRoots, path.join(sdkDir, "package.json")] : undefined;
    const jszip = await this.#import("jszip", roots);
    return jszip ? jszip.default ?? jszip : null;
  }

  /**
   * The installed SDK's directory. Its package.json is not on its `exports` map, so resolve
   * the entry point and walk up to the package root.
   */
  #sdkDir() {
    const entry = this.#resolve(SDK_PACKAGE);
    if (!entry) return null;

    let dir = path.dirname(entry);
    while (dir !== path.dirname(dir)) {
      const candidate = path.join(dir, "package.json");
      if (fs.existsSync(candidate) && readJson(candidate).name === SDK_PACKAGE) return dir;
      dir = path.dirname(dir);
    }
    return null;
  }

  async #resolveSdk() {
    this.sdk = await this.#import(SDK_PACKAGE);
    if (!this.sdk) return;

    const sdkDir = this.#sdkDir();

    this.sdkVersion = sdkDir
      ? readJson(path.join(sdkDir, "package.json")).version
      : this.manifest.dependencies?.[SDK_PACKAGE];
  }
}
