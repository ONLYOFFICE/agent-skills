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
 * The fake browser the bundle runs in: stubs enough to execute top-level code and
 * onLoadCallback, with fetch throwing rather than reaching the network. A global we
 * failed to stub is *our* gap - isMissingHostApi() softens that one case to a warning.
 */

import * as vm from "node:vm";

/** Long enough for a slow onLoadCallback, short enough that a hang is reported. */
export const CALLBACK_TIMEOUT_MS = 10_000;

const noop = () => {};

const domElement = () => ({
  style: {},
  dataset: {},
  setAttribute: noop,
  appendChild: noop,
  addEventListener: noop,
  remove: noop,
});

/** A context with `window`, `document` and `Plugins`, ready for vm.runInContext. */
export const createSandbox = () => {
  const sandbox = {
    console: { log: noop, warn: noop, error: noop, info: noop, debug: noop },
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: noop,
    queueMicrotask,
    Promise,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    fetch: async () => {
      throw new Error("network access is not available in the validator sandbox");
    },
    navigator: { userAgent: "docspace-plugin-validator", language: "en-US" },
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
    // The portal creates this; the plugin registers itself into it.
    Plugins: {},
  };

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;

  vm.createContext(sandbox);

  return sandbox;
};

/** Runs the bundle's top-level code in the sandbox. Throws what the bundle throws. */
export const runBundle = (sandbox, source) =>
  new vm.Script(source, { filename: "plugin.js" }).runInContext(sandbox, {
    timeout: CALLBACK_TIMEOUT_MS,
  });

export const withTimeout = (promise, ms, label) =>
  Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} did not settle in ${ms} ms`)), ms).unref?.(),
    ),
  ]);

/**
 * A global the sandbox does not stub is our gap, not the plugin's. Anything else that
 * throws would throw on the portal too, so it must not be softened into a warning.
 */
export const isMissingHostApi = (e) =>
  e?.name === "ReferenceError" && /is not defined/.test(e?.message ?? "");
