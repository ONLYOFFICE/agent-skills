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
 * Grades eval runs on the checks that can be decided mechanically, so judgement is spent
 * only where it is needed. This file is the walk and the write-up; the checks live in
 * grading/checks.mjs. README.md covers the layout, the symbols and the variance note.
 *
 * Usage:
 *   node evals/grade.mjs <workspace>/iteration-N
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { REPORT_CHECKS, SCENARIO_CHECKS, UNIVERSAL_CHECKS } from "./grading/checks.mjs";
import { fileExists, readTextFile, subdirectoriesOf } from "./grading/files.mjs";
import { LEGEND, createTranscript, printSummary, printTable } from "./grading/report.mjs";
import { projectIn, proseIn } from "./grading/run-output.mjs";

const evalsDirectory = path.dirname(fileURLToPath(import.meta.url));

/*
 * Two names for the baseline, so accept whichever is there. `old_skill` answers a much
 * weaker question than `without_skill`, and the summary says so when it sees one.
 */
const VARIANTS = ["with_skill", "without_skill", "old_skill"];

/** `with_skill`, `with_skill-2` and `with_skill-run3` are all the same variant. */
const variantOf = (directoryName) =>
  VARIANTS.find(
    (variant) =>
      directoryName === variant ||
      directoryName.startsWith(`${variant}-`) ||
      directoryName.startsWith(`${variant}.`),
  ) ?? null;

const evalSpecifications = (() => {
  try {
    return JSON.parse(readTextFile(path.join(evalsDirectory, "evals.json"))).evals ?? [];
  } catch {
    return [];
  }
})();

/** Run directories may carry a descriptive suffix - `eval-2-audit-...`. */
const specificationFor = (evalDirectory) => {
  const id = Number(evalDirectory.match(/^eval-(\d+)/)?.[1]);
  return evalSpecifications.find((specification) => specification.id === id) ?? null;
};

const applyChecks = (checks, subject, runDirectory) => {
  const results = {};

  for (const [label, check] of Object.entries(checks)) {
    try {
      results[label] = check(subject, runDirectory);
    } catch {
      results[label] = false;
    }
  }

  return results;
};

/**
 * Every graded run beneath an iteration directory. A run carries its own `labels`, since
 * what it was asked differs per scenario - and the summary needs no guesswork about keys.
 */
const gradeRuns = (iteration) => {
  const projectRuns = [];
  const proseRuns = [];

  const evalDirectories = subdirectoriesOf(iteration).filter((name) => name.startsWith("eval-"));

  for (const directory of evalDirectories) {
    const specification = specificationFor(directory);
    const writesProse = specification?.mode === "audit" || specification?.mode === "explain";

    for (const runDirectoryName of subdirectoriesOf(path.join(iteration, directory))) {
      const variant = variantOf(runDirectoryName);
      if (!variant) continue;

      const runDirectory = path.join(iteration, directory, runDirectoryName);
      const identity = {
        name: `${directory}/${runDirectoryName}`,
        directory,
        evalName: specification?.name ?? directory,
        variant,
      };

      if (writesProse) {
        const checks = REPORT_CHECKS[specification?.name] ?? {};
        if (Object.keys(checks).length === 0) continue;

        proseRuns.push({
          ...identity,
          labels: Object.keys(checks),
          results: applyChecks(checks, proseIn(runDirectory), runDirectory),
        });
        continue;
      }

      const project = projectIn(runDirectory);
      if (!project) continue;

      const checks = { ...UNIVERSAL_CHECKS, ...(SCENARIO_CHECKS[specification?.name] ?? {}) };

      projectRuns.push({
        ...identity,
        labels: Object.keys(checks),
        results: applyChecks(checks, project, runDirectory),
      });
    }
  }

  return { projectRuns, proseRuns };
};

/** grading.json keeps the flat shape it has always had: one object per run. */
const serialiseRuns = (runs) =>
  runs.map(({ name, directory, evalName, variant, results }) => ({
    run: name,
    evalDir: directory,
    evalName,
    variant,
    ...results,
  }));

const main = () => {
  const iteration = path.resolve(process.argv[2] ?? ".");

  if (!fileExists(iteration)) {
    console.error(`No such directory: ${iteration}`);
    process.exit(1);
  }

  const { projectRuns, proseRuns } = gradeRuns(iteration);

  if (projectRuns.length === 0 && proseRuns.length === 0) {
    console.log(`No runs found under ${iteration}`);
    process.exit(0);
  }

  const transcript = createTranscript();

  // The universal columns across every generated project: a systemic regression is easier
  // to see here than spread over a table per scenario.
  printTable(transcript, "Generated projects - universal checks", Object.keys(UNIVERSAL_CHECKS), projectRuns);

  // Then what each scenario asked for on top, where it asked for anything.
  for (const [scenario, checks] of Object.entries(SCENARIO_CHECKS))
    printTable(
      transcript,
      `Generated projects - ${scenario}`,
      Object.keys(checks),
      projectRuns.filter((run) => run.evalName === scenario),
    );

  // Each prose eval asks different questions, so it gets its own table rather than a
  // shared one full of blanks.
  for (const scenario of new Set(proseRuns.map((run) => run.evalName)))
    printTable(
      transcript,
      `Reports - ${scenario}`,
      Object.keys(REPORT_CHECKS[scenario]),
      proseRuns.filter((run) => run.evalName === scenario),
    );

  const summary = printSummary(transcript, [...projectRuns, ...proseRuns]);

  transcript.write();
  LEGEND.forEach(transcript.write);

  const gradingJson = path.join(iteration, "grading.json");
  const gradingMarkdown = path.join(iteration, "grading.md");

  fs.writeFileSync(
    gradingJson,
    `${JSON.stringify(
      { summary, projects: serialiseRuns(projectRuns), reports: serialiseRuns(proseRuns) },
      null,
      2,
    )}\n`,
  );

  fs.writeFileSync(
    gradingMarkdown,
    `# Grading - ${path.basename(iteration)}\n\n\`\`\`\n${transcript.text()}\n\`\`\`\n`,
  );

  console.log(`\nWritten to ${gradingJson} and grading.md`);
};

main();
