---
name: plugin-sdk
description: Build, audit and explain ONLYOFFICE Apps (formerly DocSpace) plugins made with the Plugins SDK. Use whenever someone wants to create, extend or change an ONLYOFFICE Apps plugin, or describes a feature inside the portal without naming the SDK — an item in the context menu, main button or profile menu, a page in the sidebar, a tab in the info panel, a handler for a custom file type, a reaction to a portal event, an admin settings form ("a button in ONLYOFFICE Apps that converts a file", "a screen inside ONLYOFFICE Apps listing our rooms"). Use it too when a plugin installs but does nothing, renders blank, shows for the wrong users or does not change after a re-upload; when someone asks to review, debug, fix or migrate an existing plugin; and for questions about scopes, hooks, items, actions or how the portal loads plugins. Not for plugins inside the document editor (ONLYOFFICE Docs plugins and macros), for embedding ONLYOFFICE Apps into another site (embed-sdk), or for standalone REST API scripts.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
  sdk-version: "3.0.0"
  docspace-version: "4.0"
---

# ONLYOFFICE Apps plugins

Three jobs: **building** a plugin, **auditing** one that misbehaves, **explaining** how the SDK and the portal work.

A plugin has two halves. A **class** registers items — a context menu entry, a sidebar page, an info panel tab — and answers the portal's loader. Every visible surface is a **React component** built from the portal's own `@docspace/ui-kit`, rendered by the portal inside its own React tree, with the plugin runtime reachable through hooks. The portal supplies React and the kit at load time; the plugin ships only its own code as an ES module.

The difficulty in all three jobs is the same: ONLYOFFICE Apps reports almost nothing about a plugin once it has loaded. A bundle that fails to load, or whose `onLoadCallback` throws, is at least flagged to the administrator on the plugin's card; past that point a scope declared and never filled, an action returned without its payload, a role filter under the field name another scope reads — each installs and enables cleanly, and then the item never appears, the click does nothing, or the filter is skipped and everyone sees the item, with at most one line in the console. The tooling here catches that before anything reaches a portal.

## Toolkit and references

`$SKILL` is the directory containing this file (`<repo>/skills/plugin-sdk`, or `${CLAUDE_PLUGIN_ROOT}/skills/plugin-sdk` when installed as a Claude Code plugin). Resolve it to an absolute path once. Everything runs on Node alone — no portal, and no network except `npm install` in the generated project and, for the browser pass only, Playwright's own Chromium download; without it that one step reports `preview skipped` and the rest still runs ([build.md](references/build.md#7-see-it--the-step-that-catches-what-looks-broken)).

```
$SKILL/scripts/generate-plugin.mjs   scaffold a project        $SKILL/scripts/validate-plugin.mjs   check one against the loader
$SKILL/scripts/preview-plugin.mjs    render it in a browser and measure the surfaces
$SKILL/references/                   the knowledge base — read these instead of recalling
```

| Question | Read |
|---|---|
| The build workflow — scaffold, write, build, validate, preview, report | [build.md](references/build.md) |
| The audit workflow — the switches, both passes, what to read for, how to report | [audit.md](references/audit.md) |
| Which scopes exist, what version to target, what is not supported | [plugins/scopes.md](references/plugins/scopes.md) |
| What the class implements, how the portal gets it, localisation, deprecated members | [plugins/plugin.md](references/plugins/plugin.md) |
| One scope — its filter field, where it renders, what the host does with its fields | its page, linked from [Pick scopes](#pick-scopes); what every item shares — keys, role and device filters, `UsersType` — in [items/common-fields.md](references/items/common-fields.md) |
| How and where a component renders, errors, loading, language | [react/rendering.md](references/react/rendering.md) |
| The hooks, and what `useCurrentFile` returns where | [react/hooks.md](references/react/hooks.md) |
| Actions and their payloads, the paths `navigate` takes, opening a document, which action works from which callback | [react/actions.md](references/react/actions.md) |
| The API client in a component | [react/api.md](references/react/api.md) |
| Any surface the **host** draws | [a modal or aside](references/components/modal-dialog.md) · [a file/room/people picker, and sequencing one against a modal](references/components/selector.md) · [the create-file dialog](references/components/create-dialog.md) · [the media viewer](references/components/media-viewer.md) · [the progress button, and work that takes longer than a second](references/components/floating-operations-button.md) |
| The five specifiers the portal provides, and why the bundle is one file | [bundling.md](references/bundling.md) |
| Kit conventions, the layout mechanics of its wrappers, the behavioural traps its types do not state, icons | [ui-kit.md](references/ui-kit.md) |
| Anything visual that is not a kit prop: theme variables, the type scale and spacing, scoping a stylesheet, which rules win | [styles.md](references/styles.md) |
| Whether to take a third-party package, which one, and what it leaves unhandled | [dependencies.md](references/dependencies.md) |
| Load order, the silent-failure tables, what breaks the portal, limits | [portal.md](references/portal.md) |
| Calling the REST API from a component and from the class, file bytes, uploads, `cspDomains` | [rest-api.md](references/rest-api.md) |
| Reading an SDK 2 plugin (declarative trees) | [sdk-2-plugins.md](references/sdk-2-plugins.md) |
| A signature, a prop list, an enum's values, a method's parameters | the docs page linked from the reference — start at the [interfaces](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins.md) or the [React runtime](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/react.md) |

**Sources, and which one wins.** Each answers a different question; when two disagree, say so instead of switching between them.

1. **The installed types** — the `.d.ts` of `@onlyoffice/docspace-plugin-sdk` and `@docspace/ui-kit` in `node_modules`: the exact contract of what the project builds against, so they win on **names, fields and signatures**. The kit has no docs site; `node_modules/@docspace/ui-kit/dist/types` is all there is for its props.
2. **The [Plugins SDK docs](https://api.onlyoffice.com/docspace/plugins-sdk/get-started.md)** — signatures, props, enum values and method lists, which the references do not repeat. The generated reference is under `usage-sdk/coding-plugin/`: `interfaces/{plugins|items|components|settings}/<Name>` (an interface's name is its page: `interfaces/items/IContextMenuItem`), `react/{hooks|actions|api|settings|runtime}`, and `enums/<file>`, where an enum sits on the page of its source file (`FilterType` on `enums/Utility`). **Read pages as Markdown**: put `.md` in place of the page URL's trailing slash. [`llms.txt`](https://api.onlyoffice.com/docspace/plugins-sdk/llms.txt) lists every page of the section with a line each — look an enum or an unfamiliar name up there. The guides (`get-started`, the prose `usage-sdk/*` pages, `samples/*`) still describe SDK 2 — webpack, `window.Plugins`, no `ArticleNavigation` — so never build from them. Endpoints: the [REST API reference](https://api.onlyoffice.com/docspace/api-backend/get-started/basic-concepts.md), one page per operation.
3. **These references** — what the portal does with what the types allow: the traps and silent failures neither of the above states. They win on **behaviour**: where a JSDoc line or a docs page says what the portal does — a default, a fallback, when something closes — and a reference says otherwise, the reference is what the portal was observed to do. A page under `plugins/`, `items/`, `components/` or `react/` is named after the SDK type it describes, without the `I`, in kebab-case, and its card links that type's docs page: `dist/interfaces/items/IInfoPanelItem.d.ts` → `references/items/info-panel-item.md`.

## Which job is this

| The person wants | Do |
|---|---|
| A plugin that does not exist yet, or a feature added to one that does | Follow [build.md](references/build.md), all eight steps, ending in a validated `dist/plugin.zip` |
| To know why an existing plugin misbehaves, or to have it fixed | Follow [audit.md](references/audit.md): ask about the switches, run both passes, then read |
| An explanation rather than a project | [Explain](#explain), below |
| "An ONLYOFFICE plugin", with nothing saying portal or editor | Ask which before anything else — a feature inside an open document is an ONLYOFFICE Docs plugin, a different product |

A question that turns out to need a whole feature is better answered by building it than by pasting a sketch that has never compiled.

## Pick scopes

| They want | Scope | Visible surface |
|---|---|---|
| A whole screen of their own — a dashboard, a list, a workspace | [`ArticleNavigation`](references/items/article-navigation-item.md) | a full page, `component` |
| An action on a selected file, folder or room | [`ContextMenu`](references/items/context-menu-item.md) | none, or a modal it opens |
| A "create new…" entry | [`MainButton`](references/items/main-button-item.md) | none, or a dialog it opens |
| An entry point in the user's own profile menu | [`ProfileMenu`](references/items/profile-menu-item.md) | none — one item; what its click opens is up to you |
| Information about a file or room, alongside it | [`InfoPanel`](references/items/info-panel-item.md) | a tab, `component` |
| To own a file extension — icon, open action | [`File`](references/items/file-item.md) | none, or a viewer/modal it opens |
| To react when the user starts a portal action — a create, rename, room or user-type dialog opening, a column toggled; it fires before anything exists and carries no data | [`EventListener`](references/items/event-listener-item.md) | none |
| A small persistent control in the sidebar | [`ArticleButton`](references/items/article-button-item.md) | a 32×32 slot, `component` |
| Admin-configurable options | [`Settings`](references/plugins/settings-plugin.md) | the settings aside, `component` |
| Class-side code that calls the REST API | [`API`](references/plugins/api-plugin.md) | — (a component needs no scope for this) |
| To embed a third-party page and talk to it | [`PostMessage`](references/plugins/post-message-plugin.md) | — |

The official one-line description of each scope is in [Creating plugin template](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/creating-plugin-template.md) — a page that predates `ArticleNavigation`, so it lists ten; the table above maps features to them. That table is the whole list — never invent a scope, hook or field; a feature *inside* an open document is an ONLYOFFICE Docs plugin, a different product. Where a feature is reached from (`ContextMenu`, `MainButton`, `ProfileMenu` contribute an item and nothing else) and where it renders are two separate questions, and a screen's worth of content is an `ArticleNavigation` page, not a modal or a tab — the reasoning is in [build.md → 2. Pick scopes](references/build.md#2-pick-scopes).

## Explain

Answer from the references and the documentation pages they link, not from memory — the docs say what compiles, the references say what the portal does with it, and material circulating about the SDK describes scopes, hooks and interfaces that never shipped. If you cannot point at the scope, interface, hook, field or action in the references, the docs or the installed SDK, say it is not supported on the target pair and name the closest thing that is.

"Why doesn't my item appear?" and "why is my page blank?" are the most frequent questions. When the plugin may not have loaded at all, first ask what its card in Settings → Integration → Plugins says — a plugin that failed to load or initialize is flagged there with the portal's own reason ([portal.md → When loading fails](references/portal.md#when-loading-fails)). One that loaded fails silently, and the answer is nearly always in the silent-failures tables in [portal.md](references/portal.md#silent-failures). Give the direct answer, then the reason — and label portal quirks as quirks (the filter field is `usersTypes` for some scopes and `usersType` for others; a modal opened from a menu has no current file), so people can tell principle from accident.

## The rules that decide whether it works

They apply whether writing or judging, and **no tool catches most of them**. The validator reports an unfilled scope, a missing default export, a foreign import, a bundled React, a JSX element where a component was expected, a role filter under the wrong field name or with a value the enum lacks, an item key without the manifest prefix, a plain stylesheet, a locale table under a tag the portal never sends and a component that throws while rendering — and, with `--invoke`, a hook in a class-side callback and an action without its payload. The rest survives every check — an effect without a `catch`, work in `onLoadCallback`, a settings page that never calls `setSaveButton` — and is yours to get right; each line links to the passage that explains it.

- **Components get no props.** `useCurrentFile()` is the selection in an info panel tab or the media viewer, and `null` on a page, in settings and in a modal opened from a class-side click — there, hand the id over through a module variable or a factory closure ([hooks.md](references/react/hooks.md#what-usecurrentfile-returns-where)).
- **Register items inside `onLoadCallback`, built by factory functions** — at module scope the language and API URLs are not set yet ([portal.md](references/portal.md#the-loading-sequence)).
- **Fetch in effects, with a cleanup and a `catch`; never in `onLoadCallback`** — a rejected request without a `catch` leaves the component on its skeleton for good ([rendering.md](references/react/rendering.md#errors-loading-language-styling)).
- **Class-side callbacks catch their own errors and return a toast** — nothing wraps `onItemClick`, `onClick` or `eventHandler`, and the create dialog's `onSave` swallows a throw unless it has an `onError` ([plugin.md](references/plugins/plugin.md#two-kinds-of-callback)).
- **A React settings page wires Save through `setSaveButton`** in an effect that re-runs when the form changes; `isDisabled` and `hasError` gate on what the user changed, not on validity alone, and `onClick` catches and returns a success or failure toast, since nothing else reports the save ([settings-plugin.md](references/plugins/settings-plugin.md#the-settings-client)).
- **Changing an item from a component is two steps:** mutate the map through the plugin instance, then call the matching `update*Items()` ([actions.md](references/react/actions.md#changing-an-item-from-a-component)).
- **A React modal has no footer and a 400×280 cap** — action row in the body; `autoMaxHeight`/`autoMaxWidth` or an aside for more, and a long aside scrolls only where you give it the region; a screen is an `ArticleNavigation` page ([modal-dialog.md](references/components/modal-dialog.md)).
- **Hand a kit component one element carrying your own layout, never a fragment** — its wrapper is a flex row and several blocks line up side by side ([ui-kit.md](references/ui-kit.md#layout-conventions)).
- **One portal-drawn surface at a time** — close the dialog, open the selector, reopen from submit *and* cancel, form values in module scope ([selector.md](references/components/selector.md#from-a-dialog-one-surface-at-a-time)).
- **Long work reports through the floating operations button** — from the class via the dispatcher its `onLoad` hands over when there is nothing to show, from an effect that aborts in its cleanup when there is — or, for work that writes, keeps a module-scope start flag instead ([floating-operations-button.md](references/components/floating-operations-button.md#work-that-takes-a-while)).
- **A progress entry ends on `operationsCompleted`**, not on the operation's own `completed` ([floating-operations-button.md](references/components/floating-operations-button.md)).
- **A room link carries the id twice** — `/rooms/shared/{id}/filter?folder={id}`; a document is `window.open("/doceditor?fileId=…")`, never `navigate(webUrl)` ([actions.md](references/react/actions.md#paths-navigate-takes)).
- **Ids travel as they arrived, `string | number`** — a stringified portal id in a JSON body fails as "no permission" ([rest-api.md](references/rest-api.md#identifiers)).
- **Files selector: gate Select on `selectedItemId` (the folder), check `selectedFileInfo` in `onSubmit`** ([selector.md](references/components/selector.md#the-files-selector-folder-vs-file)).
- **Every enum-valued string comes from the enum** — `PluginLocale.JA_JP`, not `"ja"`; a near-miss compiles and is never matched ([plugin.md](references/plugins/plugin.md#localisation)).
- **The role filter is `usersTypes` for ContextMenu, InfoPanel, EventListener, ArticleButton, ArticleNavigation and `usersType` for MainButton, ProfileMenu, File** — the wrong one is skipped in silence ([common-fields.md](references/items/common-fields.md#the-filter-field-trap)). Its values do not read as the portal's roles: `UsersType.user` is Guest, `collaborator` is User, and no member implies another, so `[UsersType.roomAdmin]` alone hides the item from the owner and full admins ([common-fields.md](references/items/common-fields.md#userstype-does-not-name-the-roles-the-portal-shows)).
- **Item keys are prefixed with the manifest `name`, verbatim** — the maps are portal-wide. A `File` item is the exception: its key is its extension, dot included, or its click falls through to the portal's own ([common-fields.md](references/items/common-fields.md#item-keys-are-portal-wide)).
- **A stylesheet is a `.module.css`** — `plugin.css` lands in the portal's own head ([styles.md](references/styles.md#scoped-css)).
- **Colors come from the theme variables**, and a kit `color` prop takes a CSS value — `var(--accent-main)`, not `"accent"` ([styles.md](references/styles.md#colors)).
- **Every re-upload needs a new `version`** — the portal caches the bundle and the icons by it; bump the moment you start editing an installed plugin ([portal.md](references/portal.md#silent-failures)).
