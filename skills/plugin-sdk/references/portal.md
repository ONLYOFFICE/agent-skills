# How the portal loads and runs a plugin

What the loader actually does with a plugin — not what the types allow — and therefore why a plugin can install cleanly and do nothing. Observed in the ONLYOFFICE Apps client this skill targets.

Contents: [The switches](#before-anything-loads-the-switches) · [The loading sequence](#the-loading-sequence) · [When loading fails](#when-loading-fails) · [Silent failures](#silent-failures) · [What actually breaks the portal](#what-actually-breaks-the-portal) · [Limits](#limits)

## Before anything loads: the switches

- **`plugins.enabled`** (server setting; the shipped configuration turns it on, a deployment can turn it off). When false the portal never initialises plugins: no bundle fetched, no items, no routes, nothing in the console. Every surface re-checks it. Ask about this before auditing code. Where the switches and the upload control are in the UI: [Adding plugin](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/adding-plugin.md).
- **`pluginOptions.upload` / `pluginOptions.delete`** — a second, narrower switch *behind* the first, not beside it: the Integration → Plugins tab exists only when `plugins.enabled`, and these are read only on that tab. With `upload` off it offers no upload control, however correct the archive.
- The plugin system is skipped when the portal's **paid period has expired**, and plugin surfaces are suppressed inside the **AI-agent/chat views**.

## The loading sequence

Module plugins (`"runtime": "module"` in the packed `config.json` — everything built with SDK 3):

1. `GET plugin.js` as text. Every bare-specifier import is rewritten to the portal's copy — for exactly the five specifiers in [bundling.md](bundling.md). Any other bare specifier **aborts the load**, with the specifier named in the console and on the plugin's card ([below](#when-loading-fails)).
2. `import()` as a blob URL; the default export is the plugin. Module-scope code runs here.
3. The manifest record is `Object.assign`ed **onto** the plugin object — `name`, `version`, `scopes`, `url`, `enabled`, `settings`, `image`, `description`, … — overwriting your same-named fields.
4. `setLanguage(locale)` — the `LANGUAGE` cookie, falling back to the portal's own `culture` when the cookie is unset. **Once per load**: it is not called again when the language changes ([below](#a-language-change-reloads-every-plugin)); switching the plugin back on repeats steps 4–10 on the same instance.
5. If declared: `setAPI(origin, proxy, prefix)`.
6. `await plugin.onLoadCallback()`.
7. `getStatus()` — a plugin without one counts as `active`. `hide` skips the next two steps (and the PostMessage callback) but is not final: the status is re-read at step 10, after every `usePluginSettings().save()` and on every `Actions.updateStatus`, and `active` then performs the two steps — not the PostMessage callback, which waits for the next load ([plugin.md](plugins/plugin.md#iplugin--always-required)).
8. `plugin.css`, if packed, is linked into the **main** document's head as `<link id="plugin-styles-<pluginName>">`.
9. Every declared item scope's getter is read and the items copied into portal-wide maps, filtered by `usersTypes`/`usersType` and `devices` for the current user and device — except `ContextMenu`, whose filters all run when the menu opens, and `File`, whose `devices` is checked at the click.
10. Settings scope: `setAdminPluginSettingsValue(storedSettingsString)`, then `getStatus()` again — `active` registers the items and CSS (again, harmlessly), `hide` removes them.

Legacy plugins (no `runtime`; webpack, SDK ≤ 2) run from step 4 on, but the bundle is injected as a `<script>` into one hidden `<iframe id="plugin-iframe">` shared by all plugins, and the plugin is `iframeWindow.Plugins[pluginName]` — a mismatch is reported as a load failure, the script having registered no plugin under that name ([below](#when-loading-fails)).

Consequences:

- **An ES module without `"runtime": "module"`** is injected as a classic script and dies on its first `import`; the plugin's card then reads *Failed to load* with the browser's syntax error.
- **Register items in `onLoadCallback`, not at module scope.** Both reach the maps in time (they are read at step 9), but at module scope neither the language nor the API URLs are set yet — a factory that translates a label or calls `getAPI()` there captures empty values.
- **Anything registered after step 9 is invisible** until the matching `update*Items` action — items added from a timer or an un-awaited promise.
- **Stored settings arrive after `onLoadCallback`, not during it.** Step 10 runs once installation has finished, so a settings value read in `onLoadCallback` is still `null` — components read settings with `usePluginSettings().load()`, class-side code reacts in `setAdminPluginSettingsValue`. The status re-read that follows is what lets a plugin stay `hide` until it is configured: set the status from the parsed value there, and the portal registers the items the moment a valid configuration is saved.
- **Disabled plugins are still fetched and executed**, so module-scope side effects run even when switched off. A disabled plugin also gets `setLanguage` and, with the Settings scope, `setAdminPluginSettingsValue` and `getStatus` — while `setAPI` and `onLoadCallback` have not run — so those three must not rely on either, and a throw in them marks a switched-off plugin *Failed to initialize*.
- **Enable/disable is live** (a `change-web-plugin` socket room): items appear or vanish in every open session without a reload. On re-enable the bundle is not re-fetched, so module-scope state survives, and the same instance goes through steps 4–10 again — `setLanguage`, `setAPI`, `onLoadCallback`, `getStatus`, and for a Settings plugin `setAdminPluginSettingsValue` with the settings string that session holds. A throw there marks the plugin as failed to initialize ([below](#when-loading-fails)).

### A language change reloads every plugin

Switching the interface language does not notify the plugin — it **drops and reinstates** it: the plugin list is emptied, every bundle re-fetched and `import()`ed as a *new* module, and the sequence above runs again from step 1, on a new instance. Opening Settings → Integration does the same thing. Two consequences worth designing around:

- **Nothing needs re-translating.** Labels are rebuilt because the factories run again, so `setLanguage` has no rebuilding to do ([plugin.md → Localisation](plugins/plugin.md#localisation)).
- **Module-scope side effects double.** The old instance is discarded without a teardown — the SDK has no `onUnload` and the portal calls none — so a `setInterval` or a `window` listener started at module scope or in `onLoadCallback` keeps running, and the new copy starts another beside it. Every language switch and every visit to the Integration tab adds one more. Module-scope *state* meanwhile resets, and a still-mounted surface may be closing over the previous module's copy of it.

### Manifest fields the portal reads for itself

The packed `config.json` and how `package.json` maps onto it are in [Config](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/config.md); the fields with behaviour worth knowing:

- `runtime` — only `"module"` is known.
- `minDocSpaceVersion` — written into `config.json` by the packer from the **installed SDK's** `package.json`; setting it in your own `package.json` does nothing. It only produces a compatibility warning, never blocks loading.
- `nameLocale` / `descriptionLocale` — `{ "ru": "…", "en-US": "…" }`, used for the plugin list only; item labels you localise yourself.
- `cssUrl` — points at `plugin.css`; re-installing updates the `<link>` in place, disabling removes it. CSS is the one thing torn down on disable — script side effects are not.

## When loading fails

A plugin that never becomes a plugin is reported — to the administrator. The upload ends with a toast, **Failed to load** or **Failed to initialize**, carrying the reason; after that, on every page load, the plugin's card in Settings → Integration → Plugins shows an icon — red for a load failure, in the warning colour for an initialization failure — whose tooltip is that reason, and the plugin's settings aside shows the same failure as its status. Users see nothing: for them the plugin is simply not there.

| The card says | The reason reads | Cause |
|---|---|---|
| **Failed to load** — the toggle is off and locked; the plugin stays in the list so it can be deleted | *The bundle imports "lodash-es", which the portal does not provide …* — the portal's own sentence, naming the specifier | a bare import outside the five specifiers: a library that should have been bundled, the SDK **root** marked external, a `@docspace/ui-kit/…` subpath |
| | *The plugin module has no default export* | still assigning `window.Plugins.X` instead of `export default plugin` |
| | the exception's own message | module-scope code threw, or the bundle is not valid JavaScript for the browser |
| | *process is not defined* | the build does not `define` `process.env` ([bundling.md](bundling.md)) |
| | the browser's syntax error, e.g. *Cannot use import statement outside a module* | an ES module bundle without `"runtime": "module"`, loaded as a legacy script |
| | *The request for … failed with HTTP 404* | the bundle URL does not answer — a broken upload |
| | *The script ran but registered no plugin named "X"*, or *Failed to load the script …* | (legacy) `window.Plugins.X` ≠ `pluginName`, or the script URL does not answer |
| **Failed to initialize** — a warning icon; the toggle stays on | the exception's own message | `onLoadCallback` threw — or `setLanguage`, `setAPI`, `setAdminPluginSettingsValue` or `getStatus` did — at load or on a re-enable |

The console carries the same failure: `[Plugin: <name>] Failed to load module plugin:` for the first group (`Failed to load plugin:` for a legacy bundle), `[Plugin: <name>] Plugin initialization failed:` for the second. Ask for the tooltip text before reading code — it names the cause directly. Everything that goes wrong after a plugin has loaded is below, and none of it is reported.

## Silent failures

The plugin loaded, so the portal reports nothing: none of these produce an error anyone sees, and most leave nothing in the console.

| Symptom | Cause |
|---|---|
| Nothing loads at all: no bundle request, no console output | `plugins.enabled` is off, or the paid period expired |
| Installed and enabled, no CSS and no items; the plugin's settings aside gives its status as *Need enter settings* | `getStatus()` returned `hide` — reversible: the portal re-reads it after the stored settings arrive, after a settings save and on `Actions.updateStatus` |
| One scope is dead, others work | scope declared but its getter is missing, or `add*Item` never called |
| A tab, page or modal opens **blank**; console `[Plugin: name] …` | the component threw while rendering — swallowed by the error boundary. Usually an unguarded parse, a conditional hook, or a bundled React (next rows) |
| A tab, page or modal **never leaves its skeleton**; console *Uncaught (in promise)* | a request in an effect rejected with no `catch` — a rejected promise escapes the error boundary, so nothing replaces the loading state ([rendering.md](react/rendering.md#errors-loading-language-styling)) |
| Every component blank; `usePluginRuntime must be used inside a plugin component` | a second React or SDK React entry in the bundle — fix the `external` list |
| A surface that needs a lazily loaded module opens **blank** on the portal and worked in the preview; a `TypeError` about `./chunk-….js` in the console | the build split the bundle: the archive carries `plugin.js` alone and a blob-URL module cannot resolve a relative `import()` — `codeSplitting: false` ([bundling.md](bundling.md)) |
| Components render light and LTR on a dark/RTL portal | a bundled `@docspace/ui-kit` |
| A hook "throws outside a component" from a click | hooks called in a class-side callback |
| Filter by user role ignored | wrong field name — see [the filter field trap](items/common-fields.md#the-filter-field-trap) |
| Item renders, click does nothing | the returned action has no matching payload field ([actions.md](react/actions.md)) |
| Items appear only after a manual refresh | registered after `onLoadCallback` resolved |
| Re-upload changes nothing | `version` not bumped — the portal serves the cached bundle, icons are cached as `?hash=<version>`. Uploading a name+version that matches an installed plugin raises a cache-warning dialog |
| An item vanishes when an unrelated plugin is disabled | two plugins used the same item `key` ([item keys are portal-wide](items/common-fields.md#item-keys-are-portal-wide)) |
| A sidebar page redirects to the root | the item's `appears` excludes the section the URL is under, or the key is unknown |
| A whole scope never appears | it exists in the installed SDK but not in this portal ([scopes.md](plugins/scopes.md)) |
| A modal opened from the context menu knows nothing about the file | `useCurrentFile()` is `null` there — hand the id over ([hooks.md](react/hooks.md#what-usecurrentfile-returns-where)) |
| The settings aside's Save button saves nothing | `usePluginSettings().setSaveButton(...)` never called, and no static `saveButton` declared |
| A settings save that failed looks exactly like one that worked | `onClick` caught the failure and returned no toast, and the aside closes once `onClick` resolves ([settings-plugin.md](plugins/settings-plugin.md#the-settings-client)) |
| Save does nothing visible, the aside stays open — or spins until a reload | `onClick` threw: the portal only closes the aside when it resolves ([settings-plugin.md](plugins/settings-plugin.md#the-settings-client)) |
| Save is lit over a form nobody touched although `isDisabled` gates on changes | `disableWhileRequestRunning` is set, and it can replace the plugin's `isDisabled` with the request state — leave it off ([settings-plugin.md](plugins/settings-plugin.md#the-settings-client)) |
| `showCreateDialog`, `showMediaViewer` or the progress button does nothing from a settings page or the settings aside | portal settings has no create dialog, media viewer or progress button; the media viewer exists only over a folder's list in the Files section ([media-viewer.md](components/media-viewer.md)) |
| A class field holds the wrong value after load | it shares a name with a field of the plugin's server record (`settings`, `name`, `version`, `url`, `enabled`, `image`, `description`, `author`, `license`, `homePage`, `pluginName`, `scopes`, `system`, `runtime`) or one the portal adds (`iconUrl`, `compatible`, `nameLocaleMap`, `descriptionLocaleMap`) — overwritten in step 3 |
| Works everywhere except chat / AI-agent views | suppressed there by design |

### Silent failures in the UI layer

The plugin loaded and rendered, and what the user sees is still wrong. They read as styling bugs and are not — nearly every one is a component default rather than a rule: fixes in [ui-kit.md](ui-kit.md#behavioural-traps) and [modal-dialog.md](components/modal-dialog.md). For the ones that really are the stylesheet, [styles.md](styles.md).

| Symptom | Cause |
|---|---|
| The blocks of a surface sit **side by side**, vertically centred, instead of stacked — and controls inside them each break onto their own line | several children were handed to a kit component at once (a fragment as a tab's `content`, a dialog body, `children`); the box it wraps them in is a flex row |
| The progress button **stays in the panel** after the job ended, still reading "…ing" | the last update set `operations[i].completed` but not **`operationsCompleted`** on the button props. The outer flag is what the portal watches; on it, the panel dismisses the button and clears the plugin's entries by itself ([floating-operations-button.md](components/floating-operations-button.md)) |
| Clicking a room lands on the **rooms list**, and the address bar reads `/rooms/shared/undefined/filter?searchArea=…` | the link had no `?folder={id}`. The section tells one room from the list by the query, not the path, and then rewrote the address from its own state ([actions.md → Paths navigate takes](react/actions.md#paths-navigate-takes)) |
| A row action fires on a row it **cannot apply to** — archiving an archived room, restoring a live one | the action was gated on `security` alone. The portal uses two independent tests, and so must a plugin: `security.Move` answers "may this user" (it hides *both* archive and restore), while `rootFolderType === 20` (`FolderType.Archive`) decides *which of the two* the row gets |
| The settings aside opens with **Save already active** — or with a field already red — over a form nobody has touched | `isDisabled` and `hasError` were given validity alone. The portal cannot tell a touched form from an untouched one; the page has to compare what is loaded with what is shown ([settings-plugin.md → The settings client](plugins/settings-plugin.md#the-settings-client)) |
| A form with **no labels**, though every field has `labelText` | `FieldContainer.labelVisible` defaults to `false` |
| A form with an **empty band under every field** — spacing roughly twice what you set | `FieldContainer`'s own margin, plus your `gap` |
| A panel looks **empty**, but clicking in it and typing works | a `Textarea` as a flex item collapses to ~1px |
| A toggle's label is drawn **over the next row** | `ToggleButton` has no intrinsic size and an absolutely positioned label |
| A selector opened from a modal is **visible but dead** | two portal surfaces are open at once and the modal's backdrop covers the selector — close one before opening the other ([selector.md](components/selector.md#from-a-dialog-one-surface-at-a-time)) |
| The Files selector's **Select** button never enables when a file is clicked | `getIsDisabled` waits for `selectedFileInfo`, which reaches it late or, on some portal builds, never — gate on the folder ([selector.md → The Files selector](components/selector.md#the-files-selector-folder-vs-file)) |
| A copy, move or create into a folder the user **can** write to fails with *"You don't have enough permission"* | a portal id went into the JSON body as a string, so the server resolved it as a third-party id ([rest-api.md → Identifiers](rest-api.md#identifiers)) |
| "Open" on a document the plugin created shows the 404 page or downloads the file | the link was `webUrl`/`viewUrl`, or went through `navigate()` — the editor is a page load ([actions.md → Opening a document](react/actions.md#opening-a-document-is-a-page-load)) |
| A "running" row shows a line of text where a spinner should be | `Loader` defaults to `LoaderTypes.base`, which renders its label as text ([ui-kit.md](ui-kit.md#behavioural-traps)) |
| A control at the **left or right edge** of a media-viewer surface, or in its top band, cannot be clicked — the viewer pages to the next file or closes instead | the viewer's 73px paging strips and 64px header are fixed *above* the plugin's content, which fills the whole viewport; the strips exist only when the folder has more than one matching file ([media-viewer.md](components/media-viewer.md)) |
| Generated markup is **double-spaced** with nothing extra in the DOM | the modal body inherits `white-space: pre-line` ([modal-dialog.md](components/modal-dialog.md)) |
| `file.viewUrl` answers **404 while the metadata answers 200** | no content stream until the first write — that 404 is an empty file, and the metadata cannot tell you so ([rest-api.md](rest-api.md#a-files-contents-are-not-part-of-the-api)) |
| A dialog will not grow past 400×280 | `autoMaxWidth`/`autoMaxHeight` are what hand sizing to the body; the kit's `isLarge`/`isHuge` are not forwarded ([modal-dialog.md](components/modal-dialog.md)) |
| A second `showModal` closed the first dialog | one dialog at a time — a confirmation belongs inside the component ([modal-dialog.md](components/modal-dialog.md)) |
| An action does nothing and logs nothing — `updateProps` or `updateCreateDialogModal` from a menu click | the callback it came from cannot carry it ([which actions work from which callback](react/actions.md#which-actions-work-from-which-callback)) |

## What actually breaks the portal

A module plugin runs in the portal's own window — its DOM, cookies and `localStorage` in reach. The only guard is the error boundary around each plugin component; everything outside a component is unguarded.

- **Throwing in a class-side callback.** Nothing wraps them — the create dialog's `onSave` is caught, and the failure dropped when there is no `onError` — so a rejection is a dead click that tells the user nothing: catch and return a toast ([plugin.md](plugins/plugin.md#two-kinds-of-callback)).
- **Throwing in `onLoadCallback` or at module scope** aborts the plugin: no items, no CSS, and for users no sign of it — only the administrator's plugin card says *Failed to initialize* or *Failed to load* ([When loading fails](#when-loading-fails)). Fetching in `onLoadCallback` delays installation and, on a throw, aborts it — data belongs in component effects.
- **Throwing during render of an SDK 2 declarative tree** — no boundary, the whole portal shows an error screen.
- **Blocking the event loop.** No worker, no timeout around `onLoadCallback`; a synchronous loop freezes the UI.
- **Unscoped CSS.** `plugin.css` is appended to the portal's head *after* the portal's own stylesheets, so at equal specificity your rule wins and an unprefixed `pre {}` or `.card {}` restyles the product itself — in every section, for every user, until the plugin is disabled. Only the browser pass reads the rules, and only against portal-shaped markup ([build.md → 7. See it](build.md#7-see-it--the-step-that-catches-what-looks-broken)), so the fix is a form that cannot go wrong: [styles.md → Scoped CSS](styles.md#scoped-css). The reverse direction — portal rules reaching into your markup — is [what beats your rules](styles.md#what-beats-your-rules).
- **`cspDomains`** origins are added to the **portal's** CSP, not just yours. List only what you call. (`scpDomains` is a real typo in shipped plugins — it silently does nothing.)
- **Timers and listeners at module scope or in `onLoadCallback`** keep running after the plugin is disabled, until a full reload; inside a component's effect they clean up with it.

## Limits

Enforced server-side; exceeding one rejects the upload. The archive and asset limits are also stated in [Adding plugin](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/adding-plugin.md) and [Plugin structure → assets](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/plugin-structure.md#assets); the rest is observed.

| Limit | Value |
|---|---|
| Archive size, and each extracted entry | 5 MB |
| Archive entries | 13 — `plugin.js`, `config.json`, the `assets/` folder entry the packer writes, and ten more; `plugin.css` is one of the ten, so a plugin with a stylesheet has room for **9** assets |
| Assets | `.svg` `.png` `.jpg` `.jpeg` only — compared case-sensitively, so `icon.PNG` is dropped without a word — and no subdirectories |
| Plugins per portal | 100 |
| Upload format | `.zip` containing `plugin.js` and `config.json` |
| Stored settings (`save()` / `saveSettings`) | one string of 255 characters; longer is refused with a 400, not truncated |

Limits of one scope — context menu nesting, the five sidebar buttons — are with that scope: on its page here or on the docs page it links ([scopes.md](plugins/scopes.md)).

Icons are referenced by **file name only** (`"icon-16.svg"`). The logo is 48×48; the size each item's icon wants is on its interface's docs page and in [Plugin structure → assets](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/plugin-structure.md#assets), and what the portal does with a `File` item's two icons beyond that is in [file-item.md](items/file-item.md).
