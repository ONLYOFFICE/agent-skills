# MainButton

A "create new…" entry.

| | |
|---|---|
| Types | [`IMainButtonItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IMainButtonItem.md), [`IMainButtonPlugin`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins/IMainButtonPlugin.md) |
| The loader reads | `getMainButtonItems()`, keyed by `key` |
| Role filter | `usersType` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | none — a click may open a dialog |
| Redraw after a change | `updateMainButtonItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is on [`IMainButtonItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IMainButtonItem.md). `onItemClick` receives the **current folder** id. A submenu is one level deep — a child's own `items` are dropped — and the portal builds the children when the plugin registers: on some builds, if no folder is open at that moment (the plugin loaded on a plugin page, in settings or in Accounts), the parent shows with no children until a reload inside a folder. A flat entry does not have the problem.

Plugin entries are grouped under a single **"More"** entry of the "New" menu — the main button, the section "+" menu and the mobile create button share it — placed after the document, form and folder entries and before the template gallery and upload. It exists only inside a folder or room **the user may create in** (`security.Create`), and never on a settings page, in a public room, in a form-filling room or a folder inside one, in an AI room or the AI agents section, on the Rooms list, in Forms or in Privacy — so a plugin entry appears where the portal itself offers file creation, and nowhere else. This is the surface for "create a new …"; an action on existing things belongs in [`ContextMenu`](context-menu-item.md).
