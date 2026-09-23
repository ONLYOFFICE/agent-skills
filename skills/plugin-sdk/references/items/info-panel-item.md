# InfoPanel

Information about a file or room, alongside it — a tab of the plugin's own in the info panel.

| | |
|---|---|
| Types | `IInfoPanelItem`, `IInfoPanelPlugin` |
| The loader reads | `getInfoPanelItems()`, keyed by `key` |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | the tab body, `component` |
| `useCurrentFile()` | the selected file/folder/room, live |
| Redraw after a change | `updateInfoPanelItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | the tab id becomes `info_plugin-<key>`; also what [`openInfoPanel(key)`](../react/actions.md) takes to open your own tab |
| `subMenu` | ✔ | `{ name, onClick?: (id) => IMessage }` — `name` is the tab label; `onClick` fires on **every selection change**. A React tab rarely needs it |
| `component` | ✔* | the tab body; `useCurrentFile()` is the selection, live — fetch in an effect keyed on `file?.id` |
| `isHeaderVisible` | | **defaults to `true`** — the file/room title block is above your component unless you pass `false`. Only an explicit `false` removes it |
| `filesType` | | omit → everything. Five values: `room` / `folder` / `file` / `image` / `video`. **Here `file` also matches images and videos** — the opposite of the [ContextMenu](context-menu-item.md) scope, where they are separate — so `[file]` is already "any file". `folder` matches **rooms** too (a room has no extension either), so a folder-only tab shows on rooms as well; narrow it in the component if that is wrong |
| `filesExsts` | | honoured only when `filesType` includes `file` |
| `usersTypes` | | |
| `devices` | | |
| `body`, `onLoad` | deprecated | ignored when `component` is present |

\* one of `component` or `body`. Renders after the portal's own tabs; ~337px wide and already scrolls — do not add a scroll container. Suppressed for Trash, multi-selection and the root folder.
