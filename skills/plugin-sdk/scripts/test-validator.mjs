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
 * Self-test for validate-plugin.mjs: throwaway projects in the OS temp dir, validated
 * with --json, asserting which finding codes appear. It never invokes npm, so it says
 * nothing about whether a project builds. See validator-tests/README.md.
 *
 *   node scripts/test-validator.mjs      exit code 1 when any expectation fails
 */

import { Expectations, FixtureWorkspace } from "./validator-tests/harness.mjs";

import * as itemsSuite from "./validator-tests/suites/items.mjs";
import * as manifestSuite from "./validator-tests/suites/manifest.mjs";
import * as runtimeSuite from "./validator-tests/suites/runtime.mjs";
import * as sdkDriftSuite from "./validator-tests/suites/sdk-drift.mjs";
import * as uiSuite from "./validator-tests/suites/ui.mjs";

// Listed rather than discovered: the order is the one a reader wants, and a suite that is
// not imported is visibly not run.
const SUITES = [manifestSuite, itemsSuite, uiSuite, runtimeSuite, sdkDriftSuite];

const workspace = new FixtureWorkspace();
const expectations = new Expectations();

try {
  for (const suite of SUITES) {
    expectations.section(suite.title);

    suite.default({
      workspace,
      check: (label, ok, detail) => expectations.check(label, ok, detail),
    });
  }
} finally {
  workspace.cleanup();
}

expectations.printSummary();

process.exit(expectations.failed.length > 0 ? 1 : 0);
