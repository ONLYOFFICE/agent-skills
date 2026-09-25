# Target surface: SDK ↔ portal

The SDK decides what **compiles**, the portal decides what **runs**. A scope that exists in the SDK but not in the portal produces a plugin that installs cleanly and does nothing — the worst failure mode, because nothing reports it. Everything in these references is written against one pair:

| | Version |
|---|---|
| SDK | `@onlyoffice/docspace-plugin-sdk` **`^3.0.0`** |
| Portal | ONLYOFFICE Apps **4.0** |
| React | **19** — supplied by the portal; the plugin declares it for types and the JSX runtime |
| UI kit | `@docspace/ui-kit` — supplied by the portal at load time, never bundled |

The skill tracks a portal release, not a range, and carries no history. A plugin cannot express a minimum portal version anyway — `minDocSpaceVersion` in `config.json` is written by the packer from the installed SDK.

**SDK 3 vs SDK 2.** SDK 2 described UI as data (`IBox` trees, `onLoad`, `updateProps`); SDK 3 hands the portal a **React component** (`component`, `dialogBodyComponent`) rendered in the portal's own tree, adds the `ArticleNavigation` scope, and turns the bundle into an **ES module** with a default export and `"runtime": "module"` in the manifest. The old fields still render, marked deprecated — the list is in [plugin.md](plugin.md#deprecated--do-not-use-in-new-code), reading old plugins in [sdk-2-plugins.md](../sdk-2-plugins.md).

## The eleven scopes

`IPlugin` is not a scope — it is the mandatory base every plugin implements ([plugin.md](plugin.md)). Declare a scope in `package.json:scopes` **and** implement its interface, or nothing happens. Each scope links to its page.

| Scope | Interface | What the portal calls | Items keyed by | Renders a React component |
|---|---|---|---|---|
| [`API`](api-plugin.md) | `IApiPlugin` | `setAPI` (`getAPI` is the plugin's own) | — | — |
| [`Settings`](settings-plugin.md) | `ISettingsPlugin` | `setAdminPluginSettingsValue`; `getAdminPluginSettings` when the settings aside opens | — | `ISettings.component` |
| [`ContextMenu`](../items/context-menu-item.md) | `IContextMenuPlugin` | `getContextMenuItems` | `key` | — (a click may open a modal) |
| [`InfoPanel`](../items/info-panel-item.md) | `IInfoPanelPlugin` | `getInfoPanelItems` | `key` | `component` |
| [`MainButton`](../items/main-button-item.md) | `IMainButtonPlugin` | `getMainButtonItems` | `key` | — |
| [`ProfileMenu`](../items/profile-menu-item.md) | `IProfileMenuPlugin` | `getProfileMenuItems` | `key` | — |
| [`EventListener`](../items/event-listener-item.md) | `IEventListenerPlugin` | `getEventListenerItems` | `key` | — |
| [`File`](../items/file-item.md) | `IFilePlugin` | `getFileItems` | `extension` | — (a click may open a modal or viewer) |
| [`ArticleButton`](../items/article-button-item.md) | `IArticleButtonPlugin` | `getArticleButtonItems` | `key` | `component` |
| [`ArticleNavigation`](../items/article-navigation-item.md) | `IArticleNavigationPlugin` | `getArticleNavigationItems` | `key` | `component` |
| [`PostMessage`](post-message-plugin.md) | `IPostMessagePlugin` | `setPostMessageCallback` | — | — |

## The item scopes share one shape

**Item-map scopes** — ContextMenu, InfoPanel, MainButton, ProfileMenu, EventListener, File, ArticleButton, ArticleNavigation — share one shape: a `Map`, `add<Scope>Item`, `get<Scope>Items`, `update<Scope>Item` (plus `getContextMenuItemsKeys` for ContextMenu). Two exceptions: **EventListener** has no `update…Item` — re-add to replace; **File** keys its map by `extension`, not `key`. So the eight `I<Scope>Plugin` interfaces have no page of their own: what the portal does with each scope is on its item's page, and what every item shares is in [common-fields.md](../items/common-fields.md).

## Anything not in that table

**The editor is a different product.** Nothing in that table reaches inside an open document — the SDK exports no editor member at all. A plugin owns a file extension, opens its own viewer over a file, reads and writes its bytes through the REST API, and sends the user into the editor by opening its URL ([actions.md → Opening a document](../react/actions.md#opening-a-document-is-a-page-load)); a control in the editor's toolbar, or anything that changes what the editor draws, is an ONLYOFFICE Docs plugin or macro — a separate format with its own API, installed into the editor rather than the portal. "A button in the document" belongs there; "a button beside the document" is a `ContextMenu` or `InfoPanel` item here.

The table is the whole list. Nothing outside it may be generated or described as available — not a scope, interface or enum member — however plausible it sounds and however often it appears in material about the SDK. A name the SDK does not export is a loud build error; a name a newer SDK exports but no shipped portal handles compiles, uploads, enables and silently shows nothing. When a request has no scope here, say the target pair does not support it and offer the closest entry point — a whole screen → `ArticleNavigation`, a small persistent control → `ArticleButton`. `scripts/contract.mjs` enforces the same list in the scaffolder and the validator, and the validator's `sdk-drift` finding reports an installed SDK that diverges from it. Keeping the pair current is described in the skill's [README](../../README.md#keeping-it-current).
