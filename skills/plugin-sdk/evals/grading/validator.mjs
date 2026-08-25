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
 * Asking the skill's own validator what it makes of a project - the one view that is not a
 * guess about source text, since `--invoke` reports what the bundle really registered. Each
 * project is validated once, because loading a bundle is not cheap.
 */

import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { wasPackaged } from "./run-output.mjs";

const VALIDATOR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "scripts",
  "validate-plugin.mjs",
);

const reportsByProject = new Map();

/** The validator's report, or null when it could not produce one. */
export const reportFor = (project) => {
  if (reportsByProject.has(project)) return reportsByProject.get(project);

  const finished = spawnSync(process.execPath, [VALIDATOR, project, "--invoke", "--json"], {
    encoding: "utf8",
  });

  let report;
  try {
    report = JSON.parse(finished.stdout);
  } catch {
    report = null;
  }

  reportsByProject.set(project, report);
  return report;
};

export const hasNoErrors = (project) => {
  const report = reportFor(project);
  if (!report) return false;

  return report.ok && report.findings.every((finding) => finding.level !== "ERROR");
};

/**
 * Warnings coded `component` are the values that compile and then render wrong: dead
 * ButtonSize/InputSize members, malformed comboBox options, a string `borderProp`.
 */
export const componentWarningsFor = (project) => {
  const report = reportFor(project);
  if (!report) return null;

  return report.findings.filter(
    (finding) => finding.level === "WARN" && finding.code === "component",
  );
};

/** What the built bundle registered, keyed by scope, or null when the report cannot say -
 * no archive to load, or a bundle that would not load. */
export const registeredKeysByScope = (project) => {
  if (!wasPackaged(project)) return null;

  const report = reportFor(project);
  if (!report?.runtime?.loaded || !report.runtime.keys) return null;

  return report.runtime.keys;
};

export const registeredKeys = (project) => {
  const byScope = registeredKeysByScope(project);
  return byScope ? Object.values(byScope).flat() : null;
};
