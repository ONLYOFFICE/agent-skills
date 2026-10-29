# Reading an SDK 2 plugin (declarative UI, deprecated)

Before SDK 3 a plugin never rendered anything itself: it returned a **description** of a UI — an [`IBox`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/IBox.md) tree of `{ component: Components.x, props }` nodes (the node shapes are the `*Group` types on [Component](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/Component.md), the names on [`Components`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/enums/Components.md)) — and the portal rendered it with its own components. The portal still renders those trees, so this file exists for **auditing and migrating** plugins written that way. Do not write new UI this way; the validator warns on every deprecated form ([plugin.md → Deprecated](plugins/plugin.md#deprecated--do-not-use-in-new-code)).

## Recognising one

Webpack build (`webpack && node ./scripts/createZip.js`), `window.Plugins.<PluginName> = plugin` instead of `export default`, no `runtime` field in `package.json`, `body:`/`dialogBody:`/`settings:` objects with `component: Components.box`, `onLoad` callbacks, `updateProps`/`updateContext` in returned messages, `window.theme?.isBase` for the theme. On the portal it runs inside a shared hidden iframe, keyed by `pluginName`.

## What maps to what

| Surface | SDK 2 | SDK 3 |
|---|---|---|
| Info panel tab, sidebar button | `body: IBox` + `onLoad` | `component` |
| Modal dialog | `dialogBody`, `dialogFooter` + `onLoad` | `dialogBodyComponent` (no footer slot — buttons in the body) |
| Media viewer | `content: IBox` + `onLoad` | `component` |
| Settings page | `settings: IBox`, `saveButton` + `onLoad` | `component` + `usePluginSettings().setSaveButton`; a static `saveButton` still works as the fallback |
| Sidebar page | — | `ArticleNavigation` (new) |
| Live updates | `updateProps` (self), `updateContext` (sibling by `contextName`) | component state |
| Data loading | `onLoad` resolving to the new tree | `useEffect` |
| API from UI | `getAPI()` + `fetch` | `usePluginAPI()` |

Selectors, the create-file dialog, the media viewer's `playlistFilter` and the floating operations button are unchanged — the same data shapes from a message or a component ([selector.md](components/selector.md), [create-dialog.md](components/create-dialog.md), [media-viewer.md](components/media-viewer.md), [floating-operations-button.md](components/floating-operations-button.md)).

Migrate whole, not half: `runtime: "module"`, the Vite config from a fresh scaffold, `export default plugin`, a component for every surface that had a tree. An ES module without the runtime field never runs.

## How the host renders a tree — what matters when auditing

- Only `box` can have children, always as an array — a single node object throws; `box` maps nine `*Prop` fields to CSS and copies every other prop into `style` verbatim. Every other node's props are spread into the matching kit component as-is.
- **No error boundary.** A throw during render replaces the whole portal with an error screen. A `button` without `onClick` throws on click. A `comboBox` needs `options` to be an array and every option a `key`.
- `updateProps` **replaces** the element's props (send the full set); `newProps` only admits form controls — a `text`/`box` is updated via `contextName` + `updateContext`. Both work only from callbacks inside a rendered tree, not from a menu item ([actions.md](react/actions.md#which-actions-work-from-which-callback)).
- `checkbox`/`toggleButton` `onChange` receive **nothing** — the plugin tracks state and returns `updateProps`.
- **`onLoad` replaces every section at once.** A modal's `onLoad` must resolve to `{ newDialogHeader, newDialogBody, newDialogFooter }` — omitted ones are wiped; settings → `{ settings, saveButton? }`; info panel / article button → `{ body }`. SDK 3 types every one of them as optional, so that SDK 2 sources still compile; an omitted section compiles too, and is still wiped. A rejected `onLoad` leaves the skeleton forever.
- **A tree modal's `onClose` must itself return `{ actions: [Actions.closeModal] }`** — Esc, cross and backdrop call it, none of them closes the dialog. (A `dialogBodyComponent` modal is the opposite: the host closes it after `onClose` — [modal-dialog.md](components/modal-dialog.md).)
- Toasts: `withCross`/`timeout` are ignored; `title` is the body.
- Dead values still in the types: `ButtonSize.extraSmall` (emits `"extra-small"`, no height class), `InputSize.big`/`huge`, `borderProp` as a CSS string (only the object form renders), `IText.display`, `label` props beyond its fixed list.
- `input` defaults: `maxLength` 255, `tabIndex` −1.
