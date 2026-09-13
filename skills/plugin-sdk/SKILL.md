---
name: plugin-sdk
description: Build, audit and explain ONLYOFFICE DocSpace (ONLYOFFICE Apps) plugins made with the Plugins SDK. Use whenever someone wants to create, scaffold, extend or change a DocSpace plugin, or describes a feature inside the portal without naming the SDK, React or the UI kit — an item in the context menu, main button or profile menu, a page in the sidebar, a tab in the info panel, a handler for a custom file type, a reaction to a portal event, an admin settings form ("a button in DocSpace that converts a file", "a screen inside DocSpace listing our rooms"). Use it too when a plugin installs but does nothing, renders blank, shows for the wrong users or does not change after a re-upload; when someone asks to review, debug, fix or migrate an existing plugin; and for questions about scopes, hooks, items, actions or how the portal loads plugins. Not for plugins inside the document editor (ONLYOFFICE Docs plugins and macros), for embedding DocSpace into another site (embed-sdk), or for standalone REST API scripts.
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
$SKILL/scripts/preview-plugin.mjs    render it in a browser and measure the surfaces
$SKILL/references/                   the knowledge base — read these instead of recalling
```

| Question | Read |
|---|---|
| The build workflow — scaffold, write, build, validate, preview, report | [build.md](references/build.md) |
| The audit workflow — the switches, both passes, what to read for, how to report | [audit.md](references/audit.md) |
| Which scopes exist, what version to target, what is not supported | [scopes.md](references/scopes.md) |
| What the class implements, how the portal gets it, localisation, deprecated members | [sdk-contract.md](references/sdk-contract.md) |
| Fields of each item type, which filter field the host reads, where each item renders | [items.md](references/items.md) |
| Where a component renders and what it can reach: hooks, what `useCurrentFile` returns where, actions, the API and settings clients, errors and loading, the six specifiers | [react.md](references/react.md) |
| Any surface the **host** draws — a modal or aside, a file/room/people picker and how to sequence one against a modal, the create-file dialog, the media viewer, the progress button, work that takes longer than a second | [components.md](references/components.md) |
| Kit conventions, the layout mechanics of its wrappers, the behavioural traps its types do not state, icons | [ui-kit.md](references/ui-kit.md) |
| Anything visual that is not a kit prop: theme variables, the type scale and spacing, scoping a stylesheet, which rules win | [styles.md](references/styles.md) |
| Whether to take a third-party package, which one, and what it leaves unhandled | [dependencies.md](references/dependencies.md) |
| Load order, the silent-failure tables, what breaks the portal, limits | [portal.md](references/portal.md) |
| Calling the REST API from a component and from the class, file bytes, uploads, `cspDomains` | [rest-api.md](references/rest-api.md) |
| Reading an SDK 2 plugin (declarative trees) | [sdk-2-plugins.md](references/sdk-2-plugins.md) |

Kit component props are in the installed package's `.d.ts` files (`node_modules/@docspace/ui-kit/dist/types`); SDK interfaces in `@onlyoffice/docspace-plugin-sdk`'s. Read those for signatures; the references cover what the types do not say.

## Which job is this

| The person wants | Do |
|---|---|
| A plugin that does not exist yet, or a feature added to one that does | Follow [build.md](references/build.md), all eight steps, ending in a validated `dist/plugin.zip` |
| To know why an existing plugin misbehaves, or to have it fixed | Follow [audit.md](references/audit.md): ask about the switches, run both passes, then read |
| An explanation rather than a project | [Explain](#explain), below |

A question that turns out to need a whole feature is better answered by building it than by pasting a sketch that has never compiled.

## Pick scopes

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

That table is the whole list — never invent a scope, hook or field; a feature *inside* an open document is an ONLYOFFICE Docs plugin, a different product. Where a feature is reached from (`ContextMenu`, `MainButton`, `ProfileMenu` contribute an item and nothing else) and where it renders are two separate questions, and a screen's worth of content is an `ArticleNavigation` page, not a modal or a tab — the reasoning is in [build.md → 2. Pick scopes](references/build.md#2-pick-scopes).

## Explain

Answer from the references, not from memory — the SDK's own documentation is thin on what the portal does with what you give it, and material circulating about the SDK describes scopes, hooks and interfaces that never shipped. If you cannot point at the scope, interface, hook, field or action in the references or the installed SDK, say it is not supported on the target pair and name the closest thing that is.

"Why doesn't my item appear?" and "why is my page blank?" are the most frequent questions; the answers are nearly always in the silent-failures tables in [portal.md](references/portal.md#silent-failures). Start there. Give the direct answer, then the reason — and label portal quirks as quirks (the filter field is `usersTypes` for some scopes and `usersType` for others; a modal opened from a menu has no current file), so people can tell principle from accident.

## The rules that decide whether it works

They apply whether writing or judging. The validator already reports an unfilled scope, a missing default export, a foreign import, a bundled React, a JSX element where a component was expected, a hook in a class-side callback, an action without its payload, a locale table under a tag the portal never sends, and a component that throws while rendering. Everything below that survives a render is yours to get right; each line links to the passage that explains it.

- **Components get no props.** `useCurrentFile()` is `null` on a page, in settings and in a modal opened from a class-side click — hand the id over through a module variable or a factory closure ([react.md](references/react.md#what-usecurrentfile-returns-where)).
- **Register items inside `onLoadCallback`, built by factory functions** — at module scope the language and API URLs are not set yet ([portal.md](references/portal.md#the-loading-sequence)).
- **Fetch in effects, with a cleanup and a `catch`; never in `onLoadCallback`** — an uncaught throw renders the component as nothing ([react.md](references/react.md#errors-loading-language-styling)).
- **Class-side callbacks catch their own errors and return a toast** — nothing wraps `onItemClick`, `onClick`, `eventHandler` or `onSave` ([sdk-contract.md](references/sdk-contract.md#two-kinds-of-callback)).
- **A React settings page wires Save through `setSaveButton`** in an effect that re-runs when the form changes; `isDisabled` and `hasError` gate on what the user changed, not on validity alone ([react.md](references/react.md#the-settings-client)).
- **Changing an item from a component is two steps:** mutate the map through the plugin instance, then call the matching `update*Items()` ([react.md](references/react.md#actions)).
- **A React modal has no footer and a 400×280 cap** — action row in the body; `autoMaxHeight`/`autoMaxWidth` or an aside for more; a screen is an `ArticleNavigation` page ([components.md](references/components.md#modals)).
- **Hand a kit component one element carrying your own layout, never a fragment** — its wrapper is a flex row and several blocks line up side by side ([ui-kit.md](references/ui-kit.md#layout-conventions)).
- **One portal-drawn surface at a time** — close the dialog, open the selector, reopen from submit *and* cancel, form values in module scope ([components.md](references/components.md#selectors)).
- **Long work reports through the floating operations button** — from the class via the dispatcher its `onLoad` hands over when there is nothing to show, from an effect behind a start guard when there is ([components.md](references/components.md#work-that-takes-a-while)).
- **A progress entry ends on `operationsCompleted`**, not on the operation's own `completed` ([components.md](references/components.md#the-floating-operations-button)).
- **A room link carries the id twice** — `/rooms/shared/{id}/filter?folder={id}`; a document is `window.open("/doceditor?fileId=…")`, never `navigate(webUrl)` ([react.md](references/react.md#paths-navigate-takes)).
- **Ids travel as they arrived, `string | number`** — a stringified portal id in a JSON body fails as "no permission" ([rest-api.md](references/rest-api.md#identifiers)).
- **Files selector: gate Select on `selectedItemId` (the folder), check `selectedFileInfo` in `onSubmit`** ([components.md](references/components.md#the-files-selector-folder-vs-file)).
- **Every enum-valued string comes from the enum** — `PluginLocale.JA_JP`, not `"ja"`; a near-miss compiles and is never matched ([sdk-contract.md](references/sdk-contract.md#localisation)).
- **The role filter is `usersTypes` for ContextMenu, InfoPanel, EventListener, ArticleButton, ArticleNavigation and `usersType` for MainButton, ProfileMenu, File** — the wrong one is skipped in silence ([portal.md](references/portal.md#the-filter-field-trap)).
- **Item keys are prefixed with the manifest `name`, verbatim** — the maps are portal-wide ([portal.md](references/portal.md#item-keys-are-portal-wide)).
- **A stylesheet is a `.module.css`** — `plugin.css` lands in the portal's own head ([styles.md](references/styles.md#scoped-css)).
- **Colors come from the theme variables**, and a kit `color` prop takes a CSS value — `var(--accent-main)`, not `"accent"` ([styles.md](references/styles.md#colors)).
- **Every re-upload needs a new `version`** — the portal caches the bundle and the icons by it; bump the moment you start editing an installed plugin ([portal.md](references/portal.md#silent-failures)).
