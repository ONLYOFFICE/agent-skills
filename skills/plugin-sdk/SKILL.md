---
name: plugin-sdk
description: Build, audit and explain ONLYOFFICE DocSpace plugins. Use this whenever someone wants to build, create, scaffold or bootstrap a DocSpace plugin, or to add a feature, scope, item or settings page to one they already have — an item in the DocSpace context menu, main button, profile menu, info panel or sidebar, a handler for a custom file type, a reaction to a DocSpace event — including when they only describe the feature ("I want a button in DocSpace that converts a file", "add a panel showing room activity") without naming the SDK. Use it too when a plugin installs but does nothing, an item does not appear, a plugin button is dead, changes do not show up after re-uploading, a plugin shows for the wrong users, or someone asks to review, audit, debug, fix or modernise an existing plugin — and when they simply ask how the SDK or the portal behaves: which scopes exist, what fields an item needs, which action needs which payload, why a plugin silently does nothing.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
  sdk-version: "2.1.0"
  docspace-version: "4.0"
---

# ONLYOFFICE DocSpace plugins

This skill covers three jobs — **building** a plugin, **auditing** one that misbehaves, and **explaining** how the SDK and the portal work. They share one body of knowledge, so they live together.

The difficulty in all three is the same. DocSpace loads plugins with almost no error reporting: a mismatched name, a missing getter, a filter field spelled in the singular instead of the plural — each produces a plugin that installs, enables, and does nothing at all, with a clean console. The tooling here exists to catch that before anything reaches a portal.

## Locating the toolkit

Scripts and references are siblings of this file. Throughout, `$SKILL` means **the directory containing this `SKILL.md`** — resolve it to an absolute path once and reuse it:

| Where you are running | `$SKILL` |
|---|---|
| Any agent, reading this file from a checkout | the directory this file is in — usually `<repo>/skills/plugin-sdk` |
| Claude Code, skill installed as a plugin | `${CLAUDE_PLUGIN_ROOT}/skills/plugin-sdk` |

```
$SKILL/scripts/      generate-plugin.mjs, validate-plugin.mjs, contract.mjs, test-validator.mjs
$SKILL/scripts/generator/, validator/, validator-tests/  their internals, never run directly
$SKILL/references/   the knowledge base — read these instead of recalling
$SKILL/templates/    build configs for generated projects
```

Everything runs on Node alone. No portal, no ONLYOFFICE checkout, no network.

## Which job is this

| The person wants | Go to |
|---|---|
| A plugin that does not exist yet, or a feature added to one that does | [Build](#build) |
| To know why an existing plugin misbehaves, or to have it fixed | [Audit](#audit) |
| An explanation rather than a project | [Explain](#explain) |

A question that turns out to need a real project — "show me how to do X" where X is a whole feature — is better answered by building it than by pasting a large sketch that has never been compiled.

---

## Build

Go from a description of a feature to a built, validated archive the user can upload, in one pass — without leaving them a project that compiles but silently does nothing on the portal.

### 1. Understand what they want, briefly

Establish two things: **where in the interface** the feature appears, and **what happens when it is used**. Usually the request already implies both — "a button that converts the selected file to PDF" is a context menu item plus an API call. Ask only when a genuine fork exists, such as whether an action applies to one file or a whole room.

Do not interrogate the user about scopes, manifests or SDK versions. That is your job, and the answers follow from the feature.

### 2. Pick scopes

Map the feature onto the entry points the portal offers. [references/sdk-target.md](references/sdk-target.md) has the authoritative table.

| They want | Scope |
|---|---|
| An action on a selected file, folder or room | `ContextMenu` |
| A "create new…" style entry | `MainButton` |
| Something personal to the current user | `ProfileMenu` |
| A tab of information about a file or room | `InfoPanel` |
| To own a file extension — custom icon, custom open action | `File` |
| To react to something happening (file created, room edited) | `EventListener` |
| A persistent entry point in the sidebar | `ArticleButton` |
| Admin-configurable options (API keys, toggles) | `Settings` |
| To call the DocSpace REST API | `API` |
| To embed a third-party page and talk to it | `PostMessage` |

Pick the fewest that deliver the feature. Every declared scope must be implemented and must register at least one item, otherwise the validator fails it — a declared-but-empty scope is a common way plugins ship broken.

Map the feature onto a surface by what the action *does*, not by where the person happened to picture it. `MainButton` is where the portal puts "create a new…" entries, so an action on things that already exist sits oddly there — it lands under a *More* sub-entry among the create actions, and it only ever knows the current folder. Acting on existing files, folders or rooms belongs in `ContextMenu`, where the user's own selection is the input: one item for a single entity, and a second with `isGroupAction`/`onGroupClick` for a whole selection. If someone asks for a surface that fights the action this way, build the right one and say why in a sentence — a misplaced entry is not a bug anyone will report, just something nobody finds.

That table is the whole list. If the feature they describe has no scope in it, say so plainly and offer the closest supported entry point — never invent a scope, interface or field to cover the gap. Anything the SDK does not export fails the build; anything the portal cannot host installs, enables and then silently shows nothing.

### 3. Scaffold — or extend what is already there

If the target directory already holds a plugin project — a `package.json` with `pluginName` and `scopes` — skip the scaffolder entirely and go to *Extending an existing plugin* below. It refuses to write into a non-empty directory, and `--force` would overwrite the user's work rather than add to it.

Never run `npx create-docspace-plugin`. It is built on an interactive prompt and will hang the tool call waiting for keystrokes; it also emits a plugin with no items at all.

Use the scaffolder instead — it writes the class with every member the loader calls, the build config and the assets, so the only thing left to write is the feature:

```sh
node "$SKILL/scripts/generate-plugin.mjs" \
  --name my-plugin \
  --plugin-name MyPlugin \
  --scopes ContextMenu,API \
  --dir <target> \
  --description "..." \
  --author "..."
```

**It registers no items, deliberately.** `onLoadCallback` carries one TODO per scope naming the fields that item type requires and the user-type filter field the host reads there. So the scaffold builds, but it cannot be uploaded as something that looks alive and does nothing real — and until those TODOs are replaced by items, the validator reports every declared scope as an empty map. That is why validation is step 6 and not step 3.

Naming rules, both enforced: `--name` is lower case with `-`/`_` only (the portal lower-cases it anyway), and `--plugin-name` must be a valid JS identifier, because it becomes `window.Plugins.<pluginName>` and must match the manifest exactly.

Default the target directory to a new folder in the current working directory, named after the plugin. If the user is sitting in a DocSpace repository checkout, put it outside — a plugin project is never part of the portal source.

#### Extending an existing plugin

Read the project before changing it: `package.json` for `pluginName`, `scopes` and `version`, and every source file that registers an item. You are adding to a live contract, not writing on a blank page.

If the feature needs a scope the plugin does not declare yet, two edits have to land **together**: add it to `package.json:scopes` *and* implement its getter with at least one item registered. Either one alone produces the silent failure this whole skill exists to prevent — a declared scope with no getter is ignored, and a getter for an undeclared scope is never called.

Then follow the plugin's own conventions rather than the scaffold's. Specifically:

- **Never change `name` or `pluginName`.** The portal keys an installed plugin by `name`, so renaming does not update it — it installs a second plugin beside the old one, and `pluginName` must keep matching `window.Plugins.<pluginName>` in the bundle.
- **Check new item keys against the ones already registered**, in this plugin and for collisions with generic names, since the maps are portal-wide.
- **Bump `version`.** Without it the portal serves the cached bundle and the user sees no change at all, which reads exactly like a broken feature.
- Match the existing file layout, naming and error-handling style; do not reorganise the project around the new feature.

If the existing code already breaks the loader contract in a way that will surface as your feature not working, fix that too and say so — but do not turn the request into a general cleanup. That is what [Audit](#audit) is for.

### 4. Write the actual feature

The scaffold registers nothing: each declared scope has a TODO in `onLoadCallback` with its required fields and its filter field, and `setLanguage` has one per scope for rebuilding items after a language change. Replace them with real items — including the `setLanguage` ones, or labels keep the language they were registered in. When extending an existing plugin there are no TODOs; write the item to match what the project already does.

Read what you need, rather than guessing:

- [references/items.md](references/items.md) — required fields per scope, which user-type filter field the host reads, and where each item actually renders
- [references/ui-components.md](references/ui-components.md) — building UI: per-component props with the host's real defaults and pixel sizes, theme tokens, modal dimensions. **Read it whenever the feature has any visible surface** — the portal renders your description with its own components, and most visual bugs are a prop the host ignores or a default nobody expected
- [references/recipes.md](references/recipes.md) — worked patterns for modals with validation, settings, file actions, async panels, embedded iframes
- [references/rest-api.md](references/rest-api.md) — if the `API` scope is in play
- [references/host-behavior.md](references/host-behavior.md) — when something behaves impossibly

Then apply [the rules that decide whether this works](#the-rules-that-decide-whether-it-works) below.

Keep the placeholder icons only if the user has nothing better; mention that they are placeholders.

### 5. Build

```sh
cd <target> && npm install && npm run build
```

Check the exit code directly rather than reading piped output — a pipeline into `tail` or `grep` reports the exit status of the last command, which will happily look like success while webpack failed. On a TypeScript error webpack writes no `dist` at all, so a missing `dist/plugin.zip` means the build did not succeed, whatever the text said.

Common failures: a `const enum` from the SDK assigned as a bare string (use `ButtonSize.normal`, not `"normal"`), or a required item field missing.

### 6. Validate — this is the step that matters

```sh
node "$SKILL/scripts/validate-plugin.mjs" <target> --invoke
```

This loads the built bundle in a sandbox, runs `onLoadCallback`, and checks what the portal would check: that registration matches the manifest, that every declared scope actually filled its map, that item fields and filter field names are right, and that each action carries its payload. `--invoke` additionally calls the callbacks with a dummy id.

Iterate until it reports zero errors. Warnings are worth reading but not always worth acting on.

The validator checks the plugin's **contract with the portal**, not whether the feature is right. Nothing here verifies that a threshold highlights the correct rows or that a parser handles the input you expect. Where the logic is worth checking, a short sandbox script that loads `dist/plugin.js` and calls the callbacks with stub data is a reasonable addition — just do not rebuild the contract checks the validator already performs.

Never edit anything under `dist/` to make it pass — that directory is regenerated by every build.

### 7. Report

Tell the user, concisely:

- where the archive is (`<target>/dist/plugin.zip`);
- what it does and where it will appear in the interface;
- anything left as a placeholder — icons especially;
- how to install: upload the zip in Settings → Integration → Plugins, then **fully reload the page**. If that page offers no upload control, or nothing happens after installing, the portal has the plugin system switched off — see [references/host-behavior.md](references/host-behavior.md);
- that `version` in `package.json` must be bumped before every re-upload, because the portal serves the cached bundle otherwise, and icons are cached by version too.

If they asked for something a released portal cannot do, say so here rather than burying it.

---

## Audit

Most broken DocSpace plugins are not broken in a way you can see by reading them. The code looks right, TypeScript is happy, the build succeeds — and the portal silently ignores it, because the loader's expectations are not expressed in the type system.

So run the mechanical checks first, then read the source for the things a script cannot judge.

One cause outranks all of them and costs one question: **is the plugin system switched on for that portal?** It is off by default, and when it is off nothing loads at all — no iframe, no bundle request, no console output — however correct the plugin is. Installation can also be disabled separately, which looks like a broken archive. Ask before auditing code; [references/host-behavior.md](references/host-behavior.md) has both switches.

### 1. Locate and build

Find the project: a `package.json` containing `pluginName`. A plugin project is never inside the DocSpace client repository — if you are in one and no path was given, ask which directory to look at.

The runtime checks need a current build. If `dist/plugin.zip` is missing or older than `src/`, rebuild:

```sh
cd <plugin-dir> && npm install && npm run build
```

Check the exit code itself, not piped output. If the build fails, that is the finding — report it with the compiler error and stop; everything downstream is meaningless.

### 2. Run the validator

```sh
node "$SKILL/scripts/validate-plugin.mjs" <plugin-dir> --invoke
```

It loads the bundle in a sandbox, runs `onLoadCallback`, and compares the result against what the portal expects. What each class of finding means:

| Code | What went wrong |
|---|---|
| `registration` | `window.Plugins.X` does not match `pluginName` — the plugin installs and does nothing whatsoever |
| `scope` | a scope is declared but its getter is missing, or no item is ever added to its map |
| `item` | a required field is missing, the user-type filter uses the wrong name for that scope, or a filter value is not one the host recognises |
| `message` | a returned action has no matching payload field, so the click is dead — or a modal is missing one of the three the host cannot open it without: `onLoad`, `onClose`, `dialogBody` |
| `component` | a node in a declarative tree is missing a prop it cannot render without, which throws during render and takes the portal down with it |
| `icon` / `assets` | an icon string does not resolve to a file in `assets/`, or the limits are exceeded |
| `config` | the packed `config.json` disagrees with `package.json` |
| `runtime` | the bundle or `onLoadCallback` threw, or a scope's map came back empty |
| `sdk-drift` | the SDK the project installed has moved past what this tool knows about — see step 4 |

A `runtime` error saying the bundle threw is worth reading closely: the portal awaits `onLoadCallback` during installation, so a throw there leaves no CSS, no items and an empty console — the symptom the user reports as "it installs and nothing happens". The validator only softens this to a warning when the cause is a browser API the sandbox does not stub, which it says explicitly.

A registration mismatch masks everything behind it: with the wrong name the sandbox finds no plugin object, so no item, filter or payload can be inspected. When that is the finding, copy the project to a scratch directory, correct **only** the registration line there, rebuild and validate the copy. That second run is where the remaining defects surface. Leave the audited project untouched.

### 3. Read the source for what the script cannot see

The validator checks shape. These need judgement — read [references/host-behavior.md](references/host-behavior.md) alongside:

- **Registration timing.** Module-scope registration is legitimate — official plugins do it and the maps are read afterwards — so do not report it as a defect on its own. It *is* a defect when the item factory depends on something set later: the language and the API URLs arrive after the bundle runs but before `onLoadCallback`, so labels registered at module scope stay untranslated and `getAPI()` returns empty strings. Items added after `onLoadCallback` resolves (from a timer, or an un-awaited promise) really are invisible until an explicit update action.
- **Error handling.** No portal code wraps plugin callbacks. An unhandled rejection is a dead click; a throw during render replaces the entire portal with an error screen. Every callback that fetches or parses needs its own `try/catch`.
- **Work in `onLoadCallback`.** Fetching there delays installation and, on a throw, aborts it silently with no CSS and no items. It belongs in the item's `onLoad`.
- **`updateProps` / `updateContext` from the wrong place.** These only work from elements inside a rendered plugin tree. Returned from a context-menu or main-button callback, `updateProps` does nothing and `updateContext` throws.
- **Settings read too early.** Stored settings arrive via `setAdminPluginSettingsValue` *after* installation, so reading them during `onLoadCallback` yields nothing. Parsing them without `try/catch` breaks installation on a malformed value.
- **Blocking work.** The plugin shares the portal's event loop; a synchronous loop freezes the UI.
- **Unscoped CSS and third-party origins.** A stylesheet is injected into the portal's own document unscoped; `cspDomains` widens the whole portal's CSP. Note that `scpDomains` is a real typo found in shipped plugins — it silently does nothing.

### 4. Check for drift

- **SDK version.** The validator already compares the installed SDK against the contract and reports `sdk-drift` when they diverge, so read that finding rather than checking by hand. It means this tool's tables have aged, not that the plugin is broken — but a plugin built against an SDK ahead of the portal is worth a word, because the extra scopes and actions compile and then do nothing. [references/sdk-target.md](references/sdk-target.md) has the supported pair.
- **Dead build script.** `webpack && node ./scripts/createZip.js` is the pre-2.0 form and no longer works. It should be `webpack && npx build-docspace-plugin`.
- **Deprecated members.** `IContextMenuItem.onClick` and `IMainButtonItem.onClick` are superseded by `onItemClick`; `ISeparatorItem` is gone entirely. (`IProfileMenuItem.onClick` is *not* deprecated — that scope has no alternative.)
- **`runtime: "react"`.** Not supported by any released loader; such a bundle renders nothing.

### 5. Report

Group findings so the user knows what to fix first:

1. **Silent breakage** — works in principle, does nothing on the portal. Always first; this is what they came for.
2. **Wrong behaviour** — does something, but not what was intended.
3. **Fragility** — unhandled errors, blocking work, collision-prone keys.
4. **Hygiene** — stale SDK, deprecated members, missing version bump.

Cite `file:line` for each, and say what the user would actually observe — "the item never appears in the context menu" lands better than "scope contract violation".

If nothing is wrong, say so plainly and mention what you checked, so the result is trustworthy rather than merely reassuring.

### When asked to fix, not just audit

Apply the fixes, then close the loop properly:

1. Fix the findings, starting with silent breakage.
2. Bump `version` in `package.json` — without it the portal keeps serving the cached bundle and the user will conclude your fix did nothing.
3. Rebuild and re-validate until clean.
4. Report what changed and what you deliberately left alone.

Never edit `dist/` to make a check pass; it is regenerated on every build.

---

## Explain

Answer from the references rather than from memory. The SDK's own documentation is thin on the part that matters most — what the portal does with what you give it — and general knowledge about it is unreliable.

| Question is about | Read |
|---|---|
| Which scopes exist, what version to target, what is not yet supported | [references/sdk-target.md](references/sdk-target.md) |
| What the plugin class must implement; registration; localisation | [references/sdk-contract.md](references/sdk-contract.md) |
| Fields of a context menu / main button / file / info panel item | [references/items.md](references/items.md) |
| Building interfaces, components, modals, live updates | [references/ui-components.md](references/ui-components.md) |
| Why something silently fails; load order; limits; what breaks the portal | [references/host-behavior.md](references/host-behavior.md) |
| Calling the DocSpace REST API from a plugin | [references/rest-api.md](references/rest-api.md) |
| A worked example of a common pattern | [references/recipes.md](references/recipes.md) |

"Why doesn't my item appear?" is the most frequent question, and the answer is nearly always in the silent-failures table in `host-behavior.md`. Start there rather than reasoning it out.

Lead with the direct answer, then the reason it works that way — the reasoning is usually what lets someone solve the next problem themselves. A short code sample beats a paragraph describing one.

Be precise about versions, and answer from the reference files rather than from memory. Material circulating about the SDK describes scopes and interfaces that never shipped, and an unsupported feature described confidently costs someone a day. If you cannot point at the scope, interface, field or action in these references or in the installed SDK, say it is not supported on the target pair in `sdk-target.md` and name the closest thing that is.

When something is a portal quirk rather than a design decision, label it as such — for instance that the user-type filter field is `usersTypes` for some scopes and `usersType` for others, or that `updateProps` works only from inside a rendered plugin tree. Knowing which rules are principled and which are accidents helps people predict the rest.

---

## The rules that decide whether it works

These apply whether you are writing a plugin or judging one. They are the ones **no tool can catch for you** — the validator already reports an unfilled scope, an item key that is not namespaced, a dead enum value, a modal missing a mandatory callback and an action without its payload, and its message says what to do, so those are not repeated here. Nothing below leaves any trace at all.

- **Register items inside `onLoadCallback`.** Module-scope registration also reaches the portal in time, so this is not about visibility — it is that the language and the API URLs are only set *after* the bundle executes. An item factory that translates a label or calls `getAPI()` at module scope captures empty values.
- **Catch your own errors.** No portal code wraps plugin callbacks, and an exception during render takes down the whole page — not just your panel. Return an error toast instead.
- **Do not fetch in `onLoadCallback`.** It delays installing the plugin, and a throw there aborts it silently. Use the item's `onLoad` with a skeleton placeholder.
- **A menu item cannot update itself.** `updateProps`/`updateContext` only work from elements inside a rendered plugin tree. From a menu, open a modal and update from within it.
- **Bump `version` before every re-upload**, or the portal serves the cached bundle — including cached icons.
- **A bare modal caps at 280px and does not scroll.** Anything beyond ~three rows needs `autoMaxHeight: true` or `ModalDisplayType.aside`; a modal's `onLoad` must return header, body *and* footer, or the omitted sections vanish.
- **Colors come from theme variables** (`var(--text-color)`, `var(--input-error-color)`, `var(--accent-main)`), never hardcoded hex — hardcoded values break in the other theme and on re-branded portals. The token table is in [references/ui-components.md](references/ui-components.md).
