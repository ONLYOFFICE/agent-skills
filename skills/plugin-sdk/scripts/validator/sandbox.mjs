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
 * Runs a bundle the way the portal does: the host-provided specifiers are rewritten to the
 * copies the *project* installed - the same react and SDK entry the bundle was built against -
 * and imported for real, so module-scope code, the default export and the SDK's own "hook
 * outside a component" errors are genuine. The ui-kit is the exception: its module-scope code
 * needs a real DOM and its components are never rendered here, so it is always the stand-in
 * in ./stubs. fetch throws rather than reaching the network; a global we failed to stub is
 * *our* gap - isMissingHostApi() softens it.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { HOST_PROVIDED_SPECIFIERS, UI_KIT_PACKAGE } from "../contract.mjs";

/** Long enough for a slow onLoadCallback, short enough that a hang is reported. */
export const CALLBACK_TIMEOUT_MS = 10_000;

const noop = () => {};

/**
 * Every reach for the network, counted. There is none here, so a callback that fetches takes its
 * failure path from there on - the runtime pass reads this to say what it therefore could not see.
 */
export const network = { attempts: 0 };

const domElement = () => ({
  style: {},
  dataset: {},
  setAttribute: noop,
  appendChild: noop,
  addEventListener: noop,
  remove: noop,
});

/** The fake browser the bundle runs in - only what Node does not already define. */
const browserGlobals = () => ({
  fetch: async () => {
    network.attempts += 1;
    throw new Error("network access is not available in the validator sandbox");
  },
  location: { href: "https://localhost/", origin: "https://localhost", pathname: "/" },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  document: {
    createElement: domElement,
    createElementNS: domElement,
    head: domElement(),
    body: domElement(),
    getElementById: () => null,
    querySelector: () => null,
    addEventListener: noop,
    cookie: "",
  },
  addEventListener: noop,
});

const UI_KIT_STUB_URL = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "stubs", "ui-kit.mjs"),
).href;

/** What the browser resolves by itself; everything else is a package name. */
const isResolvable = (specifier) =>
  specifier.startsWith(".") || specifier.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(specifier);

// A whole import/export statement anchored at a statement boundary - the shape the portal's
// own rewriter matches; a bare `from "x"` fragment also matched prose in strings and comments.
const STATIC_IMPORT_RE =
  /(^|[;{}\n\r])(\s*)(import|export)\b([^;'"]*?\bfrom\s*|\s*)(["'])([^"']+)\5/g;

const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g;

/** Every bare specifier the bundle imports - the list the portal judges. */
export const bareImportsOf = (code) => {
  const specifiers = new Set();

  for (const match of code.matchAll(STATIC_IMPORT_RE))
    if (!isResolvable(match[6])) specifiers.add(match[6]);

  for (const match of code.matchAll(DYNAMIC_IMPORT_RE))
    if (!isResolvable(match[2])) specifiers.add(match[2]);

  return [...specifiers];
};

export const isHostProvided = (specifier) => HOST_PROVIDED_SPECIFIERS.includes(specifier);

/**
 * Where each host-provided specifier is sent: the copy installed in the project, except the
 * ui-kit, which is always the stub. A missing one is reported rather than faked.
 */
export const resolveHostModules = (project) => {
  const require = createRequire(project.packageJsonPath);
  const urls = { [UI_KIT_PACKAGE]: UI_KIT_STUB_URL };
  const missing = [];

  for (const specifier of HOST_PROVIDED_SPECIFIERS) {
    if (specifier === UI_KIT_PACKAGE) continue;

    try {
      urls[specifier] = pathToFileURL(require.resolve(specifier)).href;
    } catch {
      missing.push(specifier);
    }
  }

  return { urls, missing };
};

/**
 * Named imports from the kit stub become `import * as ns from stub; const { Button } =
 * ns.default` - the stub is a Proxy and cannot declare named exports.
 */
const rewriteKitClause = (keyword, clause, url, index) => {
  const named = clause.match(/^\s*(?:(\w+)\s*,\s*)?\{([^}]*)\}\s*from\s*$/);
  if (!named || keyword !== "import") return null;

  const [, defaultName, list] = named;
  const ns = `__uiKit${index}`;
  const bindings = list
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [imported, local = imported] = entry.split(/\s+as\s+/).map((part) => part.trim());
      return `${local} = ${ns}.default[${JSON.stringify(imported)}]`;
    });

  const defaultBinding = defaultName ? `const ${defaultName} = ${ns}.default;` : "";

  return `import * as ${ns} from "${url}"; ${defaultBinding} const ${bindings.join(", ")};`;
};

const rewriteImports = (code, { urls }) => {
  let kitImports = 0;

  const rewritten = code.replace(
    STATIC_IMPORT_RE,
    (match, before, space, keyword, clause, _quote, specifier) => {
      const url = urls[specifier];
      if (!url) return match;

      if (specifier === UI_KIT_PACKAGE) {
        const kit = rewriteKitClause(keyword, clause, url, kitImports++);
        if (kit) return `${before}${space}${kit}`;
      }

      return `${before}${space}${keyword}${clause}"${url}"`;
    },
  );

  return rewritten.replace(DYNAMIC_IMPORT_RE, (match, _quote, specifier) =>
    urls[specifier] ? `import("${urls[specifier]}")` : match,
  );
};

/** Installs the fake browser on the real global object without clobbering what Node defines. */
const installBrowserGlobals = () => {
  for (const [name, value] of Object.entries(browserGlobals()))
    if (!(name in globalThis) || name === "fetch") globalThis[name] = value;

  for (const alias of ["window", "self", "top", "parent"])
    if (!(alias in globalThis)) globalThis[alias] = globalThis;
};

/** Imports the bundle as the portal would and returns its default export; throws what it throws. */
export const importModuleBundle = async (source, hostModules) => {
  installBrowserGlobals();

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-validator-module-"));
  const file = path.join(dir, "plugin.mjs");

  try {
    fs.writeFileSync(file, rewriteImports(source, hostModules));
    const module = await import(pathToFileURL(file).href);
    return module.default;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

export const withTimeout = (promise, ms, label) =>
  Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} did not settle in ${ms} ms`)), ms).unref?.(),
    ),
  ]);

/** A global the sandbox does not stub is our gap; anything else would throw on the portal too. */
export const isMissingHostApi = (e) =>
  e?.name === "ReferenceError" && /is not defined/.test(e?.message ?? "");
