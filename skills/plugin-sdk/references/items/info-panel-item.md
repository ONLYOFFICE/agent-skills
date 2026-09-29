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
- `filesType: [folder]` matches **rooms** too (a room has no extension either), so a folder-only tab shows on rooms as well; narrow it in the component if that is wrong.

Renders after the portal's own tabs; ~337px wide and already scrolls — do not add a scroll container. Suppressed for Trash, multi-selection and the root folder.
