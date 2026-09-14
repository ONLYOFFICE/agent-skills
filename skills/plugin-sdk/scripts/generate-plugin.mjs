#!/usr/bin/env node

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
 * Scaffolds a DocSpace plugin project: a class implementing every interface its declared
 * scopes require, a Vite + React build with the host-provided packages external, the packed
 * ui-kit and SDK, placeholder assets. It registers no items on purpose - a TODO per scope.
 * Run with no arguments for the options.
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { CliError, USAGE, parseCliOptions } from "./generator/options.mjs";
import { generate } from "./generator/plugin-generator.mjs";

const templatesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

const main = () => {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  const options = parseCliOptions(argv);
  const result = generate(options, { templatesDir });

  console.log(`Scaffolded ${options.pluginName} (${options.name}) in ${result.targetDir}`);
  console.log(`  scopes:       ${options.scopeNames.join(", ")}`);
  console.log(`  runtime:      module - the portal imports dist/plugin.js and reads its default export`);
  console.log(`  ui-kit:       ${result.uiKitTarball}, copied into the project with the tarballs it depends on`);

  if (result.sdkTarball)
    console.log(`  sdk:          ${result.sdkTarball}, installed from the vendored tarball until 3.0.0 is on npm`);

  console.log(`  placeholders: ${result.iconPaths.join(", ")} - replace these with real icons`);

  if (result.hasItemScopes)
    console.log(
      `\nNo items are registered yet - src/index.ts has a TODO per scope inside onLoadCallback.\nUntil each declared scope registers at least one item, validate-plugin.mjs reports\nit as an error, so write the items (and their .tsx components) before validating.`,
    );

  console.log(`\nNext: cd ${result.targetDir} && npm install && npm run build`);
};

try {
  main();
} catch (error) {
  // A CliError is something the caller can fix; anything else is a bug and deserves its stack trace.
  if (!(error instanceof CliError)) throw error;

  console.error(`error: ${error.message}`);
  process.exit(1);
}
