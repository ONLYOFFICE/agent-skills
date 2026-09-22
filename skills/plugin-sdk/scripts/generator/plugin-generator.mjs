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
 * What a scaffolded plugin project consists of, and the only code that writes to disk.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { SDK_PACKAGE } from "../contract.mjs";
import { buildManifest, changelogMarkdown, placeholderIcons, readmeMarkdown } from "./project-files.mjs";
import { selectScopes } from "./scopes.mjs";
import { renderLocales, renderPluginClass } from "./sources.mjs";

// Templates live under inert names (`tsconfig`, `vite.config`) so editors do not treat
// this repository's copies as live config.
const TEMPLATES = [
  ["tsconfig", "tsconfig.json"],
  ["vite.config", "vite.config.ts"],
  ["prettierrc.json", ".prettierrc.json"],
  ["gitignore", ".gitignore"],
  ["css-modules.d.ts", "src/css-modules.d.ts"],
];

/**
 * @param {ReturnType<typeof import("./options.mjs").parseCliOptions>} options
 * @returns {{ targetDir, iconPaths, hasItemScopes, uiKitTarball, sdkTarball }}
 */
export const generate = (options, { templatesDir }) => {
  const { name, pluginName, description, author, scopeNames, targetDir, extraLocales, vendoredTarballs } = options;

  const write = (relativePath, contents) => {
    const absolutePath = path.join(targetDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  };

  const scopes = selectScopes(scopeNames);
  const icons = placeholderIcons({ itemIconFiles: scopes.itemIconFiles, letter: pluginName.charAt(0).toUpperCase() });

  // The kit, and the packed SDK while 3.0.0 is unpublished - into the project root, where the
  // manifest's `file:` entries point.
  for (const tarball of vendoredTarballs.all) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(tarball, path.join(targetDir, path.basename(tarball)));
  }
  const uiKitTarball = path.basename(vendoredTarballs.kit);
  const sdkTarball = vendoredTarballs.sdk && path.basename(vendoredTarballs.sdk);

  write(
    "package.json",
    `${JSON.stringify(buildManifest({ name, pluginName, description, author, scopeNames, uiKitTarball, sdkTarball }), null, 2)}\n`,
  );

  for (const [templateName, relativePath] of TEMPLATES)
    write(relativePath, fs.readFileSync(path.join(templatesDir, templateName), "utf8"));

  write("src/index.ts", renderPluginClass({ pluginName, scopes, sdkPackage: SDK_PACKAGE }));
  write("src/locales.ts", renderLocales({ scopes, extraLocales, sdkPackage: SDK_PACKAGE }));

  for (const file of icons.files) write(file.path, file.contents);

  write("README.md", readmeMarkdown({ name, description, scopeNames, uiKitTarball, sdkTarball }));
  write("CHANGELOG.md", changelogMarkdown());

  return {
    targetDir,
    iconPaths: icons.paths,
    hasItemScopes: scopes.itemMapScopes.length > 0,
    uiKitTarball,
    sdkTarball,
  };
};
