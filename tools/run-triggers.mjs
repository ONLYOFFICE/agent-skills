#!/usr/bin/env node
/**
 * Trigger test for a skill's description: sends every message of
 * skills/<skill>/evals/trigger-tests.md to a fresh `claude -p` session with this repository
 * loaded as a plugin and records whether the Skill tool was called for that skill.
 * Windows-friendly (no select on pipes).
 *
 *   node tools/run-triggers.mjs --skill <name> [--model sonnet] [--runs 3] [--workers 4] [--out results.json]
 *
 * A message counts as triggering when it does so in at least half of its runs. The run
 * directory is a throwaway sandbox under the system temp directory, never this repository.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const SKILL = flag("--skill", null);
const TESTS = SKILL && path.join(REPO, "skills", SKILL, "evals", "trigger-tests.md");
if (!TESTS || !existsSync(TESTS)) {
  console.error("usage: node tools/run-triggers.mjs --skill <name> [--model sonnet] [--runs 3] [--workers 4] [--out results.json]");
  console.error(SKILL ? `no ${path.relative(REPO, TESTS)}` : "--skill is required");
  process.exit(2);
}
const MODEL = flag("--model", "sonnet");
const RUNS = Number(flag("--runs", 3));
const WORKERS = Number(flag("--workers", 4));
const TIMEOUT_MS = Number(flag("--timeout", 120)) * 1000;
const OUT = flag("--out", null);
const CWD = mkdtempSync(path.join(os.tmpdir(), `${SKILL}-triggers-`));

function messages() {
  const text = readFileSync(TESTS, "utf8");
  const section = (heading) => {
    const body = text.split(`## ${heading}`)[1].split("\n## ")[0];
    return [...body.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1].replace(/\s*\*\([^)]*\)\*\s*$/, "").trim());
  };
  return [
    ...section("Should trigger").map((query) => ({ query, should_trigger: true })),
    ...section("Should not trigger").map((query) => ({ query, should_trigger: false })),
  ];
}

function runOnce(query) {
  return new Promise((resolve) => {
    const cli = ["claude", "-p", query, "--output-format", "stream-json", "--verbose", "--model", MODEL, "--plugin-dir", REPO, "--max-turns", "2", "--allowedTools", "Skill,Read,Glob,Grep"];
    const env = { ...process.env };
    delete env.CLAUDECODE;
    const child = process.platform === "win32"
      ? spawn("cmd.exe", ["/c", ...cli], { cwd: CWD, env, windowsHide: true })
      : spawn(cli[0], cli.slice(1), { cwd: CWD, env });
    let triggered = false;
    const skills = [];
    let buffer = "";
    let done = false;
    const finish = (reason) => {
      if (done) return;
      done = true;
      try { child.kill(); } catch {}
      resolve({ triggered, skills, reason });
    };
    const timer = setTimeout(() => finish("timeout"), TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let i;
      while ((i = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!line) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        for (const block of event.message?.content ?? []) {
          if (block.type !== "tool_use" || block.name !== "Skill") continue;
          const name = String(block.input?.skill ?? "");
          skills.push(name);
          if (name.includes(SKILL)) triggered = true;
        }
        if (triggered) { clearTimeout(timer); finish("detected"); }
      }
    });
    child.on("close", () => { clearTimeout(timer); finish("exit"); });
    child.on("error", () => { clearTimeout(timer); finish("spawn-error"); });
  });
}

const queries = messages();
const results = queries.map((q) => ({ ...q, runs: [] }));
const jobs = [];
queries.forEach((_, qi) => { for (let r = 0; r < RUNS; r++) jobs.push({ qi, r }); });
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { qi, r } = jobs[next++];
    const res = await runOnce(queries[qi].query);
    results[qi].runs[r] = res;
    console.error(`[${qi + 1}/${queries.length} run ${r + 1}] ${res.triggered ? "TRIGGERED" : "no"} (${res.reason}) ${JSON.stringify([...new Set(res.skills)])} :: ${queries[qi].query.slice(0, 70)}`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

let should = 0, shouldNot = 0;
for (const r of results) {
  r.rate = r.runs.filter((x) => x.triggered).length / RUNS;
  r.pass = r.should_trigger ? r.rate >= 0.5 : r.rate < 0.5;
  if (r.should_trigger && r.pass) should++;
  if (!r.should_trigger && r.pass) shouldNot++;
}
const shouldTotal = results.filter((r) => r.should_trigger).length;
const shouldNotTotal = results.length - shouldTotal;
console.log(`model ${MODEL}, ${RUNS} runs per message: should ${should}/${shouldTotal}, should not ${shouldNot}/${shouldNotTotal}`);
for (const r of results.filter((x) => !x.pass)) console.log(`  MISS ${r.should_trigger ? "should" : "should-not"} rate=${r.rate} :: ${r.query}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ model: MODEL, runs: RUNS, should, shouldTotal, shouldNot, shouldNotTotal, results }, null, 2));
process.exit(should === shouldTotal && shouldNot === shouldNotTotal ? 0 : 1);
