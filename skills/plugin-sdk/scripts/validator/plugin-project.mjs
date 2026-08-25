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
 * The project under audit, as facts rather than judgements: it reads and never decides.
 * Comments are stripped from the source text, and the SDK is imported from the audited
 * project rather than from this repository. See README.md.
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

export class PluginProject {
  #assetEntries;
  #sourceText;

  /**
   * @param {string} dir - already resolved to an absolute path
   * @returns {Promise<PluginProject>}
   * @throws {FatalProjectError} when there is no readable manifest to audit
   */
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
    this.assetsDir = path.join(dir, "assets");
    this.srcDir = path.join(dir, "src");
    this.bundlePath = path.join(dir, "dist", "plugin.js");
    this.zipPath = path.join(dir, "dist", "plugin.zip");

    /** The SDK the project installed, and the action strings it exports. */
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

  get hasNodeModules() {
    return fs.existsSync(path.join(this.dir, "node_modules"));
  }

  /** Prefer the SDK's own action list over this tool's table - it is the authority on
   * which strings exist, and may know ones the contract does not. */
  get sdkActions() {
    return this.sdk ? Object.values(this.sdk.Actions ?? {}) : [];
  }

  // --- assets ---------------------------------------------------------------

  get hasAssetsDir() {
    return fs.existsSync(this.assetsDir);
  }

  /**
   * One entry per thing directly inside assets/, read once - several checks ask.
   *
   * @returns {Array<{ name: string, isDirectory: boolean, extension: string, bytes: number }>}
   */
  get assetEntries() {
    if (!this.hasAssetsDir) return [];

    this.#assetEntries ??= fs.readdirSync(this.assetsDir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      extension: path.extname(entry.name).toLowerCase(),
      bytes: entry.isDirectory() ? 0 : fs.statSync(path.join(this.assetsDir, entry.name)).size,
    }));

    return this.#assetEntries;
  }

  /** File names the portal can resolve an icon reference against. */
  get assetNames() {
    return this.assetEntries.filter((entry) => !entry.isDirectory).map((entry) => entry.name);
  }

  // --- sources --------------------------------------------------------------

  get hasSrcDir() {
    return fs.existsSync(this.srcDir);
  }

  get sourceFiles() {
    if (!this.hasSrcDir) return [];

    return walkFiles(this.srcDir).filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
  }

  /** Every source file, concatenated with comments removed. Read once. */
  get sourceText() {
    if (!this.hasSrcDir) return "";

    this.#sourceText ??= stripComments(
      this.sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n"),
    );

    return this.#sourceText;
  }

  get entryFile() {
    return ["index.ts", "index.tsx", "index.js"].find((file) =>
      fs.existsSync(path.join(this.srcDir, file)),
    );
  }

  // --- files and dependencies ----------------------------------------------

  fileSize(absolutePath) {
    return fs.statSync(absolutePath).size;
  }

  exists(absolutePath) {
    return fs.existsSync(absolutePath);
  }

  readFile(absolutePath) {
    return fs.readFileSync(absolutePath);
  }

  readText(absolutePath) {
    return fs.readFileSync(absolutePath, "utf8");
  }

  /** Resolves a dependency from the audited project rather than from this tool. */
  async import(name) {
    for (const from of [this.packageJsonPath, path.join(this.dir, "node_modules")]) {
      try {
        const resolved = createRequire(from).resolve(name);
        return await import(pathToFileURL(resolved).href);
      } catch {
        /* try the next resolution root */
      }
    }

    return null;
  }

  async loadJsZip() {
    return (await this.import("jszip"))?.default ?? null;
  }

  async #resolveSdk() {
    this.sdk = await this.import(SDK_PACKAGE);
    if (!this.sdk) return;

    try {
      this.sdkVersion = readJson(
        createRequire(this.packageJsonPath).resolve(`${SDK_PACKAGE}/package.json`),
      ).version;
    } catch {
      this.sdkVersion = this.manifest.dependencies?.[SDK_PACKAGE];
    }
  }
}
