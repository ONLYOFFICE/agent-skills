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
 * Validates a DocSpace plugin project against the portal loader contract: manifest,
 * archive and bundle coherence, plus a runtime smoke test in a sandbox. The tables it
 * applies live in contract.mjs; the passes underneath it are in validator/README.md.
 *
 * Usage:
 *   node scripts/validate-plugin.mjs <pluginDir> [options]
 *
 * Options:
 *   --no-runtime  skip loading dist/plugin.js in a sandbox
 *   --invoke      also call every item callback with a dummy id and validate
 *                 the returned IMessage (may hit the network - opt in)
 *   --json        machine-readable report on stdout
 *
 * Exit code 1 when there is at least one ERROR.
 */

import * as path from "node:path";

import { ArchiveChecks } from "./validator/archive-checks.mjs";
import { Findings } from "./validator/findings.mjs";
import { FatalProjectError, PluginProject } from "./validator/plugin-project.mjs";
import { ProjectChecks } from "./validator/project-checks.mjs";
import { RuntimeChecks } from "./validator/runtime-checks.mjs";

const parseArgs = (argv) => {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));

  return {
    dir: path.resolve(argv.find((arg) => !arg.startsWith("--")) ?? "."),
    json: flags.has("--json"),
    options: {
      runtime: !flags.has("--no-runtime"),
      invoke: flags.has("--invoke"),
    },
  };
};

const printJsonReport = ({ project, findings, runtime }) => {
  console.log(
    JSON.stringify(
      {
        plugin: {
          dir: project.dir,
          name: project.manifest.name,
          pluginName: project.pluginName,
          version: project.manifest.version,
          scopes: project.scopes,
        },
        built: project.isBuilt,
        runtime,
        findings: findings.all,
        ok: !findings.hasErrors,
      },
      null,
      2,
    ),
  );
};

const printTextReport = ({ project, findings, runtime }) => {
  const { manifest } = project;

  console.log(
    `${manifest.name} (${project.pluginName}) ${manifest.version} - scopes: ${project.scopes.join(", ") || "none"}`,
  );
  console.log(`${project.dir}\n`);

  for (const finding of findings.all)
    console.log(`${finding.level.padEnd(5)} [${finding.code}] ${finding.message}`);

  const itemCounts = Object.entries(runtime.items)
    .map(([scope, count]) => `${scope}:${count}`)
    .join(" ");

  console.log(
    `\n${findings.errors.length} error(s), ${findings.warnings.length} warning(s)${
      runtime.loaded ? ` - runtime: ${itemCounts || "no item scopes"}` : ""
    }`,
  );
};

const main = async () => {
  const { dir, json, options } = parseArgs(process.argv.slice(2));

  const project = await PluginProject.load(dir);
  const findings = new Findings();
  const context = { project, findings, options };

  // Order matters for the reader, not for correctness: the manifest first, then
  // what was built from it, then what it does when run.
  await new ProjectChecks(context).run();
  await new ArchiveChecks(context).run();

  const runtimeChecks = new RuntimeChecks(context);
  await runtimeChecks.run();

  const report = { project, findings, runtime: runtimeChecks.report };

  if (json) printJsonReport(report);
  else printTextReport(report);

  process.exit(findings.hasErrors ? 1 : 0);
};

try {
  await main();
} catch (error) {
  // There is nothing to report about a directory that is not a plugin project.
  if (!(error instanceof FatalProjectError)) throw error;

  console.error(error.message);
  process.exit(1);
}
