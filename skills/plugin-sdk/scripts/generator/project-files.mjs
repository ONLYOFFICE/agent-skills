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
 * Everything in a scaffolded project that is not TypeScript - manifest, placeholder icons,
 * markdown. The version pins are verified by generating a project and building it, never in
 * this repository; see references/scopes.md.
 */

import { MODULE_RUNTIME, SDK_PACKAGE, UI_KIT_PACKAGE } from "../contract.mjs";

/** Used when no packed SDK is vendored; while 3.0.0 is unpublished the tarball is installed instead. */
const SDK_RANGE = "^3.0.0";

const BUILD_SCRIPTS = {
  // Vite writes dist/plugin.js; the SDK's own packer assembles config.json and zips.
  build: "vite build && npx build-docspace-plugin",
  // Vite strips types without checking them, so a build alone proves nothing about them.
  typecheck: "tsc --noEmit",
  format: "npx prettier --write .",
};

// The toolchain the SDK's own template ships. react and react-dom are dependencies so the
// types and the JSX runtime resolve at build time; the build marks them external.
const DEPENDENCIES = {
  react: "^19.0.0",
  "react-dom": "^19.0.0",
};

const DEV_DEPENDENCIES = {
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "@vitejs/plugin-react": "^6.0.0",
  prettier: "^3.0.0",
  typescript: "^5.6.0",
  vite: "^8.0.0",
};

/** package.json, which is also the manifest the packer reads. Field order follows the SDK template. */
export const buildManifest = ({ name, pluginName, description, author, scopeNames, uiKitTarball, sdkTarball }) => ({
  name,
  pluginName,
  version: "1.0.0",
  description,
  author,
  license: "Apache-2.0",
  homepage: "",
  private: true,
  runtime: MODULE_RUNTIME,
  logo: "logo.svg",
  nameLocale: {},
  descriptionLocale: {},
  scopes: scopeNames,
  scripts: BUILD_SCRIPTS,
  dependencies: {
    [SDK_PACKAGE]: sdkTarball ? `file:./${sdkTarball}` : SDK_RANGE,
    ...DEPENDENCIES,
    [UI_KIT_PACKAGE]: `file:./${uiKitTarball}`,
  },
  devDependencies: DEV_DEPENDENCIES,
});

const LOGO_FILE = "logo.svg";
const LOGO_SIZE = 48;
const DEFAULT_ICON_SIZE = 16;

const sizeFromFileName = (fileName) => Number(fileName.match(/(\d+)/)?.[1] ?? DEFAULT_ICON_SIZE);

// An explicit fill attribute on every shape: the portal recolors only shapes that carry one.
const placeholderSvg = (size, letter) => {
  const radius = Math.max(2, Math.round(size / 8));
  const fontSize = Math.round(size * 0.5);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#657077"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="#ffffff"
        font-family="Arial, sans-serif" font-size="${fontSize}">${letter}</text>
</svg>
`;
};

/**
 * assets/: a placeholder for every icon the declared scopes mention (sizes from the names,
 * icon-16.svg -> 16), stamped with a letter so two scaffolds' icons are told apart.
 * @returns {{ paths: string[], files: Array<{ path: string, contents: string }> }}
 */
export const placeholderIcons = ({ itemIconFiles, letter }) => {
  const sizesByFile = new Map([[LOGO_FILE, LOGO_SIZE]]);
  for (const fileName of itemIconFiles) sizesByFile.set(fileName, sizeFromFileName(fileName));

  const files = [...sizesByFile].map(([fileName, size]) => ({
    path: `assets/${fileName}`,
    contents: placeholderSvg(size, letter),
  }));

  return { paths: files.map(({ path }) => path), files };
};

export const readmeMarkdown = ({ name, description, scopeNames, uiKitTarball, sdkTarball }) => `# ${name}

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

## The UI kit

\`${UI_KIT_PACKAGE}\` is not published to npm, so it is installed from \`${uiKitTarball}\`, a
packed copy of the kit from a DocSpace client checkout (\`libs/ui-kit\`: \`pnpm build &&
pnpm pack\`). It is a build-time dependency only: the bundle keeps the kit external and
the portal supplies its own copy at load time. The kit depends on tarballs of its own
(\`file:\` entries in its \`package.json\`), which is why they sit next to this file too -
npm resolves those paths against the project, not against the kit.
${
  sdkTarball
    ? `
\`${SDK_PACKAGE}\` 3.x is not on npm yet either, so it is installed the same way, from
\`${sdkTarball}\`. Once the release is published, replace that \`file:\` entry with
\`"${SDK_RANGE}"\` and delete the tarball.
`
    : ""
}
## Scopes

${scopeNames.map((scopeName) => `- \`${scopeName}\``).join("\n")}
`;

export const changelogMarkdown = () => `# Change Log

## 1.0.0

### Added

- Initial version.
`;
