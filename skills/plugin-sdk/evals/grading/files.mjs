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
 * Reading files without first asking whether they are there. A grader walks directories it
 * did not create, where absence is ordinary, so every read answers with empty content
 * instead of throwing - which keeps the existence tests out of the checks.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export const readTextFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
};

export const fileExists = (filePath) => fs.existsSync(filePath);

/** Every file beneath `directory`, at any depth, whose name matches. */
export const filesMatching = (directory, namePattern) => {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return filesMatching(entryPath, namePattern);

    return namePattern.test(entry.name) ? [entryPath] : [];
  });
};

export const subdirectoriesOf = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
