# The plugin class contract

What the class must implement. Signatures are from SDK 2.1.0; the target pair and scope list live in [sdk-target.md](sdk-target.md).

The SDK contains no runtime logic — its compiled output is enums and nothing else. Every interface here is a shape the portal expects to find on the object you register; nothing enforces it at build time beyond TypeScript.

## IPlugin — always required

```ts
interface IPlugin {
  status: PluginStatus;
  onLoadCallback: () => Promise<void>;
  updateStatus(status: PluginStatus): void;
  getStatus(): PluginStatus;
  setOnLoadCallback(callback: () => Promise<void>): void;

  // optional, but implement them if the plugin shows any text
  language?: PluginLocale;
  setLanguage?: (language: PluginLocale) => void;
  getLanguage?: () => PluginLocale;
}
```

`PluginStatus` is `active` or `hide`. Returning `hide` from `getStatus()` stops installation before any items or CSS are read — useful for a kill switch, disastrous by accident.

Write members as **arrow-function class fields**, not methods. The loader copies the object by spreading it, which detaches ordinary methods from `this`.

## Per-scope interfaces

### API

Gives the plugin the portal's own base URLs. There is no token — requests ride the user's session cookies, so pass `credentials: "include"`.

```ts
origin: string; proxy: string; prefix: string;
setOrigin(o: string): void;  getOrigin(): string;
setProxy(p: string): void;   getProxy(): string;
setPrefix(p: string): void;  getPrefix(): string;
setAPI(origin: string, proxy: string, prefix: string): void;
getAPI(): { origin: string; proxy: string; prefix: string };
```

`setAPI` runs before `onLoadCallback`, so the values are ready by the time you need them. See [rest-api.md](rest-api.md) for assembling request URLs.

### Settings

```ts
adminPluginSettings: ISettings | null;
setAdminPluginSettings(settings: ISettings | null): void;
setAdminPluginSettingsValue(settings: string | null): void;   // note: a raw string
getAdminPluginSettings(): ISettings | null;
```

Settings are stored as an opaque string — whatever the plugin passed to `saveSettings`. It comes back through `setAdminPluginSettingsValue` **after** installation, so parse it there and defensively: a malformed value must not throw, and `null`/`""` is a normal first-run value. They survive a disable/enable cycle.

```ts
interface ISettings {
  settings: IBox;          // the declarative form
  saveButton: ButtonGroup;
  isLoading?: boolean;
  onLoad?: () => Promise<{ settings: IBox; saveButton?: ButtonGroup }>;
}
```

The block renders in an **aside panel** opened from Integration → Plugins (never inline on the page), with the plugin's metadata (author, version, status, description) rendered by the portal below your `settings` box — do not duplicate it. The portal also **restyles `saveButton`** into its footer: label becomes the localized "Save", size/primary/scale are forced. What remains yours is `onClick` and the loading flags (`withLoadingAfterClick`, `disableWhileRequestRunning`).

Saving is a message, not a call: return `{ actions: [Actions.saveSettings], settings: JSON.stringify(value) }` from the save button. (`saveSettings` also works from other buttons and menu callbacks, and **throws** from non-button form elements — see [host-behavior.md](host-behavior.md); the save button is where it belongs.)

### PostMessage

For plugins whose UI is a third-party page in an iframe.

```ts
postMessageCallback: (message: IPostMessageCallbackMessage) => void;
setPostMessageCallback(cb: IPostMessagePlugin["postMessageCallback"]): void;
getPostMessageCallback(): IPostMessagePlugin["postMessageCallback"];
```

The direction is easy to get backwards. The **portal** hands you the callback; you invoke it to ask the portal to do something. Listening to your iframe is your own job, and because plugin code runs inside a hidden iframe, the listener goes on `window.parent`:

```ts
window.parent.addEventListener("message", (e) => { /* … */ });
```

`IPostMessageCallbackMessage` accepts a restricted action set — no `updateProps`, `updateContext`, `updateStatus`, `sendPostMessage`, `saveSettings`, or any `update*` variant of selector/dialog/media viewer.

### Item-map scopes

ContextMenu, InfoPanel, MainButton, ProfileMenu, EventListener, File and ArticleButton all follow one shape — a `Map`, an adder, a getter, and usually an updater:

```ts
contextMenuItems: Map<string, IContextMenuItem>;
addContextMenuItem(item: IContextMenuItem): void;
getContextMenuItems(): Map<string, IContextMenuItem>;
updateContextMenuItem(item: IContextMenuItem): void;
getContextMenuItemsKeys(): string[];     // ContextMenu only
```

Substitute the scope name throughout. Two exceptions:

- **EventListener** has no `updateEventListenerItem` — re-add to replace, the map overwrites by key.
- **File** keys its map by `extension`, not `key`; the adder is `addFileItem` and the getter `getFileItems`.

Item field details are in [items.md](items.md).

## Registration

```ts
const plugin = new MyPlugin();

declare global {
  interface Window {
    Plugins: Record<string, unknown>;
  }
}

window.Plugins.MyPlugin = plugin || {};

export default plugin;
```

The key **must** equal `pluginName` in `package.json`. This is the single most common cause of a plugin that installs and does nothing.

`window.Plugins` is created by the portal, not by the plugin — which is also why the bundle cannot run outside DocSpace.

## Localisation

The portal calls `setLanguage(locale)` when the interface language changes. Labels were captured when items were built, so changing the language means **rebuilding the items**:

```ts
setLanguage = (language: PluginLocale) => {
  setLocale(language);
  this.updateContextMenuItem(myContextMenuItem());
};
```

This is why item factories should be functions returning a fresh object, never module-level constants.

`nameLocale` and `descriptionLocale` in the manifest are separate — the portal reads those itself for the plugin list.

## Deprecated — do not use in new code

- `IContextMenuItem.onClick` → use `onItemClick`
- `IMainButtonItem.onClick` → use `onItemClick`
- `ISeparatorItem` — deprecated and not exported at all

`IProfileMenuItem.onClick` is **not** deprecated: that scope has no `onItemClick`, and its `onClick` takes no arguments.
