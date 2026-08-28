# How the portal loads and runs a plugin

What the loader actually does with a plugin — not what the types allow — and therefore why a plugin can install cleanly and do nothing. Observed in the DocSpace client this skill targets.

## Before anything loads: the switches

- **`plugins.enabled`** (server setting, **off by default**). When false the portal never initialises plugins: no bundle fetched, no items, no routes, nothing in the console. Every surface re-checks it. Ask about this before auditing code.
- **`pluginOptions.upload` / `pluginOptions.delete`** — a second, narrower switch *behind* the first, not beside it: the Integration → Plugins tab exists only when `plugins.enabled`, and these are read only on that tab. With `upload` off it offers no upload control, however correct the archive.
- The plugin system is skipped when the portal's **paid period has expired**, and plugin surfaces are suppressed inside the **AI-agent/chat views**.

## The loading sequence

Module plugins (`"runtime": "module"` in the packed `config.json` — everything built with SDK 3):

1. `GET plugin.js` as text. Every bare-specifier import is rewritten to the portal's copy — for exactly the six specifiers in [react.md → Bundling](react.md#bundling). Any other bare specifier **aborts the load** with a console error naming it.
2. `import()` as a blob URL; the default export is the plugin. Module-scope code runs here.
3. The manifest record is `Object.assign`ed **onto** the plugin object — `name`, `version`, `scopes`, `url`, `enabled`, `settings`, `image`, `description`, … — overwriting your same-named fields.
4. `setLanguage(locale)` — the `LANGUAGE` cookie, falling back to the portal's own `culture` when the cookie is unset.
5. If declared: `setAPI(origin, proxy, prefix)`.
6. `await plugin.onLoadCallback()`.
7. `getStatus()`; `hide` stops the sequence.
8. `plugin.css`, if packed, is linked into the **main** document's head as `<link id="plugin-styles-<pluginName>">`.
9. Every declared scope's getter is read and the items copied into portal-wide maps, filtered by `usersTypes`/`usersType` and `devices` for the current user and device.
10. Settings scope: `setAdminPluginSettingsValue(storedSettingsString)`.

Legacy plugins (no `runtime`; webpack, SDK ≤ 2) run from step 4 on, but the bundle is injected as a `<script>` into one hidden `<iframe id="plugin-iframe">` shared by all plugins, and the plugin is `iframeWindow.Plugins[pluginName]` — a mismatch yields an empty plugin with no error.

Consequences:

- **An ES module without `"runtime": "module"`** is injected as a classic script and dies on its first `import`.
- **Register items in `onLoadCallback`, not at module scope.** Both reach the maps in time (they are read at step 9), but at module scope neither the language nor the API URLs are set yet — a factory that translates a label or calls `getAPI()` there captures empty values.
- **Anything registered after step 9 is invisible** until the matching `update*Items` action — items added from a timer or an un-awaited promise.
- **Stored settings do not wait for `onLoadCallback` to finish.** For a module plugin the loader calls `installPlugin()` — which is what awaits `onLoadCallback` — **without awaiting it**, then calls `setAdminPluginSettingsValue` immediately. So the value lands after the synchronous prefix of `onLoadCallback` and before anything after its first `await`: step 10 happens *inside* step 6. Do not read a settings value in `onLoadCallback` and do not order the two; components read settings with `usePluginSettings().load()`, class-side code reacts in `setAdminPluginSettingsValue`. (The legacy non-module path does await, and there the order is as numbered.)
- **Disabled plugins are still fetched and executed**, so module-scope side effects run even when switched off.
- **Enable/disable is live** (a `change-web-plugin` socket room): items appear or vanish in every open session without a reload; on re-enable the bundle is not re-fetched, so module-scope state survives while `onLoadCallback` runs again.

### Manifest fields the portal reads for itself

- `runtime` — only `"module"` is known.
- `minDocSpaceVersion` — written into `config.json` by the packer from the **installed SDK's** `package.json`; setting it in your own `package.json` does nothing. It only produces a compatibility warning, never blocks loading.
- `nameLocale` / `descriptionLocale` — `{ "ru": "…", "en-US": "…" }`, used for the plugin list only; item labels you localise yourself.
- `cssUrl` — points at `plugin.css`; re-installing updates the `<link>` in place, disabling removes it. CSS is the one thing torn down on disable — script side effects are not.

## Silent failures

None of these produce an error the user sees; most leave nothing in the console.

| Symptom | Cause |
|---|---|
| Nothing loads at all: no bundle request, no console output | `plugins.enabled` is off, or the paid period expired |
| Installs, enables, does nothing; console `Failed to load module plugin` | the bundle imports a package the portal does not provide — a library that should have been bundled, the SDK **root** marked external, a `@docspace/ui-kit/…` subpath |
| Same; console `Cannot use import statement outside a module` | an ES module bundle with no `"runtime": "module"` |
| Same; console clean | (module) no default export — still assigning `window.Plugins.X`; (legacy) `window.Plugins.X` ≠ `pluginName` |
| Installation stops halfway; no CSS, no items | `getStatus()` returned `hide`, or `onLoadCallback` threw |
| One scope is dead, others work | scope declared but its getter is missing, or `add*Item` never called |
| A tab, page or modal opens **blank**; console `[Plugin: name] …` | the component threw — swallowed by the error boundary. Usually an unguarded fetch/parse, a conditional hook, or a bundled React (next row) |
| Every component blank; `usePluginRuntime must be used inside a plugin component` | a second React or SDK React entry in the bundle — fix the `external` list |
| Components render light and LTR on a dark/RTL portal | a bundled `@docspace/ui-kit` |
| A hook "throws outside a component" from a click | hooks called in a class-side callback |
| Filter by user role ignored | wrong field name — see [the filter field trap](#the-filter-field-trap) |
| Item renders, click does nothing | the returned action has no matching payload field ([react.md → Actions](react.md#actions)) |
| Items appear only after a manual refresh | registered after `onLoadCallback` resolved |
| Re-upload changes nothing | `version` not bumped — the portal serves the cached bundle, icons are cached as `?hash=<version>`. Uploading a name+version that matches an installed plugin raises a cache-warning dialog |
| An item vanishes when an unrelated plugin is disabled | two plugins used the same item `key` |
| A sidebar page redirects to the root | the item's `appears` excludes the section the URL is under, or the key is unknown |
| A whole scope never appears | it exists in the installed SDK but not in this portal ([scopes.md](scopes.md)) |
| A modal opened from the context menu knows nothing about the file | `useCurrentFile()` is `null` there — hand the id over ([react.md](react.md#what-usecurrentfile-returns-where)) |
| The settings aside's Save button saves nothing | `usePluginSettings().setSaveButton(...)` never called |
| A class field holds the wrong value after load | it shares a name with a manifest field (`settings`, `name`, `version`, `url`, `enabled`, `image`, `description`) — overwritten in step 3 |
| Works everywhere except chat / AI-agent views | suppressed there by design |

### Silent failures in the UI layer

The plugin loaded and rendered, and what the user sees is still wrong. They read as styling bugs and are not; fixes in [ui-kit.md](ui-kit.md#behavioural-traps) and [react.md → Modals](react.md#modals).

| Symptom | Cause |
|---|---|
| The blocks of a surface sit **side by side**, vertically centred, instead of stacked — and controls inside them each break onto their own line | several children were handed to a kit component at once (a fragment as a tab's `content`, a dialog body, `children`); the box it wraps them in is a flex row. One root element, laid out by you ([ui-kit.md → Layout conventions](ui-kit.md#layout-conventions)) |
| The progress button **stays in the panel** after the job ended, still reading "…ing" | the last update set `operations[i].completed` but not **`operationsCompleted`** on the button props. The outer flag is what the portal watches; on it, the panel dismisses the button and clears the plugin's entries by itself ([react.md → Progress button](react.md#the-floating-operations-button)) |
| Clicking a room lands on the **rooms list**, and the address bar reads `/rooms/shared/undefined/filter?searchArea=…` | the link had no `?folder={id}`. The section tells one room from the list by the query, not the path, and then rewrote the address from its own state ([react.md → Paths navigate takes](react.md#paths-navigate-takes)) |
| A row action fires on a row it **cannot apply to** — archiving an archived room, restoring a live one | the action was gated on `security` alone. The portal uses two independent tests, and so must a plugin: `security.Move` answers "may this user" (it hides *both* archive and restore), while `rootFolderType === 20` (`FolderType.Archive`) decides *which of the two* the row gets |
| A form with **no labels**, though every field has `labelText` | `FieldContainer.labelVisible` defaults to `false` |
| A form with an **empty band under every field** — spacing roughly twice what you set | `FieldContainer` carries its own `margin: 0 0 16px`, and the `gap` on your column adds to it: drop one of the two ([ui-kit.md → Layout conventions](ui-kit.md#layout-conventions)) |
| A panel looks **empty**, but clicking in it and typing works | a `Textarea` as a flex item collapses to ~1px — give it a width |
| A toggle's label is drawn **over the next row** | `ToggleButton` has no intrinsic size and an absolutely positioned label; the wrapper has to reserve the height the label really occupies, not the switch's 20px |
| A selector opened from a modal is **visible but dead** | two portal surfaces are open at once and the modal's backdrop covers the selector — close one before opening the other ([react.md → Selectors](react.md#selectors)) |
| Generated markup is **double-spaced** with nothing extra in the DOM | the modal body inherits `white-space: pre-line` |
| `file.viewUrl` answers **404 while the metadata answers 200** | no content stream until the first write — that 404 is an empty file, and the metadata cannot tell you so ([rest-api.md](rest-api.md#a-files-contents-are-not-part-of-the-api)) |
| A dialog will not grow past 400×280 | `autoMaxWidth`/`autoMaxHeight` are what hand sizing to the body; the kit's `isLarge`/`isHuge` are not forwarded |
| A second `showModal` closed the first dialog | one dialog at a time — a confirmation belongs inside the component |

### The filter field trap

The host reads a **different field name per scope**; the wrong one is silently skipped and the item shows for everybody.

| Field | Scopes |
|---|---|
| `usersTypes` | ContextMenu, InfoPanel, EventListener, ArticleButton, ArticleNavigation |
| `usersType` | MainButton, ProfileMenu, File |

`devices` is read for every scope except `File`, where the check happens inside `onClick`.

### Item keys are portal-wide

The maps are flat and shared across every installed plugin: two plugins using key `settings` evict one another. Prefix keys with the manifest's `name` **verbatim, hyphens included** (`room-activity-…`, not `roomactivity-…`; `pluginName` is the wrong field). For `File` the key is the `extension`, so two plugins claiming `.md` collide — the last loaded wins. For `ArticleNavigation` the key is also a URL segment.

## Which actions work from which callback

| Callback belongs to | `updateProps` / `updateContext` | `saveSettings` | everything else |
|---|---|---|---|
| A React component (`usePluginActions()`) | not offered — a component owns its state | not offered — `usePluginSettings().save()` | all work |
| A menu item, file click, `subMenu.onClick`, event handler, selector or create-dialog callback | **silently ignored** — the setter they need belongs to a mounted element | works | all work |
| A button inside an SDK 2 declarative tree | works | works | `showMediaViewer`/`closeMediaViewer` are a silent no-op |
| Any other element in a declarative tree | works | works | all work |

**Nothing here throws**, and that is the trap: the dispatcher calls every setter optionally (`setElementProps?.()`, `updatePropsContext?.()`), so an action that has no home is a no-op with no console line — the plugin looks correct and does nothing. The only throws in the whole plugin layer are the React API client on a rejected path and the import shim on a missing external. An event handler is not restricted either — see [items.md → EventListener](items.md#eventlistener).

## What actually breaks the portal

A module plugin runs in the portal's own window — its DOM, cookies and `localStorage` in reach. The only guard is the error boundary around each plugin component; everything outside a component is unguarded.

- **Throwing in a class-side callback.** No portal code wraps `onItemClick`, `onClick`, `onGroupClick`, `subMenu.onClick` or `eventHandler` — the host awaits each one bare, so a rejection is a dead click. Catch and return a toast. The create dialog's `onSave` *is* wrapped, but its `catch` only routes to `onError`: without one it swallows the failure and leaves the dialog open ([sdk-contract.md](sdk-contract.md#two-kinds-of-callback)).
- **Throwing in `onLoadCallback` or at module scope** aborts the plugin silently. Fetching in `onLoadCallback` delays installation and, on a throw, aborts it — data belongs in component effects.
- **Throwing during render of an SDK 2 declarative tree** — no boundary, the whole portal shows an error screen.
- **Blocking the event loop.** No worker, no timeout around `onLoadCallback`; a synchronous loop freezes the UI.
- **Unscoped CSS.** A stylesheet is a legitimate tool; a selector that can match the portal's own DOM is not. `plugin.css` is appended to the portal's head *after* the portal's stylesheets, so at equal specificity **your rule wins** — an unprefixed `pre {}` restyles the product. What beats you is inheritance: a property set on your wrapper only inherits, and any portal rule aimed at the descendant itself (the kit's `.body { white-space: pre-line }`) outranks it. So scope the leftmost selector of every rule — a CSS module, or a prefix taken from the manifest `name` — and, for generated HTML, style the descendants from a root you own ([react.md → Scoped CSS](react.md#scoped-css)):

  ```css
  .myplugin-rendered, .myplugin-rendered * { white-space: normal; }
  .myplugin-rendered pre, .myplugin-rendered pre code { white-space: pre; }
  .myplugin-rendered p, .myplugin-rendered li { line-height: 20px; margin: 0; }
  .myplugin-rendered { color: var(--text-color); }
  ```

  Whatever sanitiser you use on that markup is bundled into `plugin.js` and counts against the archive limit.
- **`cspDomains`** origins are added to the **portal's** CSP, not just yours. List only what you call. (`scpDomains` is a real typo in shipped plugins — it silently does nothing.)
- **Timers and listeners at module scope or in `onLoadCallback`** keep running after the plugin is disabled, until a full reload; inside a component's effect they clean up with it.

## Limits

Enforced server-side; exceeding one rejects the upload.

| Limit | Value |
|---|---|
| Archive size, and each extracted entry | 5 MB |
| Assets | 10 files, `.svg` `.png` `.jpg` `.jpeg` only, no subdirectories |
| Plugins per portal | 100 |
| Upload format | `.zip` containing `plugin.js` and `config.json` |
| Context menu nesting | 2 levels |
| Article buttons | 5 per sidebar across all plugins (the same map renders in the article and the apps sidebar) |

Icons are referenced by **file name only** (`"icon-16.svg"`). Sizes: logo 48×48, context menu / main button / profile menu 16×16, sidebar navigation 20×20, `fileRowIcon` 32×32 (every view except tiles, at every size — ship an SVG), `fileTileIcon` 96×96 (the tiles view reads only this one; without it recent portals fall back to the row icon, older ones draw nothing), sidebar button content 32×32.
