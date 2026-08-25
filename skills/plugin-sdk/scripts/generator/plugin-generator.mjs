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
 * What a scaffolded plugin project consists of, and the only code that writes it:
 * this layer decides *what* to write and delegates every detail. See README.md.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { SDK_PACKAGE } from "../contract.mjs";

import {
  PlaceholderIcons,
  buildManifest,
  changelogMarkdown,
  readmeMarkdown,
} from "./project-files.mjs";
import { LocalesSource, PluginClassSource } from "./sources.mjs";
import { ScopeSelection } from "./scopes.mjs";

/** The file system boundary: text in, files on disk. */
class ProjectWriter {
  /**
   * @param {{ targetDir: string, templatesDir: string }} options
   */
  constructor({ targetDir, templatesDir }) {
    this.targetDir = targetDir;
    this.templatesDir = templatesDir;
  }

  text(relativePath, contents) {
    const absolutePath = path.join(this.targetDir, relativePath);

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }

  json(relativePath, value) {
    this.text(relativePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  /**
   * Templates are stored under inert names (`tsconfig`, `webpack.config`) so editors
   * do not treat this repository's copies as live config - hence source != target.
   */
  template(templateName, relativePath) {
    this.text(relativePath, fs.readFileSync(path.join(this.templatesDir, templateName), "utf8"));
  }

  /** @param {Array<{ path: string, contents: string }>} files */
  all(files) {
    for (const { path: relativePath, contents } of files) this.text(relativePath, contents);
  }
}

export class PluginGenerator {
  /**
   * @param {ReturnType<typeof import("./options.mjs").parseCliOptions>} options
   * @param {{ templatesDir: string }} environment
   */
  constructor(options, { templatesDir }) {
    this.options = options;
    this.scopes = new ScopeSelection(options.scopeNames);
    this.icons = new PlaceholderIcons({
      itemIconFiles: this.scopes.itemIconFiles,
      letter: options.pluginName.charAt(0).toUpperCase(),
    });
    this.writer = new ProjectWriter({ targetDir: options.targetDir, templatesDir });
  }

  /** @returns {{ targetDir: string, iconPaths: string[], registersItems: boolean }} */
  generate() {
    this.#writeManifest();
    this.#writeBuildConfig();
    this.#writeSources();
    this.#writeAssets();
    this.#writeDocs();

    return {
      targetDir: this.options.targetDir,
      iconPaths: this.icons.assetPaths,
      registersItems: this.scopes.registersItems,
    };
  }

  #writeManifest() {
    const { name, pluginName, description, author } = this.options;

    this.writer.json(
      "package.json",
      buildManifest({ name, pluginName, description, author, scopeNames: this.scopes.names }),
    );
  }

  #writeBuildConfig() {
    this.writer.template("tsconfig", "tsconfig.json");
    this.writer.template("webpack.config", "webpack.config.js");
    this.writer.template("prettierrc.json", ".prettierrc.json");
    this.writer.template("gitignore", ".gitignore");
  }

  #writeSources() {
    const pluginClass = new PluginClassSource({
      pluginName: this.options.pluginName,
      scopes: this.scopes,
      sdkPackage: SDK_PACKAGE,
    });

    const locales = new LocalesSource({
      scopes: this.scopes,
      extraLocales: this.options.extraLocales,
      sdkPackage: SDK_PACKAGE,
    });

    this.writer.text("src/index.ts", pluginClass.render());
    this.writer.text("src/locales.ts", locales.render());
  }

  #writeAssets() {
    this.writer.all(this.icons.files);
  }

  #writeDocs() {
    const { name, description } = this.options;

    this.writer.text(
      "README.md",
      readmeMarkdown({ name, description, scopeNames: this.scopes.names }),
    );
    this.writer.text("CHANGELOG.md", changelogMarkdown());
  }
}
