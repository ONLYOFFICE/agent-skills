# Build: from a feature description to a validated `dist/plugin.zip`

The build workflow, step by step. The scope table, the job router and the checklist of rules that decide whether a plugin works are in [SKILL.md](../SKILL.md); this file is what to do, in order, once the job is a build. `$SKILL` is the skill directory, resolved to an absolute path.

Contents: [1. Understand](#1-understand-what-they-want-briefly) · [2. Pick scopes](#2-pick-scopes) · [3. Scaffold or extend](#3-scaffold--or-extend-what-is-already-there) · [4. Write the feature](#4-write-the-feature) · [5. Build](#5-build) · [6. Validate](#6-validate--the-step-that-matters) · [7. See it](#7-see-it--the-step-that-catches-what-looks-broken) · [8. Report](#8-report)

## 1. Understand what they want, briefly

Establish **where in the interface** the feature appears and **what happens when it is used**. Usually the request implies both. Ask only at a genuine fork (one file or a whole room?). Do not interrogate the user about scopes, manifests, React or SDK versions — those follow from the feature.

## 2. Pick scopes

The table of features → scopes is in [SKILL.md → Pick scopes](../SKILL.md#pick-scopes). Pick the fewest that deliver the feature; every declared scope must register at least one item or the validator fails it.

**Where a feature is reached from and where it renders are two questions.** `ContextMenu`, `MainButton` and `ProfileMenu` contribute an item and nothing else — they have no canvas of their own, and what the click returns decides the surface: a modal, an aside, the media viewer, or `navigate` to a page of your own. So nothing is "a profile menu feature" or "a context menu feature" by nature; those scopes only say how the user gets in. Two scopes together is the normal answer when the way in and the surface differ — a `ProfileMenu` entry that opens an aside, a `ContextMenu` item that navigates to a page, are one feature and not two. The exception is the surface that carries its own way in: `ArticleNavigation` is already in the left sidebar, so a menu entry whose click *only* navigates to that page is a second identical door rather than a second scope's worth of feature.

Then map the surface by what it has to hold, not by where the person pictured it: anything that is a **screen** (a list, a table, more than a handful of fields) is an `ArticleNavigation` page, not a modal (400×280) or an info panel tab (337px); `MainButton` is for creating, so an action on existing things is `ContextMenu` — one item for a single entity, a second with `isGroupAction` for a selection. Build the right surface and say why in a sentence.

That table is the whole list. If the feature has no scope in it, say so and offer the closest entry point — never invent a scope, hook or field. A feature *inside* an open document is not in it at all: that is an ONLYOFFICE Docs plugin, a different product ([scopes.md → Anything not in that table](plugins/scopes.md#anything-not-in-that-table)).

## 3. Scaffold — or extend what is already there

If the target directory already holds a plugin project (`package.json` with `pluginName` and `scopes`), skip the scaffolder — see *Extending* below.

Never run `npx create-docspace-plugin`: it waits on an interactive prompt and hangs the tool call. The manifest fields it would have asked for, and the scopes it offers, are described in [Creating plugin template](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/creating-plugin-template.md); the scaffolder writes the same ones from its flags:

```sh
node "$SKILL/scripts/generate-plugin.mjs" --name my-plugin --plugin-name MyPlugin \
  --scopes ArticleNavigation,Settings --dir <target> --description "..." --author "..."
```

It writes the class with every member the loader calls, the Vite build with the externals the portal requires, `src/locales.ts`, `src/css-modules.d.ts`, a `typecheck` script, and copies the packed UI kit and SDK from `$SKILL/vendor/` as `file:` dependencies — the kit is published nowhere, and the SDK is installed from the tarball until 3.0.0 lands on npm, after which the tarball goes and `SDK_RANGE` takes over ([README.md](../README.md)). **It registers no items, deliberately** — `onLoadCallback` carries one TODO per scope naming the required fields and the filter field. `--name` is lower case with `-`/`_`; `--plugin-name` must be a JS identifier. `--ui-kit <tgz>` swaps in another kit revision if the user has one. Default the target to a new folder in the current directory named after the plugin — never inside an ONLYOFFICE Apps checkout.

**English only, unless the user named other languages.** `--locales ru,de,ja-JP` writes an empty typed table per language, keyed by the `PluginLocale` member, plus `t()` and `tf()`. **The language the request is written in is not one of them** — a plugin asked for in Russian still scaffolds English alone. Do not ask; scaffold English and note in the report that another language is `--locales` plus one table. Tags are validated against the enum: `ja` is refused with `ja-JP` named.

### Extending an existing plugin

Read `package.json` (`pluginName`, `scopes`, `runtime`, `version`) and every file that registers an item or renders a component. A new scope needs **two edits together**: `package.json:scopes` *and* a getter with at least one item — either alone is a silent failure. Then:

- **Never change `name` or `pluginName`** — the portal keys the install by `name`; renaming installs a second plugin.
- Check new item keys against the ones already registered — the maps are portal-wide, and an `ArticleNavigation` key is a URL.
- **Bump `version`**, or the portal serves the cached bundle and the user sees no change.
- Match the project's layout and style; do not reorganise it around the feature.

A plugin built against SDK 2 (webpack, `window.Plugins.X = plugin`, `body: IBox` trees, no `runtime`) still runs, but nothing here can check or extend it. Migrate it first and whole — `runtime: "module"`, the Vite config from a fresh scaffold, `export default plugin`, a component per surface — say what changed, then add the feature ([sdk-2-plugins.md](sdk-2-plugins.md)). Fix loader-contract breakage that would surface as your feature not working, but do not turn the request into an audit.

## 4. Write the feature

Replace every TODO in `onLoadCallback` with real items, built by **factory functions** rather than module constants — a constant is built before the portal has set the language. Components go in their own `.tsx` files under `src/`, handed to items as `component: Page` — the component, never `<Page />` — built from `@onlyoffice/apps-ui-kit` and inline styles, plus a `.module.css` where inline styles cannot reach (`:hover`, keyframes, media queries, generated markup) — a module, because `plugin.css` lands in the portal's own document and only hashed class names cannot restyle ONLYOFFICE Apps ([styles.md → Scoped CSS](styles.md#scoped-css)). Read the page of every scope you fill (linked from [SKILL.md → Pick scopes](../SKILL.md#pick-scopes)), [rendering.md](react/rendering.md) and [hooks.md](react/hooks.md) whenever there is a visible surface, [actions.md](react/actions.md) and the surface's own page — [modal-dialog.md](components/modal-dialog.md), [selector.md](components/selector.md), [create-dialog.md](components/create-dialog.md), [media-viewer.md](components/media-viewer.md), [floating-operations-button.md](components/floating-operations-button.md) — as soon as the feature opens a modal, a picker or the progress button, [ui-kit.md](ui-kit.md) before writing a form, [styles.md](styles.md) before writing a stylesheet, [rest-api.md](rest-api.md) for API calls — and apply [the checklist](../SKILL.md#the-rules-that-decide-whether-it-works). Keep the placeholder icons only if the user has nothing better, and say they are placeholders.

**Take the proven library; do not write your own** for anything with a format or a security dimension behind it — archives, PDF, spreadsheets, markdown, sanitising HTML, date arithmetic. Take the obvious widely used package, **check it on the registry before writing the import**, and say in the report what it does *not* handle. Nothing at all for what the browser already does (`fetch`, `Intl`, `crypto.subtle`, `structuredClone`) or the kit already renders. Criteria, commands, the usual answers and why this matters more inside a plugin: [dependencies.md](dependencies.md).

**Write and patch source files with the file-writing tools, not a shell heredoc or a one-liner** — a heredoc halves backslashes and expands escapes, so a regex or a template literal reaches disk altered and the bug then looks like a bug in the code.

## 5. Build

```sh
cd <target> && npm install && npm run build && npm run typecheck
```

No `dist/plugin.zip` means the build failed, whatever the output said. Common causes: the kit's enum where the SDK's was meant (`ButtonSize` exists in both — alias one), a prop the kit does not have (check its `.d.ts` rather than casting), a component file without `.tsx`.

**A `dist/` with JavaScript beside `plugin.js` is a split bundle.** The archive carries `plugin.js` alone and the portal cannot load a chunk, so a library that lazy-loads its parts dies on the portal at first use and works in the preview. The scaffold's config turns code splitting off; an older project adds `codeSplitting: false` to `build.rolldownOptions.output`; the validator refuses the build until `dist/` holds one script ([bundling.md](bundling.md)).

**`npm run build` does not check types** — Vite strips them — so `npm run typecheck` (`tsc --noEmit`, in every scaffolded project) is a separate step and worth running once the feature compiles. A generated project ships `src/css-modules.d.ts`, so `import styles from "./x.module.css"` type-checks; an older project without it needs that declaration before `tsc` agrees.

**Where the plugin writes the user's files, test the part that decides what gets written** — archive entry paths, a parser, a diff. Keep that logic in plain functions with no SDK or kit imports so it is testable at all, then `npm i -D vitest` and one `*.test.ts` beside the module (the project's own Vite config resolves the imports; `node --experimental-strip-types` does not). Say in the report what is covered and what only ran on the portal.

**Where the plugin *shows* the user's files — a `File`-scope viewer, a media-viewer component — smoke-test the render path in a real browser, one fixture per kind of content it claims.** No offline pass has the bytes: the validator and the preview prove the component mounts, not that a diagram, a model or an image comes out of it, and green checks over a dead parse→draw→export pipeline is the usual shape of a viewer's first bugs. Keep that pipeline in plain functions (`render(text, container)`, `toPng(svg)`) and run them under Vitest's browser mode — `npm i -D @vitest/browser-playwright` beside the Playwright the preview pass installed, `test: { browser: { provider: playwright(), instances: [{ browser: "chromium" }] } }` in `vitest.config.ts`, `npx vitest --browser` — asserting what a user would see: the output has pixel dimensions rather than `100%`, it contains the fixture's text or nodes, an export yields a non-empty blob of the right type. Every kind the plugin lists — each diagram type, each format variant — gets its own fixture, because the failure that reaches users is in the one nobody rendered.

## 6. Validate — the step that matters

```sh
node "$SKILL/scripts/validate-plugin.mjs" <target> --invoke
```

This imports the bundle the way the portal does, runs `onLoadCallback` and checks what the portal would: `runtime: "module"`, a default export, nothing imported that the portal does not provide and no bundled React, every declared scope filled, item fields, filter names and `component` values, each action's payload, and locale tables keyed by something `PluginLocale` does not have; `--invoke` also calls the class-side callbacks with a dummy id. Iterate to zero errors **on a built project** — an unbuilt one reports `0 error(s)` with a `dist` warning and has checked nothing past the manifest; each message says what to do. A `runtime` error saying the bundle or `onLoadCallback` threw is the "installs and nothing happens" symptom. A `zip` warning that the archive is older than the sources means the packed zip predates the edit, so uploading it would ship the previous build. Warnings are worth reading; a `deprecated` warning on a new plugin always is.

It then **renders every component once** with the project's own React, each with the runtime its own surface gets — `useCurrentFile()` null on a page, in settings and in a dialog opened from a click; the selection in an info panel tab or the media viewer. A `render` error is a component that throws on first paint, which on the portal is a blank page, tab or dialog with one console line. The last line counts the surfaces rendered out of those tried; `render skipped` means `react-dom` was not installed, so run `npm install` and validate again rather than assuming the surfaces are fine. Nothing runs the **effects** and nothing has a size, so what an effect does and what the CSS does to it are measured in the next step, not here.

**Read that line for what it did *not* cover.** The sandbox has no network, so a callback that fetches before returning its message — reading the file's name for the dialog header, say — ends in its own `catch`, and the modal behind the request is never opened, collected or rendered. That shows up as a `runtime` warning plus `callback(s) stopped at a network call` beside the render tally. A clean run over zero surfaces is not coverage: check that surface on a portal, or have the click open it first and fetch from the component's effect.

The validator checks the **contract with the portal**, not the feature. Read the components once against the two silent-failure tables in [portal.md](portal.md#silent-failures). The UI-layer table (unlabelled fields, a toggle over the next row, an "empty" panel that accepts typing, a dialog stuck at 400×280) lists the defects that pass every check and still look broken — and the step below is what measures most of them.

## 7. See it — the step that catches what looks broken

```sh
node "$SKILL/scripts/preview-plugin.mjs" <target>
```

Mounts the built bundle in Chromium against the **real** UI kit and the **real** theme variables, at the width each surface actually gets, in both themes, and measures what came out. It is the only pass where a stylesheet has run, a box has a size and an effect has fired, so it reports what the other checks cannot see:

| Code | What the user would have seen |
|---|---|
| `preview-load` | `onLoadCallback()` threw in the browser — on the portal this aborts installation: no items, no CSS, nothing for users, and *Failed to initialize* on the administrator's plugin card. The most severe code here |
| `preview-console` | the browser logged an error while the surfaces mounted — the portal's boundary swallows it and leaves the surface blank |
| `preview-leak` | one of the plugin's own CSS rules matched portal-shaped markup planted beside it — that rule restyles ONLYOFFICE Apps itself. This is the check the references say nothing performs; now something does |
| `preview-collapsed` | a control that came out a few px wide — the panel that looks empty and still accepts typing |
| `preview-overflow` | content wider than its surface — the horizontal scrollbar across the whole portal |
| `preview-overlap` | two things drawn on top of each other — the toggle's label over the next row |
| `preview-blank` | a surface that painted nothing **after** its effects ran — the blank tab the render pass cannot reach |
| `preview-invisible` | text the same colour as what is behind it, in one of the two themes — a literal colour that only works in the other |
| `preview-unlabelled` | a field with no visible label, no `aria-label` and no placeholder |

Fix what it reports and run it again. Then **look at the screenshots** it writes to `<target>/.plugin-preview/shots/` — they are the two themes of every surface at its real width, and doubled spacing, a broken row of blocks or a dialog that reads as unfinished are judgements no assertion makes for you. A clean run removes the harness and keeps `shots/`; a run with errors keeps all of it, and `--keep` keeps it either way.

`preview skipped` is a setup step, never a pass: it names what is missing (`npm run build` first, `npm install` first, or `npm i -D playwright && npx playwright install chromium`). A skipped run has measured nothing — do not report the surfaces as checked.

**What it is not.** The kit's stylesheets are in the page; the ONLYOFFICE Apps client's own are not, and the kit's optional peers (the socket client, the markdown renderer, the AI chat) are stubs, so a kit component that needs one of them renders nothing meaningful here. So it proves a rule of yours escapes, and it cannot prove the reverse — that a portal rule beats one of yours ([styles.md → What beats your rules](styles.md#what-beats-your-rules)). The portal API answers nothing here, so a surface that needs data renders its loading or empty branch — worth seeing, and not the same as seeing it with data. One real upload still settles both.

## 8. Report

- where the archive is (`<target>/dist/plugin.zip`), what it does and where it appears (a page's URL `/p/<key>` is worth stating);
- anything left as a placeholder — icons especially;
- every third-party package the plugin now bundles, one line each: what it does, why it was the one to take, **and what it does not handle** — a library's known blind spot ([dependencies.md](dependencies.md)) becomes the plugin's silent bug, so it is part of the decision, not a footnote;
- what could not be checked offline: a request whose shape only the portal answers, anything behind a real upload, an untested edge in someone else's format, a render path no fixture was pushed through;
- install: upload the zip in Settings → Integration → Plugins ([Adding plugin](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/adding-plugin.md)), then **fully reload the page**. No Plugins tab, or no upload control on it → the portal has plugins, or their upload, switched off ([portal.md](portal.md#before-anything-loads-the-switches)); installed, reloaded and still nothing → the [silent-failure table](portal.md#silent-failures); a *Failed to load* or *Failed to initialize* toast after the upload carries the reason ([portal.md → When loading fails](portal.md#when-loading-fails)) — fix it and upload again under a new `version`;
- bump `version` before every re-upload — the portal caches the bundle and the icons by version, and refuses a re-upload of the same one ([the docs' note](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/creating-plugin-template.md)).

If they asked for something the portal cannot do, say so here rather than burying it — but **a limitation needs positive evidence, not an exhausted search.** "No `Actions` member refreshes the file list" is a fact about `Actions`; "the plugin cannot refresh the file list" is a claim about the portal, and it is usually the endpoint that was wrong. Until you have tried the thing that would disprove it, keep it out of the README, the CHANGELOG and the code comments, where a false explanation reads as settled to everyone who comes after.
