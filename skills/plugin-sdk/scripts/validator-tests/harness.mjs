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
 * validator over one, a way to record an expectation. Nothing here knows about DocSpace.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { DEVICES, EVENT_TYPES, KNOWN_ACTIONS, SDK_PACKAGE, SECTIONS, USERS_TYPES } from "../contract.mjs";
import { VITE_CONFIG } from "./fixtures.mjs";

const validatorPath = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "validate-plugin.mjs");

const PLACEHOLDER_SVG = "<svg xmlns='http://www.w3.org/2000/svg'/>";

const SDK_DIR = "@onlyoffice/docspace-plugin-sdk";

const sdkPackageJson = (version) =>
  JSON.stringify({ name: SDK_PACKAGE, version, type: "module", exports: { ".": "./index.js", "./react": "./react.js" } });

const asEnum = (values) => `{ ${values.map((value, index) => `k${index}: ${JSON.stringify(value)}`).join(", ")} }`;

/** Each SDK hook and what it reads out of the runtime it was handed. */
const SDK_HOOK_READS = {
  usePluginRuntime: "r",
  useCurrentFile: "r.currentFile",
  useCurrentUser: "r.currentUser",
  usePluginActions: "r.actions",
  usePluginAPI: "r.api",
  usePluginSettings: "r.settings",
};

const OUTSIDE_RENDER = "must be used inside a plugin component rendered by DocSpace";

/**
 * The SDK's React entry, in the only two flavours the suites need: `live` answers from the
 * runtime `withPluginRuntime` was handed, which is what the render pass needs, and otherwise
 * every hook throws, which is what the other suites assert on. One source for both, so the
 * two cannot describe different SDKs.
 */
const sdkReactModule = ({ live }) =>
  [
    ...Object.entries(SDK_HOOK_READS).map(([name, read]) =>
      live
        ? `export const ${name} = () => { const r = globalThis.__pluginRuntime; if (!r) throw new Error("${name} ${OUTSIDE_RENDER}"); return ${read}; };`
        : `export const ${name} = () => { throw new Error("${name} ${OUTSIDE_RENDER}"); };`,
    ),
    live
      ? // What the client does: provide the runtime, then render the component under it.
        "export const withPluginRuntime = (C) => function WithRuntime(props) { globalThis.__pluginRuntime = props.runtime; return { type: C, props: {} }; };"
      : "export const withPluginRuntime = (c) => c;",
    'export const isPluginApiError = (e) => !!e && e.name === "PluginApiError";',
  ].join("\n");

/** One validator run, with the questions the suites ask of it. */
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

  #codes(level) {
    return this.findings.filter((finding) => finding.level === level).map((finding) => finding.code);
  }

  get errorCodes() {
    return this.#codes("ERROR");
  }

  get warningCodes() {
    return this.#codes("WARN");
  }

  #messagesWhere(predicate) {
    return this.findings.filter(predicate).map((finding) => finding.message).join("\n");
  }

  /** Every message of one code, one per line. */
  messagesFor(code) {
    return this.#messagesWhere((finding) => finding.code === code);
  }

  mentions(text) {
    return this.#messagesWhere(() => true).includes(text);
  }

  /** True when a *single* finding mentions all of these - a claim about one sentence. */
  hasFindingMentioning(...texts) {
    return this.findings.some((finding) => texts.every((text) => finding.message.includes(text)));
  }

  errorsMention(text) {
    return this.#messagesWhere((finding) => finding.level === "ERROR").includes(text);
  }

  warningsMention(text) {
    return this.#messagesWhere((finding) => finding.level === "WARN").includes(text);
  }

  /** Detail strings for a failing expectation. */
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
   * Writes a project: manifest, one source file, a hand-written bundle in dist/, a Vite
   * config with the right externals (unless the fixture supplies its own), placeholder assets,
   * and the host packages the bundle is imported against. Returns the project directory.
   */
  write(dirName, { pkg, bundle, src, assets = ["logo.svg"], viteConfig }) {
    const dir = path.join(this.root, dirName);

    for (const sub of ["src", "dist", "assets"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });

    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2));
    fs.writeFileSync(path.join(dir, "src", "index.ts"), src);
    fs.writeFileSync(path.join(dir, "dist", "plugin.js"), bundle);
    fs.writeFileSync(path.join(dir, "vite.config.ts"), viteConfig ?? VITE_CONFIG);

    this.#installHostPackages(dir);

    for (const asset of assets) fs.writeFileSync(path.join(dir, "assets", asset), PLACEHOLDER_SVG);

    return dir;
  }

  /**
   * Minimal stand-ins for react (with its JSX runtime), react-dom and the SDK's React entry:
   * the bundle only references components at load time, and the SDK entry's hooks throw
   * outside a component, which is the behaviour the suites assert on.
   */
  #installHostPackages(dir) {
    const write = (relative, contents) => {
      const file = path.join(dir, "node_modules", relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, contents);
    };

    const throwing = (name, reason) =>
      `export const ${name} = () => { throw new Error("${name} ${reason}"); };`;

    write(
      "react/package.json",
      JSON.stringify({ name: "react", version: "19.0.0", type: "module", exports: { ".": "./index.js", "./jsx-runtime": "./jsx-runtime.js", "./jsx-dev-runtime": "./jsx-runtime.js" } }),
    );
    write(
      "react/index.js",
      [
        "export const createElement = (type, props) => ({ type, props });",
        "export const createContext = (v) => ({ _currentValue: v });",
        ...["useState", "useEffect", "useMemo", "useCallback", "useRef", "useContext"].map((name) =>
          throwing(name, "was called outside a component render"),
        ),
        "export default { createElement, createContext, useState, useEffect, useMemo, useCallback, useRef, useContext };",
      ].join("\n"),
    );
    write("react/jsx-runtime.js", "export const Fragment = Symbol.for(\"react.fragment\");\nexport const jsx = (type, props, key) => ({ type, props, key });\nexport const jsxs = jsx;\nexport const jsxDEV = jsx;\n");

    write("react-dom/package.json", JSON.stringify({ name: "react-dom", version: "19.0.0", type: "module", main: "index.js" }));
    write("react-dom/index.js", "export const createPortal = (children) => children;\nexport default { createPortal };\n");

    write(`${SDK_DIR}/package.json`, sdkPackageJson("3.0.0"));
    write(`${SDK_DIR}/index.js`, "export const Actions = {};\n");
    write(`${SDK_DIR}/react.js`, sdkReactModule({ live: false }));
  }

  /** Adds another file under src/ - for the checks that read the sources file by file. */
  writeSourceFile(dir, relativePath, contents) {
    const file = path.join(dir, "src", relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }

  /** Deletes part of a written project - used to make an unbuilt one. */
  remove(dir, relativePath) {
    fs.rmSync(path.join(dir, relativePath), { recursive: true, force: true });
  }

  /** Replaces the SDK stub with one built from the contract tables, so agreement is quiet by construction. */
  installFakeSdk(dir, { version, extraAction, extraUserType } = {}) {
    const sdkDir = path.join(dir, "node_modules", SDK_DIR);

    fs.writeFileSync(path.join(sdkDir, "package.json"), sdkPackageJson(version));
    fs.writeFileSync(
      path.join(sdkDir, "index.js"),
      `export const UsersType = ${asEnum([...USERS_TYPES, ...(extraUserType ? [extraUserType] : [])])};
export const Devices = ${asEnum(DEVICES)};
export const Events = ${asEnum(EVENT_TYPES)};
export const Section = ${asEnum(SECTIONS)};
export const Actions = ${asEnum([...KNOWN_ACTIONS, ...(extraAction ? [extraAction] : [])])};
`,
    );
  }

  /**
   * Gives a fixture what the render pass needs: something that walks an element tree, and an
   * SDK entry whose hooks answer while a tree is being walked. React itself is never
   * installed in a fixture, so this is a renderer in the small - it calls each function
   * component and recurses, which is all the pass asks of it. Outside a walk the hooks still
   * throw, so every other suite keeps asserting on that.
   */
  installRenderer(dir) {
    const write = (relative, contents) => {
      const file = path.join(dir, "node_modules", relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, contents);
    };

    write(
      "react-dom/package.json",
      JSON.stringify({
        name: "react-dom",
        version: "19.0.0",
        type: "module",
        exports: { ".": "./index.js", "./server": "./server.js" },
      }),
    );

    write(
      "react-dom/server.js",
      `const walk = (node) => {
  if (node === null || node === undefined || node === false || node === true) return "";
  if (Array.isArray(node)) return node.map(walk).join("");
  if (typeof node !== "object") return String(node);
  if (typeof node.type === "function") return walk(node.type(node.props ?? {}));
  // memo/forwardRef: the component is one level in, as it is for react-dom itself.
  if (typeof node.type?.type === "function") return walk(node.type.type(node.props ?? {}));
  return walk(node.props?.children);
};

export const renderToStaticMarkup = (element) => {
  try {
    return walk(element);
  } finally {
    delete globalThis.__pluginRuntime;
  }
};

export default { renderToStaticMarkup };
`,
    );

    write(`${SDK_DIR}/react.js`, sdkReactModule({ live: true }));
  }

  /** Runs the validator with --json and parses the report. */
  validate(dir, ...flags) {
    const run = spawnSync(process.execPath, [validatorPath, dir, "--json", ...flags], { encoding: "utf8" });

    try {
      return new ValidatorReport(JSON.parse(run.stdout));
    } catch {
      throw new Error(`Validator produced no JSON for ${dir}:\n${run.stdout}\n${run.stderr}`);
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
  check = (label, ok, detail) => {
    this.#results.push({ label, ok });

    if (ok) console.log(`ok    ${label}`);
    else console.log(`FAIL  ${label}${detail ? ` - ${detail}` : ""}`);
  };

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
