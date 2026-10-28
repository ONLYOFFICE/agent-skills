#!/usr/bin/env node
/**
 * Self-test for check-usage.mjs. Throwaway projects are written into the OS temp directory,
 * the validator runs over each as a child process, and every case asserts both what it must
 * report and what it must not — a checker that fires on everything is as useless as one that
 * fires on nothing.
 *
 * It also checks the manifest the validator reads for internal sense, runs the link check
 * offline, and compares the manifest with the kit when a project with the kit installed is
 * named, so that a stale manifest or an untraceable link fails here rather than in a release.
 *
 * The two templates are read too: through check-usage always, and through `tsc` when a project
 * with the kit installed is named, since their types come from the kit.
 *
 *   node skills/apps-ui-kit/scripts/test-validator.mjs
 *   node skills/apps-ui-kit/scripts/test-validator.mjs --kit-project <dir with the kit installed>
 *
 * Exit 1 on the first mismatch reported, after running every case.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// billing re-exports a file of `export const` with `export * from "./constants"`; the sync
// tool used to look for a folder there and read `export { … }` only, so none of those names
// reached the manifest and this import passed.
expect(
  "portal-internal-constant-through-the-barrel",
  {
    "src/Plan.tsx": `import { YEAR_KEY } from "@onlyoffice/apps-ui-kit";

export const period = YEAR_KEY;
`,
  },
  { code: 1, has: ["E-internal-subpath"] },
);

/**
 * This case used to assert the opposite, and so held the validator to a falsehood. The root
 * barrel re-exports every default-only component by name -- `export { default as Section }` in
 * `components/index.ts` -- so the import below resolves; the error fired on correct code. The
 * kit's README validator had been rebuilding the barrel's names by hand and required every one of
 * those READMEs to say otherwise, and this check inherited that through the manifest.
 */
expect(
  "a default-only component through the root barrel, by name",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Upload.tsx": `import { Dropzone } from "@onlyoffice/apps-ui-kit";

export const upload = Dropzone;
`,
  },
  { code: 1, has: ["E-root-barrel"], lacks: ["E-default-import"] },
);

/**
 * What stays an error: a named import of that component from its own subpath. The folder's index
 * exports only a default, so the binding resolves to nothing however the barrel is arranged.
 */
expect(
  "a default-only component by name from its own subpath",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Upload.tsx": `import { Dropzone } from "@onlyoffice/apps-ui-kit/components/dropzone";

export const upload = Dropzone;
`,
  },
  { code: 1, has: ["E-default-import"] },
);

/**
 * Rule 5 names eleven components, and the manifest carries each one's `status`, but nothing read
 * it: both imports below passed in silence. Each way of reaching a component is covered — its own
 * subpath under a name the importer chose, and the root barrel by name.
 */
expect(
  "a portal-internal component, by subpath and through the barrel",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Layout.tsx": `import Shell from "@onlyoffice/apps-ui-kit/components/section";
import { Article } from "@onlyoffice/apps-ui-kit";

export const layout = [Shell, Article];
`,
  },
  { code: 1, has: ["E-internal-component"] },
);
check(
  "a portal-internal component: both imports are reported",
  run(path.join(workspace, "a portal-internal component, by subpath and through the barrel")).findings.filter(
    (f) => f.code === "E-internal-component",
  ).length === 2,
);

/**
 * The comment stripper used to run two regexes, block comments first. A line comment ending in
 * `assets/*` then opened a "block" that ran to the JSDoc below it, and the portal-internal import
 * between the two was blanked out with it.
 */
expect(
  "a line comment that ends in a star does not swallow the import below it",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Pick.tsx": `// the icons live under assets/*
import { PeopleSelector } from "@onlyoffice/apps-ui-kit/selectors/People";

/** Picks people. */
export const pick = PeopleSelector;
`,
  },
  { code: 1, has: ["E-internal-subpath"] },
);

expect(
  "a comment marker inside a string is not a comment",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Pick.tsx": `const separator = " // ";
import { PeopleSelector } from "@onlyoffice/apps-ui-kit/selectors/People";

export const pick = [separator, PeopleSelector];
`,
  },
  { code: 1, has: ["E-internal-subpath"] },
);

/**
 * Every check below used to be keyed on how the file spelled the tag, so an alias switched off
 * the form checks at once and a namespace import yielded no binding at all.
 */
expect(
  "an aliased component is checked under its kit name",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Form.tsx": `import { FieldContainer as FC } from "@onlyoffice/apps-ui-kit/components/field-container";
import { InputType, TextInput } from "@onlyoffice/apps-ui-kit/components/text-input";

export const Form = () => (
  <FC labelText="Name">
    <TextInput type={InputType.text} value="" onChange={() => {}} />
  </FC>
);
`,
  },
  { code: 0, has: ["W-fieldcontainer-label"] },
);

expect(
  "a component under a namespace import is checked",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Form.tsx": `import * as Field from "@onlyoffice/apps-ui-kit/components/field-container";

export const Form = () => <Field.FieldContainer labelText="Name">x</Field.FieldContainer>;
`,
  },
  { code: 0, has: ["W-fieldcontainer-label"] },
);

expect(
  "a re-export is checked like an import",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/kit.ts": `export { PeopleSelector } from "@onlyoffice/apps-ui-kit/selectors/People";
`,
  },
  { code: 1, has: ["E-internal-subpath"] },
);

/**
 * Attributes used to be searched as raw text, so a word in a string value and a prop of a nested
 * element were both read as this tag's attributes — each an error, on correct code.
 */
expect(
  "a visibility word inside a string value is not a prop",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Confirm.tsx": `import { ModalDialog } from "@onlyoffice/apps-ui-kit/components/modal-dialog";

export const Confirm = () => <ModalDialog visible title="click to open it" onClose={() => {}} />;
`,
  },
  { code: 0, lacks: ["E-visibility-prop"] },
);

expect(
  "a nested element's prop is not the outer tag's",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Panel.tsx": `import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";
import { Tooltip } from "@onlyoffice/apps-ui-kit/components/tooltip";

export const Panel = () => <Aside visible header={<Tooltip isOpen />} onClose={() => {}} />;
`,
  },
  { code: 0, lacks: ["E-visibility-prop"] },
);

// --- every way in, every way out -------------------------------------------------------------
//
// README promises that breaking one branch of the validator fails this suite. These cases hold
// the branches nothing else reached: the two call forms of a specifier, the version check, the
// text report and the usage exits.

for (const [label, statement] of [
  ["require()", `const selectors = require("@onlyoffice/apps-ui-kit/selectors");`],
  ["import()", `const selectors = await import("@onlyoffice/apps-ui-kit/selectors");`],
]) {
  expect(
    `a portal-internal module reached through ${label}`,
    { "src/Load.ts": `${statement}\nexport default selectors;\n` },
    { code: 1, has: ["E-internal-subpath"] },
  );
}

for (const [version, reported] of [
  ["0.0.1", true],
  [MANIFEST.kitVersion, false],
]) {
  expect(
    `the installed kit is ${version}`,
    {
      "src/AppProviders.tsx": PROVIDERS,
      "node_modules/@onlyoffice/apps-ui-kit/package.json": JSON.stringify({ name: "@onlyoffice/apps-ui-kit", version }),
    },
    reported ? { code: 0, has: ["W-version-skew"] } : { code: 0, lacks: ["W-version-skew"] },
  );
}

// Every control on each list, one tag apiece, so trimming a list fails a named case.
for (const [name, folder, attributes] of [
  ["TextInput", "text-input", `type="text" value=""`],
  ["Textarea", "textarea", `aria-label="Notes" value=""`],
  ["Checkbox", "checkbox", `label="Yes"`],
  ["ComboBox", "combobox", `options={[]} selectedOption={{ key: 0, label: "" }}`],
]) {
  expect(
    `${name} tabIndex={0} is noise`,
    {
      "src/AppProviders.tsx": PROVIDERS,
      "src/Field.tsx": `import { ${name} } from "@onlyoffice/apps-ui-kit/components/${folder}";\n\nexport const Field = () => <${name} ${attributes} tabIndex={0} />;\n`,
    },
    { code: 0, has: ["W-tabindex-noise"] },
  );
}
for (const [name, folder] of [
  ["InputBlock", "input-block"],
  ["SearchInput", "search-input"],
  ["PasswordInput", "password-input"],
]) {
  expect(
    `${name} without tabIndex is unreachable`,
    {
      "src/AppProviders.tsx": PROVIDERS,
      "src/Field.tsx": `import { ${name} } from "@onlyoffice/apps-ui-kit/components/${folder}";\n\nexport const Field = () => <${name} value="" />;\n`,
    },
    { code: 0, has: ["W-tabindex-missing"] },
  );
}

/** The text report, which is what a person reads: an error is labelled as one, and exits 1. */
{
  const dir = project("the text report", {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Panel.tsx": `import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";
import { Loader } from "@onlyoffice/apps-ui-kit/components/loader";

export const Panel = ({ open }: { open: boolean }) => <Aside isVisible={open}><Loader /></Aside>;
`,
  });
  let code = 0;
  let stdout = "";
  try {
    stdout = execFileSync(process.execPath, [VALIDATOR, dir], { encoding: "utf8" });
  } catch (error) {
    code = error.status;
    stdout = `${error.stdout ?? ""}`;
  }
  check("the text report: exit 1 on an error", code === 1, `exit was ${code}`);
  check("the text report: the error is labelled ERROR", /^ERROR\b.*\n.*E-visibility-prop/m.test(stdout), stdout.split("\n")[0]);
  check("the text report: the warning is labelled WARNING", /^WARNING\b.*\n.*W-loader-type/m.test(stdout), stdout.split("\n")[0]);
}

/** A project that cannot be read, or a command line that cannot be, is exit 2, never a clean pass. */
for (const [label, argv] of [
  ["no project argument", []],
  ["a project that does not exist", [path.join(workspace, "no-such-project")]],
  ["an unknown option", [path.join(workspace, "known-good"), "--jsno"]],
  ["two project directories", [path.join(workspace, "known-good"), path.join(workspace, "known-good")]],
]) {
  let code = 0;
  try {
    execFileSync(process.execPath, [VALIDATOR, ...argv], { stdio: "ignore" });
  } catch (error) {
    code = error.status;
  }
  check(`${label}: exit 2`, code === 2, `exit was ${code}`);
}

// `labelVisible={false}` is the default written out: the label is hidden, not shown.
expect(
  "labelVisible written as false",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Field.tsx": `import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";

export const Field = () => <FieldContainer labelVisible={false} labelText="Name" />;
`,
  },
  { code: 0, has: ["W-fieldcontainer-label"], lacks: ["W-label-unattached"] },
);

// Output directories are skipped at the root only; deeper, a folder named build is source.
expect(
  "a source folder named build",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/pages/build/Panel.tsx": `import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";

export const Panel = ({ open }: { open: boolean }) => <Aside isVisible={open} />;
`,
    "build/Ignored.tsx": `import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";

export const Ignored = () => <Aside isOpen />;
`,
  },
  { code: 1, has: ["E-visibility-prop"] },
);
{
  const result = run(path.join(workspace, "a source folder named build"));
  check("build/ at the root is still skipped", !result.findings.some((f) => f.file.startsWith("build/")), result.findings.map((f) => f.file).join(", "));
}

// Top-level modules nest: utils/<name> and context/<name> resolve through ./* with no install.
expect(
  "a nested top-level module, with nothing installed",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Color.ts": `import { getTextColor } from "@onlyoffice/apps-ui-kit/utils/get-text-color";\nexport default getTextColor;\n`,
  },
  { code: 0, lacks: ["E-unknown-subpath"] },
);

// One name in a root-barrel import that has its own error must not hide the others beside it.
expect(
  "ThemeProviderComponent beside a portal-internal name in one import",
  {
    "src/Mixed.ts": `import { ThemeProviderComponent, Uploader } from "@onlyoffice/apps-ui-kit";\nexport default [ThemeProviderComponent, Uploader];\n`,
  },
  { code: 1, has: ["E-legacy-theme-provider", "E-internal-subpath", "E-root-barrel"] },
);

// `Providers` named from a kit subpath is that error alone, not a cascade of subpath errors too.
expect(
  "Providers from a kit subpath",
  { "src/Root.ts": `import { Providers } from "@onlyoffice/apps-ui-kit/providers";\nexport default Providers;\n` },
  { code: 1, has: ["E-composite-providers"], lacks: ["E-unknown-subpath"] },
);

// A path under a component's folder is not a subpath because the folder is.
expect(
  "a made-up path under a real component",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Deep.ts": `import { Button } from "@onlyoffice/apps-ui-kit/components/button/no-such-thing";\nexport default Button;\n`,
  },
  { code: 1, has: ["E-unknown-subpath"] },
);

/** The header promises exit 2 when the manifest cannot be read; a parse failure threw, exit 1. */
{
  const dir = project("an unreadable manifest", { "src/App.tsx": "export const App = 1;\n" });
  const broken = path.join(dir, "broken-manifest.json");
  writeFileSync(broken, "{");
  let code = 0;
  try {
    execFileSync(process.execPath, [VALIDATOR, dir, "--manifest", broken], { stdio: "ignore" });
  } catch (error) {
    code = error.status;
  }
  check("an unreadable manifest: exit 2", code === 2, `exit was ${code}`);
}

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

/**
 * The other half of the same check, and the reason it exists: a Textarea's `id` lands on the
 * `<textarea>` element, so a container's `labelFor` names it like any other control. Warning
 * about a textarea that is already captioned was a false positive found by an eval run --
 * against a project that had done the naming correctly.
 */
expect(
  "a Textarea named by a container's labelFor",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Named.tsx": `import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";
import { Textarea } from "@onlyoffice/apps-ui-kit/components/textarea";

const DESCRIPTION_ID = "room-description";

export function Named() {
  return (
    <FieldContainer labelVisible labelText="Description" labelFor={DESCRIPTION_ID}>
      <Textarea id={DESCRIPTION_ID} wrapperClassName="full" value="" onChange={() => {}} />
    </FieldContainer>
  );
}
`,
    "src/Named.css": `.full {
  width: 100%;
}
`,
  },
  { code: 0, lacks: ["W-textarea-unnamed", "W-label-unattached"] },
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

// A Textarea fills its field with nothing added; only a width put in `style` is the trap.
expect(
  "textarea-in-a-field-with-no-width",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Notes.tsx": `import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";
import { Textarea } from "@onlyoffice/apps-ui-kit/components/textarea";

export const Notes = () => (
  <FieldContainer labelVisible labelText="Notes" labelFor="notes" isVertical>
    <Textarea id="notes" value="" onChange={() => {}} />
  </FieldContainer>
);
`,
  },
  { code: 0, lacks: ["W-textarea-width"] },
);

// A gap is the trap only on a column holding fields that still carry their margin.
expect(
  "a gapped column of fields that all pass removeMargin",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Form.tsx": `import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";

export const Form = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <FieldContainer removeMargin labelVisible labelText="A" />
    <FieldContainer removeMargin labelVisible labelText="B" />
  </div>
);
`,
  },
  { code: 0, lacks: ["W-fieldcontainer-gap"] },
);
expect(
  "a gapped list beside the fields, not around them",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Form.tsx": `import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";

export const Form = () => (
  <div>
    <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <li>One</li>
    </ul>
    <FieldContainer labelVisible labelText="A" />
  </div>
);
`,
  },
  { code: 0, lacks: ["W-fieldcontainer-gap"] },
);

// A rule's own declarations survive a nested block -- \`&:hover\`, \`@media\`.
expect(
  "size-declared-beside-a-nested-block",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Sized.scss": `.toggle-row {
  height: 20px;
  &:hover { opacity: 0.8; }
}
.description-field {
  @media (max-width: 600px) { padding: 0; }
  width: 100%;
}
`,
    "src/Sized.tsx": `import { Textarea } from "@onlyoffice/apps-ui-kit/components/textarea";
import { ToggleButton } from "@onlyoffice/apps-ui-kit/components/toggle-button";

import "./Sized.scss";

export function Sized({ on }: { on: boolean }) {
  return (
    <div>
      <Textarea wrapperClassName="description-field" style={{ width: "100%" }} value="" onChange={() => {}} />
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

// --- text that only looks like code ----------------------------------------------------------

// A help string that quotes a portal-internal import, and a `<button>` inside another, used to be
// an import and a raw control: exit 1 on a file that imports nothing portal-internal at all.
expect(
  "code-inside-a-string",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Help.tsx": `import { Button, ButtonSize } from "@onlyoffice/apps-ui-kit/components/button";

const HINT = "do not write import x from '@onlyoffice/apps-ui-kit/billing' in an app";
const MARKUP = \`<button class="x">\${HINT}</button>\`;

export const Help = () => <Button label={HINT + MARKUP} size={ButtonSize.normal} />;
`,
  },
  { code: 0, lacks: ["E-internal-subpath", "W-raw-controls"] },
);

// The other half: an apostrophe in JSX text is not a string, or it would hide the rest of its
// line from every check.
expect(
  "apostrophe-in-jsx-text",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Panel.tsx": `import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";

export const Panel = ({ open }: { open: boolean }) => (
  <div><p>It's the members' panel</p><Aside isVisible={open} onClose={() => {}} /></div>
);
`,
  },
  { code: 1, has: ["E-visibility-prop"] },
);

// --- the toggle's wrapper is its parent element ------------------------------------------------

const toggleIn = (wrapper, before = "") => `import { useState } from "react";
import { ToggleButton } from "@onlyoffice/apps-ui-kit/components/toggle-button";
${before}
export function Row() {
  const [on, setOn] = useState<boolean>(false);
  return (
    <section>
      ${wrapper.replace("@", `<ToggleButton isChecked={on} onChange={(event) => setOn(event.target.checked)} />`)}
    </section>
  );
}
`;

// A `height` anywhere in the 300 characters above used to count as the wrapper's.
expect(
  "toggle-unrelated-height-above",
  { "src/AppProviders.tsx": PROVIDERS, "src/Row.tsx": toggleIn("<div>@</div>", "const header = { height: 40 };") },
  { code: 0, has: ["W-toggle-wrapper"] },
);
expect(
  "toggle-tailwind-height",
  { "src/AppProviders.tsx": PROVIDERS, "src/Row.tsx": toggleIn(`<div className="flex h-5 items-center">@</div>`) },
  { code: 0, lacks: ["W-toggle-wrapper"] },
);
expect(
  "toggle-inline-height",
  { "src/AppProviders.tsx": PROVIDERS, "src/Row.tsx": toggleIn("<div style={{ minHeight: 20 }}>@</div>") },
  { code: 0, lacks: ["W-toggle-wrapper"] },
);
expect(
  "toggle-height-in-a-named-style",
  { "src/AppProviders.tsx": PROVIDERS, "src/Row.tsx": toggleIn("<div style={row}>@</div>", "const row = { height: 20 };") },
  { code: 0, lacks: ["W-toggle-wrapper"] },
);
// Only the direct parent counts: a sized grandparent does not size the toggle's own row.
expect(
  "toggle-sized-grandparent",
  { "src/AppProviders.tsx": PROVIDERS, "src/Row.tsx": toggleIn(`<div className="h-10"><span>@</span></div>`) },
  { code: 0, has: ["W-toggle-wrapper"] },
);

// --- the two inputs built on InputBlock still need tabIndex ------------------------------------

const searchBox = (attributes) => `import { useState } from "react";
import { SearchInput } from "@onlyoffice/apps-ui-kit/components/search-input";
import { InputSize } from "@onlyoffice/apps-ui-kit/components/text-input";

export function Search() {
  const [query, setQuery] = useState("");
  return <SearchInput size={InputSize.base} value={query} onChange={setQuery} ${attributes} />;
}
`;
expect(
  "searchinput-without-tabindex",
  { "src/AppProviders.tsx": PROVIDERS, "src/Search.tsx": searchBox(`placeholder="Search"`) },
  { code: 0, has: ["W-tabindex-missing"] },
);
expect(
  "searchinput-with-tabindex",
  { "src/AppProviders.tsx": PROVIDERS, "src/Search.tsx": searchBox(`placeholder="Search" tabIndex={0}`) },
  { code: 0, lacks: ["W-tabindex-missing", "W-tabindex-noise"] },
);

// InputBlock is public and in the barrel, and itself defaults tabIndex to -1.
expect(
  "inputblock-without-tabindex",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Field.tsx": `import { InputBlock } from "@onlyoffice/apps-ui-kit/components/input-block";

export const Field = () => <InputBlock value="" onChange={() => {}} />;
`,
  },
  { code: 0, has: ["W-tabindex-missing"] },
);

// `/*` inside a regex or in JSX text is no comment; read as one, it hid every tag after it.
for (const [label, opener] of [
  ["a regex", `export const trim = (url: string) => url.replace(/\\/*$/, "");`],
  ["JSX text", `export const Hint = () => <p>Accepts image/* files</p>;`],
]) {
  expect(
    `slash-star in ${label} does not hide the rest of the file`,
    {
      "src/AppProviders.tsx": PROVIDERS,
      "src/Panel.tsx": `import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";

${opener}

export const Panel = ({ open }: { open: boolean }) => <Aside isVisible={open} />;
`,
    },
    { code: 1, has: ["E-visibility-prop"] },
  );
}

// --- the root barrel ---------------------------------------------------------------------------

// A value import from the root pulls billing and uploader into the module graph, and with them
// optional peers the application does not install. Verified by building: a Vite project on the
// packed 4.0.0 stops on `"makeAutoObservable" is not exported by "__vite-optional-peer-dep:mobx"`,
// and the same component from `components/button` builds -- so this is an error, not a trap. The
// message names the subpath for every binding it can place. A type-only import is erased first.
{
  const dir = project("a value import from the root barrel", {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Save.tsx": `import { Button, ButtonSize } from "@onlyoffice/apps-ui-kit";

export const Save = () => <Button label="Save" size={ButtonSize.normal} />;
`,
  });
  const result = run(dir);
  const barrel = result.findings.filter((f) => f.code === "E-root-barrel");
  check("a value import from the root barrel: exit 1", result.code === 1, `exit was ${result.code}`);
  check("a value import from the root barrel: reported once per statement", barrel.length === 1, `${barrel.length}`);
  check(
    "a value import from the root barrel: names the subpath",
    barrel.some((f) => `${f.fix ?? ""}`.includes(`Button from "@onlyoffice/apps-ui-kit/components/button"`)),
    JSON.stringify(barrel[0] ?? null),
  );
}
expect(
  "the providers through the root barrel",
  {
    "src/AppProviders.tsx": `import type { ReactNode } from "react";
import { ThemeProvider, TranslationProvider } from "@onlyoffice/apps-ui-kit";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TranslationProvider locale="en" translations={new Map()}>{children}</TranslationProvider>
    </ThemeProvider>
  );
}
`,
  },
  { code: 1, has: ["E-root-barrel"], lacks: ["E-no-theme-provider", "E-no-translation-provider"] },
);
expect(
  "type-only imports from the root barrel",
  {
    "src/AppProviders.tsx": PROVIDERS,
    "src/Types.ts": `import type { ButtonProps } from "@onlyoffice/apps-ui-kit";
import { type TextInputProps } from "@onlyoffice/apps-ui-kit";
export type { ComboBoxProps } from "@onlyoffice/apps-ui-kit";

export type Props = ButtonProps & TextInputProps;
`,
  },
  { code: 0, lacks: ["E-root-barrel"] },
);

// --- a provider is mounted by its tag ----------------------------------------------------------

// Without \`translations\` the provider installs no i18n context, so it is not mounted at all.
expect(
  "translation-provider-without-translations",
  {
    "src/AppProviders.tsx": PROVIDERS.replace(" translations={translations}", ""),
    "src/Notify.tsx": `import { Toast } from "@onlyoffice/apps-ui-kit/components/toast";

export const Notify = () => <Toast />;
`,
  },
  { code: 1, has: ["E-no-translation-provider"] },
);

expect(
  "providers-imported-and-never-rendered",
  {
    "src/App.tsx": `import { ThemeProvider } from "@onlyoffice/apps-ui-kit/providers/theme";
import { TranslationProvider } from "@onlyoffice/apps-ui-kit/providers/translation";
import { Button, ButtonSize } from "@onlyoffice/apps-ui-kit/components/button";

export const providers = [ThemeProvider, TranslationProvider];
export const App = () => <Button label="Save" size={ButtonSize.normal} />;
`,
  },
  { code: 1, has: ["E-no-theme-provider"] },
);

// Providers forwarded through a module of the application's own still count once rendered.
expect(
  "providers re-exported from a local module",
  {
    "src/providers.ts": `export { ThemeProvider } from "@onlyoffice/apps-ui-kit/providers/theme";
export * from "@onlyoffice/apps-ui-kit/providers/translation";
`,
    "src/App.tsx": `import type { ReactNode } from "react";
import { Toast } from "@onlyoffice/apps-ui-kit/components/toast";
import { ThemeProvider, TranslationProvider } from "./providers";

const translations = new Map([["en", new Map()]]);

export const App = ({ children }: { children: ReactNode }) => (
  <ThemeProvider locale="en">
    <TranslationProvider locale="en" translations={translations}><Toast />{children}</TranslationProvider>
  </ThemeProvider>
);
`,
  },
  { code: 0, lacks: ["E-no-theme-provider", "E-no-translation-provider"] },
);

// Another library's ThemeProvider is not the kit's, even beside a re-export of the kit's.
expect(
  "a styled-components ThemeProvider beside a re-export of the kit's",
  {
    "src/kit.ts": `export { ThemeProvider } from "@onlyoffice/apps-ui-kit/providers/theme";\n`,
    "src/main.tsx": `import { ThemeProvider } from "styled-components";
import { Button, ButtonSize } from "@onlyoffice/apps-ui-kit/components/button";

export const App = () => (
  <ThemeProvider theme={{}}>
    <Button label="Save" size={ButtonSize.normal} />
  </ThemeProvider>
);
`,
  },
  { code: 1, has: ["E-no-theme-provider"] },
);

// Forwarded providers reached through a path alias, under another local name, or as a namespace
// all count; a dependency's ThemeProvider still does not.
{
  const pkg = JSON.stringify({ dependencies: { react: "^19", "styled-components": "^6", "@onlyoffice/apps-ui-kit": "4.0.0" } });
  const forward = `export { ThemeProvider } from "@onlyoffice/apps-ui-kit/providers/theme";\n`;
  const body = (open, close) => `import { Button, ButtonSize } from "@onlyoffice/apps-ui-kit/components/button";\n${open}\nexport const App = () => (\n  ${close[0]}<Button label="Save" size={ButtonSize.normal} />${close[1]}\n);\n`;
  for (const [label, main, code] of [
    ["through a path alias", body(`import { ThemeProvider } from "@app/providers";`, ["<ThemeProvider>", "</ThemeProvider>"]), 0],
    ["under another local name", body(`import { ThemeProvider as KitTheme } from "./providers";`, ["<KitTheme>", "</KitTheme>"]), 0],
    ["as a namespace", body(`import * as P from "./providers";`, ["<P.ThemeProvider>", "</P.ThemeProvider>"]), 0],
    ["from a declared dependency", body(`import { ThemeProvider } from "styled-components";`, ["<ThemeProvider theme={{}}>", "</ThemeProvider>"]), 1],
  ]) {
    expect(
      `a forwarded ThemeProvider ${label}`,
      { "package.json": pkg, "src/providers.ts": forward, "src/main.tsx": main },
      code ? { code: 1, has: ["E-no-theme-provider"] } : { code: 0, lacks: ["E-no-theme-provider"] },
    );
  }
}

// --- the templates the skill tells a project to copy ------------------------------------------

// `templates/main` and `templates/providers` are copied into projects verbatim, and nothing read
// them. Checked as a project would hold them, next to an App that needs both providers — a
// template that stopped mounting one would report it here.
const TEMPLATES = path.join(HERE, "..", "templates");
const readTemplate = async (name) => (await import("node:fs")).readFileSync(path.join(TEMPLATES, name), "utf8");
const TEMPLATE_APP = `import { useState } from "react";
import { ComboBox, type TOption } from "@onlyoffice/apps-ui-kit/components/combobox";

const ROLES: TOption[] = [
  { key: "viewer", label: "Viewer" },
  { key: "editor", label: "Editor" },
];

export function App() {
  const [role, setRole] = useState<TOption>(ROLES[0]);
  return <ComboBox options={ROLES} selectedOption={role} onSelect={setRole} scaled scaledOptions />;
}
`;
const templateProject = {
  "src/main.tsx": await readTemplate("main"),
  "src/AppProviders.tsx": await readTemplate("providers"),
  "src/App.tsx": TEMPLATE_APP,
};
{
  const result = run(project("templates", templateProject));
  check("templates: check-usage reports nothing", result.code === 0 && result.findings.length === 0, result.findings.map((f) => f.code).join(", "));
}

// Compiling them needs the kit's types, which no offline run has. `--kit-project <dir>` names a
// project with the kit installed — an eval fixture after its install, say — and the templates
// are type-checked against its node_modules, reached through a link rather than copied. The
// release checklist runs this; without the flag it is skipped and says so.
const kitProjectAt = process.argv.indexOf("--kit-project");
if (kitProjectAt > 0) {
  const fs = await import("node:fs");
  const kitProject = path.resolve(process.argv[kitProjectAt + 1] ?? "");
  const modules = path.join(kitProject, "node_modules");
  const tsc = path.join(modules, "typescript", "bin", "tsc");
  if (!fs.existsSync(path.join(modules, "@onlyoffice", "apps-ui-kit")) || !fs.existsSync(tsc)) {
    check("templates: --kit-project has the kit and typescript installed", false, kitProject);
  } else {
    const dir = project("templates-compiled", {
      ...templateProject,
      "tsconfig.json": fs.readFileSync(path.join(REPO, "skills/apps-ui-kit/evals/fixtures/consumer-app/tsconfig.json"), "utf8"),
    });
    fs.symlinkSync(modules, path.join(dir, "node_modules"), "junction");
    try {
      execFileSync(process.execPath, [tsc, "--noEmit", "-p", dir], { encoding: "utf8" });
      check("templates: compile against the installed kit", true);
    } catch (error) {
      check("templates: compile against the installed kit", false, `${error.stdout ?? ""}`.trim().split("\n").slice(0, 3).join(" / "));
    }
    // The link goes before the workspace is removed, so the removal cannot follow it.
    fs.unlinkSync(path.join(dir, "node_modules"));
  }
} else {
  console.log("templates: not compiled — pass --kit-project <dir with the kit installed> to type-check them");
}

// --- the manifest the validator reads --------------------------------------------------------

const allowedVisibility = new Set(["visible", "isOpen", "opened", "open", null]);
for (const [folder, component] of Object.entries(MANIFEST.components)) {
  check(
    `manifest: ${folder} has a known visibility prop`,
    allowedVisibility.has(component.visibilityProp),
    `${component.visibilityProp}`,
  );
  check(`manifest: ${folder} carries no page path`, !("page" in component));
}
check("manifest: every component is accounted for", Object.keys(MANIFEST.components).length >= 98, `${Object.keys(MANIFEST.components).length}`);
check("manifest: the portal-internal modules were parsed", MANIFEST.portalInternalSubpaths.includes("selectors"));
check("manifest: the barrel leak is recorded", MANIFEST.portalInternalBarrelNames.includes("Uploader"));
check("manifest: the leak includes billing's constants file", MANIFEST.portalInternalBarrelNames.includes("YEAR_KEY"));
check("manifest: carries no revision of the kit, which would differ on every commit", !("syncedCommit" in MANIFEST));

// --- the sync tools ---------------------------------------------------------------------------

// The manifest check needs a kit to compare with, and the two kinds of source the tool accepts
// have failed independently of each other -- a field written from one and not the other -- so
// each runs when it is at hand: an installed package through `--kit-project`, and a checkout of
// `docspace-ui-kit-react` beside this repository when it is at the version the skill pins -- on any
// other revision its metadata describes a different release and says nothing about the manifest.
const syncChecks = [["every link and version traces to sources.json", ["tools/sync-sources.mjs", "--skill", "apps-ui-kit", "--check"]]];
if (kitProjectAt > 0) {
  const kit = path.join(path.resolve(process.argv[kitProjectAt + 1] ?? ""), "node_modules", "@onlyoffice", "apps-ui-kit");
  syncChecks.push(["the manifest matches the installed kit", ["tools/sync-ui-kit.mjs", "--from", kit, "--check"]]);
}
const kitCheckout = path.resolve(REPO, "..", "docspace-ui-kit-react");
const pinnedKit = JSON.parse(readFileSync(path.join(REPO, "skills", "apps-ui-kit", "sources.json"), "utf8")).version;
const checkoutVersion = existsSync(path.join(kitCheckout, "package.json"))
  ? JSON.parse(readFileSync(path.join(kitCheckout, "package.json"), "utf8")).version
  : null;
if (checkoutVersion === pinnedKit && existsSync(path.join(kitCheckout, "docs", "public-api.md"))) {
  syncChecks.push(["the manifest matches the kit checkout", ["tools/sync-ui-kit.mjs", "--from", kitCheckout, "--check", "--strict"]]);
} else if (checkoutVersion) {
  console.log(`skip  the manifest vs the kit checkout (${kitCheckout} is at ${checkoutVersion}, the skill pins ${pinnedKit} — pull it, or pass --kit-project)`);
} else {
  console.log(`skip  the manifest vs the kit checkout (no ${kitCheckout})`);
}
for (const [what, argv] of syncChecks) {
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
