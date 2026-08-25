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
 * The command line: argv in, validated options out. Everything a caller can get
 * wrong is rejected here, before a file is written - a half scaffolded project is
 * worse than none. This file knows a valid request, not what a plugin looks like.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { SCOPES } from "../contract.mjs";
import { SCOPE_SPECS } from "./scopes.mjs";

/**
 * A problem the person running the script can fix. The entry point prints these
 * as `error: <message>` and exits 1; anything else escapes as a stack trace,
 * which is what a bug in here deserves.
 */
export class CliError extends Error {}

export const USAGE = `Usage:
  node scripts/generate-plugin.mjs --name my-plugin --plugin-name MyPlugin \\
    --scopes ContextMenu,MainButton --dir ./my-plugin

Options:
  --name          portal identifier, lower case, [a-z_-]        (required)
  --plugin-name   JS class name == window.Plugins.<pluginName>  (required)
  --scopes        comma separated, see contract.mjs             (required)
  --dir           target directory (default: ./<name>)
  --description   one line description for the manifest
  --author        manifest author
  --locales       comma separated extra locales, e.g. ru,de     (en is always present)
  --force         write into a non-empty directory`;

const readFlag = (argv, flagName) => {
  const at = argv.indexOf(`--${flagName}`);
  return at === -1 ? undefined : argv[at + 1];
};

const hasFlag = (argv, flagName) => argv.includes(`--${flagName}`);

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

/** The packer lower-cases the name anyway, so a capital here silently renames the plugin. */
const assertPortalName = (name) => {
  if (!/^[a-z][a-z_-]*$/.test(name))
    throw new CliError(
      `--name "${name}" must be lower case letters, - and _ only (the packer lower-cases it anyway)`,
    );
};

/** It becomes window.Plugins.<pluginName>, so it has to be addressable as one. */
const assertClassName = (pluginName) => {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(pluginName))
    throw new CliError(
      `--plugin-name "${pluginName}" must be a valid JS identifier - it becomes window.Plugins.${pluginName}`,
    );
};

/**
 * A scope has to be in the portal contract *and* have a generation spec. Missing
 * either one would generate a class that claims an interface it does not implement.
 */
const assertKnownScopes = (scopeNames) => {
  for (const scopeName of scopeNames)
    if (!SCOPES.includes(scopeName) || !SCOPE_SPECS[scopeName])
      throw new CliError(`unknown scope "${scopeName}" (known: ${SCOPES.join(", ")})`);
};

const assertTargetUsable = (targetDir, force) => {
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0 && !force)
    throw new CliError(`${targetDir} is not empty - pass --force to write into it anyway`);
};

/**
 * @returns {{
 *   name: string, pluginName: string, scopeNames: string[], targetDir: string,
 *   description: string, author: string, extraLocales: string[],
 * }}
 */
export const parseCliOptions = (argv) => {
  const name = requireFlag(argv, "name");
  const pluginName = requireFlag(argv, "plugin-name");
  const scopeNames = readList(requireFlag(argv, "scopes"));

  assertPortalName(name);
  assertClassName(pluginName);
  assertKnownScopes(scopeNames);

  const targetDir = path.resolve(readFlag(argv, "dir") ?? `./${name}`);
  assertTargetUsable(targetDir, hasFlag(argv, "force"));

  return {
    name,
    pluginName,
    scopeNames,
    targetDir,
    description: readFlag(argv, "description") ?? `DocSpace plugin ${name}`,
    author: readFlag(argv, "author") ?? "",
    extraLocales: readList(readFlag(argv, "locales")),
  };
};
