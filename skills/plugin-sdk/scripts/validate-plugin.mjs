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
 * Validates an ONLYOFFICE Apps plugin project against the portal loader contract.
 *
 *   node scripts/validate-plugin.mjs <pluginDir> [--invoke] [--json]
 *
 * --invoke also calls every item callback with a dummy id and validates the returned
 * IMessage (may hit the network - opt in), which is also what turns up the dialogs and
 * viewers a click opens, so the render pass can render those too. Exit code 1 when there is
 * at least one ERROR.
 */

import * as path from "node:path";

import { ArchiveChecks } from "./validator/archive-checks.mjs";
import { Findings } from "./validator/findings.mjs";
import { FatalProjectError, PluginProject } from "./validator/plugin-project.mjs";
import { ProjectChecks } from "./validator/project-checks.mjs";
import { RenderChecks } from "./validator/render-checks.mjs";
import { RuntimeChecks } from "./validator/runtime-checks.mjs";

const parseArgs = (argv) => {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));

  return {
    dir: path.resolve(argv.find((arg) => !arg.startsWith("--")) ?? "."),
    json: flags.has("--json"),
    options: { invoke: flags.has("--invoke") },
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

  // A pass that could not run, one where every surface threw, and one with nothing to render
  // all belong in the last line - a silent one reads as full coverage.
  const { rendered, attempted, skipped } = runtime.render ?? {};
  const render = skipped
    ? ` - render skipped: ${skipped}`
    : attempted
      ? ` - rendered: ${rendered}/${attempted} surface(s)`
      : runtime.loaded
        ? " - no surfaces to render"
        : "";

  // A click that fetched before returning its message handed over no surface, so the count
  // above is short by that many. Say so beside it.
  const truncated = runtime.networkTruncated
    ? ` (${runtime.networkTruncated} callback(s) stopped at a network call)`
    : "";

  console.log(
    `\n${findings.errors.length} error(s), ${findings.warnings.length} warning(s)${
      runtime.loaded ? ` - runtime: ${itemCounts || "no item scopes"}` : ""
    }${render}${truncated}`,
  );
};

const main = async () => {
  const { dir, json, options } = parseArgs(process.argv.slice(2));

  const project = await PluginProject.load(dir);
  const findings = new Findings();
  const context = { project, findings, options };

  // The manifest first, then what was built from it, then what it does when run - and a
  // module whose imports the portal cannot resolve never loads, so the runtime pass needs
  // what the archive pass found.
  await new ProjectChecks(context).run();
  const archive = await new ArchiveChecks(context).run();
  const runtimeChecks = new RuntimeChecks(context, archive);
  await runtimeChecks.run();

  // Rendering needs the components the runtime pass collected, so it comes last.
  const renderChecks = new RenderChecks(context);
  await renderChecks.run(runtimeChecks.surfaces);

  const report = {
    project,
    findings,
    runtime: { ...runtimeChecks.report, render: renderChecks.report },
  };

  if (json) printJsonReport(report);
  else printTextReport(report);

  process.exit(findings.hasErrors ? 1 : 0);
};

try {
  await main();
} catch (error) {
  if (!(error instanceof FatalProjectError)) throw error;

  console.error(error.message);
  process.exit(1);
}
