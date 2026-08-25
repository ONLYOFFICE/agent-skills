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
 * Everything in a scaffolded project that is not TypeScript - manifest, placeholder
 * icons, markdown - as text. The version pins below are verified by generating a
 * project and building it, never in this repository; see references/sdk-target.md.
 */

import { SDK_PACKAGE } from "../contract.mjs";

/** Matches the pair in references/sdk-target.md. */
export const SDK_RANGE = "^2.1.0";

const BUILD_SCRIPTS = {
  // The SDK's own packer. It assembles config.json, zips, and base64-encodes the
  // assets - the pre-2.0 `node ./scripts/createZip.js` form no longer works.
  build: "webpack && npx build-docspace-plugin",
  format: "npx prettier --write .",
};

const DEV_DEPENDENCIES = {
  prettier: "2.8.6",
  "ts-loader": "^9.6.2",
  // target: "es5" and moduleResolution: "node" in templates/tsconfig were removed
  // in TypeScript 7, so this pin is load-bearing rather than tidiness.
  typescript: "^6.0.3",
  webpack: "^5.108.3",
  "webpack-cli": "^7.1.0",
};

/**
 * package.json, which is also the manifest the packer reads. Field order follows the
 * official ONLYOFFICE plugins, so it diffs cleanly against a hand-written one.
 *
 * @param {{
 *   name: string, pluginName: string, description: string, author: string,
 *   scopeNames: string[],
 * }} options
 */
export const buildManifest = ({ name, pluginName, description, author, scopeNames }) => ({
  name,
  version: "1.0.0",
  description,
  author,
  license: "Apache-2.0",
  homepage: "",
  main: "index.ts",
  private: true,
  // The loader looks the plugin up as window.Plugins[pluginName]; a mismatch here
  // is the single most common cause of a plugin that installs and does nothing.
  pluginName,
  logo: "logo.svg",
  nameLocale: {},
  descriptionLocale: {},
  scopes: scopeNames,
  scripts: BUILD_SCRIPTS,
  dependencies: {
    [SDK_PACKAGE]: SDK_RANGE,
  },
  devDependencies: DEV_DEPENDENCIES,
});

/** Every plugin has one, at the size the plugin list renders. */
const LOGO_FILE = "logo.svg";
const LOGO_SIZE = 48;

const DEFAULT_ICON_SIZE = 16;

const sizeFromFileName = (fileName) => Number(fileName.match(/(\d+)/)?.[1] ?? DEFAULT_ICON_SIZE);

/**
 * assets/: a placeholder for every icon the declared scopes mention, since the portal
 * resolves icons by file name alone and a missing one renders nothing. Sizes come from
 * those names (icon-16.svg -> 16); replacing the artwork is the author's job.
 */
export class PlaceholderIcons {
  /**
   * @param {{ itemIconFiles: string[], letter: string }} options - `letter` is
   *   stamped on each placeholder so the icons of two scaffolds are told apart.
   */
  constructor({ itemIconFiles, letter }) {
    this.letter = letter;

    this.sizesByFile = new Map([[LOGO_FILE, LOGO_SIZE]]);

    for (const fileName of itemIconFiles)
      this.sizesByFile.set(fileName, sizeFromFileName(fileName));
  }

  /** Paths as they appear inside the generated project. */
  get assetPaths() {
    return [...this.sizesByFile.keys()].map((fileName) => `assets/${fileName}`);
  }

  /** @returns {Array<{ path: string, contents: string }>} */
  get files() {
    return [...this.sizesByFile].map(([fileName, size]) => ({
      path: `assets/${fileName}`,
      contents: this.#svg(size),
    }));
  }

  #svg(size) {
    const radius = Math.max(2, Math.round(size / 8));
    const fontSize = Math.round(size * 0.5);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#4781D1"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="#fff"
        font-family="Arial, sans-serif" font-size="${fontSize}">${this.letter}</text>
</svg>
`;
  }
}

/**
 * The generated README covers the two post-scaffold mistakes: where the uploadable
 * archive is, and that the portal serves a cached bundle until `version` is bumped.
 *
 * @param {{ name: string, description: string, scopeNames: string[] }} options
 */
export const readmeMarkdown = ({ name, description, scopeNames }) => `# ${name}

${description}

## Build

\`\`\`sh
npm install
npm run build
\`\`\`

The uploadable archive is \`dist/plugin.zip\`.

## Install

Upload \`dist/plugin.zip\` in the portal under Settings → Integration → Plugins,
then reload the page fully. Bump \`version\` in \`package.json\` before every
re-upload, otherwise the portal keeps serving the cached bundle and icons.

## Scopes

${scopeNames.map((scopeName) => `- \`${scopeName}\``).join("\n")}
`;

export const changelogMarkdown = () => `# Change Log

## 1.0.0

### Added

- Initial version.
`;
