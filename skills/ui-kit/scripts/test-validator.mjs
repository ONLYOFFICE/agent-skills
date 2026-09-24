#!/usr/bin/env node
/**
 * Self-test for check-usage.mjs. Throwaway projects are written into the OS temp directory,
 * the validator runs over each as a child process, and every case asserts both what it must
 * report and what it must not — a checker that fires on everything is as useless as one that
 * fires on nothing.
 *
 * It also checks the manifest the validator reads for internal sense, and runs the two sync
 * tools offline, so that a hand-edited synced page or an untraceable link fails here rather
 * than in a release.
 *
 *   node skills/ui-kit/scripts/test-validator.mjs
 *
 * Exit 1 on the first mismatch reported, after running every case.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const VALIDATOR = path.join(HERE, "check-usage.mjs");
const MANIFEST = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(path.join(HERE, "data", "kit-manifest.json"), "utf8")));

const workspace = mkdtempSync(path.join(os.tmpdir(), "ui-kit-check-"));
const failures = [];
let checks = 0;

function check(what, condition, detail) {
  checks += 1;
  if (!condition) failures.push(`${what}${detail ? ` — ${detail}` : ""}`);
}

function project(name, files) {
  const dir = path.join(workspace, name);
  for (const [file, contents] of Object.entries(files)) {
    const at = path.join(dir, file);
    mkdirSync(path.dirname(at), { recursive: true });
    writeFileSync(at, contents);
  }
  return dir;
}

function run(dir) {
  try {
    const stdout = execFileSync(process.execPath, [VALIDATOR, dir, "--json"], { encoding: "utf8" });
    return { code: 0, findings: JSON.parse(stdout).findings };
  } catch (error) {
    if (typeof error.status !== "number" || error.status > 1) {
      return { code: error.status ?? 2, findings: [], crash: `${error.stdout ?? ""}${error.stderr ?? ""}` };
    }
    return { code: error.status, findings: JSON.parse(error.stdout).findings };
  }
}

/** One project, the codes it must report and the codes it must not. */
function expect(name, files, { code, has = [], lacks = [] }) {
  const result = run(project(name, files));
  if (result.crash) {
    check(`${name}: the validator ran`, false, result.crash.trim().split("\n")[0]);
    return;
  }
  const reported = result.findings.map((f) => f.code);
  check(`${name}: exit ${code}`, result.code === code, `exit was ${result.code}, findings: ${reported.join(", ") || "none"}`);
  for (const wanted of has) check(`${name}: reports ${wanted}`, reported.includes(wanted), `reported ${reported.join(", ") || "nothing"}`);
  for (const unwanted of lacks) check(`${name}: does not report ${unwanted}`, !reported.includes(unwanted));
}

const PROVIDERS = `import type { ReactNode } from "react";
import { ThemeKeys } from "@onlyoffice/apps-ui-kit/enums";
import { ThemeProvider } from "@onlyoffice/apps-ui-kit/providers/theme";
import { TranslationProvider } from "@onlyoffice/apps-ui-kit/providers/translation";

const translations = new Map([["en", new Map()]]);

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialTheme={ThemeKeys.BaseStr} locale="en">
      <TranslationProvider locale="en" translations={translations}>{children}</TranslationProvider>
    </ThemeProvider>
  );
}
`;

// --- a project that does everything right ----------------------------------------------------

expect(
  "known-good",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Form.tsx": `import { useState } from "react";
import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";
import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";
import { InputSize, InputType, TextInput } from "@onlyoffice/apps-ui-kit/components/text-input";

export function Form() {
  const [name, setName] = useState("");
  return (
    <Aside visible onClose={() => {}}>
      <FieldContainer isVertical labelVisible labelText="Name" labelFor="name">
        <TextInput
          scale
          id="name"
          type={InputType.text}
          size={InputSize.base}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </FieldContainer>
    </Aside>
  );
}
`,
  },
  {
    code: 0,
    lacks: [
      "E-visibility-prop",
      "E-no-theme-provider",
      "E-no-translation-provider",
      "W-fieldcontainer-label",
      "W-label-unattached",
      "W-textinput-required",
      "W-tabindex-noise",
      "W-whole-library-css",
    ],
  },
);

// --- one project per error ------------------------------------------------------------------

expect(
  "wrong-visibility-prop",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Panel.tsx": `import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";

export function Panel({ open }: { open: boolean }) {
  return <Aside isVisible={open} onClose={() => {}} />;
}
`,
  },
  { code: 1, has: ["E-visibility-prop"] },
);

expect(
  "portal-internal-subpath",
  {
    "src/Pick.tsx": `import { PeopleSelector } from "@onlyoffice/apps-ui-kit/selectors/People";

export const pick = PeopleSelector;
`,
  },
  { code: 1, has: ["E-internal-subpath"] },
);

expect(
  "portal-internal-through-the-barrel",
  {
    "src/Upload.tsx": `import { Uploader } from "@onlyoffice/apps-ui-kit";

export const upload = Uploader;
`,
  },
  { code: 1, has: ["E-internal-subpath"] },
);

expect(
  "default-only-component-by-name",
  {
    "src/Layout.tsx": `import { Section } from "@onlyoffice/apps-ui-kit";

export const layout = Section;
`,
  },
  { code: 1, has: ["E-default-import"] },
);

expect(
  "dist-path-and-public-dir",
  {
    "src/Icon.tsx": `import { Button } from "@onlyoffice/apps-ui-kit/dist/esm/components/button";
import cross from "PUBLIC_DIR/images/cross.react.svg";

export const parts = { Button, cross };
`,
  },
  { code: 1, has: ["E-dist-import", "E-public-dir"] },
);

expect(
  "composite-providers",
  {
    "src/Root.tsx": `import { Providers } from "@onlyoffice/apps-ui-kit/providers/Providers";

export const root = Providers;
`,
  },
  { code: 1, has: ["E-composite-providers"] },
);

expect(
  "legacy-theme-provider",
  {
    "src/Root.tsx": `import { ThemeProviderComponent } from "@onlyoffice/apps-ui-kit/components/theme-provider";

export const root = ThemeProviderComponent;
`,
  },
  { code: 1, has: ["E-legacy-theme-provider"] },
);

expect(
  "unknown-subpath",
  {
    "src/Nope.tsx": `import { Whatever } from "@onlyoffice/apps-ui-kit/components/does-not-exist";

export const nope = Whatever;
`,
  },
  { code: 1, has: ["E-unknown-subpath"] },
);

expect(
  "no-providers",
  {
    "src/Screen.tsx": `import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";

export function Screen() {
  return <Aside visible onClose={() => {}} />;
}
`,
  },
  { code: 1, has: ["E-no-theme-provider"] },
);

expect(
  "search-input-event",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Search.tsx": `import { SearchInput } from "@onlyoffice/apps-ui-kit/components/search-input";

export function Search({ onQuery }: { onQuery: (value: string) => void }) {
  return <SearchInput value="" onChange={(event) => onQuery(event.target.value)} />;
}
`,
  },
  { code: 1, has: ["E-searchinput-event"] },
);

// --- the warnings ----------------------------------------------------------------------------

expect(
  "silent-traps",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Traps.tsx": `import "@onlyoffice/apps-ui-kit/styles.css";
import { Checkbox } from "@onlyoffice/apps-ui-kit/components/checkbox";
import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";
import { Loader } from "@onlyoffice/apps-ui-kit/components/loader";
import { TextInput } from "@onlyoffice/apps-ui-kit/components/text-input";

export function Traps() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FieldContainer labelText="Name">
        <TextInput />
      </FieldContainer>
      <Checkbox label="Yes" isChecked={false} onChange={() => {}} />
      <Loader />
    </div>
  );
}
`,
  },
  {
    code: 0,
    has: [
      "W-whole-library-css",
      "W-fieldcontainer-label",
      "W-fieldcontainer-gap",
      "W-textinput-required",
      "W-loader-type",
    ],
  },
);

/**
 * The two halves of naming a field. `labelFor` on the container and a matching `id` on the
 * control is what associates the caption with the field; `Textarea` cannot be reached that way
 * at all, because its props type is closed, so it carries its own name.
 *
 * Both checks replaced `W-tabindex`, which warned when a control was given no `tabIndex`. The
 * kit's controls defaulted to -1 then and default to 0 now, so that warning turned into advice
 * to write something between useless and harmful.
 */
expect(
  "a caption attached to nothing",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Unnamed.tsx": `import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";
import { Textarea } from "@onlyoffice/apps-ui-kit/components/textarea";
import { InputType, TextInput } from "@onlyoffice/apps-ui-kit/components/text-input";

export function Unnamed() {
  return (
    <>
      <FieldContainer labelVisible labelText="Name">
        <TextInput type={InputType.text} value="" onChange={() => {}} />
      </FieldContainer>
      <Textarea wrapperClassName="full" value="" onChange={() => {}} />
    </>
  );
}
`,
    "src/Unnamed.css": `.full {
  width: 100%;
}
`,
  },
  { code: 0, has: ["W-label-unattached", "W-textarea-unnamed"] },
);

expect(
  "a tabIndex that is only noise",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Noise.tsx": `import { Checkbox } from "@onlyoffice/apps-ui-kit/components/checkbox";

export function Noise() {
  return <Checkbox tabIndex={0} label="Yes" isChecked={false} onChange={() => {}} />;
}
`,
  },
  { code: 0, has: ["W-tabindex-noise"] },
);

expect(
  "plugin-shaped",
  {
    "src/Plugin.tsx": `import { Button } from "@docspace/ui-kit";

export const button = Button;
`,
  },
  { code: 0, has: ["W-docspace-ui-kit"] },
);

// A file that explains itself was being reported for the thing it explains: the raw-control
// check read `<button>` out of a JSDoc line. Found by an eval run, not by this suite.
expect(
  "controls-named-in-comments",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Commented.tsx": `import { Button, ButtonSize } from "@onlyoffice/apps-ui-kit/components/button";

/**
 * Uses the kit's Button rather than a bare <button>: the kit's one carries the theme,
 * and <input> would be the same story in a form.
 */
export function Commented() {
  // a plain <select> here would not be themed either
  return <Button primary size={ButtonSize.normal} label="Save" onClick={() => {}} />;
}
`,
  },
  { code: 0, lacks: ["W-raw-controls"] },
);

expect(
  "raw-control-in-code",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Raw.tsx": `import { Text } from "@onlyoffice/apps-ui-kit/components/text";

export function Raw() {
  return (
    <form>
      <Text>Name</Text>
      <input name="name" />
    </form>
  );
}
`,
  },
  { code: 0, has: ["W-raw-controls"] },
);

// A handler with a `>` in it used to truncate the attribute scan and hide every later prop.
expect(
  "arrow-in-attributes",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Arrow.tsx": `import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";
import { InputType, TextInput } from "@onlyoffice/apps-ui-kit/components/text-input";

export function Arrow({ set }: { set: (value: string) => void }) {
  return (
    <FieldContainer labelVisible labelText="Name" labelFor="name">
      <TextInput id="name" type={InputType.text} value="" onChange={(event) => set(event.target.value)} />
    </FieldContainer>
  );
}
`,
  },
  {
    code: 0,
    lacks: [
      "W-fieldcontainer-label",
      "W-label-unattached",
      "W-textinput-required",
      "W-tabindex-noise",
    ],
  },
);

/**
 * A size given in a stylesheet is a size. Both of these checks used to read only what was
 * written inline, so a correct wrapper with its height in `app.css` was reported as missing
 * one — found by an eval grader, which is the expensive way to find it.
 */
expect(
  "size-declared-in-a-stylesheet",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Sized.css": `.toggle-row {
  display: flex;
  height: 20px;
}
.description-field {
  width: 100%;
  flex: 1 1 auto;
}
`,
    "src/Sized.tsx": `import { Textarea } from "@onlyoffice/apps-ui-kit/components/textarea";
import { ToggleButton } from "@onlyoffice/apps-ui-kit/components/toggle-button";

import "./Sized.css";

export function Sized({ on, set }: { on: boolean; set: (value: string) => void }) {
  return (
    <div>
      <Textarea wrapperClassName="description-field" value="" onChange={(event) => set(event.target.value)} />
      <div className="toggle-row">
        <ToggleButton isChecked={on} onChange={() => {}} label="Notify me" />
      </div>
    </div>
  );
}
`,
  },
  { code: 0, lacks: ["W-toggle-wrapper", "W-textarea-width"] },
);

// The same two, unsized, still report — a fix must not be bought by going blind.
expect(
  "size-declared-nowhere",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Unsized.tsx": `import { Textarea } from "@onlyoffice/apps-ui-kit/components/textarea";
import { ToggleButton } from "@onlyoffice/apps-ui-kit/components/toggle-button";

export function Unsized({ on, set }: { on: boolean; set: (value: string) => void }) {
  return (
    <div>
      <Textarea style={{ width: "100%" }} value="" onChange={(event) => set(event.target.value)} />
      <div>
        <ToggleButton isChecked={on} onChange={() => {}} label="Notify me" />
      </div>
    </div>
  );
}
`,
  },
  { code: 0, has: ["W-toggle-wrapper", "W-textarea-width"] },
);

// --- the manifest the validator reads --------------------------------------------------------

const allowedVisibility = new Set(["visible", "isOpen", "opened", "open", null]);
for (const [folder, component] of Object.entries(MANIFEST.components)) {
  check(
    `manifest: ${folder} has a known visibility prop`,
    allowedVisibility.has(component.visibilityProp),
    `${component.visibilityProp}`,
  );
  check(`manifest: ${folder} names a page`, typeof component.page === "string" && component.page.length > 0);
  check(
    `manifest: ${folder}'s page exists`,
    (await import("node:fs")).existsSync(path.join(REPO, "skills", "ui-kit", component.page.replace(/^references\//, "references/"))),
    component.page,
  );
}
check("manifest: every component is accounted for", Object.keys(MANIFEST.components).length >= 98, `${Object.keys(MANIFEST.components).length}`);
check("manifest: the portal-internal modules were parsed", MANIFEST.portalInternalSubpaths.includes("selectors"));
check("manifest: the barrel leak is recorded", MANIFEST.portalInternalBarrelNames.includes("Uploader"));

// --- the sync tools, offline ------------------------------------------------------------------

for (const [what, argv] of [
  // Offline, so no --strict: the metadata count is known only when a kit tree is
  // open, which is the release check (`--from <kit> --check --strict`).
  ["no synced page was hand-edited", ["tools/sync-ui-kit.mjs", "--check"]],
  ["every link and version traces to sources.json", ["tools/sync-sources.mjs", "--skill", "ui-kit", "--check"]],
]) {
  try {
    execFileSync(process.execPath, argv.map((a) => (a.startsWith("tools/") ? path.join(REPO, a) : a)), { cwd: REPO, encoding: "utf8" });
    check(what, true);
  } catch (error) {
    check(what, false, `${error.stdout ?? ""}`.trim().split("\n").slice(-3).join(" / "));
  }
}

rmSync(workspace, { recursive: true, force: true });

for (const failure of failures) console.log(`FAIL  ${failure}`);
console.log(`${checks} expectation(s), ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
