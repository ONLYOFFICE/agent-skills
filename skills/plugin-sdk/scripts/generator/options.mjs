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
 * The command line: argv in, validated options out. Everything a caller can get wrong is
 * rejected here, before a file is written.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { LOCALE_TAGS, SCOPES, localeMember, localeSuggestions } from "../contract.mjs";

/** A problem the person running the script can fix; printed as `error: <message>`, exit 1. */
export class CliError extends Error {}

export const USAGE = `Usage:
  node scripts/generate-plugin.mjs --name my-plugin --plugin-name MyPlugin \\
    --scopes ContextMenu,ArticleNavigation --dir ./my-plugin

Options:
  --name          portal identifier, lower case, [a-z_-]        (required)
  --plugin-name   JS class name, also the plugin's identity     (required)
  --scopes        comma separated, see contract.mjs             (required)
  --dir           target directory (default: ./<name>)
  --description   one line description for the manifest
  --author        manifest author
  --locales       comma separated PluginLocale tags, e.g. ru,pt-BR,ja-JP
                  (en-US is always present; a tag the enum does not have is rejected -
                  "ja" is not "ja-JP" and would never be selected by the portal)
  --ui-kit        a packed @onlyoffice/apps-ui-kit (onlyoffice-apps-ui-kit-*.tgz) or a
                  directory holding it - and, while the SDK is unpublished, the packed
                  SDK; defaults to the copies vendored in this skill's vendor/ directory
  --force         write into a non-empty directory`;

const readFlag = (argv, flagName) => {
  const at = argv.indexOf(`--${flagName}`);
  return at === -1 ? undefined : argv[at + 1];
};

const readList = (value) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const requireFlag = (argv, flagName) => {
  const value = readFlag(argv, flagName);
  if (!value) throw new CliError(`--${flagName} is required`);
  return value;
};

const isUiKitTarball = (fileName) => /^onlyoffice-apps-ui-kit-.*\.tgz$/.test(fileName);
const isPluginSdkTarball = (fileName) => /^onlyoffice-docspace-plugin-sdk-.*\.tgz$/.test(fileName);

const VENDOR_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "vendor");

/**
 * The packed kit and anything vendored beside it. Every tarball in the directory still travels
 * into the project: the kit named `file:` tarballs of its own until 4.0.0 (they had to sit in
 * the project root, because npm resolves nested `file:` specs against the project, not against
 * the package), and `sdk` is the packed SDK while 3.0.0 is unpublished. Since 4.0.0 the kit
 * names none, so in practice only the two travel -- but the copying stays general, so a kit
 * that vendors something again does not need this code changed.
 * @returns {{ kit: string, sdk: string | undefined, all: string[] }}
 */
const resolveVendoredTarballs = (value) => {
  const given = path.resolve(value ?? VENDOR_DIR);

  if (!fs.existsSync(given))
    throw new CliError(
      value
        ? `--ui-kit ${value} does not exist`
        : `the vendored ui-kit is missing from ${given} - restore vendor/ or pass --ui-kit`,
    );

  const isDir = fs.statSync(given).isDirectory();
  const dir = isDir ? given : path.dirname(given);

  const tarballs = fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".tgz"))
    .map((fileName) => path.join(dir, fileName));

  const kit = isDir ? tarballs.find((tarball) => isUiKitTarball(path.basename(tarball))) : given;

  if (!kit || !isUiKitTarball(path.basename(kit)))
    throw new CliError(
      `${value ? `--ui-kit ${value}` : given} holds no onlyoffice-apps-ui-kit-*.tgz - pack the kit from a docspace-ui-kit-react checkout (pnpm build && pnpm pack)`,
    );

  const all = tarballs.includes(kit) ? tarballs : [kit, ...tarballs];

  return { kit, sdk: all.find((tarball) => isPluginSdkTarball(path.basename(tarball))), all };
};

export const parseCliOptions = (argv) => {
  const name = requireFlag(argv, "name");
  const pluginName = requireFlag(argv, "plugin-name");
  const scopeNames = readList(requireFlag(argv, "scopes"));

  // The packer lower-cases the name anyway, so a capital here would silently rename the plugin.
  if (!/^[a-z][a-z_-]*$/.test(name))
    throw new CliError(`--name "${name}" must be lower case letters, - and _ only (the packer lower-cases it anyway)`);

  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(pluginName))
    throw new CliError(`--plugin-name "${pluginName}" must be a valid JS identifier - it becomes the plugin class name`);

  for (const scopeName of scopeNames)
    if (!SCOPES.includes(scopeName))
      throw new CliError(`unknown scope "${scopeName}" (known: ${SCOPES.join(", ")})`);

  const extraLocales = readList(readFlag(argv, "locales")).filter((tag) => tag !== "en-US");

  // A tag outside PluginLocale is the worst kind of typo: it compiles, installs, and the
  // portal never asks for that language, so the translation is dead weight nobody notices.
  for (const tag of extraLocales)
    if (!localeMember(tag)) {
      const suggestions = localeSuggestions(tag);
      throw new CliError(
        suggestions.length
          ? `--locales "${tag}" is not a PluginLocale value - did you mean ${suggestions.join(" or ")}?`
          : `--locales "${tag}" is not a PluginLocale value (known: ${LOCALE_TAGS.join(", ")})`,
      );
    }

  const targetDir = path.resolve(readFlag(argv, "dir") ?? `./${name}`);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0 && !argv.includes("--force"))
    throw new CliError(`${targetDir} is not empty - pass --force to write into it anyway`);

  return {
    name,
    pluginName,
    scopeNames,
    targetDir,
    description: readFlag(argv, "description") ?? `ONLYOFFICE Apps plugin ${name}`,
    author: readFlag(argv, "author") ?? "",
    extraLocales,
    vendoredTarballs: resolveVendoredTarballs(readFlag(argv, "ui-kit")),
  };
};
