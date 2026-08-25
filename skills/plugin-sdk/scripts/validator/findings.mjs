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
 * What a check produces, and how a check is wired up. Every finding carries a level, a
 * code and a sentence saying what the *user* would observe; the codes are the report's
 * contract, read by test-validator.mjs and the grader. README.md defines the levels.
 */

export class Findings {
  #entries = [];

  add(level, code, message) {
    this.#entries.push({ level, code, message });
  }

  error(code, message) {
    this.add("ERROR", code, message);
  }

  warn(code, message) {
    this.add("WARN", code, message);
  }

  info(code, message) {
    this.add("INFO", code, message);
  }

  get all() {
    return [...this.#entries];
  }

  get errors() {
    return this.#entries.filter((finding) => finding.level === "ERROR");
  }

  get warnings() {
    return this.#entries.filter((finding) => finding.level === "WARN");
  }

  get hasErrors() {
    return this.errors.length > 0;
  }
}

/**
 * Base for a group of checks: subclasses get the project, the findings to write into and
 * the options, and implement run(). Nothing else is shared.
 */
export class Check {
  /**
   * @param {{
   *   project: import("./plugin-project.mjs").PluginProject,
   *   findings: Findings,
   *   options: { runtime: boolean, invoke: boolean },
   * }} context
   */
  constructor({ project, findings, options }) {
    this.project = project;
    this.findings = findings;
    this.options = options;
  }

  error(code, message) {
    this.findings.error(code, message);
  }

  warn(code, message) {
    this.findings.warn(code, message);
  }

  info(code, message) {
    this.findings.info(code, message);
  }

  async run() {
    throw new Error(`${this.constructor.name} does not implement run()`);
  }
}
