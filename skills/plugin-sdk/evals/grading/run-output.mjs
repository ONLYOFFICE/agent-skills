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
 * What a run left behind: a plugin project, or prose about one. Finding either depends on how
 * the run was told to save its work, and the checks should not have to know that.
 */

import * as path from "node:path";

import { fileExists, filesMatching, readTextFile, subdirectoriesOf } from "./files.mjs";
import { withoutComments } from "./source.mjs";

/*
 * Seven of the SDK's ten scopes carry items; API, Settings and PostMessage do not. Which
 * side a plugin sits on decides whether the registration checks apply to it at all.
 */
const ITEM_SCOPES = [
  "ContextMenu",
  "MainButton",
  "ProfileMenu",
  "InfoPanel",
  "EventListener",
  "File",
  "ArticleButton",
];

const MAXIMUM_SEARCH_DEPTH = 4;

/**
 * The generated project inside a run directory, or null when there is none. Rather than guess
 * where a run saved its work, look for the thing itself: a package.json carrying
 * `pluginName` is a DocSpace plugin, and nothing else is.
 */
export const projectIn = (runDirectory) => {
  if (!fileExists(runDirectory)) return null;

  const visited = new Set();

  const search = (directory, depth) => {
    if (depth > MAXIMUM_SEARCH_DEPTH || visited.has(directory)) return null;
    visited.add(directory);

    if (/"pluginName"\s*:/.test(readTextFile(path.join(directory, "package.json"))))
      return directory;

    for (const name of subdirectoriesWorthSearching(directory)) {
      const found = search(path.join(directory, name), depth + 1);
      if (found) return found;
    }

    return null;
  };

  return search(runDirectory, 0);
};

// A dependency tree holds thousands of package.json files and none of them is the
// plugin; a build output holds a copy of the manifest and is not the source.
const IGNORED_WHEN_SEARCHING = ["node_modules", "dist"];

const subdirectoriesWorthSearching = (directory) =>
  subdirectoriesOf(directory).filter((name) => !IGNORED_WHEN_SEARCHING.includes(name));

export const manifestOf = (project) => readTextFile(path.join(project, "package.json"));

export const manifestField = (project, field) =>
  manifestOf(project).match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`))?.[1] ?? "";

export const declaredScopes = (project) => {
  const list = manifestOf(project).match(/"scopes"\s*:\s*\[([^\]]*)\]/)?.[1] ?? "";
  return [...list.matchAll(/"([^"]+)"/g)].map(([, scope]) => scope);
};

export const declaresAnItemScope = (project) =>
  declaredScopes(project).some((scope) => ITEM_SCOPES.includes(scope));

export const packagedArchiveOf = (project) => path.join(project, "dist", "plugin.zip");

export const wasPackaged = (project) => fileExists(packagedArchiveOf(project));

export const hasSourceFile = (project, name) => fileExists(path.join(project, "src", name));

/** The project's sources, one entry per file, comments stripped. */
export const sourceFilesOf = (project) =>
  filesMatching(path.join(project, "src"), /\.tsx?$/).map((file) =>
    withoutComments(readTextFile(file)),
  );

/** Every source concatenated - for checks that do not care which file they hit. */
export const sourceOf = (project) => sourceFilesOf(project).join("\n");

/**
 * The prose a run wrote, wherever it put it and whatever it named it, so read every markdown
 * and text file. A copy of the audited plugin may sit here too, and its own README is not a
 * finding - only prose written *about* the plugin counts.
 */
export const proseIn = (runDirectory) => {
  const project = projectIn(runDirectory);

  return filesMatching(runDirectory, /\.(md|txt)$/)
    .filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`))
    .filter((file) => !project || !file.startsWith(project + path.sep))
    .map(readTextFile)
    .join("\n");
};
