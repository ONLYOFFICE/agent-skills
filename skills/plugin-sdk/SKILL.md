---
name: plugin-sdk
description: Build, audit and explain ONLYOFFICE DocSpace plugins. Use this whenever someone wants to build, create, scaffold or bootstrap a DocSpace plugin, or to add a feature, scope, item, page or settings screen to one they already have — a page or entry in the DocSpace sidebar, an item in the context menu, main button or profile menu, a tab in the info panel, a handler for a custom file type, a reaction to a DocSpace event, an admin settings form — including when they only describe the feature ("I want a button in DocSpace that converts a file", "a screen inside DocSpace listing our rooms", "add a panel showing room activity") without naming the SDK, React or the UI kit. Use it too when a plugin installs but does nothing, a page or panel renders blank, an item does not appear, a plugin button is dead, changes do not show up after re-uploading, a plugin shows for the wrong users, or someone asks to review, audit, debug, fix, migrate or modernise an existing plugin — and when they simply ask how the SDK or the portal behaves: which scopes exist, what a component can reach, what fields an item needs, which action needs which payload, why a plugin silently does nothing.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
  sdk-version: "3.0.0"
  docspace-version: "4.0"
---

# ONLYOFFICE DocSpace plugins

Three jobs: **building** a plugin, **auditing** one that misbehaves, **explaining** how the SDK and the portal work.

A plugin has two halves. A **class** registers items — a context menu entry, a sidebar page, an info panel tab — and answers the portal's loader. Every visible surface is a **React component** built from the portal's own `@docspace/ui-kit`, rendered by the portal inside its own React tree, with the plugin runtime reachable through hooks. The portal supplies React and the kit at load time; the plugin ships only its own code as an ES module.

The difficulty in all three jobs is the same: DocSpace loads plugins with almost no error reporting. A missing default export, a package that should have been bundled, a filter field spelled in the singular instead of the plural — each installs, enables, and does nothing, with at most one line in the console. The tooling here catches that before anything reaches a portal.

## Toolkit and references

`$SKILL` is the directory containing this file (`<repo>/skills/plugin-sdk`, or `${CLAUDE_PLUGIN_ROOT}/skills/plugin-sdk` when installed as a Claude Code plugin). Resolve it to an absolute path once. Everything runs on Node alone — no portal, no network except `npm install` in the generated project.

```
$SKILL/scripts/generate-plugin.mjs   scaffold a project        $SKILL/scripts/validate-plugin.mjs   check one against the loader
$SKILL/references/                   the knowledge base — read these instead of recalling
```

| Question | Read |
|---|---|
| Which scopes exist, what version to target, what is not supported | [scopes.md](references/scopes.md) |
| What the class implements, how the portal gets it, localisation, deprecated members | [sdk-contract.md](references/sdk-contract.md) |
| Fields of each item type, which filter field the host reads, where each item renders | [items.md](references/items.md) |
| Components, hooks, what `useCurrentFile` returns where, actions, API and settings clients, modals, selectors, progress button, bundling | [react.md](references/react.md) |
| Kit conventions, theme variables, the behavioural traps the kit's types do not state | [ui-kit.md](references/ui-kit.md) |
| Load order, the silent-failure tables, what breaks the portal, limits | [portal.md](references/portal.md) |
| Calling the REST API from a component and from the class, file bytes, uploads, `cspDomains` | [rest-api.md](references/rest-api.md) |
| Reading an SDK 2 plugin (declarative trees) | [sdk-2-plugins.md](references/sdk-2-plugins.md) |

Kit component props are in the installed package's `.d.ts` files (`node_modules/@docspace/ui-kit/dist/types`); SDK interfaces in `@onlyoffice/docspace-plugin-sdk`'s. Read those for signatures; the references cover what the types do not say.

## Which job is this

| The person wants | Go to |
|---|---|
| A plugin that does not exist yet, or a feature added to one that does | [Build](#build) |
| To know why an existing plugin misbehaves, or to have it fixed | [Audit](#audit) |
| An explanation rather than a project | [Explain](#explain) |

A question that turns out to need a whole feature is better answered by building it than by pasting a sketch that has never compiled.

---

## Build

From a feature description to a built, validated `dist/plugin.zip` in one pass.

### 1. Understand what they want, briefly

Establish **where in the interface** the feature appears and **what happens when it is used**. Usually the request implies both. Ask only at a genuine fork (one file or a whole room?). Do not interrogate the user about scopes, manifests, React or SDK versions — those follow from the feature.

### 2. Pick scopes

| They want | Scope | Visible surface |
|---|---|---|
| A whole screen of their own — a dashboard, a list, a workspace | `ArticleNavigation` | a full page, `component` |
| An action on a selected file, folder or room | `ContextMenu` | none, or a modal it opens |
| A "create new…" entry | `MainButton` | none, or a dialog it opens |
| An entry point in the user's own profile menu | `ProfileMenu` | none — one item; what its click opens is up to you |
| Information about a file or room, alongside it | `InfoPanel` | a tab, `component` |
| To own a file extension — icon, open action | `File` | none, or a viewer/modal it opens |
| To react to something happening | `EventListener` | none |
| A small persistent control in the sidebar | `ArticleButton` | a 32×32 slot, `component` |
| Admin-configurable options | `Settings` | the settings aside, `component` |
| Class-side code that calls the REST API | `API` | — (a component needs no scope for this) |
| To embed a third-party page and talk to it | `PostMessage` | — |

Pick the fewest that deliver the feature; every declared scope must register at least one item or the validator fails it.

**Where a feature is reached from and where it renders are two questions.** `ContextMenu`, `MainButton` and `ProfileMenu` contribute an item and nothing else — they have no canvas of their own, and what the click returns decides the surface: a modal, an aside, the media viewer, or `navigate` to a page of your own. So nothing is "a profile menu feature" or "a context menu feature" by nature; those scopes only say how the user gets in. Two scopes together is the normal answer when the way in and the surface differ — a `ProfileMenu` entry whose click navigates to an `ArticleNavigation` page is one feature, not two.

Then map the surface by what it has to hold, not by where the person pictured it: anything that is a **screen** (a list, a table, more than a handful of fields) is an `ArticleNavigation` page, not a modal (400×280) or an info panel tab (337px); `MainButton` is for creating, so an action on existing things is `ContextMenu` — one item for a single entity, a second with `isGroupAction` for a selection. Build the right surface and say why in a sentence.

That table is the whole list. If the feature has no scope in it, say so and offer the closest entry point — never invent a scope, hook or field.

### 3. Scaffold — or extend what is already there

If the target directory already holds a plugin project (`package.json` with `pluginName` and `scopes`), skip the scaffolder — see *Extending* below.

Never run `npx create-docspace-plugin`: it waits on an interactive prompt and hangs the tool call. Use the scaffolder:

```sh
node "$SKILL/scripts/generate-plugin.mjs" --name my-plugin --plugin-name MyPlugin \
  --scopes ArticleNavigation,Settings --dir <target> --description "..." --author "..."
```

It writes the class with every member the loader calls, the Vite build with the externals the portal requires, and copies the packed UI kit and SDK from `$SKILL/vendor/` (neither is on npm) as `file:` dependencies. **It registers no items, deliberately** — `onLoadCallback` carries one TODO per scope naming the required fields and the filter field, and `setLanguage` one per scope for rebuilding items. `--name` is lower case with `-`/`_`; `--plugin-name` must be a JS identifier. `--ui-kit <tgz>` swaps in another kit revision if the user has one. Default the target to a new folder in the current directory named after the plugin — never inside a DocSpace checkout.

#### Extending an existing plugin

Read `package.json` (`pluginName`, `scopes`, `runtime`, `version`) and every file that registers an item or renders a component. A new scope needs **two edits together**: `package.json:scopes` *and* a getter with at least one item — either alone is a silent failure. Then:

- **Never change `name` or `pluginName`** — the portal keys the install by `name`; renaming installs a second plugin.
- Check new item keys against the ones already registered — the maps are portal-wide, and an `ArticleNavigation` key is a URL.
- **Bump `version`**, or the portal serves the cached bundle and the user sees no change.
- Match the project's layout and style; do not reorganise it around the feature.

A plugin built against SDK 2 (webpack, `window.Plugins.X = plugin`, `body: IBox` trees, no `runtime`) still runs, but nothing here can check or extend it. Migrate it first and whole — `runtime: "module"`, the Vite config from a fresh scaffold, `export default plugin`, a component per surface — say what changed, then add the feature ([sdk-2-plugins.md](references/sdk-2-plugins.md)). Fix loader-contract breakage that would surface as your feature not working, but do not turn the request into an audit.

### 4. Write the feature

Replace every TODO in `onLoadCallback` **and** in `setLanguage` with real items (or labels keep the language they were registered in). Components go in their own `.tsx` files under `src/`, handed to items as `component: Page` — the component, never `<Page />` — built from `@docspace/ui-kit` and inline styles. Read [items.md](references/items.md) for the item, [react.md](references/react.md) whenever there is a visible surface, [ui-kit.md](references/ui-kit.md) before writing a form, [rest-api.md](references/rest-api.md) for API calls — and apply [the rules](#the-rules-that-decide-whether-it-works). Keep the placeholder icons only if the user has nothing better, and say they are placeholders.

### 5. Build

```sh
cd <target> && npm install && npm run build
```

No `dist/plugin.zip` means the build failed, whatever the output said. Common causes: the kit's enum where the SDK's was meant (`ButtonSize` exists in both — alias one), a prop the kit does not have (check its `.d.ts` rather than casting), a component file without `.tsx`.

### 6. Validate — the step that matters

```sh
node "$SKILL/scripts/validate-plugin.mjs" <target> --invoke
```

This imports the bundle the way the portal does, runs `onLoadCallback` and checks what the portal would: `runtime: "module"`, a default export, nothing imported that the portal does not provide and no bundled React, every declared scope filled, item fields, filter names and `component` values, each action's payload; `--invoke` also calls the class-side callbacks with a dummy id. Iterate to zero errors; each message says what to do. A `runtime` error saying the bundle or `onLoadCallback` threw is the "installs and nothing happens" symptom. Warnings are worth reading; a `deprecated` warning on a new plugin always is.

The validator checks the **contract with the portal**, not the feature, and renders nothing. Read the components once against the two silent-failure tables in [portal.md](references/portal.md#silent-failures) — the UI-layer one (unlabelled fields, a toggle over the next row, an "empty" panel that accepts typing, a dialog stuck at 400×280) is the class of defect that passes every check and still looks broken.

### 7. Report

- where the archive is (`<target>/dist/plugin.zip`), what it does and where it appears (a page's URL `/p/<key>` is worth stating);
- anything left as a placeholder — icons especially;
- install: upload the zip in Settings → Integration → Plugins, then **fully reload the page**. No upload control, or nothing after installing → the portal has plugins switched off ([portal.md](references/portal.md#before-anything-loads-the-switches));
- bump `version` before every re-upload — the portal caches the bundle and the icons by version.

If they asked for something the portal cannot do, say so here rather than burying it.

---

## Audit

Most broken plugins look right: TypeScript is happy, the build succeeds, the portal silently ignores it. Run the mechanical checks first, then read for what a script cannot judge.

One cause outranks everything and costs one question: **is the plugin system switched on for that portal?** It is off by default; when off, nothing loads and nothing logs. Installation can be disabled separately, which looks like a broken archive. Ask before auditing code.

### 1. Locate and build

Find the project — a `package.json` containing `pluginName`; never inside the DocSpace client repository. If `dist/plugin.zip` is missing or older than `src/`: `cd <plugin-dir> && npm install && npm run build`. A failed build is the finding — report the compiler error and stop.

### 2. Run the validator

```sh
node "$SKILL/scripts/validate-plugin.mjs" <plugin-dir> --invoke
```

Each finding's message says what went wrong; the codes group them (`pkg.*` manifest, `build` externals, `dist` bundle imports, `scope`/`item`/`message` registration, `runtime` load or callback failures, `deprecated`, `sdk-drift`). A load failure — an unresolvable import, no default export — masks everything behind it: copy the project to a scratch directory, fix **only** that, rebuild and validate the copy; leave the audited project untouched.

### 3. Read the source for what the script cannot see

The validator never renders a component. With [portal.md](references/portal.md) open, look for:

- **A blank surface** — a component that threw: an unguarded fetch or parse in an effect, a conditional hook, `useCurrentFile()` assumed non-null in a modal opened from a menu.
- **Registration timing** — module-scope registration is legitimate on its own; it is a defect when the factory translates a label or calls `getAPI()` there, and items added after `onLoadCallback` resolves are invisible until an update action.
- **Unhandled errors in class-side callbacks**, **work or fetching in `onLoadCallback`**, **a settings page that never calls `setSaveButton`**, **stored settings read during `onLoadCallback`**, **a class field named like a manifest field** (`settings`, `name`, `version`, …), **blocking loops**, **unscoped CSS**, **`scpDomains`**, **timers outside components**.
- **A surface that renders but looks wrong** — the UI-layer table.

### 4. Check for drift

The validator reports `sdk-drift` when the installed SDK is not the major it knows. SDK **2.x** means an SDK 2 plugin — a reading job against [sdk-2-plugins.md](references/sdk-2-plugins.md), and the recommendation is migration. An SDK ahead of the portal compiles scopes and actions that do nothing ([scopes.md](references/scopes.md)). Deprecated members and the dead webpack build script are listed in [sdk-contract.md](references/sdk-contract.md#deprecated--do-not-use-in-new-code); `window.Plugins.X = plugin` in a module plugin is harmless dead code.

### 5. Report

Group findings: **silent breakage** (works in principle, does nothing on the portal) first; then **wrong behaviour**; **fragility** (unhandled errors, blocking work, collision-prone keys); **hygiene** (stale SDK, deprecated members, missing version bump). Say what the user would observe — "the tab opens blank" lands better than "unhandled rejection in an effect". If nothing is wrong, say so and list what you checked.

**When asked to fix:** fix from silent breakage down, bump `version`, rebuild and re-validate until clean, report what changed and what you deliberately left alone.

---

## Explain

Answer from the references, not from memory — the SDK's own documentation is thin on what the portal does with what you give it, and material circulating about the SDK describes scopes, hooks and interfaces that never shipped. If you cannot point at the scope, interface, hook, field or action in the references or the installed SDK, say it is not supported on the target pair and name the closest thing that is.

"Why doesn't my item appear?" and "why is my page blank?" are the most frequent questions; the answers are nearly always in the silent-failures tables in [portal.md](references/portal.md#silent-failures). Start there. Give the direct answer, then the reason — and label portal quirks as quirks (the filter field is `usersTypes` for some scopes and `usersType` for others; a modal opened from a menu has no current file), so people can tell principle from accident.

---

## The rules that decide whether it works

They apply whether writing or judging, and **no tool catches them** — the validator already reports an unfilled scope, a missing default export, a foreign import, a bundled React, a JSX element where a component was expected, a hook in a class-side callback and an action without its payload.

- **Components get no props; give them what the click knew.** `useCurrentFile()` is the selection in an info panel tab or the media viewer, and `null` on a page, in settings and in a modal opened from a menu, main button or file click — store the id in a module variable or a factory closure.
- **Register items inside `onLoadCallback`.** Language and API URLs are set only after the bundle executes; a factory at module scope captures empty values.
- **Fetch in effects, with a cleanup and a catch.** An uncaught throw in a component blanks it silently. Never fetch in `onLoadCallback`.
- **Catch your own errors in class-side callbacks** and return an error toast — nothing wraps `onItemClick`, `onClick`, `eventHandler` or `onSave`.
- **A settings page saves only through `setSaveButton`**, called in an effect that re-runs when the form changes.
- **Changing an item from a component is two steps:** mutate the map through the plugin instance, then call the matching `update*Items()`.
- **A React modal has no footer and a 280px cap.** Action row inside `dialogBodyComponent`; `autoMaxHeight`/`autoMaxWidth` or an aside for anything beyond a few rows; a screen is an `ArticleNavigation` page.
- **Colors come from the portal's theme variables**, never hardcoded hex ([ui-kit.md](references/ui-kit.md#colors)).
