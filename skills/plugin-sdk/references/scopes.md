# Target surface: SDK ↔ portal

The SDK decides what **compiles**, the portal decides what **runs**. A scope that exists in the SDK but not in the portal produces a plugin that installs cleanly and does nothing — the worst failure mode, because nothing reports it. Everything in these references is written against one pair:

| | Version |
|---|---|
| SDK | `@onlyoffice/docspace-plugin-sdk` **`^3.0.0`** |
| Portal | DocSpace **4.0** |
| React | **19** — supplied by the portal; the plugin declares it for types and the JSX runtime |
| UI kit | `@docspace/ui-kit` — supplied by the portal at load time, never bundled |

The skill tracks a portal release, not a range, and carries no history. A plugin cannot express a minimum portal version anyway — `minDocSpaceVersion` in `config.json` is written by the packer from the installed SDK.

**SDK 3 vs SDK 2.** SDK 2 described UI as data (`IBox` trees, `onLoad`, `updateProps`); SDK 3 hands the portal a **React component** (`component`, `dialogBodyComponent`) rendered in the portal's own tree, adds the `ArticleNavigation` scope, and turns the bundle into an **ES module** with a default export and `"runtime": "module"` in the manifest. The old fields still render, marked deprecated — the list is in [sdk-contract.md](sdk-contract.md#deprecated--do-not-use-in-new-code), reading old plugins in [sdk-2-plugins.md](sdk-2-plugins.md).

## The eleven scopes

`IPlugin` is not a scope — it is the mandatory base every plugin implements. Declare a scope in `package.json:scopes` **and** implement its interface, or nothing happens.

| Scope | Interface | Getter the loader calls | Items keyed by | Renders a React component |
|---|---|---|---|---|
| `API` | `IApiPlugin` | `getAPI` (after `setAPI`) | — | — |
| `Settings` | `ISettingsPlugin` | `getAdminPluginSettings` | — | `ISettings.component` |
| `ContextMenu` | `IContextMenuPlugin` | `getContextMenuItems` | `key` | — (a click may open a modal) |
| `InfoPanel` | `IInfoPanelPlugin` | `getInfoPanelItems` | `key` | `component` |
| `MainButton` | `IMainButtonPlugin` | `getMainButtonItems` | `key` | — |
| `ProfileMenu` | `IProfileMenuPlugin` | `getProfileMenuItems` | `key` | — |
| `EventListener` | `IEventListenerPlugin` | `getEventListenerItems` | `key` | — |
| `File` | `IFilePlugin` | `getFileItems` | `extension` | — (a click may open a modal or viewer) |
| `ArticleButton` | `IArticleButtonPlugin` | `getArticleButtonItems` | `key` | `component` |
| `ArticleNavigation` | `IArticleNavigationPlugin` | `getArticleNavigationItems` | `key` | `component` |
| `PostMessage` | `IPostMessagePlugin` | `setPostMessageCallback` | — | — |

`API` exists for class-side callbacks that build URLs from `getAPI()`; a React component reaches the API through `usePluginAPI()` without it.

## Anything not in that table

The table is the whole list. Nothing outside it may be generated or described as available — not a scope, interface or enum member — however plausible it sounds and however often it appears in material about the SDK. A name the SDK does not export is a loud build error; a name a newer SDK exports but no shipped portal handles compiles, uploads, enables and silently shows nothing. When a request has no scope here, say the target pair does not support it and offer the closest entry point — a whole screen → `ArticleNavigation`, a small persistent control → `ArticleButton`. `scripts/contract.mjs` enforces the same list in the scaffolder and the validator, and the validator's `sdk-drift` finding reports an installed SDK that diverges from it. Keeping the pair current is described in the skill's [README](../README.md#keeping-it-current).
