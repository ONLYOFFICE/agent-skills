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
 * The machinery every suite uses: somewhere to put throwaway projects, a way to run the
 * validator over one, a way to record an expectation. Nothing here knows about DocSpace -
 * it exists so a suite reads as a list of claims, with no temp-directory noise between.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { COMPONENT_PROPS, DEVICES, EVENT_TYPES, KNOWN_ACTIONS, SDK_PACKAGE, USERS_TYPES } from "../contract.mjs";

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const validatorPath = path.join(scriptsDir, "validate-plugin.mjs");

const PLACEHOLDER_SVG = "<svg xmlns='http://www.w3.org/2000/svg'/>";

/** One validator run, with the questions the suites actually ask of it. */
export class ValidatorReport {
  constructor(json) {
    this.json = json;
  }

  get ok() {
    return this.json.ok;
  }

  get runtime() {
    return this.json.runtime;
  }

  get findings() {
    return this.json.findings;
  }

  codes(level) {
    return this.findings.filter((finding) => finding.level === level).map((finding) => finding.code);
  }

  get errorCodes() {
    return this.codes("ERROR");
  }

  get warningCodes() {
    return this.codes("WARN");
  }

  /** Every message, one per line - the form the substring assertions read. */
  get messages() {
    return this.findings.map((finding) => finding.message).join("\n");
  }

  messagesAt(level) {
    return this.findings
      .filter((finding) => finding.level === level)
      .map((finding) => finding.message)
      .join("\n");
  }

  mentions(text) {
    return this.messages.includes(text);
  }

  /**
   * True when a *single* finding mentions all of these - stricter than mentions(), for a
   * claim about one sentence explaining one defect.
   */
  hasFindingMentioning(...texts) {
    return this.findings.some((finding) => texts.every((text) => finding.message.includes(text)));
  }

  errorsMention(text) {
    return this.messagesAt("ERROR").includes(text);
  }

  warningsMention(text) {
    return this.messagesAt("WARN").includes(text);
  }

  /** Detail string for a failing expectation. */
  get errorSummary() {
    return `errors: ${this.errorCodes.join(", ")}`;
  }

  get messageSummary() {
    return this.findings.map((finding) => finding.message).join(" | ");
  }
}

/** A temp directory full of throwaway plugin projects. */
export class FixtureWorkspace {
  constructor() {
    this.root = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-validator-"));
  }

  /**
   * Writes a project: manifest, one source file, a hand-written bundle in dist/ and
   * placeholder assets.
   *
   * @returns {string} the project directory
   */
  write(dirName, { pkg, bundle, src, assets = ["logo.svg"] }) {
    const dir = path.join(this.root, dirName);

    for (const sub of ["src", "dist", "assets"])
      fs.mkdirSync(path.join(dir, sub), { recursive: true });

    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2));
    fs.writeFileSync(path.join(dir, "src", "index.ts"), src);
    fs.writeFileSync(path.join(dir, "dist", "plugin.js"), bundle);

    for (const asset of assets)
      fs.writeFileSync(path.join(dir, "assets", asset), PLACEHOLDER_SVG);

    return dir;
  }

  /** Deletes part of a written project - used to make an unbuilt one. */
  remove(dir, relativePath) {
    fs.rmSync(path.join(dir, relativePath), { recursive: true, force: true });
  }

  /**
   * An SDK inside the project's node_modules, built from the contract tables - otherwise
   * the quiet drift case would only look quiet by accident.
   */
  installFakeSdk(dir, { version, extraAction, extraUserType } = {}) {
    const sdkDir = path.join(dir, "node_modules", "@onlyoffice", "docspace-plugin-sdk");
    fs.mkdirSync(sdkDir, { recursive: true });

    fs.writeFileSync(
      path.join(sdkDir, "package.json"),
      JSON.stringify({ name: SDK_PACKAGE, version, type: "module", main: "index.js" }),
    );

    const asEnum = (values) =>
      `{ ${values.map((value, index) => `k${index}: ${JSON.stringify(value)}`).join(", ")} }`;

    fs.writeFileSync(
      path.join(sdkDir, "index.js"),
      `export const UsersType = ${asEnum([...USERS_TYPES, ...(extraUserType ? [extraUserType] : [])])};
export const Devices = ${asEnum(DEVICES)};
export const Events = ${asEnum(EVENT_TYPES)};
export const Components = ${asEnum(Object.keys(COMPONENT_PROPS))};
export const Actions = ${asEnum([...KNOWN_ACTIONS, ...(extraAction ? [extraAction] : [])])};
`,
    );
  }

  /** Runs the validator with --json and parses the report. */
  validate(dir, ...flags) {
    const run = spawnSync(process.execPath, [validatorPath, dir, "--json", ...flags], {
      encoding: "utf8",
    });

    try {
      return new ValidatorReport(JSON.parse(run.stdout));
    } catch {
      console.error(`Validator produced no JSON for ${dir}:\n${run.stdout}\n${run.stderr}`);
      process.exit(1);
    }
  }

  /** Writes a project and validates it in one step - the common case. */
  validateProject(dirName, project, ...flags) {
    return this.validate(this.write(dirName, project), ...flags);
  }

  cleanup() {
    fs.rmSync(this.root, { recursive: true, force: true });
  }
}

/** The scoreboard. One line per expectation, a count at the end. */
export class Expectations {
  #results = [];

  /** @param {string} label - reads as a claim, because a failure prints it verbatim */
  check(label, ok, detail) {
    this.#results.push({ label, ok });

    if (ok) console.log(`ok    ${label}`);
    else console.log(`FAIL  ${label}${detail ? ` - ${detail}` : ""}`);
  }

  section(title) {
    console.log(`\n# ${title}`);
  }

  get failed() {
    return this.#results.filter((result) => !result.ok);
  }

  get total() {
    return this.#results.length;
  }

  printSummary() {
    console.log(`\n${this.total - this.failed.length}/${this.total} expectations passed`);
  }
}
