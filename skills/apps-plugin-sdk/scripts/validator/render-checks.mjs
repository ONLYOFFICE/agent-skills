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
 * Renders every component the portal would render, once, off-screen.
 *
 * The rest of the validator judges the contract - what the loader reads and calls. It never
 * renders, and the loudest silent failure in a plugin is a component that throws on its
 * first render: the portal's boundary swallows it, logs one line, and the page, tab or
 * dialog is simply blank. The commonest cause is the truth table of what the runtime holds
 * where - `useCurrentFile()` is null on a page, in settings and in a modal opened from a
 * class-side click - so each surface is rendered with the runtime the portal would give it.
 *
 * A server render, so no DOM and no effects: this catches what throws while rendering, not
 * what throws in an effect. The renderer and the SDK's own runtime provider come from the
 * *project*, so the React and the context are the ones the bundle was built against; when
 * either is missing the pass is skipped rather than faked.
 */

import { SDK_REACT_ENTRY } from "../contract.mjs";
import { Check } from "./findings.mjs";
import { isMissingHostApi } from "./sandbox.mjs";
import { isReactComponent } from "./shapes.mjs";

/** The selection the portal hands a surface that has one. */
const CURRENT_FILE = {
  id: 1,
  title: "example.docx",
  fileExst: ".docx",
  isFolder: false,
  isRoom: false,
};

const CURRENT_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  displayName: "Validator",
  email: "validator@localhost",
  isOwner: false,
  isAdmin: true,
  isRoomAdmin: false,
};

/** Anything the component calls while rendering is a defect of its own; say which. */
const duringRender = (what) => () => {
  throw new Error(`${what} was called while the component was rendering`);
};

/**
 * Every member of a client answers, whatever the SDK adds next - a Proxy rather than a list
 * of the 23 actions, which would be one more table to keep in step with the SDK.
 */
const clientProxy = (label) =>
  new Proxy(
    {},
    {
      get: (_target, property) =>
        typeof property === "symbol" ? undefined : duringRender(`${label}.${String(property)}()`),
    },
  );

/**
 * The runtime a component reads through the hooks. Handlers are recorded rather than run -
 * a component that fires an action or a request during render, instead of from an effect or
 * an event, is reported as that.
 */
const pluginRuntime = (currentFile) => ({
  currentFile,
  currentUser: CURRENT_USER,
  actions: clientProxy("actions"),
  api: clientProxy("api"),
  settings: {
    // A synchronous read of what the portal already holds - the SDK's own examples make it in
    // a lazy useState initialiser, which runs during the first render. Nothing saved yet here.
    load: () => null,
    save: duringRender("settings.save()"),
    // The other call a settings component may legitimately make from render.
    setSaveButton: () => {},
  },
});

export class RenderChecks extends Check {
  constructor(context) {
    super(context);

    /** How many surfaces rendered out of how many were tried - so a skipped pass, and a pass
     * where everything threw, are both visible in the summary. */
    this.report = { rendered: 0, attempted: 0, skipped: null };
  }

  /**
   * @param surfaces {{ where: string, component: unknown, hasCurrentFile: boolean }[]}
   *   every component the loader would render, with the selection its surface receives.
   */
  async run(surfaces) {
    if (!surfaces.length) return;

    const renderer = await this.#loadRenderer();
    if (!renderer) return;

    const { renderToStaticMarkup, createElement, withPluginRuntime } = renderer;

    for (const { where, component, hasCurrentFile } of surfaces) {
      // A memo/forwardRef object renders too; anything else shapes.mjs has already reported.
      if (!isReactComponent(component)) continue;

      const runtime = pluginRuntime(hasCurrentFile ? CURRENT_FILE : null);
      this.report.attempted += 1;

      try {
        renderToStaticMarkup(createElement(withPluginRuntime(component), { runtime }));
        this.report.rendered += 1;
      } catch (e) {
        this.#reportRenderFailure(where, hasCurrentFile, e);
      }
    }
  }

  /** @returns the pieces needed to render, or null when the project cannot provide them. */
  async #loadRenderer() {
    const server = await this.project.importFromProject("react-dom/server");
    const react = await this.project.importFromProject("react");
    const sdkReact = await this.project.importFromProject(SDK_REACT_ENTRY);

    const renderToStaticMarkup = server?.renderToStaticMarkup ?? server?.default?.renderToStaticMarkup;
    const createElement = react?.createElement ?? react?.default?.createElement;
    const withPluginRuntime = sdkReact?.withPluginRuntime ?? sdkReact?.default?.withPluginRuntime;

    if (renderToStaticMarkup && createElement && withPluginRuntime)
      return { renderToStaticMarkup, createElement, withPluginRuntime };

    this.report.skipped = "react-dom/server or the SDK's React entry could not be loaded from the project";
    return null;
  }

  /**
   * A throw here is what the portal turns into an empty surface, so it is an error - except
   * a browser API the sandbox does not provide, which is this tool's gap, not the plugin's.
   */
  #reportRenderFailure(where, hasCurrentFile, e) {
    const message = e?.message ?? String(e);

    if (isMissingHostApi(e)) {
      this.warn(
        "render",
        `${where} could not be rendered here: ${message}. The validator's sandbox is not a browser - check by hand that this is available at render time`,
      );
      return;
    }

    const selection = hasCurrentFile
      ? "the portal's own selection"
      : "useCurrentFile() null, which is what this surface gets";

    const hint = /Cannot read propert|Cannot destructure|of null|of undefined/.test(message)
      ? " - the value a hook returned was used without a guard; render a placeholder for the empty case instead"
      : " - catch it and render text, or the surface is blank with one console line";

    this.error(
      "render",
      `${where} threw while rendering with ${selection}: ${message}${hint}. On the portal this renders as nothing at all`,
    );
  }
}
