#!/usr/bin/env node
/**
 * Self-test for validate-config.mjs: runs the validator as a child process over known-good
 * and known-bad TFrameConfig objects and asserts the exit code and the messages that
 * matter. No portal, no network. Exit code 1 when any expectation fails.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const VALIDATOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "validate-config.mjs");
const BASE = { frameId: "ds-frame", mode: "manager", src: "https://portal.example.com" };

// Objects go inline as argv (what an agent does); raw strings go through stdin, because
// the validator treats any argv that does not start with "{" as a file path.
function run(config) {
  const inline = typeof config !== "string";
  const r = spawnSync(process.execPath, inline ? [VALIDATOR, JSON.stringify(config)] : [VALIDATOR], {
    encoding: "utf8",
    input: inline ? undefined : config,
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const CASES = [
  // --- should pass ------------------------------------------------------------
  { name: "minimal manager config passes", config: BASE, code: 0 },
  { name: "manager with a valid filter passes", config: { ...BASE, filter: { sortBy: "AZ", sortOrder: "ascending", count: 100 } }, code: 0 },
  { name: "editor with id passes", config: { ...BASE, mode: "editor", id: "123", editorType: "embedded" }, code: 0 },
  { name: "public-room with id and requestToken passes", config: { ...BASE, mode: "public-room", id: 7, requestToken: "tok" }, code: 0 },
  { name: "room-selector passes", config: { ...BASE, mode: "room-selector", selectorType: "roomsOnly" }, code: 0 },
  { name: "chat mode needs nothing extra", config: { ...BASE, mode: "chat" }, code: 0 },
  { name: "uploader without id passes with a warning", config: { ...BASE, mode: "uploader" }, code: 0, has: ["WARN:", "id"] },
  { name: "missing frameId is only a warning", config: { mode: "manager", src: BASE.src }, code: 0, has: ["WARN:", "frameId", "ds-frame"] },
  { name: "unknown key is a warning, not an error", config: { ...BASE, colour: "red" }, code: 0, has: ["WARN:", "colour"] },
  { name: "unknown event is a warning", config: { ...BASE, events: { onWhatever: null } }, code: 0, has: ["WARN:", "onWhatever"] },
  { name: "accessToken plus getToken warns", config: { ...BASE, accessToken: "a", getToken: "b" }, code: 0, has: ["getToken wins"] },
  { name: "requestToken outside public-room warns", config: { ...BASE, requestToken: "tok" }, code: 0, has: ["WARN:", "requestToken"] },
  { name: "manager over a shared room takes requestToken without a warning", config: { ...BASE, rootPath: "/rooms/share", requestToken: "tok" }, code: 0, lacks: ["WARN:"] },
  { name: "a viewer takes requestToken without a warning - the SDK sends it as share=", config: { ...BASE, mode: "viewer", id: 5, requestToken: "tok" }, code: 0, lacks: ["WARN:"] },
  { name: "a room selector with requestToken warns", config: { ...BASE, mode: "room-selector", requestToken: "tok" }, code: 0, has: ["WARN:", "requestToken"] },

  // --- should fail ------------------------------------------------------------
  { name: "sortBy Name is rejected with the AZ hint", config: { ...BASE, filter: { sortBy: "Name" } }, code: 1, has: ["ERROR:", "sortBy", 'did you mean "AZ"'] },
  { name: "sortBy at the top level is an error pointing at filter.sortBy", config: { ...BASE, sortBy: "AZ" }, code: 1, has: ["ERROR:", "filter.sortBy"] },
  { name: "unknown mode is rejected", config: { ...BASE, mode: "nope" }, code: 1, has: ["ERROR: mode"] },
  { name: "missing src is rejected", config: { frameId: "f", mode: "manager" }, code: 1, has: ["ERROR: src"] },
  { name: "editor without id is rejected", config: { ...BASE, mode: "editor" }, code: 1, has: ["ERROR:", "id"] },
  { name: "viewer without id is rejected", config: { ...BASE, mode: "viewer" }, code: 1, has: ["ERROR:", "id"] },
  { name: "public-room without requestToken is rejected", config: { ...BASE, mode: "public-room", id: 7 }, code: 1, has: ["ERROR:", "requestToken"] },
  { name: "public-room without id is rejected", config: { ...BASE, mode: "public-room", requestToken: "tok" }, code: 1, has: ["ERROR:", "id"] },
  { name: "manager over a shared room without requestToken is rejected", config: { ...BASE, rootPath: "/rooms/share" }, code: 1, has: ["ERROR:", "requestToken"] },
  { name: "bad theme enum is rejected", config: { ...BASE, theme: "dark" }, code: 1, has: ["ERROR:", "theme"] },
  { name: "bad viewAs enum is rejected", config: { ...BASE, viewAs: "list" }, code: 1, has: ["ERROR:", "viewAs"] },
  { name: "bad sortOrder is rejected", config: { ...BASE, filter: { sortOrder: "asc" } }, code: 1, has: ["ERROR:", "sortOrder"] },
  { name: "string in a boolean field is rejected", config: { ...BASE, showMenu: "false" }, code: 1, has: ["ERROR:", "showMenu"] },
  { name: "events must be an object", config: { ...BASE, events: "onAppReady" }, code: 1, has: ["ERROR: events"] },
  { name: "malformed JSON is rejected", config: "{not json", code: 1, has: ["cannot parse"] },
  { name: "an array is not a config", config: "[]", code: 1, has: ["must be a JSON object"] },
];

let failed = 0;
for (const c of CASES) {
  const { code, out } = run(c.config);
  const problems = [];
  if (code !== c.code) problems.push(`exit ${code}, expected ${c.code}`);
  for (const needle of c.has ?? []) if (!out.includes(needle)) problems.push(`output lacks "${needle}"`);
  for (const needle of c.lacks ?? []) if (out.includes(needle)) problems.push(`output contains "${needle}"`);
  if (problems.length) {
    failed++;
    console.log(`FAIL  ${c.name}\n      ${problems.join("; ")}\n      ${out.trim().split("\n").join("\n      ")}`);
  } else {
    console.log(`ok    ${c.name}`);
  }
}

// The dictionaries are compared with the SDK the skill pins: `--from <dir>` names a checkout at the
// matching tag or an installed package; without it, an installed @onlyoffice/docspace-sdk-js found up
// the directory chain is used. A sibling checkout is not consulted on its own: its types describe
// whatever branch it is on, not the release the skill targets.
const fromArg = process.argv.indexOf("--from");
const installedSdk = (() => {
  for (let dir = path.dirname(VALIDATOR); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", "@onlyoffice", "docspace-sdk-js");
    if (existsSync(path.join(candidate, "package.json"))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
})();
const SDK_SOURCE = fromArg !== -1 ? process.argv[fromArg + 1] : installedSdk;
if (SDK_SOURCE) {
  const sync = spawnSync(process.execPath, [path.join(path.dirname(VALIDATOR), "sync-sdk.mjs"), "--from", SDK_SOURCE, "--check"], { encoding: "utf8" });
  if (sync.status !== 0) {
    failed++;
    console.log(`FAIL  validator dictionaries match the SDK at ${SDK_SOURCE}\n      ${`${sync.stdout}${sync.stderr}`.trim().split("\n").join("\n      ")}`);
  } else {
    console.log(`ok    validator dictionaries match the SDK at ${SDK_SOURCE}`);
  }
} else {
  console.log("skip  validator dictionaries vs the SDK (pass --from <checkout at the pinned tag | node_modules/@onlyoffice/docspace-sdk-js>)");
}

const SOURCES = path.resolve(path.dirname(VALIDATOR), "..", "..", "..", "tools", "sync-sources.mjs");
const sources = spawnSync(process.execPath, [SOURCES, "--skill", "embed-sdk", "--check"], { encoding: "utf8" });
if (sources.status !== 0) {
  failed++;
  console.log(`FAIL  links and pinned versions trace to sources.json\n      ${`${sources.stdout}${sources.stderr}`.trim().split("\n").join("\n      ")}`);
} else {
  console.log("ok    links and pinned versions trace to sources.json");
}

console.log(`\n${CASES.length + 1 - failed}/${CASES.length + 1} expectations passed`);
process.exit(failed ? 1 : 0);
