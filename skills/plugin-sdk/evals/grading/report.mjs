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
 * Turning graded runs into something a person reads: tables for the detail, one row per run,
 * and a summary to read first - the comparison is why two configurations were run at all.
 */

import { NOT_APPLICABLE, UNKNOWN, scoreOf } from "./verdict.mjs";

const MARK = new Map([
  [true, " ✓ "],
  [false, " · "],
  [UNKNOWN, " ? "],
  [NOT_APPLICABLE, " – "],
]);

export const LEGEND = [
  "Marks: ✓ passed   · failed   ? unknown, the check applies but could not decide",
  "       – not applicable, excluded from the score",
];

/** Collects the lines as it prints them, so the same text can be written to disk. */
export const createTranscript = () => {
  const lines = [];

  return {
    write: (line = "") => {
      console.log(line);
      lines.push(line);
    },
    text: () => lines.join("\n").trim(),
  };
};

const columnWidth = (heading, values) =>
  Math.max(heading.length, ...values.map((value) => String(value).length));

export const printTable = (transcript, title, labels, runs) => {
  if (runs.length === 0) return;

  const nameWidth = columnWidth(title, runs.map((run) => run.name));
  const columnKeys = labels.map((_, index) => `[${index}]`).join(" ");

  transcript.write();
  transcript.write(title);
  transcript.write();
  transcript.write(`${"run".padEnd(nameWidth)}  ${columnKeys}  score`);

  for (const run of runs) {
    const marks = labels.map((label) => MARK.get(run.results[label]) ?? " · ").join(" ");
    const { passed, total } = scoreOf(run.results, labels);

    transcript.write(`${run.name.padEnd(nameWidth)}  ${marks}  ${passed}/${total}`);
  }

  transcript.write();
  labels.forEach((label, index) => transcript.write(`  [${index}] ${label}`));
};

const average = (numbers) => numbers.reduce((sum, next) => sum + next, 0) / numbers.length;

const round = (number) => (Number.isInteger(number) ? String(number) : number.toFixed(1));

/**
 * One variant's score, averaged over however many runs of it there were, with the
 * range printed when they disagreed. A dash when the variant is missing entirely.
 */
const scoreCell = (scores) => {
  if (!scores) return "—";

  const passed = scores.map((score) => score.passed);
  const total = Math.max(...scores.map((score) => score.total));
  const disagreed = scores.length > 1 && Math.min(...passed) !== Math.max(...passed);
  const range = disagreed ? ` (${Math.min(...passed)}-${Math.max(...passed)})` : "";

  return `${round(average(passed))}/${total}${range}`;
};

/*
 * A tie is a finding in its own right: the baseline reaching the same score means those
 * passages tell the model what it already knew. A drop is the alarm - though with one sample
 * it may be the model having a different day, which is why the count travels with it.
 */
const verdictFor = ({ delta, samples, unknown }) => {
  const notes = [];

  if (delta === null) notes.push("no comparison - one configuration only");
  else if (delta < 0) notes.push("REGRESSION - read both runs");
  else if (delta === 0) notes.push("tie - the skill's text earned nothing here");
  else notes.push("skill ahead");

  if (delta !== null && samples === 1) notes.push("1 sample");
  if (unknown > 0) notes.push(`${unknown} unknown`);

  return notes.join(", ");
};

const BASELINE_PREFERENCE = ["without_skill", "old_skill"];

const summariseScenario = (scenario) => {
  const scoresFor = (variant) => scenario.scoresByVariant.get(variant);

  const withSkill = scoresFor("with_skill");
  const baselineVariant = BASELINE_PREFERENCE.find((variant) => scoresFor(variant));
  const baseline = baselineVariant ? scoresFor(baselineVariant) : null;

  const delta =
    withSkill && baseline
      ? average(withSkill.map((score) => score.passed)) -
        average(baseline.map((score) => score.passed))
      : null;

  const allScores = [...scenario.scoresByVariant.values()];

  return {
    eval: scenario.directory.replace(/^eval-/, ""),
    name: scenario.name,
    baselineVariant,
    with: scoreCell(withSkill),
    baseline: scoreCell(baseline),
    delta: delta === null ? "—" : `${delta > 0 ? "+" : ""}${round(delta)}`,
    verdict: verdictFor({
      delta,
      samples: Math.max(...allScores.map((scores) => scores.length)),
      unknown: allScores.flat().reduce((sum, score) => sum + score.unknown, 0),
    }),
  };
};

/** One row per scenario, keyed by directory so the order matches the tables. */
const scenariosFrom = (runs) => {
  const byDirectory = new Map();

  for (const run of runs) {
    const scenario =
      byDirectory.get(run.directory) ??
      ({ directory: run.directory, name: run.evalName, scoresByVariant: new Map() });

    const score = scoreOf(run.results, run.labels);
    const existing = scenario.scoresByVariant.get(run.variant) ?? [];

    scenario.scoresByVariant.set(run.variant, [...existing, score]);
    byDirectory.set(run.directory, scenario);
  }

  return [...byDirectory.keys()].sort().map((directory) => summariseScenario(byDirectory.get(directory)));
};

export const printSummary = (transcript, runs) => {
  const rows = scenariosFrom(runs);

  const widths = {
    eval: columnWidth("eval", rows.map((row) => row.eval)),
    with: columnWidth("with_skill", rows.map((row) => row.with)),
    baseline: columnWidth("baseline", rows.map((row) => row.baseline)),
    delta: columnWidth("delta", rows.map((row) => row.delta)),
  };

  transcript.write();
  transcript.write("Summary");
  transcript.write();
  transcript.write(
    [
      "eval".padEnd(widths.eval),
      "with_skill".padEnd(widths.with),
      "baseline".padEnd(widths.baseline),
      "delta".padEnd(widths.delta),
      "verdict",
    ].join("  "),
  );

  for (const row of rows)
    transcript.write(
      [
        row.eval.padEnd(widths.eval),
        row.with.padEnd(widths.with),
        row.baseline.padEnd(widths.baseline),
        row.delta.padEnd(widths.delta),
        row.verdict,
      ].join("  "),
    );

  if (rows.some((row) => row.baselineVariant === "old_skill"))
    transcript.write(
      "\nNote: the baseline for some evals is old_skill. Two adjacent revisions produce nearly" +
        "\nthe same runs, so those comparisons cannot show much either way - rerun against without_skill.",
    );

  if (rows.some((row) => row.verdict.includes("1 sample")))
    transcript.write(
      "\nNote: one run per configuration. A single changed check is as likely to be the model" +
        "\nvarying as a real change - add a second run directory (with_skill-2) to see the spread.",
    );

  return rows;
};
