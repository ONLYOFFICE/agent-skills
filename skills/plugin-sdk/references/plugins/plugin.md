# The plugin class contract

What the class must implement and how the portal uses it. The interfaces themselves are in the installed SDK's types (`@onlyoffice/docspace-plugin-sdk`); this file records what the types do not say. Components are covered in [rendering.md](../react/rendering.md).

The SDK root contains no runtime logic — enums and types only. Every interface is a shape the portal expects to find on the exported object; nothing enforces it beyond TypeScript.

Contents: [`IPlugin`](#iplugin--always-required) · [How the portal gets the plugin](#how-the-portal-gets-the-plugin) · [Per-scope interfaces](#per-scope-interfaces) · [Two kinds of callback](#two-kinds-of-callback) · [Localisation](#localisation) · [Deprecated](#deprecated--do-not-use-in-new-code)

## `IPlugin` — always required

`status`, `onLoadCallback`, `updateStatus`, `getStatus`, `setOnLoadCallback`; optional `language`/`setLanguage`/`getLanguage` — implement them if the plugin shows any text.

- `PluginStatus` is `active` or `hide`, and the portal treats it as a **switch it re-reads**, not a one-time gate: after `onLoadCallback`, after the stored settings reach `setAdminPluginSettingsValue`, after every `usePluginSettings().save()` and on every `Actions.updateStatus`. `active` registers every declared scope's items and loads the CSS; `hide` unregisters them and unloads the CSS, and nothing else is torn down (the PostMessage callback is set only on the first `active`). A plugin that reports no status is `active`; the administrator's toggle overrides both. Two uses: **hide until configured** — parse the settings in `setAdminPluginSettingsValue`, set `this.status` from them, and the re-read that follows installs or removes the items by itself, on the first load and after each save; and **a class-side kill switch** — `this.updateStatus(PluginStatus.hide)` followed by `return { actions: [Actions.updateStatus] }`, since the portal does not watch the field. A React component has no status action; its `save()` is the one moment the runtime re-reads it. While the status is `hide` the plugin's settings aside gives it as *Need enter settings* — which is also why catching an unexpected `onLoadCallback` failure and leaving `hide` behind is the wrong report: let that one throw, and the plugin card shows *Failed to initialize* with the message ([portal.md](../portal.md#when-loading-fails)).
- Write members as **arrow-function class fields**, not methods: the loader calls them from its own code, so `this` has to be bound.

## How the portal gets the plugin

```ts
const plugin = new MyPlugin();
export default plugin;
```

That is the whole registration for a module plugin (`"runtime": "module"` in `package.json`). No `window.Plugins`, no global declaration — a plugin that still assigns one carries dead code. Two consequences of how the export is used ([portal.md → loading sequence](../portal.md#the-loading-sequence)):

- **The manifest is `Object.assign`ed onto your object** — `name`, `version`, `scopes`, `url`, `enabled`, `settings`, `image`, `description`, …. A class field with one of those names holds the portal's value by the time `onLoadCallback` runs. Name your own state something else (`config`, `savedSettings`).
- **It is the same object, not a copy.** Module-scope references to `plugin` inside components stay valid, and `plugin.updateContextMenuItem(...)` from a component reaches the live maps — which is how the `update*Items` actions work from React.

## Per-scope interfaces

Each scope's interface has a page, listed in [scopes.md](scopes.md): `API`, `Settings` and `PostMessage` in this folder ([api-plugin.md](api-plugin.md), [settings-plugin.md](settings-plugin.md), [post-message-plugin.md](post-message-plugin.md)), the eight item scopes on their item pages, with what they share in [common-fields.md](../items/common-fields.md).

## Two kinds of callback

| From | Talk to the portal by | Reach the API by | Know the current file by |
|---|---|---|---|
| A class-side callback — `onItemClick`, `onClick`, `eventHandler`, `subMenu.onClick`, create-dialog `onSave` | **returning an `IMessage`** (`{ actions: [Actions.showToast], toastProps: [...] }`) | `fetch` against `getAPI()` (needs the [`API` scope](api-plugin.md)) | the `id` or `File` argument it was given |
| A React component | **calling `usePluginActions()`** | `usePluginAPI()` (no scope) | `useCurrentFile()` |

Hooks throw outside a rendered component. The two worlds meet at `showModal`: a callback returns `{ actions: [Actions.showModal], modalDialogProps: { dialogBodyComponent: Panel } }` and `Panel` is React — but `useCurrentFile()` is `null` there, so pass the clicked id through a module variable or a factory ([hooks.md](../react/hooks.md#what-usecurrentfile-returns-where)).

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

**The create dialog's `onSave` is the one exception, and it is not a reprieve.** That call *is* wrapped, and the `catch` awaits the `onError` you supplied — but with no `onError` it swallows the failure and returns, leaving the dialog open over an error nobody hears about. Either supply `onError`, or catch inside `onSave` as above; a bare `onSave` fails more quietly than an unwrapped callback, not less. Inside a component the boundary catches the throw but the outcome is no better — the surface renders as nothing ([rendering.md](../react/rendering.md#errors-loading-language-styling)), and a `catch` that discards the reason turns a fixable 403 into "it does not work".

## Localisation

**`setLanguage(locale)` is called immediately before `onLoadCallback`** — when the plugin loads, and again on the same instance each time it is switched back on. It is not a change notification, and there is nothing to rebuild in it: all it has to do is record the locale so the factories that run next translate their labels in the right language.

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

`nameLocale`/`descriptionLocale` in the manifest are separate — the portal reads those for the plugin list, under the locale `getLanguage()` returns, or under the interface language when the class has no `getLanguage()`. Components call `t()` at render time and follow the language on their own.

**Key the tables by `PluginLocale`, not by a tag you typed.** The value the portal passes is the enum's own — `PluginLocale.JA_JP` is `"ja-JP"`, `ZH_CN` is `"zh-CN"`, English is `EN_US`/`EN_GB` and never `"en"` — so a table filed under `"ja"` type-checks (the key is a string), installs, and is never found: that language quietly reads English and nobody sees an error. Type the map as `Partial<Record<PluginLocale, TStrings>>` and write the keys as members; the scaffolder does both, and the validator reports a near-miss under `locale`. The full list of 33 values — `"en-US"`, `"ru"`, `"pt-BR"` and the rest — is in the SDK's `PluginLocale`.

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
- **`ISettings.saveButton`** — how it differs from `setSaveButton` is in [settings-plugin.md → A static `saveButton`](settings-plugin.md#a-static-savebutton).

Reading a plugin that still uses the trees: [sdk-2-plugins.md](../sdk-2-plugins.md).
