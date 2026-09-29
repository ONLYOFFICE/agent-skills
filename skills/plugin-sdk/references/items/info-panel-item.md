# InfoPanel

Information about a file or room, alongside it — a tab of the plugin's own in the info panel.

| | |
|---|---|
| Types | [`IInfoPanelItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IInfoPanelItem.md), [`IInfoPanelPlugin`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins/IInfoPanelPlugin.md) |
| The loader reads | `getInfoPanelItems()`, keyed by `key` |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | the tab body, `component` |
| `useCurrentFile()` | the selected file/folder/room, live |
| Redraw after a change | `updateInfoPanelItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is on [`IInfoPanelItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IInfoPanelItem.md); what the portal does beyond it:

- The tab id becomes `info_plugin-<key>`; [`openInfoPanel(key)`](../react/actions.md) takes the bare `key` to open your own tab.
- `component` is the tab body; `useCurrentFile()` is the selection, live — fetch in an effect keyed on `file?.id`.
- `isHeaderVisible` **defaults to `true`** — the file/room title block is above your component unless you pass `false`. Only an explicit `false` removes it.
- `filesType` picks the kind of selection: a room gets the tab only through `room`, a plain folder only through `folder`, and without `filesType` the tab is on every selection.
- **`filesExsts` is checked only for an entry admitted as `file`.** An image or a video admitted as `image`/`video` gets the tab whatever its extension — `filesType: [image], filesExsts: [".png"]` shows on every `.jpg` too. Either list `file` alone (images and videos pass as files as well) with the extensions, or check `file.fileExst` in the component. Extensions carry the dot.
- `subMenu.onClick` is not a click: the portal calls it itself on every selection change while the tab is open, with the id as a **number** (a third-party string id arrives as `NaN`), and ignores what it returns. A React tab reads the selection from `useCurrentFile()` instead.

Renders after the portal's own tabs; ~337px wide and already scrolls — do not add a scroll container. No plugin tab on a multi-selection, in Trash, on the root folder, on a room template or anywhere in the AI agents section.
