# Audit: why an existing plugin misbehaves

Most broken plugins look right: TypeScript is happy, the build succeeds, the portal silently ignores it. Run the mechanical checks first, then read for what a script cannot judge. `$SKILL` is the skill directory, resolved to an absolute path; the checklist of rules is in [SKILL.md](../SKILL.md#the-rules-that-decide-whether-it-works).

Contents: [Switches](#0-the-question-that-outranks-the-code) · [1. Locate and build](#1-locate-and-build) · [2. Validator](#2-run-the-validator) · [3. Browser pass](#3-run-the-browser-pass) · [4. Read the source](#4-read-the-source-for-what-neither-script-can-see) · [5. Drift](#5-check-for-drift) · [6. Report](#6-report)

## 0. The question that outranks the code

One cause outranks everything and costs one question: **is the plugin system switched on for that portal?** It is off by default; when off, nothing loads and nothing logs. Installation can be disabled separately, which looks like a broken archive. Ask before auditing code ([portal.md → the switches](portal.md#before-anything-loads-the-switches)).

## 1. Locate and build

Find the project — a `package.json` containing `pluginName`; never inside the DocSpace client repository. If `dist/plugin.zip` is missing or older than `src/`: `cd <plugin-dir> && npm install && npm run build`. A failed build is the finding — report the compiler error and stop.

## 2. Run the validator

```sh
node "$SKILL/scripts/validate-plugin.mjs" <plugin-dir> --invoke
```

Each finding's message says what went wrong; the codes group them (`pkg.*` manifest, `build` externals, `dist` bundle imports, `scope`/`item`/`message` registration, `runtime` load or callback failures, `render` a component that throws on first paint, `locale` a table the portal will never read, `css` a stylesheet nothing scopes, `deprecated`, `sdk-drift`). A load failure — an unresolvable import, no default export — masks everything behind it: copy the project to a scratch directory, fix **only** that, rebuild and validate the copy; leave the audited project untouched.

## 3. Run the browser pass

```sh
node "$SKILL/scripts/preview-plugin.mjs" <plugin-dir>
```

The layout half of the audit, and the only pass that can perform it: a stylesheet has run, every box has a size and the effects have fired. It settles by measurement what used to be a reading job — whether a rule in the plugin's `.css` escapes into the portal's own DOM, whether a control collapsed, whether anything is drawn over anything else, whether a surface is blank once its effects have run. Then read the screenshots in `<plugin-dir>/.plugin-preview/shots/` for the judgements no assertion makes: doubled spacing, a row of blocks that should have been a stack, a surface that reads as unfinished. `preview skipped` means nothing was measured — install what it names and run it again. Its codes and limits are in [build.md → 7. See it](build.md#7-see-it--the-step-that-catches-what-looks-broken).

## 4. Read the source for what neither script can see

Both passes are blind to intent, to what happens on a real request and to anything behind a click nobody made. With [portal.md](portal.md) open, look for:

- **A blank surface neither pass reached** — an effect that throws only against real data: `JSON.parse` on a 404 body, a field the portal omits. The browser pass reports the surfaces that came out empty against *no* API, so what is left is the ones that break on an answer.
- **Registration timing** — module-scope registration is legitimate on its own; it is a defect when the factory translates a label or calls `getAPI()` there, and items added after `onLoadCallback` resolves are invisible until an update action.
- **Unhandled errors in class-side callbacks**, **work or fetching in `onLoadCallback`**, **a settings page that never calls `setSaveButton`, whose Save and error states are gated on validity alone, or whose save reports neither outcome**, **stored settings read during `onLoadCallback`**, **a class field named like a manifest field** (`settings`, `name`, `version`, …), **blocking loops**, **`scpDomains`**, **timers outside components**.
- **A hand-rolled implementation of a solved problem** — an archive writer, an HTML sanitiser, a CSV or XLSX serialiser. Name the standard package; it is a correctness finding, not a style one. So is the mirror image: a dependency nobody has heard of, running in the portal's window with the user's session ([dependencies.md](dependencies.md)).
- **Any `.css` rule the browser pass could not reach** — it plants portal-shaped markup and reports what a rule of yours matches, which covers the common shapes; a selector aimed at something more specific in the portal's DOM (`.section-header`, a kit hash) still needs a reader ([styles.md → Scoped CSS](styles.md#scoped-css)).
- **A viewer whose render path never met a real file** — the browser pass shows only its loading branch. Find the parse→draw→export functions and run them once against a fixture in a browser, one per kind the plugin claims ([build.md → 5. Build](build.md#5-build)).

## 5. Check for drift

The validator reports `sdk-drift` when the installed SDK is not the major it knows. SDK **2.x** means an SDK 2 plugin — a reading job against [sdk-2-plugins.md](sdk-2-plugins.md), and the recommendation is migration. An SDK ahead of the portal compiles scopes and actions that do nothing ([scopes.md](scopes.md)). Deprecated members and the dead webpack build script are listed in [sdk-contract.md](sdk-contract.md#deprecated--do-not-use-in-new-code); `window.Plugins.X = plugin` in a module plugin is harmless dead code.

## 6. Report

Group findings: **silent breakage** (works in principle, does nothing on the portal) first; then **wrong behaviour**; **fragility** (unhandled errors, blocking work, collision-prone keys); **hygiene** (stale SDK, deprecated members, missing version bump). Say what the user would observe — "the tab opens blank" lands better than "unhandled rejection in an effect". If nothing is wrong, say so and list what you checked.

**When asked to fix:** fix from silent breakage down, bump `version`, rebuild and re-validate until clean, report what changed and what you deliberately left alone.
