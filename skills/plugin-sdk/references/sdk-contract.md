# The plugin class contract

What the class must implement and how the portal uses it. The interfaces themselves are in the installed SDK's types (`@onlyoffice/docspace-plugin-sdk`); this file records what the types do not say. Components are covered in [react.md](react.md).

The SDK root contains no runtime logic — enums and types only. Every interface is a shape the portal expects to find on the exported object; nothing enforces it beyond TypeScript.

## `IPlugin` — always required

`status`, `onLoadCallback`, `updateStatus`, `getStatus`, `setOnLoadCallback`; optional `language`/`setLanguage`/`getLanguage` — implement them if the plugin shows any text.

- `PluginStatus` is `active` or `hide`. `hide` from `getStatus()` stops installation before items or CSS are read — a kill switch, disastrous by accident.
- Write members as **arrow-function class fields**, not methods: the loader calls them from its own code, so `this` has to be bound.

## How the portal gets the plugin

```ts
const plugin = new MyPlugin();
export default plugin;
```

That is the whole registration for a module plugin (`"runtime": "module"` in `package.json`). No `window.Plugins`, no global declaration — a plugin that still assigns one carries dead code. Two consequences of how the export is used ([portal.md → loading sequence](portal.md#the-loading-sequence)):

- **The manifest is `Object.assign`ed onto your object** — `name`, `version`, `scopes`, `url`, `enabled`, `settings`, `image`, `description`, …. A class field with one of those names holds the portal's value by the time `onLoadCallback` runs. Name your own state something else (`config`, `savedSettings`).
- **It is the same object, not a copy.** Module-scope references to `plugin` inside components stay valid, and `plugin.updateContextMenuItem(...)` from a component reaches the live maps — which is how the `update*Items` actions work from React.

## Per-scope interfaces

**API** (`IApiPlugin`): `setAPI(origin, proxy, prefix)`/`getAPI()` and the per-part accessors. Gives class-side callbacks the portal's base URLs; there is no token — requests ride the session cookies (`credentials: "include"`). `setAPI` runs before `onLoadCallback`. A React component does not need this scope ([rest-api.md](rest-api.md)).

**Settings** (`ISettingsPlugin`): `setAdminPluginSettings({ component: SettingsPage })` in `onLoadCallback` registers the page; the component loads and saves through `usePluginSettings()` ([react.md → Settings client](react.md#the-settings-client)). Stored settings are an opaque **string** delivered to `setAdminPluginSettingsValue` **after** installation and again after every `save()` — for class-side callbacks that need them. Parse defensively: `null`/`""` is a normal first-run value, and a throw there breaks installation. They survive a disable/enable cycle. The page renders in an aside with the plugin's metadata rendered by the portal below your component (do not duplicate it) and a Save/Cancel footer the portal owns.

**PostMessage** (`IPostMessagePlugin`): for plugins whose UI is a third-party page in an iframe. The direction is easy to get backwards — the **portal** hands you `postMessageCallback` via `setPostMessageCallback`; you invoke it to ask the portal to do something. Listening to your iframe is your own `window.addEventListener("message", …)` (a module plugin runs in the portal's window), inside a component effect so it cleans up; check `event.origin`; the origin goes in `cspDomains`. Sending the other way is plain DOM: `(document.getElementById(id) as HTMLIFrameElement).contentWindow?.postMessage(...)`. The callback's message accepts a restricted action set — no `updateProps`, `updateContext`, `updateStatus`, `sendPostMessage`, `saveSettings`, or any `update*` of selector/dialog/media viewer.

**Item-map scopes** — ContextMenu, InfoPanel, MainButton, ProfileMenu, EventListener, File, ArticleButton, ArticleNavigation — share one shape: a `Map`, `add<Scope>Item`, `get<Scope>Items`, `update<Scope>Item` (plus `getContextMenuItemsKeys` for ContextMenu). Two exceptions: **EventListener** has no `update…Item` — re-add to replace; **File** keys its map by `extension`, not `key`. Fields per item are in [items.md](items.md).

## Two kinds of callback

| From | Talk to the portal by | Reach the API by | Know the current file by |
|---|---|---|---|
| A class-side callback — `onItemClick`, `onClick`, `eventHandler`, `subMenu.onClick`, create-dialog `onSave` | **returning an `IMessage`** (`{ actions: [Actions.showToast], toastProps: [...] }`) | `fetch` against `getAPI()` (needs the `API` scope) | the `id` or `File` argument it was given |
| A React component | **calling `usePluginActions()`** | `usePluginAPI()` (no scope) | `useCurrentFile()` |

Hooks throw outside a rendered component. The two worlds meet at `showModal`: a callback returns `{ actions: [Actions.showModal], modalDialogProps: { dialogBodyComponent: Panel } }` and `Panel` is React — but `useCurrentFile()` is `null` there, so pass the clicked id through a module variable or a factory ([react.md](react.md#what-usecurrentfile-returns-where)).

**A class-side callback carries its own error handling — all of them, not just the ones that await.** The host `await`s each one bare: `onItemClick`, `onClick`, `onGroupClick`, `subMenu.onClick` and `eventHandler` are called with no `try` around them, so a throw or a rejection becomes an unhandled rejection and the `IMessage` never reaches the dispatcher — no modal, no navigation, no toast, and an item that reads as broken. Return an error toast instead, carrying the portal's own words (a `PluginApiError`'s `message`, a `fetch`'s status text) rather than one house phrase for everything: a plugin's failed request does not move the user anywhere the way the portal's own do, so that toast is the entire diagnosis, both for the person clicking and for whoever they report it to.

```ts
onItemClick = async (id: number): Promise<IMessage> => {
  try {
    …
    return { actions: [Actions.showModal], modalDialogProps: { … } };
  } catch (error) {
    return { actions: [Actions.showToast], toastProps: [{ type: ToastType.error, title: message(error) }] };
  }
};
```

**The create dialog's `onSave` is the one exception, and it is not a reprieve.** That call *is* wrapped, and the `catch` awaits the `onError` you supplied — but with no `onError` it swallows the failure and returns, leaving the dialog open over an error nobody hears about. Either supply `onError`, or catch inside `onSave` as above; a bare `onSave` fails more quietly than an unwrapped callback, not less. Inside a component the boundary catches the throw but the outcome is no better — the surface renders as nothing ([react.md](react.md#errors-loading-language-styling)), and a `catch` that discards the reason turns a fixable 403 into "it does not work".

## Localisation

**`setLanguage(locale)` is called once per plugin instance, immediately before `onLoadCallback`.** It is not a change notification, and there is nothing to rebuild in it: all it has to do is record the locale so the factories that run next translate their labels in the right language.

```ts
setLanguage = (language: PluginLocale) => {
  setLocale(language);       // that is the whole job
};

getLanguage = () => currentLocale();
```

Item labels are captured when the item is built, which is why factories are **functions returning a fresh object**, never module-level constants — a constant is built before `setLanguage` and keeps whatever language it initialised in.

**A language change reloads the plugin rather than notifying it.** Switching the interface language drops every plugin and runs the whole sequence again — a fresh `import()` of the bundle as a *new* module, then `setLanguage`, then `onLoadCallback` — so labels come out translated with no work of yours. Opening Settings → Integration does the same. Two consequences, and neither is about text:

- **Module-scope state resets.** A cache, a counter, a `targetId` a menu click stored: gone, and any module variable a still-mounted surface closed over belongs to the previous copy of the module.
- **Module-scope side effects accumulate.** The old instance is dropped without being told, and nothing calls a teardown the SDK does not have — so a `setInterval` or a `window` listener started at module scope or in `onLoadCallback` **keeps running**, and the reload starts a second one beside it. Every language switch and every visit to the Integration tab adds another. Start timers and listeners in a component effect, where the cleanup runs, and never at module scope.

`nameLocale`/`descriptionLocale` in the manifest are separate — the portal reads those for the plugin list, and only when the class also implements `getLanguage()`, since that is where the portal takes the locale to look them up. Components call `t()` at render time and follow the language on their own.

**Key the tables by `PluginLocale`, not by a tag you typed.** The value the portal passes is the enum's own — `PluginLocale.JA_JP` is `"ja-JP"`, `ZH_CN` is `"zh-CN"`, English is `EN_US`/`EN_GB` and never `"en"` — so a table filed under `"ja"` type-checks (the key is a string), installs, and is never found: that language quietly reads English and nobody sees an error. Type the map as `Partial<Record<PluginLocale, TStrings>>` and write the keys as members; the scaffolder does both, and the validator reports a near-miss under `locale`. The full list of 33 values is in the SDK's `PluginLocale`.

The generated module also carries `tf(key, values)` for strings with placeholders (`"{count} files"`), which is what keeps a sentence translatable — concatenating fragments in JSX puts the word order beyond the translator's reach.

## Deprecated — do not use in new code

Still compile and render (SDK 2 forms), recognised by the validator and warned about:

- `IInfoPanelItem.body`/`onLoad`, `IArticleButtonItem.body`/`onLoad`, `IMediaViewer.content`/`onLoad` → `component`
- `IModalDialog.dialogBody`/`dialogFooter`/`onLoad` → `dialogBodyComponent`
- `ISettings.settings`/`onLoad` → `component` (`saveButton` is **not** deprecated — see below)
- `IContextMenuItem.onClick`, `IMainButtonItem.onClick` → `onItemClick`
- `ISeparatorItem` — gone
- `window.Plugins.<pluginName> = plugin` — replaced by the default export; harmless but dead
- build script `webpack && node ./scripts/createZip.js` → `vite build && npx build-docspace-plugin`

Two members on that list look deprecated and are not:

- **`IProfileMenuItem.onClick`** — that scope has no `onItemClick`, and its `onClick` takes no arguments.
- **`ISettings.saveButton`** — the SDK marks `settings` and `onLoad` deprecated and deliberately leaves this one alone, and the host reads it as the fallback whenever `setSaveButton` has not supplied a React button. So a settings page may declare its Save statically beside a React `component`, and the two differ in one way worth knowing: a static `saveButton`'s `onClick` stores through the portal's own save path and **does not** call `setAdminPluginSettingsValue`, so class-side code never learns the new value, whereas `usePluginSettings().save()` does. Prefer `setSaveButton` for a form whose Save has to track validity ([react.md → Settings client](react.md#the-settings-client)); the static one is legitimate for a page whose button never changes state.

Reading a plugin that still uses the trees: [sdk-2-plugins.md](sdk-2-plugins.md).
