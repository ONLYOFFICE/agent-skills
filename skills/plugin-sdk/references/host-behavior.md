# How the portal loads and runs a plugin

Everything here is observed in the DocSpace client this skill targets. It is the part no SDK documentation covers: not what the types allow, but what the loader actually does with them — and therefore why a plugin can install cleanly and do nothing at all.

## Before anything loads: the portal must have plugins turned on

The whole system is behind a portal setting, and it is **off by default**. `enablePlugins` comes from the server's own settings (`plugins.enabled`); when it is false the portal never calls `initPlugins()` at all — no iframe, no bundles fetched, no items, and nothing in the console. Every surface then re-checks the same flag independently: the context menu, the info-panel tabs, file icons and the file-click override, and the event-listener subscriptions.

So "the plugin does nothing" has a cheaper first question than any of the silent failures below: **is the plugin system enabled on this portal at all?** On a self-hosted install this is configuration, not something the plugin or its author can fix.

Two further switches sit next to it, and they are independent of `enablePlugins`:

- `pluginOptions.upload` — when false, the Integration → Plugins page offers no upload control. The plugin cannot be installed, however correct the archive is.
- `pluginOptions.delete` — same, for removal.

A portal can therefore have plugins running while refusing new ones. Check this before telling a user their zip is broken.

The plugin system is also skipped entirely when the portal's **paid period has expired**, and plugin surfaces are suppressed wholesale inside the **AI-agent sections** (chat and agent views) — there the context menu, file items and info-panel tabs behave as if no plugin were installed.

## The loading sequence

1. The portal creates one hidden `<iframe id="plugin-iframe">` for **all** plugins. No `src`, so it is `about:blank` and same-origin with the portal.
2. For every plugin — including disabled ones — it injects `<script src="…/plugin.js" async>` into that iframe's document. Top-level code in the bundle runs here.
3. On load it merges what the bundle registered: roughly `{ ...pluginRecord, ...iframeWindow.Plugins[pluginName] }`. **The lookup key is `pluginName` from the manifest.** A mismatch yields a plugin object with no behaviour and no error anywhere.
4. It compares the manifest's `minDocSpaceVersion` against the portal's own build version and records a `compatible` flag, shown in the plugin list. This never blocks loading — an incompatible plugin still installs and runs.
5. `setLanguage(locale)`, using the interface language from the `LANGUAGE` cookie, then resolves the display name and description from the manifest's locale maps (see below).
6. If the scope is declared: `setAPI(origin, proxy, prefix)`.
7. `await plugin.onLoadCallback()`.
8. The plugin's CSS is installed, as `<link id="plugin-styles-<pluginName>">` in the **main** document's head.
9. The loader reads every declared scope's getter and copies the items into portal-wide maps.
10. Finally, for the Settings scope, `setAdminPluginSettingsValue(storedSettingsString)`.

Three consequences follow, and they cause most "my item never appears" reports:

- **Register items in `onLoadCallback`, not at module scope.** Both work as far as visibility goes — the maps are not read until step 9, so top-level registration is in time, and several official plugins do exactly that. The reason to prefer `onLoadCallback` is steps 5 and 6: at module scope neither the language nor the API URLs have been set yet, so any item factory that calls `getAPI()` or a translator captures empty values. Registering in `onLoadCallback` means both are already in place.
- **Anything registered after step 9 is invisible** until an explicit `update*Items` action — for instance items added from a `setTimeout` or a promise you did not await.
- **Do not expect stored settings during `onLoadCallback`.** They arrive at step 10. Read them in `setAdminPluginSettingsValue`, not before.

### Manifest fields the portal reads for itself

Three manifest values never reach the plugin object — the portal consumes them directly:

- **`minDocSpaceVersion`** is taken from the **installed SDK's** `package.json`, not the plugin's, and written into `config.json` by the packer. Setting it in your own `package.json` does nothing.
- **`nameLocale` / `descriptionLocale`** are maps of locale → string (`{ "ru": "…", "en-US": "…" }`), keyed by the interface language, falling back to `name` / `description` when the language is absent. They drive the plugin list only; they have nothing to do with the labels on your items, which you localise yourself.
- **`cssUrl`** points at the `plugin.css` the packer includes when the built file is non-empty. Re-installing updates the existing `<link>` in place; disabling the plugin removes it. CSS is the one thing the portal does tear down on disable — script side effects are not.

### The plugin can be switched on or off underneath you

The portal subscribes to a `change-web-plugin` socket room, so when an administrator enables or disables a plugin, **every open session reacts immediately** — items are installed or removed without a reload. Practical consequences: your items can vanish mid-session, and on re-enable the bundle is not re-fetched, so module-scope state survives from the previous activation while `onLoadCallback` runs again.

## Silent failures

None of these produce a console error. That is what makes them expensive.

| Symptom | Cause |
|---|---|
| Installs, enables, does nothing at all | `window.Plugins.X` ≠ `package.json:pluginName` |
| One scope is dead, others work | scope declared but its getter is missing, or `add*Item` is never called |
| Filter by user role ignored | wrong field name — see the table below |
| Item renders, click does nothing | the returned action has no matching payload field |
| Installation stops halfway; no CSS, no items | `getStatus()` returned `hide`, or `onLoadCallback` threw |
| Items appear only after a manual refresh | items registered after `onLoadCallback` resolved |
| Re-upload changes nothing | `version` not bumped — the portal serves the cached bundle, and icons are cached as `?hash=<version>`. The portal notices this itself: uploading an archive whose name **and** version match an installed plugin raises a cache warning dialog, which is the signal you forgot the bump |
| An item vanishes when an unrelated plugin is disabled | two plugins used the same item `key` |
| A whole scope never appears anywhere | the scope exists in the installed SDK but not in this portal (see `sdk-target.md`) |
| Nothing loads at all: no iframe, no bundle request, no console output | the portal has plugins disabled (`plugins.enabled`) — see the section above; this is portal configuration, not a plugin defect |
| Everything works except inside chat / AI-agent views | plugin surfaces are suppressed there by design |
| A button collapses to a tiny pill | `ButtonSize.extraSmall` — the SDK emits `"extra-small"`, the host's stylesheet only knows `"extraSmall"`; same failure for `InputSize.big`/`huge`, which no longer exist host-side (see [ui-components.md](ui-components.md)) |
| Nothing at all initializes, no plugin errors | the portal's paid period expired — the plugin system is skipped entirely on an unpaid portal |

### The filter field trap

The host reads a **different field name per scope**, and the plural is not a typo you can ignore — the wrong one is silently skipped, so the item shows for everybody.

| Field | Scopes |
|---|---|
| `usersTypes` | ContextMenu, InfoPanel, EventListener, ArticleButton |
| `usersType` | MainButton, ProfileMenu, File |

`devices` is read for every scope except `File`, where the device check happens inside `onClick` instead.

### Item keys are portal-wide

The maps behind each scope are flat and shared across every installed plugin. Two plugins using key `settings` evict one another, and disabling one removes the other's item. Always prefix keys with the manifest's `name` — `myplugin-context-menu`, not `context-menu`.

Use `name` verbatim, hyphens included: for a plugin named `room-activity` the prefix is `room-activity-`, not `roomactivity-`. `pluginName` is the wrong field to reach for here — that one is the `window.Plugins` key, and squashing it into a slug (`RoomActivity` → `roomactivity`) produces a prefix that no longer matches the plugin anyone is looking for.

For the `File` scope the key is the `extension`, so collisions are likelier still: if two plugins claim `.md`, the one loaded last wins.

## Actions and their payloads

A callback returns an `IMessage`; the host walks `actions` in order and, for most of them, does nothing unless the matching field is present.

| Action | Required field |
|---|---|
| `updateProps` | `newProps` |
| `updateContext` | `contextProps` |
| `showToast` | `toastProps` |
| `showModal` | `modalDialogProps` |
| `showCreateDialogModal`, `updateCreateDialogModal` | `createDialogProps` |
| `showSelector`, `updateSelector` | `selectorProps` |
| `showMediaViewer`, `updateMediaViewer` | `mediaViewerProps` |
| `addFloatingOperationsButton`, `updateFloatingOperationsButton` | `floatingOperationsButtonProps` |
| `removeFloatingOperationsButton` | `floatingOperationsButtonPropsId` |
| `sendPostMessage` | `postMessage` (and the target frame must exist in the DOM) |
| `saveSettings` | `settings` |
| `navigate` | `navigatePath` |
| `openInfoPanel` | `infoPanelTab` (optional; falls through to a plugin tab) |
| `updateStatus`, `closeModal`, `closeSelector`, `closeMediaViewer`, all `update*Items` | none |

The settings aside is not on that list on purpose: the SDK exports no action for opening or
closing it, so a plugin cannot drive it. The portal opens it from the plugin list, and the
save button closes it — anything a plugin sends as a raw string is not an `Actions` value
and the validator rejects it as one.

Ordering matters: actions listed after `navigate` run only once navigation finishes.

`openInfoPanel` takes `infoPanelTab`: the portal's own tab names (`info_share`, `info_members`, `info_details`, `info_history`) — or **your info-panel item's `key`**, which opens the plugin's own tab.

### Which actions work from which callback

The dispatcher receives a different set of handlers depending on where the callback lives, so the same message can work in one place, no-op in a second, and throw in a third:

| Callback belongs to | `updateProps` | `updateContext` | `saveSettings` | `showMediaViewer` and other actions |
|---|---|---|---|---|
| A **button** inside plugin UI (modal, settings, panel) | works | works | works | `showMediaViewer`/`closeMediaViewer` are a **silent no-op** — the host hands buttons every handler *except* the media-viewer pair; everything else works |
| Any other element inside plugin UI (input, checkbox, comboBox, link, iconButton…) | works | works | **throws a TypeError** | all work, media viewer included |
| A menu item, file click, info-panel `subMenu.onClick`, selector or create-dialog callback | silently ignored | **throws a TypeError** | works | all work |

The practical rules that fall out of it:

- **To change visible UI from a menu item, open a modal and update from within it** — `updateProps`/`updateContext` need a rendered plugin tree around the callback.
- **Return `saveSettings` only from a `button`** — usually the Settings save button. From an input's `onChange` it does not "save as you type"; it throws.
- **To open the media viewer, do it from a menu callback or a non-button element** — a modal's button cannot.

Two more host quirks in the same dispatcher, worth knowing when a result looks impossible:

- `updateProps` spreads `message.newProps` without checking it exists — sending the action with no payload wipes the element's props instead of doing nothing.
- `updateInfoPanelItems` is missing a `break`, so it also triggers the article-button refresh. Since the SDK ships no `updateArticleButtonItems` action at all, this fall-through is also the only way a plugin can refresh its article buttons.

## What actually breaks the portal

There is no sandbox and no error boundary around plugin UI, so a plugin is one bad line away from taking the page with it. The hidden iframe has `sandbox` commented out in the loader and no `src`, which leaves it same-origin: plugin code can reach `window.parent`, the portal DOM, cookies and `localStorage`. The declarative UI is a convention, not a restriction.

Because of that, treat these as real hazards rather than style advice:

- **Throwing during render.** The nearest error boundary is the application shell, so an exception while the host renders your component tree replaces the whole portal with an error screen. Validate props before returning them.
- **Throwing in a callback.** No user callback is wrapped in `try/catch`. Catch your own errors and surface them with `showToast`.
- **Blocking the event loop.** The iframe shares the portal's event loop, there is no worker and no timeout around `onLoadCallback`. A synchronous loop freezes the entire UI.
- **Unscoped CSS.** A plugin's stylesheet is injected as a plain `<link>` into the *main* document's head, with no scoping. Any selector you write can restyle the portal. Prefix everything.
- **`cspDomains`.** Origins listed there are added to the portal's own Content-Security-Policy — not just yours. List only what you actually call.
- **Timers outliving the plugin.** Disabling or deleting a plugin does not remove its script from the iframe. Intervals and listeners keep running until a full page reload, so clean up rather than assuming teardown.

Disabled plugins are still downloaded and executed, so top-level side effects run even when the plugin is switched off. Keep module scope free of work.

## Limits

Enforced server-side; exceeding one rejects the upload rather than failing quietly.

| Limit | Value |
|---|---|
| Archive size, and each extracted entry | 5 MB |
| Assets | 10 files, `.svg` `.png` `.jpg` `.jpeg` only, no subdirectories |
| Plugins per portal | 100 |
| Upload format | `.zip` containing `plugin.js` and `config.json` |
| Context menu nesting | 2 levels |
| Article buttons | 5 per sidebar, across all plugins combined — they render in two places (the article sidebar and the apps sidebar), each capped separately |

Icons are referenced by **file name only** (`"icon-16.svg"`), never a path. Expected sizes: logo 48×48, context menu / main button / profile menu 16×16, `fileRowIcon` 32×32, `fileTileIcon` 96×96, article button body 32×32.
