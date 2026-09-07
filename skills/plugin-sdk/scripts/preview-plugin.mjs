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
 * Renders a built plugin in a real browser and measures what came out.
 *
 *   node scripts/preview-plugin.mjs <pluginDir> [--keep] [--json] [--themes light,dark] [--port N]
 *
 * validate-plugin.mjs judges the contract with the loader, and its render pass renders each
 * surface to a *string*: nothing has a size, no stylesheet has run, no effect has fired. So
 * the defects it cannot see are exactly the ones a user notices first - a field collapsed to
 * a sliver, a label printed over the next row, a page that drags a scrollbar across the
 * portal, a rule that restyles DocSpace itself, a panel that is blank only after its effect
 * throws. This pass mounts the plugin's own bundle against the real UI kit and the real theme
 * variables in Chromium, at the width each surface actually gets, in both themes, and reports
 * what it measured. Exit code 1 when there is at least one ERROR.
 *
 * It is not the portal: the kit's stylesheets are here, the DocSpace client's own are not.
 * So it can prove a rule of yours escapes into portal-shaped markup, and it cannot prove the
 * reverse - that a portal rule beats one of yours. One upload still settles that.
 */

import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";

import { Findings } from "./validator/findings.mjs";
import { FatalProjectError, PluginProject } from "./validator/plugin-project.mjs";
import { harnessEntry, harnessHtml, harnessViteConfig } from "./preview/harness-files.mjs";
import { measureSource } from "./preview/browser-checks.mjs";

const HARNESS_DIR = ".plugin-preview";
const DEFAULT_PORT = 5599;

const parseArgs = (argv) => {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const valueOf = (name, fallback) => {
    const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };

  return {
    dir: path.resolve(argv.find((arg) => !arg.startsWith("--")) ?? "."),
    json: flags.has("--json"),
    keep: flags.has("--keep"),
    port: Number(valueOf("port", DEFAULT_PORT)),
    themes: valueOf("themes", "light,dark").split(",").filter(Boolean),
  };
};

/*
 * Playwright is not a dependency of a plugin project and does not need to be: it is a tool
 * for whoever is building the plugin, not part of what ships. So it is looked for wherever
 * it might reasonably be and the pass is skipped - loudly, with the command to fix it - when
 * it is nowhere, which is the same bargain the validator strikes over node_modules.
 */
const loadPlaywright = async (project) => {
  const bases = [
    path.join(project.dir, "package.json"),
    path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "package.json"),
  ];

  // Resolved from CommonJS, `chromium` arrives on the namespace's default; from the ESM
  // entry it is a named export. Take whichever shape came back.
  const unwrap = (module) => (module?.chromium ? module : module?.default?.chromium ? module.default : null);

  for (const base of bases) {
    try {
      const resolved = createRequire(base).resolve("playwright");
      const loaded = unwrap(await import(`file://${resolved.replace(/\\/g, "/")}`));
      if (loaded) return loaded;
    } catch {
      /* try the next base */
    }
  }

  try {
    return unwrap(await import("playwright"));
  } catch {
    return null;
  }
};

const writeHarness = (project) => {
  const dir = path.join(project.dir, HARNESS_DIR);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "shots"), { recursive: true });

  fs.writeFileSync(path.join(dir, "index.html"), harnessHtml());
  fs.writeFileSync(path.join(dir, "harness.jsx"), harnessEntry());
  fs.writeFileSync(path.join(dir, "vite.config.mjs"), harnessViteConfig(project.dir));

  return dir;
};

/** The plugin's own stylesheet, so the page is styled as the portal styles it. */
const readPluginCss = (project) => {
  const css = path.join(project.dir, "dist", "plugin.css");
  return fs.existsSync(css) ? fs.readFileSync(css, "utf8") : "";
};

const startServer = async (project, harnessDir, port) => {
  const vite = await project.importFromProject("vite");
  if (!vite?.createServer) return null;

  const server = await vite.createServer({
    configFile: path.join(harnessDir, "vite.config.mjs"),
    server: { port, strictPort: true },
  });

  await server.listen();
  return server;
};

/* ------------------------------------------------------------------ findings */

const reportBoot = (findings, boot) => {
  if (!boot) return;
  findings.error(
    "preview-load",
    `onLoadCallback() threw in the browser: ${boot}. On the portal this aborts installation - no items, no CSS, nothing in the UI`,
  );
};

const reportLeaks = (findings, leaks) => {
  for (const { selector, hits } of leaks)
    findings.error(
      "preview-leak",
      `the stylesheet's rule "${selector}" matches ${hits} element(s) of portal-shaped markup planted beside the plugin - on the portal that rule restyles DocSpace itself, in every section, for every user, until the plugin is disabled. Scope it: a .module.css, or the manifest name as a prefix on the leftmost selector`,
    );
};

const reportSurface = (findings, surface, theme) => {
  const at = `${surface.where} (${theme})`;

  if (surface.blank) {
    findings.error(
      "preview-blank",
      `${at} painted nothing at all. Effects have run by this point, so this is a surface that renders empty for real - on the portal it is a blank tab, page or dialog with one console line`,
    );
    return;
  }

  for (const { what, width, height, label } of surface.collapsed)
    findings.error(
      "preview-collapsed",
      `${at}: ${what}${label ? ` ("${label}")` : ""} came out ${width}×${height}px - too small to use or read. A kit control with a max-width and no width collapses as a flex item while staying focusable, so the surface looks empty and still accepts typing: give it width: 100%; min-width: 0; flex: 1 1 auto`,
    );

  /* Reported before the pairwise overlaps: this is the same defect seen from the cause
   * rather than the symptom, and the sentence is more useful. */
  for (const { what, text } of surface.noHeight.slice(0, 3))
    findings.error(
      "preview-overlap",
      `${at}: ${what} holds "${text}" and is 0px tall, so whatever follows it is drawn in the same place - a control whose label is absolutely positioned adds nothing to its wrapper. Give the wrapper an explicit height and position: relative`,
    );

  for (const { a, b, text, byX, byY } of surface.overlaps.slice(0, 4))
    findings.error(
      "preview-overlap",
      `${at}: ${a} and ${b} are drawn on top of each other, overlapping ${byX}×${byY}px ("${text}") - a control whose label is absolutely positioned contributes no height, so it prints over whatever follows it. Give its wrapper an explicit height and position: relative`,
    );

  /* One finding per surface, for the widest offender. A container that overflows makes every
   * child in it overflow too, and listing them all buries the one line worth acting on. */
  const widestSpill = [...surface.spills].sort((a, b) => b.width - a.width).slice(0, 1);

  for (const { what, width, surface: surfaceWidth } of widestSpill)
    findings.error(
      "preview-overflow",
      `${at}: ${what} is ${width}px wide inside a ${surfaceWidth}px surface - on the portal the section body's only guard is max-width: 100vw, measured against the viewport rather than the space beside the sidebar, so this drags a horizontal scrollbar across the whole page. Cap the root and put the wide part in its own overflow-x: auto box`,
    );

  if (surface.overflow)
    findings.warn(
      "preview-overflow",
      `${at} scrolls horizontally inside itself (content ${surface.scrollWidth}px, box ${surface.clientWidth}px) - deliberate inside an overflow-x: auto box, a defect anywhere else`,
    );

  for (const { what } of surface.unlabelled.slice(0, 4))
    findings.warn(
      "preview-unlabelled",
      `${at}: ${what} has no visible label, no aria-label and no placeholder - FieldContainer draws its label block only under labelVisible, which defaults to false, so labelText alone renders nothing`,
    );

  for (const { what, color, text } of surface.invisibleText.slice(0, 4))
    findings.error(
      "preview-invisible",
      `${at}: ${what} paints "${text}" in ${color} on the same colour behind it - invisible. A literal colour that works in one theme does this in the other; the portal's variables flip with the theme`,
    );
};

/*
 * The kit talks to the console about things only the portal can supply - a translation
 * namespace, a store, a socket. Those lines are this harness's gap, not the plugin's defect,
 * and reporting them buries the ones that are: a plugin whose effect throws is the whole
 * point of watching the console at all.
 */
const HARNESS_NOISE = [/\[i18n\]/, /TranslationProvider/, /Missing translation/, /favicon/i];

const reportConsole = (findings, messages) => {
  const real = messages.filter((message) => !HARNESS_NOISE.some((pattern) => pattern.test(message)));

  for (const message of real.slice(0, 6))
    findings.error(
      "preview-console",
      `the browser logged an error while the surfaces mounted: ${message}. The portal's boundary swallows this and leaves the surface blank`,
    );
};

/* ------------------------------------------------------------------- the run */

const runBrowser = async ({ playwright, port, themes, harnessDir, css, findings }) => {
  let browser;
  try {
    browser = await playwright.chromium.launch();
  } catch (error) {
    // The package is installed but its browser build is not - a setup step, not a defect.
    return { skipped: `chromium is not installed for this playwright - run npx playwright install chromium (${error?.message?.split("\n")[0] ?? error})` };
  }

  const report = { themes: {}, surfaces: [], shots: [] };

  try {
    for (const theme of themes) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const messages = [];

      page.on("console", (message) => message.type() === "error" && messages.push(message.text()));
      page.on("pageerror", (error) => messages.push(String(error?.message ?? error)));

      await page.goto(`http://localhost:${port}/?theme=${theme}`, { waitUntil: "load" });

      // The harness sets this after onLoadCallback and the click traversal have finished.
      await page.waitForFunction("window.__previewReady === true", null, { timeout: 20000 }).catch(() => {});
      // Effects, then a frame for layout to settle before anything is measured.
      await page.waitForTimeout(600);

      // Added here rather than imported by the harness so the plugin's own rules stay
      // identifiable: everything else in the document belongs to the kit.
      if (css) await page.addStyleTag({ content: css });
      await page.waitForTimeout(150);

      const observations = await page.evaluate(`${measureSource()}(${JSON.stringify(css)})`);

      if (theme === themes[0]) {
        reportBoot(findings, observations.boot);
        reportLeaks(findings, observations.leaks);
        report.surfaces = observations.surfaces.map((surface) => surface.where);
      }

      for (const surface of observations.surfaces) reportSurface(findings, surface, theme);
      reportConsole(findings, messages);
      report.themes[theme] = observations.surfaces;

      const shot = path.join(harnessDir, "shots", `${theme}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      report.shots.push(shot);

      await page.close();
    }
  } finally {
    await browser.close();
  }

  return report;
};

/* ---------------------------------------------------------------- reporting */

const printTextReport = ({ project, findings, report, skipped }) => {
  console.log(`${project.manifest.name} (${project.pluginName}) ${project.manifest.version}`);
  console.log(`${project.dir}\n`);

  for (const finding of findings.all) console.log(`${finding.level.padEnd(5)} [${finding.code}] ${finding.message}`);

  if (skipped) {
    console.log(`\npreview skipped: ${skipped}`);
    return;
  }

  const surfaces = report.surfaces.length ? report.surfaces.join(", ") : "none";
  console.log(`\nsurfaces: ${surfaces}`);
  console.log(`themes:   ${Object.keys(report.themes).join(", ")}`);
  for (const shot of report.shots) console.log(`shot:     ${shot}`);
  console.log(`\n${findings.errors.length} error(s), ${findings.warnings.length} warning(s)`);
};

const main = async () => {
  const { dir, json, keep, port, themes } = parseArgs(process.argv.slice(2));

  const project = await PluginProject.load(dir);
  const findings = new Findings();

  /* Each of these is a reason the pass cannot run rather than a defect in the plugin, so
   * each says what to do instead of failing the run. */
  let skipped = null;
  if (!project.isBuilt) skipped = "no dist/plugin.js - run the build first (npm run build)";
  else if (project.distChunks.length)
    skipped = `dist/ holds ${project.distChunks.length} chunk file(s) beside plugin.js - the archive cannot carry them, and this pass would resolve them and show the plugin working; set build.rollupOptions.output.inlineDynamicImports: true and build again (validate-plugin.mjs has the detail)`;
  else if (!project.hasNodeModules) skipped = "no node_modules - run npm install first";

  const playwright = skipped ? null : await loadPlaywright(project);
  if (!skipped && !playwright)
    skipped =
      "playwright is not installed - npm i -D playwright && npx playwright install chromium, in the plugin project or beside this skill";

  let server = null;
  let harnessDir = null;
  let report = { themes: {}, surfaces: [], shots: [] };

  try {
    if (!skipped) {
      harnessDir = writeHarness(project);
      server = await startServer(project, harnessDir, port);

      if (!server) skipped = "vite could not be loaded from the project - it is a devDependency of a generated plugin";
      else {
        report = await runBrowser({
          playwright,
          port,
          themes,
          harnessDir,
          css: readPluginCss(project),
          findings,
        });

        if (report.skipped) skipped = report.skipped;
      }
    }
  } finally {
    if (server) await server.close();
    if (harnessDir && !keep && !findings.hasErrors) fs.rmSync(harnessDir, { recursive: true, force: true });
  }

  if (skipped) findings.warn("preview", skipped);

  if (json)
    console.log(
      JSON.stringify(
        { plugin: { dir: project.dir, name: project.manifest.name }, skipped, report, findings: findings.all, ok: !findings.hasErrors },
        null,
        2,
      ),
    );
  else printTextReport({ project, findings, report, skipped });

  process.exit(findings.hasErrors ? 1 : 0);
};

try {
  await main();
} catch (error) {
  if (!(error instanceof FatalProjectError)) throw error;

  console.error(error.message);
  process.exit(1);
}
